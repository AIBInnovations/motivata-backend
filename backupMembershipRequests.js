/**
 * @fileoverview Script to backup all membership requests and related data before reset
 * Creates a timestamped backup file that can be used to restore if needed
 *
 * Usage:
 *   node backupMembershipRequests.js                    # Backup only membership requests
 *   node backupMembershipRequests.js --full             # Backup requests + related data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import schemas
import './schema/MembershipRequest.schema.js';
import './schema/Payment.schema.js';
import './schema/UserMembership.schema.js';

const MembershipRequest = mongoose.model('MembershipRequest');
const Payment = mongoose.model('Payment');
const UserMembership = mongoose.model('UserMembership');

// Check if we should do full backup (including related data)
const FULL_BACKUP = process.argv.includes('--full');

/**
 * Create backups directory if it doesn't exist
 */
async function ensureBackupDirectory() {
  const backupDir = join(__dirname, 'backups');
  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
    console.log('📁 Created backups directory\n');
  }
  return backupDir;
}

/**
 * Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Main backup function
 */
async function backupMembershipRequests() {
  try {
    console.log('💾 Membership Request Backup Script');
    console.log('=' .repeat(60));
    console.log(`Mode: ${FULL_BACKUP ? '📦 FULL BACKUP (requests + related data)' : '📄 BASIC BACKUP (requests only)'}`);
    console.log('=' .repeat(60));
    console.log();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Create backup directory
    const backupDir = await ensureBackupDirectory();

    // Generate timestamp for backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFilename = `membership-requests-backup-${timestamp}.json`;
    const backupPath = join(backupDir, backupFilename);

    // Initialize backup data structure
    const backupData = {
      metadata: {
        backupDate: new Date().toISOString(),
        backupType: FULL_BACKUP ? 'FULL' : 'BASIC',
        environment: process.env.NODE_ENV || 'unknown',
        databaseUrl: process.env.MONGODB_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') // Hide credentials
      },
      membershipRequests: [],
      payments: [],
      userMemberships: [],
      statistics: {}
    };

    // Backup Membership Requests
    console.log('📥 Backing up membership requests...');
    const membershipRequests = await MembershipRequest.find({}).lean();
    backupData.membershipRequests = membershipRequests;
    console.log(`✅ Backed up ${membershipRequests.length} membership requests`);

    // Calculate statistics
    const statusCounts = membershipRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});

    const withPaymentLinks = membershipRequests.filter(r => r.paymentLinkId || r.paymentUrl).length;
    const withPayments = membershipRequests.filter(r => r.paymentId).length;
    const withOrders = membershipRequests.filter(r => r.orderId).length;

    backupData.statistics.membershipRequests = {
      total: membershipRequests.length,
      byStatus: statusCounts,
      withPaymentLinks,
      withPayments,
      withOrders
    };

    console.log();
    console.log('📊 Membership Requests Statistics:');
    console.log(`   Total: ${membershipRequests.length}`);
    console.log('   By Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });
    console.log(`   With payment links: ${withPaymentLinks}`);
    console.log(`   With payment IDs: ${withPayments}`);
    console.log(`   With order IDs: ${withOrders}`);
    console.log();

    // Full backup includes related data
    if (FULL_BACKUP) {
      // Backup related Payments
      console.log('📥 Backing up related payments...');
      const orderIds = membershipRequests
        .filter(r => r.orderId)
        .map(r => r.orderId);

      if (orderIds.length > 0) {
        const payments = await Payment.find({ orderId: { $in: orderIds } }).lean();
        backupData.payments = payments;
        console.log(`✅ Backed up ${payments.length} related payments`);

        backupData.statistics.payments = {
          total: payments.length,
          byStatus: payments.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
          }, {})
        };
      } else {
        console.log('ℹ️  No payments found (no order IDs in requests)');
      }

      // Backup related UserMemberships
      console.log('📥 Backing up related user memberships...');
      const membershipIds = membershipRequests
        .filter(r => r.userMembershipId)
        .map(r => r.userMembershipId);

      if (membershipIds.length > 0) {
        const userMemberships = await UserMembership.find({
          _id: { $in: membershipIds }
        }).lean();
        backupData.userMemberships = userMemberships;
        console.log(`✅ Backed up ${userMemberships.length} related user memberships`);

        backupData.statistics.userMemberships = {
          total: userMemberships.length,
          byStatus: userMemberships.reduce((acc, m) => {
            acc[m.status] = (acc[m.status] || 0) + 1;
            return acc;
          }, {})
        };
      } else {
        console.log('ℹ️  No user memberships found (no links in requests)');
      }
      console.log();
    }

    // Write backup to file
    console.log('💾 Writing backup to file...');
    const backupJson = JSON.stringify(backupData, null, 2);
    await fs.writeFile(backupPath, backupJson, 'utf-8');

    // Get file size
    const stats = await fs.stat(backupPath);
    const fileSize = formatBytes(stats.size);

    console.log('✅ Backup completed successfully!');
    console.log();
    console.log('=' .repeat(60));
    console.log('📄 BACKUP FILE INFORMATION');
    console.log('=' .repeat(60));
    console.log(`Location: ${backupPath}`);
    console.log(`Filename: ${backupFilename}`);
    console.log(`File Size: ${fileSize}`);
    console.log(`Backup Date: ${backupData.metadata.backupDate}`);
    console.log();
    console.log('📦 BACKUP CONTENTS:');
    console.log(`   Membership Requests: ${backupData.membershipRequests.length}`);
    if (FULL_BACKUP) {
      console.log(`   Payments: ${backupData.payments.length}`);
      console.log(`   User Memberships: ${backupData.userMemberships.length}`);
    }
    console.log();
    console.log('✅ You can now safely run the reset script:');
    console.log('   node resetMembershipRequests.js --execute');
    console.log();
    console.log('🔄 To restore from this backup (if needed):');
    console.log(`   node restoreMembershipRequests.js ${backupFilename}`);
    console.log('=' .repeat(60));

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
backupMembershipRequests();
