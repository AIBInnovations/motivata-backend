import mongoose from "mongoose";

const jobApplicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    coverLetter: { type: String, trim: true, maxlength: 3000, default: "" },
    resumeUrl: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "REVIEWED", "SHORTLISTED", "REJECTED", "HIRED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ job: 1, user: 1 }, { unique: true });
jobApplicationSchema.index({ job: 1, createdAt: -1 });

const JobApplication = mongoose.model("JobApplication", jobApplicationSchema);
export default JobApplication;
