/**
 * @fileoverview Motivata Blend controller
 * Handles registration requests for weekly Wednesday Motivata Blend sessions
 * @module controllers/motivataBlend
 */

import MotivataBlendRequest from '../../schema/MotivataBlendRequest.schema.js';
import responseUtil from '../../utils/response.util.js';

// Helper function to normalize phone number
const normalizePhone = (phone) => {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
};

/**
 * Submit a Motivata Blend registration request
 * @route POST /api/web/motivata-blend/requests
 * @access Public
 */
export const submitMotivataBlendRequest = async (req, res) => {
  try {
    const { phone, name, email } = req.body;

    console.log('[MOTIVATA-BLEND] New request submission');
    console.log('[MOTIVATA-BLEND] Name:', name, 'Email:', email);

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

    // Validate email
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!email || !emailRegex.test(email)) {
      return responseUtil.badRequest(
        res,
        'Valid email address is required.'
      );
    }

    // Check for duplicate request within 7 days
    const duplicateRequest = await MotivataBlendRequest.checkDuplicateRequest(
      normalizedPhone,
      email.toLowerCase()
    );

    if (duplicateRequest) {
      console.log('[MOTIVATA-BLEND] Duplicate request found within 7 days');
      const daysSince = Math.ceil(
        (new Date() - duplicateRequest.submittedAt) / (1000 * 60 * 60 * 24)
      );

      return responseUtil.conflict(
        res,
        `You have already submitted a request ${daysSince} day(s) ago. Please wait 7 days before submitting another request.`,
        {
          existingRequestId: duplicateRequest._id,
          submittedAt: duplicateRequest.submittedAt,
          status: duplicateRequest.status
        }
      );
    }

    // Create new request
    const request = new MotivataBlendRequest({
      phone: normalizedPhone,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      submittedAt: new Date()
    });

    await request.save();

    console.log('[MOTIVATA-BLEND] Request created successfully:', request._id);

    return responseUtil.created(
      res,
      'Motivata Blend request submitted successfully',
      {
        requestId: request._id,
        phone: request.phone,
        name: request.name,
        email: request.email,
        status: request.status,
        submittedAt: request.submittedAt.toISOString()
      }
    );
  } catch (error) {
    console.error('[MOTIVATA-BLEND] Error submitting request:', error.message);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message
      }));
      return responseUtil.validationError(res, 'Validation failed', errors);
    }

    return responseUtil.internalError(
      res,
      'Failed to submit Motivata Blend request',
      error.message
    );
  }
};

export default {
  submitMotivataBlendRequest
};
