/**
 * One-off script — flag the student plans so checkout requires a college
 * referral code.
 *
 * The flag lives on MembershipPlan.requiresReferral (added for the student
 * verification feature). It is NOT name-based — this script only flips plans
 * whose name contains "student" as a safe default, then prints what changed
 * so you can confirm before it ever matters. Run it, verify the output, and
 * flip any other plan manually in the DB if the naming rule missed one.
 *
 * Usage: node scripts/fixes/flagStudentPlans.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MembershipPlan from '../../schema/MembershipPlan.schema.js';

dotenv.config();

async function main() {
  if (!process.env.MONGODB_URL) {
    console.error('> Missing MONGODB_URL');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URL);
  console.log('> MongoDB Connected');

  // Student plans, matched the same way the old code used to match names.
  const namePattern = /student/i;

  const plans = await MembershipPlan.find({ isDeleted: { $ne: true } }).lean();
  const matched = plans.filter((p) => namePattern.test(p.name || ''));

  if (matched.length === 0) {
    console.log('> No student plans found by name — nothing to flag.');
    console.log('> Existing plans:', plans.map((p) => `${p.name} (${p.planType || 'MEMBERSHIP'})`).join(', '));
    process.exit(0);
  }

  console.log('> Flagging these plans with requiresReferral = true:');
  for (const plan of matched) {
    console.log(`   - ${plan.name} (${plan.planType || 'MEMBERSHIP'})`);
  }

  const result = await MembershipPlan.updateMany(
    { _id: { $in: matched.map((p) => p._id) } },
    { $set: { requiresReferral: true } }
  );

  console.log(`> Done — ${result.modifiedCount} plan(s) updated.`);

  // Show every non-student plan that stays open, so nothing is missed.
  const untouched = plans.filter((p) => !namePattern.test(p.name || ''));
  console.log('> Plans left without the flag (no referral needed):');
  untouched.forEach((p) => console.log(`   - ${p.name}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('> Script failed:', err.message);
  process.exit(1);
});
