import express from "express";
import { getJob, getJobs, applyToJob, getMyApplications } from "./job.user.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";

const router = express.Router();

// Specific routes before parameterised ones to avoid conflicts
router.get("/", optionalAuth, getJobs);
router.get("/my-applications", authenticate, getMyApplications);
router.get("/:jobId", optionalAuth, getJob);
router.post("/:jobId/apply", authenticate, applyToJob);

export default router;
