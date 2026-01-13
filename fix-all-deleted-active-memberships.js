/**
 * Fix ALL users with deleted memberships that still have ACTIVE status
 * This will find all memberships where isDeleted=true but status is still ACTIVE/PENDING
 * Run with: node fix-all-deleted-active-memberships.js
 */

import mongoose from 'mongoose';
import UserMembership from './schema/UserMembership.schema.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/motivata';

async function fixAllDeletedMemberships() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('═'.repeat(80));
    console.log('FIXING ALL DELETED MEMBERSHIPS WITH ACTIVE STATUS');
    console.log('═'.repeat(80));

    // Find all memberships that are deleted but still have ACTIVE or PENDING status
    console.log('\n🔍 Searching for deleted memberships with ACTIVE/PENDING status...\n');

    const problematicMemberships = await UserMembership.find({
      isDeleted: true,
      status: { $in: ['ACTIVE', 'PENDING'] }
    })
    .populate('membershipPlanId')
    .sort({ phone: 1, createdAt: -1 });

    if (problematicMemberships.length === 0) {
      console.log('✅ No problematic memberships found!');
      console.log('   All deleted memberships have been properly cancelled.');
      console.log('   Database is clean.');
      return;
    }

    console.log(`⚠️  FOUND ${problematicMemberships.length} PROBLEMATIC MEMBERSHIP(S)\n`);
    console.log('These memberships are deleted but still granting access to features!\n');

    // Group by phone for better visibility
    const byPhone = {};
    problematicMemberships.forEach(m => {
      if (!byPhone[m.phone]) {
        byPhone[m.phone] = [];
      }
      byPhone[m.phone].push(m);
    });

    console.log(`Affected Users: ${Object.keys(byPhone).length}\n`);
    console.log('─'.repeat(80));

    let totalFixed = 0;

    for (const [phone, memberships] of Object.entries(byPhone)) {
      console.log(`\n📱 Phone: ${phone} (${memberships.length} membership(s))`);

      for (const membership of memberships) {
        console.log(`\n  Membership ID: ${membership._id}`);
        console.log(`    Plan: ${membership.membershipPlanId?.name || 'DELETED PLAN'}`);
        console.log(`    Plan ID: ${membership.membershipPlanId?._id || membership.membershipPlanId || 'N/A'}`);
        console.log(`    Current Status: ${membership.status}`);
        console.log(`    Payment Status: ${membership.paymentStatus}`);
        console.log(`    Purchase Method: ${membership.purchaseMethod}`);
        console.log(`    Amount Paid: ₹${membership.amountPaid}`);
        console.log(`    Start Date: ${membership.startDate?.toISOString().split('T')[0]}`);
        console.log(`    End Date: ${membership.endDate?.toISOString().split('T')[0]}`);
        console.log(`    Is Deleted: ${membership.isDeleted}`);
        console.log(`    Deleted At: ${membership.deletedAt?.toISOString() || 'NULL'}`);
        console.log(`    Deleted By: ${membership.deletedBy || 'NULL'}`);

        // Check if still granting access
        const now = new Date();
        const wouldGrantAccess =
          !membership.isDeleted &&
          membership.status === 'ACTIVE' &&
          membership.endDate > now;

        const currentlyGrantingAccess =
          membership.status === 'ACTIVE' &&
          membership.endDate > now;

        if (currentlyGrantingAccess) {
          console.log(`\n    ⚠️  CRITICAL: This membership IS CURRENTLY GRANTING ACCESS!`);
          console.log(`    User can access SOS, Connect, and Challenge features despite deletion!`);
        }

        // Fix the membership
        console.log(`\n    🔧 Fixing...`);

        membership.status = 'CANCELLED';
        membership.cancelledAt = new Date();
        membership.cancellationReason = 'Deleted by admin - retroactive fix';

        // Use deletedBy as cancelledBy if it exists
        if (membership.deletedBy) {
          membership.cancelledBy = membership.deletedBy;
        }

        await membership.save();

        console.log(`    ✅ FIXED - Status changed to: CANCELLED`);
        totalFixed++;
      }

      console.log(`\n  ─ Phone ${phone}: ${memberships.length} membership(s) fixed`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`✅ SUCCESSFULLY FIXED ${totalFixed} MEMBERSHIP(S)`);
    console.log('═'.repeat(80));

    // Verification: Check if any problematic memberships still exist
    console.log('\n🔍 Running verification check...\n');

    const stillProblematic = await UserMembership.countDocuments({
      isDeleted: true,
      status: { $in: ['ACTIVE', 'PENDING'] }
    });

    if (stillProblematic > 0) {
      console.log(`⚠️  WARNING: ${stillProblematic} problematic membership(s) still exist!`);
      console.log(`   Something may have gone wrong. Please investigate.`);
    } else {
      console.log('✅ VERIFIED: No more problematic memberships found!');
      console.log('   All deleted memberships are now properly cancelled.');
    }

    // Show summary of what would happen with feature access now
    console.log('\n' + '═'.repeat(80));
    console.log('FEATURE ACCESS IMPACT');
    console.log('═'.repeat(80));

    console.log('\nChecking feature access for all affected users...\n');

    for (const phone of Object.keys(byPhone)) {
      const activeCheck = await UserMembership.findOne({
        phone: phone,
        isDeleted: false,
        status: 'ACTIVE',
        endDate: { $gte: new Date() }
      });

      if (activeCheck) {
        console.log(`📱 ${phone}: ✅ Still has VALID active membership (not affected by fix)`);
        console.log(`   Membership ID: ${activeCheck._id}`);
      } else {
        console.log(`📱 ${phone}: ❌ No active membership (access revoked)`);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('FIX COMPLETE');
    console.log('═'.repeat(80));
    console.log('\nAll affected users will now be denied access to members-only features.');
    console.log('They will see "Membership Required" when trying to access SOS/Connect/Challenge.');
    console.log('\nNo restart required - changes are effective immediately.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB\n');
  }
}

fixAllDeletedMemberships();
