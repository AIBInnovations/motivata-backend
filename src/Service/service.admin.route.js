/**
 * @fileoverview Admin service routes
 * Handles admin routes for service, service order, subscription, and request management
 * @module routes/admin/service
 */

import express from "express";
import {
  validateBody,
  validateParams,
  validateQuery,
  serviceSchemas,
  serviceOrderSchemas,
  serviceRequestSchemas,
  userServiceSubscriptionSchemas,
} from "../../middleware/validation.middleware.js";
import {
  // Service CRUD
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  // Service orders
  generatePaymentLink,
  getAllServiceOrders,
  getServiceOrderById,
  resendPaymentLink,
  // Service requests
  getAllServiceRequests,
  getServiceRequestById,
  approveServiceRequest,
  rejectServiceRequest,
  // Subscriptions
  getAllSubscriptions,
  getSubscriptionById,
  checkSubscriptionStatus,
  cancelSubscription,
  updateSubscriptionNotes,
} from "./service.controller.js";

const router = express.Router();

/**
 * SERVICE ROUTES (Admin)
 */

/**
 * @route   POST /api/web/services
 * @desc    Create new service
 * @access  Admin
 */
router.post(
  "/services",
  validateBody(serviceSchemas.create),
  createService
);

/**
 * @route   GET /api/web/services
 * @desc    Get all services
 * @access  Admin
 */
router.get(
  "/services",
  validateQuery(serviceSchemas.list),
  getAllServices
);

/**
 * @route   GET /api/web/services/:id
 * @desc    Get single service by ID
 * @access  Admin
 */
router.get(
  "/services/:id",
  validateParams(serviceSchemas.serviceId),
  getServiceById
);

/**
 * @route   PUT /api/web/services/:id
 * @desc    Update service
 * @access  Admin
 */
router.put(
  "/services/:id",
  validateParams(serviceSchemas.serviceId),
  validateBody(serviceSchemas.update),
  updateService
);

/**
 * @route   DELETE /api/web/services/:id
 * @desc    Delete service (soft delete)
 * @access  Admin
 */
router.delete(
  "/services/:id",
  validateParams(serviceSchemas.serviceId),
  deleteService
);

/**
 * SERVICE ORDER ROUTES (Admin)
 */

/**
 * @route   POST /api/web/service-orders/generate-payment-link
 * @desc    Generate payment link for service order (admin-initiated flow)
 * @access  Admin
 */
router.post(
  "/service-orders/generate-payment-link",
  validateBody(serviceOrderSchemas.generatePaymentLink),
  generatePaymentLink
);

/**
 * @route   GET /api/web/service-orders
 * @desc    Get all service orders
 * @access  Admin
 */
router.get(
  "/service-orders",
  validateQuery(serviceOrderSchemas.list),
  getAllServiceOrders
);

/**
 * @route   GET /api/web/service-orders/:id
 * @desc    Get single service order by ID
 * @access  Admin
 */
router.get(
  "/service-orders/:id",
  validateParams(serviceOrderSchemas.orderId),
  getServiceOrderById
);

/**
 * @route   POST /api/web/service-orders/:id/resend
 * @desc    Resend payment link via WhatsApp
 * @access  Admin
 */
router.post(
  "/service-orders/:id/resend",
  validateParams(serviceOrderSchemas.orderId),
  resendPaymentLink
);

/**
 * SERVICE REQUEST ROUTES (Admin - for user-initiated requests)
 */

/**
 * @route   GET /api/web/service-requests
 * @desc    Get all service requests
 * @access  Admin
 */
router.get(
  "/service-requests",
  validateQuery(serviceRequestSchemas.list),
  getAllServiceRequests
);

/**
 * @route   GET /api/web/service-requests/:id
 * @desc    Get single service request by ID
 * @access  Admin
 */
router.get(
  "/service-requests/:id",
  validateParams(serviceRequestSchemas.requestId),
  getServiceRequestById
);

/**
 * @route   POST /api/web/service-requests/:id/approve
 * @desc    Approve service request (generates payment link and sends via WhatsApp)
 * @access  Admin
 */
router.post(
  "/service-requests/:id/approve",
  validateParams(serviceRequestSchemas.requestId),
  validateBody(serviceRequestSchemas.approve),
  approveServiceRequest
);

/**
 * @route   POST /api/web/service-requests/:id/reject
 * @desc    Reject service request
 * @access  Admin
 */
router.post(
  "/service-requests/:id/reject",
  validateParams(serviceRequestSchemas.requestId),
  validateBody(serviceRequestSchemas.reject),
  rejectServiceRequest
);

/**
 * USER SUBSCRIPTION ROUTES (Admin)
 */

/**
 * @route   GET /api/web/user-subscriptions
 * @desc    Get all user service subscriptions
 * @access  Admin
 */
router.get(
  "/user-subscriptions",
  validateQuery(userServiceSubscriptionSchemas.list),
  getAllSubscriptions
);

/**
 * @route   POST /api/web/user-subscriptions/check-status
 * @desc    Check subscription status by phone
 * @access  Admin
 */
router.post(
  "/user-subscriptions/check-status",
  validateBody(userServiceSubscriptionSchemas.checkStatus),
  checkSubscriptionStatus
);

/**
 * @route   GET /api/web/user-subscriptions/:id
 * @desc    Get single subscription by ID
 * @access  Admin
 */
router.get(
  "/user-subscriptions/:id",
  validateParams(userServiceSubscriptionSchemas.subscriptionId),
  getSubscriptionById
);

/**
 * @route   POST /api/web/user-subscriptions/:id/cancel
 * @desc    Cancel subscription
 * @access  Admin
 */
router.post(
  "/user-subscriptions/:id/cancel",
  validateParams(userServiceSubscriptionSchemas.subscriptionId),
  validateBody(userServiceSubscriptionSchemas.cancel),
  cancelSubscription
);

/**
 * @route   PATCH /api/web/user-subscriptions/:id/notes
 * @desc    Update admin notes for subscription
 * @access  Admin
 */
router.patch(
  "/user-subscriptions/:id/notes",
  validateParams(userServiceSubscriptionSchemas.subscriptionId),
  validateBody(userServiceSubscriptionSchemas.updateNotes),
  updateSubscriptionNotes
);

export default router;
