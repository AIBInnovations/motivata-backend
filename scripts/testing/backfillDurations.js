import dotenv from "dotenv";
import mongoose from "mongoose";

import Challenge from "../../src/Challenge/challenge.schema.js";

dotenv.config();

const APPLY = process.env.APPLY === "yes";
const ALLOWED = [7, 14, 21, 30, 45];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URL, { serverSelectionTimeoutMS: 25000 });
  console.log(`connected to: ${mongoose.connection.db.databaseName}`);

  const filter = {
    allowedDurations: { $ne: ALLOWED, $exists: true, $not: { $size: 0 } },
  };
  const total = await Challenge.countDocuments({});
  const stale = await Challenge.countDocuments(filter);

  console.log(`challenges total : ${total}`);
  console.log(`to update        : ${stale}`);
  console.log(`target           : [${ALLOWED.join(", ")}]`);

  if (!stale) {
    console.log("nothing to do");
  } else if (!APPLY) {
    const sample = await Challenge.find(filter).select("title allowedDurations").limit(5).lean();
    sample.forEach((c) => console.log(`  ${c.title}: [${(c.allowedDurations || []).join(", ")}]`));
    console.log("\nre-run with APPLY=yes to write");
  } else {
    const result = await Challenge.updateMany(filter, { $set: { allowedDurations: ALLOWED } });
    console.log(`\nupdated ${result.modifiedCount} challenges`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
