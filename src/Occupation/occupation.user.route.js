import express from "express";
import { listOccupationCategories } from "./occupation.controller.js";
import { optionalAuth } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", optionalAuth, listOccupationCategories);

export default router;
