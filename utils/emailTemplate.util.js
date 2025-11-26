/**
 * @fileoverview Email templates for various notification types
 * @module utils/emailTemplate
 */

/**
 * Generate enrollment confirmation email HTML
 * @param {Object} data - Enrollment data
 * @param {string} data.email - User's email
 * @param {string} data.phone - User's phone number
 * @param {string} data.userId - User's ID
 * @param {string} data.eventId - Event ID
 * @param {string} data.enrollmentId - Enrollment ID
 * @param {string} data.name - User's name
 * @param {string} [data.eventName] - Event name (optional)
 * @param {string} [data.eventDate] - Event date (optional)
 * @returns {string} HTML email template
 */
export const generateEnrollmentEmail = (data) => {
  const {
    email,
    phone,
    userId,
    eventId,
    enrollmentId,
    name,
    eventName = 'Event',
    eventDate = ''
  } = data;

  console.log(`[EMAIL-TEMPLATE] Generating HTML enrollment email for ${name} (${email})`);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enrollment Confirmation</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #4CAF50;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #4CAF50;
      margin: 0;
      font-size: 28px;
    }
    .content {
      margin-bottom: 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #333;
    }
    .message {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .details {
      background-color: #f9f9f9;
      border-left: 4px solid #4CAF50;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-item {
      display: flex;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .detail-label {
      font-weight: bold;
      min-width: 140px;
      color: #555;
    }
    .detail-value {
      color: #333;
      word-break: break-all;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      font-size: 14px;
      color: #777;
    }
    .success-badge {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 14px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Enrollment Confirmed!</h1>
    </div>

    <div class="content">
      <div class="greeting">Hello ${name},</div>

      <div class="message">
        <p>Thank you for your payment! Your enrollment has been successfully confirmed.</p>
        ${eventDate ? `<p>We look forward to seeing you at <strong>${eventName}</strong> on <strong>${eventDate}</strong>.</p>` : `<p>We look forward to seeing you at <strong>${eventName}</strong>.</p>`}
      </div>

      <div class="success-badge">Payment Successful</div>

      <div class="details">
        <h3 style="margin-top: 0; color: #4CAF50;">Your Enrollment Details:</h3>

        <div class="detail-item">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${email}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Phone Number:</span>
          <span class="detail-value">${phone}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">User ID:</span>
          <span class="detail-value">${userId}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Event ID:</span>
          <span class="detail-value">${eventId}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Enrollment ID:</span>
          <span class="detail-value">${enrollmentId}</span>
        </div>
      </div>

      <div class="message">
        <p><strong>Important:</strong> Please save this email for your records. You may need to present your enrollment details at the event.</p>
      </div>
    </div>

    <div class="footer">
      <p>If you have any questions, please contact our support team.</p>
      <p style="margin-top: 10px;">
        <strong>Motivata</strong><br>
        Building better experiences together
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate plain text version of enrollment email
 * @param {Object} data - Enrollment data
 * @returns {string} Plain text email
 */
export const generateEnrollmentEmailText = (data) => {
  const {
    email,
    phone,
    userId,
    eventId,
    enrollmentId,
    name,
    eventName = 'Event',
    eventDate = ''
  } = data;

  console.log(`[EMAIL-TEMPLATE] Generating plain text enrollment email for ${name} (${email})`);

  return `
Hello ${name},

Thank you for your payment! Your enrollment has been successfully confirmed.

${eventDate ? `We look forward to seeing you at ${eventName} on ${eventDate}.` : `We look forward to seeing you at ${eventName}.`}

Your Enrollment Details:
- Email: ${email}
- Phone Number: ${phone}
- User ID: ${userId}
- Event ID: ${eventId}
- Enrollment ID: ${enrollmentId}

Important: Please save this email for your records. You may need to present your enrollment details at the event.

If you have any questions, please contact our support team.

Motivata
Building better experiences together
  `.trim();
};

/**
 * Generate ticket email with QR code attachment
 * @param {Object} data - Ticket data
 * @param {string} data.email - User's email
 * @param {string} data.phone - User's phone number
 * @param {string} data.userId - User's ID
 * @param {string} data.eventId - Event ID
 * @param {string} data.enrollmentId - Enrollment ID
 * @param {string} data.name - User's name
 * @param {string} [data.eventName] - Event name (optional)
 * @param {string} [data.eventDate] - Event date (optional)
 * @param {string} [data.eventLocation] - Event location (optional)
 * @param {boolean} [data.isBuyer=false] - Whether this is the buyer's ticket
 * @returns {string} HTML email template
 */
export const generateTicketEmail = (data) => {
  const {
    email,
    phone,
    userId,
    eventId,
    enrollmentId,
    name,
    eventName = 'Event',
    eventDate = '',
    eventLocation = '',
    isBuyer = false
  } = data;

  console.log(`[EMAIL-TEMPLATE] Generating ticket email for ${name} (${email})`);

  const buyerMessage = isBuyer
    ? '<p><strong>Note:</strong> As the buyer, you have received this ticket. Additional tickets have been sent to the other attendees\' email addresses.</p>'
    : '<p>This ticket was purchased for you. Please keep this email safe as you\'ll need to present your QR code at the event.</p>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Event Ticket</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #ffffff;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 3px solid #4CAF50;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #4CAF50;
      margin: 0;
      font-size: 28px;
    }
    .ticket-badge {
      display: inline-block;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      padding: 12px 25px;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .content {
      margin-bottom: 30px;
    }
    .greeting {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #333;
    }
    .message {
      margin-bottom: 20px;
      font-size: 16px;
    }
    .qr-section {
      background: linear-gradient(135deg, #f5f5f5 0%, #e8f5e9 100%);
      border: 2px solid #4CAF50;
      border-radius: 10px;
      padding: 25px;
      margin: 25px 0;
      text-align: center;
    }
    .qr-section h3 {
      color: #4CAF50;
      margin-top: 0;
      font-size: 20px;
    }
    .qr-icon {
      font-size: 48px;
      margin: 10px 0;
    }
    .qr-instructions {
      background-color: #fff;
      border-left: 4px solid #4CAF50;
      padding: 15px;
      margin: 15px 0;
      text-align: left;
    }
    .qr-instructions ol {
      margin: 10px 0;
      padding-left: 20px;
    }
    .qr-instructions li {
      margin: 8px 0;
    }
    .details {
      background-color: #f9f9f9;
      border-left: 4px solid #4CAF50;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-item {
      display: flex;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .detail-label {
      font-weight: bold;
      min-width: 140px;
      color: #555;
    }
    .detail-value {
      color: #333;
      word-break: break-all;
    }
    .important-note {
      background-color: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
    .important-note strong {
      color: #856404;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      font-size: 14px;
      color: #777;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟️ Your Event Ticket</h1>
    </div>

    <div class="content">
      <div class="greeting">Hello ${name},</div>

      <div class="message">
        <p>Thank you for registering! Your ticket for <strong>${eventName}</strong> is confirmed and ready.</p>
        ${eventDate ? `<p>📅 Event Date: <strong>${eventDate}</strong></p>` : ''}
        ${eventLocation ? `<p>📍 Location: <strong>${eventLocation}</strong></p>` : ''}
      </div>

      <div style="text-align: center;">
        <div class="ticket-badge">✓ Ticket Confirmed</div>
      </div>

      ${buyerMessage}

      <div class="qr-section">
        <div class="qr-icon">📱</div>
        <h3>Your QR Code Ticket</h3>
        <p style="margin-bottom: 15px;">Your unique QR code is attached to this email as <strong>an image file</strong>.</p>

        <div class="qr-instructions">
          <strong>How to use your ticket:</strong>
          <ol>
            <li>Download the attached QR code image from this email</li>
            <li>Save it to your phone or print it out</li>
            <li>Present the QR code at the event entrance</li>
            <li>Our staff will scan it to verify your entry</li>
          </ol>
        </div>
      </div>

      <div class="important-note">
        <p><strong>⚠️ Important:</strong></p>
        <ul style="margin: 5px 0; padding-left: 20px;">
          <li>Each QR code is unique and can only be scanned once</li>
          <li>Keep this email safe - you'll need it for event entry</li>
          <li>Do not share your QR code with others</li>
          <li>If you can't find the attachment, check your spam folder or downloads</li>
        </ul>
      </div>

      <div class="details">
        <h3 style="margin-top: 0; color: #4CAF50;">Ticket Details:</h3>

        <div class="detail-item">
          <span class="detail-label">Name:</span>
          <span class="detail-value">${name}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Email:</span>
          <span class="detail-value">${email}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Phone Number:</span>
          <span class="detail-value">${phone}</span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Ticket ID:</span>
          <span class="detail-value">${enrollmentId}-${phone}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>If you have any questions or issues with your ticket, please contact our support team.</p>
      <p style="margin-top: 10px;">
        <strong>Motivata</strong><br>
        Building better experiences together
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate plain text version of ticket email
 * @param {Object} data - Ticket data
 * @returns {string} Plain text email
 */
export const generateTicketEmailText = (data) => {
  const {
    email,
    phone,
    enrollmentId,
    name,
    eventName = 'Event',
    eventDate = '',
    eventLocation = '',
    isBuyer = false
  } = data;

  console.log(`[EMAIL-TEMPLATE] Generating plain text ticket email for ${name} (${email})`);

  const buyerMessage = isBuyer
    ? '\n\nNote: As the buyer, you have received this ticket. Additional tickets have been sent to the other attendees\' email addresses.'
    : '\n\nThis ticket was purchased for you. Please keep this email safe as you\'ll need to present your QR code at the event.';

  return `
🎟️ YOUR EVENT TICKET

Hello ${name},

Thank you for registering! Your ticket for ${eventName} is confirmed and ready.

${eventDate ? `📅 Event Date: ${eventDate}` : ''}
${eventLocation ? `📍 Location: ${eventLocation}` : ''}
${buyerMessage}

YOUR QR CODE TICKET
-------------------
Your unique QR code is attached to this email as an image file.

How to use your ticket:
1. Download the attached QR code image from this email
2. Save it to your phone or print it out
3. Present the QR code at the event entrance
4. Our staff will scan it to verify your entry

⚠️ IMPORTANT:
- Each QR code is unique and can only be scanned once
- Keep this email safe - you'll need it for event entry
- Do not share your QR code with others
- If you can't find the attachment, check your spam folder or downloads

TICKET DETAILS
--------------
Name: ${name}
Email: ${email}
Phone Number: ${phone}
Ticket ID: ${enrollmentId}-${phone}

If you have any questions or issues with your ticket, please contact our support team.

Motivata
Building better experiences together
  `.trim();
};

export default {
  generateEnrollmentEmail,
  generateEnrollmentEmailText,
  generateTicketEmail,
  generateTicketEmailText
};
