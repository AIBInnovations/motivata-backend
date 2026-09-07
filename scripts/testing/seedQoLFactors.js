import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

const MONGODB_URL = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;
const APPLY = process.env.APPLY === "yes";

import QoLFactor from "../../src/Quiz/schemas/qolFactor.schema.js";

const FACTORS = [
  "Knowing yourself",
  "Physical health",
  "Mental health",
  "Relations",
  "Society",
  "Career",
  "Finance",
  "Spirituality",
];

const seed = async () => {
  await mongoose.connect(MONGODB_URL);
  console.log(APPLY ? "*** APPLY MODE ***" : "--- DRY RUN (set APPLY=yes to write) ---");
  console.log("");

  const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }), "admins");
  const admin = await Admin.findOne({});

  for (let i = 0; i < FACTORS.length; i += 1) {
    const name = FACTORS[i];
    const existing = await QoLFactor.findOne({ name });

    if (existing) {
      console.log(`  [skip] "${name}" already exists (order ${existing.order})`);
      continue;
    }

    if (!APPLY) {
      console.log(`  [dry] would create "${name}" (order ${i})`);
      continue;
    }

    await QoLFactor.create({ name, order: i, isActive: true, createdBy: admin?._id });
    console.log(`  created "${name}" (order ${i})`);
  }

  if (APPLY) {
    console.log("");
    const all = await QoLFactor.findActiveOrdered();
    console.log(`VERIFY: ${all.length} active factor(s)`);
    all.forEach((f) => console.log(`  ${f.order}. ${f.name}`));
  }

  await mongoose.disconnect();
  console.log("Done.");
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
