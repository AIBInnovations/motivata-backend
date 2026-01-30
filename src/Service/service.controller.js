/**
 * @fileoverview Service controller
 * Handles CRUD operations for services, service orders, subscriptions, and requests
 * @module controllers/service
 */

import Service from "../../schema/Service.schema.js";
import ServiceOrder from "../../schema/ServiceOrder.schema.js";
import UserServiceSubscription from "../../schema/UserServiceSubscription.schema.js";
import ServiceRequest from "../../schema/ServiceRequest.schema.js";
import User from "../../schema/User.schema.js";
import Payment from "../../schema/Payment.schema.js";
import responseUtil from "../../utils/response.util.js";
import { razorpayInstance } from "../../utils/razorpay.util.js";
import { sendServicePaymentLinkWhatsApp } from "../../utils/whatsapp.util.js";
import { validateCouponForType } from "../Enrollment/coupon.controller.js";

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.slice(-10);
};

/**
 * SERVICE CONTROLLERS
 */

/**
 * Create new service
 * Admin only
 * @route POST /api/web/services
 */
export const createService = async (req, res) => {
  try {
    console.log("[SERVICE] Creating new service");
    console.log("[SERVICE] Request body:", req.body);

    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      durationInDays,
      category,
      imageUrl,
      perks,
      maxSubscriptions,
      displayOrder,
      isFeatured,
      isActive,
      requiresApproval,
      metadata,
    } = req.body;

    const service = new Service({
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      durationInDays,
      category,
      imageUrl,
      perks,
      maxSubscriptions,
      displayOrder,
      isFeatured,
      isActive,
      requiresApproval,
      metadata,
    });

    await service.save();

    console.log("[SERVICE] Service created successfully:", service._id);

    return responseUtil.created(res, "Service created successfully", {
      service,
    });
  } catch (error) {
    console.error("[SERVICE] Error creating service:", error.message);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to create service",
      error.message
    );
  }
};

/**
 * Get all services
 * @route GET /api/web/services
 */
export const getAllServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "displayOrder",
      sortOrder = "asc",
      isActive,
      isFeatured,
      category,
      search,
    } = req.query;

    console.log(
      "[SERVICE] Fetching services - page:",
      page,
      "limit:",
      limit
    );

    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === "true";
    }

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [services, totalCount] = await Promise.all([
      Service.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Service.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log("[SERVICE] Found", services.length, "services out of", totalCount);

    return responseUtil.success(res, "Services fetched successfully", {
      services,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[SERVICE] Error fetching services:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch services",
      error.message
    );
  }
};

/**
 * Get single service by ID
 * @route GET /api/web/services/:id
 */
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[SERVICE] Fetching service:", id);

    const service = await Service.findById(id);

    if (!service) {
      console.log("[SERVICE] Service not found:", id);
      return responseUtil.notFound(res, "Service not found");
    }

    console.log("[SERVICE] Service found:", service.name);

    return responseUtil.success(res, "Service fetched successfully", {
      service,
    });
  } catch (error) {
    console.error("[SERVICE] Error fetching service:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid service ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch service",
      error.message
    );
  }
};

/**
 * Update service
 * @route PUT /api/web/services/:id
 */
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[SERVICE] Updating service:", id);
    console.log("[SERVICE] Update data:", req.body);

    const service = await Service.findById(id);

    if (!service) {
      return responseUtil.notFound(res, "Service not found");
    }

    const updateFields = [
      "name",
      "description",
      "shortDescription",
      "price",
      "compareAtPrice",
      "durationInDays",
      "category",
      "imageUrl",
      "perks",
      "maxSubscriptions",
      "displayOrder",
      "isFeatured",
      "isActive",
      "requiresApproval",
      "metadata",
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        service[field] = req.body[field];
      }
    });

    await service.save();

    console.log("[SERVICE] Service updated successfully:", service._id);

    return responseUtil.success(res, "Service updated successfully", {
      service,
    });
  } catch (error) {
    console.error("[SERVICE] Error updating service:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid service ID format");
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      }));
      return responseUtil.validationError(res, "Validation failed", errors);
    }

    return responseUtil.internalError(
      res,
      "Failed to update service",
      error.message
    );
  }
};

/**
 * Delete service (soft delete by setting isActive to false)
 * @route DELETE /api/web/services/:id
 */
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[SERVICE] Deleting service:", id);

    const service = await Service.findById(id);

    if (!service) {
      return responseUtil.notFound(res, "Service not found");
    }

    service.isActive = false;
    await service.save();

    console.log("[SERVICE] Service deleted successfully:", service._id);

    return responseUtil.success(res, "Service deleted successfully", {
      service,
    });
  } catch (error) {
    console.error("[SERVICE] Error deleting service:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid service ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to delete service",
      error.message
    );
  }
};

/**
 * SERVICE ORDER CONTROLLERS
 */

/**
 * Generate payment link for service order (Admin-initiated flow)
 * @route POST /api/web/service-orders/generate-payment-link
 */
export const generatePaymentLink = async (req, res) => {
  try {
    console.log("[SERVICE-ORDER] Generating payment link");
    console.log("[SERVICE-ORDER] Request body:", req.body);

    const { phone, customerName, serviceIds, adminNotes, sendWhatsApp = true } = req.body;
    const adminId = req.user?._id;

    const normalizedPhone = normalizePhone(phone);

    // Fetch services
    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
    });

    if (services.length !== serviceIds.length) {
      return responseUtil.badRequest(
        res,
        "One or more services not found or inactive"
      );
    }

    // Check if all services have available slots
    for (const service of services) {
      if (!service.hasAvailableSlots()) {
        return responseUtil.badRequest(
          res,
          `Service "${service.name}" has reached maximum subscriptions`
        );
      }
    }

    // Check if user exists
    const user = await User.findOne({ phone: normalizedPhone, isDeleted: false });
    const userExists = !!user;

    // Calculate total amount
    const totalAmount = services.reduce((sum, s) => sum + s.price, 0);

    // Generate unique order ID
    const orderId = ServiceOrder.generateOrderId();

    // Create payment link expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create Razorpay payment link
    const paymentLinkOptions = {
      amount: totalAmount * 100, // Amount in paise
      currency: "INR",
      accept_partial: false,
      description: `Service subscription: ${services.map((s) => s.name).join(", ")}`,
      customer: {
        name: customerName || user?.name || "Customer",
        email: user?.email || "",
        contact: `91${normalizedPhone}`,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: orderId,
        type: "SERVICE",
        phone: normalizedPhone,
      },
      callback_url: `${process.env.BASE_URL || "https://motivata.in"}/payment-success`,
      callback_method: "get",
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId,
    };

    console.log("[SERVICE-ORDER] Creating Razorpay payment link:", paymentLinkOptions);

    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);

    console.log("[SERVICE-ORDER] Payment link created:", paymentLink.id);

    // Create service order record
    const serviceOrder = new ServiceOrder({
      phone: normalizedPhone,
      customerName: customerName || user?.name,
      services: services.map((s) => ({
        serviceId: s._id,
        serviceName: s.name,
        price: s.price,
        durationInDays: s.durationInDays,
      })),
      totalAmount,
      source: "ADMIN",
      adminId,
      orderId,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.short_url,
      paymentLinkShortUrl: paymentLink.short_url,
      expiresAt,
      userExists,
      userId: user?._id || null,
      adminNotes,
    });

    await serviceOrder.save();

    console.log("[SERVICE-ORDER] Service order created:", serviceOrder._id);

    // Create Payment record for webhook processing
    const payment = new Payment({
      orderId: orderId,
      type: "SERVICE",
      phone: normalizedPhone,
      userId: user?._id || null,
      serviceOrderId: serviceOrder._id,
      amount: totalAmount,
      finalAmount: totalAmount,
      status: "PENDING",
      metadata: {
        serviceOrderId: serviceOrder._id.toString(),
        serviceIds: serviceIds,
        serviceNames: services.map((s) => s.name),
        paymentLinkId: paymentLink.id,
        source: "ADMIN",
      },
    });

    await payment.save();
    console.log("[SERVICE-ORDER] Payment record created:", payment._id);

    // Send WhatsApp message if requested
    if (sendWhatsApp) {
      try {
        const serviceNames = services.map((s) => s.name).join(", ");
        await sendServicePaymentLinkWhatsApp({
          phone: normalizedPhone,
          serviceName: serviceNames,
          paymentLink: paymentLink.short_url,
          amount: totalAmount,
          serviceOrderId: serviceOrder._id.toString(),
        });

        serviceOrder.whatsappSent = true;
        serviceOrder.whatsappSentAt = new Date();
        await serviceOrder.save();

        console.log("[SERVICE-ORDER] WhatsApp message sent successfully");
      } catch (whatsappError) {
        console.error("[SERVICE-ORDER] WhatsApp error:", whatsappError.message);
        // Don't fail the request if WhatsApp fails
      }
    }

    return responseUtil.created(res, "Payment link generated successfully", {
      serviceOrder,
      paymentLink: paymentLink.short_url,
      userExists,
    });
  } catch (error) {
    console.error("[SERVICE-ORDER] Error generating payment link:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to generate payment link",
      error.message
    );
  }
};

/**
 * Get all service orders
 * @route GET /api/web/service-orders
 */
export const getAllServiceOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      source,
      phone,
      search,
    } = req.query;

    console.log("[SERVICE-ORDER] Fetching orders - page:", page, "limit:", limit);

    const query = {};

    if (status) {
      query.status = status;
    }

    if (source) {
      query.source = source;
    }

    if (phone) {
      query.phone = normalizePhone(phone);
    }

    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: "i" } },
        { orderId: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [orders, totalCount] = await Promise.all([
      ServiceOrder.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("adminId", "name username")
        .populate("userId", "name phone email"),
      ServiceOrder.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Service orders fetched successfully", {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[SERVICE-ORDER] Error fetching orders:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch service orders",
      error.message
    );
  }
};

/**
 * Get single service order by ID
 * @route GET /api/web/service-orders/:id
 */
export const getServiceOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await ServiceOrder.findById(id)
      .populate("adminId", "name username")
      .populate("userId", "name phone email")
      .populate("services.serviceId");

    if (!order) {
      return responseUtil.notFound(res, "Service order not found");
    }

    return responseUtil.success(res, "Service order fetched successfully", {
      order,
    });
  } catch (error) {
    console.error("[SERVICE-ORDER] Error fetching order:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid order ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch service order",
      error.message
    );
  }
};

/**
 * Resend payment link via WhatsApp
 * @route POST /api/web/service-orders/:id/resend
 */
export const resendPaymentLink = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await ServiceOrder.findById(id);

    if (!order) {
      return responseUtil.notFound(res, "Service order not found");
    }

    if (order.status !== "PENDING") {
      return responseUtil.badRequest(
        res,
        `Cannot resend link for ${order.status} order`
      );
    }

    if (!order.paymentLinkUrl) {
      return responseUtil.badRequest(res, "No payment link available");
    }

    // Check if link has expired
    if (new Date() > order.expiresAt) {
      return responseUtil.badRequest(res, "Payment link has expired");
    }

    const serviceNames = order.services.map((s) => s.serviceName).join(", ");
    await sendServicePaymentLinkWhatsApp({
      phone: order.phone,
      serviceName: serviceNames,
      paymentLink: order.paymentLinkShortUrl || order.paymentLinkUrl,
      amount: order.totalAmount,
      serviceOrderId: order._id.toString(),
    });

    order.whatsappSent = true;
    order.whatsappSentAt = new Date();
    await order.save();

    return responseUtil.success(res, "Payment link resent successfully", {
      order,
    });
  } catch (error) {
    console.error("[SERVICE-ORDER] Error resending link:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to resend payment link",
      error.message
    );
  }
};

/**
 * SERVICE REQUEST CONTROLLERS (User-initiated flow)
 */

/**
 * Get all service requests
 * @route GET /api/web/service-requests
 */
export const getAllServiceRequests = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      userExists,
      search,
    } = req.query;

    console.log("[SERVICE-REQUEST] Fetching requests - page:", page, "limit:", limit);

    const query = {};

    if (status) {
      query.status = status;
    }

    if (userExists !== undefined) {
      query.userExists = userExists === "true";
    }

    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [requests, totalCount] = await Promise.all([
      ServiceRequest.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "name phone email")
        .populate("reviewedBy", "name username")
        .populate("services.serviceId"),
      ServiceRequest.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    // Get pending count
    const pendingCount = await ServiceRequest.getPendingCount();

    return responseUtil.success(res, "Service requests fetched successfully", {
      requests,
      pendingCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[SERVICE-REQUEST] Error fetching requests:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch service requests",
      error.message
    );
  }
};

/**
 * Get single service request by ID
 * @route GET /api/web/service-requests/:id
 */
export const getServiceRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ServiceRequest.findById(id)
      .populate("userId", "name phone email")
      .populate("reviewedBy", "name username")
      .populate("services.serviceId");

    if (!request) {
      return responseUtil.notFound(res, "Service request not found");
    }

    return responseUtil.success(res, "Service request fetched successfully", {
      request,
    });
  } catch (error) {
    console.error("[SERVICE-REQUEST] Error fetching request:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid request ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch service request",
      error.message
    );
  }
};

/**
 * Approve service request (generates payment link and sends via WhatsApp)
 * @route POST /api/web/service-requests/:id/approve
 */
export const approveServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, sendWhatsApp = true, alternativePhone, alternativeEmail, contactPreference } = req.body;
    const adminId = req.user?._id;

    // Normalize and validate contactPreference
    let normalizedContactPreference = contactPreference;
    if (!normalizedContactPreference || !Array.isArray(normalizedContactPreference) || normalizedContactPreference.length === 0) {
      normalizedContactPreference = ['REGISTERED']; // Default to registered contact
    }

    console.log("[SERVICE-REQUEST] Approving request:", id);
    console.log("[SERVICE-REQUEST] Contact preference:", normalizedContactPreference);

    const request = await ServiceRequest.findById(id).populate("services.serviceId");

    if (!request) {
      return responseUtil.notFound(res, "Service request not found");
    }

    if (request.status !== "PENDING") {
      return responseUtil.badRequest(
        res,
        `Cannot approve ${request.status} request`
      );
    }

    // Check if all services have available slots
    for (const serviceItem of request.services) {
      const service = await Service.findById(serviceItem.serviceId);
      if (!service || !service.isActive) {
        return responseUtil.badRequest(
          res,
          `Service "${serviceItem.serviceName}" is no longer available`
        );
      }
      if (!service.hasAvailableSlots()) {
        return responseUtil.badRequest(
          res,
          `Service "${serviceItem.serviceName}" has reached maximum subscriptions`
        );
      }
    }

    // Generate payment link
    const orderId = ServiceOrder.generateOrderId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const paymentLinkOptions = {
      amount: request.totalAmount * 100,
      currency: "INR",
      accept_partial: false,
      description: `Service subscription: ${request.getServiceNamesString()}`,
      customer: {
        name: request.name || "Customer",
        email: request.email || "",
        contact: `91${request.phone}`,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: orderId,
        type: "SERVICE",
        phone: request.phone,
        serviceRequestId: request._id.toString(),
      },
      callback_url: `${process.env.BASE_URL || "https://motivata.in"}/payment-success`,
      callback_method: "get",
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId,
    };

    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);

    // Create service order
    const serviceOrder = new ServiceOrder({
      phone: request.phone,
      customerName: request.name,
      services: request.services.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        price: s.price,
        durationInDays: s.serviceId?.durationInDays || null,
      })),
      totalAmount: request.totalAmount,
      source: "USER_REQUEST",
      serviceRequestId: request._id,
      adminId,
      orderId,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.short_url,
      paymentLinkShortUrl: paymentLink.short_url,
      expiresAt,
      userExists: request.userExists,
      userId: request.userId,
      adminNotes,
      alternativePhone: alternativePhone || null,
      alternativeEmail: alternativeEmail || null,
      contactPreference: normalizedContactPreference,
    });

    await serviceOrder.save();

    // Create Payment record for webhook processing
    const payment = new Payment({
      orderId: orderId,
      type: "SERVICE",
      phone: request.phone,
      userId: request.userId || null,
      serviceOrderId: serviceOrder._id,
      amount: request.totalAmount,
      finalAmount: request.totalAmount,
      status: "PENDING",
      metadata: {
        serviceOrderId: serviceOrder._id.toString(),
        serviceRequestId: request._id.toString(),
        serviceNames: request.getServiceNamesString(),
        paymentLinkId: paymentLink.id,
        source: "USER_REQUEST",
      },
    });

    await payment.save();
    console.log("[SERVICE-REQUEST] Payment record created:", payment._id);

    // Update request status
    await request.approve(adminId, serviceOrder._id);
    if (adminNotes) {
      request.adminNotes = adminNotes;
      await request.save();
    }

    // Send payment link notifications
    let notificationResults = null;
    if (sendWhatsApp) {
      try {
        const { sendPaymentLinkNotifications } = await import('../../utils/notification.util.js');

        notificationResults = await sendPaymentLinkNotifications({
          registeredPhone: request.phone,
          registeredEmail: request.email,
          alternativePhone,
          alternativeEmail,
          contactPreference: normalizedContactPreference,
          serviceName: request.getServiceNamesString(),
          paymentLink: paymentLink.short_url,
          amount: request.totalAmount,
          customerName: request.name,
          orderId: serviceOrder._id.toString(),
        });

        // Mark WhatsApp as sent if any notifications succeeded
        if (notificationResults.whatsapp.sent.length > 0) {
          serviceOrder.whatsappSent = true;
          serviceOrder.whatsappSentAt = new Date();
          await serviceOrder.save();
        }

        console.log("[SERVICE-REQUEST] Notifications sent:", notificationResults);
      } catch (notificationError) {
        console.error("[SERVICE-REQUEST] Notification error:", notificationError.message);
      }
    }

    return responseUtil.success(res, "Service request approved successfully", {
      request,
      serviceOrder,
      paymentLink: paymentLink.short_url,
      notifications: notificationResults,
    });
  } catch (error) {
    console.error("[SERVICE-REQUEST] Error approving request:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to approve service request",
      error.message
    );
  }
};

/**
 * Reject service request
 * @route POST /api/web/service-requests/:id/reject
 */
export const rejectServiceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, adminNotes } = req.body;
    const adminId = req.user?._id;

    console.log("[SERVICE-REQUEST] Rejecting request:", id);

    const request = await ServiceRequest.findById(id);

    if (!request) {
      return responseUtil.notFound(res, "Service request not found");
    }

    if (request.status !== "PENDING") {
      return responseUtil.badRequest(
        res,
        `Cannot reject ${request.status} request`
      );
    }

    await request.reject(adminId, reason);
    if (adminNotes) {
      request.adminNotes = adminNotes;
      await request.save();
    }

    return responseUtil.success(res, "Service request rejected", { request });
  } catch (error) {
    console.error("[SERVICE-REQUEST] Error rejecting request:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to reject service request",
      error.message
    );
  }
};

/**
 * USER SERVICE SUBSCRIPTION CONTROLLERS
 */

/**
 * Get all user service subscriptions
 * @route GET /api/web/user-subscriptions
 */
export const getAllSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      serviceId,
      phone,
      search,
    } = req.query;

    console.log("[SUBSCRIPTION] Fetching subscriptions - page:", page, "limit:", limit);

    const query = {};

    if (status) {
      query.status = status;
    }

    if (serviceId) {
      query.serviceId = serviceId;
    }

    if (phone) {
      query.phone = normalizePhone(phone);
    }

    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [subscriptions, totalCount] = await Promise.all([
      UserServiceSubscription.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("serviceId")
        .populate("userId", "name phone email")
        .populate("serviceOrderId")
        .populate("cancelledBy", "name username"),
      UserServiceSubscription.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return responseUtil.success(res, "Subscriptions fetched successfully", {
      subscriptions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[SUBSCRIPTION] Error fetching subscriptions:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch subscriptions",
      error.message
    );
  }
};

/**
 * Get single subscription by ID
 * @route GET /api/web/user-subscriptions/:id
 */
export const getSubscriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const subscription = await UserServiceSubscription.findById(id)
      .populate("serviceId")
      .populate("userId", "name phone email")
      .populate("serviceOrderId")
      .populate("cancelledBy", "name username");

    if (!subscription) {
      return responseUtil.notFound(res, "Subscription not found");
    }

    return responseUtil.success(res, "Subscription fetched successfully", {
      subscription,
    });
  } catch (error) {
    console.error("[SUBSCRIPTION] Error fetching subscription:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid subscription ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch subscription",
      error.message
    );
  }
};

/**
 * Check subscription status for a phone
 * @route POST /api/web/user-subscriptions/check-status
 */
export const checkSubscriptionStatus = async (req, res) => {
  try {
    const { phone, serviceId } = req.body;

    const normalizedPhone = normalizePhone(phone);

    let subscriptions;
    if (serviceId) {
      const hasActive = await UserServiceSubscription.hasActiveSubscription(
        normalizedPhone,
        serviceId
      );
      subscriptions = hasActive
        ? await UserServiceSubscription.find({
            phone: normalizedPhone,
            serviceId,
            status: "ACTIVE",
          }).populate("serviceId")
        : [];
    } else {
      subscriptions = await UserServiceSubscription.findActiveByPhone(normalizedPhone);
    }

    // Check if user exists
    const user = await User.findOne({ phone: normalizedPhone, isDeleted: false });

    return responseUtil.success(res, "Subscription status fetched", {
      phone: normalizedPhone,
      userExists: !!user,
      userId: user?._id || null,
      userName: user?.name || null,
      hasActiveSubscription: subscriptions.length > 0,
      subscriptions,
    });
  } catch (error) {
    console.error("[SUBSCRIPTION] Error checking status:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to check subscription status",
      error.message
    );
  }
};

/**
 * Cancel subscription
 * @route POST /api/web/user-subscriptions/:id/cancel
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?._id;

    const subscription = await UserServiceSubscription.findById(id);

    if (!subscription) {
      return responseUtil.notFound(res, "Subscription not found");
    }

    if (subscription.status !== "ACTIVE") {
      return responseUtil.badRequest(
        res,
        `Cannot cancel ${subscription.status} subscription`
      );
    }

    await subscription.cancel(reason, adminId);

    // Decrement service active subscription count
    const service = await Service.findById(subscription.serviceId);
    if (service) {
      await service.decrementActiveSubscriptionCount();
    }

    return responseUtil.success(res, "Subscription cancelled successfully", {
      subscription,
    });
  } catch (error) {
    console.error("[SUBSCRIPTION] Error cancelling subscription:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to cancel subscription",
      error.message
    );
  }
};

/**
 * Update subscription admin notes
 * @route PATCH /api/web/user-subscriptions/:id/notes
 */
export const updateSubscriptionNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const subscription = await UserServiceSubscription.findById(id);

    if (!subscription) {
      return responseUtil.notFound(res, "Subscription not found");
    }

    subscription.adminNotes = adminNotes;
    await subscription.save();

    return responseUtil.success(res, "Notes updated successfully", {
      subscription,
    });
  } catch (error) {
    console.error("[SUBSCRIPTION] Error updating notes:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to update notes",
      error.message
    );
  }
};

/**
 * USER-FACING CONTROLLERS
 */

/**
 * Get all active services for users
 * @route GET /api/app/services
 */
export const getUserServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "displayOrder",
      sortOrder = "asc",
      isFeatured,
      category,
      search,
      requiresApproval,
    } = req.query;

    console.log("[USER-SERVICE] Fetching active services for users");

    const query = { isActive: true };

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === "true";
    }

    if (category) {
      query.category = category;
    }

    if (requiresApproval !== undefined) {
      query.requiresApproval = requiresApproval === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    const [services, totalCount] = await Promise.all([
      Service.find(query).sort(sort).skip(skip).limit(parseInt(limit)),
      Service.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log("[USER-SERVICE] Found", services.length, "services");

    return responseUtil.success(res, "Services fetched successfully", {
      services,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("[USER-SERVICE] Error fetching services:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to fetch services",
      error.message
    );
  }
};

/**
 * Get single service details for users
 * @route GET /api/app/services/:id
 */
export const getUserServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("[USER-SERVICE] Fetching service:", id);

    const service = await Service.findOne({ _id: id, isActive: true });

    if (!service) {
      return responseUtil.notFound(res, "Service not found");
    }

    return responseUtil.success(res, "Service fetched successfully", {
      service,
    });
  } catch (error) {
    console.error("[USER-SERVICE] Error fetching service:", error.message);

    if (error.name === "CastError") {
      return responseUtil.badRequest(res, "Invalid service ID format");
    }

    return responseUtil.internalError(
      res,
      "Failed to fetch service",
      error.message
    );
  }
};

/**
 * Validate coupon for service purchase
 * User access - allows users to preview discount before purchase
 * @route POST /api/app/services/validate-coupon
 */
export const validateServiceCoupon = async (req, res) => {
  const logPrefix = "[SERVICE-COUPON-PREVIEW]";
  const startTime = Date.now();

  console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST START ==========`);

  try {
    const { couponCode, serviceIds, phone } = req.body;
    const userPhone = req.user?.phone || phone;

    console.log(`${logPrefix} Request details:`, {
      couponCode: couponCode?.toUpperCase() || "N/A",
      serviceIds: serviceIds?.length || 0,
      phone: userPhone ? `***${userPhone.slice(-4)}` : "N/A",
    });

    // Validate input
    if (!couponCode) {
      console.log(`${logPrefix} [FAIL] Missing coupon code`);
      return responseUtil.badRequest(res, "Coupon code is required");
    }

    if (!serviceIds || serviceIds.length === 0) {
      console.log(`${logPrefix} [FAIL] Missing service IDs`);
      return responseUtil.badRequest(res, "At least one service is required");
    }

    // Fetch services
    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
    });

    if (services.length !== serviceIds.length) {
      console.log(`${logPrefix} [FAIL] One or more services not found or inactive`);
      return responseUtil.badRequest(res, "One or more services not found or inactive");
    }

    // Calculate total amount
    const totalAmount = services.reduce((sum, s) => sum + s.price, 0);

    console.log(`${logPrefix} Total amount for ${services.length} service(s): Rs.${totalAmount}`);

    const normalizedPhone = userPhone ? normalizePhone(userPhone) : null;

    // Validate the coupon
    console.log(`${logPrefix} Calling coupon validation service...`);
    const validation = await validateCouponForType(
      couponCode,
      totalAmount,
      normalizedPhone,
      "SERVICE"
    );

    if (!validation.isValid) {
      console.log(`${logPrefix} [RESULT] Coupon validation FAILED: ${validation.error}`);
      console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
      return responseUtil.badRequest(res, validation.error);
    }

    // Success response
    const responseData = {
      isValid: true,
      originalAmount: totalAmount,
      discountPercent: validation.coupon.discountPercent,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      coupon: {
        code: validation.coupon.code,
        description: validation.coupon.description,
        validUntil: validation.coupon.validUntil,
      },
      services: services.map((s) => ({
        _id: s._id,
        name: s.name,
        price: s.price,
      })),
    };

    console.log(`${logPrefix} [RESULT] Coupon validation SUCCESSFUL`);
    console.log(`${logPrefix} Preview summary:`, {
      couponCode: validation.coupon.code,
      originalPrice: `Rs.${totalAmount}`,
      discount: `Rs.${validation.discountAmount} (${validation.coupon.discountPercent}%)`,
      finalPrice: `Rs.${validation.finalAmount}`,
    });
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    console.log(`${logPrefix} ========== COUPON PREVIEW REQUEST END (SUCCESS) ==========`);

    return responseUtil.success(res, "Coupon is valid", responseData);
  } catch (error) {
    console.error(`${logPrefix} [ERROR] Exception occurred:`, error.message);
    console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
    return responseUtil.internalError(res, "Failed to validate coupon", error.message);
  }
};

/**
 * Create direct purchase (without admin approval)
 * @route POST /api/app/services/purchase
 */
export const createDirectPurchase = async (req, res) => {
  const logPrefix = "[DIRECT-PURCHASE]";
  const startTime = Date.now();
  const requestId = `PURCHASE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`${logPrefix} ========== CREATE DIRECT PURCHASE START ==========`);
  console.log(`${logPrefix} Request ID: ${requestId}`);

  try {
    const { phone, customerName, serviceIds, couponCode, alternativePhone, alternativeEmail, contactPreference } = req.body;
    const userId = req.user?._id;

    // Normalize and validate contactPreference
    let normalizedContactPreference = contactPreference;
    if (!normalizedContactPreference || !Array.isArray(normalizedContactPreference) || normalizedContactPreference.length === 0) {
      normalizedContactPreference = ['REGISTERED']; // Default to registered contact
    }

    const normalizedPhone = normalizePhone(phone);
    console.log(`${logPrefix} Contact preference:`, normalizedContactPreference);

    // Fetch services
    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
      requiresApproval: false, // Only allow direct purchase for non-approval services
    });

    if (services.length !== serviceIds.length) {
      return responseUtil.badRequest(
        res,
        "One or more services not found, inactive, or require admin approval"
      );
    }

    // Check if all services have available slots
    for (const service of services) {
      if (!service.hasAvailableSlots()) {
        return responseUtil.badRequest(
          res,
          `Service "${service.name}" has reached maximum subscriptions`
        );
      }
    }

    // Check if user exists
    const user = await User.findOne({ phone: normalizedPhone, isDeleted: false });
    const userExists = !!user;

    // Calculate amounts
    const originalAmount = services.reduce((sum, s) => sum + s.price, 0);
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let appliedCouponCode = null;
    let couponDetails = null;

    console.log(`${logPrefix} Request details:`, {
      phone: normalizedPhone ? `***${normalizedPhone.slice(-4)}` : "N/A",
      serviceIds: serviceIds?.length || 0,
      couponCode: couponCode?.toUpperCase() || "None",
      originalAmount: `Rs.${originalAmount}`,
    });

    // Process coupon (if provided)
    if (couponCode) {
      console.log(`${logPrefix} [COUPON] Processing coupon: ${couponCode.toUpperCase()}`);

      const couponValidation = await validateCouponForType(
        couponCode,
        originalAmount,
        normalizedPhone,
        "SERVICE"
      );

      if (!couponValidation.isValid) {
        console.log(`${logPrefix} [COUPON] Validation failed: ${couponValidation.error}`);
        console.log(`${logPrefix} Duration: ${Date.now() - startTime}ms`);
        return responseUtil.badRequest(res, couponValidation.error);
      }

      // Coupon is valid - apply discount
      discountAmount = couponValidation.discountAmount;
      finalAmount = couponValidation.finalAmount;
      appliedCouponCode = couponValidation.coupon.code;
      couponDetails = couponValidation.coupon;

      console.log(`${logPrefix} [COUPON] Applied successfully:`, {
        code: appliedCouponCode,
        originalAmount: `Rs.${originalAmount}`,
        discountAmount: `Rs.${discountAmount}`,
        finalAmount: `Rs.${finalAmount}`,
      });
    } else {
      console.log(`${logPrefix} No coupon code provided - proceeding with full price: Rs.${originalAmount}`);
    }

    // Generate unique order ID
    const orderId = ServiceOrder.generateOrderId();

    // Create payment link expiry (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create Razorpay payment link with FINAL AMOUNT (after discount)
    const paymentLinkOptions = {
      amount: Math.round(finalAmount * 100), // Amount in paise - USE finalAmount
      currency: "INR",
      accept_partial: false,
      description: `Service: ${services.map((s) => s.name).join(", ")}`,
      customer: {
        name: customerName || user?.name || "Customer",
        email: user?.email || "",
        contact: `91${normalizedPhone}`,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        orderId: orderId,
        type: "SERVICE",
        phone: normalizedPhone,
        couponCode: appliedCouponCode || "", // ADD couponCode to notes
      },
      callback_url: `${process.env.BASE_URL || "https://motivata.in"}/payment-success`,
      callback_method: "get",
      expire_by: Math.floor(expiresAt.getTime() / 1000),
      reference_id: orderId,
    };

    console.log(`${logPrefix} Creating Razorpay payment link - Amount: Rs.${finalAmount}`);

    const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkOptions);

    console.log(`${logPrefix} Payment link created: ${paymentLink.id}`);

    // Create service order record WITH COUPON DETAILS
    const serviceOrder = new ServiceOrder({
      phone: normalizedPhone,
      customerName: customerName || user?.name,
      services: services.map((s) => ({
        serviceId: s._id,
        serviceName: s.name,
        price: s.price,
        durationInDays: s.durationInDays,
      })),
      totalAmount: originalAmount, // Keep for backward compatibility
      originalAmount, // NEW: Original amount before discount
      couponCode: appliedCouponCode, // NEW: Coupon code used
      discountAmount, // NEW: Discount amount
      finalAmount, // NEW: Final amount after discount
      source: "DIRECT_PURCHASE",
      adminId: null,
      orderId,
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.short_url,
      paymentLinkShortUrl: paymentLink.short_url,
      expiresAt,
      userExists,
      userId: user?._id || null,
      alternativePhone: alternativePhone || null,
      alternativeEmail: alternativeEmail || null,
      contactPreference: normalizedContactPreference,
    });

    await serviceOrder.save();

    console.log(`${logPrefix} Service order created: ${serviceOrder._id}`);

    // Create Payment record for webhook processing WITH COUPON DETAILS
    const payment = new Payment({
      orderId: orderId,
      type: "SERVICE",
      phone: normalizedPhone,
      userId: user?._id || null,
      serviceOrderId: serviceOrder._id,
      amount: originalAmount, // Original amount before discount
      couponCode: appliedCouponCode, // NEW: Coupon code
      discountAmount, // NEW: Discount amount
      finalAmount, // Final amount (what user pays)
      status: "PENDING",
      metadata: {
        serviceOrderId: serviceOrder._id.toString(),
        serviceIds: serviceIds,
        serviceNames: services.map((s) => s.name),
        paymentLinkId: paymentLink.id,
        source: "DIRECT_PURCHASE",
        couponDetails: couponDetails, // NEW: Store coupon details
      },
    });

    await payment.save();
    console.log(`${logPrefix} Payment record created: ${payment._id}`);

    // Send payment link notifications
    let notificationResults = null;
    try {
      console.log(`${logPrefix} Sending payment link notifications...`);
      const { sendPaymentLinkNotifications } = await import('../../utils/notification.util.js');

      notificationResults = await sendPaymentLinkNotifications({
        registeredPhone: normalizedPhone,
        registeredEmail: user?.email,
        alternativePhone,
        alternativeEmail,
        contactPreference: normalizedContactPreference,
        serviceName: services.map(s => s.name).join(', '),
        paymentLink: paymentLink.short_url,
        amount: finalAmount,
        customerName: customerName || user?.name,
        orderId
      });

      console.log(`${logPrefix} Notifications sent:`, notificationResults);
    } catch (error) {
      console.error(`${logPrefix} Notification error:`, error.message);
      // Don't fail the purchase if notifications fail
    }

    console.log(`${logPrefix} ========== CREATE DIRECT PURCHASE END (SUCCESS) ==========`);

    return responseUtil.created(res, "Payment link created successfully", {
      serviceOrder: {
        _id: serviceOrder._id,
        orderId: serviceOrder.orderId,
        services: serviceOrder.services,
        originalAmount, // NEW: Return original amount
        discountAmount, // NEW: Return discount amount
        finalAmount, // NEW: Return final amount
        couponApplied: appliedCouponCode, // NEW: Return coupon code
        expiresAt: serviceOrder.expiresAt,
      },
      paymentLink: paymentLink.short_url,
      notifications: notificationResults,
    });
  } catch (error) {
    console.error(`${logPrefix} Error creating purchase:`, error.message);
    return responseUtil.internalError(
      res,
      "Failed to create purchase",
      error.message
    );
  }
};

/**
 * Create service request (for approval-required services)
 * @route POST /api/app/service-requests
 */
export const createServiceRequest = async (req, res) => {
  try {
    console.log("[SERVICE-REQUEST] Creating service request");
    console.log("[SERVICE-REQUEST] Request body:", req.body);

    const { phone, name, email, serviceIds, userNote } = req.body;
    const userId = req.user?._id;

    const normalizedPhone = normalizePhone(phone);

    // Fetch services
    const services = await Service.find({
      _id: { $in: serviceIds },
      isActive: true,
    });

    if (services.length !== serviceIds.length) {
      return responseUtil.badRequest(
        res,
        "One or more services not found or inactive"
      );
    }

    // Check if user exists
    const user = await User.findOne({ phone: normalizedPhone, isDeleted: false });
    const userExists = !!user;

    // Calculate total amount
    const totalAmount = services.reduce((sum, s) => sum + s.price, 0);

    // Create service request
    const serviceRequest = new ServiceRequest({
      phone: normalizedPhone,
      name: name || user?.name,
      email: email || user?.email,
      services: services.map((s) => ({
        serviceId: s._id,
        serviceName: s.name,
        price: s.price,
      })),
      totalAmount,
      userExists,
      userId: user?._id || null,
      userNote,
      status: "PENDING",
    });

    await serviceRequest.save();

    console.log("[SERVICE-REQUEST] Service request created:", serviceRequest._id);

    return responseUtil.created(res, "Service request submitted successfully", {
      serviceRequest,
    });
  } catch (error) {
    console.error("[SERVICE-REQUEST] Error creating request:", error.message);
    return responseUtil.internalError(
      res,
      "Failed to create service request",
      error.message
    );
  }
};

/**
 * Get user's service requests
 * @route GET /api/app/service-requests
 */
export const getUserServiceRequests = async (req, res) => {
  try {
    const { phone } = req.query;
    const userId = req.user?._id;

    console.log("[SERVICE-REQUEST] Fetching user service requests");

    let query = {};

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      query.phone = normalizedPhone;
    } else if (userId) {
      query.userId = userId;
    } else {
      return responseUtil.badRequest(
        res,
        "Phone number or user ID is required"
      );
    }

    const serviceRequests = await ServiceRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("services.serviceId", "name imageUrl category");

    return responseUtil.success(
      res,
      "Service requests fetched successfully",
      {
        serviceRequests,
      }
    );
  } catch (error) {
    console.error(
      "[SERVICE-REQUEST] Error fetching requests:",
      error.message
    );
    return responseUtil.internalError(
      res,
      "Failed to fetch service requests",
      error.message
    );
  }
};

/**
 * Get user's active subscriptions
 * @route GET /api/app/subscriptions
 */
export const getUserSubscriptions = async (req, res) => {
  try {
    const { phone } = req.query;
    const userId = req.user?._id;

    console.log("[USER-SUBSCRIPTION] Fetching user subscriptions");

    let subscriptions;

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      subscriptions = await UserServiceSubscription.findActiveByPhone(
        normalizedPhone
      );
    } else if (userId) {
      subscriptions = await UserServiceSubscription.findActiveByUserId(userId);
    } else {
      return responseUtil.badRequest(
        res,
        "Phone number or user ID is required"
      );
    }

    return responseUtil.success(res, "Subscriptions fetched successfully", {
      subscriptions,
    });
  } catch (error) {
    console.error(
      "[USER-SUBSCRIPTION] Error fetching subscriptions:",
      error.message
    );
    return responseUtil.internalError(
      res,
      "Failed to fetch subscriptions",
      error.message
    );
  }
};

export default {
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
  // User-facing
  getUserServices,
  getUserServiceById,
  validateServiceCoupon,
  createDirectPurchase,
  createServiceRequest,
  getUserServiceRequests,
  getUserSubscriptions,
};
