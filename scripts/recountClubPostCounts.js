import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.config.js';
import Club from '../schema/Club.schema.js';
import Post from '../schema/Post.schema.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const recountClubPostCounts = async () => {
  try {
    await connectDB();
    console.log(`[MIGRATION] Connected. Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);

    const clubs = await Club.find({}).select('_id name postCount').lean();
    const counts = await Post.aggregate([
      { $match: { club: { $ne: null }, isDeleted: false } },
      { $group: { _id: '$club', count: { $sum: 1 } } },
    ]);
    const liveByClub = new Map(counts.map((c) => [String(c._id), c.count]));

    let mismatched = 0;
    let written = 0;
    for (const club of clubs) {
      const live = liveByClub.get(String(club._id)) || 0;
      if ((club.postCount ?? 0) === live) continue;
      mismatched += 1;
      console.log(`  ${club._id}  "${club.name}"  stored ${club.postCount ?? 0} → actual ${live}`);
      if (apply) {
        await Club.updateOne({ _id: club._id }, { $set: { postCount: live } });
        written += 1;
      }
    }

    console.log(`[MIGRATION] Clubs checked: ${clubs.length}, wrong count: ${mismatched}`);
    console.log(apply ? `[MIGRATION] Done. ${written} club(s) updated.` : '[MIGRATION] Dry run only. Re-run with --apply to write.');
  } catch (error) {
    console.error('[MIGRATION] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

recountClubPostCounts();
