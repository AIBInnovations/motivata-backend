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
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
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
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Motivata'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || '' // Plain text fallback
    };

    console.log(`[EMAIL] Sending email to: ${to}`);
    console.log(`[EMAIL] Subject: ${subject}`);

    const info = await transporter.sendMail(mailOptions);

    console.log(`[EMAIL] Email sent successfully to ${to}:`, info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      recipient: to
    };
  } catch (error) {
    console.error(`[EMAIL] Error sending email to ${to}:`, error);
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
    console.log(`[EMAIL] Sending ${emails.length} emails...`);

    const results = await Promise.allSettled(
      emails.map(emailOptions => sendEmail(emailOptions))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[EMAIL] Bulk send complete: ${successful} successful, ${failed} failed`);

    return results.map((result, index) => ({
      recipient: emails[index].to,
      status: result.status,
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null
    }));
  } catch (error) {
    console.error('[EMAIL] Error in bulk email sending:', error);
    throw error;
  }
};

export default {
  sendEmail,
  sendBulkEmails
};
