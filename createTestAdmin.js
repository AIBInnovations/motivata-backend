/**
 * @fileoverview Create a test admin for API testing
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Import Admin schema
import './schema/Admin.schema.js';
const Admin = mongoose.model('Admin');

async function createTestAdmin() {
  try {
    console.log('🔧 Creating Test Admin');
    console.log('='.repeat(60));

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('✅ Connected to MongoDB\n');

    const username = 'testadmin';
    const password = 'Test123456';

    // Check if test admin already exists
    const existing = await Admin.findOne({ username });
    if (existing) {
      console.log('ℹ️  Test admin already exists');
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      console.log('\n✅ You can use these credentials for testing\n');
      await mongoose.disconnect();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create test admin
    const testAdmin = new Admin({
      name: 'Test Admin',
      username: username,
      email: 'testadmin@motivata.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      status: 'ACTIVATED',
      access: ['ALL']
    });

    await testAdmin.save();

    console.log('✅ Test admin created successfully!\n');
    console.log('📊 Test Admin Details:');
    console.log(`   Name: ${testAdmin.name}`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${testAdmin.role}`);
    console.log(`   ID: ${testAdmin._id}`);
    console.log();
    console.log('='.repeat(60));
    console.log('🎉 You can now use these credentials for API testing');
    console.log('='.repeat(60));

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

createTestAdmin();
