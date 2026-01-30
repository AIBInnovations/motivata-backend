/**
 * @fileoverview Notification routing utility for payment links
 * @module utils/notification
 *
 * Centralizes notification logic for sending payment links via WhatsApp and Email
 * based on contact preferences (registered, alternative, or both)
 */

import { sendBulkServicePaymentLinkWhatsApp } from './whatsapp.util.js';
import { sendBulkPaymentLinkEmails } from './email.util.js';

/**
 * Send payment link notifications based on contact preference
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.registeredPhone - Primary phone number (required)
 * @param {string} [params.registeredEmail] - Primary email (optional)
 * @param {string} [params.alternativePhone] - Alternative phone (optional)
 * @param {string} [params.alternativeEmail] - Alternative email (optional)
 * @param {Array<string>} params.contactPreference - ['REGISTERED'], ['ALTERNATIVE'], or both
 * @param {string} params.serviceName - Service/membership name for message
 * @param {string} params.paymentLink - Payment URL
 * @param {number} params.amount - Payment amount
 * @param {string} [params.customerName] - Customer name for email
 * @param {string} [params.orderId] - Order ID for logging
 *
 * @returns {Promise<Object>} Results object with sent/failed arrays for each channel
 * @example
 * const results = await sendPaymentLinkNotifications({
 *   registeredPhone: '9123456789',
 *   alternativePhone: '9876543210',
 *   contactPreference: ['REGISTERED', 'ALTERNATIVE'],
 *   serviceName: 'Premium Membership',
 *   paymentLink: 'https://rzp.io/l/xyz',
 *   amount: 5000,
 *   customerName: 'John Doe',
 *   orderId: 'ORD123'
 * });
 *
 * // Returns:
 * {
 *   whatsapp: { sent: ['9123456789', '9876543210'], failed: [] },
 *   email: { sent: [], failed: [] }
 * }
 */
export const sendPaymentLinkNotifications = async ({
  registeredPhone,
  registeredEmail,
  alternativePhone,
  alternativeEmail,
  contactPreference = ['REGISTERED'],
  serviceName,
  paymentLink,
  amount,
  customerName,
  orderId
}) => {
  const results = {
    whatsapp: { sent: [], failed: [] },
    email: { sent: [], failed: [] }
  };

  console.log('[NOTIFICATION] ========== PAYMENT LINK NOTIFICATION ==========');
  console.log('[NOTIFICATION] Contact preference:', contactPreference);
  console.log('[NOTIFICATION] Service:', serviceName);
  console.log('[NOTIFICATION] Amount:', amount);

  // Build recipient lists based on preference
  const whatsappRecipients = [];
  const emailRecipients = [];

  // Add registered contacts if selected
  if (contactPreference.includes('REGISTERED')) {
    if (registeredPhone) {
      whatsappRecipients.push({
        phone: registeredPhone,
        serviceName,
        paymentLink,
        amount,
        serviceOrderId: orderId
      });
      console.log('[NOTIFICATION]   ✓ Added registered phone:', registeredPhone);
    }
    if (registeredEmail) {
      emailRecipients.push({
        to: registeredEmail,
        serviceName,
        paymentLink,
        amount,
        customerName,
        orderId
      });
      console.log('[NOTIFICATION]   ✓ Added registered email:', registeredEmail);
    }
  }

  // Add alternative contacts if selected
  if (contactPreference.includes('ALTERNATIVE')) {
    if (alternativePhone) {
      whatsappRecipients.push({
        phone: alternativePhone,
        serviceName,
        paymentLink,
        amount,
        serviceOrderId: orderId
      });
      console.log('[NOTIFICATION]   ✓ Added alternative phone:', alternativePhone);
    }
    if (alternativeEmail) {
      emailRecipients.push({
        to: alternativeEmail,
        serviceName,
        paymentLink,
        amount,
        customerName,
        orderId
      });
      console.log('[NOTIFICATION]   ✓ Added alternative email:', alternativeEmail);
    }
  }

  console.log('[NOTIFICATION] Total WhatsApp recipients:', whatsappRecipients.length);
  console.log('[NOTIFICATION] Total email recipients:', emailRecipients.length);

  // Send WhatsApp messages
  if (whatsappRecipients.length > 0) {
    try {
      console.log('[NOTIFICATION] Sending WhatsApp messages...');
      const whatsappResults = await sendBulkServicePaymentLinkWhatsApp(whatsappRecipients);

      whatsappResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.whatsapp.sent.push(result.recipient);
          console.log(`[NOTIFICATION]   ✓ WhatsApp sent to ${result.recipient}`);
        } else {
          results.whatsapp.failed.push({
            recipient: result.recipient,
            error: result.error
          });
          console.error(`[NOTIFICATION]   ✗ WhatsApp failed for ${result.recipient}: ${result.error}`);
        }
      });
    } catch (error) {
      console.error('[NOTIFICATION] WhatsApp batch sending error:', error.message);
      // Mark all WhatsApp recipients as failed
      whatsappRecipients.forEach(r => {
        results.whatsapp.failed.push({
          recipient: r.phone,
          error: error.message
        });
      });
    }
  }

  // Send emails
  if (emailRecipients.length > 0) {
    try {
      console.log('[NOTIFICATION] Sending emails...');
      const emailResults = await sendBulkPaymentLinkEmails(emailRecipients);

      emailResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.email.sent.push(result.recipient);
          console.log(`[NOTIFICATION]   ✓ Email sent to ${result.recipient}`);
        } else {
          results.email.failed.push({
            recipient: result.recipient,
            error: result.error
          });
          console.error(`[NOTIFICATION]   ✗ Email failed for ${result.recipient}: ${result.error}`);
        }
      });
    } catch (error) {
      console.error('[NOTIFICATION] Email batch sending error:', error.message);
      // Mark all email recipients as failed
      emailRecipients.forEach(r => {
        results.email.failed.push({
          recipient: r.to,
          error: error.message
        });
      });
    }
  }

  // Summary log
  console.log('[NOTIFICATION] ========== NOTIFICATION SUMMARY ==========');
  console.log('[NOTIFICATION] WhatsApp sent:', results.whatsapp.sent.length);
  console.log('[NOTIFICATION] WhatsApp failed:', results.whatsapp.failed.length);
  console.log('[NOTIFICATION] Email sent:', results.email.sent.length);
  console.log('[NOTIFICATION] Email failed:', results.email.failed.length);
  console.log('[NOTIFICATION] ===============================================');

  return results;
};
