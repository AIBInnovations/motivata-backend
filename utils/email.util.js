/**
 * @fileoverview Email utility for sending emails using nodemailer
 * @module utils/email
 */

import nodemailer from 'nodemailer';

/**
 * Create and configure nodemailer transporter
 * @returns {nodemailer.Transporter} Configured transporter instance
 */
const createTransporter = () => {
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

  return nodemailer.createTransport(config);
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} [options.text] - Plain text version (optional)
 * @returns {Promise<Object>} Nodemailer send result
 * @throws {Error} If email sending fails
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    console.log(`[EMAIL] Preparing to send: "${subject}" → ${to}`);

    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Motivata'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || '' // Plain text fallback
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[EMAIL] ✓ Sent successfully to ${to} (ID: ${info.messageId})`);

    return {
      success: true,
      messageId: info.messageId,
      recipient: to
    };
  } catch (error) {
    console.error(`[EMAIL] ✗ Failed to send to ${to}: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
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

export default {
  sendEmail,
  sendBulkEmails
};
