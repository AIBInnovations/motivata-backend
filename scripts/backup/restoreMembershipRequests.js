/**
 * @fileoverview Script to restore membership requests from a backup file
 * Use this if you need to undo the reset operation
 *
 * Usage:
 *   node restoreMembershipRequests.js <backup-filename>                    # Dry run (preview)
 *   node restoreMembershipRequests.js <backup-filename> --execute          # Actually restore
 *
 * Example:
 *   node restoreMembershipRequests.js membership-requests-backup-2026-02-04T10-30-00.json --execute
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Import schemas
import '../../schema/MembershipRequest.schema.js';
import '../../schema/Payment.schema.js';
import '../../schema/UserMembership.schema.js';

const MembershipRequest = mongoose.model('MembershipRequest');
const Payment = mongoose.model('Payment');
const UserMembership = mongoose.model('UserMembership');

// Get command line arguments
const backupFilename = process.argv[2];
const EXECUTE = process.argv.includes('--execute');

/**
 * Main restore function
 */
async function restoreMembershipRequests() {
  try {
    console.log('🔄 Membership Request Restore Script');
    console.log('=' .repeat(60));
    console.log(`Mode: ${EXECUTE ? '⚠️  EXECUTE (WILL MODIFY DATABASE)' : '👁️  DRY RUN (preview only)'}`);
    console.log('=' .repeat(60));
    console.log();

    // Validate backup filename argument
    if (!backupFilename) {
      console.error('❌ Error: Backup filename is required');
      console.log();
      console.log('Usage:');
      console.log('   node restoreMembershipRequests.js <backup-filename>');
      console.log('   node restoreMembershipRequests.js <backup-filename> --execute');
      console.log();
      console.log('Example:');
      console.log('   node restoreMembershipRequests.js membership-requests-backup-2026-02-04T10-30-00.json --execute');
      process.exit(1);
    }

    // Read backup file
    const backupPath = join(__dirname, '..', '..', 'backups', backupFilename);
    console.log(`📂 Reading backup file: ${backupFilename}`);

    let backupData;
    try {
      const backupJson = await fs.readFile(backupPath, 'utf-8');
      backupData = JSON.parse(backupJson);
      console.log('✅ Backup file loaded successfully\n');
    } catch (error) {
      console.error(`❌ Error reading backup file: ${error.message}`);
      console.log();
      console.log('💡 Make sure the backup file exists in the backups/ directory');
      process.exit(1);
    }

    // Display backup metadata
    console.log('📋 BACKUP INFORMATION:');
    console.log('=' .repeat(60));
    console.log(`Backup Date: ${backupData.metadata.backupDate}`);
    console.log(`Backup Type: ${backupData.metadata.backupType}`);
    console.log(`Environment: ${backupData.metadata.environment}`);
    console.log();
    console.log('📦 BACKUP CONTENTS:');
    console.log(`   Membership Requests: ${backupData.membershipRequests.length}`);
    if (backupData.payments?.length > 0) {
      console.log(`   Payments: ${backupData.payments.length}`);
    }
    if (backupData.userMemberships?.length > 0) {
      console.log(`   User Memberships: ${backupData.userMemberships.length}`);
    }
    console.log();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Show current state
    const currentRequests = await MembershipRequest.find({}).lean();
    console.log('📊 CURRENT DATABASE STATE:');
    console.log(`   Membership Requests: ${currentRequests.length}`);
    const currentStatusCounts = currentRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});
    console.log('   By Status:');
    Object.entries(currentStatusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });
    console.log();

    // Compare backup vs current
    console.log('🔍 RESTORATION PREVIEW:');
    console.log('=' .repeat(60));
    console.log(`Documents in backup: ${backupData.membershipRequests.length}`);
    console.log(`Documents in current database: ${currentRequests.length}`);

    // Show sample of what will be restored (first 5)
    console.log();
    console.log('📋 Sample of requests to be restored (first 5):');
    console.log('-'.repeat(60));
    backupData.membershipRequests.slice(0, 5).forEach((req, idx) => {
      const currentReq = currentRequests.find(r => r._id.toString() === req._id);
      console.log(`${idx + 1}. ID: ${req._id}`);
      console.log(`   Name: ${req.name}`);
      console.log(`   Phone: ${req.phone}`);
      if (currentReq) {
        console.log(`   Status: ${currentReq.status} → ${req.status}`);
        if (currentReq.paymentAmount !== req.paymentAmount) {
          console.log(`   Payment Amount: ₹${currentReq.paymentAmount || 'null'} → ₹${req.paymentAmount || 'null'}`);
        }
      } else {
        console.log(`   Status: [NEW] → ${req.status}`);
      }
      console.log();
    });

    if (backupData.membershipRequests.length > 5) {
      console.log(`... and ${backupData.membershipRequests.length - 5} more requests\n`);
    }

    if (EXECUTE) {
      console.log('⚠️  EXECUTING RESTORE...');
      console.log('=' .repeat(60));

      // Restore membership requests using bulkWrite for efficiency
      console.log('🔄 Restoring membership requests...');
      const operations = backupData.membershipRequests.map(req => ({
        replaceOne: {
          filter: { _id: req._id },
          replacement: req,
          upsert: true
        }
      }));

      const result = await MembershipRequest.bulkWrite(operations);
      console.log('✅ Membership requests restored');
      console.log(`   Matched: ${result.matchedCount}`);
      console.log(`   Modified: ${result.modifiedCount}`);
      console.log(`   Upserted: ${result.upsertedCount}`);
      console.log();

      // Restore payments if in backup
      if (backupData.payments && backupData.payments.length > 0) {
        console.log('🔄 Restoring payments...');
        const paymentOps = backupData.payments.map(payment => ({
          replaceOne: {
            filter: { _id: payment._id },
            replacement: payment,
            upsert: true
          }
        }));

        const paymentResult = await Payment.bulkWrite(paymentOps);
        console.log('✅ Payments restored');
        console.log(`   Matched: ${paymentResult.matchedCount}`);
        console.log(`   Modified: ${paymentResult.modifiedCount}`);
        console.log(`   Upserted: ${paymentResult.upsertedCount}`);
        console.log();
      }

      // Restore user memberships if in backup
      if (backupData.userMemberships && backupData.userMemberships.length > 0) {
        console.log('🔄 Restoring user memberships...');
        const membershipOps = backupData.userMemberships.map(membership => ({
          replaceOne: {
            filter: { _id: membership._id },
            replacement: membership,
            upsert: true
          }
        }));

        const membershipResult = await UserMembership.bulkWrite(membershipOps);
        console.log('✅ User memberships restored');
        console.log(`   Matched: ${membershipResult.matchedCount}`);
        console.log(`   Modified: ${membershipResult.modifiedCount}`);
        console.log(`   Upserted: ${membershipResult.upsertedCount}`);
        console.log();
      }

      // Verify restoration
      console.log('🔍 Verifying restoration...');
      const verifyRequests = await MembershipRequest.find({}).lean();
      const verifyStatusCounts = verifyRequests.reduce((acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
      }, {});

      console.log('✅ Verification:');
      console.log(`   Total requests: ${verifyRequests.length}`);
      console.log('   By Status:');
      Object.entries(verifyStatusCounts).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
      console.log();

      console.log('🎉 RESTORE COMPLETED SUCCESSFULLY!');
      console.log('=' .repeat(60));
      console.log('✅ All data has been restored from the backup');
      console.log();

    } else {
      console.log('👁️  DRY RUN COMPLETE - No changes were made');
      console.log();
      console.log('📝 What will be restored:');
      console.log(`   ✓ ${backupData.membershipRequests.length} membership requests`);
      if (backupData.payments?.length > 0) {
        console.log(`   ✓ ${backupData.payments.length} payments`);
      }
      if (backupData.userMemberships?.length > 0) {
        console.log(`   ✓ ${backupData.userMemberships.length} user memberships`);
      }
      console.log();
      console.log('⚠️  This will OVERWRITE current database records with backup data');
      console.log();
      console.log('⚠️  To actually perform the restore, run:');
      console.log(`   node restoreMembershipRequests.js ${backupFilename} --execute`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the script
restoreMembershipRequests();
