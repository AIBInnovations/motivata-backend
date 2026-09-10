import mongoose from "mongoose";

const dailyChallengeCompletionSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    dailyChallengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyChallenge",
      required: true,
    },

    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

dailyChallengeCompletionSchema.index({ dateKey: 1, userId: 1 }, { unique: true });
dailyChallengeCompletionSchema.index({ dateKey: 1 });
dailyChallengeCompletionSchema.index({ userId: 1, completedAt: -1 });

const DailyChallengeCompletion = mongoose.model(
  "DailyChallengeCompletion",
  dailyChallengeCompletionSchema
);

export default DailyChallengeCompletion;
