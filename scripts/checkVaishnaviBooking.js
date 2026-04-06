/**
 * Check session bookings for Vaishnavi
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import User from '../schema/User.schema.js';
import SessionBooking from '../schema/SessionBooking.schema.js';
import Session from '../schema/Session.schema.js';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('Connected to DB');

  // Search by name (case-insensitive)
  const users = await User.find({ name: { $regex: /vaishnavi/i } });
  if (!users.length) {
    console.log('No user found with name Vaishnavi');
    process.exit(1);
  }

  for (const user of users) {
    console.log('\n=============================');
    console.log('User:', user._id, '|', user.name, '|', user.phone, '|', user.email);

    const bookings = await SessionBooking.find({ userId: user._id }).populate('sessionId', 'title sessionType calendlyLink');
    if (!bookings.length) {
      console.log('  No bookings found for this user');
    } else {
      for (const b of bookings) {
        console.log('  ---');
        console.log('  Booking ID:', b._id);
        console.log('  Booking Ref:', b.bookingReference);
        console.log('  Session:', b.sessionId?.title, '|', b.sessionId?.sessionType);
        console.log('  Status:', b.status);
        console.log('  Payment Status:', b.paymentStatus);
        console.log('  Scheduled Slot:', b.scheduledSlot || 'NOT SET');
        console.log('  Calendly Event URI:', b.calendlyEventUri || 'None');
        console.log('  Booked At:', b.bookedAt);
        console.log('  Updated At:', b.updatedAt);
      }
    }
  }

  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
