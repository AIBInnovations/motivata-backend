/**
 * @fileoverview Check database for clubs and posts to test with
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Import schemas
import '../../schema/Club.schema.js';
import '../../schema/Post.schema.js';
import '../../schema/ClubMember.schema.js';
import '../../schema/User.schema.js';
import '../../schema/Admin.schema.js';

const Club = mongoose.model('Club');
const Post = mongoose.model('Post');
const ClubMember = mongoose.model('ClubMember');
const User = mongoose.model('User');
const Admin = mongoose.model('Admin');

async function checkTestData() {
  try {
    console.log('🔍 Checking Test Data');
    console.log('='.repeat(80));

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Check clubs
    console.log('📊 CLUBS:');
    console.log('-'.repeat(80));
    const clubs = await Club.find({}).select('name memberCount postCount').limit(5).lean();
    if (clubs.length === 0) {
      console.log('❌ No clubs found in database\n');
    } else {
      clubs.forEach((club, idx) => {
        console.log(`${idx + 1}. ${club.name}`);
        console.log(`   ID: ${club._id}`);
        console.log(`   Members: ${club.memberCount}, Posts: ${club.postCount}`);
      });
      console.log();
    }

    // Check posts
    console.log('📝 POSTS:');
    console.log('-'.repeat(80));
    const posts = await Post.find({})
      .populate('club', 'name')
      .populate('author', 'name')
      .select('content club author authorType createdAt')
      .limit(5)
      .lean();

    if (posts.length === 0) {
      console.log('❌ No posts found in database\n');
    } else {
      posts.forEach((post, idx) => {
        console.log(`${idx + 1}. Post ID: ${post._id}`);
        console.log(`   Club: ${post.club ? post.club.name : 'N/A'}`);
        console.log(`   Author: ${post.author ? post.author.name : 'N/A'} (${post.authorType})`);
        console.log(`   Content: ${post.content ? post.content.substring(0, 50) + '...' : 'No content'}`);
        console.log(`   Created: ${post.createdAt}`);
      });
      console.log();
    }

    // Check users
    console.log('👤 USERS:');
    console.log('-'.repeat(80));
    const users = await User.find({}).select('name email phone').limit(3).lean();
    console.log(`Total users: ${users.length}`);
    if (users.length > 0) {
      users.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} (${user.email || user.phone})`);
      });
    }
    console.log();

    // Check admins
    console.log('👨‍💼 ADMINS:');
    console.log('-'.repeat(80));
    const admins = await Admin.find({}).select('name username').limit(3).lean();
    console.log(`Total admins: ${admins.length}`);
    if (admins.length > 0) {
      admins.forEach((admin, idx) => {
        console.log(`${idx + 1}. ${admin.name} (@${admin.username})`);
        console.log(`   ID: ${admin._id}`);
      });
    }
    console.log();

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY:');
    console.log(`   Clubs: ${clubs.length}`);
    console.log(`   Posts: ${posts.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Admins: ${admins.length}`);
    console.log('='.repeat(80));

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkTestData();
