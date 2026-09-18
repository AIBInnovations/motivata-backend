import mongoose from "mongoose";

export const REFLECTION_QUESTIONS = [
  { key: "happy", text: "What made you happy today?" },
  { key: "grateful", text: "What were you grateful for today?" },
];

const dailyReflectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    questionKey: {
      type: String,
      enum: REFLECTION_QUESTIONS.map((q) => q.key),
      required: [true, "Question key is required"],
    },

    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    answer: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: [true, "Answer is required"],
    },

    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

dailyReflectionSchema.index({ userId: 1, dateKey: 1, questionKey: 1 }, { unique: true });
dailyReflectionSchema.index({ userId: 1, answeredAt: -1 });

const DailyReflection = mongoose.model("DailyReflection", dailyReflectionSchema);

export default DailyReflection;
