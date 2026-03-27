import JobPost from "../../schema/JobPost.schema.js";
import JobApplication from "../../schema/JobApplication.schema.js";
import responseUtil from "../../utils/response.util.js";

// Create job post
export const createJob = async (req, res) => {
  try {
    const { title, company, location, type, description, requirements, salary, deadline } = req.body;
    const adminId = req.user.id;

    if (!title?.trim() || !company?.trim() || !location?.trim() || !type || !description?.trim()) {
      return responseUtil.badRequest(res, "title, company, location, type, and description are required");
    }

    const job = new JobPost({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      type,
      description: description.trim(),
      requirements: requirements?.trim() || "",
      salary: salary?.trim() || "",
      deadline: deadline ? new Date(deadline) : null,
      createdBy: adminId,
    });

    await job.save();
    return responseUtil.created(res, "Job post created successfully", { job });
  } catch (error) {
    console.error("[JOB ADMIN] Create error:", error);
    return responseUtil.internalError(res, "Failed to create job post", error.message);
  }
};

// Get all job posts
export const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query = {};
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const [jobs, total] = await Promise.all([
      JobPost.find(query).populate("createdBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobPost.countDocuments(query),
    ]);

    return responseUtil.success(res, "Jobs fetched", {
      jobs,
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

// Update job post
export const updateJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    const allowed = ["title", "company", "location", "type", "description", "requirements", "salary", "deadline", "isActive"];
    const updateData = {};
    allowed.forEach(key => { if (updates[key] !== undefined) updateData[key] = updates[key]; });

    const job = await JobPost.findByIdAndUpdate(jobId, updateData, { new: true });
    if (!job) return responseUtil.notFound(res, "Job not found");
    return responseUtil.success(res, "Job updated", { job });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to update job", error.message);
  }
};

// Delete job post
export const deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await JobPost.findById(jobId);
    if (!job) return responseUtil.notFound(res, "Job not found");
    job.isDeleted = true;
    job.deletedAt = new Date();
    await job.save();
    return responseUtil.success(res, "Job deleted");
  } catch (error) {
    return responseUtil.internalError(res, "Failed to delete job", error.message);
  }
};

// Get applications for a job
export const getApplications = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query = { job: jobId };
    if (status) query.status = status;

    const [applications, total] = await Promise.all([
      JobApplication.find(query).populate("user", "name email phone").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobApplication.countDocuments(query),
    ]);

    return responseUtil.success(res, "Applications fetched", {
      applications,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalCount: total,
      },
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch applications", error.message);
  }
};

// Get all applications (across all jobs)
export const getAllApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query = {};
    if (status) query.status = status;

    const [applications, total] = await Promise.all([
      JobApplication.find(query)
        .populate("user", "name email phone")
        .populate("job", "title company")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      JobApplication.countDocuments(query),
    ]);

    return responseUtil.success(res, "Applications fetched", {
      applications,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalCount: total,
      },
    });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to fetch applications", error.message);
  }
};

// Update application status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const validStatuses = ["PENDING", "REVIEWED", "SHORTLISTED", "REJECTED", "HIRED"];
    if (!validStatuses.includes(status)) return responseUtil.badRequest(res, "Invalid status");

    const application = await JobApplication.findByIdAndUpdate(applicationId, { status }, { new: true })
      .populate("user", "name email phone")
      .populate("job", "title company");

    if (!application) return responseUtil.notFound(res, "Application not found");
    return responseUtil.success(res, "Application status updated", { application });
  } catch (error) {
    return responseUtil.internalError(res, "Failed to update status", error.message);
  }
};

export default { createJob, getJobs, updateJob, deleteJob, getApplications, getAllApplications, updateApplicationStatus };
