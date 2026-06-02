import express from "express";
import { upload, uploadJobImage, uploadAndSetJobImage, createJob, getJob, getJobs, updateJob, deleteJob, getApplications, getAllApplications, updateApplicationStatus } from "./job.admin.controller.js";
import { listOpportunityFilters, createOpportunityFilter, deleteOpportunityFilter } from "./opportunityFilter.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticate, isAdmin);

router.post("/image/upload", upload.single("file"), uploadJobImage);
router.post("/", createJob);
router.get("/", getJobs);
// Specific routes before parameterised ones to avoid conflicts
router.get("/applications", getAllApplications);
router.put("/applications/:applicationId/status", updateApplicationStatus);
// Opportunity filter options (admin-managed lists for the Doers tab)
router.get("/filters", listOpportunityFilters);
router.post("/filters", createOpportunityFilter);
router.delete("/filters/:id", deleteOpportunityFilter);
router.get("/:jobId/applications", getApplications);
router.post("/:jobId/image", upload.single("file"), uploadAndSetJobImage);
router.get("/:jobId", getJob);
router.put("/:jobId", updateJob);
router.delete("/:jobId", deleteJob);

export default router;
