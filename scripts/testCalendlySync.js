/**
 * Full sync test — runs one poll cycle against real DB
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

await mongoose.connect(process.env.MONGODB_URL);
console.log('Connected to DB\n');

const { startCalendlySyncJob } = await import('../services/calendlySync.service.js');

// Run one cycle (startup call inside startCalendlySyncJob runs immediately)
startCalendlySyncJob();

// Wait 15s for it to finish, then disconnect
setTimeout(async () => {
  await mongoose.disconnect();
  process.exit(0);
}, 15000);
