/**
 * @fileoverview Migration script to update challenge categories from 10 to 3
 * Maps: health/fitness/mindfulness/wellness/habit/other → personal
 *       productivity/learning/creativity → professional
 *       social → relational
 * @module scripts/migrateChallengeCategories
 */

import dotenv from 'dotenv';
import connectDB from '../config/database.config.js';
import mongoose from 'mongoose';

dotenv.config();

const migrateChallengeCategories = async () => {
  try {
    console.log('[MIGRATION] Starting challenge categories migration...');

    await connectDB();
    console.log('[MIGRATION] Connected to database');

    const db = mongoose.connection.db;
    const challengesCollection = db.collection('challenges');

    // Map old categories to new ones
    const mappings = [
      {
        oldCategories: ['health', 'fitness', 'mindfulness', 'wellness', 'habit', 'other'],
        newCategory: 'personal',
      },
      {
        oldCategories: ['productivity', 'learning', 'creativity'],
        newCategory: 'professional',
      },
      {
        oldCategories: ['social'],
        newCategory: 'relational',
      },
    ];

    let totalModified = 0;

    for (const { oldCategories, newCategory } of mappings) {
      const result = await challengesCollection.updateMany(
        { category: { $in: oldCategories } },
        { $set: { category: newCategory } }
      );
      console.log(`[MIGRATION] ${oldCategories.join(', ')} → ${newCategory}: ${result.modifiedCount} updated`);
      totalModified += result.modifiedCount;
    }

    console.log(`[MIGRATION] Total challenges updated: ${totalModified}`);

    // Verify
    const categoryCounts = await challengesCollection.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]).toArray();

    console.log('[MIGRATION] Verification - current categories:');
    for (const c of categoryCounts) {
      console.log(`[MIGRATION]   ${c._id}: ${c.count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

migrateChallengeCategories();
