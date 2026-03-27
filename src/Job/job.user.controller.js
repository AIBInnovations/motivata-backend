import JobPost from "../../schema/JobPost.schema.js";
import JobApplication from "../../schema/JobApplication.schema.js";
import responseUtil from "../../utils/response.util.js";

// Get active job posts
export const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const userId = req.user?.id;

    const [jobs, total] = await Promise.all([
      JobPost.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobPost.countDocuments({ isActive: true }),
    ]);

    // Check which jobs user has already applied to
    let appliedJobIds = new Set();
    if (userId) {
      const applied = await JobApplication.find({ user: userId, job: { $in: jobs.map(j => j._id) } }).select("job");
      appliedJobIds = new Set(applied.map(a => a.job.toString()));
    }

    const jobsWithStatus = jobs.map(job => ({
      id: job._id,
      title: job.title,
      company: job.company,
      location: job.location,
      type: job.type,
      description: job.description,
      requirements: job.requirements,
      salary: job.salary,
      deadline: job.deadline,
      applicationCount: job.applicationCount,
      hasApplied: appliedJobIds.has(job._id.toString()),
      createdAt: job.createdAt,
    }));

    return responseUtil.success(res, "Jobs fetched", {
      jobs: jobsWithStatus,
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

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return responseUtil.badRequest(res, "Name, email, and phone are required");
    }

    const job = await JobPost.findById(jobId);
    if (!job || !job.isActive) return responseUtil.notFound(res, "Job not found or no longer active");

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

export default { getJobs, applyToJob, getMyApplications };
