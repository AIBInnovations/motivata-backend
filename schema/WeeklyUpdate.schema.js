import mongoose from "mongoose";

export const WEEKLY_UPDATE_TAGS = ["ACHIEVEMENT", "MILESTONE", "GENERAL", "INFORMATION"];

export const WEEKLY_UPDATE_MAX_CHARS = 500;

const weeklyUpdateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorName: { type: String, trim: true, default: "" },
    tag: { type: String, enum: WEEKLY_UPDATE_TAGS, required: true },
    text: {
      type: String,
      trim: true,
      required: [true, "Update text is required"],
      maxlength: [WEEKLY_UPDATE_MAX_CHARS, `Update cannot exceed ${WEEKLY_UPDATE_MAX_CHARS} characters`],
    },
    linkUrl: {
      type: String,
      trim: true,
      default: "",
      match: [/^$|^https?:\/\/\S+$/i, "Link must start with http:// or https://"],
    },
    weekKey: { type: String, required: true },
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

weeklyUpdateSchema.index({ user: 1, weekKey: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
weeklyUpdateSchema.index({ createdAt: -1 });

weeklyUpdateSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

const WeeklyUpdate = mongoose.model("WeeklyUpdate", weeklyUpdateSchema);
export default WeeklyUpdate;
