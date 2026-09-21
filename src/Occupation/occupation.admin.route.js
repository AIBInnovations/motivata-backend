import express from "express";
import {
  listOccupationCategories,
  createOccupationCategory,
  updateOccupationCategory,
  deleteOccupationCategory,
} from "./occupation.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate, isAdmin);

router.get("/", listOccupationCategories);
router.post("/", createOccupationCategory);
router.put("/:id", updateOccupationCategory);
router.delete("/:id", deleteOccupationCategory);

export default router;
