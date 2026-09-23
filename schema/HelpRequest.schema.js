import mongoose from "mongoose";

export const HELP_REQUEST_TAGS = ["GENERAL", "EMERGENCY"];

const helpRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authorName: { type: String, trim: true, default: "" },
    tag: { type: String, enum: HELP_REQUEST_TAGS, required: true, default: "GENERAL" },
    title: {
      type: String,
      trim: true,
      required: [true, "Title is required"],
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    deadline: { type: Date, default: null },
    contactName: { type: String, trim: true, default: "", maxlength: 100 },
    contactPhone: { type: String, trim: true, default: "", maxlength: 20 },
    contactEmail: { type: String, trim: true, lowercase: true, default: "", maxlength: 200 },
    city: { type: String, trim: true, default: "", maxlength: 100 },
    status: { type: String, enum: ["OPEN", "RESOLVED"], default: "OPEN", index: true },
    resolvedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

helpRequestSchema.index({ status: 1, tag: 1, createdAt: -1 });

helpRequestSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

const HelpRequest = mongoose.model("HelpRequest", helpRequestSchema);
export default HelpRequest;
