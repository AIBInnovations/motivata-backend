/**
 * @fileoverview Clean up stale recommendations that use the OLD tag set
 * (created before the new Main/Sub taxonomy). These can't be filtered by the
 * new category chips and clutter the feed.
 *
 * Usage:
 *   node scripts/fixes/clearOldRecommendations.js          # dry run (lists only)
 *   node scripts/fixes/clearOldRecommendations.js --delete # actually delete
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

import '../../schema/Recommendation.schema.js';

const Recommendation = mongoose.model('Recommendation');

// Old tags that no longer exist in the new taxonomy. "Productivity" is excluded
// because it also exists as a sub-tag in the new taxonomy (Growth).
const OLD_ONLY_TAGS = [
  'Health & Wellness',
  'Career & Finance',
  'Relationships',
  'Spirituality',
  'Mindset',
  'Books',
  'Other',
];

async function run() {
  const doDelete = process.argv.includes('--delete');

  await mongoose.connect(process.env.MONGODB_URL);
  console.log('✅ Connected to MongoDB\n');

  // Match recommendations that contain at least one old-only tag (incl. soft-deleted).
  const query = { tags: { $in: OLD_ONLY_TAGS } };
  const matches = await Recommendation.find(query).select('text tags author createdAt').lean();

  console.log(`Found ${matches.length} recommendation(s) with old tags:\n`);
  matches.forEach((r, i) => {
    console.log(`${i + 1}. [${r.tags.join(', ')}] "${String(r.text).slice(0, 50)}" — author ${r.author} — ${r.createdAt}`);
  });

  if (!matches.length) {
    console.log('\nNothing to clean up. 🎉');
  } else if (doDelete) {
    const res = await Recommendation.deleteMany(query);
    console.log(`\n🗑️  Hard-deleted ${res.deletedCount} recommendation(s).`);
  } else {
    console.log('\nDry run only. Re-run with --delete to remove them.');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done.');
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
