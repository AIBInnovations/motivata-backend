import express from "express";
import {
  getCommunityMeta,
  listWeeklyUpdates,
  createWeeklyUpdate,
  deleteWeeklyUpdate,
  listHelpRequests,
  createHelpRequest,
  resolveHelpRequest,
  deleteHelpRequest,
} from "./community.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/meta", getCommunityMeta);
router.get("/weekly-updates", listWeeklyUpdates);
router.post("/weekly-updates", createWeeklyUpdate);
router.delete("/weekly-updates/:id", deleteWeeklyUpdate);
router.get("/help-requests", listHelpRequests);
router.post("/help-requests", createHelpRequest);
router.post("/help-requests/:id/resolve", resolveHelpRequest);
router.delete("/help-requests/:id", deleteHelpRequest);

export default router;
