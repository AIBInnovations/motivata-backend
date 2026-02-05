/**
 * @fileoverview Script to recalculate and fix club member counts
 * This syncs the memberCount field with actual active approved members
 *
 * Usage:
 *   node fixClubMemberCounts.js              # Dry run (preview changes)
 *   node fixClubMemberCounts.js --execute    # Actually update the counts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import schemas
import './schema/Club.schema.js';
import './schema/ClubMember.schema.js';
import './schema/User.schema.js';

const Club = mongoose.model('Club');
const ClubMember = mongoose.model('ClubMember');
const User = mongoose.model('User');

// Check if we should actually execute (not just dry run)
const EXECUTE = process.argv.includes('--execute');

/**
 * Main function to fix club member counts
 */
async function fixClubMemberCounts() {
  try {
    console.log('🔧 Club Member Count Fix Script');
    console.log('=' .repeat(80));
    console.log(`Mode: ${EXECUTE ? '⚠️  EXECUTE (WILL MODIFY DATABASE)' : '👁️  DRY RUN (preview only)'}`);
    console.log('=' .repeat(80));
    console.log();

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Get all clubs
    console.log('🔍 Finding all clubs...');
    const clubs = await Club.find({}).lean();
    console.log(`📊 Found ${clubs.length} clubs\n`);

    if (clubs.length === 0) {
      console.log('ℹ️  No clubs found. Nothing to fix.');
      await mongoose.disconnect();
      return;
    }

    // Analyze and fix each club
    const fixes = [];
    let totalIncorrect = 0;
    let totalCorrect = 0;

    console.log('🔍 Analyzing club member counts...\n');

    for (const club of clubs) {
      // Count actual active approved members
      // We need to check that:
      // 1. ClubMember status is APPROVED
      // 2. ClubMember is not deleted
      // 3. User is not deleted
      const actualCount = await ClubMember.countDocuments({
        club: club._id,
        status: 'APPROVED',
        isDeleted: false
      });

      // Additional check: verify users are not deleted
      const membersWithActiveUsers = await ClubMember.find({
        club: club._id,
        status: 'APPROVED',
        isDeleted: false
      }).populate({
        path: 'user',
        match: { isDeleted: false },
        select: '_id'
      }).lean();

      // Filter out memberships where user is deleted
      const activeCount = membersWithActiveUsers.filter(m => m.user !== null).length;

      const currentCount = club.memberCount;
      const difference = currentCount - activeCount;

      if (currentCount !== activeCount) {
        totalIncorrect++;
        fixes.push({
          clubId: club._id,
          clubName: club.name,
          currentCount,
          actualCount: activeCount,
          difference,
          needsUpdate: true
        });
        console.log(`❌ ${club.name}`);
        console.log(`   Club ID: ${club._id}`);
        console.log(`   Current Count: ${currentCount}`);
        console.log(`   Actual Count: ${activeCount}`);
        console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference}`);
        console.log();
      } else {
        totalCorrect++;
        fixes.push({
          clubId: club._id,
          clubName: club.name,
          currentCount,
          actualCount: activeCount,
          difference: 0,
          needsUpdate: false
        });
      }
    }

    console.log('=' .repeat(80));
    console.log('📊 SUMMARY');
    console.log('=' .repeat(80));
    console.log(`Total clubs: ${clubs.length}`);
    console.log(`✅ Correct counts: ${totalCorrect}`);
    console.log(`❌ Incorrect counts: ${totalIncorrect}`);
    console.log();

    if (totalIncorrect === 0) {
      console.log('🎉 All club member counts are correct! No fixes needed.');
      await mongoose.disconnect();
      return;
    }

    // Show which clubs need fixing
    console.log('📋 Clubs that need fixing:');
    console.log('-'.repeat(80));
    fixes
      .filter(f => f.needsUpdate)
      .forEach((fix, idx) => {
        console.log(`${idx + 1}. ${fix.clubName}`);
        console.log(`   ${fix.currentCount} → ${fix.actualCount} (${fix.difference > 0 ? '' : '+'}${Math.abs(fix.difference)})`);
      });
    console.log();

    if (EXECUTE) {
      console.log('⚠️  EXECUTING FIXES...');
      console.log('=' .repeat(80));

      let updatedCount = 0;
      for (const fix of fixes.filter(f => f.needsUpdate)) {
        await Club.findByIdAndUpdate(fix.clubId, {
          memberCount: fix.actualCount
        });
        updatedCount++;
        console.log(`✅ Updated ${fix.clubName}: ${fix.currentCount} → ${fix.actualCount}`);
      }

      console.log();
      console.log('=' .repeat(80));
      console.log('🎉 FIXES COMPLETED!');
      console.log('=' .repeat(80));
      console.log(`Updated ${updatedCount} clubs`);
      console.log();

      // Verify the fixes
      console.log('🔍 Verifying fixes...');
      const verifyClubs = await Club.find({
        _id: { $in: fixes.filter(f => f.needsUpdate).map(f => f.clubId) }
      }).lean();

      let allCorrect = true;
      for (const club of verifyClubs) {
        const fix = fixes.find(f => f.clubId.toString() === club._id.toString());
        if (club.memberCount !== fix.actualCount) {
          console.log(`❌ Verification failed for ${club.name}: expected ${fix.actualCount}, got ${club.memberCount}`);
          allCorrect = false;
        }
      }

      if (allCorrect) {
        console.log('✅ All fixes verified successfully!\n');
      } else {
        console.log('⚠️  Some fixes may not have applied correctly.\n');
      }

    } else {
      console.log('👁️  DRY RUN COMPLETE - No changes were made');
      console.log();
      console.log('📝 What will be updated:');
      fixes
        .filter(f => f.needsUpdate)
        .forEach((fix) => {
          console.log(`   ✓ ${fix.clubName}: ${fix.currentCount} → ${fix.actualCount}`);
        });
      console.log();
      console.log('⚠️  To actually perform the fixes, run:');
      console.log('   node fixClubMemberCounts.js --execute');
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
fixClubMemberCounts();
