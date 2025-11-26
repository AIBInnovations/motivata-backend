```
 === Razorpay Webhook Received ===
 Timestamp: 2025-11-25T12:17:36.315Z
 Headers: {
   "connection": "upgrade",
   "host": "motivata.synquic.com",
   "content-length": "939",
   "user-agent": "Razorpay-Webhook/v1",
   "content-type": "application/json",
   "request-id": "RjyCdS5SNm93qh",
   "x-razorpay-event-id": "RjyCdS5SNm93qh",
   "x-razorpay-signature": "f944bdef8f9de2083ccd5efa407dd8dfa0694814b0d3fb72115ecbcd963037d3",
   "accept-encoding": "gzip"
 }
 Body type: Buffer
 Body length: 939
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
         "id": "pay_RjyCb1DEKn3DvH",
         "entity": "payment",
         "amount": 49900,
         "currency": "INR",
         "status": "captured",
         "order_id": "order_RjyCRSUMh8Gtet",
         "invoice_id": null,
         "international": false,
         "method": "upi",
         "amount_refunded": 0,
         "refund_status": null,
         "captured": true,
         "description": "#RjyCQ8uU2hIUjf",
         "card_id": null,
         "bank": null,
         "wallet": null,
         "vpa": "success@razorpay",
         "email": "void@razorpay.com",
         "contact": "+919644400090",
         "notes": {
           "type": "EVENT",
           "orderId": "order_RjyCPVAwhyc2rc"
         },
         "fee": 1178,
         "tax": 180,
         "error_code": null,
         "error_description": null,
         "error_source": null,
         "error_step": null,
         "error_reason": null,
         "acquirer_data": {
           "rrn": "997107059899",
           "upi_transaction_id": "AE0A9705B8296ED528D1124101324E0B"
         },
         "created_at": 1764073054,
         "reward": null,
         "upi": {
           "vpa": "success@razorpay",
           "flow": "collect"
         },
         "base_amount": 49900
       }
     }
   },
   "created_at": 1764073055
 }
 Signature: f944bdef8f9de2083ccd5efa407dd8dfa0694814b0d3fb72115ecbcd963037d3
 === Webhook Signature Verification Debug ===
 ✓ Webhook secret loaded: 0HG40EiS...
 ✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
 ✓ Received signature: f944bdef8f9de208...
 ✓ Raw body type: Buffer
 ✓ Raw body length: 939
 ✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"payment.captured","contains":["payment"...
 ✓ Expected signature: f944bdef8f9de208...
 ✓ Signatures match: true
 ===========================================
 ✓ Webhook signature verified
 Processing payment.captured event
 Payment not found for order: order_RjyCRSUMh8Gtet
 === Webhook Processing Complete ===
 === Razorpay Webhook Received ===
 Timestamp: 2025-11-25T12:17:36.453Z
 Headers: {
   "connection": "upgrade",
   "host": "motivata.synquic.com",
   "content-length": "1249",
   "user-agent": "Razorpay-Webhook/v1",
   "content-type": "application/json",
   "request-id": "RjyCdjkD3sR7DE",
   "x-razorpay-event-id": "RjyCdjkD3sR7DE",
   "x-razorpay-signature": "e48ed37703b24b5bb20b4ec57fac07bc609ef0baf9406bbafcf29e7ec4661561",
   "accept-encoding": "gzip"
 }
 Body type: Buffer
 Body length: 1249
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
         "id": "pay_RjyCb1DEKn3DvH",
         "entity": "payment",
         "amount": 49900,
         "currency": "INR",
         "status": "captured",
         "order_id": "order_RjyCRSUMh8Gtet",
         "invoice_id": null,
         "international": false,
         "method": "upi",
         "amount_refunded": 0,
         "refund_status": null,
         "captured": true,
         "description": "#RjyCQ8uU2hIUjf",
         "card_id": null,
         "bank": null,
         "wallet": null,
         "vpa": "success@razorpay",
         "email": "void@razorpay.com",
         "contact": "+919644400090",
         "notes": {
           "type": "EVENT",
           "orderId": "order_RjyCPVAwhyc2rc"
         },
         "fee": 1178,
         "tax": 180,
         "error_code": null,
         "error_description": null,
         "error_source": null,
         "error_step": null,
         "error_reason": null,
         "acquirer_data": {
           "rrn": "997107059899",
           "upi_transaction_id": "AE0A9705B8296ED528D1124101324E0B"
         },
         "created_at": 1764073054,
         "reward": null,
         "upi": {
           "vpa": "success@razorpay",
           "flow": "collect"
         }
       }
     },
     "order": {
       "entity": {
         "id": "order_RjyCRSUMh8Gtet",
         "entity": "order",
         "amount": 49900,
         "amount_paid": 49900,
         "amount_due": 0,
         "currency": "INR",
         "receipt": "order_RjyCPVAwhyc2rc",
         "offer_id": null,
         "status": "paid",
         "attempts": 1,
         "notes": {
           "type": "EVENT",
           "orderId": "order_RjyCPVAwhyc2rc"
         },
         "created_at": 1764073045,
         "description": null,
         "checkout": null
       }
     }
   },
   "created_at": 1764073055
 }
 Signature: e48ed37703b24b5bb20b4ec57fac07bc609ef0baf9406bbafcf29e7ec4661561
 === Webhook Signature Verification Debug ===
 ✓ Webhook secret loaded: 0HG40EiS...
 ✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
 ✓ Received signature: e48ed37703b24b5b...
 ✓ Raw body type: Buffer
 ✓ Raw body length: 1249
 ✓ Body string preview: {"entity":"event","account_id":"acc_RdiBnj4J9keY0B","event":"order.paid","contains":["payment","orde...
 ✓ Expected signature: e48ed37703b24b5b...
 ✓ Signatures match: true
 ===========================================
 ✓ Webhook signature verified
 Processing order.paid event
 Payment not found for order: order_RjyCRSUMh8Gtet
 === Webhook Processing Complete ===
 === Razorpay Webhook Received ===
 Timestamp: 2025-11-25T12:17:37.019Z
 Headers: {
   "connection": "upgrade",
   "host": "motivata.synquic.com",
   "content-length": "2154",
   "user-agent": "Razorpay-Webhook/v1",
   "content-type": "application/json",
   "request-id": "RjyCeEuvhQiLiN",
   "x-razorpay-event-id": "RjyCeEuvhQiLiN",
   "x-razorpay-signature": "679f5c2d448b3f21c2d97e401ab6f4e4027d349a9ebb7f7da259fa9abba326f4",
   "accept-encoding": "gzip"
 }
 Body type: Buffer
 Body length: 2154
 Event: payment_link.paid
 Payload: {
   "account_id": "acc_RdiBnj4J9keY0B",
   "contains": [
     "payment_link",
     "order",
     "payment"
   ],
   "created_at": 1764073043,
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
         "created_at": 1764073045,
         "currency": "INR",
         "description": null,
         "entity": "order",
         "id": "order_RjyCRSUMh8Gtet",
         "notes": {
           "orderId": "order_RjyCPVAwhyc2rc",
           "type": "EVENT"
         },
         "offer_id": null,
         "receipt": "order_RjyCPVAwhyc2rc",
         "status": "paid"
       }
     },
     "payment": {
       "entity": {
         "acquirer_data": {
           "rrn": "997107059899",
           "upi_transaction_id": "AE0A9705B8296ED528D1124101324E0B"
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
         "created_at": 1764073054,
         "currency": "INR",
         "description": "#RjyCQ8uU2hIUjf",
         "email": "void@razorpay.com",
         "entity": "payment",
         "error_code": null,
         "error_description": null,
         "error_reason": null,
         "error_source": null,
         "error_step": null,
         "fee": 1178,
         "fee_bearer": "platform",
         "id": "pay_RjyCb1DEKn3DvH",
         "international": false,
         "invoice_id": null,
         "method": "upi",
         "notes": {
           "orderId": "order_RjyCPVAwhyc2rc",
           "type": "EVENT"
         },
         "order_id": "order_RjyCRSUMh8Gtet",
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
         "created_at": 1764073043,
         "currency": "INR",
         "customer": {
           "contact": "1234567890",
           "email": "email@email.email",
           "name": "Akshat Jain"
         },
         "description": "Payment for EVENT",
         "expire_by": 0,
         "expired_at": 0,
         "first_min_partial_amount": 0,
         "id": "plink_RjyCQ8uU2hIUjf",
         "notes": {
           "orderId": "order_RjyCPVAwhyc2rc",
           "type": "EVENT"
         },
         "notify": {
           "email": false,
           "sms": false,
           "whatsapp": false
         },
         "order_id": "order_RjyCRSUMh8Gtet",
         "reference_id": "order_RjyCPVAwhyc2rc",
         "reminder_enable": false,
         "reminders": {},
         "short_url": "https://rzp.io/rzp/TOVLS3T9",
         "status": "paid",
         "updated_at": 1764073056,
         "upi_link": false,
         "user_id": "",
         "whatsapp_link": false
       }
     }
   }
 }
 Signature: 679f5c2d448b3f21c2d97e401ab6f4e4027d349a9ebb7f7da259fa9abba326f4
 === Webhook Signature Verification Debug ===
 ✓ Webhook secret loaded: 0HG40EiS...
 ✓ Using secret type: RAZORPAY_WEBHOOK_SECRET
 ✓ Received signature: 679f5c2d448b3f21...
 ✓ Raw body type: Buffer
 ✓ Raw body length: 2154
 ✓ Body string preview: {"account_id":"acc_RdiBnj4J9keY0B","contains":["payment_link","order","payment"],"created_at":176407...
 ✓ Expected signature: 679f5c2d448b3f21...
 ✓ Signatures match: true
 ===========================================
 ✓ Webhook signature verified
 Processing payment_link.paid event
 ✓ Payment link paid for order: order_RjyCPVAwhyc2rc
 ✓ Event seats decremented for event: 6921b303b9da6ec41e895ae6
 === Webhook Processing Complete ===
```
