import mongoose from "mongoose";

const jobPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    company: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"],
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    requirements: { type: String, trim: true, maxlength: 3000, default: "" },
    salary: { type: String, trim: true, maxlength: 200, default: "" },
    deadline: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    applicationCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

jobPostSchema.index({ createdAt: -1 });
jobPostSchema.index({ isActive: 1, createdAt: -1 });

jobPostSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

const JobPost = mongoose.model("JobPost", jobPostSchema);
export default JobPost;
