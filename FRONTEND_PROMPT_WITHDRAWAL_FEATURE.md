# Frontend Integration Prompt: Membership Request Withdrawal Feature

## Context

The backend has implemented a new withdrawal feature for membership requests. Users can now withdraw their PENDING membership requests and immediately submit a new one.

---

## What Changed?

### Before (Old Behavior)
When a user tried to submit a duplicate request while having a PENDING request:

**Response:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. Please wait for admin review.",
  "status": 409
}
```

**Frontend Action:** Show error, block user completely

---

### After (New Behavior)

#### 1. Enhanced Duplicate Request Response

When a user tries to submit while having a PENDING request:

**Response:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. You can withdraw the existing request and submit a new one.",
  "status": 409,
  "data": {
    "existingRequestId": "65f1a2b3c4d5e6f7g8h9i0j1",
    "canWithdraw": true,
    "submittedAt": "2025-01-10T10:30:00.000Z"
  }
}
```

**Frontend Action:** Show withdrawal option to user

---

#### 2. New Withdrawal Endpoint

**POST** `/api/web/membership-requests/:id/withdraw`

**Request:**
```json
{
  "phone": "+918085816197"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Membership request withdrawn successfully. You can now submit a new request.",
  "data": {
    "withdrawnRequestId": "65f1a2b3c4d5e6f7g8h9i0j1"
  }
}
```

**Error Responses:**

**400 - Cannot Withdraw (Already Approved):**
```json
{
  "success": false,
  "error": "Cannot withdraw request with status: PAYMENT_SENT. Only PENDING requests can be withdrawn.",
  "status": 400
}
```

**404 - Not Found / Phone Mismatch:**
```json
{
  "success": false,
  "error": "Membership request not found or phone number mismatch.",
  "status": 404
}
```

---

## Complete Frontend Implementation Guide

### Step 1: Update Submission Handler

```javascript
const submitMembershipRequest = async (formData) => {
  try {
    const response = await fetch('/api/web/membership-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: formData.phone,
        name: formData.name,
        requestedPlanId: formData.planId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // SUCCESS - Request submitted
      showSuccessMessage('Request submitted successfully!');
      router.push('/request-status');
    }
    else if (response.status === 409) {
      // CONFLICT - Duplicate request detected
      handleDuplicateRequest(data);
    }
    else {
      // OTHER ERRORS
      showErrorMessage(data.error || 'Failed to submit request');
    }
  } catch (error) {
    showErrorMessage('Network error. Please try again.');
  }
};
```

---

### Step 2: Handle Duplicate Request with Withdrawal Option

```javascript
const handleDuplicateRequest = (responseData) => {
  const { error, data } = responseData;

  // Check if withdrawal is possible
  if (data?.canWithdraw === true) {
    // Show withdrawal dialog
    showWithdrawalDialog({
      message: error,
      existingRequestId: data.existingRequestId,
      submittedAt: data.submittedAt,
      userPhone: currentUserPhone,
      onWithdraw: handleWithdrawal
    });
  } else {
    // Cannot withdraw (already approved or has active membership)
    showErrorMessage(error);
  }
};
```

---

### Step 3: Withdrawal Dialog Component

**React Example:**

```jsx
import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Alert } from '@mui/material';
import { format } from 'date-fns';

const WithdrawalDialog = ({
  open,
  onClose,
  existingRequestId,
  submittedAt,
  userPhone,
  onWithdrawSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleWithdraw = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/web/membership-requests/${existingRequestId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: userPhone })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success - request withdrawn
        toast.success('Request withdrawn successfully!');
        onClose();
        onWithdrawSuccess(); // Callback to resubmit the form
      } else {
        // Error
        setError(data.error || 'Failed to withdraw request');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pending Request Found</DialogTitle>

      <DialogContent>
        <Typography variant="body1" gutterBottom>
          You already have a pending membership request submitted on{' '}
          <strong>{format(new Date(submittedAt), 'PPpp')}</strong>.
        </Typography>

        <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
          Your request is currently under admin review. If you want to submit a new request
          with different details, you can withdraw the existing one.
        </Alert>

        <Typography variant="body2" color="text.secondary">
          Would you like to withdraw your existing request and submit a new one?
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Keep Existing Request
        </Button>
        <Button
          onClick={handleWithdraw}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Withdrawing...' : 'Withdraw & Submit New'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WithdrawalDialog;
```

---

### Step 4: Complete Form Component

```jsx
import React, { useState } from 'react';
import WithdrawalDialog from './WithdrawalDialog';

const MembershipRequestForm = () => {
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    planId: ''
  });

  const [withdrawalDialog, setWithdrawalDialog] = useState({
    open: false,
    existingRequestId: null,
    submittedAt: null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/web/membership-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // SUCCESS
        toast.success('Request submitted successfully!');
        router.push('/request-status');
      }
      else if (response.status === 409 && data.data?.canWithdraw) {
        // PENDING REQUEST - Show withdrawal option
        setWithdrawalDialog({
          open: true,
          existingRequestId: data.data.existingRequestId,
          submittedAt: data.data.submittedAt
        });
      }
      else {
        // OTHER ERRORS
        toast.error(data.error || 'Failed to submit request');
      }
    } catch (error) {
      toast.error('Network error. Please try again.');
    }
  };

  const handleWithdrawSuccess = () => {
    // After withdrawal, automatically resubmit the form
    handleSubmit(new Event('submit'));
  };

  return (
    <>
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
        <select
          value={formData.planId}
          onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
        >
          <option value="">Select Plan</option>
          {/* Plan options */}
        </select>
        <button type="submit">Submit Request</button>
      </form>

      <WithdrawalDialog
        open={withdrawalDialog.open}
        onClose={() => setWithdrawalDialog({ ...withdrawalDialog, open: false })}
        existingRequestId={withdrawalDialog.existingRequestId}
        submittedAt={withdrawalDialog.submittedAt}
        userPhone={formData.phone}
        onWithdrawSuccess={handleWithdrawSuccess}
      />
    </>
  );
};

export default MembershipRequestForm;
```

---

## All Possible Response Scenarios

### Scenario 1: ✅ Success - New Request Created

**When:** No existing request, or existing request is expired/cancelled

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
- Show success message
- Redirect to status page
- Save requestId for tracking

---

### Scenario 2: ⚠️ Conflict - PENDING Request (Can Withdraw)

**When:** User has a PENDING request

**Response:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. You can withdraw the existing request and submit a new one.",
  "status": 409,
  "data": {
    "existingRequestId": "abc123",
    "canWithdraw": true,
    "submittedAt": "2025-01-10T10:30:00.000Z"
  }
}
```

**Frontend Action:**
- Show withdrawal dialog
- Display submitted date
- Provide "Withdraw & Submit New" button
- Provide "Keep Existing" button

---

### Scenario 3: ❌ Conflict - Active Membership (Cannot Submit)

**When:** User has an ACTIVE membership that hasn't expired

**Response:**
```json
{
  "success": false,
  "error": "You already have an active membership that expires in 45 day(s). You cannot submit a new request until your current membership expires.",
  "status": 409
}
```

**Frontend Action:**
- Show error message
- Display days remaining
- Block submission completely
- Show link to "View My Membership"

---

### Scenario 4: ❌ Conflict - Lifetime Membership (Cannot Submit)

**When:** User has an ACTIVE lifetime membership

**Response:**
```json
{
  "success": false,
  "error": "You already have an active lifetime membership. You cannot submit a new request.",
  "status": 409
}
```

**Frontend Action:**
- Show error message
- Indicate lifetime status
- Block submission completely
- Show link to "View My Membership"

---

### Scenario 5: ❌ Cannot Withdraw - Already Approved

**When:** User tries to withdraw but request status is no longer PENDING

**Response:**
```json
{
  "success": false,
  "error": "Cannot withdraw request with status: PAYMENT_SENT. Only PENDING requests can be withdrawn.",
  "status": 400
}
```

**Frontend Action:**
- Show error message
- Explain that admin has already processed the request
- Suggest contacting support or completing payment

---

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User fills out membership request form                      │
│ (Phone: 8085816197, Name: John, Plan: Premium)             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
              [Submit Request]
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    [No existing           [Existing PENDING
     request]               request found]
          │                     │
          │                     ▼
          │              [Backend checks
          │               canWithdraw]
          │                     │
          │          ┌──────────┴──────────┐
          │          │                     │
          │          ▼                     ▼
          │   [canWithdraw:true]    [canWithdraw:false
          │   Show dialog with       Active membership]
          │   withdrawal option           │
          │          │                     │
          │          ▼                     ▼
          │   ┌─────────────┐       [Show error:
          │   │ User clicks │        "Active membership
          │   │ "Withdraw & │         cannot submit"]
          │   │ Submit New" │             │
          │   └──────┬──────┘             │
          │          │                     │
          │          ▼                     │
          │   [Call withdrawal API        │
          │    with phone verification]   │
          │          │                     │
          │          ▼                     │
          │   [Request marked             │
          │    as deleted]                │
          │          │                     │
          │          ▼                     │
          │   [Auto-resubmit form]        │
          │          │                     │
          ▼          ▼                     ▼
    [Success! Request created       [User blocked]
     Status: PENDING]
          │
          ▼
    [Redirect to status page]
```

---

## Important Implementation Notes

### 1. Phone Verification
The withdrawal endpoint requires phone number in the request body. Always send the SAME phone number that was used to create the request.

```javascript
// ✅ Correct
const response = await fetch(`/api/web/membership-requests/${requestId}/withdraw`, {
  method: 'POST',
  body: JSON.stringify({ phone: userPhone }) // Same phone as form
});

// ❌ Wrong
const response = await fetch(`/api/web/membership-requests/${requestId}/withdraw`, {
  method: 'POST',
  body: JSON.stringify({ phone: differentPhone }) // Different phone will fail
});
```

---

### 2. Automatic Resubmission

After successful withdrawal, automatically resubmit the form:

```javascript
const handleWithdrawSuccess = async () => {
  // Close dialog
  setWithdrawalDialog({ open: false });

  // Wait a brief moment for UI update
  await new Promise(resolve => setTimeout(resolve, 500));

  // Resubmit the form
  const response = await fetch('/api/web/membership-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData) // Use current form data
  });

  // Handle response
  if (response.ok) {
    toast.success('New request submitted successfully!');
    router.push('/request-status');
  }
};
```

---

### 3. Error Handling

```javascript
const handleWithdraw = async () => {
  try {
    const response = await fetch(`/api/web/membership-requests/${requestId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userPhone })
    });

    const data = await response.json();

    if (response.status === 400) {
      // Cannot withdraw (already approved)
      toast.error('This request has already been processed by admin. ' +
                  'Please complete payment or contact support.');
      closeDialog();
    }
    else if (response.status === 404) {
      // Request not found or phone mismatch
      toast.error('Request not found. Please refresh and try again.');
      closeDialog();
    }
    else if (response.ok) {
      // Success
      toast.success('Request withdrawn successfully!');
      closeDialog();
      resubmitForm();
    }
    else {
      // Other errors
      toast.error(data.error || 'Failed to withdraw request');
    }
  } catch (error) {
    toast.error('Network error. Please check your connection.');
  }
};
```

---

### 4. UI/UX Best Practices

**Dialog Title:**
- ✅ "Pending Request Found"
- ❌ "Error: Duplicate Request"

**Primary Action:**
- ✅ "Withdraw & Submit New" (affirmative, action-oriented)
- ❌ "Delete Old Request" (negative, destructive)

**Secondary Action:**
- ✅ "Keep Existing Request" (clear alternative)
- ❌ "Cancel" (ambiguous)

**Information Display:**
- Show when the existing request was submitted
- Explain what withdrawal means
- Clarify that they can submit immediately after

---

## Testing Checklist

### Test Case 1: Happy Path - Withdrawal Works
1. Submit initial request
2. Try to submit again (same phone)
3. See withdrawal dialog
4. Click "Withdraw & Submit New"
5. Verify new request is created
6. Check both requests in admin panel (old should be deleted)

### Test Case 2: Cannot Withdraw After Approval
1. Submit request
2. Admin approves (status → PAYMENT_SENT)
3. Try to withdraw
4. Should see error about status

### Test Case 3: Active Membership Blocks All
1. User has active membership
2. Try to submit new request
3. Should see error with days remaining
4. Should NOT see withdrawal option

### Test Case 4: Phone Mismatch
1. Submit request with phone A
2. Try to withdraw with phone B
3. Should see "not found" error

### Test Case 5: Network Error Handling
1. Disable network
2. Try to withdraw
3. Should see network error
4. Should not close dialog

---

## API Summary

### POST /api/web/membership-requests
**Create new request**

**Before calling:** No special checks needed

**Responses to handle:**
- `200` + `success: true` → Request created
- `409` + `canWithdraw: true` → Show withdrawal dialog
- `409` + `canWithdraw: false` → Show error (active membership)
- `400` → Validation error

---

### POST /api/web/membership-requests/:id/withdraw
**Withdraw pending request**

**Before calling:**
- Must have `existingRequestId` from duplicate error
- Must have user's phone number

**Responses to handle:**
- `200` + `success: true` → Withdrawn, resubmit form
- `400` → Cannot withdraw (already approved)
- `404` → Not found or phone mismatch
- `500` → Server error

---

## Lifetime Membership Display (Bonus)

When displaying active memberships, check for lifetime:

```jsx
{membership.isLifetime ? (
  <Badge color="gold">
    <InfinityIcon /> Lifetime Access
  </Badge>
) : (
  <Badge color="blue">
    Expires: {formatDate(membership.endDate)}
    <br />
    {membership.daysRemaining} days remaining
  </Badge>
)}
```

**API Response for Lifetime:**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "membership": {
      "planName": "Lifetime Gold",
      "endDate": null,
      "daysRemaining": null,
      "isLifetime": true
    }
  }
}
```

---

## Questions?

If you have questions about:
1. **Withdrawal logic** - Check [MEMBERSHIP_WITHDRAW_AND_LIFETIME.md](MEMBERSHIP_WITHDRAW_AND_LIFETIME.md)
2. **Lifetime membership** - Check same document above
3. **General integration** - Check [FRONTEND_INTEGRATION_GUIDE.md](FRONTEND_INTEGRATION_GUIDE.md)

---

## Summary for Claude (Frontend Dev)

**Task:** Implement withdrawal feature for membership requests

**Key Changes:**
1. When user gets 409 error, check if `data.canWithdraw === true`
2. If true, show dialog with withdrawal option
3. Call withdrawal API with phone verification
4. After successful withdrawal, auto-resubmit the form
5. Handle all error cases (already approved, phone mismatch, etc.)

**Required UI Components:**
- Withdrawal confirmation dialog
- Loading state during withdrawal
- Error display in dialog
- Success toast after withdrawal
- Auto-resubmission logic

**New Endpoint:**
- `POST /api/web/membership-requests/:id/withdraw`
- Body: `{ "phone": "+918085816197" }`

**Testing:**
- Submit → Try duplicate → Withdraw → Verify new request created
- Submit → Admin approves → Try withdraw → Should fail
- Active membership → Try submit → Should block without withdrawal option

---

*Generated: 2026-01-13*
*Backend Commit: afc60e8*
