/**
 * @fileoverview Event Request controller
 * Handles invite-only event registration requests submitted by the public
 * @module controllers/eventRequest
 */

import EventRequest from '../../schema/EventRequest.schema.js';
import Event from '../../schema/Event.schema.js';
import responseUtil from '../../utils/response.util.js';
import { validateCouponForType } from '../Enrollment/coupon.controller.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * Submit an Event invite request
 * @route POST /api/web/event-requests/requests
 * @access Public
 */
export const submitEventRequest = async (req, res) => {
  try {
    const { phone, name, email, eventId, couponCode } = req.body;

    console.log('[EVENT-REQUEST] New request submission');
    console.log('[EVENT-REQUEST] Name:', name, 'Email:', email, 'EventId:', eventId);

    const normalizedPhone = normalizePhone(phone);

    // Validate phone
    if (!normalizedPhone || normalizedPhone.length !== 10) {
      return responseUtil.badRequest(
        res,
        'Invalid phone number. Please provide a 10-digit phone number.'
      );
    }

    // Validate name
    if (!name || name.trim().length < 2) {
      return responseUtil.badRequest(
        res,
        'Name is required and must be at least 2 characters.'
      );
    }

    // Validate email (optional — must be valid when provided)
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const normalizedEmail = email ? String(email).toLowerCase().trim() : null;
    if (normalizedEmail && !emailRegex.test(normalizedEmail)) {
      return responseUtil.badRequest(
        res,
        'Please provide a valid email address.'
      );
    }

    // Check that the event exists and is INVITE_ONLY
    const event = await Event.findOne({ _id: eventId, isDeleted: false });

    if (!event) {
      return responseUtil.notFound(res, 'Event not found.');
    }

    if (event.audience !== 'INVITE_ONLY') {
      return responseUtil.badRequest(
        res,
        'This event does not require an invite request.'
      );
    }

    // Check for an active (PENDING/APPROVED) duplicate request for this event
    const duplicateRequest = await EventRequest.checkDuplicateRequest(
      normalizedPhone,
      normalizedEmail,
      eventId
    );

    if (duplicateRequest) {
      console.log('[EVENT-REQUEST] Active duplicate request found for event:', eventId);

      const message =
        duplicateRequest.status === 'APPROVED'
          ? 'Your request for this event has already been approved.'
          : 'You already have a pending request for this event. Please wait for admin review.';

      return responseUtil.conflict(res, message, {
        existingRequestId: duplicateRequest._id,
        submittedAt: duplicateRequest.submittedAt,
        status: duplicateRequest.status
      });
    }

    let validatedCouponCode = null;
    if (couponCode) {
      const tiers = event.pricingTiers || [];
      const referenceAmount = tiers.length > 0
        ? Math.max(...tiers.map((tier) => tier.price))
        : event.price;

      if (referenceAmount == null || referenceAmount <= 0) {
        return responseUtil.badRequest(res, 'A coupon cannot be used for this event.');
      }

      const couponResult = await validateCouponForType(couponCode, referenceAmount, normalizedPhone, 'EVENT');
      if (!couponResult.isValid) {
        return responseUtil.badRequest(res, `Coupon error: ${couponResult.error}`);
      }
      validatedCouponCode = couponResult.coupon.code;
    }

    // Create new request
    const request = new EventRequest({
      eventId,
      phone: normalizedPhone,
      name: name.trim(),
      email: normalizedEmail,
      couponCode: validatedCouponCode,
      submittedAt: new Date()
    });

    await request.save();

    console.log('[EVENT-REQUEST] Request created successfully:', request._id);

    return responseUtil.created(
      res,
      'Event invite request submitted successfully',
      {
        requestId: request._id,
        eventId: request.eventId,
        phone: request.phone,
        name: request.name,
        email: request.email,
        couponCode: request.couponCode,
        status: request.status,
        submittedAt: request.submittedAt.toISOString()
      }
    );
  } catch (error) {
    console.error('[EVENT-REQUEST] Error submitting request:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(
      res,
      'Failed to submit event invite request',
      error.message
    );
  }
};

export default {
  submitEventRequest
};
