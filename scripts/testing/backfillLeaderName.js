import dotenv from "dotenv";
import mongoose from "mongoose";

import Challenge from "../../src/Challenge/challenge.schema.js";

dotenv.config();

const APPLY = process.env.APPLY === "yes";
const DEFAULT_LEADER = "Motivata";

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 25000 });
  console.log(`connected to: ${mongoose.connection.db.databaseName}`);

  const filter = {
    $or: [{ leaderName: { $exists: false } }, { leaderName: null }, { leaderName: "" }],
  };

  const total = await Challenge.countDocuments({});
  const missing = await Challenge.countDocuments(filter);

  console.log(`challenges total   : ${total}`);
  console.log(`missing leaderName : ${missing}`);

  if (!missing) {
    console.log("nothing to do");
  } else if (!APPLY) {
    const sample = await Challenge.find(filter).select("title category").limit(5).lean();
    console.log("\ndry run — would set leaderName to:", DEFAULT_LEADER);
    sample.forEach((c) => console.log(`  ${c.category} · ${c.title}`));
    if (missing > sample.length) console.log(`  ... and ${missing - sample.length} more`);
    console.log("\nre-run with APPLY=yes to write");
  } else {
    const result = await Challenge.updateMany(filter, { $set: { leaderName: DEFAULT_LEADER } });
    console.log(`\nupdated ${result.modifiedCount} challenges`);
    const left = await Challenge.countDocuments(filter);
    console.log(`still missing: ${left}`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
