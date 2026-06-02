/**
 * @fileoverview Seed/update script for the Generic SOS (GSOS) Day 1 quiz.
 *
 * Loads the official "SOS: Sort Our Selves | One Day Program" worksheet
 * (15 questions) into the GSOS program's Day 1 quiz. Idempotent: updates the
 * existing Day 1 quiz content if one already exists, otherwise creates it.
 *
 * Usage:
 *   node scripts/testing/seedGSOSQuiz.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

const MONGODB_URL = process.argv[2] || process.env.MONGODB_URL || process.env.MONGODB_URI;

import SOSProgram from "../../src/Quiz/schemas/sosProgram.schema.js";
import SOSQuiz from "../../src/Quiz/schemas/sosQuiz.schema.js";

/**
 * Shared option set for the "area of life" questions (Q11–Q13).
 */
const LIFE_AREAS = [
  { text: "Health & Wellness", value: "health_wellness", order: 1 },
  { text: "Relations & Society", value: "relations_society", order: 2 },
  { text: "Career & Finance", value: "career_finance", order: 3 },
  { text: "Spirituality", value: "spirituality", order: 4 },
];

/**
 * The 15 worksheet questions, in order.
 */
const QUESTIONS = [
  {
    questionText: "Who are you? What defines you?",
    questionType: "text",
    isRequired: true,
    order: 0,
  },
  {
    questionText:
      "If everything was possible, what would you do in your life? Your most ambitious dream would be?",
    questionType: "text",
    isRequired: true,
    order: 1,
  },
  {
    questionText: "What do you do the best or think you can do the best?",
    questionType: "text",
    isRequired: true,
    order: 2,
  },
  {
    questionText:
      "Who do you aspire to be in your life? People you aspire to become or simply respect and appreciate for who they are and what they do.",
    questionType: "text-list",
    maxEntries: 5,
    isRequired: true,
    order: 3,
  },
  {
    questionText:
      "Start-ups, brands, companies, individuals you would like to work with?",
    questionType: "text-list",
    maxEntries: 5,
    isRequired: true,
    order: 4,
  },
  {
    questionText:
      "Your hobbies, interests, things that you love doing or excites you the most?",
    questionType: "text-list",
    maxEntries: 5,
    isRequired: true,
    order: 5,
  },
  {
    questionText: "What do you think is your biggest strength and weakness?",
    questionType: "text-group",
    subFields: ["Strength", "Weakness"],
    isRequired: true,
    order: 6,
  },
  {
    questionText:
      "What are you most proud of, about yourself? Any incidence, achievement, experience, quality?",
    questionType: "text",
    isRequired: true,
    order: 7,
  },
  {
    questionText: "What are you grateful for? (Anything to everything)",
    questionType: "text-list",
    maxEntries: 5,
    isRequired: true,
    order: 8,
  },
  {
    questionText: "Where do you see yourself in next 5 years?",
    questionType: "text",
    isRequired: true,
    order: 9,
  },
  {
    questionText: "What is number one on your priority list?",
    questionType: "single-choice",
    options: [
      { text: "Knowing yourself", value: "knowing_yourself", order: 0 },
      ...LIFE_AREAS,
    ],
    isRequired: true,
    order: 10,
  },
  {
    questionText: "Which areas of life are degrading your quality of life? (Choose Multiple Options)",
    questionType: "multiple-choice",
    options: [
      { text: "Self", value: "self", order: 0 },
      ...LIFE_AREAS,
    ],
    isRequired: true,
    order: 11,
  },
  {
    questionText: "Which area of life is degrading your quality of life the most?",
    questionType: "single-choice",
    options: [
      { text: "Self", value: "self", order: 0 },
      ...LIFE_AREAS,
    ],
    isRequired: true,
    order: 12,
  },
  {
    questionText:
      "Set a vision for the area that is degrading the most quality of your life, where do you see yourself in the next 6 months in that area? Write it down.",
    questionType: "text",
    isRequired: true,
    order: 13,
  },
  {
    questionText:
      "Now give an attempt at setting a simple goal that will get you closer to that vision, ask yourself what all do I need to accomplish my vision? Write it here.",
    questionType: "text",
    isRequired: true,
    order: 14,
  },
];

const QUIZ_TITLE = "SOS: Sort Our Selves";
const QUIZ_DESCRIPTION =
  "Sort Our Selves — a one-day self-reflection program to know yourself, set a vision, and define your goals.";

async function seed() {
  await mongoose.connect(MONGODB_URL);
  console.log("Connected to MongoDB");

  // Find the target GSOS program deterministically.
  // Multiple GSOS programs can exist, so a bare findOne({type:'GSOS'}) is ambiguous.
  // Precedence: explicit GSOS_PROGRAM_ID env  >  exact canonical title  >  legacy findOne.
  const TARGET_PROGRAM_ID = process.env.GSOS_PROGRAM_ID;
  const CANONICAL_TITLE = "SOS - ONE DAY PROGRAM";

  let program = null;
  if (TARGET_PROGRAM_ID) {
    program = await SOSProgram.findById(TARGET_PROGRAM_ID);
  }
  if (!program) {
    program = await SOSProgram.findOne({
      type: "GSOS",
      title: CANONICAL_TITLE,
      isDeleted: { $ne: true },
    });
  }
  if (!program) {
    program = await SOSProgram.findOne({ type: "GSOS", isDeleted: { $ne: true } });
  }
  if (!program) {
    console.error("No GSOS program found. Create a GSOS program first.");
    process.exit(1);
  }
  console.log(`Found GSOS program: "${program.title}" (${program._id})`);

  // Use the first admin as the creator/updater
  const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }), "admins");
  const admin = await Admin.findOne({});
  if (!admin) {
    console.error("No admin found in the database.");
    process.exit(1);
  }

  // Update existing Day 1 quiz content if present, otherwise create it
  const existing = await SOSQuiz.findOne({
    programId: program._id,
    dayNumber: 1,
    isDeleted: { $ne: true },
  });

  if (existing) {
    existing.title = QUIZ_TITLE;
    existing.description = QUIZ_DESCRIPTION;
    existing.questions = QUESTIONS;
    existing.isActive = true;
    existing.order = 1;
    existing.updatedBy = admin._id;
    await existing.save();
    console.log(
      `Updated Day 1 quiz "${existing.title}" with ${QUESTIONS.length} questions (quizId: ${existing._id})`
    );
  } else {
    const quiz = await SOSQuiz.create({
      programId: program._id,
      createdBy: admin._id,
      dayNumber: 1,
      title: QUIZ_TITLE,
      description: QUIZ_DESCRIPTION,
      isActive: true,
      order: 1,
      questions: QUESTIONS,
    });
    console.log(
      `Created Day 1 quiz "${quiz.title}" with ${QUESTIONS.length} questions (quizId: ${quiz._id})`
    );
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
