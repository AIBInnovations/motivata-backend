import express from "express";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import { previewBroadcast, sendBroadcast } from "./broadcast.controller.js";

const router = express.Router();

router.use(authenticate, isAdmin);

router.get("/audience", previewBroadcast);
router.post("/send", sendBroadcast);

export default router;
