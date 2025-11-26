0|motivata | > Environment variables validated
0|motivata | > MongoDB Connected
0|motivata | > Server is running on port 3000

✓ Razorpay SDK initialized
=== Razorpay Webhook Received ===
Timestamp: 2025-11-26T07:24:31.809Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"content-length": "1078",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "RkHkAmAssZYStB",
"x-razorpay-event-id": "RkHkAmAssZYStB",
"x-razorpay-signature": "605dbe3c3c543f080428ce7f9bdf20691c32bb7d0fddb7794e15ba21a0d86af2",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 1078
Event: payment.captured
Payload: {
"entity": "event",
"account_id": "acc_RdiBnj4J9keY0B",
"event": "payment.captured",
"contains": [
"payment"
],
"payload": {
"payment": {
"entity": {
"id": "pay_RkHk8MA9kbrU5t",
"entity": "payment",
"amount": 49900,
"currency": "INR",
"status": "captured",
"order_id": "order_RkHjzngEtKeKV3",
"invoice_id": null,
"international": false,
"method": "upi",
"amount_refunded": 0,
"refund_status": null,
"captured": true,
"description": "#RkHjyC1shKSDyv",
"card_id": null,
"bank": null,
"wallet": null,
"vpa": "success@razorpay",
"email": "void@razorpay.com",
"contact": "+919644400090",
"notes": {
"type": "EVENT",
"orderId": "order_RkHjxjIdDYsgV4",
"eventName": "UTSAV 2025",
"buyer_name": "Akshat Jain",
"buyer_email": "aibinnovations@gmail.com",
"buyer_phone": "9179621765",
"totalTickets": "1"
},
"fee": 1178,
"tax": 180,
"error_code": null,
"error_description": null,
"error_source": null,
"error_step": null,
"error_reason": null,
"acquirer_data": {
"rrn": "104768889273",
"upi_transaction_id": "1162E23DF996D214ACBE09599604993E"
},
"created_at": 1764141870,
"reward": null,
"upi": {
"vpa": "success@razorpay",
"flow": "collect"
},
"base_amount": 49900
}
}
},
"created_at": 1764141871
}
Signature: 605dbe3c3c543f080428ce7f9bdf20691c32bb7d0fddb7794e15ba21a0d86af2
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: 605dbe3c3c543f08...
✓ Raw body type: Buffer
✓ Raw body length: 1078
✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"payment.captured","contains":["payment"...
✓ Expected signature: 605dbe3c3c543f08...
✓ Signatures match: true
===========================================
✓ Webhook signature verified
Processing payment.captured event
Payment not found for order: order_RkHjzngEtKeKV3
=== Webhook Processing Complete ===
=== Razorpay Webhook Received ===
Timestamp: 2025-11-26T07:24:32.099Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"content-length": "1527",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "RkHkB5M5yXijro",
"x-razorpay-event-id": "RkHkB5M5yXijro",
"x-razorpay-signature": "c2b44dd82be7af73350603284dee205d9b8fad0d83566aac4674868d674e3322",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 1527
Event: order.paid
Payload: {
"entity": "event",
"account_id": "acc_RdiBnj4J9keY0B",
"event": "order.paid",
"contains": [
"payment",
"order"
],
"payload": {
"payment": {
"entity": {
"id": "pay_RkHk8MA9kbrU5t",
"entity": "payment",
"amount": 49900,
"currency": "INR",
"status": "captured",
"order_id": "order_RkHjzngEtKeKV3",
"invoice_id": null,
"international": false,
"method": "upi",
"amount_refunded": 0,
"refund_status": null,
"captured": true,
"description": "#RkHjyC1shKSDyv",
"card_id": null,
"bank": null,
"wallet": null,
"vpa": "success@razorpay",
"email": "void@razorpay.com",
"contact": "+919644400090",
"notes": {
"type": "EVENT",
"orderId": "order_RkHjxjIdDYsgV4",
"eventName": "UTSAV 2025",
"buyer_name": "Akshat Jain",
"buyer_email": "aibinnovations@gmail.com",
"buyer_phone": "9179621765",
"totalTickets": "1"
},
"fee": 1178,
"tax": 180,
"error_code": null,
"error_description": null,
"error_source": null,
"error_step": null,
"error_reason": null,
"acquirer_data": {
"rrn": "104768889273",
"upi_transaction_id": "1162E23DF996D214ACBE09599604993E"
},
"created_at": 1764141870,
"reward": null,
"upi": {
"vpa": "success@razorpay",
"flow": "collect"
}
}
},
"order": {
"entity": {
"id": "order_RkHjzngEtKeKV3",
"entity": "order",
"amount": 49900,
"amount_paid": 49900,
"amount_due": 0,
"currency": "INR",
"receipt": "order_RkHjxjIdDYsgV4",
"offer_id": null,
"status": "paid",
"attempts": 1,
"notes": {
"type": "EVENT",
"orderId": "order_RkHjxjIdDYsgV4",
"eventName": "UTSAV 2025",
"buyer_name": "Akshat Jain",
"buyer_email": "aibinnovations@gmail.com",
"buyer_phone": "9179621765",
"totalTickets": "1"
},
"created_at": 1764141861,
"description": null,
"checkout": null
}
}
},
"created_at": 1764141871
}
Signature: c2b44dd82be7af73350603284dee205d9b8fad0d83566aac4674868d674e3322
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: c2b44dd82be7af73...
✓ Raw body type: Buffer
✓ Raw body length: 1527
✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"order.paid","contains":["payment","orde...
✓ Expected signature: c2b44dd82be7af73...
✓ Signatures match: true
===========================================
✓ Webhook signature verified
Processing order.paid event
Payment not found for order: order_RkHjzngEtKeKV3
=== Webhook Processing Complete ===
=== Razorpay Webhook Received ===
Timestamp: 2025-11-26T07:24:32.589Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"content-length": "2583",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "RkHkBeEC6GSAmY",
"x-razorpay-event-id": "RkHkBeEC6GSAmY",
"x-razorpay-signature": "53a5b197b72ca316d1ae067224376436df6dc2e2b5b4f55296767426998b9409",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 2583
Event: payment_link.paid
Payload: {
"account_id": "acc_RdiBnj4J9keY0B",
"contains": [
"payment_link",
"order",
"payment"
],
"created_at": 1764141860,
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
"created_at": 1764141861,
"currency": "INR",
"description": null,
"entity": "order",
"id": "order_RkHjzngEtKeKV3",
"notes": {
"buyer_email": "aibinnovations@gmail.com",
"buyer_name": "Akshat Jain",
"buyer_phone": "9179621765",
"eventName": "UTSAV 2025",
"orderId": "order_RkHjxjIdDYsgV4",
"totalTickets": "1",
"type": "EVENT"
},
"offer_id": null,
"receipt": "order_RkHjxjIdDYsgV4",
"status": "paid"
}
},
"payment": {
"entity": {
"acquirer_data": {
"rrn": "104768889273",
"upi_transaction_id": "1162E23DF996D214ACBE09599604993E"
},
"amount": 49900,
"amount_refunded": 0,
"amount_transferred": 0,
"bank": null,
"base_amount": 49900,
"captured": true,
"card": null,
"card_id": null,
"contact": "+919644400090",
"created_at": 1764141870,
"currency": "INR",
"description": "#RkHjyC1shKSDyv",
"email": "void@razorpay.com",
"entity": "payment",
"error_code": null,
"error_description": null,
"error_reason": null,
"error_source": null,
"error_step": null,
"fee": 1178,
"fee_bearer": "platform",
"id": "pay_RkHk8MA9kbrU5t",
"international": false,
"invoice_id": null,
"method": "upi",
"notes": {
"buyer_email": "aibinnovations@gmail.com",
"buyer_name": "Akshat Jain",
"buyer_phone": "9179621765",
"eventName": "UTSAV 2025",
"orderId": "order_RkHjxjIdDYsgV4",
"totalTickets": "1",
"type": "EVENT"
},
"order_id": "order_RkHjzngEtKeKV3",
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
"created_at": 1764141860,
"currency": "INR",
"customer": {
"contact": "9179621765",
"email": "aibinnovations@gmail.com",
"name": "Akshat Jain"
},
"description": "Payment for UTSAV 2025",
"expire_by": 0,
"expired_at": 0,
"first_min_partial_amount": 0,
"id": "plink_RkHjyC1shKSDyv",
"notes": {
"buyer_email": "aibinnovations@gmail.com",
"buyer_name": "Akshat Jain",
"buyer_phone": "9179621765",
"eventName": "UTSAV 2025",
"orderId": "order_RkHjxjIdDYsgV4",
"totalTickets": "1",
"type": "EVENT"
},
"notify": {
"email": false,
"sms": false,
"whatsapp": false
},
"order_id": "order_RkHjzngEtKeKV3",
"reference_id": "order_RkHjxjIdDYsgV4",
"reminder_enable": false,
"reminders": {},
"short_url": "https://rzp.io/rzp/KJ3LFTMX",
"status": "paid",
"updated_at": 1764141871,
"upi_link": false,
"user_id": "",
"whatsapp_link": false
}
}
}
}
Signature: 53a5b197b72ca316d1ae067224376436df6dc2e2b5b4f55296767426998b9409
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: 53a5b197b72ca316...
✓ Raw body type: Buffer
✓ Raw body length: 2583
✓ Body string preview: {"account_id":"acc_RdiBnj4J9keY0B","contains":["payment_link","order","payment"],"created_at":176414...
✓ Expected signature: 53a5b197b72ca316...
✓ Signatures match: true
===========================================
✓ Webhook signature verified
Processing payment_link.paid event
✓ Fetched Razorpay order: order_RkHjzngEtKeKV3
No payments found in order, storing payment link entity only
✓ Payment link paid for order: order_RkHjxjIdDYsgV4
[ENROLLMENT] Starting enrollment creation for payment: order_RkHjxjIdDYsgV4
[ENROLLMENT] Buyer details: {
name: 'Akshat Jain',
email: 'aibinnovations@gmail.com',
phone: '9179621765'
}
[USER-CREATION] Checking if user exists with phone: 9179621765
[USER-CREATION] User found with phone 9179621765: {
userId: new ObjectId('6926a892da8f1668700cce1f'),
name: 'Gandhi Ji',
email: 'aibinnovations@gmailcom'
}
[ENROLLMENT] Enrollment already exists for this user and event
✓ Payment processed. Users, enrollment, and emails sent successfully.
=== Webhook Processing Complete ===
