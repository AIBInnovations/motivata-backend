import JobPost, { liveJobFilter } from "../../schema/JobPost.schema.js";
import JobApplication from "../../schema/JobApplication.schema.js";
import User from "../../schema/User.schema.js";
import responseUtil from "../../utils/response.util.js";
import { getAccessTier } from "../../middleware/membership.middleware.js";

const JOB_TYPES = ["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"];

const formatJob = (job, hasApplied = false) => ({
  id: job._id,
  title: job.title,
  company: job.company,
  location: job.location,
  type: job.type,
  description: job.description,
  requirements: job.requirements,
  salary: job.salary,
  deadline: job.deadline,
  jobImage: job.jobImage || "",
  opportunityType: job.opportunityType || "",
  duration: job.duration || "",
  timeline: job.timeline || "",
  opportunityLocation: job.opportunityLocation || "",
  applicationCount: job.applicationCount,
  postedByName: job.postedByName || "Motivata",
  isMemberPost: !!job.postedByUser,
  hasApplied,
  createdAt: job.createdAt,
});

// Get single active job post
export const getJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user?.id;

    const job = await JobPost.findOne({ _id: jobId, ...liveJobFilter() });
    if (!job) return responseUtil.notFound(res, "Job not found");

    let hasApplied = false;
    if (userId) {
      const applied = await JobApplication.findOne({ job: jobId, user: userId });
      hasApplied = !!applied;
    }

    return responseUtil.success(res, "Job fetched", { job: formatJob(job, hasApplied) });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch job", error.message);
  }
};

// Get active job posts
export const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = req.user?.id;
    const filter = liveJobFilter();

    const [jobs, total, viewerTier] = await Promise.all([
      JobPost.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      // countDocuments does NOT trigger the pre(/^find/) soft-delete filter,
      // so exclude removed jobs explicitly — otherwise the total never drops.
      JobPost.countDocuments({ ...filter, isDeleted: false }),
      getAccessTier(req.user),
    ]);

    // Check which jobs user has already applied to
    let appliedJobIds = new Set();
    if (userId) {
      const applied = await JobApplication.find({ user: userId, job: { $in: jobs.map(j => j._id) } }).select("job");
      appliedJobIds = new Set(applied.map(a => a.job.toString()));
    }

    return responseUtil.success(res, "Jobs fetched", {
      jobs: jobs.map((job) => formatJob(job, appliedJobIds.has(job._id.toString()))),
      viewerCanApply: viewerTier !== "NONE",
      viewerCanPost: viewerTier === "MEMBER" || viewerTier === "ADMIN",
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalCount: total,
      },
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch jobs", error.message);
  }
};

// Apply to a job
export const applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { name, email, phone, coverLetter, resumeUrl } = req.body;
    const userId = req.user.id;

    const tier = await getAccessTier(req.user);
    if (tier === "NONE") {
      return responseUtil.forbidden(res, "Only Doers and Members can apply to opportunities. Become a Doer to apply.");
    }

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return responseUtil.badRequest(res, "Name, email, and phone are required");
    }

    const job = await JobPost.findOne({ _id: jobId, ...liveJobFilter() });
    if (!job) return responseUtil.notFound(res, "Job not found or no longer active");

    if (job.postedByUser && job.postedByUser.toString() === userId) {
      return responseUtil.badRequest(res, "You cannot apply to an opportunity you posted");
    }

    const existing = await JobApplication.findOne({ job: jobId, user: userId });
    if (existing) return responseUtil.conflict(res, "You have already applied to this job");

    const application = new JobApplication({
      job: jobId,
      user: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      coverLetter: coverLetter?.trim() || "",
      resumeUrl: resumeUrl?.trim() || "",
    });

    await application.save();
    await JobPost.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });

    return responseUtil.created(res, "Application submitted successfully", { application });
  } catch (error) {
    if (error.code === 11000) return responseUtil.conflict(res, "You have already applied to this job");
    return responseUtil.internalError(res, "Failed to submit application", error.message);
  }
};

// Get user's own applications
export const getMyApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const applications = await JobApplication.find({ user: userId })
      .populate("job", "title company location type isActive")
      .sort({ createdAt: -1 });

    return responseUtil.success(res, "Your applications fetched", { applications });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch applications", error.message);
  }
};

export const createMemberJob = async (req, res) => {
  try {
    const tier = await getAccessTier(req.user);
    if (tier !== "MEMBER" && tier !== "ADMIN") {
      return responseUtil.forbidden(res, "Only Members can post opportunities.");
    }

    const {
      title, company, location, type, description, requirements, salary, deadline,
      opportunityType, duration, timeline, opportunityLocation,
    } = req.body || {};

    if (!title?.trim() || !company?.trim() || !location?.trim() || !description?.trim()) {
      return responseUtil.badRequest(res, "Title, organisation, location and description are required");
    }
    if (!JOB_TYPES.includes(type)) {
      return responseUtil.badRequest(res, "Choose a valid opportunity type");
    }
    if (title.trim().length > 200 || company.trim().length > 200 || description.trim().length > 5000) {
      return responseUtil.badRequest(res, "One or more fields are too long");
    }

    const deadlineDate = deadline ? new Date(deadline) : null;
    if (deadlineDate && Number.isNaN(deadlineDate.getTime())) {
      return responseUtil.badRequest(res, "Invalid deadline");
    }

    const user = await User.findById(req.user.id).select("name").lean();

    const job = await JobPost.create({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      type,
      description: description.trim(),
      requirements: requirements?.trim() || "",
      salary: salary?.trim() || "",
      deadline: deadlineDate,
      opportunityType: opportunityType?.trim() || "",
      duration: duration?.trim() || "",
      timeline: timeline?.trim() || "",
      opportunityLocation: opportunityLocation?.trim() || "",
      postedByUser: req.user.id,
      postedByName: user?.name || "Member",
      approvalStatus: "PENDING",
    });

    return responseUtil.created(res, "Opportunity sent for admin approval", {
      job: { ...formatJob(job), approvalStatus: job.approvalStatus },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return responseUtil.badRequest(res, error.message);
    }
    return responseUtil.internalError(res, "Failed to post opportunity", error.message);
  }
};

export const getMyPostedJobs = async (req, res) => {
  try {
    const jobs = await JobPost.find({ postedByUser: req.user.id }).sort({ createdAt: -1 }).limit(50);
    return responseUtil.success(res, "Your opportunities fetched", {
      jobs: jobs.map((job) => ({
        ...formatJob(job),
        approvalStatus: job.approvalStatus,
        rejectionReason: job.rejectionReason || "",
        isActive: job.isActive,
      })),
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch your opportunities", error.message);
  }
};

export default { getJobs, applyToJob, getMyApplications, createMemberJob, getMyPostedJobs };
