/**
 * @fileoverview Seed script to create a Day 1 quiz for the Generic SOS (GSOS) program
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

async function seed() {
  await mongoose.connect(MONGODB_URL);
  console.log("Connected to MongoDB");

  // Find the GSOS program
  const program = await SOSProgram.findOne({ type: "GSOS", isDeleted: { $ne: true } });
  if (!program) {
    console.error("No GSOS program found. Create a GSOS program first.");
    process.exit(1);
  }
  console.log(`Found GSOS program: "${program.title}" (${program._id})`);

  // Check if a quiz already exists for day 1
  const existing = await SOSQuiz.findOne({ programId: program._id, dayNumber: 1, isDeleted: { $ne: true } });
  if (existing) {
    console.log(`Quiz already exists for Day 1 of "${program.title}" (quizId: ${existing._id}). Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  // Use the first admin as the creator
  const Admin = mongoose.model("Admin", new mongoose.Schema({}, { strict: false }), "admins");
  const admin = await Admin.findOne({});
  if (!admin) {
    console.error("No admin found in the database.");
    process.exit(1);
  }

  // Create the Day 1 quiz
  const quiz = await SOSQuiz.create({
    programId: program._id,
    createdBy: admin._id,
    dayNumber: 1,
    title: "Day 1 – Self-Organisation Check-In",
    description: "A quick reflection to kick off your Self-Organisation journey.",
    isActive: true,
    order: 1,
    questions: [
      {
        questionText: "How would you rate your current level of self-organisation?",
        questionType: "scale",
        options: [
          { text: "Very Poor", value: 1, order: 0 },
          { text: "Poor",      value: 2, order: 1 },
          { text: "Average",   value: 3, order: 2 },
          { text: "Good",      value: 4, order: 3 },
          { text: "Excellent", value: 5, order: 4 },
        ],
        isRequired: true,
        order: 0,
        points: 10,
      },
      {
        questionText: "What is the biggest obstacle that prevents you from staying organised?",
        questionType: "single-choice",
        options: [
          { text: "Lack of time",          value: "time",          order: 0 },
          { text: "Too many distractions", value: "distractions",  order: 1 },
          { text: "No clear priorities",   value: "priorities",    order: 2 },
          { text: "Procrastination",        value: "procrastination", order: 3 },
          { text: "Other",                 value: "other",         order: 4 },
        ],
        isRequired: true,
        order: 1,
        points: 10,
      },
      {
        questionText: "Describe one habit you would like to build during this programme.",
        questionType: "text",
        isRequired: true,
        order: 2,
        points: 10,
      },
    ],
  });

  console.log(`Created quiz "${quiz.title}" for Day 1 of "${program.title}" (quizId: ${quiz._id})`);
  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
