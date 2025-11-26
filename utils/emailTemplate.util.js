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

export default {
  generateEnrollmentEmail,
  generateEnrollmentEmailText
};
