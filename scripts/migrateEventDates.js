/**
 * @fileoverview Migration script to add booking date fields to existing events
 * @module scripts/migrateEventDates
 *
 * This script migrates events from 2-date system to 4-date system by:
 * - Adding bookingStartDate (set to event creation date or now)
 * - Adding bookingEndDate (set to existing endDate to preserve behavior)
 *
 * Usage: node scripts/migrateEventDates.js
 */

import dotenv from 'dotenv';
import connectDB from '../config/database.config.js';
import Event from '../schema/Event.schema.js';

dotenv.config();

const migrateEventDates = async () => {
  try {
    console.log('[MIGRATION] Starting event dates migration (2 dates → 4 dates)...');
    console.log('[MIGRATION] This will add bookingStartDate and bookingEndDate fields to all events');

    await connectDB();
    console.log('[MIGRATION] Connected to database');

    // Find events that don't have new booking date fields
    const eventsToMigrate = await Event.find({
      $or: [
        { bookingStartDate: { $exists: false } },
        { bookingEndDate: { $exists: false } }
      ]
    }).select('_id name startDate endDate createdAt isLive');

    console.log(`[MIGRATION] Found ${eventsToMigrate.length} events to migrate`);

    if (eventsToMigrate.length === 0) {
      console.log('[MIGRATION] No events to migrate. All events already have booking dates.');
      process.exit(0);
    }

    const now = new Date();
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];

    // Migrate each event individually to compute proper dates
    for (const event of eventsToMigrate) {
      try {
        // Set bookingStartDate to createdAt, or now if createdAt is in the past
        const bookingStartDate = event.createdAt < now ? now : event.createdAt;

        // Set bookingEndDate to existing endDate (preserves current behavior)
        const bookingEndDate = event.endDate;

        await Event.updateOne(
          { _id: event._id },
          {
            $set: {
              bookingStartDate,
              bookingEndDate,
            }
          }
        );

        migratedCount++;

        // Log progress every 100 events
        if (migratedCount % 100 === 0) {
          console.log(`[MIGRATION] Progress: ${migratedCount}/${eventsToMigrate.length} (${Math.round(migratedCount / eventsToMigrate.length * 100)}%)`);
        }
      } catch (updateError) {
        console.error(`[MIGRATION] Failed to migrate event ${event._id} (${event.name}):`, updateError.message);
        errors.push({
          eventId: event._id,
          eventName: event.name,
          error: updateError.message
        });
        errorCount++;
      }
    }

    console.log('\n[MIGRATION] ========================================');
    console.log('[MIGRATION] Migration completed!');
    console.log('[MIGRATION] ========================================');
    console.log(`[MIGRATION] ✓ Successfully migrated: ${migratedCount}`);
    console.log(`[MIGRATION] ✗ Failed: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n[MIGRATION] Failed events:');
      errors.forEach(err => {
        console.log(`  - ${err.eventName} (${err.eventId}): ${err.error}`);
      });
    }

    // Verification
    console.log('\n[MIGRATION] Running verification...');
    const totalEvents = await Event.countDocuments({});
    const eventsWithBookingDates = await Event.countDocuments({
      bookingStartDate: { $exists: true },
      bookingEndDate: { $exists: true }
    });

    console.log('[MIGRATION] Verification Results:');
    console.log(`[MIGRATION] - Total events: ${totalEvents}`);
    console.log(`[MIGRATION] - Events with booking dates: ${eventsWithBookingDates}`);
    console.log(`[MIGRATION] - Coverage: ${Math.round(eventsWithBookingDates / totalEvents * 100)}%`);

    if (eventsWithBookingDates === totalEvents) {
      console.log('[MIGRATION] ✓ All events successfully migrated!');
      console.log('[MIGRATION] Migration completed successfully.');
      process.exit(0);
    } else {
      console.log('[MIGRATION] ⚠ Warning: Some events may not have been migrated');
      console.log(`[MIGRATION] Missing: ${totalEvents - eventsWithBookingDates} events`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n[MIGRATION] ========================================');
    console.error('[MIGRATION] FATAL ERROR: Migration failed');
    console.error('[MIGRATION] ========================================');
    console.error('[MIGRATION] Error:', error.message);
    console.error('[MIGRATION] Stack:', error.stack);
    console.error('\n[MIGRATION] Please check your database connection and try again.');
    console.error('[MIGRATION] If the error persists, restore from backup and contact support.');
    process.exit(1);
  }
};

// Run migration
console.log('========================================');
console.log('Event Dates Migration Script');
console.log('========================================');
console.log('This script will migrate events from 2-date to 4-date system.');
console.log('Make sure you have backed up your database before proceeding!');
console.log('========================================\n');

migrateEventDates();
