import express from "express";
import { createJob, getJobs, updateJob, deleteJob, getApplications, getAllApplications, updateApplicationStatus } from "./job.admin.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticate, isAdmin);

router.post("/", createJob);
router.get("/", getJobs);
router.put("/:jobId", updateJob);
router.delete("/:jobId", deleteJob);
router.get("/applications", getAllApplications);
router.get("/:jobId/applications", getApplications);
router.put("/applications/:applicationId/status", updateApplicationStatus);

export default router;
