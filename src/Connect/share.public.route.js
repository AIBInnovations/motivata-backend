import express from "express";
import {
  getPostShareMeta,
  getEventShareMeta,
  getClubShareMeta,
  getUserShareMeta,
} from "./share.controller.js";

const router = express.Router();

router.get("/post/:id", getPostShareMeta);
router.get("/event/:idOrSlug", getEventShareMeta);
router.get("/club/:id", getClubShareMeta);
router.get("/user/:id", getUserShareMeta);

export default router;
