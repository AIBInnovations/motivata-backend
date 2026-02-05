/**
 * @fileoverview Script to recalculate and fix club post counts
 * This syncs the postCount field with actual active (non-deleted) posts
 *
 * Usage:
 *   node fixClubPostCounts.js              # Dry run (preview changes)
 *   node fixClubPostCounts.js --execute    # Actually update the counts
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
import './schema/Post.schema.js';

const Club = mongoose.model('Club');
const Post = mongoose.model('Post');

// Check if we should actually execute (not just dry run)
const EXECUTE = process.argv.includes('--execute');

/**
 * Main function to fix club post counts
 */
async function fixClubPostCounts() {
  try {
    console.log('🔧 Club Post Count Fix Script');
    console.log('='.repeat(80));
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

    console.log('🔍 Analyzing club post counts...\n');

    for (const club of clubs) {
      // Count actual active (non-deleted) posts
      // We need to check that posts are not soft-deleted
      const actualCount = await Post.countDocuments({
        club: club._id,
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false }
        ]
      });

      const currentCount = club.postCount || 0;
      const difference = currentCount - actualCount;

      if (currentCount !== actualCount) {
        totalIncorrect++;
        fixes.push({
          clubId: club._id,
          clubName: club.name,
          currentCount,
          actualCount,
          difference,
          needsUpdate: true
        });
        console.log(`❌ ${club.name}`);
        console.log(`   Club ID: ${club._id}`);
        console.log(`   Current Count: ${currentCount}`);
        console.log(`   Actual Count: ${actualCount}`);
        console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference}`);
        console.log();
      } else {
        totalCorrect++;
        fixes.push({
          clubId: club._id,
          clubName: club.name,
          currentCount,
          actualCount,
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
      console.log('🎉 All club post counts are correct! No fixes needed.');
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
          postCount: fix.actualCount
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
        if (club.postCount !== fix.actualCount) {
          console.log(`❌ Verification failed for ${club.name}: expected ${fix.actualCount}, got ${club.postCount}`);
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
      console.log('   node fixClubPostCounts.js --execute');
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
fixClubPostCounts();
