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
    jobImage: { type: String, default: "" },
    // Opportunity filter attributes (values come from admin-managed OpportunityFilter options)
    opportunityType: { type: String, trim: true, default: "" },
    duration: { type: String, trim: true, default: "" },
    timeline: { type: String, trim: true, default: "" },
    opportunityLocation: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    applicationCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    postedByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    postedByName: { type: String, trim: true, default: "" },
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "APPROVED",
      index: true,
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, select: false },
    deletedAt: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

jobPostSchema.index({ createdAt: -1 });
jobPostSchema.index({ isActive: 1, createdAt: -1 });

export const liveJobFilter = () => ({ isActive: true, approvalStatus: { $nin: ["PENDING", "REJECTED"] } });

jobPostSchema.pre("validate", function (next) {
  if (!this.createdBy && !this.postedByUser) {
    return next(new Error("An opportunity needs an admin or member as its creator"));
  }
  next();
});

jobPostSchema.pre(/^find/, function () {
  if (!this.getQuery().hasOwnProperty("isDeleted")) {
    this.where({ isDeleted: false });
  }
});

const JobPost = mongoose.model("JobPost", jobPostSchema);
export default JobPost;
