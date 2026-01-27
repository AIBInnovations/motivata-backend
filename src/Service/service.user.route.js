/**
 * @fileoverview User service routes
 * Handles user-facing routes for service browsing and direct purchase
 * @module routes/user/service
 */

import express from "express";
import {
  validateBody,
  validateParams,
  validateQuery,
  serviceSchemas,
  serviceOrderSchemas,
  serviceRequestSchemas,
} from "../../middleware/validation.middleware.js";
import {
  getUserServices,
  getUserServiceById,
  validateServiceCoupon,
  createDirectPurchase,
  getUserServiceRequests,
  createServiceRequest,
  getUserSubscriptions,
} from "./service.controller.js";

const router = express.Router();

/**
 * SERVICE ROUTES (User)
 */

/**
 * @route   GET /api/app/services
 * @desc    Get all active services (user-facing)
 * @access  Public/User
 */
router.get(
  "/",
  validateQuery(serviceSchemas.list),
  getUserServices
);

/**
 * @route   POST /api/app/services/validate-coupon
 * @desc    Validate coupon for service purchase (preview discount)
 * @access  Public/User
 */
router.post(
  "/validate-coupon",
  validateBody(serviceOrderSchemas.validateServiceCoupon),
  validateServiceCoupon
);

/**
 * @route   POST /api/app/services/purchase
 * @desc    Direct purchase of services (without approval)
 * @access  User
 */
router.post(
  "/purchase",
  validateBody(serviceOrderSchemas.directPurchase),
  createDirectPurchase
);

/**
 * @route   GET /api/app/services/:id
 * @desc    Get single service details by ID
 * @access  Public/User
 */
router.get(
  "/:id",
  validateParams(serviceSchemas.serviceId),
  getUserServiceById
);

/**
 * SERVICE REQUEST ROUTES (User)
 */

/**
 * @route   POST /api/app/service-requests
 * @desc    Create service request (for approval-required services)
 * @access  User
 */
router.post(
  "/requests",
  validateBody(serviceOrderSchemas.createServiceRequest),
  createServiceRequest
);

/**
 * @route   GET /api/app/service-requests
 * @desc    Get user's service requests
 * @access  User
 */
router.get(
  "/requests",
  validateQuery(serviceRequestSchemas.userList),
  getUserServiceRequests
);

/**
 * SUBSCRIPTION ROUTES (User)
 */

/**
 * @route   GET /api/app/subscriptions
 * @desc    Get user's active subscriptions
 * @access  User
 */
router.get(
  "/subscriptions",
  getUserSubscriptions
);

export default router;
