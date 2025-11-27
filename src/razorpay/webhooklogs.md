Processing order.paid event
=== Webhook Processing Complete ===
Payment not found for order: order_Rkq8IOEBVH5xRe
=== Razorpay Webhook Received ===
Timestamp: 2025-11-27T17:03:11.337Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"content-length": "2584",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "Rkq8YBMwcMldRr",
"x-razorpay-event-id": "Rkq8YBMwcMldRr",
"x-razorpay-signature": "b121174139752d103fc5985f35c8afddc7bcd3c4c3144c3e6c4cd4156d9fcf63",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 2584
Event: payment_link.paid
Payload: {
"account_id": "acc_RdiBnj4J9keY0B",
"contains": [
"payment_link",
"order",
"payment"
],
"created_at": 1764262976,
"entity": "event",
"event": "payment_link.paid",
"payload": {
"order": {
"entity": {
"amount": 49900,
"amount_due": 0,
"amount_paid": 49900,
"attempts": 1,
"checkout": null,
"created_at": 1764262976,
"currency": "INR",
"description": null,
"entity": "order",
"id": "order_Rkq8IOEBVH5xRe",
"notes": {
"buyer_email": "",
"buyer_name": "Bhavya Bhiya",
"buyer_phone": "9644400090",
"eventName": "UTSAV 2025",
"orderId": "order_Rkq8H58EH3nNNv",
"tierName": "ONE MAN ARMY",
"totalTickets": "1",
"type": "EVENT"
},
"offer_id": null,
"receipt": "order_Rkq8H58EH3nNNv",
"status": "paid"
}
},
"payment": {
"entity": {
"acquirer_data": {
"rrn": "343047250601",
"upi_transaction_id": "A808C82F0B5C3874590BB2B254E7312E"
},
"amount": 49900,
"amount_refunded": 0,
"amount_transferred": 0,
"bank": null,
"base_amount": 49900,
"captured": true,
"card": null,
"card_id": null,
"contact": "+919926446622",
"created_at": 1764262988,
"currency": "INR",
"description": "#Rkq8HYYa9DcQE1",
"email": "void@razorpay.com",
"entity": "payment",
"error_code": null,
"error_description": null,
"error_reason": null,
"error_source": null,
"error_step": null,
"fee": 1178,
"fee_bearer": "platform",
"id": "pay_Rkq8UlJzDcDQ2j",
"international": false,
"invoice_id": null,
"method": "upi",
"notes": {
"buyer_email": "",
"buyer_name": "Bhavya Bhiya",
"buyer_phone": "9644400090",
"eventName": "UTSAV 2025",
"orderId": "order_Rkq8H58EH3nNNv",
"tierName": "ONE MAN ARMY",
"totalTickets": "1",
"type": "EVENT"
},
"order_id": "order_Rkq8IOEBVH5xRe",
"refund_status": null,
"status": "captured",
"tax": 180,
"upi": {
"flow": "collect",
"vpa": "success@razorpay"
},
"vpa": "success@razorpay",
"wallet": null
}
},
"payment_link": {
"entity": {
"accept_partial": false,
"amount": 49900,
"amount_paid": 49900,
"callback_method": "get",
"callback_url": "https://mediumpurple-dotterel-484503.hostingersite.com/payment-success",
"cancelled_at": 0,
"created_at": 1764262976,
"currency": "INR",
"customer": {
"contact": "9644400090",
"name": "Bhavya Bhiya"
},
"description": "Payment for UTSAV 2025 - ONE MAN ARMY (1 ticket)",
"expire_by": 0,
"expired_at": 0,
"first_min_partial_amount": 0,
"id": "plink_Rkq8HYYa9DcQE1",
"notes": {
"buyer_email": "",
"buyer_name": "Bhavya Bhiya",
"buyer_phone": "9644400090",
"eventName": "UTSAV 2025",
"orderId": "order_Rkq8H58EH3nNNv",
"tierName": "ONE MAN ARMY",
"totalTickets": "1",
"type": "EVENT"
},
"notify": {
"email": false,
"sms": false,
"whatsapp": false
},
"order_id": "order_Rkq8IOEBVH5xRe",
"reference_id": "order_Rkq8H58EH3nNNv",
"reminder_enable": false,
"reminders": {},
"short_url": "https://rzp.io/rzp/fEP4TIhg",
"status": "paid",
"updated_at": 1764262990,
"upi_link": false,
"user_id": "",
"whatsapp_link": false
}
}
}
}
Signature: b121174139752d103fc5985f35c8afddc7bcd3c4c3144c3e6c4cd4156d9fcf63
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: b121174139752d10...
✓ Raw body type: Buffer
✓ Raw body length: 2584
✓ Body string preview: {"account_id":"acc_RdiBnj4J9keY0B","contains":["payment_link","order","payment"],"created_at":176426...
✓ Expected signature: b121174139752d10...
✓ Signatures match: true
===========================================
✓ Webhook signature verified
Processing payment_link.paid event
✓ Fetched Razorpay order: order_Rkq8IOEBVH5xRe
No payments found in order, storing payment link entity only
✓ Payment link paid for order: order_Rkq8H58EH3nNNv
[ENROLLMENT] Starting enrollment creation for payment: order_Rkq8H58EH3nNNv
[ENROLLMENT] Buyer details: { name: 'Bhavya Bhiya', email: undefined, phone: '9644400090' }
[USER-CREATION] Checking if user exists with phone: 9644400090
[USER-CREATION] User not found with phone 9644400090, creating new user
[USER-CREATION] New user created successfully: {
userId: new ObjectId('6928844f6a78fd62695cb2ef'),
name: 'Bhavya Bhiya',
email: '(no email)',
phone: '9644400090'
}
[ENROLLMENT] Enrollment created successfully: {
enrollmentId: new ObjectId('6928844f6a78fd62695cb2f2'),
buyerId: new ObjectId('6928844f6a78fd62695cb2ef'),
eventId: new ObjectId('6925a3d6d4f97c5f342ae40b'),
ticketCount: 1,
tickets: [ '9644400090' ]
}
[ENROLLMENT] Event ticket counts updated: {
eventId: new ObjectId('6925a3d6d4f97c5f342ae40b'),
ticketsSold: 13,
availableSeats: 19987
}
[WEBHOOK-NOTIFY] Preparing ticket notifications for 1 ticket holder(s)
[WEBHOOK-NOTIFY] Buyer info: { name: 'Bhavya Bhiya', email: '(no email)', phone: '9644400090' }
[WEBHOOK-NOTIFY] Processing buyer ticket for phone: 9644400090
[QR-UTIL] Generating QR code for ticket: 9644400090
[QR-UTIL] QR URL: https://motivata.synquic.com/api/app/tickets/qr-scan?enrollmentId=6928844f6a78fd62695cb2f2&userId=6928844f6a78fd62695cb2ef&eventId=6925a3d6d4f97c5f342ae40b&phone=9644400090
[QR-UTIL] QR code generated successfully (7017 bytes)
[WEBHOOK-NOTIFY] ✓ Buyer QR code generated: ticket-UTSAV-2025-9644400090.png (7017 bytes)
[QR-UPLOAD] ========== STARTING CLOUDINARY UPLOAD ==========
[QR-UPLOAD] Input parameters:
[QR-UPLOAD] - Phone: 9644400090
[QR-UPLOAD] - Enrollment ID: 6928844f6a78fd62695cb2f2
[QR-UPLOAD] - Event Name: UTSAV 2025
[QR-UPLOAD] - Buffer size: 7017 bytes
[QR-UPLOAD] Upload config:
[QR-UPLOAD] - Folder: tickets/UTSAV-2025/6928844f6a78fd62695cb2f2
[QR-UPLOAD] - Public ID: qr-9644400090
[QR-UPLOAD] - Full path: tickets/UTSAV-2025/6928844f6a78fd62695cb2f2/qr-9644400090
[QR-UPLOAD] - Base64 length: 9378 characters
[QR-UPLOAD] Calling Cloudinary uploader...
[QR-UPLOAD] ✓ Cloudinary upload successful!
[QR-UPLOAD] Response details:
[QR-UPLOAD] - Public ID: tickets/UTSAV-2025/6928844f6a78fd62695cb2f2/qr-9644400090
[QR-UPLOAD] - Secure URL: https://res.cloudinary.com/dk94hyz5e/image/upload/v1764262992/tickets/UTSAV-2025/6928844f6a78fd62695cb2f2/qr-9644400090.png
[QR-UPLOAD] - Format: png
[QR-UPLOAD] - Size: 7017 bytes
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
[WHATSAPP] - Original phone: 9644400090
[WHATSAPP] - Formatted phone: 919644400090
[WHATSAPP] - Name: Bhavya Bhiya
[WHATSAPP] - Email: (none)
[WHATSAPP] - Event: UTSAV 2025
[WHATSAPP] - QR Code URL: https://res.cloudinary.com/dk94hyz5e/image/upload/v1764262992/tickets/UTSAV-2025/6928844f6a78fd62695cb2f2/qr-9644400090.png
[WHATSAPP] API URL: https://api.wappservice.com/api/c1a50e14-2350-4c0b-b5ac-9c909e383274/contact/send-template-message
[WHATSAPP] Request body: {
"phone_number": "919644400090",
"template_name": "wp_ticket",
"template_language": "en",
"templateArgs": {
"header_image": "https://res.cloudinary.com/dk94hyz5e/image/upload/v1764262992/tickets/UTSAV-2025/6928844f6a78fd62695cb2f2/qr-9644400090.png",
"field_1": "UTSAV 2025"
},
"contact": {
"first_name": "Bhavya",
"last_name": "Bhiya",
"email": "",
"country": "India"
}
}
[WHATSAPP] Response status: 400 Bad Request
[WHATSAPP] Raw response: {"error":"Validation failed","details":[{"type":"field","value":"","msg":"contact.email must be valid email","path":"contact.email","location":"body"}]}
[WHATSAPP] Parsed response: {
"error": "Validation failed",
"details": [
{
"type": "field",
"value": "",
"msg": "contact.email must be valid email",
"path": "contact.email",
"location": "body"
}
]
}
[WHATSAPP] ✗ API Error - Status: 400
[WHATSAPP] ✗ Error details: {
error: 'Validation failed',
details: [
{
type: 'field',
value: '',
msg: 'contact.email must be valid email',
path: 'contact.email',
location: 'body'
}
]
}
[WHATSAPP] ✗ FAILED to send message to 9644400090
[WHATSAPP] Error type: Error
[WHATSAPP] Error message: Validation failed
[WHATSAPP] Error stack: Error: Validation failed
at sendTicketWhatsApp (file:///home/ubuntu/motivata-backend/utils/whatsapp.util.js:151:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
at async Promise.allSettled (index 0)
at async sendBulkTicketWhatsApp (file:///home/ubuntu/motivata-backend/utils/whatsapp.util.js:194:21)
at async sendEnrollmentEmails (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:1001:9)
at async updateRelatedEntities (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:1078:5)
at async handlePaymentLinkPaid (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:426:3)
at async handleWebhook (file:///home/ubuntu/motivata-backend/src/razorpay/razorpay.webhook.js:188:9)
[WHATSAPP] ========== WHATSAPP SEND FAILED ==========
[WHATSAPP] ✗ 9644400090: Failed to send WhatsApp message to 9644400090: Validation failed
[WHATSAPP] ⚠ Bulk send complete: 0 succeeded, 1 failed
[WEBHOOK-NOTIFY] ✓ WhatsApp notifications sent successfully
[WEBHOOK-NOTIFY] ℹ No emails to send (no ticket holders have email addresses)
[WEBHOOK-NOTIFY] ✓ Notification process completed
✓ Payment processed. Users, enrollment, and emails sent successfully.
=== Webhook Processing Complete ===
