===========================================
✓ Webhook signature verified
Processing payment_link.paid event
✓ Fetched Razorpay order: order_RkqQYnQ3IRja93
No payments found in order, storing payment link entity only
✓ Payment link paid for order: order_RkqQXPyKD4aynV
[ENROLLMENT] Starting enrollment creation for payment: order_RkqQXPyKD4aynV
[ENROLLMENT] Buyer details: { name: 'Govind Narayan', email: undefined, phone: '9179621765' }
[USER-CREATION] Checking if user exists with phone: 9179621765
[USER-CREATION] User not found with phone 9179621765, creating new user
[USER-CREATION] New user created successfully: {
userId: new ObjectId('6928885b020f5f74cea1b58d'),
name: 'Govind Narayan',
email: '(no email)',
phone: '9179621765'
}
[ENROLLMENT] Enrollment created successfully: {
enrollmentId: new ObjectId('6928885b020f5f74cea1b590'),
buyerId: new ObjectId('6928885b020f5f74cea1b58d'),
eventId: new ObjectId('6925a3d6d4f97c5f342ae40b'),
ticketCount: 1,
tickets: [ '9179621765' ]
}
[ENROLLMENT] Event ticket counts updated: {
eventId: new ObjectId('6925a3d6d4f97c5f342ae40b'),
ticketsSold: 14,
availableSeats: 19986
}
[WEBHOOK-NOTIFY] Preparing ticket notifications for 1 ticket holder(s)
[WEBHOOK-NOTIFY] Buyer info: { name: 'Govind Narayan', email: '(no email)', phone: '9179621765' }
[WEBHOOK-NOTIFY] Processing buyer ticket for phone: 9179621765
[QR-UTIL] Generating QR code for ticket: 9179621765
[QR-UTIL] QR URL: https://motivata.synquic.com/api/app/tickets/qr-scan?enrollmentId=6928885b020f5f74cea1b590&userId=6928885b020f5f74cea1b58d&eventId=6925a3d6d4f97c5f342ae40b&phone=9179621765
[QR-UTIL] QR code generated successfully (7007 bytes)
[WEBHOOK-NOTIFY] ✓ Buyer QR code generated: ticket-UTSAV-2025-9179621765.png (7007 bytes)
[QR-UPLOAD] ========== STARTING CLOUDINARY UPLOAD ==========
[QR-UPLOAD] Input parameters:
[QR-UPLOAD] - Phone: 9179621765
[QR-UPLOAD] - Enrollment ID: 6928885b020f5f74cea1b590
[QR-UPLOAD] - Event Name: UTSAV 2025
[QR-UPLOAD] - Buffer size: 7007 bytes
[QR-UPLOAD] Upload config:
[QR-UPLOAD] - Folder: tickets/UTSAV-2025/6928885b020f5f74cea1b590
[QR-UPLOAD] - Public ID: qr-9179621765
[QR-UPLOAD] - Full path: tickets/UTSAV-2025/6928885b020f5f74cea1b590/qr-9179621765
[QR-UPLOAD] - Base64 length: 9366 characters
[QR-UPLOAD] Calling Cloudinary uploader...
[QR-UPLOAD] ✓ Cloudinary upload successful!
[QR-UPLOAD] Response details:
[QR-UPLOAD] - Public ID: tickets/UTSAV-2025/6928885b020f5f74cea1b590/qr-9179621765
[QR-UPLOAD] - Secure URL: https://res.cloudinary.com/dk94hyz5e/image/upload/v1764264028/tickets/UTSAV-2025/6928885b020f5f74cea1b590/qr-9179621765.png
[QR-UPLOAD] - Format: png
[QR-UPLOAD] - Size: 7007 bytes
[QR-UPLOAD] - Dimensions: 400x400
[QR-UPLOAD] ========== CLOUDINARY UPLOAD COMPLETE ==========
[WEBHOOK-NOTIFY] ✓ Buyer WhatsApp message queued
[WEBHOOK-NOTIFY] ℹ Buyer has no email - skipping email notification
[WEBHOOK-NOTIFY] Processing 0 other ticket holder(s)
[WEBHOOK-NOTIFY] === Notification Summary ===
[WEBHOOK-NOTIFY] WhatsApp messages queued: 1
[WEBHOOK-NOTIFY] Email messages queued: 0
[WEBHOOK-NOTIFY] Sending 1 WhatsApp message(s)...
[WHATSAPP] Starting bulk send: 1 message(s) queued
[WHATSAPP] ========== STARTING WHATSAPP SEND ==========
[WHATSAPP] Config validated:
[WHATSAPP] - VENDOR_UID: c1a50e14-2350-4c0b-b5ac-9c909e383274
[WHATSAPP] - API_KEY: rAHakqcJI5...
[WHATSAPP] Recipient details:
[WHATSAPP] - Original phone: 9179621765
[WHATSAPP] - Formatted phone: 9179621765
[WHATSAPP] - Name: Govind Narayan
[WHATSAPP] - Email: (none)
[WHATSAPP] - Event: UTSAV 2025
[WHATSAPP] - QR Code URL: https://res.cloudinary.com/dk94hyz5e/image/upload/v1764264028/tickets/UTSAV-2025/6928885b020f5f74cea1b590/qr-9179621765.png
[WHATSAPP] API URL: https://api.wappservice.com/api/c1a50e14-2350-4c0b-b5ac-9c909e383274/contact/send-template-message
[WHATSAPP] Request body: {
"phone_number": "9179621765",
"template_name": "wp_ticket",
"template_language": "en",
"templateArgs": {
"header_image": "https://res.cloudinary.com/dk94hyz5e/image/upload/v1764264028/tickets/UTSAV-2025/6928885b020f5f74cea1b590/qr-9179621765.png",
"field_1": "UTSAV 2025"
},
"contact": {
"first_name": "Govind",
"last_name": "Narayan",
"country": "India"
}
}
[WHATSAPP] Response status: 400 Bad Request
[WHATSAPP] Raw response: {"error":"Template not found","message":"Template 'wp_ticket' does not exist"}
[WHATSAPP] Parsed response: {
"error": "Template not found",
"message": "Template 'wp_ticket' does not exist"
}
[WHATSAPP] ✗ API Error - Status: 400
[WHATSAPP] ✗ Error details: {
error: 'Template not found',
message: "Template 'wp_ticket' does not exist"
}
[WHATSAPP] ✗ FAILED to send message to 9179621765
[WHATSAPP] Error type: Error
[WHATSAPP] Error message: Template 'wp_ticket' does not exist
[WHATSAPP] Error stack: Error: Template 'wp_ticket' does not exist
at sendTicketWhatsApp (file:///home/ubuntu/motivata-backend/utils/whatsapp.util.js:158:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
at async Promise.allSettled (index 0)
at async sendBulkTicketWhatsApp (file:///home/ubuntu/motivata-backend/utils/whatsapp.util.js:201:21)
at async sendEnrollmentEmails (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:1001:9)
at async updateRelatedEntities (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:1078:5)
at async handlePaymentLinkPaid (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:426:3)
at async handleWebhook (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:188:9)
[WHATSAPP] ========== WHATSAPP SEND FAILED ==========
[WHATSAPP] ⚠ Bulk send complete: 0 succeeded, 1 failed
[WHATSAPP] ✗ 9179621765: Failed to send WhatsApp message to 9179621765: Template 'wp_ticket' does not exist
[WEBHOOK-NOTIFY] ✓ WhatsApp notifications sent successfully
[WEBHOOK-NOTIFY] ℹ No emails to send (no ticket holders have email addresses)
[WEBHOOK-NOTIFY] ✓ Notification process completed
✓ Payment processed. Users, enrollment, and emails sent successfully.
=== Webhook Processing Complete ===
