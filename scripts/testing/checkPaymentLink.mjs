import dotenv from 'dotenv';
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

const linkIds = process.argv.slice(2);

for (const id of linkIds) {
  try {
    const link = await razorpayInstance.paymentLink.fetch(id);
    console.log('---', id, '---');
    console.log(JSON.stringify(link, null, 2));
  } catch (e) {
    console.log(id, 'ERROR:', e.message);
  }
}
