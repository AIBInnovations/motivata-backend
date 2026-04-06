/**
 * Manually mark Chandresh's Group Session booking as scheduled
 * Booking: SB-UHD04J (69d34f03a1ba2684e9d23f37)
 * Scheduled: Thursday April 16 2026 01:30am ET = 2026-04-16T05:30:00.000Z
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import SessionBooking from '../schema/SessionBooking.schema.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to DB');

  const booking = await SessionBooking.findById('69d34f03a1ba2684e9d23f37');
  if (!booking) {
    console.log('Booking not found');
    process.exit(1);
  }

  console.log('Before:', { status: booking.status, scheduledSlot: booking.scheduledSlot });

  booking.status = 'scheduled';
  booking.scheduledSlot = new Date('2026-04-16T05:30:00.000Z'); // 1:30am ET
  await booking.save();

  console.log('After:', { status: booking.status, scheduledSlot: booking.scheduledSlot });
  console.log('Done — booking marked as scheduled');

  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
