import mongoose from "mongoose";

const dailySosAnswerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailySOSQuestion",
      required: [true, "Question ID is required"],
    },

    dateKey: {
      type: String,
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },

    answer: {
      type: mongoose.Schema.Types.Mixed,
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

dailySosAnswerSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
dailySosAnswerSchema.index({ userId: 1, answeredAt: -1 });
dailySosAnswerSchema.index({ questionId: 1 });

dailySosAnswerSchema.statics.findForUserOnDate = function (userId, dateKey) {
  return this.findOne({ userId, dateKey });
};

const DailySOSAnswer = mongoose.model("DailySOSAnswer", dailySosAnswerSchema);

export default DailySOSAnswer;
