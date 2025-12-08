ubuntu@ip-172-31-3-206:~/motivata-backend$ pm2 logs motivata-node-backend --lines 500
[TAILING] Tailing last 500 lines for [motivata-node-backend] process (change the value with --lines option)
/home/ubuntu/.pm2/logs/motivata-node-backend-error.log last 500 lines:
[SESSION-PAYMENT] Create order error: Error: SessionBooking validation failed: userEmail: User email is required
at ValidationError.inspect (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/error/validation.js:52:26)
at formatValue (node:internal/util/inspect:829:19)
at inspect (node:internal/util/inspect:372:10)
at formatWithOptionsInternal (node:internal/util/inspect:2334:40)
at formatWithOptions (node:internal/util/inspect:2196:10)
at console.value (node:internal/console/constructor:350:14)
at console.warn (node:internal/console/constructor:383:61)
at createSessionOrder (file:///home/ubuntu/motivata-backend/src/Session/session.payment.controller.js:231:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
errors: {
userEmail: ValidatorError: User email is required
at validate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1417:13)
at SchemaType.doValidate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1401:7)
at /home/ubuntu/motivata-backend/node_modules/mongoose/lib/document.js:3115:18
at process.processTicksAndRejections (node:internal/process/task_queues:77:11) {
properties: [Object],
kind: 'required',
path: 'userEmail',
value: '',
reason: undefined,
[Symbol(mongoose#validatorError)]: true
}
},
\_message: 'SessionBooking validation failed'
}
[SESSION-PAYMENT] Create order error: Error: SessionBooking validation failed: userEmail: User email is required
at ValidationError.inspect (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/error/validation.js:52:26)
at formatValue (node:internal/util/inspect:829:19)
at inspect (node:internal/util/inspect:372:10)
at formatWithOptionsInternal (node:internal/util/inspect:2334:40)
at formatWithOptions (node:internal/util/inspect:2196:10)
at console.value (node:internal/console/constructor:350:14)
at console.warn (node:internal/console/constructor:383:61)
at createSessionOrder (file:///home/ubuntu/motivata-backend/src/Session/session.payment.controller.js:231:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
errors: {
userEmail: ValidatorError: User email is required
at validate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1417:13)
at SchemaType.doValidate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1401:7)
at /home/ubuntu/motivata-backend/node_modules/mongoose/lib/document.js:3115:18
at process.processTicksAndRejections (node:internal/process/task_queues:77:11) {
properties: [Object],
kind: 'required',
path: 'userEmail',
value: '',
reason: undefined,
[Symbol(mongoose#validatorError)]: true
}
},
\_message: 'SessionBooking validation failed'
}
[SESSION-PAYMENT] Create order error: Error: SessionBooking validation failed: userEmail: User email is required
at ValidationError.inspect (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/error/validation.js:52:26)
at formatValue (node:internal/util/inspect:829:19)
at inspect (node:internal/util/inspect:372:10)
at formatWithOptionsInternal (node:internal/util/inspect:2334:40)
at formatWithOptions (node:internal/util/inspect:2196:10)
at console.value (node:internal/console/constructor:350:14)
at console.warn (node:internal/console/constructor:383:61)
at createSessionOrder (file:///home/ubuntu/motivata-backend/src/Session/session.payment.controller.js:231:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
errors: {
userEmail: ValidatorError: User email is required
at validate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1417:13)
at SchemaType.doValidate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1401:7)
at /home/ubuntu/motivata-backend/node_modules/mongoose/lib/document.js:3115:18
at process.processTicksAndRejections (node:internal/process/task_queues:77:11) {
properties: [Object],
kind: 'required',
path: 'userEmail',
value: '',
reason: undefined,
[Symbol(mongoose#validatorError)]: true
}
},
\_message: 'SessionBooking validation failed'
}
[SESSION-PAYMENT] Create order error: Error: SessionBooking validation failed: userEmail: User email is required
at ValidationError.inspect (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/error/validation.js:52:26)
at formatValue (node:internal/util/inspect:829:19)
at inspect (node:internal/util/inspect:372:10)
at formatWithOptionsInternal (node:internal/util/inspect:2334:40)
at formatWithOptions (node:internal/util/inspect:2196:10)
at console.value (node:internal/console/constructor:350:14)
at console.warn (node:internal/console/constructor:383:61)
at createSessionOrder (file:///home/ubuntu/motivata-backend/src/Session/session.payment.controller.js:231:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
errors: {
userEmail: ValidatorError: User email is required
at validate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1417:13)
at SchemaType.doValidate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1401:7)
at /home/ubuntu/motivata-backend/node_modules/mongoose/lib/document.js:3115:18
at process.processTicksAndRejections (node:internal/process/task_queues:77:11) {
properties: [Object],
kind: 'required',
path: 'userEmail',
value: '',
reason: undefined,
[Symbol(mongoose#validatorError)]: true
}
},
\_message: 'SessionBooking validation failed'
}
Payment not found for order: order_Rp54IQvJUXU1Q4
[SESSION-PAYMENT] Create order error: Error: SessionBooking validation failed: userEmail: User email is required
at ValidationError.inspect (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/error/validation.js:52:26)
at formatValue (node:internal/util/inspect:829:19)
at inspect (node:internal/util/inspect:372:10)
at formatWithOptionsInternal (node:internal/util/inspect:2334:40)
at formatWithOptions (node:internal/util/inspect:2196:10)
at console.value (node:internal/console/constructor:350:14)
at console.warn (node:internal/console/constructor:383:61)
at createSessionOrder (file:///home/ubuntu/motivata-backend/src/Session/session.payment.controller.js:231:13)
at process.processTicksAndRejections (node:internal/process/task_queues:95:5) {
errors: {
userEmail: ValidatorError: User email is required
at validate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1417:13)
at SchemaType.doValidate (/home/ubuntu/motivata-backend/node_modules/mongoose/lib/schemaType.js:1401:7)
at /home/ubuntu/motivata-backend/node_modules/mongoose/lib/document.js:3115:18
at process.processTicksAndRejections (node:internal/process/task_queues:77:11) {
properties: [Object],
kind: 'required',
path: 'userEmail',
value: '',
reason: undefined,
[Symbol(mongoose#validatorError)]: true
}
},
\_message: 'SessionBooking validation failed'
}
Payment not found for order: order_Rp5N76ZYM75dBN
Payment not found for order: order_Rp5N76ZYM75dBN
Error fetching Razorpay order details: undefined
Payment not found for order: order_Rp65I3OnSGneiV
Payment not found for order: order_Rp65I3OnSGneiV
Error fetching Razorpay order details: undefined
Payment not found for order: order_Rp6Utw1zfICxgp
Payment not found for order: order_Rp6Utw1zfICxgp
Error fetching Razorpay order details: undefined
Error fetching Razorpay order details: undefined
[SESSION-WEBHOOK] ✗ Error confirming session booking: SessionBooking validation failed: userEmail: User email is required
Payment not found for order: order_Rp6giGkBAkhgE7
Payment not found for order: order_Rp6giGkBAkhgE7
Payment not found for order: order_Rp71ACiILzaij7
Payment not found for order: order_Rp71ACiILzaij7
Error fetching Razorpay order details: undefined
[SESSION-WEBHOOK] ✗ Error confirming session booking: SessionBooking validation failed: userEmail: User email is required

/home/ubuntu/.pm2/logs/motivata-node-backend-out.log last 500 lines:
"buyer_phone": "7987559704",
"sessionTitle": "test",
"bookingReference": "SB-NUAES7"
},
"fee": 3540,
"tax": 540,
"error_code": null,
"error_description": null,
"error_source": null,
"error_step": null,
"error_reason": null,
"acquirer_data": {
"rrn": "686706968808",
"upi_transaction_id": "5FE10060AEE37082A5CCE9F7E1B2F5D4"
},
"emi_plan": null,
"created_at": 1765194664,
"reward": null,
"upi": {
"vpa": "success@razorpay",
"flow": "collect"
},
"base_amount": 150000
}
}
},
"created_at": 1765194666
}
Signature: 04d04ed6b567dfc4755ed92b856b78ce751655d610174b645aec63c09616ba42
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: 04d04ed6b567dfc4...
✓ Raw body type: Buffer
✓ Raw body length: 1123
✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"payment.captured","contains":["payment"...
✓ Expected signature: 04d04ed6b567dfc4...
✓ Signatures match: true
===========================================
0|motivata |
✓ Webhook signature verified
Processing payment.captured event
=== Webhook Processing Complete ===
0|motivata |
[REQ] 2025-12-08T11:51:22.557Z | GET /api/web/razorpay/app-callback?razorpay_payment_id=pay_Rp6hARPeIfvQMu&razorpay_payment_link_id=plink_Rp6gf2OQ4RsNj1&razorpay_payment_link_reference_id=order_Rp6geHwqsrEPTl&razorpay_payment_link_status=paid&razorpay_signature=8372f245296b4108852d5eeeb16c25a7f1eb88c3775cb0c56b097784b5e92205 | Origin: N/A | IP: ::ffff:127.0.0.1
[APP-CALLBACK] Received: {
linkId: 'plink_Rp6gf2OQ4RsNj1',
status: 'paid',
paymentId: 'pay_Rp6hARPeIfvQMu'
}
[APP-CALLBACK] Redirecting to: motivata://payment/callback?status=paid&paymentId=pay_Rp6hARPeIfvQMu&linkId=plink_Rp6gf2OQ4RsNj1

=== Razorpay Webhook Received ===
Timestamp: 2025-12-08T12:10:23.155Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"x-real-ip": "52.66.75.174",
"x-forwarded-for": "52.66.75.174",
"x-forwarded-proto": "https",
"content-length": "1123",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "Rp71ZiqdEWusLa",
"x-razorpay-event-id": "Rp71ZiqdEWusLa",
"x-razorpay-signature": "77d96f63d4c2850860dd8ea49e3886c609e02f8daebf9d97f14432b37d729e1a",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 1123
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
"id": "pay_Rp71WNLQjxbMsB",
"entity": "payment",
"amount": 150000,
"currency": "INR",
"status": "captured",
"order_id": "order_Rp71ACiILzaij7",
"invoice_id": null,
"international": false,
"method": "upi",
"amount_refunded": 0,
"refund_status": null,
"captured": true,
"description": "#Rp716LigRuUJjD",
"card_id": null,
"bank": null,
"wallet": null,
"vpa": "success@razorpay",
"email": "void@razorpay.com",
"contact": "+917987559704",
"notes": {
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87",
"sessionId": "6933d6dee26d1b538abb1f48",
"buyer_name": "Test Uzer",
"buyer_email": "",
"buyer_phone": "7987559704",
"sessionTitle": "test",
"bookingReference": "SB-IXZ3JM"
},
"fee": 3540,
"tax": 540,
"error_code": null,
"error_description": null,
"error_source": null,
"error_step": null,
"error_reason": null,
"acquirer_data": {
"rrn": "518157940107",
"upi_transaction_id": "769056DE92740598178DCCA92E2B6A54"
},
"emi_plan": null,
"created_at": 1765195820,
"reward": null,
"upi": {
"vpa": "success@razorpay",
"flow": "collect"
},
"base_amount": 150000
}
}
},
"created_at": 1765195822
}
Signature: 77d96f63d4c2850860dd8ea49e3886c609e02f8daebf9d97f14432b37d729e1a
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: 77d96f63d4c28508...
✓ Raw body type: Buffer
✓ Raw body length: 1123
✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"payment.captured","contains":["payment"...
✓ Expected signature: 77d96f63d4c28508...
✓ Signatures match: true
===========================================
0|motivata |
✓ Webhook signature verified
Processing payment.captured event
=== Webhook Processing Complete ===
0|motivata |
[REQ] 2025-12-08T12:10:23.506Z | POST /api/web/razorpay/webhook | Origin: N/A | IP: ::ffff:127.0.0.1
=== Razorpay Webhook Received ===
Timestamp: 2025-12-08T12:10:23.507Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"x-real-ip": "52.66.75.174",
"x-forwarded-for": "52.66.75.174",
"x-forwarded-proto": "https",
"content-length": "1600",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "Rp71aDrxKm1ezc",
"x-razorpay-event-id": "Rp71aDrxKm1ezc",
"x-razorpay-signature": "b126317fef3969218644fbc86fd74a67fc658c877d2b0d631806750717456749",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 1600
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
"id": "pay_Rp71WNLQjxbMsB",
"entity": "payment",
"amount": 150000,
"currency": "INR",
"status": "captured",
"order_id": "order_Rp71ACiILzaij7",
"invoice_id": null,
"international": false,
"method": "upi",
"amount_refunded": 0,
"refund_status": null,
"captured": true,
"description": "#Rp716LigRuUJjD",
"card_id": null,
"bank": null,
"wallet": null,
"vpa": "success@razorpay",
"email": "void@razorpay.com",
"contact": "+917987559704",
"notes": {
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87",
"sessionId": "6933d6dee26d1b538abb1f48",
"buyer_name": "Test Uzer",
"buyer_email": "",
"buyer_phone": "7987559704",
"sessionTitle": "test",
"bookingReference": "SB-IXZ3JM"
},
"fee": 3540,
"tax": 540,
"error_code": null,
"error_description": null,
"error_source": null,
"error_step": null,
"error_reason": null,
"acquirer_data": {
"rrn": "518157940107",
"upi_transaction_id": "769056DE92740598178DCCA92E2B6A54"
},
"emi_plan": null,
"created_at": 1765195820,
"reward": null,
"upi": {
"vpa": "success@razorpay",
"flow": "collect"
}
}
},
"order": {
"entity": {
"id": "order_Rp71ACiILzaij7",
"entity": "order",
"amount": 150000,
"amount_paid": 150000,
"amount_due": 0,
"currency": "INR",
"receipt": "order_Rp715hkQgw7CMi",
"offer_id": null,
"status": "paid",
"attempts": 1,
"notes": {
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87",
"sessionId": "6933d6dee26d1b538abb1f48",
"buyer_name": "Test Uzer",
"buyer_email": "",
"buyer_phone": "7987559704",
"sessionTitle": "test",
"bookingReference": "SB-IXZ3JM"
},
"created_at": 1765195799,
"description": null,
"checkout": null
}
}
},
"created_at": 1765195822
}
Signature: b126317fef3969218644fbc86fd74a67fc658c877d2b0d631806750717456749
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: b126317fef396921...
✓ Raw body type: Buffer
✓ Raw body length: 1600
✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"order.paid","contains":["payment","orde...
✓ Expected signature: b126317fef396921...
✓ Signatures match: true
===========================================
0|motivata |
✓ Webhook signature verified
Processing order.paid event
=== Webhook Processing Complete ===
0|motivata |
[REQ] 2025-12-08T12:10:24.102Z | POST /api/web/razorpay/webhook | Origin: N/A | IP: ::ffff:127.0.0.1
=== Razorpay Webhook Received ===
Timestamp: 2025-12-08T12:10:24.102Z
Headers: {
"connection": "upgrade",
"host": "motivata.synquic.com",
"x-real-ip": "52.66.75.174",
"x-forwarded-for": "52.66.75.174",
"x-forwarded-proto": "https",
"content-length": "2620",
"user-agent": "Razorpay-Webhook/v1",
"content-type": "application/json",
"request-id": "Rp71amTwQknF4C",
"x-razorpay-event-id": "Rp71amTwQknF4C",
"x-razorpay-signature": "f849fcf4b013da47fddc06a6228ea2e23a14c004752b59a7f358d8d2823b2a9f",
"accept-encoding": "gzip"
}
Body type: Buffer
Body length: 2620
Event: payment_link.paid
Payload: {
"account_id": "acc_RdiBnj4J9keY0B",
"contains": [
"payment_link",
"order",
"payment"
],
"created_at": 1765195796,
"entity": "event",
"event": "payment_link.paid",
"payload": {
"order": {
"entity": {
"amount": 150000,
"amount_due": 0,
"amount_paid": 150000,
"attempts": 1,
"checkout": null,
"created_at": 1765195799,
"currency": "INR",
"description": null,
"entity": "order",
"id": "order_Rp71ACiILzaij7",
"notes": {
"bookingReference": "SB-IXZ3JM",
"buyer_email": "",
"buyer_name": "Test Uzer",
"buyer_phone": "7987559704",
"sessionId": "6933d6dee26d1b538abb1f48",
"sessionTitle": "test",
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87"
},
"offer_id": null,
"receipt": "order_Rp715hkQgw7CMi",
"status": "paid"
}
},
"payment": {
"entity": {
"acquirer_data": {
"rrn": "518157940107",
"upi_transaction_id": "769056DE92740598178DCCA92E2B6A54"
},
"amount": 150000,
"amount_refunded": 0,
"amount_transferred": 0,
"bank": null,
"base_amount": 150000,
"captured": true,
"card": null,
"card_id": null,
"contact": "+917987559704",
"created_at": 1765195820,
"currency": "INR",
"description": "#Rp716LigRuUJjD",
"email": "void@razorpay.com",
"entity": "payment",
"error_code": null,
"error_description": null,
"error_reason": null,
"error_source": null,
"error_step": null,
"fee": 3540,
"fee_bearer": "platform",
"id": "pay_Rp71WNLQjxbMsB",
"international": false,
"invoice_id": null,
"method": "upi",
"notes": {
"bookingReference": "SB-IXZ3JM",
"buyer_email": "",
"buyer_name": "Test Uzer",
"buyer_phone": "7987559704",
"sessionId": "6933d6dee26d1b538abb1f48",
"sessionTitle": "test",
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87"
},
"order_id": "order_Rp71ACiILzaij7",
"refund_status": null,
"status": "captured",
"tax": 540,
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
"amount": 150000,
"amount_paid": 150000,
"callback_method": "get",
"callback_url": "https://motivata.synquic.com/api/web/razorpay/app-callback",
"cancelled_at": 0,
"created_at": 1765195796,
"currency": "INR",
"customer": {
"contact": "7987559704",
"name": "Test Uzer"
},
"description": "Session Booking: test",
"expire_by": 0,
"expired_at": 0,
"first_min_partial_amount": 0,
"id": "plink_Rp716LigRuUJjD",
"notes": {
"bookingReference": "SB-IXZ3JM",
"buyer_email": "",
"buyer_name": "Test Uzer",
"buyer_phone": "7987559704",
"sessionId": "6933d6dee26d1b538abb1f48",
"sessionTitle": "test",
"type": "SESSION",
"userId": "6936b35e9af5c8a47c0d8c87"
},
"notify": {
"email": false,
"sms": false,
"whatsapp": false
},
"order_id": "order_Rp71ACiILzaij7",
"reference_id": "order_Rp715hkQgw7CMi",
"reminder_enable": false,
"reminders": {},
"short_url": "https://rzp.io/rzp/tppSH5Qq",
"status": "paid",
"updated_at": 1765195822,
"upi_link": false,
"user_id": "",
"whatsapp_link": false
}
}
}
}
Signature: f849fcf4b013da47fddc06a6228ea2e23a14c004752b59a7f358d8d2823b2a9f
=== Webhook Signature Verification Debug ===
✓ Webhook secret loaded: 0HG40EiS...
✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
✓ Received signature: f849fcf4b013da47...
✓ Raw body type: Buffer
✓ Raw body length: 2620
✓ Body string preview: {"account_id":"acc_RdiBnj4J9keY0B","contains":["payment_link","order","payment"],"created_at":176519...
✓ Expected signature: f849fcf4b013da47...
✓ Signatures match: true
===========================================
0|motivata |
✓ Webhook signature verified
Processing payment_link.paid event
✓ Payment link paid for order: order_Rp715hkQgw7CMi
[SESSION-WEBHOOK] Starting session booking confirmation for payment: order_Rp715hkQgw7CMi
✓ Session payment processed successfully.
=== Webhook Processing Complete ===
0|motivata |
[REQ] 2025-12-08T12:10:38.736Z | GET /api/web/razorpay/app-callback?razorpay_payment_id=pay_Rp71WNLQjxbMsB&razorpay_payment_link_id=plink_Rp716LigRuUJjD&razorpay_payment_link_reference_id=order_Rp715hkQgw7CMi&razorpay_payment_link_status=paid&razorpay_signature=0c447610ee4476e322e16261db9af07ef0ae161cfaa29cafa2f20b5f9f6bea82 | Origin: N/A | IP: ::ffff:127.0.0.1
[APP-CALLBACK] Received: {
linkId: 'plink_Rp716LigRuUJjD',
status: 'paid',
paymentId: 'pay_Rp71WNLQjxbMsB'
}
[APP-CALLBACK] Redirecting to: motivata://payment/callback?status=paid&paymentId=pay_Rp71WNLQjxbMsB&linkId=plink_Rp716LigRuUJjD
