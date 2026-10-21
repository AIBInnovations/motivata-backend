import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.config.js';
import Recommendation from '../schema/Recommendation.schema.js';
import { BRAND_AUTHOR_NAME } from '../src/Connect/content.constants.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const backfillMotivataAuthorName = async () => {
  try {
    await connectDB();
    console.log(`[MIGRATION] Connected. Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);

    const filter = { authorType: 'Admin', authorName: { $ne: BRAND_AUTHOR_NAME } };

    const total = await Recommendation.countDocuments({ authorType: 'Admin' });
    const pending = await Recommendation.countDocuments(filter);
    const byName = await Recommendation.aggregate([
      { $match: filter },
      { $group: { _id: '$authorName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log(`[MIGRATION] Admin-authored recommendations (incl. soft-deleted): ${total}`);
    console.log(`[MIGRATION] Needing authorName -> "${BRAND_AUTHOR_NAME}": ${pending}`);
    byName.forEach((row) => console.log(`  "${row._id}": ${row.count}`));

    if (!apply) {
      console.log('[MIGRATION] Dry run only. Re-run with --apply to write.');
      return;
    }

    const result = await Recommendation.updateMany(filter, { $set: { authorName: BRAND_AUTHOR_NAME } });
    console.log(`[MIGRATION] Done. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`);

    const remaining = await Recommendation.countDocuments(filter);
    console.log(`[MIGRATION] Remaining after apply: ${remaining}`);
  } catch (error) {
    console.error('[MIGRATION] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

backfillMotivataAuthorName();
