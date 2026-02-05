/**
 * @fileoverview Check if post was soft deleted
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import './schema/Post.schema.js';
import './schema/Club.schema.js';

const Post = mongoose.model('Post');
const Club = mongoose.model('Club');

async function checkDeletedPost() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const postId = '69614a53ffa931d70f9409c0';
    const clubId = '695be8ec69cdb8c106f6c088';

    // Check post with different queries
    console.log('🔍 Checking post ' + postId);
    console.log('='.repeat(60));

    // Query 1: Normal find (might be filtered by middleware)
    const post1 = await Post.findById(postId);
    console.log('1. Normal findById:', post1 ? 'Found' : 'Not found');

    // Query 2: Find with select including deleted fields
    const post2 = await Post.findById(postId).select('+isDeleted +deletedAt');
    console.log('2. findById with +isDeleted:', post2 ? `Found (isDeleted: ${post2.isDeleted})` : 'Not found');

    // Query 3: Find with explicit isDeleted: true
    const post3 = await Post.findOne({ _id: postId, isDeleted: true });
    console.log('3. findOne with isDeleted:true:', post3 ? `Found (deletedAt: ${post3.deletedAt})` : 'Not found');

    // Query 4: Bypass middleware using lean
    const post4 = await Post.findById(postId).lean();
    console.log('4. findById with lean:', post4 ? 'Found' : 'Not found');

    // Check club postCount
    console.log('\n🏢 Checking club postCount');
    console.log('='.repeat(60));
    const club = await Club.findById(clubId);
    console.log(`Club: ${club.name}`);
    console.log(`Post Count: ${club.postCount} (should be 3 after deletion)`);

    // Count all posts in club
    const activePosts = await Post.countDocuments({ club: clubId, isDeleted: false });
    const allPosts = await Post.countDocuments({ club: clubId });
    console.log(`Active posts: ${activePosts}`);
    console.log(`Total posts (including deleted): ${allPosts}`);

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDeletedPost();
