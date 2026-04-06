/**
 * Check session bookings for Chandresh Delwar (phone: 7898817127)
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

  const user = await User.findOne({ phone: { $in: ['7898817127', '+917898817127'] } });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }
  console.log('User found:', user._id, user.name, user.phone);

  const bookings = await SessionBooking.find({ userId: user._id }).populate('sessionId', 'title sessionType');
  if (!bookings.length) {
    console.log('No bookings found for this user');
  } else {
    for (const b of bookings) {
      console.log('---');
      console.log('Booking ID:', b._id);
      console.log('Session:', b.sessionId?.title, '|', b.sessionId?.sessionType);
      console.log('Status:', b.status);
      console.log('Payment Status:', b.paymentStatus);
      console.log('Scheduled Slot:', b.scheduledSlot || 'Not scheduled');
      console.log('Scheduled Slot:', b.scheduledSlot || 'Not scheduled');
      console.log('Calendly Event URI:', b.calendlyEventUri || 'None');
      console.log('Cancelled At:', b.cancelledAt || 'Not cancelled');
      console.log('Raw booking:', JSON.stringify(b.toObject(), null, 2));
    }
  }

  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
