import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.config.js';
import Event from '../schema/Event.schema.js';

dotenv.config();

const apply = process.argv.includes('--apply');

const backfillEventSlugs = async () => {
  try {
    await connectDB();
    console.log(`[MIGRATION] Connected. Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);

    const events = await Event.find({
      isDeleted: { $in: [true, false] },
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
    })
      .select('_id name isDeleted isLive startDate')
      .lean();

    events.sort((a, b) =>
      Number(Boolean(a.isDeleted)) - Number(Boolean(b.isDeleted))
      || Number(Boolean(b.isLive)) - Number(Boolean(a.isLive))
      || new Date(b.startDate || 0) - new Date(a.startDate || 0)
    );

    console.log(`[MIGRATION] Events without a slug: ${events.length}`);

    const planned = new Set();
    let written = 0;

    for (const event of events) {
      let slug = await Event.generateUniqueSlug(event.name, event._id);
      let suffix = 2;
      const base = slug;
      while (planned.has(slug)) {
        slug = `${base}-${suffix}`;
        suffix += 1;
      }
      planned.add(slug);

      console.log(`  ${event._id}  ${event.isDeleted ? '(deleted) ' : event.isLive ? '(live) ' : ''}"${event.name}" → ${slug}`);

      if (apply) {
        await Event.updateOne({ _id: event._id }, { $set: { slug } });
        written += 1;
      }
    }

    console.log(apply ? `[MIGRATION] Done. ${written} event(s) updated.` : '[MIGRATION] Dry run only. Re-run with --apply to write.');
  } catch (error) {
    console.error('[MIGRATION] Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

backfillEventSlugs();
