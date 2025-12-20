/**
 * @fileoverview Cash Ticket Audit Script
 * Compares OfflineCash and CashEventEnrollment records to find discrepancies
 * Runs on server startup and generates a markdown report
 */

import fs from "fs";
import path from "path";
import OfflineCash from "../schema/OfflineCash.schema.js";
import CashEventEnrollment from "../schema/CashEventEnrollment.schema.js";
import Event from "../schema/Event.schema.js";

// Use process.cwd() for reliable path resolution on Windows
const ROOT_DIR = process.cwd();

/**
 * Run cash ticket audit and generate report
 */
export const runCashTicketAudit = async () => {
  console.log("[AUDIT] Starting cash ticket audit...");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {},
    issues: [],
    recommendations: [],
  };

  try {
    // 1. Get all OfflineCash records (including non-redeemed)
    const allOfflineCash = await OfflineCash.find({ isDeleted: false })
      .populate("eventId", "name")
      .populate("generatedBy", "name username")
      .lean();

    // 2. Get all CashEventEnrollment records
    const allCashEnrollments = await CashEventEnrollment.find({ isDeleted: false })
      .populate("eventId", "name")
      .populate("offlineCashId")
      .lean();

    // 3. Calculate totals
    const totalOfflineCashRecords = allOfflineCash.length;
    const totalTicketsMinted = allOfflineCash.reduce((sum, r) => sum + r.ticketCount, 0);
    const redeemedOfflineCash = allOfflineCash.filter((r) => r.redeemed);
    const totalTicketsRedeemed = redeemedOfflineCash.reduce((sum, r) => sum + r.ticketCount, 0);
    const totalCashEnrollments = allCashEnrollments.length;

    report.summary = {
      totalOfflineCashRecords,
      totalTicketsMinted,
      redeemedOfflineCashRecords: redeemedOfflineCash.length,
      totalTicketsRedeemed,
      totalCashEnrollments,
      discrepancy: totalTicketsRedeemed - totalCashEnrollments,
    };

    // Store all records for detailed comparison
    report.allRecords = [];

    // 4. Create lookup map for enrollments by offlineCashId
    const enrollmentsByOfflineCashId = {};
    for (const enrollment of allCashEnrollments) {
      const offlineCashId = enrollment.offlineCashId?._id?.toString() || enrollment.offlineCashId?.toString();
      if (!offlineCashId) continue;
      if (!enrollmentsByOfflineCashId[offlineCashId]) {
        enrollmentsByOfflineCashId[offlineCashId] = [];
      }
      enrollmentsByOfflineCashId[offlineCashId].push(enrollment);
    }

    // 5. Build detailed records for comparison
    for (const record of allOfflineCash) {
      const recordId = record._id.toString();
      const enrollments = enrollmentsByOfflineCashId[recordId] || [];

      // Get enrolled phone numbers
      const enrolledPhones = enrollments.map(e => ({
        phone: e.phone,
        name: e.name,
        enrollmentId: e._id.toString(),
        isTicketScanned: e.isTicketScanned || false,
      }));

      // Determine status
      let status = "OK";
      if (record.redeemed && enrollments.length === 0) {
        status = "REDEEMED_NO_ENROLLMENT";
      } else if (!record.redeemed && enrollments.length > 0) {
        status = "NOT_REDEEMED_HAS_ENROLLMENT";
      } else if (record.redeemed && enrollments.length !== record.ticketCount) {
        status = "COUNT_MISMATCH";
      } else if (!record.redeemed) {
        status = "PENDING";
      }

      report.allRecords.push({
        offlineCashId: recordId,
        signature: record.signature,
        generatedFor: record.generatedFor,
        ticketCount: record.ticketCount,
        redeemed: record.redeemed,
        redeemedAt: record.redeemedAt,
        priceCharged: record.priceCharged,
        eventName: record.eventId?.name || "Unknown",
        generatedBy: record.generatedBy?.name || "Unknown",
        actualEnrollments: enrollments.length,
        missingEnrollments: record.redeemed ? Math.max(0, record.ticketCount - enrollments.length) : 0,
        status,
        enrolledPhones,
      });
    }

    // 6. Check for issues

    // Issue Type A: OfflineCash marked as redeemed but no CashEventEnrollment exists
    for (const record of redeemedOfflineCash) {
      const recordId = record._id.toString();
      const enrollments = enrollmentsByOfflineCashId[recordId] || [];

      if (enrollments.length === 0) {
        report.issues.push({
          type: "REDEEMED_NO_ENROLLMENT",
          severity: "HIGH",
          offlineCashId: recordId,
          signature: record.signature,
          ticketCount: record.ticketCount,
          generatedFor: record.generatedFor,
          eventName: record.eventId?.name || "Unknown",
          generatedBy: record.generatedBy?.name || "Unknown",
          redeemedAt: record.redeemedAt,
          description: `OfflineCash marked as redeemed but has no CashEventEnrollment records`,
        });
      }
    }

    // Issue Type B: OfflineCash NOT redeemed but CashEventEnrollment exists
    const notRedeemedOfflineCash = allOfflineCash.filter((r) => !r.redeemed);
    for (const record of notRedeemedOfflineCash) {
      const recordId = record._id.toString();
      const enrollments = enrollmentsByOfflineCashId[recordId] || [];

      if (enrollments.length > 0) {
        report.issues.push({
          type: "NOT_REDEEMED_HAS_ENROLLMENT",
          severity: "MEDIUM",
          offlineCashId: recordId,
          signature: record.signature,
          ticketCount: record.ticketCount,
          enrollmentCount: enrollments.length,
          generatedFor: record.generatedFor,
          eventName: record.eventId?.name || "Unknown",
          description: `OfflineCash NOT marked as redeemed but has ${enrollments.length} CashEventEnrollment records`,
        });
      }
    }

    // Issue Type C: Enrollment count mismatch (enrollments != ticketCount for redeemed records)
    for (const record of redeemedOfflineCash) {
      const recordId = record._id.toString();
      const enrollments = enrollmentsByOfflineCashId[recordId] || [];

      if (enrollments.length > 0 && enrollments.length !== record.ticketCount) {
        report.issues.push({
          type: "ENROLLMENT_COUNT_MISMATCH",
          severity: "LOW",
          offlineCashId: recordId,
          signature: record.signature,
          ticketCount: record.ticketCount,
          actualEnrollments: enrollments.length,
          difference: record.ticketCount - enrollments.length,
          generatedFor: record.generatedFor,
          eventName: record.eventId?.name || "Unknown",
          description: `OfflineCash has ticketCount=${record.ticketCount} but only ${enrollments.length} enrollments exist`,
        });
      }
    }

    // Issue Type D: Orphaned CashEventEnrollment (offlineCashId doesn't exist or is deleted)
    const offlineCashIds = new Set(allOfflineCash.map((r) => r._id.toString()));
    for (const enrollment of allCashEnrollments) {
      const offlineCashId = enrollment.offlineCashId?._id?.toString() || enrollment.offlineCashId?.toString();
      if (!offlineCashId || !offlineCashIds.has(offlineCashId)) {
        report.issues.push({
          type: "ORPHANED_ENROLLMENT",
          severity: "HIGH",
          enrollmentId: enrollment._id.toString(),
          offlineCashId: offlineCashId || "NULL",
          phone: enrollment.phone,
          name: enrollment.name,
          eventName: enrollment.eventId?.name || "Unknown",
          description: `CashEventEnrollment references non-existent or deleted OfflineCash record`,
        });
      }
    }

    // 6. Generate recommendations based on issues
    const issuesByType = {};
    for (const issue of report.issues) {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    }

    if (issuesByType["REDEEMED_NO_ENROLLMENT"]?.length > 0) {
      report.recommendations.push({
        priority: "HIGH",
        action: "Investigate OfflineCash records marked as redeemed without enrollments",
        count: issuesByType["REDEEMED_NO_ENROLLMENT"].length,
        suggestion: "These records may need their redeemed status reset to false, or enrollments need to be manually created",
      });
    }

    if (issuesByType["NOT_REDEEMED_HAS_ENROLLMENT"]?.length > 0) {
      report.recommendations.push({
        priority: "MEDIUM",
        action: "Update OfflineCash records to mark them as redeemed",
        count: issuesByType["NOT_REDEEMED_HAS_ENROLLMENT"].length,
        suggestion: "Run a script to set redeemed=true and redeemedAt for these records",
      });
    }

    if (issuesByType["ORPHANED_ENROLLMENT"]?.length > 0) {
      report.recommendations.push({
        priority: "HIGH",
        action: "Investigate orphaned CashEventEnrollment records",
        count: issuesByType["ORPHANED_ENROLLMENT"].length,
        suggestion: "These enrollments reference deleted/missing OfflineCash records and may need cleanup",
      });
    }

    // 7. Generate markdown report
    const markdown = generateMarkdownReport(report);

    // 8. Write report to file
    const reportsDir = path.join(ROOT_DIR, "reports");
    console.log(`[AUDIT] ROOT_DIR: ${ROOT_DIR}`);
    console.log(`[AUDIT] Reports dir: ${reportsDir}`);

    try {
      if (!fs.existsSync(reportsDir)) {
        console.log(`[AUDIT] Creating reports directory...`);
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const reportPath = path.join(reportsDir, "cash-ticket-audit.md");
      console.log(`[AUDIT] Writing to: ${reportPath}`);
      fs.writeFileSync(reportPath, markdown, "utf-8");

      // Verify file was created
      if (fs.existsSync(reportPath)) {
        console.log(`[AUDIT] File verified - exists at: ${reportPath}`);
      } else {
        console.error(`[AUDIT] ERROR: File was not created!`);
      }

      console.log(`[AUDIT] Cash ticket audit completed. Report saved to: ${reportPath}`);
      console.log(`[AUDIT] Summary: ${report.issues.length} issues found`);
    } catch (fileError) {
      console.error(`[AUDIT] File operation error:`, fileError);
    }

    return report;
  } catch (error) {
    console.error("[AUDIT] Error running cash ticket audit:", error);
    throw error;
  }
};

/**
 * Generate markdown report from audit data
 */
const generateMarkdownReport = (report) => {
  const lines = [];

  lines.push("# Cash Ticket Audit Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`Total OfflineCash Records: ${report.summary.totalOfflineCashRecords}`);
  lines.push(`Total Tickets Minted: ${report.summary.totalTicketsMinted}`);
  lines.push(`Redeemed OfflineCash Records: ${report.summary.redeemedOfflineCashRecords}`);
  lines.push(`Total Tickets Marked as Redeemed: ${report.summary.totalTicketsRedeemed}`);
  lines.push(`Total CashEventEnrollment Records: ${report.summary.totalCashEnrollments}`);
  lines.push(`Discrepancy (Redeemed Tickets - Enrollments): ${report.summary.discrepancy}`);
  lines.push("");

  // Issues
  lines.push("## Issues Found");
  lines.push("");

  if (report.issues.length === 0) {
    lines.push("No issues found. All records are consistent.");
  } else {
    lines.push(`Total Issues: ${report.issues.length}`);
    lines.push("");

    // Group by type
    const issuesByType = {};
    for (const issue of report.issues) {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    }

    // REDEEMED_NO_ENROLLMENT
    if (issuesByType["REDEEMED_NO_ENROLLMENT"]) {
      lines.push("### Redeemed Without Enrollment (HIGH Severity)");
      lines.push("");
      lines.push("OfflineCash records marked as redeemed but have no corresponding CashEventEnrollment:");
      lines.push("");
      for (const issue of issuesByType["REDEEMED_NO_ENROLLMENT"]) {
        lines.push(`- Signature: ${issue.signature}`);
        lines.push(`  - OfflineCash ID: ${issue.offlineCashId}`);
        lines.push(`  - Ticket Count: ${issue.ticketCount}`);
        lines.push(`  - Generated For: ${issue.generatedFor}`);
        lines.push(`  - Event: ${issue.eventName}`);
        lines.push(`  - Generated By: ${issue.generatedBy}`);
        lines.push(`  - Redeemed At: ${issue.redeemedAt || "N/A"}`);
        lines.push("");
      }
    }

    // NOT_REDEEMED_HAS_ENROLLMENT
    if (issuesByType["NOT_REDEEMED_HAS_ENROLLMENT"]) {
      lines.push("### Not Redeemed But Has Enrollments (MEDIUM Severity)");
      lines.push("");
      lines.push("OfflineCash records NOT marked as redeemed but have CashEventEnrollment records:");
      lines.push("");
      for (const issue of issuesByType["NOT_REDEEMED_HAS_ENROLLMENT"]) {
        lines.push(`- Signature: ${issue.signature}`);
        lines.push(`  - OfflineCash ID: ${issue.offlineCashId}`);
        lines.push(`  - Ticket Count: ${issue.ticketCount}`);
        lines.push(`  - Enrollment Count: ${issue.enrollmentCount}`);
        lines.push(`  - Generated For: ${issue.generatedFor}`);
        lines.push(`  - Event: ${issue.eventName}`);
        lines.push("");
      }
    }

    // ENROLLMENT_COUNT_MISMATCH
    if (issuesByType["ENROLLMENT_COUNT_MISMATCH"]) {
      lines.push("### Enrollment Count Mismatch (LOW Severity)");
      lines.push("");
      lines.push("OfflineCash ticketCount doesn't match actual enrollment count:");
      lines.push("");
      for (const issue of issuesByType["ENROLLMENT_COUNT_MISMATCH"]) {
        lines.push(`- Signature: ${issue.signature}`);
        lines.push(`  - OfflineCash ID: ${issue.offlineCashId}`);
        lines.push(`  - Expected (ticketCount): ${issue.ticketCount}`);
        lines.push(`  - Actual Enrollments: ${issue.actualEnrollments}`);
        lines.push(`  - Difference: ${issue.difference}`);
        lines.push(`  - Event: ${issue.eventName}`);
        lines.push("");
      }
    }

    // ORPHANED_ENROLLMENT
    if (issuesByType["ORPHANED_ENROLLMENT"]) {
      lines.push("### Orphaned Enrollments (HIGH Severity)");
      lines.push("");
      lines.push("CashEventEnrollment records referencing non-existent OfflineCash:");
      lines.push("");
      for (const issue of issuesByType["ORPHANED_ENROLLMENT"]) {
        lines.push(`- Enrollment ID: ${issue.enrollmentId}`);
        lines.push(`  - Referenced OfflineCash ID: ${issue.offlineCashId}`);
        lines.push(`  - Phone: ${issue.phone}`);
        lines.push(`  - Name: ${issue.name}`);
        lines.push(`  - Event: ${issue.eventName}`);
        lines.push("");
      }
    }
  }

  // Recommendations
  lines.push("## Recommendations");
  lines.push("");

  if (report.recommendations.length === 0) {
    lines.push("No actions required.");
  } else {
    for (const rec of report.recommendations) {
      lines.push(`### [${rec.priority}] ${rec.action}`);
      lines.push("");
      lines.push(`Affected Records: ${rec.count}`);
      lines.push(`Suggestion: ${rec.suggestion}`);
      lines.push("");
    }
  }

  // Next Steps
  lines.push("## Next Steps");
  lines.push("");
  if (report.issues.length > 0) {
    lines.push("1. Review the issues listed above");
    lines.push("2. For HIGH severity issues, investigate immediately");
    lines.push("3. For MEDIUM severity issues, run correction scripts if available");
    lines.push("4. For LOW severity issues, these may be expected (partial redemptions) but verify");
    lines.push("5. Re-run this audit after making corrections to verify fixes");
  } else {
    lines.push("All records are consistent. No action needed.");
  }
  lines.push("");

  // All Records Detail
  if (report.allRecords && report.allRecords.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## All Records (Detailed Comparison)");
    lines.push("");

    // Group by status for better readability
    const recordsByStatus = {
      REDEEMED_NO_ENROLLMENT: [],
      NOT_REDEEMED_HAS_ENROLLMENT: [],
      COUNT_MISMATCH: [],
      OK: [],
      PENDING: [],
    };

    for (const record of report.allRecords) {
      if (recordsByStatus[record.status]) {
        recordsByStatus[record.status].push(record);
      }
    }

    // Problem records first
    if (recordsByStatus.REDEEMED_NO_ENROLLMENT.length > 0) {
      lines.push("### REDEEMED BUT NO ENROLLMENTS");
      lines.push("");
      for (const r of recordsByStatus.REDEEMED_NO_ENROLLMENT) {
        lines.push(`**${r.signature}** (${r.generatedFor})`);
        lines.push(`- OfflineCash ID: ${r.offlineCashId}`);
        lines.push(`- Event: ${r.eventName}`);
        lines.push(`- Generated By: ${r.generatedBy}`);
        lines.push(`- Ticket Count: ${r.ticketCount}`);
        lines.push(`- Price Charged: ${r.priceCharged}`);
        lines.push(`- Redeemed At: ${r.redeemedAt}`);
        lines.push(`- Actual Enrollments: 0`);
        lines.push(`- Missing: ALL ${r.ticketCount} enrollments`);
        lines.push("");
      }
    }

    if (recordsByStatus.COUNT_MISMATCH.length > 0) {
      lines.push("### COUNT MISMATCH (Partial Enrollments)");
      lines.push("");
      for (const r of recordsByStatus.COUNT_MISMATCH) {
        lines.push(`**${r.signature}** (${r.generatedFor})`);
        lines.push(`- OfflineCash ID: ${r.offlineCashId}`);
        lines.push(`- Event: ${r.eventName}`);
        lines.push(`- Generated By: ${r.generatedBy}`);
        lines.push(`- Ticket Count: ${r.ticketCount}`);
        lines.push(`- Price Charged: ${r.priceCharged}`);
        lines.push(`- Redeemed At: ${r.redeemedAt}`);
        lines.push(`- Actual Enrollments: ${r.actualEnrollments}`);
        lines.push(`- Missing: ${r.missingEnrollments} enrollment(s)`);
        lines.push(`- Enrolled Phones:`);
        for (const phone of r.enrolledPhones) {
          lines.push(`  - ${phone.phone} (${phone.name}) - Scanned: ${phone.isTicketScanned ? 'Yes' : 'No'}`);
        }
        lines.push("");
      }
    }

    if (recordsByStatus.NOT_REDEEMED_HAS_ENROLLMENT.length > 0) {
      lines.push("### NOT REDEEMED BUT HAS ENROLLMENTS");
      lines.push("");
      for (const r of recordsByStatus.NOT_REDEEMED_HAS_ENROLLMENT) {
        lines.push(`**${r.signature}** (${r.generatedFor})`);
        lines.push(`- OfflineCash ID: ${r.offlineCashId}`);
        lines.push(`- Event: ${r.eventName}`);
        lines.push(`- Generated By: ${r.generatedBy}`);
        lines.push(`- Ticket Count: ${r.ticketCount}`);
        lines.push(`- Redeemed: NO (but has enrollments)`);
        lines.push(`- Actual Enrollments: ${r.actualEnrollments}`);
        lines.push(`- Enrolled Phones:`);
        for (const phone of r.enrolledPhones) {
          lines.push(`  - ${phone.phone} (${phone.name})`);
        }
        lines.push("");
      }
    }

    // OK records
    if (recordsByStatus.OK.length > 0) {
      lines.push("### OK (Redeemed with Matching Enrollments)");
      lines.push("");
      for (const r of recordsByStatus.OK) {
        lines.push(`**${r.signature}** (${r.generatedFor}) - ${r.ticketCount} ticket(s), ${r.actualEnrollments} enrollment(s) OK`);
        if (r.enrolledPhones.length > 0) {
          for (const phone of r.enrolledPhones) {
            lines.push(`  - ${phone.phone} (${phone.name}) - Scanned: ${phone.isTicketScanned ? 'Yes' : 'No'}`);
          }
        }
        lines.push("");
      }
    }

    // Pending records
    if (recordsByStatus.PENDING.length > 0) {
      lines.push("### PENDING (Not Yet Redeemed)");
      lines.push("");
      for (const r of recordsByStatus.PENDING) {
        lines.push(`**${r.signature}** (${r.generatedFor}) - ${r.ticketCount} ticket(s), awaiting redemption`);
        lines.push(`  - Event: ${r.eventName}`);
        lines.push(`  - Generated By: ${r.generatedBy}`);
        lines.push("");
      }
    }
  }

  return lines.join("\n");
};

export default { runCashTicketAudit };
