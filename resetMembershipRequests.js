/**
 * @fileoverview Script to reset ALL membership requests to PENDING status
 * This will make them look like they were just placed by users (no admin approval, no payment)
 *
 * Usage:
 *   node resetMembershipRequests.js              # Dry run (preview changes)
 *   node resetMembershipRequests.js --execute    # Actually perform the reset
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import the MembershipRequest schema
import './schema/MembershipRequest.schema.js';
const MembershipRequest = mongoose.model('MembershipRequest');

// Check if we should actually execute (not just dry run)
const EXECUTE = process.argv.includes('--execute');

/**
 * Main function to reset all membership requests
 */
async function resetAllMembershipRequests() {
  try {
    console.log('🔄 Membership Request Reset Script');
    console.log('=' .repeat(60));
    console.log(`Mode: ${EXECUTE ? '⚠️  EXECUTE (WILL MODIFY DATABASE)' : '👁️  DRY RUN (preview only)'}`);
    console.log('=' .repeat(60));
    console.log();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Find all membership requests (including deleted ones)
    console.log('🔍 Finding all membership requests...');
    const allRequests = await MembershipRequest.find({}).lean();

    console.log(`📊 Found ${allRequests.length} total membership requests\n`);

    if (allRequests.length === 0) {
      console.log('ℹ️  No membership requests found. Nothing to reset.');
      await mongoose.disconnect();
      return;
    }

    // Analyze current status distribution
    const statusCounts = allRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Current Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    console.log();

    // Count how many have payment data
    const withPaymentLinks = allRequests.filter(r => r.paymentLinkId || r.paymentUrl).length;
    const withPayments = allRequests.filter(r => r.paymentId).length;
    const withOrders = allRequests.filter(r => r.orderId).length;

    console.log('💳 Payment Data Summary:');
    console.log(`   With payment links: ${withPaymentLinks}`);
    console.log(`   With payment IDs: ${withPayments}`);
    console.log(`   With order IDs: ${withOrders}`);
    console.log();

    // Show sample of what will be reset
    console.log('📋 Sample of requests that will be reset (first 5):');
    console.log('-'.repeat(60));
    allRequests.slice(0, 5).forEach((req, idx) => {
      console.log(`${idx + 1}. ID: ${req._id}`);
      console.log(`   Name: ${req.name}`);
      console.log(`   Phone: ${req.phone}`);
      console.log(`   Status: ${req.status} → PENDING`);
      if (req.requestedPlanId) {
        console.log(`   Requested Plan ID: ${req.requestedPlanId}`);
      }
      if (req.approvedPlanId) {
        console.log(`   Approved Plan ID: ${req.approvedPlanId} → Will be cleared`);
      }
      if (req.paymentAmount) {
        console.log(`   Payment Amount: ₹${req.paymentAmount} → Will be cleared`);
      }
      if (req.paymentUrl) {
        console.log(`   Payment URL: ${req.paymentUrl.substring(0, 40)}... → Will be cleared`);
      }
      console.log();
    });

    if (allRequests.length > 5) {
      console.log(`... and ${allRequests.length - 5} more requests\n`);
    }

    // Define the reset update
    const resetUpdate = {
      $set: {
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
        adminNotes: null,
        approvedPlanId: null,
        originalAmount: null,
        paymentAmount: null,
        couponId: null,
        couponCode: null,
        discountPercent: 0,
        discountAmount: 0,
        paymentLinkId: null,
        paymentUrl: null,
        orderId: null,
        paymentId: null,
        alternativePhone: null,
        alternativeEmail: null,
        contactPreference: ['REGISTERED'],
        userMembershipId: null
      }
    };

    if (EXECUTE) {
      console.log('⚠️  EXECUTING RESET...');
      console.log('=' .repeat(60));

      const result = await MembershipRequest.updateMany({}, resetUpdate);

      console.log('✅ Reset completed successfully!');
      console.log();
      console.log('📊 Results:');
      console.log(`   Matched: ${result.matchedCount} documents`);
      console.log(`   Modified: ${result.modifiedCount} documents`);
      console.log();

      // Verify the reset
      const verifyRequests = await MembershipRequest.find({}).lean();
      const pendingCount = verifyRequests.filter(r => r.status === 'PENDING').length;
      const withPaymentDataCount = verifyRequests.filter(r =>
        r.paymentLinkId || r.paymentUrl || r.paymentId || r.orderId
      ).length;

      console.log('✅ Verification:');
      console.log(`   Total requests: ${verifyRequests.length}`);
      console.log(`   Status = PENDING: ${pendingCount}`);
      console.log(`   Still have payment data: ${withPaymentDataCount}`);
      console.log();

      if (pendingCount === verifyRequests.length && withPaymentDataCount === 0) {
        console.log('🎉 SUCCESS! All membership requests have been reset to PENDING status!');
      } else {
        console.log('⚠️  WARNING: Some requests may not have been reset correctly.');
      }
    } else {
      console.log('👁️  DRY RUN COMPLETE - No changes were made');
      console.log();
      console.log('📝 What will be reset for EACH request:');
      console.log('   ✓ status → PENDING');
      console.log('   ✓ Clear reviewedBy, reviewedAt, rejectionReason, adminNotes');
      console.log('   ✓ Clear approvedPlanId (admin-assigned plan)');
      console.log('   ✓ Clear originalAmount, paymentAmount');
      console.log('   ✓ Clear couponId, couponCode, discountPercent, discountAmount');
      console.log('   ✓ Clear paymentLinkId, paymentUrl, orderId, paymentId');
      console.log('   ✓ Clear alternativePhone, alternativeEmail');
      console.log('   ✓ Reset contactPreference to ["REGISTERED"]');
      console.log('   ✓ Clear userMembershipId');
      console.log();
      console.log('📌 KEPT (original user submission):');
      console.log('   ✓ name (user\'s name)');
      console.log('   ✓ phone (user\'s phone number)');
      console.log('   ✓ requestedPlanId (plan user originally requested)');
      console.log('   ✓ existingUserId (if linked to existing user)');
      console.log('   ✓ createdAt, updatedAt timestamps');
      console.log();
      console.log('⚠️  To actually perform the reset, run:');
      console.log('   node resetMembershipRequests.js --execute');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the script
resetAllMembershipRequests();
