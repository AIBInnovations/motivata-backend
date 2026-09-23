import express from "express";
import {
  listWeeklyUpdates,
  deleteWeeklyUpdate,
  listHelpRequests,
  resolveHelpRequest,
  deleteHelpRequest,
} from "./community.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate, isAdmin);

router.get("/weekly-updates", listWeeklyUpdates);
router.delete("/weekly-updates/:id", deleteWeeklyUpdate);
router.get("/help-requests", listHelpRequests);
router.post("/help-requests/:id/resolve", resolveHelpRequest);
router.delete("/help-requests/:id", deleteHelpRequest);

export default router;
