0|motivata-node-backend | [WEBHOOK-NOTIFY] Email messages queued: 0
0|motivata-node-backend | [WEBHOOK-NOTIFY] Sending 1 WhatsApp message(s)...
0|motivata-node-backend | [WHATSAPP] Starting bulk send: 1 message(s) queued
0|motivata-node-backend | [WHATSAPP] Preparing to send ticket message to: 9179621765
0|motivata-node-backend | [WHATSAPP] Event: UTSAV 2025
0|motivata-node-backend | [WHATSAPP] QR Code URL: https://res.cloudinary.com/dk94hyz5e/image/upload/v1764262342/tickets/UTSAV-2025/692881c5f40072d414350181/qr-9179621765.png
0|motivata-node-backend | [WHATSAPP] Sending request to: https://api.wappservice.com/api/c1a50e14-2350-4c0b-b5ac-9c909e383274/contact/send-template-message
0|motivata-node-backend | [WHATSAPP] Request body: {
0|motivata-node-backend | "phone_number": "9179621765",
0|motivata-node-backend | "template_name": "wp_ticket",
0|motivata-node-backend | "template_language": "en_US",
0|motivata-node-backend | "templateArgs": {
0|motivata-node-backend | "header_image": "https://res.cloudinary.com/dk94hyz5e/image/upload/v1764262342/tickets/UTSAV-2025/692881c5f40072d414350181/qr-9179621765.png",
0|motivata-node-backend | "field_1": "UTSAV 2025"
0|motivata-node-backend | },
0|motivata-node-backend | "contact": {
0|motivata-node-backend | "first_name": "Akshat",
0|motivata-node-backend | "last_name": "Jain",
0|motivata-node-backend | "email": "",
0|motivata-node-backend | "country": "India"
0|motivata-node-backend | }
0|motivata-node-backend | }
0|motivata-node-backend | [WHATSAPP] API Error Response: {
0|motivata-node-backend | error: 'Validation failed',
0|motivata-node-backend | details: [
0|motivata-node-backend | {
0|motivata-node-backend | type: 'field',
0|motivata-node-backend | value: '',
0|motivata-node-backend | msg: 'contact.email must be valid email',
0|motivata-node-backend | path: 'contact.email',
0|motivata-node-backend | location: 'body'
0|motivata-node-backend | }
0|motivata-node-backend | ]
0|motivata-node-backend | }
0|motivata-node-backend | [WHATSAPP] ✗ Failed to send message to 9179621765
0|motivata-node-backend | [WHATSAPP] Error details: { message: 'Validation failed', code: undefined }
0|motivata-node-backend | [WHATSAPP] ✗ 9179621765: Failed to send WhatsApp message to 9179621765: Validation failed
0|motivata-node-backend | [WHATSAPP] ⚠ Bulk send complete: 0 succeeded, 1 failed
0|motivata-node-backend | [WEBHOOK-NOTIFY] ✓ WhatsApp notifications sent successfully
0|motivata-node-backend | [WEBHOOK-NOTIFY] ℹ No emails to send (no ticket holders have email addresses)
0|motivata-node-backend | [WEBHOOK-NOTIFY] ✓ Notification process completed
0|motivata-node-backend | ✓ Payment processed. Users, enrollment, and emails sent successfully.
0|motivata-node-backend | === Webhook Processing Complete ===
