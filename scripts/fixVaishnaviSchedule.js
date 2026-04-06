/**
 * Fix Vaishnavi's session booking — set scheduledSlot + status = scheduled
 * Meeting: Fri 17 Apr 2026, 10:00–10:30 AM IST
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import SessionBooking from '../schema/SessionBooking.schema.js';

const BOOKING_ID = '69d0b2cb0967fb143bca3482';
// Apr 17 2026, 10:00 AM IST = 04:30 UTC
const SCHEDULED_AT = new Date('2026-04-17T04:30:00.000Z');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to DB');

  const booking = await SessionBooking.findById(BOOKING_ID);
  if (!booking) {
    console.log('Booking not found:', BOOKING_ID);
    process.exit(1);
  }

  console.log('Before:');
  console.log('  Status:', booking.status);
  console.log('  Scheduled Slot:', booking.scheduledSlot || 'NOT SET');

  booking.status = 'scheduled';
  booking.scheduledSlot = SCHEDULED_AT;
  await booking.save();

  console.log('\nAfter:');
  console.log('  Status:', booking.status);
  console.log('  Scheduled Slot:', booking.scheduledSlot);
  console.log('\nDone.');

  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
