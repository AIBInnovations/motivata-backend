/**
 * Check membership status for phone: 8085816197
 * Run with: node check-membership-8085816197.js
 */

import mongoose from 'mongoose';
import UserMembership from './schema/UserMembership.schema.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/motivata';
const PHONE = '8085816197';

async function checkMembership() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('═'.repeat(80));
    console.log(`Checking membership for phone: ${PHONE}`);
    console.log('═'.repeat(80));

    // Find ALL memberships for this phone (including deleted)
    const allMemberships = await UserMembership.find({
      phone: PHONE
    })
    .populate('membershipPlanId')
    .sort({ createdAt: -1 });

    if (allMemberships.length === 0) {
      console.log('\n❌ NO MEMBERSHIPS FOUND for this phone number');
      return;
    }

    console.log(`\n✅ Found ${allMemberships.length} membership(s)\n`);

    allMemberships.forEach((membership, index) => {
      console.log(`\n[${ index + 1}] Membership ID: ${membership._id}`);
      console.log('─'.repeat(80));

      // Basic info
      console.log('Basic Info:');
      console.log(`  Phone: ${membership.phone}`);
      console.log(`  User ID: ${membership.userId || 'NULL'}`);
      console.log(`  Plan: ${membership.membershipPlanId?.name || 'PLAN DELETED'}`);
      console.log(`  Plan ID: ${membership.membershipPlanId?._id || membership.membershipPlanId}`);

      // Status
      console.log('\nStatus:');
      console.log(`  Status: ${membership.status}`);
      console.log(`  Payment Status: ${membership.paymentStatus}`);
      console.log(`  Purchase Method: ${membership.purchaseMethod}`);

      // Dates
      console.log('\nDates:');
      console.log(`  Start Date: ${membership.startDate}`);
      console.log(`  End Date: ${membership.endDate}`);
      console.log(`  Created At: ${membership.createdAt}`);

      // Soft delete status
      console.log('\nSoft Delete:');
      console.log(`  Is Deleted: ${membership.isDeleted}`);
      console.log(`  Deleted At: ${membership.deletedAt || 'NULL'}`);
      console.log(`  Deleted By: ${membership.deletedBy || 'NULL'}`);

      // Payment
      console.log('\nPayment:');
      console.log(`  Amount Paid: ₹${membership.amountPaid}`);
      console.log(`  Order ID: ${membership.orderId}`);
      console.log(`  Payment ID: ${membership.paymentId || 'NULL'}`);

      // Current status check
      const now = new Date();
      const isExpired = membership.endDate <= now;
      const isCurrentlyActive =
        !membership.isDeleted &&
        membership.status === 'ACTIVE' &&
        membership.paymentStatus === 'SUCCESS' &&
        membership.startDate <= now &&
        membership.endDate > now;

      console.log('\nComputed Status:');
      console.log(`  Is Expired: ${isExpired}`);
      console.log(`  Is Currently Active: ${isCurrentlyActive}`);
      console.log(`  Days Remaining: ${Math.ceil((membership.endDate - now) / (1000 * 60 * 60 * 24))}`);

      // CRITICAL: Check what feature access check would return
      console.log('\nFeature Access Check:');
      const wouldGrantAccess =
        !membership.isDeleted &&
        membership.status === 'ACTIVE' &&
        membership.paymentStatus === 'SUCCESS' &&
        membership.endDate > now;

      console.log(`  Would Grant Access: ${wouldGrantAccess ? '✅ YES' : '❌ NO'}`);

      if (wouldGrantAccess) {
        console.log('\n  ⚠️  WARNING: This membership WOULD allow access to features!');
        console.log('  ⚠️  Reason: isDeleted=false, status=ACTIVE, not expired');
      }
    });

    // Check active membership using the schema method
    console.log('\n\n═'.repeat(80));
    console.log('Using UserMembership.findActiveMembership() method:');
    console.log('═'.repeat(80));

    const activeMembership = await UserMembership.findActiveMembership(PHONE);

    if (activeMembership) {
      console.log('\n✅ ACTIVE MEMBERSHIP FOUND:');
      console.log(`  ID: ${activeMembership._id}`);
      console.log(`  Plan: ${activeMembership.membershipPlanId?.name}`);
      console.log(`  Status: ${activeMembership.status}`);
      console.log(`  Is Deleted: ${activeMembership.isDeleted}`);
      console.log(`  End Date: ${activeMembership.endDate}`);
      console.log('\n  ⚠️  THIS IS WHY USER HAS ACCESS TO FEATURES!');
    } else {
      console.log('\n❌ No active membership found via findActiveMembership()');
    }

    // Check what feature access endpoint would return
    console.log('\n\n═'.repeat(80));
    console.log('Simulating POST /api/web/feature-access/check:');
    console.log('═'.repeat(80));

    const featureAccessCheck = await UserMembership.findOne({
      phone: PHONE,
      status: 'ACTIVE',
      endDate: { $gte: new Date() }
    }).populate('membershipPlanId');

    if (featureAccessCheck) {
      console.log('\n✅ MEMBERSHIP FOUND (User HAS access):');
      console.log(`  ID: ${featureAccessCheck._id}`);
      console.log(`  Status: ${featureAccessCheck.status}`);
      console.log(`  Is Deleted: ${featureAccessCheck.isDeleted}`);
      console.log(`  Reason: "MEMBERSHIP_VALID"`);
      console.log('\n  ⚠️  PROBLEM: isDeleted filter is MISSING in feature access check!');
    } else {
      console.log('\n❌ No membership found (User does NOT have access)');
    }

    console.log('\n\n═'.repeat(80));
    console.log('SOLUTION:');
    console.log('═'.repeat(80));
    console.log('\nThe user membership needs to have status changed to properly revoke access.');
    console.log('Options:');
    console.log('  1. Change status from "ACTIVE" to "CANCELLED"');
    console.log('  2. Ensure isDeleted is checked in feature access queries');
    console.log('  3. Set endDate to past date');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB\n');
  }
}

checkMembership();
