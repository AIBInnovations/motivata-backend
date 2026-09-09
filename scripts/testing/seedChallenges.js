/**
 * @fileoverview Seeds the challenge catalog from client_docs/Motivata Challenges.xlsx
 *
 * The sheet is laid out as three category blocks. Each block has a header row
 * naming its five sub-categories, then rows of challenge titles grouped by an
 * intensity marker in the last column.
 *
 * Three buckets are empty in the sheet — Professional/Medium, Professional/Hard
 * and Relational/Hard. Those are filled from GENERATED_BUCKETS below, which
 * escalates the client's own Easy entries. They are placeholders: replace them
 * when the client supplies the real ones.
 *
 * Usage:
 *   node scripts/testing/seedChallenges.js              # dry run
 *   APPLY=yes node scripts/testing/seedChallenges.js    # write
 *
 * @module scripts/testing/seedChallenges
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import xlsx from "xlsx";

import Challenge from "../../src/Challenge/challenge.schema.js";
import {
  CHALLENGE_CATEGORIES,
  isSubCategoryOfCategory,
} from "../../src/Challenge/challenge.categories.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHEET_PATH = path.resolve(__dirname, "../../../client_docs/Motivata Challenges.xlsx");

const APPLY = process.env.APPLY === "yes";

const CATEGORY_BY_HEADER = {
  "Personal Challenge": "personal",
  "Professional Challenge": "professional",
  "Relational Challenge": "relational",
};

const DIFFICULTIES = ["easy", "medium", "hard"];

const ICON_BY_SUB_CATEGORY = {
  mental_health: "meditation",
  physical_health: "dumbbell",
  self_awareness: "pencil",
  recreation: "sun",
  learning: "book",
  discipline: "checklist",
  growth: "star",
  productivity: "target",
  efficiency: "fire",
  finance: "trophy",
  society: "heart",
  family: "heart",
  friendship: "star",
  romance: "heart",
  communication: "pencil",
};

/**
 * Placeholder challenges for the three buckets the client left empty.
 * Each one escalates a title the client already wrote at Easy.
 */
const GENERATED_BUCKETS = {
  "professional:medium": {
    discipline: [
      "Stick to your work schedule every day",
      "Beat procrastination on one hard task daily",
      "Start work 30 minutes earlier",
      "Work for 5-6 focused hours",
    ],
    growth: [
      "Spend 30 mins learning a work skill",
      "Connect with 3 new professionals",
      "Improve your portfolio every week",
      "Attend 2 networking events",
      "Get your first client for your service",
    ],
    productivity: [
      "Work 4-5 hours undistracted",
      "Plan your whole week every Sunday",
      "Review your day and your week",
      "Cut 2 time-wasting habits",
    ],
    efficiency: [
      "Automate or delegate 2 tasks",
      "Time-box every task you take on",
      "Halve the time you spend in meetings",
      "2 hours in an undistracted deep-work zone",
      "Use your phone only for work during work hours",
    ],
    finance: [
      "Track and review your expenses weekly",
      "Grow your emergency fund to 3 months",
      "Earn your first income from a second source",
      "Invest 30% of your earnings",
      "Save 25% of your income",
    ],
  },
  "professional:hard": {
    discipline: [
      "Follow a time-blocked schedule every day",
      "Zero procrastination for the whole week",
      "Start work by 7 am",
      "Work for 7-8 focused hours",
    ],
    growth: [
      "Spend 1 hour daily learning a work skill",
      "Connect with 5 new professionals",
      "Ship a portfolio project",
      "Speak or present at a networking event",
      "Launch your product",
    ],
    productivity: [
      "Work 6+ hours undistracted",
      "Plan and time-block every single day",
      "Run a weekly review with your own metrics",
      "Eliminate every time-wasting habit",
    ],
    efficiency: [
      "Automate or delegate 5 tasks",
      "Run your entire day on time-blocks",
      "No meeting without a written agenda",
      "4 hours in an undistracted deep-work zone",
      "Phone-free work hours",
    ],
    finance: [
      "Run a full monthly budget review",
      "Build a 6-month emergency fund",
      "Scale your second income source",
      "Invest 40% of your earnings",
      "Save 35% of your income",
    ],
  },
  "relational:hard": {
    society: [
      "Do an act of kindness every day",
      "Volunteer for a month",
      "Start a conversation with a stranger daily",
      "Discuss social news meaningfully",
      "Lead a civic initiative",
    ],
    family: [
      "Spend 1 hour with family daily",
      "No phone zone for 2 hours",
      "Write a gratitude note to family daily",
      "Family call for 15 mins",
      "Own a family responsibility fully",
    ],
    friendship: [
      "Reach out to 2 friends every day",
      "Meet a friend every day",
      "Be fully present, phone away",
      "Support a friend through something hard",
    ],
    romance: [
      "Do something thoughtful every day",
      "Have a deep conversation every day",
      "Express gratitude twice a day",
      "No screens for 2 hours together daily",
    ],
    communication: [
      "Actively listen to 5 people daily",
      "Keep a 30 min zero-talking zone daily",
      "Pause 10 seconds before you speak",
      "Practise your body language daily",
    ],
  },
};

const slug = (label) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const labelFor = (categoryKey, subKey) => {
  const category = CHALLENGE_CATEGORIES.find((c) => c.key === categoryKey);
  const sub = category?.subCategories.find((s) => s.key === subKey);
  return { category: category?.label ?? categoryKey, sub: sub?.label ?? subKey };
};

const buildDescription = (title, categoryKey, subKey, difficulty) => {
  const { category, sub } = labelFor(categoryKey, subKey);
  return `${title}. A ${difficulty} ${sub.toLowerCase()} challenge under ${category}. Do it each day and mark the day done to keep your streak going.`;
};

/**
 * Reads the sheet into { category, subCategory, difficulty, title } rows.
 */
const parseSheet = () => {
  const wb = xlsx.readFile(SHEET_PATH);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    blankrows: false,
    defval: "",
  });

  const normalise = (row) => row.map((c) => String(c).replace(/\s+/g, " ").trim());

  const headerRow = rows.map(normalise).find((cells) =>
    cells.some((c) => c.toLowerCase() === "challenge intensity")
  );
  if (!headerRow) throw new Error('Could not find the "Challenge Intensity" header column');

  const intensityColumn = headerRow.findIndex((c) => c.toLowerCase() === "challenge intensity");

  const out = [];
  let categoryKey = null;
  let subByColumn = {};
  let difficulty = null;

  for (const raw of rows) {
    const cells = normalise(raw);
    const first = cells[0] || "";

    if (CATEGORY_BY_HEADER[first]) {
      categoryKey = CATEGORY_BY_HEADER[first];
      subByColumn = {};
      for (let col = 1; col <= 5; col++) {
        if (cells[col]) subByColumn[col] = slug(cells[col]);
      }
      continue;
    }

    if (!categoryKey) continue;

    const marker = (cells[intensityColumn] || "").toLowerCase();
    if (DIFFICULTIES.includes(marker)) difficulty = marker;
    if (!difficulty) continue;

    for (let col = 1; col <= 5; col++) {
      const title = cells[col];
      if (!title) continue;
      const subCategory = subByColumn[col];
      if (!subCategory) continue;
      out.push({ category: categoryKey, subCategory, difficulty, title, source: "sheet" });
    }
  }

  return out;
};

const buildGenerated = () => {
  const out = [];
  for (const [key, subs] of Object.entries(GENERATED_BUCKETS)) {
    const [category, difficulty] = key.split(":");
    for (const [subCategory, titles] of Object.entries(subs)) {
      for (const title of titles) {
        out.push({ category, subCategory, difficulty, title, source: "generated" });
      }
    }
  }
  return out;
};

const run = async () => {
  if (!fs.existsSync(SHEET_PATH)) {
    console.error(`Sheet not found: ${SHEET_PATH}`);
    process.exit(1);
  }

  const fromSheet = parseSheet();
  const generated = buildGenerated();
  const all = [...fromSheet, ...generated];

  const bad = all.filter((c) => !isSubCategoryOfCategory(c.category, c.subCategory));
  if (bad.length) {
    console.error("Rows whose sub-category does not belong to its category:");
    for (const b of bad) console.error(`  ${b.category} / ${b.subCategory} / "${b.title}"`);
    process.exit(1);
  }

  console.log(`### ${APPLY ? "APPLY" : "DRY RUN"} ###\n`);
  console.log(`from sheet : ${fromSheet.length}`);
  console.log(`generated  : ${generated.length}`);
  console.log(`total      : ${all.length}\n`);

  console.log("counts per bucket:");
  for (const category of CHALLENGE_CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      const rows = all.filter((c) => c.category === category.key && c.difficulty === difficulty);
      const src = rows.length && rows.every((r) => r.source === "generated") ? "  (placeholder)" : "";
      console.log(`  ${category.label.padEnd(13)} ${difficulty.padEnd(7)} ${String(rows.length).padStart(3)}${src}`);
    }
  }

  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 25000 });
  console.log(`\nconnected to: ${mongoose.connection.db.databaseName}`);

  const admin = await mongoose.connection.db
    .collection("admins")
    .findOne({ role: "SUPER_ADMIN" });
  if (!admin) {
    console.error("No SUPER_ADMIN found to own the seeded challenges");
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    const doc = {
      title: c.title,
      description: buildDescription(c.title, c.category, c.subCategory, c.difficulty),
      category: c.category,
      subCategory: c.subCategory,
      difficulty: c.difficulty,
      tasks: [],
      durationDays: 30,
      allowedDurations: [7, 15, 30],
      icon: ICON_BY_SUB_CATEGORY[c.subCategory] ?? null,
      isActive: true,
      order: i,
      createdBy: admin._id,
    };

    const existing = await Challenge.findOne({
      title: c.title,
      category: c.category,
      subCategory: c.subCategory,
      difficulty: c.difficulty,
    });

    if (existing) {
      updated++;
      if (APPLY) {
        existing.set({ ...doc, createdBy: existing.createdBy, updatedBy: admin._id });
        await existing.save();
      }
    } else {
      created++;
      if (APPLY) await Challenge.create(doc);
    }
  }

  console.log(`\n${APPLY ? "created" : "would create"} ${created}, ${APPLY ? "updated" : "would update"} ${updated}`);

  if (APPLY) {
    console.log("\n=== VERIFY ===");
    const total = await Challenge.countDocuments({ isDeleted: false });
    const withSub = await Challenge.countDocuments({ isDeleted: false, subCategory: { $ne: null } });
    console.log(`  challenges total        : ${total}`);
    console.log(`  with a sub-category     : ${withSub}`);
    console.log(`  task-less               : ${await Challenge.countDocuments({ isDeleted: false, tasks: { $size: 0 } })}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  console.error(err);
  process.exit(1);
});
