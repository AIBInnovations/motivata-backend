import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const referenceId = process.argv[2];
const paymentLinkId = process.argv[3] || 'plink_FAKE_TEST';
if (!referenceId) {
  console.error('Usage: node fakePaymentLinkWebhook.mjs <reference_id/orderId> [paymentLinkId]');
  process.exit(1);
}

const webhookPayload = {
  entity: 'event',
  account_id: 'acc_test',
  event: 'payment_link.paid',
  contains: ['payment_link', 'payment'],
  payload: {
    payment_link: {
      entity: {
        id: paymentLinkId,
        reference_id: referenceId,
        order_id: 'order_FAKE_TEST_' + Date.now(),
        status: 'paid',
        amount: 100,
        amount_paid: 100,
        currency: 'INR',
      },
    },
    payment: {
      entity: {
        id: 'pay_FAKE_TEST',
        status: 'captured',
      },
    },
  },
  created_at: Math.floor(Date.now() / 1000),
};

const rawBody = JSON.stringify(webhookPayload);
const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

console.log('Sending fabricated payment_link.paid for reference_id:', referenceId);

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
