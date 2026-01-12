# Debugging Membership Request Approval Flow

## Overview

This document explains how to debug the membership request approval process, especially when troubleshooting WhatsApp delivery or payment link issues.

---

## Comprehensive Logging Added

The approval flow now includes **detailed step-by-step logging** that tracks:

1. ✅ Request validation
2. ✅ Plan validation
3. ✅ Payment amount calculation
4. ✅ Razorpay payment link creation
5. ✅ Database updates
6. ✅ WhatsApp message sending
7. ✅ Error handling at each step

---

## Log Patterns to Search For

### When Admin Approves a Request

Look for these log entries in your backend logs:

### 1. Approval Process Start

```
═══════════════════════════════════════════════════════════
[MEMBERSHIP-REQUEST-APPROVE] Starting approval process
[MEMBERSHIP-REQUEST-APPROVE] Request ID: <id>
[MEMBERSHIP-REQUEST-APPROVE] Plan ID: <planId>
[MEMBERSHIP-REQUEST-APPROVE] Payment Amount: <amount>
[MEMBERSHIP-REQUEST-APPROVE] Send WhatsApp: true/false
[MEMBERSHIP-REQUEST-APPROVE] Admin ID: <adminId>
═══════════════════════════════════════════════════════════
```

**What to check:**
- `Send WhatsApp` should be `true`
- Request ID and Plan ID are valid MongoDB ObjectIds

---

### 2. Request Validation

```
[MEMBERSHIP-REQUEST-APPROVE] Step 1: Fetching request from database...
[MEMBERSHIP-REQUEST-APPROVE] ✓ Request found
[MEMBERSHIP-REQUEST-APPROVE] Request details:
  - Name: <userName>
  - Phone: <phoneNumber>
  - Current Status: PENDING
  - Requested Plan: <planId>
```

**Potential errors:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Request not found
[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid status: <status>
```

---

### 3. Plan Validation

```
[MEMBERSHIP-REQUEST-APPROVE] Step 2: Validating membership plan...
[MEMBERSHIP-REQUEST-APPROVE] ✓ Plan found: <planName>
  - Price: <price>
  - Duration: <days> days
  - Is Active: true
```

**Potential errors:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Plan not found: <planId>
[MEMBERSHIP-REQUEST-APPROVE] ❌ Plan cannot be purchased: <reason>
```

---

### 4. Payment Amount

```
[MEMBERSHIP-REQUEST-APPROVE] Step 3: Setting payment amount
  - Plan price: <planPrice>
  - Custom amount: <customAmount>
  - Final amount: <finalAmount>
```

**Potential errors:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid amount: <amount>
```

---

### 5. Razorpay Payment Link Creation ⚠️ CRITICAL

```
[MEMBERSHIP-REQUEST-APPROVE] Step 4: Generated Order ID: <orderId>
[MEMBERSHIP-REQUEST-APPROVE] Step 5: Creating Razorpay payment link...
[RAZORPAY] Payment link options:
  - Amount (paise): <amountInPaise>
  - Customer Name: <userName>
  - Customer Contact: 91<phoneNumber>
  - Description: Membership: <planName>
  - Expires At: <ISO timestamp>
  - Callback URL: <callbackUrl>
  - Reference ID: <orderId>

[RAZORPAY] ✓ Payment link created successfully!
[RAZORPAY] Payment Link ID: <linkId>
[RAZORPAY] Short URL: https://rzp.io/l/<shortCode>
[RAZORPAY] Full Response: { ... }
```

**Potential errors:**
```
[RAZORPAY] ❌ Failed to create payment link
[RAZORPAY] Error Name: <errorName>
[RAZORPAY] Error Message: <errorMessage>
[RAZORPAY] Error Stack: <stack trace>
```

**Common Razorpay Errors:**
- **Authentication failed**: Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`
- **Invalid amount**: Amount must be in paise (multiply by 100)
- **Invalid phone**: Must be 10 digits with `91` country code
- **Rate limit exceeded**: Too many API calls
- **Network error**: Check internet connectivity

---

### 6. Payment Record Creation

```
[MEMBERSHIP-REQUEST-APPROVE] Step 6: Creating Payment record in database...
[MEMBERSHIP-REQUEST-APPROVE] ✓ Payment record created
  - Payment ID: <paymentId>
  - Order ID: <orderId>
  - Type: MEMBERSHIP_REQUEST
  - Amount: <amount>
```

---

### 7. Request Status Update

```
[MEMBERSHIP-REQUEST-APPROVE] Step 7: Updating request status to PAYMENT_SENT...
[MEMBERSHIP-REQUEST-APPROVE] ✓ Request updated to PAYMENT_SENT
  - Status: PAYMENT_SENT
  - Payment URL: https://rzp.io/l/<shortCode>
  - Payment Link ID: <linkId>
```

---

### 8. WhatsApp Sending ⚠️ CRITICAL

```
[MEMBERSHIP-REQUEST-APPROVE] Step 8: Sending WhatsApp notification...
[WHATSAPP] Send WhatsApp flag: true
[WHATSAPP] Preparing WhatsApp message...
[WHATSAPP] WhatsApp parameters:
  - Phone: <phoneNumber>
  - Service Name: <planName> Membership
  - Payment Link: https://rzp.io/l/<shortCode>
  - Amount: <amount>
  - Order ID: <requestId>

[WHATSAPP] Calling sendServicePaymentLinkWhatsApp function...
[WHATSAPP] ✓ WhatsApp sent successfully!
[WHATSAPP] Result: { ... }
```

**Potential errors:**
```
[WHATSAPP] ❌ Failed to send WhatsApp
[WHATSAPP] Error Name: <errorName>
[WHATSAPP] Error Message: <errorMessage>
[WHATSAPP] Error Stack: <stack trace>
[WHATSAPP] Full Error: { ... }
[WHATSAPP] Continuing despite WhatsApp error (payment link is still valid)
```

**Common WhatsApp Errors:**
- **WhatsApp service not configured**: Check WhatsApp API credentials
- **Invalid phone number**: Phone must be 10 digits
- **WhatsApp API rate limit**: Too many messages sent
- **Template not found**: WhatsApp template `sendServicePaymentLinkWhatsApp` missing
- **Network error**: WhatsApp API unreachable
- **Phone not registered on WhatsApp**: User's number not on WhatsApp

**Important:** Even if WhatsApp fails, the approval succeeds and payment link is created. The admin can manually share the link or use the "Resend Link" feature.

---

### 9. Success Response

```
[MEMBERSHIP-REQUEST-APPROVE] Step 9: Preparing response...
[MEMBERSHIP-REQUEST-APPROVE] ✓ Approval process completed successfully!
[MEMBERSHIP-REQUEST-APPROVE] Summary:
  - Request ID: <requestId>
  - User: <userName>
  - Phone: <phoneNumber>
  - Plan: <planName>
  - Amount: <amount>
  - Payment Link: https://rzp.io/l/<shortCode>
  - WhatsApp Sent: true/false
═══════════════════════════════════════════════════════════
```

---

### 10. Fatal Errors

```
═══════════════════════════════════════════════════════════
[MEMBERSHIP-REQUEST-APPROVE] ❌ FATAL ERROR during approval
[MEMBERSHIP-REQUEST-APPROVE] Error Name: <errorName>
[MEMBERSHIP-REQUEST-APPROVE] Error Message: <errorMessage>
[MEMBERSHIP-REQUEST-APPROVE] Error Stack: <stack trace>
[MEMBERSHIP-REQUEST-APPROVE] Full Error: { ... }
═══════════════════════════════════════════════════════════
```

---

## Resend Payment Link Logs

When admin clicks "Resend Link":

```
═══════════════════════════════════════════════════════════
[MEMBERSHIP-REQUEST-RESEND] Resending payment link
[MEMBERSHIP-REQUEST-RESEND] Request ID: <requestId>
═══════════════════════════════════════════════════════════

[MEMBERSHIP-REQUEST-RESEND] Request found:
  - Name: <userName>
  - Phone: <phoneNumber>
  - Status: PAYMENT_SENT
  - Payment URL: https://rzp.io/l/<shortCode>

[MEMBERSHIP-REQUEST-RESEND] Sending WhatsApp...
[WHATSAPP] Parameters:
  - Phone: <phoneNumber>
  - Service Name: <planName> Membership
  - Payment Link: <paymentUrl>
  - Amount: <amount>

[WHATSAPP] ✓ WhatsApp sent successfully!
[WHATSAPP] Result: { ... }
═══════════════════════════════════════════════════════════
```

---

## How to Debug

### Step 1: Enable Full Logging

Make sure your Node.js server is running with console output visible:

```bash
# Development
npm run dev

# Production (with PM2)
pm2 logs motivata-backend
```

---

### Step 2: Reproduce the Issue

1. Admin opens admin panel
2. Admin navigates to Membership Requests
3. Admin clicks "Approve" on a pending request
4. Admin fills the approval form
5. Admin clicks "Approve & Send"

---

### Step 3: Search Logs

**Search for the request ID:**

```bash
# If you have grep installed
grep "<requestId>" logs/app.log

# Or search in PM2 logs
pm2 logs --lines 500 | grep "<requestId>"
```

**Search for approval process:**

```bash
grep "MEMBERSHIP-REQUEST-APPROVE" logs/app.log
```

**Search for WhatsApp issues:**

```bash
grep "WHATSAPP" logs/app.log
```

**Search for Razorpay issues:**

```bash
grep "RAZORPAY" logs/app.log
```

---

### Step 4: Identify the Problem

#### Scenario 1: Payment Link Not Created

**Log shows:**
```
[RAZORPAY] ❌ Failed to create payment link
[RAZORPAY] Error Message: Authentication failed
```

**Solution:**
- Check `.env` file for correct `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- Verify Razorpay account is active
- Check if Razorpay API keys are test or live mode

---

#### Scenario 2: WhatsApp Not Sent

**Log shows:**
```
[WHATSAPP] ✓ Payment link created successfully
[WHATSAPP] ❌ Failed to send WhatsApp
[WHATSAPP] Error Message: <error>
```

**Solution:**
- Check WhatsApp service configuration
- Verify phone number format (10 digits)
- Check WhatsApp API credentials in `.env`
- Verify WhatsApp template exists
- Check if user's phone is registered on WhatsApp

**Important:** Payment link is still created! Admin can:
1. Copy the payment link from the response
2. Manually send it to the user
3. Use "Resend Link" button to retry WhatsApp

---

#### Scenario 3: Request Not Found

**Log shows:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Request not found
```

**Solution:**
- Check if request ID is valid MongoDB ObjectId
- Verify request exists in database
- Check if request was deleted (`isDeleted: true`)

---

#### Scenario 4: Invalid Status

**Log shows:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Invalid status: PAYMENT_SENT
```

**Solution:**
- Request has already been approved
- Cannot approve twice
- Check request status in database

---

#### Scenario 5: Plan Not Found

**Log shows:**
```
[MEMBERSHIP-REQUEST-APPROVE] ❌ Plan not found: <planId>
```

**Solution:**
- Check if plan ID is valid
- Verify plan exists and is active
- Check `isDeleted` and `isActive` flags on plan

---

## Testing Without WhatsApp

If you want to test the approval flow without sending WhatsApp:

### Option 1: Frontend Override

In admin panel, uncheck "Send WhatsApp" option when approving.

### Option 2: Backend Debug Mode

Add this to your `.env`:

```env
SKIP_WHATSAPP=true
```

Then modify the code to check this flag:

```javascript
const sendWhatsApp = process.env.SKIP_WHATSAPP === 'true' ? false : (req.body.sendWhatsApp !== false);
```

---

## Common Issues & Solutions

### Issue 1: WhatsApp Sent but User Didn't Receive

**Possible causes:**
1. User's phone not on WhatsApp
2. User blocked business number
3. WhatsApp delivery delayed (check after 5 minutes)
4. Wrong phone number in request

**Solution:**
- Verify phone number in logs
- Ask user to check WhatsApp (including spam/archived chats)
- Use "Resend Link" button
- Manually copy link and send via SMS/email

---

### Issue 2: Payment Link Expired

**Logs show:** Link created successfully but user says it's expired.

**Cause:** Payment links expire after 7 days.

**Solution:**
- Admin needs to approve again (creates new link)
- Or contact Razorpay to extend link expiry

---

### Issue 3: Payment Link Opens but Phone Not Prefilled

**Cause:** Phone format issue in Razorpay request.

**Check logs:**
```
[RAZORPAY] Customer Contact: 91<phoneNumber>
```

**Should be:** `919876543210` (no spaces, no +)

**Solution:** Already handled correctly in code. If issue persists, check Razorpay dashboard.

---

### Issue 4: Approval Succeeds but Status Not Updated

**Logs show:**
```
[MEMBERSHIP-REQUEST-APPROVE] ✓ Approval process completed successfully!
```

But frontend still shows `PENDING`.

**Cause:** Frontend not refreshing data.

**Solution:**
- Refresh admin panel page
- Check if frontend is calling GET endpoint after approval
- Check browser console for JavaScript errors

---

## Environment Variables to Check

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx

# WhatsApp (check your WhatsApp provider)
WHATSAPP_API_KEY=xxxxx
WHATSAPP_API_URL=https://api.whatsapp.com/...
WHATSAPP_BUSINESS_NUMBER=919876543210

# Base URL for callback
BASE_URL=https://motivata.in
```

---

## Log File Locations

### Development

Console output in terminal where you ran `npm run dev`

### Production with PM2

```bash
# View logs
pm2 logs motivata-backend

# View last 200 lines
pm2 logs motivata-backend --lines 200

# Save logs to file
pm2 logs motivata-backend --lines 1000 > debug.log
```

### Docker

```bash
docker logs <container-name>
docker logs <container-name> --tail 500
```

---

## Quick Diagnostic Checklist

When admin reports "WhatsApp not sent":

- [ ] Check logs for `[MEMBERSHIP-REQUEST-APPROVE]` entries
- [ ] Verify `[RAZORPAY] ✓ Payment link created successfully!`
- [ ] Check `[WHATSAPP] Send WhatsApp flag: true`
- [ ] Look for `[WHATSAPP] ✓ WhatsApp sent successfully!` or error
- [ ] Verify phone number format in logs (10 digits)
- [ ] Check WhatsApp service status
- [ ] Test by using "Resend Link" button
- [ ] As fallback, copy payment link and send manually

---

## Monitoring & Alerts (Optional)

### Set up alerts for:

1. **High WhatsApp failure rate**
   - Alert when >30% of WhatsApp attempts fail

2. **Razorpay API errors**
   - Alert on any Razorpay authentication failures

3. **Approval failures**
   - Alert on repeated fatal errors

### Example monitoring query:

```bash
# Count WhatsApp failures in last hour
grep "WHATSAPP.*Failed" logs/app.log | grep "$(date +%Y-%m-%d)" | wc -l
```

---

## Contact Support

If issue persists after debugging:

### 1. Collect Information

- Request ID
- Full log output (from approval start to end)
- Phone number (obfuscated: 98765***10)
- Timestamp of approval attempt
- Error messages

### 2. Check Services

- **Razorpay Status**: https://status.razorpay.com/
- **WhatsApp API Status**: Check your WhatsApp provider's status page

### 3. Test in Isolation

- Try approving a different request
- Test with a different phone number
- Test with a different plan

---

## Summary

The comprehensive logging now provides:

✅ **Step-by-step visibility** into the approval process
✅ **Clear error messages** with full stack traces
✅ **Razorpay request/response** details
✅ **WhatsApp sending** status and errors
✅ **Visual separators** (═══) for easy log parsing
✅ **Success/failure indicators** (✓ and ❌)

This makes debugging issues much easier and helps identify exactly where in the flow things fail.

---

**Last Updated:** 2024-03-15
**Version:** 1.0
