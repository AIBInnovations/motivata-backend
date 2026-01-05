/**
 * @fileoverview Migration script to add seat arrangement fields to existing events
 * @module scripts/addSeatArrangementFields
 */

import dotenv from 'dotenv';
import connectDB from '../config/database.config.js';
import Event from '../schema/Event.schema.js';
import mongoose from 'mongoose';

dotenv.config();

/**
 * Add seat arrangement fields to all existing events
 * Sets hasSeatArrangement = false and seatArrangementId = null for existing records
 */
const migrateEvents = async () => {
  try {
    console.log('[MIGRATION] Starting seat arrangement fields migration...');

    // Connect to database
    await connectDB();
    console.log('[MIGRATION] Connected to database');

    // Find all events that don't have hasSeatArrangement field
    const eventsToUpdate = await Event.countDocuments({
      hasSeatArrangement: { $exists: false }
    });

    console.log(`[MIGRATION] Found ${eventsToUpdate} events to update`);

    if (eventsToUpdate === 0) {
      console.log('[MIGRATION] No events to migrate. All events already have seat arrangement fields.');
      process.exit(0);
    }

    // Update all events without the fields
    const result = await Event.updateMany(
      { hasSeatArrangement: { $exists: false } },
      {
        $set: {
          hasSeatArrangement: false,
          seatArrangementId: null
        }
      }
    );

    console.log('[MIGRATION] Migration completed successfully!');
    console.log(`[MIGRATION] Modified ${result.modifiedCount} events`);
    console.log(`[MIGRATION] Matched ${result.matchedCount} events`);

    // Verify migration
    const eventsWithFields = await Event.countDocuments({
      hasSeatArrangement: { $exists: true }
    });

    const totalEvents = await Event.countDocuments({});

    console.log('[MIGRATION] Verification:');
    console.log(`[MIGRATION] - Total events: ${totalEvents}`);
    console.log(`[MIGRATION] - Events with seat arrangement fields: ${eventsWithFields}`);

    if (eventsWithFields === totalEvents) {
      console.log('[MIGRATION] ✓ All events successfully migrated!');
    } else {
      console.log('[MIGRATION] ⚠ Warning: Some events may not have been migrated');
    }

    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Run migration
migrateEvents();
