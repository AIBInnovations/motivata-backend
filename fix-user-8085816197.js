/**
 * Fix membership for user 8085816197
 * Changes status from ACTIVE to CANCELLED for deleted memberships
 * Run with: node fix-user-8085816197.js
 */

import mongoose from 'mongoose';
import UserMembership from './schema/UserMembership.schema.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/motivata';
const PHONE = '8085816197';

async function fixUser() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('═'.repeat(80));
    console.log(`Fixing membership for phone: ${PHONE}`);
    console.log('═'.repeat(80));

    // Find all memberships for this phone that are deleted but still ACTIVE
    const memberships = await UserMembership.find({
      phone: PHONE,
      isDeleted: true,
      status: { $in: ['ACTIVE', 'PENDING'] }
    }).populate('membershipPlanId');

    if (memberships.length === 0) {
      console.log('\n✅ No memberships need fixing.');
      console.log('Either:');
      console.log('  - User has no deleted memberships with ACTIVE status');
      console.log('  - Memberships have already been fixed');

      // Show all memberships for this user
      console.log('\nAll memberships for this phone:');
      const allMemberships = await UserMembership.find({ phone: PHONE });
      if (allMemberships.length === 0) {
        console.log('  - No memberships found');
      } else {
        allMemberships.forEach(m => {
          console.log(`  - ID: ${m._id}, Status: ${m.status}, isDeleted: ${m.isDeleted}`);
        });
      }
      return;
    }

    console.log(`\n⚠️  Found ${memberships.length} membership(s) that need fixing:\n`);

    for (const membership of memberships) {
      console.log(`Membership ID: ${membership._id}`);
      console.log(`  Plan: ${membership.membershipPlanId?.name || 'DELETED PLAN'}`);
      console.log(`  Current Status: ${membership.status}`);
      console.log(`  Is Deleted: ${membership.isDeleted}`);
      console.log(`  End Date: ${membership.endDate}`);

      // Update the membership
      membership.status = 'CANCELLED';
      membership.cancelledAt = new Date();
      membership.cancellationReason = 'Deleted by admin - retroactive fix';

      // Note: deletedBy and cancelledBy might be different if different admins
      // But we'll use the same deletedBy for cancelledBy if it exists
      if (membership.deletedBy) {
        membership.cancelledBy = membership.deletedBy;
      }

      await membership.save();

      console.log(`  ✅ FIXED - Status changed to: CANCELLED\n`);
    }

    console.log('═'.repeat(80));
    console.log('✅ All memberships fixed successfully!');
    console.log('═'.repeat(80));

    // Verify the fix worked
    console.log('\nVerification: Checking feature access...');

    const stillHasAccess = await UserMembership.findOne({
      phone: PHONE,
      isDeleted: false,
      status: 'ACTIVE',
      endDate: { $gte: new Date() }
    });

    if (stillHasAccess) {
      console.log('❌ WARNING: User STILL has active membership!');
      console.log('   ID:', stillHasAccess._id);
      console.log('   Status:', stillHasAccess.status);
      console.log('   Is Deleted:', stillHasAccess.isDeleted);
    } else {
      console.log('✅ VERIFIED: User no longer has access to features');
      console.log('   No active, non-deleted memberships found');
    }

    console.log('\nUser should now be denied access when checking features on the app.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB\n');
  }
}

fixUser();
