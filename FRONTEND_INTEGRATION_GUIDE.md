# Frontend Integration Guide: Membership Request API Changes

## Overview

The membership request submission endpoint has been updated to prevent duplicate requests when users already have active memberships. This guide documents all possible API responses and how the frontend should handle them.

---

## API Endpoint

**POST** `/api/web/membership-requests`

**Access:** Public (no authentication required)

**Request Body:**
```json
{
  "phone": "+918085816197",
  "name": "John Doe",
  "requestedPlanId": "optional-plan-id"
}
```

---

## Response Scenarios and Frontend Handling

### Scenario 1: ✅ SUCCESS - New Request Created

**When:**
- New user with no previous requests, OR
- User with expired/cancelled membership

**HTTP Status:** `200 OK`

**Response:**
```json
{
  "success": true,
  "message": "Membership request submitted successfully. You will be notified once reviewed.",
  "data": {
    "requestId": "65f1a2b3c4d5e6f7g8h9i0j1",
    "status": "PENDING"
  }
}
```

**Frontend Action:**
- Show success message: "Your membership request has been submitted successfully!"
- Display: "You will be notified once the admin reviews your request."
- Redirect to: Request status page or home page
- Store requestId in local storage (optional, for tracking)

---

### Scenario 2: ❌ CONFLICT - Pending Request Already Exists

**When:** User already has a PENDING request awaiting admin review

**HTTP Status:** `409 Conflict`

**Response:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. Please wait for admin review.",
  "status": 409
}
```

**Frontend Action:**
- Show error alert/toast with the message
- Display: "Your previous request is under review. Please check back later."
- Disable submit button
- Optionally show: "Status: Pending Review"

**UI Suggestion:**
```
❌ Request Already Pending

You already have a membership request under review.
Please wait for the admin to approve it before submitting a new one.

[View Request Status]
```

---

### Scenario 3: ❌ CONFLICT - Active Membership Exists

**When:** User has a COMPLETED request with ACTIVE membership that hasn't expired

**HTTP Status:** `409 Conflict`

**Response:**
```json
{
  "success": false,
  "error": "You already have an active membership that expires in 45 day(s). You cannot submit a new request until your current membership expires.",
  "status": 409
}
```

**Frontend Action:**
- Parse the error message to extract days remaining
- Show prominent message with membership status
- Display days remaining count
- Disable submit button completely
- Provide link to view membership details

**UI Suggestion:**
```
✅ Active Membership

You already have an active membership!

Expires in: 45 days
Next renewal available: [Date]

[View My Membership]
```

**JavaScript Parsing Example:**
```javascript
// Extract days from error message
const match = errorMessage.match(/expires in (\d+) day\(s\)/);
const daysRemaining = match ? parseInt(match[1]) : null;

// Calculate expiry date
const expiryDate = new Date();
expiryDate.setDate(expiryDate.getDate() + daysRemaining);

// Show formatted message
showMessage(`Your membership is active until ${expiryDate.toLocaleDateString()}`);
```

---

### Scenario 4: ❌ VALIDATION ERROR - Missing Required Fields

**When:** Required fields (phone, name) are missing from request

**HTTP Status:** `400 Bad Request`

**Response:**
```json
{
  "success": false,
  "error": "Validation error: Name and phone are required",
  "status": 400
}
```

**Frontend Action:**
- Show inline validation errors on form fields
- Highlight missing fields in red
- Display error message near submit button
- Keep user on the same page to fix errors

---

### Scenario 5: ❌ VALIDATION ERROR - Invalid Phone Number

**When:** Phone number format is invalid (not 10 digits after normalization)

**HTTP Status:** `400 Bad Request`

**Response:**
```json
{
  "success": false,
  "error": "Invalid phone number format. Please provide a valid 10-digit phone number.",
  "status": 400
}
```

**Frontend Action:**
- Show error on phone input field
- Provide format hint: "Example: +91 9876543210"
- Allow user to correct and resubmit

---

### Scenario 6: ❌ SERVER ERROR

**When:** Unexpected server error occurs

**HTTP Status:** `500 Internal Server Error`

**Response:**
```json
{
  "success": false,
  "error": "Failed to submit membership request. Please try again later.",
  "status": 500
}
```

**Frontend Action:**
- Show generic error message: "Something went wrong. Please try again."
- Log error to console for debugging
- Provide retry button
- Suggest contacting support if error persists

---

## Complete Frontend Implementation Example

### React/Next.js Implementation

```javascript
import { useState } from 'react';

const MembershipRequestForm = () => {
  const [formData, setFormData] = useState({ phone: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/web/membership-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Scenario 1: Success
        setSuccess(true);
        showSuccessMessage('Request submitted successfully!');
        // Optionally redirect
        setTimeout(() => router.push('/membership-status'), 2000);
      } else if (response.status === 409) {
        // Scenario 2 or 3: Conflict
        if (data.error.includes('pending membership request')) {
          // Scenario 2: Pending request
          showWarningMessage(
            'You already have a pending request. Please wait for admin review.',
            'warning'
          );
        } else if (data.error.includes('active membership')) {
          // Scenario 3: Active membership
          const daysMatch = data.error.match(/expires in (\d+) day\(s\)/);
          const days = daysMatch ? daysMatch[1] : '?';

          showActiveMembershipMessage(days);
        }
        setError(data.error);
      } else if (response.status === 400) {
        // Scenario 4 or 5: Validation error
        showValidationError(data.error);
        setError(data.error);
      } else {
        // Scenario 6: Server error
        showErrorMessage('Something went wrong. Please try again.');
        setError(data.error);
      }
    } catch (err) {
      console.error('Request failed:', err);
      showErrorMessage('Network error. Please check your connection.');
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessMessage = (message) => {
    // Use your toast/notification library
    toast.success(message);
  };

  const showWarningMessage = (message) => {
    toast.warning(message);
  };

  const showActiveMembershipMessage = (days) => {
    // Custom modal or alert
    alert(`You have an active membership that expires in ${days} days`);
  };

  const showValidationError = (message) => {
    toast.error(message);
  };

  const showErrorMessage = (message) => {
    toast.error(message);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="tel"
        placeholder="Phone Number"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="Full Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Request'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};
```

---

## Response Field Definitions

### Success Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful requests |
| `message` | string | Human-readable success message |
| `data.requestId` | string | MongoDB ObjectId of created request |
| `data.status` | string | Always `"PENDING"` for new requests |

### Error Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for errors |
| `error` | string | Human-readable error message |
| `status` | number | HTTP status code (400, 409, 500) |

---

## Error Message Patterns for Parsing

The frontend can use these patterns to detect specific scenarios:

```javascript
const ErrorPatterns = {
  PENDING_REQUEST: /pending membership request/i,
  ACTIVE_MEMBERSHIP: /active membership that expires/i,
  DAYS_REMAINING: /expires in (\d+) day\(s\)/,
  INVALID_PHONE: /invalid phone number/i,
  MISSING_FIELDS: /name and phone are required/i,
};

// Usage
if (ErrorPatterns.ACTIVE_MEMBERSHIP.test(errorMessage)) {
  const daysMatch = errorMessage.match(ErrorPatterns.DAYS_REMAINING);
  const days = daysMatch ? parseInt(daysMatch[1]) : null;

  // Show membership active UI
  showActiveMembershipUI(days);
}
```

---

## UI/UX Recommendations

### 1. Form Validation (Client-Side)

Add client-side validation before submitting:

```javascript
const validateForm = (formData) => {
  const errors = {};

  // Phone validation
  const phoneDigits = formData.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10) {
    errors.phone = 'Phone number must be 10 digits';
  }

  // Name validation
  if (!formData.name || formData.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  return errors;
};
```

### 2. Success State

After successful submission:
- ✅ Show success animation/confetti
- ✅ Display confirmation message
- ✅ Show request ID (for user reference)
- ✅ Provide "What's Next?" information
- ✅ Auto-redirect after 3 seconds

### 3. Pending Request State

When user has pending request:
- ⏳ Show pending badge/icon
- ⏳ Display "Under Review" status
- ⏳ Disable submit button
- ⏳ Show estimated review time (if available)

### 4. Active Membership State

When user has active membership:
- ✅ Show success badge with checkmark
- ✅ Display membership expiry date
- ✅ Show days remaining countdown
- ✅ Provide link to membership details page
- ✅ Disable new request submission completely

### 5. Error States

For all errors:
- ❌ Use clear, friendly language
- ❌ Provide actionable next steps
- ❌ Show support contact if needed
- ❌ Allow easy retry without losing form data

---

## Testing Checklist for Frontend

### Test Case 1: First-Time User
- [ ] Enter valid phone and name
- [ ] Submit form
- [ ] Verify success message appears
- [ ] Verify redirect to status page

### Test Case 2: User with Pending Request
- [ ] Submit request for phone with pending status
- [ ] Verify 409 error message
- [ ] Verify submit button is disabled
- [ ] Verify "pending review" message shown

### Test Case 3: User with Active Membership
- [ ] Submit request for phone with active membership
- [ ] Verify 409 error with days remaining
- [ ] Verify days count is displayed
- [ ] Verify membership active badge shown

### Test Case 4: Invalid Phone
- [ ] Submit with invalid phone (e.g., "123")
- [ ] Verify 400 error message
- [ ] Verify inline validation error
- [ ] Verify form remains editable

### Test Case 5: Network Error
- [ ] Disconnect network
- [ ] Submit form
- [ ] Verify network error message
- [ ] Verify retry option available

---

## API Error Status Code Reference

| Status Code | Meaning | Typical Cause |
|-------------|---------|---------------|
| `200` | Success | Request created successfully |
| `400` | Bad Request | Validation error (missing/invalid fields) |
| `409` | Conflict | Duplicate request or active membership exists |
| `500` | Server Error | Database error or unexpected exception |

---

## Additional Context for Frontend Developer

### What Changed?

Previously, users could submit multiple membership requests even if they already had an active membership. This created:
- Duplicate requests in admin queue
- Confusion for users
- Extra admin workload

### New Behavior

The backend now validates:
1. ✅ **PENDING requests** - Blocks duplicate submissions
2. ✅ **ACTIVE memberships** - Blocks new requests if membership is valid
3. ✅ **EXPIRED memberships** - Allows new requests (auto-expires if needed)
4. ✅ **Provides clear feedback** - Shows exact days remaining

### Backend Auto-Expiry Feature

The backend automatically expires memberships that are:
- Status: `ACTIVE`
- End date: Past current date

This happens **automatically** when a user tries to submit a new request. The frontend doesn't need to handle this explicitly - it will receive a success response when the expired membership is auto-updated.

---

## Related Endpoints (For Reference)

### Check Feature Access
**POST** `/api/web/feature-access/check`

```json
{
  "featureKey": "SOS",
  "phone": "8085816197"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "reason": "MEMBERSHIP_VALID",
    "membership": {
      "planName": "Premium Membership",
      "endDate": "2025-12-31T00:00:00.000Z",
      "daysRemaining": 352
    }
  }
}
```

This endpoint can be used to verify membership status before showing the request form.

---

## Questions for Frontend Developer

If you have questions about:
1. **UI/UX flow** - How should the flow work from user perspective?
2. **Error handling** - Need more specific error scenarios?
3. **Membership status page** - Need backend endpoint for status checking?
4. **Notification system** - How should users be notified when request is approved?

Please ask the backend team or refer to the complete API documentation.

---

## File References

### Backend Implementation Files
- **Controller:** [src/Membership/membership.request.controller.js](src/Membership/membership.request.controller.js#L31-L108)
- **Schema:** [schema/MembershipRequest.schema.js](schema/MembershipRequest.schema.js#L241-L278)
- **Documentation:** [DUPLICATE_REQUEST_PREVENTION.md](DUPLICATE_REQUEST_PREVENTION.md)

### Contact
For backend-related questions, contact the backend development team.

---

## Summary

**Key Takeaways:**
1. **3 main response types** - Success (200), Conflict (409), Error (400/500)
2. **Parse error messages** - Extract days remaining from conflict responses
3. **Show appropriate UI** - Success badge for active members, warning for pending
4. **Disable submit** - When user has pending or active membership
5. **Provide clear feedback** - Always explain why user can't submit

**Next Steps:**
1. Update membership request form component
2. Add error message parsing logic
3. Create UI components for different states
4. Test all scenarios thoroughly
5. Update user documentation if needed

---

*Generated: 2026-01-13*
*Backend Version: Latest (after duplicate prevention implementation)*
