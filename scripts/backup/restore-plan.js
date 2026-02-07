/**
 * Quick script to restore soft-deleted membership plan
 * Run with: node restore-plan.js
 */

import mongoose from 'mongoose';
import MembershipPlan from '../../schema/MembershipPlan.schema.js';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/motivata';
const PLAN_ID = '695be44869cdb8c106f6bff6';

async function restorePlan() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    console.log(`\n🔍 Searching for deleted plan with ID: ${PLAN_ID}`);
    const plan = await MembershipPlan.findOne({
      _id: PLAN_ID,
      isDeleted: true
    });

    if (!plan) {
      console.log('❌ Deleted plan not found. It may already be restored or the ID is incorrect.');
      console.log('\nSearching for all deleted plans...');
      const deletedPlans = await MembershipPlan.find({ isDeleted: true });
      if (deletedPlans.length > 0) {
        console.log(`\nFound ${deletedPlans.length} deleted plan(s):`);
        deletedPlans.forEach(p => {
          console.log(`  - ID: ${p._id}`);
          console.log(`    Name: ${p.name}`);
          console.log(`    Price: ₹${p.price}`);
          console.log(`    Deleted At: ${p.deletedAt}`);
          console.log('');
        });
      } else {
        console.log('No deleted plans found in database.');
      }
      process.exit(1);
    }

    console.log('\n✓ Found deleted plan:');
    console.log(`  Name: ${plan.name}`);
    console.log(`  Price: ₹${plan.price}`);
    console.log(`  Duration: ${plan.durationInDays} days`);
    console.log(`  Deleted At: ${plan.deletedAt}`);
    console.log(`  Is Active: ${plan.isActive}`);

    console.log('\n♻️  Restoring plan...');
    await plan.restore();

    console.log('✓ Plan restored successfully!');
    console.log('\n📋 Updated plan details:');
    console.log(`  ID: ${plan._id}`);
    console.log(`  Name: ${plan.name}`);
    console.log(`  isDeleted: ${plan.isDeleted}`);
    console.log(`  isActive: ${plan.isActive}`);
    console.log(`  deletedAt: ${plan.deletedAt}`);

    console.log('\n✅ Done! The plan is now available in the admin panel.');

  } catch (error) {
    console.error('❌ Error restoring plan:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

restorePlan();
