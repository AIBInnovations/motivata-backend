/**
 * @fileoverview Seed the default opportunity filter options (idempotent).
 * Safe to run multiple times — existing options are skipped (unique index).
 *
 * Usage: node scripts/seedOpportunityFilters.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

import '../schema/OpportunityFilter.schema.js';

const OpportunityFilter = mongoose.model('OpportunityFilter');

const DEFAULTS = {
  type: ['Paid', 'Unpaid', 'Experience based', 'Social Work'],
  duration: ['Project based', 'Part-Time', 'Full-Time'],
  timeline: ['Days', 'Months'],
  location: ['City selection', 'Work from home', 'Hybrid'],
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('✅ Connected to MongoDB\n');

  let created = 0;
  let skipped = 0;

  for (const [category, values] of Object.entries(DEFAULTS)) {
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const exists = await OpportunityFilter.findOne({ category, value });
      if (exists) {
        skipped++;
        continue;
      }
      await OpportunityFilter.create({ category, value, order: i });
      created++;
      console.log(`  + [${category}] ${value}`);
    }
  }

  console.log(`\n✅ Done. Created ${created}, skipped ${skipped} (already present).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
