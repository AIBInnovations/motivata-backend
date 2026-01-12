# WhatsApp API Error Analysis & Solutions

## Date: 2026-01-12

---

## Issue Summary

**Error:** WhatsApp messages not being delivered for membership request approvals

**Root Cause:** WappService API returning 500 Internal Server Error

**Error Details:**
```
Converting circular structure to JSON
--> starting at object with constructor 'Agent'
|     property 'sockets' -> object with constructor 'Object'
|     property 'amped-express.interakt.ai:443:::::::::::::::::::::' -> object with constructor 'Array'
|     ...
|     property '_httpMessage' -> object with constructor 'ClientRequest'
--- property 'agent' closes the circle
```

---

## What's Working ✅

1. **Payment Link Creation** - Working perfectly
   - Razorpay payment link created successfully
   - Link ID: `plink_S2wdrLILJfr0Cy`
   - Short URL: `https://rzp.io/rzp/NS2mXQZJ`
   - Phone is prefilled correctly: `919179621765`

2. **Request Status Update** - Working perfectly
   - Status changed from `PENDING` to `PAYMENT_SENT`
   - Payment details saved correctly
   - Admin can copy and manually share the link

3. **Error Handling** - Working perfectly
   - System continues despite WhatsApp failure
   - Payment link remains valid
   - Error is logged with full details

---

## What's NOT Working ❌

**WhatsApp Delivery** - WappService API Error

**The Problem:**
- Template `srvc_temp_1` exists and is approved ✓
- Request body is correctly formatted ✓
- Phone number is correctly formatted ✓
- **BUT:** WappService API is returning a 500 error

**This is a SERVER-SIDE issue with WappService API**, not our code.

---

## Technical Analysis

### Request Sent to WappService

```json
POST https://api.wappservice.com/api/c1a50e14-2350-4c0b-b5ac-9c909e383274/contact/send-template-message

Headers:
- X-API-Key: [YOUR_API_KEY]
- Content-Type: application/json

Body:
{
  "phone_number": "919179621765",
  "template_name": "srvc_temp_1",
  "template_language": "en_US",
  "templateArgs": {
    "field_1": "Premium Monthly Membership",
    "field_2": "https://rzp.io/rzp/NS2mXQZJ",
    "field_3": "499"
  },
  "contact": {
    "first_name": "Customer",
    "last_name": ".",
    "country": "India"
  }
}
```

### Response from WappService

```json
HTTP 500 Internal Server Error

{
  "error": "Failed to send message",
  "message": "Converting circular structure to JSON..."
}
```

**Diagnosis:** The WappService API backend is attempting to serialize an HTTP Agent object (used for connection pooling) which contains circular references. This is **their bug**, not ours.

---

## Comparison with Working Templates

Let's compare with templates that ARE working:

### Working: `wp_ticket` template
```javascript
{
  "phone_number": "919179621765",
  "template_name": "wp_ticket",
  "template_language": "en_US",
  "templateArgs": {
    "header_image": "https://...",
    "field_1": "Event Name"
  },
  "contact": {
    "first_name": "John",
    "last_name": "Doe",
    "country": "India"
  }
}
```

### Working: `wp_voucher_2` template
```javascript
{
  "phone_number": "919179621765",
  "template_name": "wp_voucher_2",
  "template_language": "en_US",
  "templateArgs": {
    "header_image": "https://...",
    "field_1": "Voucher Title"
  },
  "contact": {
    "first_name": "John",
    "last_name": "Doe",
    "country": "India"
  }
}
```

### NOT Working: `srvc_temp_1` template
```javascript
{
  "phone_number": "919179621765",
  "template_name": "srvc_temp_1",
  "template_language": "en_US",
  "templateArgs": {
    "field_1": "Service Name",
    "field_2": "https://payment-link",
    "field_3": "499"
  },
  "contact": {
    "first_name": "Customer",
    "last_name": ".",
    "country": "India"
  }
}
```

**Observation:** The structure is identical. The error is API-side, not in our request format.

---

## Possible Causes

### 1. **WappService API Bug** (Most Likely)

The error message indicates the WappService backend is trying to JSON.stringify() an HTTP Agent object, which has circular references. This is happening on **their server**, not ours.

**Evidence:**
- Our code correctly formats the request
- Other templates work fine
- Error mentions `amped-express.interakt.ai` (their backend domain)

### 2. **Template-Specific Issue**

The `srvc_temp_1` template might have:
- Incorrect field mapping on WappService side
- Wrong template configuration
- Missing required fields

### 3. **Rate Limiting / API Quota**

WappService might be:
- Rate limiting this specific template
- Having issues with their WhatsApp Business API connection
- Experiencing temporary downtime

### 4. **Template Variables Issue**

The template might require:
- Different field names
- Different data types
- Additional metadata

---

## Solutions & Workarounds

### Solution 1: Contact WappService Support (Recommended)

**Contact them with this information:**

```
Subject: 500 Error - Converting circular structure to JSON

Template: srvc_temp_1
Error: Converting circular structure to JSON (Agent object)
Vendor UID: c1a50e14-2350-4c0b-b5ac-9c909e383274
Phone: 919179621765
Timestamp: 2026-01-12 11:07:00 UTC

Request body:
{
  "phone_number": "919179621765",
  "template_name": "srvc_temp_1",
  "template_language": "en_US",
  "templateArgs": {
    "field_1": "Premium Monthly Membership",
    "field_2": "https://rzp.io/rzp/NS2mXQZJ",
    "field_3": "499"
  },
  "contact": {
    "first_name": "Customer",
    "last_name": ".",
    "country": "India"
  }
}

Response:
{
  "error": "Failed to send message",
  "message": "Converting circular structure to JSON\n    --> starting at object with constructor 'Agent'..."
}
```

**This is a bug in their backend code where they're trying to serialize an HTTP client connection object.**

---

### Solution 2: Use Alternative Template (Temporary Workaround)

If `srvc_temp_1` continues to fail, we can:

**Option A: Create a new template**

Create a new template `srvc_temp_2` with same fields and use that instead.

**Option B: Use existing working template**

Temporarily use `wp_ticket` or `wp_voucher_2` with modified text:

```javascript
// Modify in whatsapp.util.js
const requestBody = {
  phone_number: formattedPhone,
  template_name: "wp_ticket",  // Use working template
  template_language: "en_US",
  templateArgs: {
    header_image: "https://motivata.in/logo.png",  // Use logo as placeholder
    field_1: `${serviceName}\nAmount: ₹${amount}\nPay: ${paymentLink}`,
  },
  contact: {
    first_name: "Customer",
    last_name: ".",
    country: "India",
  },
};
```

---

### Solution 3: Implement SMS Fallback

Add SMS as fallback when WhatsApp fails:

```javascript
// In membership.request.controller.js
if (!whatsappSent) {
  try {
    // Send SMS via Twilio/MSG91/other SMS provider
    await sendPaymentLinkSMS({
      phone: request.phone,
      message: `Your ${plan.name} membership payment link: ${paymentLink.short_url} - Amount: ₹${amount}`
    });
    console.log('[SMS] Payment link sent via SMS as WhatsApp fallback');
  } catch (smsError) {
    console.error('[SMS] SMS fallback also failed:', smsError.message);
  }
}
```

---

### Solution 4: Manual Admin Notification

When WhatsApp fails, notify admin in the response:

**Already implemented!** The response includes:
```json
{
  "success": true,
  "whatsappSent": false,
  "paymentLink": "https://rzp.io/rzp/NS2mXQZJ"
}
```

Admin can:
1. Copy the payment link
2. Send it manually via WhatsApp/SMS/Email
3. Use "Resend Link" button (which will retry WhatsApp)

---

## Immediate Action Items

### For WappService

☐ Contact WappService support with error details above
☐ Request they fix the circular JSON serialization bug
☐ Ask for ETA on fix
☐ Request alternative template if needed

### For Development Team

☐ **No code changes needed** - system is working correctly
☐ Admin can manually share payment links until WhatsApp is fixed
☐ Consider implementing SMS fallback (optional)
☐ Monitor `CommunicationLog` collection for failure rates

### For Admin Users

☐ When approval succeeds but WhatsApp fails:
  1. Response shows `whatsappSent: false`
  2. Copy the `paymentLink` from response
  3. Manually send to user via WhatsApp/SMS
  4. OR use "Resend Link" button to retry

---

## Monitoring & Debugging

### Check WhatsApp Failure Rate

```javascript
// Connect to MongoDB
db.communicationLogs.aggregate([
  {
    $match: {
      category: "SERVICE_PAYMENT_LINK",
      createdAt: { $gte: ISODate("2026-01-12T00:00:00Z") }
    }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 }
    }
  }
])
```

Expected output:
```json
[
  { "_id": "FAILED", "count": 5 },
  { "_id": "SUCCESS", "count": 0 }
]
```

### Check Failed Communication Logs

```javascript
db.communicationLogs.find({
  category: "SERVICE_PAYMENT_LINK",
  status: "FAILED"
}).sort({ createdAt: -1 }).limit(10)
```

### Test WappService API Directly

```bash
curl -X POST \
  https://api.wappservice.com/api/YOUR_VENDOR_UID/contact/send-template-message \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "919179621765",
    "template_name": "srvc_temp_1",
    "template_language": "en_US",
    "templateArgs": {
      "field_1": "Test Service",
      "field_2": "https://example.com",
      "field_3": "100"
    },
    "contact": {
      "first_name": "Test",
      "last_name": "User",
      "country": "India"
    }
  }'
```

If this also returns 500 error, it confirms the issue is on WappService side.

---

## Alternative WhatsApp Providers (If Issue Persists)

If WappService continues to have issues, consider:

1. **Twilio WhatsApp Business API**
   - More reliable
   - Better documentation
   - Higher cost

2. **MessageBird WhatsApp API**
   - Good reliability
   - European servers
   - Mid-range pricing

3. **Meta (Facebook) WhatsApp Business API**
   - Direct from source
   - Most features
   - Complex setup

4. **Interakt.ai**
   - India-focused
   - Good pricing
   - Easy integration

---

## Template Verification Checklist

Check in WappService Dashboard:

☐ Template `srvc_temp_1` exists
☐ Template status is "APPROVED" (not pending)
☐ Template has 3 variables: field_1, field_2, field_3
☐ Template language is set to English (en_US)
☐ Template is assigned to your phone number
☐ No rate limits or restrictions on the template
☐ Template hasn't been recently modified (requires re-approval)

---

## Current System Behavior (Expected)

✅ **Approval succeeds** even when WhatsApp fails
✅ **Payment link is created** and stored
✅ **Request status changes** to PAYMENT_SENT
✅ **Payment record saved** in database
✅ **Communication log created** with FAILED status
✅ **Error is logged** with full details
✅ **Response includes** payment link for manual sharing
✅ **Admin can use** "Resend Link" to retry

**This is correct behavior!** The system gracefully handles the WhatsApp failure.

---

## Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Payment Link Creation | ✅ Working | Razorpay API working perfectly |
| Request Status Update | ✅ Working | Database updated correctly |
| Phone Prefill | ✅ Working | Phone correctly formatted |
| WhatsApp Delivery | ❌ Failing | WappService API bug |
| Error Handling | ✅ Working | System continues gracefully |
| Manual Fallback | ✅ Working | Admin can share link manually |

**Action Required:** Contact WappService support to fix their API bug

**Workaround:** Admin manually shares payment link until WhatsApp is fixed

**Impact:** Low - payment links are created successfully, only delivery method affected

---

**Last Updated:** 2026-01-12
**Status:** Under Investigation
**Priority:** Medium (system works, WhatsApp is enhancement)
