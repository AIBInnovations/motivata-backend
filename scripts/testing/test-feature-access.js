/**
 * Feature Access Testing Script
 * Tests all 4 scenarios for the membership blocking functionality
 * Run with: node test-feature-access.js
 */

import mongoose from 'mongoose';
import FeatureAccess from '../../schema/FeatureAccess.schema.js';
import UserMembership from '../../schema/UserMembership.schema.js';
import MembershipPlan from '../../schema/MembershipPlan.schema.js';

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/motivata';
const TEST_PHONE = '9999999999'; // Test phone number
const TEST_FEATURE = 'SOS';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printSeparator() {
  console.log('\n' + '═'.repeat(80) + '\n');
}

// Simulate the checkFeatureAccess controller logic
async function checkFeatureAccess(featureKey, phone) {
  const normalizedPhone = phone.slice(-10);

  log(`[TEST] Checking access for:`, 'cyan');
  log(`  Feature: ${featureKey}`);
  log(`  Phone: ${phone} → ${normalizedPhone} (normalized)`);

  // Step 1: Get feature settings
  const feature = await FeatureAccess.findOne({
    featureKey: featureKey.toUpperCase(),
  });

  if (!feature) {
    log(`[TEST] ❌ Feature not found in database`, 'red');
    return null;
  }

  log(`[TEST] Feature settings:`, 'blue');
  log(`  - featureName: ${feature.featureName}`);
  log(`  - isActive: ${feature.isActive}`);
  log(`  - requiresMembership: ${feature.requiresMembership}`);

  // Step 2: Check if feature exists and is active
  if (!feature.isActive) {
    log(`[TEST] ✅ Decision: FEATURE_INACTIVE`, 'yellow');
    return {
      hasAccess: false,
      reason: 'FEATURE_INACTIVE',
      message: 'This feature is currently unavailable',
    };
  }

  // Step 3: Check if membership is required
  if (!feature.requiresMembership) {
    log(`[TEST] ✅ Decision: OPEN_TO_ALL`, 'green');
    return {
      hasAccess: true,
      reason: 'OPEN_TO_ALL',
      message: 'Access granted',
    };
  }

  // Step 4: Check user's membership status
  const membership = await UserMembership.findOne({
    phone: normalizedPhone,
    status: 'ACTIVE',
    endDate: { $gte: new Date() },
  }).populate('membershipPlanId');

  if (!membership) {
    log(`[TEST] ✅ Decision: NO_ACTIVE_MEMBERSHIP`, 'yellow');
    return {
      hasAccess: false,
      reason: 'NO_ACTIVE_MEMBERSHIP',
      message: 'This feature requires an active membership',
    };
  }

  // All checks passed - grant access
  const daysRemaining = Math.ceil(
    (membership.endDate - new Date()) / (1000 * 60 * 60 * 24)
  );

  log(`[TEST] ✅ Decision: MEMBERSHIP_VALID`, 'green');
  log(`  - Plan: ${membership.membershipPlanId?.name || 'Unknown Plan'}`);
  log(`  - End Date: ${membership.endDate.toISOString()}`);
  log(`  - Days Remaining: ${daysRemaining}`);

  return {
    hasAccess: true,
    reason: 'MEMBERSHIP_VALID',
    message: 'Access granted',
    membership: {
      planName: membership.membershipPlanId?.name || 'Unknown Plan',
      endDate: membership.endDate,
      daysRemaining: daysRemaining,
    },
  };
}

// Test Scenario 1: Feature is Inactive
async function testScenario1() {
  printSeparator();
  log('SCENARIO 1: Feature is Inactive (Admin Blocked)', 'cyan');
  printSeparator();

  log('[SETUP] Setting feature to inactive...', 'blue');
  await FeatureAccess.findOneAndUpdate(
    { featureKey: TEST_FEATURE },
    { $set: { isActive: false, requiresMembership: false } },
    { upsert: true }
  );

  const result = await checkFeatureAccess(TEST_FEATURE, TEST_PHONE);

  log('\n[RESULT]', 'blue');
  console.log(JSON.stringify(result, null, 2));

  const passed = result && result.hasAccess === false && result.reason === 'FEATURE_INACTIVE';
  log(`\n[TEST] Scenario 1: ${passed ? '✅ PASSED' : '❌ FAILED'}`, passed ? 'green' : 'red');

  return passed;
}

// Test Scenario 2: Feature is Active, Open to All
async function testScenario2() {
  printSeparator();
  log('SCENARIO 2: Feature is Active, Open to All', 'cyan');
  printSeparator();

  log('[SETUP] Setting feature to active, no membership required...', 'blue');
  await FeatureAccess.findOneAndUpdate(
    { featureKey: TEST_FEATURE },
    { $set: { isActive: true, requiresMembership: false } },
    { upsert: true }
  );

  const result = await checkFeatureAccess(TEST_FEATURE, TEST_PHONE);

  log('\n[RESULT]', 'blue');
  console.log(JSON.stringify(result, null, 2));

  const passed = result && result.hasAccess === true && result.reason === 'OPEN_TO_ALL';
  log(`\n[TEST] Scenario 2: ${passed ? '✅ PASSED' : '❌ FAILED'}`, passed ? 'green' : 'red');

  return passed;
}

// Test Scenario 3: Feature Requires Membership, User Has Active Membership
async function testScenario3() {
  printSeparator();
  log('SCENARIO 3: Feature Requires Membership, User Has Active Membership', 'cyan');
  printSeparator();

  log('[SETUP] Setting feature to require membership...', 'blue');
  await FeatureAccess.findOneAndUpdate(
    { featureKey: TEST_FEATURE },
    { $set: { isActive: true, requiresMembership: true } },
    { upsert: true }
  );

  log('[SETUP] Creating test membership...', 'blue');

  // Find or create a test membership plan
  let plan = await MembershipPlan.findOne({ isDeleted: false });
  if (!plan) {
    log('[SETUP] No active membership plan found, creating test plan...', 'yellow');
    plan = await MembershipPlan.create({
      name: 'Test Plan',
      description: 'Test membership plan',
      price: 499,
      durationInDays: 30,
      perks: ['Test Perk 1', 'Test Perk 2'],
      isActive: true,
      isDeleted: false,
    });
    log(`[SETUP] Created test plan: ${plan._id}`, 'blue');
  } else {
    log(`[SETUP] Using existing plan: ${plan.name} (${plan._id})`, 'blue');
  }

  // Delete any existing test memberships
  await UserMembership.deleteMany({ phone: TEST_PHONE });

  // Create active membership
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const membership = await UserMembership.create({
    phone: TEST_PHONE,
    membershipPlanId: plan._id,
    orderId: `TEST_ORDER_${Date.now()}`,
    purchaseMethod: 'ADMIN',
    amountPaid: plan.price,
    startDate: startDate,
    endDate: endDate,
    status: 'ACTIVE',
    paymentStatus: 'SUCCESS',
    planSnapshot: {
      name: plan.name,
      description: plan.description,
      durationInDays: plan.durationInDays,
      perks: plan.perks,
    },
  });

  log(`[SETUP] Created test membership: ${membership._id}`, 'blue');
  log(`  - Start Date: ${startDate.toISOString()}`);
  log(`  - End Date: ${endDate.toISOString()}`);

  const result = await checkFeatureAccess(TEST_FEATURE, TEST_PHONE);

  log('\n[RESULT]', 'blue');
  console.log(JSON.stringify(result, null, 2));

  const passed = result && result.hasAccess === true && result.reason === 'MEMBERSHIP_VALID' && result.membership;
  log(`\n[TEST] Scenario 3: ${passed ? '✅ PASSED' : '❌ FAILED'}`, passed ? 'green' : 'red');

  // Cleanup
  log('\n[CLEANUP] Removing test membership...', 'blue');
  await UserMembership.deleteMany({ phone: TEST_PHONE });

  return passed;
}

// Test Scenario 4: Feature Requires Membership, User Has NO Membership
async function testScenario4() {
  printSeparator();
  log('SCENARIO 4: Feature Requires Membership, User Has NO Membership', 'cyan');
  printSeparator();

  log('[SETUP] Setting feature to require membership...', 'blue');
  await FeatureAccess.findOneAndUpdate(
    { featureKey: TEST_FEATURE },
    { $set: { isActive: true, requiresMembership: true } },
    { upsert: true }
  );

  log('[SETUP] Ensuring no active membership exists...', 'blue');
  await UserMembership.deleteMany({ phone: TEST_PHONE });

  const result = await checkFeatureAccess(TEST_FEATURE, TEST_PHONE);

  log('\n[RESULT]', 'blue');
  console.log(JSON.stringify(result, null, 2));

  const passed = result && result.hasAccess === false && result.reason === 'NO_ACTIVE_MEMBERSHIP';
  log(`\n[TEST] Scenario 4: ${passed ? '✅ PASSED' : '❌ FAILED'}`, passed ? 'green' : 'red');

  return passed;
}

// Main test runner
async function runAllTests() {
  try {
    console.log('\n');
    log('═'.repeat(80), 'cyan');
    log('FEATURE ACCESS TESTING SUITE', 'cyan');
    log('Testing membership blocking functionality', 'cyan');
    log('═'.repeat(80), 'cyan');

    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');

    const results = {
      scenario1: await testScenario1(),
      scenario2: await testScenario2(),
      scenario3: await testScenario3(),
      scenario4: await testScenario4(),
    };

    // Summary
    printSeparator();
    log('TEST SUMMARY', 'cyan');
    printSeparator();

    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;

    log(`Scenario 1 (Feature Inactive):          ${results.scenario1 ? '✅ PASSED' : '❌ FAILED'}`, results.scenario1 ? 'green' : 'red');
    log(`Scenario 2 (Open to All):               ${results.scenario2 ? '✅ PASSED' : '❌ FAILED'}`, results.scenario2 ? 'green' : 'red');
    log(`Scenario 3 (Valid Membership):          ${results.scenario3 ? '✅ PASSED' : '❌ FAILED'}`, results.scenario3 ? 'green' : 'red');
    log(`Scenario 4 (No Membership):             ${results.scenario4 ? '✅ PASSED' : '❌ FAILED'}`, results.scenario4 ? 'green' : 'red');

    printSeparator();
    log(`TOTAL: ${passedTests}/${totalTests} tests passed`, passedTests === totalTests ? 'green' : 'yellow');
    printSeparator();

    if (passedTests === totalTests) {
      log('✅ ALL TESTS PASSED! Backend is working correctly.', 'green');
    } else {
      log('❌ SOME TESTS FAILED. Please review the implementation.', 'red');
    }

    console.log('\n');

  } catch (error) {
    log('\n❌ Error running tests:', 'red');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    log('🔌 Disconnected from MongoDB', 'blue');
  }
}

// Run tests
runAllTests();
