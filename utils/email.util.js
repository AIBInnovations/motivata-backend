/**
 * @fileoverview Email utility for sending emails using nodemailer
 * @module utils/email
 */

import nodemailer from 'nodemailer';
import CommunicationLog from '../schema/CommunicationLog.schema.js';

/**
 * Validate email configuration
 * @throws {Error} If email configuration is invalid
 */
const validateEmailConfig = () => {
  const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required email configuration: ${missing.join(', ')}`);
  }

  // Warn about placeholder values
  if (process.env.EMAIL_FROM.includes('yourdomain.com')) {
    console.warn('[EMAIL] ⚠ WARNING: EMAIL_FROM contains placeholder "yourdomain.com" - emails may fail!');
    console.warn('[EMAIL] Please update EMAIL_FROM in .env with a verified sender email from Brevo');
  }
};

/**
 * Create and configure nodemailer transporter
 * @returns {nodemailer.Transporter} Configured transporter instance
 */
const createTransporter = () => {
  validateEmailConfig();

  const config = {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  };

  console.log(`[EMAIL] Configuring transporter: ${config.host}:${config.port} (secure: ${config.secure})`);
  console.log(`[EMAIL] Using sender: ${process.env.EMAIL_FROM_NAME || 'Motivata'} <${process.env.EMAIL_FROM}>`);

  return nodemailer.createTransport(config);
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} [options.text] - Plain text version (optional)
 * @param {Array<Object>} [options.attachments] - Email attachments (optional)
 * @param {string} options.attachments[].filename - Attachment filename
 * @param {Buffer} options.attachments[].content - Attachment content as Buffer
 * @param {string} [options.attachments[].contentType] - MIME type (optional)
 * @param {string} [options.category] - Email category for logging (TICKET, VOUCHER, etc.)
 * @param {string} [options.eventId] - Related event ID for logging
 * @param {string} [options.orderId] - Related order ID for logging
 * @param {string} [options.userId] - Related user ID for logging
 * @param {string} [options.enrollmentId] - Related enrollment ID for logging
 * @param {string} [options.voucherId] - Related voucher ID for logging
 * @returns {Promise<Object>} Nodemailer send result
 * @throws {Error} If email sending fails
 */
export const sendEmail = async ({ to, subject, html, text, attachments, category, eventId, orderId, userId, enrollmentId, voucherId }) => {
  let communicationLog = null;

  try {
    // Create communication log entry (PENDING status)
    communicationLog = new CommunicationLog({
      type: 'EMAIL',
      category: category || 'TRANSACTIONAL',
      recipient: to,
      subject,
      status: 'PENDING',
      eventId: eventId || null,
      orderId: orderId || null,
      userId: userId || null,
      enrollmentId: enrollmentId || null,
      voucherId: voucherId || null,
      metadata: {
        hasAttachments: !!(attachments && attachments.length > 0),
        attachmentCount: attachments?.length || 0
      }
    });
    await communicationLog.save();

    console.log(`[EMAIL] Communication log created: ${communicationLog._id}`);
    // Validate recipient email
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      throw new Error(`Invalid recipient email: ${to}`);
    }

    const attachmentInfo = attachments && attachments.length > 0
      ? ` with ${attachments.length} attachment(s)`
      : '';
    console.log(`[EMAIL] Preparing to send: "${subject}" → ${to}${attachmentInfo}`);

    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Motivata'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || '' // Plain text fallback
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
      console.log(`[EMAIL] Attachments:`, attachments.map(a => `${a.filename} (${a.content?.length || 0} bytes)`));
    }

    console.log(`[EMAIL] Sending from: ${mailOptions.from}`);

    const info = await transporter.sendMail(mailOptions);

    console.log(`[EMAIL] ✓ Sent successfully to ${to} (ID: ${info.messageId})`);

    // Update communication log to SUCCESS
    if (communicationLog) {
      communicationLog.status = 'SUCCESS';
      communicationLog.messageId = info.messageId;
      await communicationLog.save();
      console.log(`[EMAIL] Communication log updated to SUCCESS: ${communicationLog._id}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      recipient: to
    };
  } catch (error) {
    console.error(`[EMAIL] ✗ Failed to send to ${to}`);

    // Update communication log to FAILED
    if (communicationLog) {
      try {
        communicationLog.status = 'FAILED';
        communicationLog.errorMessage = error.message;
        await communicationLog.save();
        console.log(`[EMAIL] Communication log updated to FAILED: ${communicationLog._id}`);
      } catch (logError) {
        console.error(`[EMAIL] Failed to update communication log:`, logError.message);
      }
    }
    console.error(`[EMAIL] Error details:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    throw new Error(`Failed to send email to ${to}: ${error.message}`);
  }
};

/**
 * Send emails to multiple recipients
 * @param {Array<Object>} emails - Array of email options
 * @returns {Promise<Array<Object>>} Array of send results
 */
export const sendBulkEmails = async (emails) => {
  try {
    console.log(`[EMAIL] Starting bulk send: ${emails.length} email(s) queued`);

    const results = await Promise.allSettled(
      emails.map(emailOptions => sendEmail(emailOptions))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed === 0) {
      console.log(`[EMAIL] ✓ Bulk send complete: All ${successful} email(s) sent successfully`);
    } else {
      console.log(`[EMAIL] ⚠ Bulk send complete: ${successful} succeeded, ${failed} failed`);

      // Log failed recipients
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[EMAIL]   ✗ ${emails[index].to}: ${result.reason.message}`);
        }
      });
    }

    return results.map((result, index) => ({
      recipient: emails[index].to,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error(`[EMAIL] ✗ Critical error in bulk email sending: ${error.message}`);
    throw error;
  }
};

/**
 * Send payment link email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.serviceName - Service or membership name
 * @param {string} options.paymentLink - Payment link URL
 * @param {number} options.amount - Payment amount
 * @param {string} [options.customerName] - Customer name for personalization
 * @param {string} [options.orderId] - Order ID for logging
 * @returns {Promise<Object>} Send result
 * @throws {Error} If email sending fails
 */
export const sendPaymentLinkEmail = async ({
  to,
  serviceName,
  paymentLink,
  amount,
  customerName,
  orderId
}) => {
  const subject = `Payment Link for ${serviceName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        .details-box { background: #fff; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #4CAF50; }
        .button { display: inline-block; background: #4CAF50; color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #45a049; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
        .link { word-break: break-all; color: #4CAF50; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">Payment Link Ready</h2>
        </div>
        <div class="content">
          <p>Hello ${customerName || 'Customer'},</p>
          <p>Your payment link for <strong>${serviceName}</strong> is ready.</p>

          <div class="details-box">
            <p style="margin: 5px 0;"><strong>Service:</strong> ${serviceName}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          </div>

          <p style="text-align: center;">
            <a href="${paymentLink}" class="button">Pay Now</a>
          </p>

          <p>Or copy and paste this link in your browser:</p>
          <p class="link"><a href="${paymentLink}">${paymentLink}</a></p>

          <div class="footer">
            <p>This link will expire in 24 hours.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p style="margin-top: 15px;">&copy; ${new Date().getFullYear()} Motivata. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${customerName || 'Customer'},

Your payment link for ${serviceName} is ready.

Service: ${serviceName}
Amount: ₹${amount}

Payment Link: ${paymentLink}

This link will expire in 24 hours. If you have any questions, please contact our support team.

© ${new Date().getFullYear()} Motivata. All rights reserved.
  `.trim();

  return await sendEmail({
    to,
    subject,
    html,
    text,
    category: 'PAYMENT_LINK',
    orderId
  });
};

/**
 * Send payment link emails to multiple recipients
 * @param {Array<Object>} emails - Array of email options
 * @param {string} emails[].to - Recipient email address
 * @param {string} emails[].serviceName - Service or membership name
 * @param {string} emails[].paymentLink - Payment link URL
 * @param {number} emails[].amount - Payment amount
 * @param {string} [emails[].customerName] - Customer name
 * @param {string} [emails[].orderId] - Order ID for logging
 * @returns {Promise<Array<Object>>} Array of send results
 */
export const sendBulkPaymentLinkEmails = async (emails) => {
  try {
    console.log(`[EMAIL] Starting bulk payment link send: ${emails.length} email(s) queued`);

    const results = await Promise.allSettled(
      emails.map(emailOptions => sendPaymentLinkEmail(emailOptions))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed === 0) {
      console.log(`[EMAIL] ✓ Bulk payment link send complete: All ${successful} email(s) sent successfully`);
    } else {
      console.log(`[EMAIL] ⚠ Bulk payment link send complete: ${successful} succeeded, ${failed} failed`);

      // Log failed recipients
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[EMAIL]   ✗ ${emails[index].to}: ${result.reason.message}`);
        }
      });
    }

    return results.map((result, index) => ({
      recipient: emails[index].to,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error(`[EMAIL] ✗ Critical error in bulk payment link email sending: ${error.message}`);
    throw error;
  }
};

export default {
  sendEmail,
  sendBulkEmails,
  sendPaymentLinkEmail,
  sendBulkPaymentLinkEmails
};
