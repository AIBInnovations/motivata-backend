/**
 * @fileoverview WhatsApp messaging utility using WappService API
 * @module utils/whatsapp
 */

const WHATSAPP_API_BASE_URL = "https://api.wappservice.com/api";

/**
 * Validate WhatsApp configuration
 * @throws {Error} If WhatsApp configuration is invalid
 */
const validateWhatsAppConfig = () => {
  const requiredVars = [
    "WHATSAPP_API_KEY",
    "WHATSAPP_VENDOR_UID",
  ];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required WhatsApp configuration: ${missing.join(", ")}`
    );
  }
};

/**
 * Format phone number for WhatsApp API
 * Ensures phone number is in 91XXXXXXXXXX format (India)
 *
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // If it doesn't start with 91, add it
  if (!cleaned.startsWith("91")) {
    // If it's 10 digits, it's likely an Indian number without country code
    if (cleaned.length === 10) {
      cleaned = "91" + cleaned;
    }
  }

  return cleaned;
};

/**
 * Split name into first and last name
 *
 * @param {string} fullName - Full name to split
 * @returns {Object} Object with first_name and last_name
 */
const splitName = (fullName) => {
  const parts = (fullName || "User").trim().split(" ");
  return {
    first_name: parts[0] || "User",
    last_name: parts.slice(1).join(" ") || ".",
  };
};

/**
 * Send WhatsApp template message with ticket QR code
 *
 * @param {Object} params - Message parameters
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.name - Recipient name
 * @param {string} [params.email] - Recipient email (optional)
 * @param {string} params.eventName - Event name for template variable
 * @param {string} params.qrCodeUrl - URL to the QR code image
 *
 * @returns {Promise<Object>} API response
 * @throws {Error} If message sending fails
 */
export const sendTicketWhatsApp = async ({
  phone,
  name,
  email,
  eventName,
  qrCodeUrl,
}) => {
  try {
    console.log(`[WHATSAPP] ========== STARTING WHATSAPP SEND ==========`);

    // Validate config and log (masked)
    validateWhatsAppConfig();
    console.log(`[WHATSAPP] Config validated:`);
    console.log(`[WHATSAPP]   - VENDOR_UID: ${process.env.WHATSAPP_VENDOR_UID}`);
    console.log(`[WHATSAPP]   - API_KEY: ${process.env.WHATSAPP_API_KEY?.substring(0, 10)}...`);

    const formattedPhone = formatPhoneNumber(phone);
    const { first_name, last_name } = splitName(name);

    console.log(`[WHATSAPP] Recipient details:`);
    console.log(`[WHATSAPP]   - Original phone: ${phone}`);
    console.log(`[WHATSAPP]   - Formatted phone: ${formattedPhone}`);
    console.log(`[WHATSAPP]   - Name: ${first_name} ${last_name}`);
    console.log(`[WHATSAPP]   - Email: ${email || "(none)"}`);
    console.log(`[WHATSAPP]   - Event: ${eventName}`);
    console.log(`[WHATSAPP]   - QR Code URL: ${qrCodeUrl}`);

    const apiUrl = `${WHATSAPP_API_BASE_URL}/${process.env.WHATSAPP_VENDOR_UID}/contact/send-template-message`;

    const requestBody = {
      // from_phone_number_id is omitted to use default phone number
      phone_number: formattedPhone,
      template_name: "wp_ticket",
      template_language: "en",  // Changed from "en_US" to "en" per WappService API
      templateArgs: {
        header_image: qrCodeUrl,
        field_1: eventName,
      },
      contact: {
        first_name,
        last_name,
        email: email || "",
        country: "India",
      },
    };

    console.log(`[WHATSAPP] API URL: ${apiUrl}`);
    console.log(`[WHATSAPP] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "X-API-Key": process.env.WHATSAPP_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`[WHATSAPP] Response status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`[WHATSAPP] Raw response: ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error(`[WHATSAPP] Failed to parse response as JSON`);
      throw new Error(`Invalid JSON response: ${responseText}`);
    }

    console.log(`[WHATSAPP] Parsed response:`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error(`[WHATSAPP] ✗ API Error - Status: ${response.status}`);
      console.error(`[WHATSAPP] ✗ Error details:`, responseData);
      throw new Error(
        responseData.message || responseData.error || `HTTP ${response.status}: WhatsApp API error`
      );
    }

    console.log(`[WHATSAPP] ✓ Message sent successfully!`);
    console.log(`[WHATSAPP]   - Message ID: ${responseData.message_id}`);
    console.log(`[WHATSAPP]   - Recipient: ${formattedPhone}`);
    console.log(`[WHATSAPP] ========== WHATSAPP SEND COMPLETE ==========`);

    return {
      success: true,
      messageId: responseData.message_id,
      recipient: formattedPhone,
    };
  } catch (error) {
    console.error(`[WHATSAPP] ✗ FAILED to send message to ${phone}`);
    console.error(`[WHATSAPP] Error type: ${error.name}`);
    console.error(`[WHATSAPP] Error message: ${error.message}`);
    console.error(`[WHATSAPP] Error stack:`, error.stack);
    console.error(`[WHATSAPP] ========== WHATSAPP SEND FAILED ==========`);
    throw new Error(`Failed to send WhatsApp message to ${phone}: ${error.message}`);
  }
};

/**
 * Send WhatsApp ticket messages to multiple recipients
 *
 * @param {Array<Object>} messages - Array of message options
 * @param {string} messages[].phone - Recipient phone number
 * @param {string} messages[].name - Recipient name
 * @param {string} [messages[].email] - Recipient email (optional)
 * @param {string} messages[].eventName - Event name
 * @param {string} messages[].qrCodeUrl - QR code image URL
 *
 * @returns {Promise<Array<Object>>} Array of send results
 */
export const sendBulkTicketWhatsApp = async (messages) => {
  try {
    console.log(
      `[WHATSAPP] Starting bulk send: ${messages.length} message(s) queued`
    );

    const results = await Promise.allSettled(
      messages.map((messageOptions) => sendTicketWhatsApp(messageOptions))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      console.log(
        `[WHATSAPP] ✓ Bulk send complete: All ${successful} message(s) sent successfully`
      );
    } else {
      console.log(
        `[WHATSAPP] ⚠ Bulk send complete: ${successful} succeeded, ${failed} failed`
      );

      // Log failed recipients
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(
            `[WHATSAPP]   ✗ ${messages[index].phone}: ${result.reason.message}`
          );
        }
      });
    }

    return results.map((result, index) => ({
      recipient: messages[index].phone,
      status: result.status,
      data: result.status === "fulfilled" ? result.value : null,
      error: result.status === "rejected" ? result.reason.message : null,
    }));
  } catch (error) {
    console.error(
      `[WHATSAPP] ✗ Critical error in bulk WhatsApp sending: ${error.message}`
    );
    throw error;
  }
};

export default {
  sendTicketWhatsApp,
  sendBulkTicketWhatsApp,
};
