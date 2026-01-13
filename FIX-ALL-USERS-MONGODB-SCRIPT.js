// ============================================================================
// FIX ALL USERS WITH DELETED MEMBERSHIPS - MongoDB Shell Script
// ============================================================================
//
// INSTRUCTIONS:
// 1. Copy this ENTIRE file
// 2. Connect to your MongoDB: mongosh "your-connection-string"
// 3. Switch to database: use motivata
// 4. Paste this entire script and press Enter
//
// OR run with: mongosh "connection-string" < FIX-ALL-USERS-MONGODB-SCRIPT.js
// ============================================================================

print("\n" + "=".repeat(80));
print("FIXING ALL DELETED MEMBERSHIPS WITH ACTIVE STATUS");
print("=".repeat(80));

// Step 1: Count how many are affected
print("\nStep 1: Checking how many memberships need fixing...");
const countBefore = db.usermemberships.countDocuments({
  isDeleted: true,
  status: { $in: ["ACTIVE", "PENDING"] }
});

print(`Found ${countBefore} membership(s) that need fixing\n`);

if (countBefore === 0) {
  print("✅ No problematic memberships found!");
  print("   All deleted memberships are already properly cancelled.");
  print("   Database is clean.\n");
} else {
  // Step 2: Show affected users
  print("Step 2: Listing affected users and their memberships...\n");

  const affected = db.usermemberships.find(
    {
      isDeleted: true,
      status: { $in: ["ACTIVE", "PENDING"] }
    },
    {
      phone: 1,
      status: 1,
      planSnapshot: 1,
      endDate: 1,
      isDeleted: 1
    }
  ).sort({ phone: 1 }).toArray();

  // Group by phone
  const byPhone = {};
  affected.forEach(m => {
    if (!byPhone[m.phone]) {
      byPhone[m.phone] = [];
    }
    byPhone[m.phone].push(m);
  });

  print(`Affected Users: ${Object.keys(byPhone).length}\n`);
  print("-".repeat(80));

  for (const [phone, memberships] of Object.entries(byPhone)) {
    print(`\n📱 Phone: ${phone} (${memberships.length} membership(s))`);
    memberships.forEach((m, i) => {
      print(`  [${i + 1}] ID: ${m._id}`);
      print(`      Plan: ${m.planSnapshot?.name || 'N/A'}`);
      print(`      Status: ${m.status}`);
      print(`      End Date: ${m.endDate ? m.endDate.toISOString().split('T')[0] : 'N/A'}`);
      print(`      Is Deleted: ${m.isDeleted}`);

      // Check if still granting access
      const now = new Date();
      if (m.status === 'ACTIVE' && m.endDate > now) {
        print(`      ⚠️  CRITICAL: Currently granting feature access!`);
      }
    });
  }

  print("\n" + "-".repeat(80));

  // Step 3: Fix all memberships
  print("\nStep 3: Fixing all problematic memberships...\n");

  const result = db.usermemberships.updateMany(
    {
      isDeleted: true,
      status: { $in: ["ACTIVE", "PENDING"] }
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "Deleted by admin - retroactive fix"
      }
    }
  );

  print("Update Result:");
  print(`  Matched: ${result.matchedCount} membership(s)`);
  print(`  Modified: ${result.modifiedCount} membership(s)`);

  if (result.modifiedCount === countBefore) {
    print(`  ✅ SUCCESS: All ${result.modifiedCount} membership(s) fixed!\n`);
  } else {
    print(`  ⚠️  WARNING: Expected ${countBefore}, but only ${result.modifiedCount} were modified\n`);
  }

  // Step 4: Verify the fix
  print("Step 4: Verifying the fix...\n");

  const countAfter = db.usermemberships.countDocuments({
    isDeleted: true,
    status: { $in: ["ACTIVE", "PENDING"] }
  });

  if (countAfter === 0) {
    print("✅ VERIFIED: No more problematic memberships found!");
    print("   All deleted memberships are now properly cancelled.\n");
  } else {
    print(`⚠️  WARNING: ${countAfter} problematic membership(s) still exist!`);
    print("   Something may have gone wrong. Please investigate.\n");
  }

  // Step 5: Show feature access impact
  print("Step 5: Checking feature access impact...\n");
  print("-".repeat(80));

  for (const phone of Object.keys(byPhone)) {
    const stillHasAccess = db.usermemberships.findOne({
      phone: phone,
      isDeleted: false,
      status: "ACTIVE",
      endDate: { $gte: new Date() }
    });

    if (stillHasAccess) {
      print(`📱 ${phone}: ✅ Still has VALID active membership (different from deleted one)`);
      print(`   Plan: ${stillHasAccess.planSnapshot?.name || 'N/A'}`);
    } else {
      print(`📱 ${phone}: ❌ No active membership (access REVOKED)`);
    }
  }
}

print("\n" + "=".repeat(80));
print("FIX COMPLETE");
print("=".repeat(80));
print("\nSummary:");
print(`  - Found and fixed ${countBefore} problematic membership(s)`);
print("  - All affected users will now be denied access to members-only features");
print("  - Changes are effective immediately (no restart required)");
print("  - Users will see 'Membership Required' when accessing SOS/Connect/Challenge");
print("\n");
