import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

import EventRequest from '../../schema/EventRequest.schema.js';
import EventEnrollment from '../../schema/EventEnrollment.schema.js';
import Payment from '../../schema/Payment.schema.js';

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node backfillEventRequestCompletion.mjs <orderId>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URL);

const payment = await Payment.findOne({ orderId });
if (!payment) {
  console.error('No Payment found for orderId', orderId);
  process.exit(1);
}
console.log('Payment status:', payment.status, '| eventRequestId:', payment.metadata?.eventRequestId);

const enrollment = await EventEnrollment.findOne({ orderId });
if (!enrollment) {
  console.error('No EventEnrollment found for orderId', orderId, '- ticket was not actually created, nothing to backfill.');
  process.exit(1);
}
console.log('Found enrollment:', enrollment._id.toString());

const eventRequestId = payment.metadata?.eventRequestId;
if (!eventRequestId) {
  console.error('Payment has no eventRequestId in metadata - not an invite-request payment.');
  process.exit(1);
}

const updated = await EventRequest.findByIdAndUpdate(
  eventRequestId,
  { status: 'COMPLETED', enrollmentId: enrollment._id },
  { new: true }
);
console.log('EventRequest updated:', updated.status, updated.enrollmentId?.toString());

await mongoose.disconnect();
