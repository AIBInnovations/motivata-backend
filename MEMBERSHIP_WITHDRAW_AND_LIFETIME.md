# Membership Request Withdrawal & Lifetime Membership Implementation

## Overview

This document covers two new features implemented in the membership system:

1. **Membership Request Withdrawal** - Users can withdraw pending membership requests
2. **Lifetime Membership Support** - Plans can be configured as lifetime (never expire)

---

## Feature 1: Membership Request Withdrawal

### Problem Solved

Previously, if a user submitted a membership request and it was still PENDING, they couldn't submit a new request even if they changed their mind about the plan. They had to wait for admin action or contact support.

### Solution Implemented

Users can now withdraw their PENDING membership requests and immediately submit a new one with different details.

---

### API Endpoint

**POST** `/api/web/membership-requests/:id/withdraw`

**Access:** Public (requires phone verification)

**Request Parameters:**
- `:id` - The membership request ID to withdraw

**Request Body:**
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

**400 Bad Request** - Invalid phone or non-PENDING status:
```json
{
  "success": false,
  "error": "Cannot withdraw request with status: PAYMENT_SENT. Only PENDING requests can be withdrawn.",
  "status": 400
}
```

**404 Not Found** - Request not found or phone mismatch:
```json
{
  "success": false,
  "error": "Membership request not found or phone number mismatch.",
  "status": 404
}
```

---

### Updated Duplicate Request Response

When a user with a PENDING request tries to submit a new one, they now get withdrawal information:

**409 Conflict:**
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

---

### User Flow

#### Scenario 1: User Changes Mind About Plan

```
1. User submits request for "Basic Plan"
   → Status: PENDING
   → Request ID: abc123

2. User realizes they want "Premium Plan" instead
   → Tries to submit new request
   → Gets 409 error with withdrawal option

3. User calls withdraw endpoint
   → POST /api/web/membership-requests/abc123/withdraw
   → Body: { "phone": "8085816197" }
   → Request marked as deleted

4. User submits new request for "Premium Plan"
   → Success! New request created
```

#### Scenario 2: Cannot Withdraw After Admin Action

```
1. User submits request (Status: PENDING)

2. Admin approves and sends payment link
   → Status changes to: PAYMENT_SENT

3. User tries to withdraw
   → ERROR: "Cannot withdraw request with status: PAYMENT_SENT"
   → User must contact admin or complete payment
```

---

### Implementation Details

**File:** [src/Membership/membership.request.controller.js:735-785](src/Membership/membership.request.controller.js#L735-L785)

**Validation Checks:**
1. ✅ Phone number must be valid and normalized
2. ✅ Request must exist and belong to the phone number
3. ✅ Request must have status = PENDING
4. ✅ Request must not be already deleted

**Security:**
- Phone verification required (prevents unauthorized withdrawals)
- Only PENDING requests can be withdrawn
- Soft delete (request remains in database for audit trail)

**Code:**
```javascript
export const withdrawMembershipRequest = async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body;

  // Normalize phone
  const normalizedPhone = normalizePhone(phone);

  // Find request matching both ID and phone
  const request = await MembershipRequest.findOne({
    _id: id,
    phone: normalizedPhone,
    isDeleted: false,
  });

  // Validate status is PENDING
  if (request.status !== 'PENDING') {
    return responseUtil.badRequest(
      res,
      `Cannot withdraw request with status: ${request.status}. Only PENDING requests can be withdrawn.`
    );
  }

  // Soft delete
  request.isDeleted = true;
  request.deletedAt = new Date();
  await request.save();

  return responseUtil.success(res, 'Membership request withdrawn successfully...');
};
```

---

### Frontend Integration

**1. Detect Pending Request**

When user tries to submit and gets 409 with `canWithdraw: true`:

```javascript
const response = await fetch('/api/web/membership-requests', {
  method: 'POST',
  body: JSON.stringify({ phone, name, requestedPlanId })
});

if (response.status === 409) {
  const data = await response.json();

  if (data.data?.canWithdraw) {
    // Show withdrawal option
    showWithdrawDialog({
      requestId: data.data.existingRequestId,
      submittedAt: data.data.submittedAt
    });
  }
}
```

**2. Withdrawal UI**

```jsx
<Dialog>
  <h3>Pending Request Found</h3>
  <p>You already have a pending membership request submitted on {submittedAt}.</p>

  <p>Would you like to withdraw it and submit a new one?</p>

  <Button onClick={handleWithdraw}>
    Withdraw & Submit New Request
  </Button>

  <Button onClick={closeDialog}>
    Keep Existing Request
  </Button>
</Dialog>
```

**3. Withdraw Handler**

```javascript
const handleWithdraw = async () => {
  try {
    const response = await fetch(`/api/web/membership-requests/${requestId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userPhone })
    });

    if (response.ok) {
      toast.success('Request withdrawn successfully!');
      // Now submit the new request
      submitNewRequest();
    }
  } catch (error) {
    toast.error('Failed to withdraw request');
  }
};
```

---

## Feature 2: Lifetime Membership Support

### Problem Solved

All memberships had a fixed expiration date. There was no way to create lifetime memberships that never expire.

### Solution Implemented

Plans can now be configured with `durationInDays = 0` or `durationInDays = null` to create lifetime memberships.

---

### Schema Changes

#### MembershipPlan Schema

**File:** [schema/MembershipPlan.schema.js](schema/MembershipPlan.schema.js)

**Changes:**

1. **Updated `durationInDays` field:**
```javascript
durationInDays: {
  type: Number,
  default: null, // Changed from required
  validate: {
    validator: function (value) {
      // Allow null (lifetime), 0 (lifetime), or positive numbers
      return value === null || value === 0 || value > 0;
    },
    message: 'Duration must be null/0 (lifetime) or a positive number'
  }
}
```

2. **Added `isLifetime` flag:**
```javascript
isLifetime: {
  type: Boolean,
  default: false,
  index: true
}
```

3. **Added pre-save hook:**
```javascript
membershipPlanSchema.pre('save', function (next) {
  // Automatically set isLifetime based on durationInDays
  this.isLifetime = this.durationInDays === null || this.durationInDays === 0;
  next();
});
```

---

#### UserMembership Schema

**File:** [schema/UserMembership.schema.js](schema/UserMembership.schema.js)

**Changes:**

1. **Updated `endDate` field:**
```javascript
endDate: {
  type: Date,
  required: false, // Not required for lifetime memberships
  default: null,
  index: true
}
```

2. **Added `isLifetime` flag:**
```javascript
isLifetime: {
  type: Boolean,
  default: false,
  index: true
}
```

3. **Updated virtual methods:**

```javascript
// Virtual: isCurrentlyActive
userMembershipSchema.virtual('isCurrentlyActive').get(function () {
  if (this.isDeleted || this.status !== 'ACTIVE' || this.paymentStatus !== 'SUCCESS') {
    return false;
  }

  // Lifetime memberships never expire by date
  if (this.isLifetime) {
    return true;
  }

  const now = new Date();
  return this.startDate <= now && this.endDate > now;
});

// Virtual: isExpired
userMembershipSchema.virtual('isExpired').get(function () {
  if (this.isDeleted || this.status === 'CANCELLED' || this.status === 'REFUNDED') {
    return false;
  }

  // Lifetime memberships never expire
  if (this.isLifetime) {
    return false;
  }

  const now = new Date();
  return this.endDate <= now;
});

// Virtual: daysRemaining
userMembershipSchema.virtual('daysRemaining').get(function () {
  if (!this.isCurrentlyActive) {
    return 0;
  }

  // Lifetime memberships return Infinity (never expires)
  if (this.isLifetime) {
    return Infinity;
  }

  const now = new Date();
  const diffTime = this.endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Method: getCurrentStatus
userMembershipSchema.methods.getCurrentStatus = function () {
  // ... existing checks ...

  // Lifetime memberships never expire
  if (this.isLifetime) {
    const now = new Date();
    if (this.startDate <= now) {
      return 'ACTIVE';
    }
    return 'UPCOMING';
  }

  // ... rest of the logic ...
};
```

---

### Creating Lifetime Plans

**Admin Panel / API:**

**Option 1: Set durationInDays to 0**
```javascript
const lifetimePlan = new MembershipPlan({
  name: 'Lifetime Premium',
  description: 'One-time payment, lifetime access',
  price: 9999,
  durationInDays: 0, // Lifetime
  perks: ['All features', 'Priority support', 'Lifetime access'],
  isActive: true
});

await lifetimePlan.save();
// isLifetime will automatically be set to true by pre-save hook
```

**Option 2: Set durationInDays to null**
```javascript
const lifetimePlan = new MembershipPlan({
  name: 'Lifetime Premium',
  description: 'One-time payment, lifetime access',
  price: 9999,
  durationInDays: null, // Lifetime
  perks: ['All features', 'Priority support', 'Lifetime access'],
  isActive: true
});

await lifetimePlan.save();
// isLifetime will automatically be set to true
```

---

### Membership Creation with Lifetime Plans

**File:** [src/razorpay/razorpay.webhook.js:2361-2408](src/razorpay/razorpay.webhook.js#L2361-L2408)

**Payment Webhook Logic:**

```javascript
// Calculate dates
const startDate = new Date();
const isLifetime = plan.durationInDays === null || plan.durationInDays === 0;
let endDate = null;

if (!isLifetime) {
  endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.durationInDays);
}

console.log('[WEBHOOK] Membership dates:', {
  startDate,
  endDate,
  isLifetime,
  durationInDays: plan.durationInDays
});

// Create UserMembership
const userMembership = new UserMembership({
  phone: normalizedPhone,
  userId: user?._id,
  membershipPlanId: plan._id,
  startDate,
  endDate, // null for lifetime
  isLifetime, // true for lifetime
  status: 'ACTIVE',
  paymentStatus: 'SUCCESS',
  // ... other fields
});

await userMembership.save();
```

---

### Feature Access Check with Lifetime

**File:** [src/FeatureAccess/featureAccess.controller.js:139-185](src/FeatureAccess/featureAccess.controller.js#L139-L185)

**Updated Query:**

```javascript
// Check user's membership status
// Query: ACTIVE status + (not expired OR lifetime)
const membership = await UserMembership.findOne({
  phone: normalizedPhone,
  isDeleted: false,
  status: 'ACTIVE',
  $or: [
    { isLifetime: true }, // Lifetime memberships never expire
    { endDate: { $gte: new Date() } }, // Regular memberships must not be expired
  ],
}).populate('membershipPlanId');

// Calculate days remaining
const daysRemaining = membership.isLifetime
  ? Infinity
  : Math.ceil((membership.endDate - new Date()) / (1000 * 60 * 60 * 24));

// Response
return res.json({
  success: true,
  data: {
    hasAccess: true,
    reason: 'MEMBERSHIP_VALID',
    message: 'Access granted',
    membership: {
      planName: membership.membershipPlanId?.name,
      endDate: membership.isLifetime ? null : membership.endDate,
      daysRemaining: daysRemaining, // Infinity for lifetime
      isLifetime: membership.isLifetime,
    },
  },
});
```

---

### Duplicate Request Prevention with Lifetime

**File:** [src/Membership/membership.request.controller.js:77-133](src/Membership/membership.request.controller.js#L77-L133)

**Updated Logic:**

```javascript
if (completedRequest && completedRequest.userMembershipId) {
  const membership = completedRequest.userMembershipId;

  // Check if membership is lifetime
  if (
    !membership.isDeleted &&
    membership.status === 'ACTIVE' &&
    membership.isLifetime
  ) {
    return responseUtil.conflict(
      res,
      'You already have an active lifetime membership. You cannot submit a new request.'
    );
  }

  // Check regular (non-lifetime) active memberships
  if (
    !membership.isDeleted &&
    membership.status === 'ACTIVE' &&
    !membership.isLifetime &&
    membership.endDate > now
  ) {
    const daysRemaining = Math.ceil((membership.endDate - now) / (1000 * 60 * 60 * 24));

    return responseUtil.conflict(
      res,
      `You already have an active membership that expires in ${daysRemaining} day(s)...`
    );
  }

  // ... rest of logic
}
```

---

## Testing Scenarios

### Withdrawal Feature Testing

#### Test Case 1: Withdraw Pending Request
```bash
# Step 1: Submit request
curl -X POST http://localhost:5000/api/web/membership-requests \
  -H "Content-Type: application/json" \
  -d '{"phone":"8085816197","name":"Test User"}'

# Response: { "success": true, "data": { "requestId": "abc123" } }

# Step 2: Withdraw request
curl -X POST http://localhost:5000/api/web/membership-requests/abc123/withdraw \
  -H "Content-Type: application/json" \
  -d '{"phone":"8085816197"}'

# Expected: { "success": true, "message": "Membership request withdrawn..." }

# Step 3: Submit new request (should succeed)
curl -X POST http://localhost:5000/api/web/membership-requests \
  -H "Content-Type: application/json" \
  -d '{"phone":"8085816197","name":"Test User","requestedPlanId":"xyz789"}'

# Expected: { "success": true } (new request created)
```

#### Test Case 2: Cannot Withdraw PAYMENT_SENT
```bash
# Admin approves request (status becomes PAYMENT_SENT)

# Try to withdraw
curl -X POST http://localhost:5000/api/web/membership-requests/abc123/withdraw \
  -H "Content-Type: application/json" \
  -d '{"phone":"8085816197"}'

# Expected: { "success": false, "error": "Cannot withdraw request with status: PAYMENT_SENT..." }
```

#### Test Case 3: Phone Mismatch
```bash
curl -X POST http://localhost:5000/api/web/membership-requests/abc123/withdraw \
  -H "Content-Type: application/json" \
  -d '{"phone":"9999999999"}'

# Expected: { "success": false, "error": "Membership request not found or phone number mismatch." }
```

---

### Lifetime Membership Testing

#### Test Case 1: Create Lifetime Plan
```javascript
// In MongoDB shell or via admin API
db.membershipplans.insertOne({
  name: 'Lifetime Gold',
  description: 'One-time payment, lifetime access',
  price: 14999,
  durationInDays: 0, // Lifetime
  perks: ['All features', 'Lifetime access'],
  isActive: true,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Verify isLifetime is set
db.membershipplans.findOne({ name: 'Lifetime Gold' });
// Expected: { ..., durationInDays: 0, isLifetime: true }
```

#### Test Case 2: Purchase Lifetime Plan
```bash
# User submits request for lifetime plan
# Admin approves
# User pays
# Webhook creates UserMembership

# Verify in database
db.usermemberships.findOne({ phone: "8085816197" });

# Expected:
# {
#   phone: "8085816197",
#   startDate: ISODate("2025-01-13T..."),
#   endDate: null,
#   isLifetime: true,
#   status: "ACTIVE"
# }
```

#### Test Case 3: Feature Access with Lifetime
```bash
curl -X POST http://localhost:5000/api/web/feature-access/check \
  -H "Content-Type: application/json" \
  -d '{"featureKey":"SOS","phone":"8085816197"}'

# Expected:
# {
#   "success": true,
#   "data": {
#     "hasAccess": true,
#     "membership": {
#       "endDate": null,
#       "daysRemaining": null,
#       "isLifetime": true
#     }
#   }
# }
```

#### Test Case 4: Cannot Submit New Request with Lifetime
```bash
curl -X POST http://localhost:5000/api/web/membership-requests \
  -H "Content-Type: application/json" \
  -d '{"phone":"8085816197","name":"Test User"}'

# Expected:
# {
#   "success": false,
#   "error": "You already have an active lifetime membership. You cannot submit a new request.",
#   "status": 409
# }
```

---

## Database Queries

### Find All Lifetime Plans
```javascript
db.membershipplans.find({ isLifetime: true, isDeleted: false });
```

### Find All Users with Lifetime Memberships
```javascript
db.usermemberships.find({
  isLifetime: true,
  status: 'ACTIVE',
  isDeleted: false
});
```

### Check if User Has Lifetime Membership
```javascript
db.usermemberships.findOne({
  phone: "8085816197",
  isLifetime: true,
  status: 'ACTIVE',
  isDeleted: false
});
```

### Count Lifetime vs Regular Memberships
```javascript
db.usermemberships.aggregate([
  { $match: { status: 'ACTIVE', isDeleted: false } },
  { $group: {
    _id: '$isLifetime',
    count: { $sum: 1 }
  }}
]);

// Output:
// { _id: false, count: 150 } // Regular memberships
// { _id: true, count: 25 }   // Lifetime memberships
```

---

## Frontend Display Guidelines

### Displaying Lifetime Membership

**Example UI:**

```jsx
{membership.isLifetime ? (
  <div className="membership-status">
    <h3>Lifetime Membership</h3>
    <Badge color="gold">Lifetime Access</Badge>
    <p>Your membership never expires!</p>
  </div>
) : (
  <div className="membership-status">
    <h3>Active Membership</h3>
    <p>Expires: {formatDate(membership.endDate)}</p>
    <p>Days Remaining: {membership.daysRemaining}</p>
  </div>
)}
```

### Withdrawal Button

```jsx
{hasExistingRequest && canWithdraw && (
  <Alert severity="info">
    You have a pending request from {formatDate(submittedAt)}.
    <Button onClick={handleWithdraw}>
      Withdraw & Submit New
    </Button>
  </Alert>
)}
```

---

## Migration Notes

### Existing Plans

All existing membership plans will continue to work as before. No migration needed.

### Existing Memberships

All existing memberships will have:
- `isLifetime: false` (default)
- `endDate: <existing date>`

They will continue to function normally.

### Creating Lifetime Plans

To convert an existing plan to lifetime:

```javascript
db.membershipplans.updateOne(
  { _id: ObjectId("PLAN_ID") },
  {
    $set: {
      durationInDays: 0,
      isLifetime: true
    }
  }
);
```

---

## Summary

### Withdrawal Feature

✅ **Users can withdraw PENDING requests**
✅ **Submit new request immediately after withdrawal**
✅ **Phone verification for security**
✅ **Cannot withdraw after admin approval**
✅ **Soft delete maintains audit trail**

### Lifetime Membership

✅ **Plans with durationInDays = 0 or null are lifetime**
✅ **isLifetime flag auto-set by pre-save hook**
✅ **endDate = null for lifetime memberships**
✅ **daysRemaining = Infinity for lifetime**
✅ **Feature access query includes lifetime check**
✅ **Cannot submit new request if have lifetime membership**
✅ **Backward compatible with existing memberships**

---

## Related Files

### Withdrawal Feature
- [src/Membership/membership.request.controller.js](src/Membership/membership.request.controller.js#L48-L66) - Duplicate check
- [src/Membership/membership.request.controller.js](src/Membership/membership.request.controller.js#L735-L785) - Withdraw controller
- [src/Membership/membership.request.route.js](src/Membership/membership.request.route.js#L52-L61) - Withdraw route

### Lifetime Membership
- [schema/MembershipPlan.schema.js](schema/MembershipPlan.schema.js#L44-L61) - Plan schema
- [schema/UserMembership.schema.js](schema/UserMembership.schema.js#L78-L90) - Membership schema
- [src/razorpay/razorpay.webhook.js](src/razorpay/razorpay.webhook.js#L2361-L2408) - Membership creation
- [src/FeatureAccess/featureAccess.controller.js](src/FeatureAccess/featureAccess.controller.js#L139-L185) - Feature access
- [src/Membership/membership.request.controller.js](src/Membership/membership.request.controller.js#L81-L96) - Duplicate prevention

---

*Generated: 2026-01-13*
*Version: 1.0.0*
