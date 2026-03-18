/**
 * @fileoverview Seed fake event enrollments to test the "ticket buyers" feature
 *
 * Creates N fake users (or reuses existing ones by phone) and inserts
 * EventEnrollment documents for a target event so the event description
 * page shows "Name1, Name2, Name3 and X others have purchased tickets."
 *
 * Usage:
 *   node scripts/testing/seedEventEnrollments.js
 *   node scripts/testing/seedEventEnrollments.js "mongodb+srv://..."
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

// ─── CONFIG ────────────────────────────────────────────────────────────────
const EVENT_ID = "695ea1fcdc0d6eb1f8f8d71f";

// Fake buyers to seed (phone must be unique in DB — adjust if conflicts)
const FAKE_BUYERS = [
  { name: "Aarav Sharma",  phone: "9000000001" },
  { name: "Diya Mehta",    phone: "9000000002" },
  { name: "Rohan Verma",   phone: "9000000003" },
  { name: "Priya Singh",   phone: "9000000004" },
  { name: "Kabir Joshi",   phone: "9000000005" },
  { name: "Ananya Rao",    phone: "9000000006" },
  { name: "Vivek Nair",    phone: "9000000007" },
  { name: "Sneha Iyer",    phone: "9000000008" },
  { name: "Arjun Pillai",  phone: "9000000009" },
  { name: "Meera Pandey",  phone: "9000000010" },
  { name: "Nikhil Das",    phone: "9000000011" },
  { name: "Pooja Gupta",   phone: "9000000012" },
  { name: "Rahul Tiwari",  phone: "9000000013" },
];

const MONGODB_URL =
  process.argv[2] ||
  process.env.MONGODB_URL ||
  process.env.MONGODB_URI;
// ───────────────────────────────────────────────────────────────────────────

import User from "../../schema/User.schema.js";
import EventEnrollment from "../../schema/EventEnrollment.schema.js";

async function seed() {
  if (!MONGODB_URL) {
    console.error("❌ No MongoDB URL. Set MONGODB_URI in .env or pass as first arg.");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URL);
  console.log("✅ Connected to MongoDB");

  let created = 0;
  let skipped = 0;

  for (const buyer of FAKE_BUYERS) {
    // Upsert the fake user (insert if not exists)
    let user = await User.findOne({ phone: buyer.phone });
    if (!user) {
      user = await User.create({
        name: buyer.name,
        phone: buyer.phone,
        password: "$2b$10$placeholder.hash.not.real.xxxxxxxxxxxxxxxxxxxxx", // bcrypt placeholder
      });
      console.log(`  👤 Created user: ${buyer.name} (${buyer.phone})`);
    } else {
      console.log(`  ℹ️  User exists: ${user.name} (${buyer.phone})`);
    }

    // Insert enrollment if not already present
    const existing = await EventEnrollment.findOne({
      userId: user._id,
      eventId: EVENT_ID,
    });

    if (existing) {
      console.log(`  ⏭️  Enrollment already exists for ${user.name}`);
      skipped++;
      continue;
    }

    const fakePhone = buyer.phone;
    await EventEnrollment.create({
      paymentId: `fake_pay_${user._id}`,
      orderId:   `fake_ord_${user._id}`,
      userId:    user._id,
      eventId:   EVENT_ID,
      ticketCount: 1,
      ticketPrice: 0,
      tickets: new Map([
        [fakePhone, { status: "ACTIVE" }],
      ]),
    });

    console.log(`  🎟️  Enrollment created for ${buyer.name}`);
    created++;
  }

  console.log(`\n✅ Done — created: ${created}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
