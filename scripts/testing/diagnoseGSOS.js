/**
 * @fileoverview READ-ONLY diagnostic for the "Quiz not available for today" issue
 * on the Generic SOS (GSOS) program. Reports the GSOS program(s), their day quizzes
 * (with isActive/isDeleted flags), and a summary of user progress by currentDay/status.
 *
 * Does NOT modify anything.
 *
 * Usage:
 *   node scripts/testing/diagnoseGSOS.js
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
import UserSOSProgress from "../../src/Quiz/schemas/userSOSProgress.schema.js";

async function diagnose() {
  await mongoose.connect(MONGODB_URL);
  console.log("✅ Connected to MongoDB\n");

  // 1) GSOS program(s) — bypass any default filters by querying raw.
  const programs = await SOSProgram.find({ type: "GSOS" })
    .select("_id title type durationDays isActive isDeleted")
    .lean();

  console.log(`📋 GSOS programs found: ${programs.length}`);
  for (const p of programs) {
    console.log(
      `   • "${p.title}" id=${p._id} duration=${p.durationDays} isActive=${p.isActive} isDeleted=${p.isDeleted}`
    );

    // 2) ALL quizzes for this program (raw, including inactive/deleted).
    const quizzes = await SOSQuiz.find({ programId: p._id })
      .select("dayNumber title isActive isDeleted questions")
      .lean();

    console.log(`     Quizzes: ${quizzes.length}`);
    quizzes
      .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))
      .forEach((q) => {
        const qCount = Array.isArray(q.questions) ? q.questions.length : 0;
        const findable = q.isActive === true && q.isDeleted !== true;
        console.log(
          `       - day ${q.dayNumber}: "${q.title}" questions=${qCount} isActive=${q.isActive} isDeleted=${q.isDeleted} ${findable ? "✅ findByDay OK" : "❌ HIDDEN from findByDay"}`
        );
      });

    // 3) User progress summary for this program.
    const ProgressModel = UserSOSProgress;
    if (ProgressModel) {
      const progress = await ProgressModel.find({ programId: p._id })
        .select("userId status currentDay")
        .lean();
      console.log(`     User progress docs: ${progress.length}`);
      const byKey = {};
      progress.forEach((pr) => {
        const key = `status=${pr.status} currentDay=${pr.currentDay}`;
        byKey[key] = (byKey[key] || 0) + 1;
      });
      Object.entries(byKey).forEach(([k, c]) => console.log(`       - ${k} : ${c} user(s)`));
    }
    console.log();
  }

  if (programs.length === 0) {
    console.log("❌ No GSOS program exists. The app cannot load a Generic SOS quiz at all.");
  }

  await mongoose.disconnect();
  console.log("📡 Disconnected.");
}

diagnose().catch((err) => {
  console.error("❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
