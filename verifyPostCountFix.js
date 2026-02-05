/**
 * @fileoverview Verify club post counts are correct
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import './schema/Club.schema.js';
import './schema/Post.schema.js';

const Club = mongoose.model('Club');
const Post = mongoose.model('Post');

async function verifyFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Verifying Club Post Counts');
    console.log('='.repeat(60));

    const clubs = await Club.find({}).select('name postCount').lean();

    for (const club of clubs) {
      const activePostCount = await Post.countDocuments({
        club: club._id,
        $or: [
          { isDeleted: { $exists: false } },
          { isDeleted: false }
        ]
      });

      const deletedPostCount = await Post.countDocuments({
        club: club._id,
        isDeleted: true
      });

      const status = club.postCount === activePostCount ? '✅' : '❌';

      console.log(`${status} ${club.name}`);
      console.log(`   Club postCount: ${club.postCount}`);
      console.log(`   Active posts: ${activePostCount}`);
      console.log(`   Deleted posts: ${deletedPostCount}`);
      console.log(`   Total posts: ${activePostCount + deletedPostCount}`);
      console.log();
    }

    console.log('='.repeat(60));
    console.log('✅ Verification complete!');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyFix();
