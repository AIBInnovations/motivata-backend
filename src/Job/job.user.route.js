import express from "express";
import { getJobs, applyToJob, getMyApplications } from "./job.user.controller.js";
import { authenticate, optionalAuth } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuth, getJobs);
router.post("/:jobId/apply", authenticate, applyToJob);
router.get("/my-applications", authenticate, getMyApplications);

export default router;
