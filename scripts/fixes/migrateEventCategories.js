/**
 * @fileoverview Migrate existing events from the OLD topic-based category enum
 * to the NEW format-based category enum.
 *
 * Old enum: TECHNOLOGY, EDUCATION, MEDICAL, COMEDY, ENTERTAINMENT, BUSINESS,
 *           SPORTS, ARTS, MUSIC, FOOD, LIFESTYLE, OTHER
 * New enum: WEBINAR, MASTERCLASS, WORKSHOPS, TALK_SESSIONS, LIVE_SESSIONS,
 *           ENTERTAINMENT, PROGRAMS, MEETUPS, COMMUNITY_SERVICE, HEALTH_WELLNESS
 *
 * The two sets describe different axes (topic vs. format), so the mapping below
 * is a best-effort approximation. Review/adjust CATEGORY_MAP before executing.
 *
 * Usage:
 *   node migrateEventCategories.js              # Dry run (preview changes)
 *   node migrateEventCategories.js --execute    # Actually update the events
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

import '../../schema/Event.schema.js';

const Event = mongoose.model('Event');

const EXECUTE = process.argv.includes('--execute');

/**
 * Best-effort mapping from legacy topic categories to the new format categories.
 * Adjust these targets to taste — every target must be a valid NEW enum value.
 */
const CATEGORY_MAP = {
  TECHNOLOGY: 'WEBINAR',
  EDUCATION: 'MASTERCLASS',
  MEDICAL: 'HEALTH_WELLNESS',
  COMEDY: 'ENTERTAINMENT',
  ENTERTAINMENT: 'ENTERTAINMENT',
  BUSINESS: 'PROGRAMS',
  SPORTS: 'HEALTH_WELLNESS',
  ARTS: 'WORKSHOPS',
  MUSIC: 'LIVE_SESSIONS',
  FOOD: 'WORKSHOPS',
  LIFESTYLE: 'HEALTH_WELLNESS',
  OTHER: 'MEETUPS',
};

async function migrateEventCategories() {
  try {
    console.log('🔧 Event Category Migration Script');
    console.log('='.repeat(80));
    console.log(`Mode: ${EXECUTE ? '⚠️  EXECUTE (WILL MODIFY DATABASE)' : '👁️  DRY RUN (preview only)'}`);
    console.log('='.repeat(80));
    console.log();

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const oldCategories = Object.keys(CATEGORY_MAP);

    // Only touch events still carrying a legacy category value.
    const events = await Event.find({ category: { $in: oldCategories } })
      .select('_id name category')
      .lean();

    console.log(`📊 Found ${events.length} event(s) with legacy categories\n`);

    if (events.length === 0) {
      console.log('🎉 No events need migration.');
      await mongoose.disconnect();
      return;
    }

    // Preview per-event remap.
    const counts = {};
    events.forEach((ev) => {
      const target = CATEGORY_MAP[ev.category];
      counts[ev.category] = (counts[ev.category] || 0) + 1;
      console.log(`• ${ev.name || ev._id}: ${ev.category} → ${target}`);
    });

    console.log();
    console.log('-'.repeat(80));
    console.log('📋 Remap summary (old → new : count):');
    Object.entries(counts).forEach(([oldCat, count]) => {
      console.log(`   ${oldCat} → ${CATEGORY_MAP[oldCat]} : ${count}`);
    });
    console.log();

    if (!EXECUTE) {
      console.log('👁️  DRY RUN COMPLETE - No changes were made');
      console.log('⚠️  To apply the migration, run:');
      console.log('   node migrateEventCategories.js --execute');
      await mongoose.disconnect();
      return;
    }

    console.log('⚠️  EXECUTING MIGRATION...');
    console.log('='.repeat(80));

    let totalUpdated = 0;
    for (const [oldCat, newCat] of Object.entries(CATEGORY_MAP)) {
      const result = await Event.updateMany(
        { category: oldCat },
        { $set: { category: newCat } }
      );
      const modified = result.modifiedCount ?? result.nModified ?? 0;
      if (modified > 0) {
        console.log(`✅ ${oldCat} → ${newCat}: ${modified} event(s)`);
        totalUpdated += modified;
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log(`🎉 MIGRATION COMPLETE — updated ${totalUpdated} event(s)`);
    console.log('='.repeat(80));

    // Verify nothing legacy remains.
    const remaining = await Event.countDocuments({ category: { $in: oldCategories } });
    if (remaining === 0) {
      console.log('✅ Verified: no events left with legacy categories.\n');
    } else {
      console.log(`⚠️  ${remaining} event(s) still have legacy categories — re-run to retry.\n`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

migrateEventCategories();
