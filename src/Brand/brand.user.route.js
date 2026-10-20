import express from "express";
import { listBrandsUser, listBrandCategoriesUser, getBrandUser } from "./brand.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  validateParams,
  validateQuery,
  brandSchemas,
} from "../../middleware/validation.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", validateQuery(brandSchemas.listUser), listBrandsUser);

router.get("/categories", listBrandCategoriesUser);

router.get("/:brandId", validateParams(brandSchemas.brandId), getBrandUser);

export default router;
