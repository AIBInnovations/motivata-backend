/**
 * @fileoverview Quick script to restore a soft-deleted user
 *
 * Usage:
 *   node restoreUser.js <userId>
 *
 * Example:
 *   node restoreUser.js 695c014aae03e0d22998ca32
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import User schema
import './schema/User.schema.js';
const User = mongoose.model('User');

// Get userId from command line
const userId = process.argv[2];

async function restoreUser() {
  try {
    if (!userId) {
      console.error('❌ Error: User ID is required');
      console.log('\nUsage:');
      console.log('  node restoreUser.js <userId>');
      console.log('\nExample:');
      console.log('  node restoreUser.js 695c014aae03e0d22998ca32');
      process.exit(1);
    }

    console.log('🔄 Restoring User');
    console.log('='.repeat(60));
    console.log(`User ID: ${userId}\n`);

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    // Restore the user using the static restore method
    console.log('🔄 Restoring user...');
    const user = await User.restore(userId);

    if (!user) {
      console.error(`❌ User not found with ID: ${userId}`);
      console.error('   The user may not exist or is already restored.');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('✅ User restored successfully!\n');
    console.log('📊 Restored User:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Phone: ${user.phone}`);
    console.log(`   Is Deleted: ${user.isDeleted}\n`);

    console.log('='.repeat(60));
    console.log('🎉 RESTORE COMPLETE!');
    console.log('='.repeat(60));

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
restoreUser();
