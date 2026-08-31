import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Razorpay from 'razorpay';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const linkId = process.argv[2];
if (!linkId) {
  console.error('Usage: node replayPaymentLinkWebhook.mjs <payment_link_id>');
  process.exit(1);
}

const link = await razorpayInstance.paymentLink.fetch(linkId);
if (link.status !== 'paid') {
  console.error('Link is not paid, status:', link.status);
  process.exit(1);
}

const paymentEntity = await razorpayInstance.payments.fetch(link.payments[0].payment_id);

const webhookPayload = {
  entity: 'event',
  account_id: 'acc_test',
  event: 'payment_link.paid',
  contains: ['payment_link', 'payment'],
  payload: {
    payment_link: { entity: link },
    payment: { entity: paymentEntity },
  },
  created_at: Math.floor(Date.now() / 1000),
};

const rawBody = JSON.stringify(webhookPayload);
const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

console.log('Replaying payment_link.paid for', linkId, 'reference_id:', link.reference_id);

const res = await fetch('http://localhost:5000/api/web/razorpay/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-razorpay-signature': signature,
  },
  body: rawBody,
});

console.log('HTTP status:', res.status);
console.log('Response body:', await res.text());
