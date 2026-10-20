import express from "express";
import {
  createBrand,
  listBrandsAdmin,
  getBrandAdmin,
  updateBrand,
  deleteBrand,
} from "./brand.controller.js";
import { authenticate, isAdmin } from "../../middleware/auth.middleware.js";
import { requirePage } from "../../middleware/adminPage.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
  brandSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

router.use(authenticate);
router.use(isAdmin);
router.use(requirePage("brands"));

router.post("/", validateBody(brandSchemas.create), createBrand);

router.get("/", validateQuery(brandSchemas.listAdmin), listBrandsAdmin);

router.get("/:brandId", validateParams(brandSchemas.brandId), getBrandAdmin);

router.put(
  "/:brandId",
  validateParams(brandSchemas.brandId),
  validateBody(brandSchemas.update),
  updateBrand
);

router.delete("/:brandId", validateParams(brandSchemas.brandId), deleteBrand);

export default router;
