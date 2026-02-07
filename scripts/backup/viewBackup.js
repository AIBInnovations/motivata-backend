/**
 * @fileoverview Script to view backup file contents in a readable format
 *
 * Usage:
 *   node viewBackup.js                                                  # View latest backup
 *   node viewBackup.js <backup-filename>                                # View specific backup
 *   node viewBackup.js <backup-filename> --json                         # Show raw JSON
 *
 * Example:
 *   node viewBackup.js membership-requests-backup-2026-02-04T07-05-07.json
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get command line arguments
const backupFilename = process.argv[2];
const SHOW_JSON = process.argv.includes('--json');

/**
 * Get the latest backup file
 */
async function getLatestBackup() {
  const backupDir = join(__dirname, '..', '..', 'backups');
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(f => f.startsWith('membership-requests-backup-') && f.endsWith('.json'))
      .sort()
      .reverse();

    return backupFiles[0] || null;
  } catch (error) {
    return null;
  }
}

/**
 * Format date to readable string
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  if (amount == null) return 'N/A';
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Main viewer function
 */
async function viewBackup() {
  try {
    console.log('📄 Backup File Viewer');
    console.log('=' .repeat(80));
    console.log();

    // Determine which backup to view
    let filename = backupFilename;
    if (!filename) {
      console.log('🔍 Looking for latest backup...');
      filename = await getLatestBackup();
      if (!filename) {
        console.error('❌ No backup files found in backups/ directory');
        process.exit(1);
      }
      console.log(`✅ Found: ${filename}\n`);
    }

    // Read backup file
    const backupPath = join(__dirname, 'backups', filename);
    let backupData;
    try {
      const backupJson = await fs.readFile(backupPath, 'utf-8');
      backupData = JSON.parse(backupJson);
    } catch (error) {
      console.error(`❌ Error reading backup file: ${error.message}`);
      console.log('\n💡 Make sure the file exists in the backups/ directory');
      process.exit(1);
    }

    // If --json flag, just output raw JSON
    if (SHOW_JSON) {
      console.log(JSON.stringify(backupData, null, 2));
      return;
    }

    // Display metadata
    console.log('📋 BACKUP METADATA');
    console.log('=' .repeat(80));
    console.log(`File: ${filename}`);
    console.log(`Backup Date: ${formatDate(backupData.metadata.backupDate)}`);
    console.log(`Backup Type: ${backupData.metadata.backupType}`);
    console.log(`Environment: ${backupData.metadata.environment}`);
    console.log();

    // Display statistics
    const stats = backupData.statistics?.membershipRequests;
    if (stats) {
      console.log('📊 STATISTICS');
      console.log('=' .repeat(80));
      console.log(`Total Requests: ${stats.total}`);
      console.log();
      console.log('By Status:');
      Object.entries(stats.byStatus || {}).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      console.log();
      console.log(`With Payment Links: ${stats.withPaymentLinks}`);
      console.log(`With Payment IDs: ${stats.withPayments}`);
      console.log(`With Order IDs: ${stats.withOrders}`);
      console.log();
    }

    // Display membership requests
    console.log('👥 MEMBERSHIP REQUESTS');
    console.log('=' .repeat(80));
    console.log();

    const requests = backupData.membershipRequests || [];

    if (requests.length === 0) {
      console.log('No membership requests in backup.');
    } else {
      requests.forEach((req, idx) => {
        console.log(`${idx + 1}. ${req.name} (ID: ${req._id})`);
        console.log(`   Phone: ${req.phone}`);
        console.log(`   Status: ${req.status}`);

        if (req.requestedPlanId) {
          console.log(`   Requested Plan: ${req.requestedPlanId}`);
        }
        if (req.approvedPlanId) {
          console.log(`   Approved Plan: ${req.approvedPlanId}`);
        }
        if (req.paymentAmount != null) {
          console.log(`   Payment Amount: ${formatCurrency(req.paymentAmount)}`);
        }
        if (req.paymentUrl) {
          console.log(`   Payment URL: ${req.paymentUrl}`);
        }
        if (req.paymentLinkId) {
          console.log(`   Payment Link ID: ${req.paymentLinkId}`);
        }
        if (req.orderId) {
          console.log(`   Order ID: ${req.orderId}`);
        }
        if (req.paymentId) {
          console.log(`   Payment ID: ${req.paymentId}`);
        }
        if (req.existingUserId) {
          console.log(`   Linked User: ${req.existingUserId}`);
        }
        if (req.userMembershipId) {
          console.log(`   User Membership: ${req.userMembershipId}`);
        }

        console.log(`   Created: ${formatDate(req.createdAt)}`);
        console.log(`   Updated: ${formatDate(req.updatedAt)}`);

        if (req.reviewedAt) {
          console.log(`   Reviewed: ${formatDate(req.reviewedAt)}`);
        }
        if (req.rejectionReason) {
          console.log(`   Rejection Reason: ${req.rejectionReason}`);
        }

        console.log();
      });
    }

    // Display payments if available
    const payments = backupData.payments || [];
    if (payments.length > 0) {
      console.log('💳 PAYMENTS');
      console.log('=' .repeat(80));
      console.log();

      payments.forEach((payment, idx) => {
        console.log(`${idx + 1}. Payment ID: ${payment._id}`);
        console.log(`   Order ID: ${payment.orderId}`);
        console.log(`   Type: ${payment.type}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Amount: ${formatCurrency(payment.amount)}`);
        console.log(`   Final Amount: ${formatCurrency(payment.finalAmount)}`);
        if (payment.razorpayPaymentId) {
          console.log(`   Razorpay Payment ID: ${payment.razorpayPaymentId}`);
        }
        console.log(`   Created: ${formatDate(payment.createdAt)}`);
        console.log();
      });
    }

    // Display user memberships if available
    const memberships = backupData.userMemberships || [];
    if (memberships.length > 0) {
      console.log('🎫 USER MEMBERSHIPS');
      console.log('=' .repeat(80));
      console.log();

      memberships.forEach((membership, idx) => {
        console.log(`${idx + 1}. Membership ID: ${membership._id}`);
        console.log(`   User: ${membership.userId}`);
        console.log(`   Plan: ${membership.planId}`);
        console.log(`   Status: ${membership.status}`);
        console.log(`   Start Date: ${formatDate(membership.startDate)}`);
        console.log(`   End Date: ${formatDate(membership.endDate)}`);
        console.log(`   Amount Paid: ${formatCurrency(membership.amountPaid)}`);
        console.log();
      });
    }

    console.log('=' .repeat(80));
    console.log('✅ End of backup');
    console.log();
    console.log('💡 To restore this backup:');
    console.log(`   node restoreMembershipRequests.js ${filename} --execute`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the viewer
viewBackup();
