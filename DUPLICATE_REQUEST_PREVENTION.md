# Duplicate Membership Request Prevention

## Issue Fixed

Users could submit multiple membership requests even if they already had a completed request with an active membership. This led to duplicate requests and confusion.

---

## Solution Implemented

Added comprehensive validation logic to prevent duplicate requests when users already have active memberships.

---

## Changes Made

### 1. Enhanced Controller Logic

**File:** [src/Membership/membership.request.controller.js:58-103](src/Membership/membership.request.controller.js#L58-L103)

**New Validation Checks:**

```javascript
// Step 1: Check for existing PENDING request (already existed)
const hasPending = await MembershipRequest.hasPendingRequest(normalizedPhone);
if (hasPending) {
  return responseUtil.conflict(res, 'You already have a pending membership request...');
}

// Step 2: NEW - Check for COMPLETED request with ACTIVE membership
const completedRequest = await MembershipRequest.findOne({
  phone: normalizedPhone,
  status: 'COMPLETED',
  isDeleted: false
})
  .sort({ createdAt: -1 })
  .populate('userMembershipId');

if (completedRequest && completedRequest.userMembershipId) {
  const membership = completedRequest.userMembershipId;
  const now = new Date();

  // Check if membership is ACTIVE and not expired
  if (
    !membership.isDeleted &&
    membership.status === 'ACTIVE' &&
    membership.endDate > now
  ) {
    const daysRemaining = Math.ceil((membership.endDate - now) / (1000 * 60 * 60 * 24));

    return responseUtil.conflict(res,
      `You already have an active membership that expires in ${daysRemaining} day(s).
       You cannot submit a new request until your current membership expires.`
    );
  }

  // Auto-expire outdated ACTIVE memberships
  if (
    !membership.isDeleted &&
    membership.status === 'ACTIVE' &&
    membership.endDate <= now
  ) {
    console.log('[MEMBERSHIP-REQUEST] Found expired ACTIVE membership, updating to EXPIRED');
    membership.status = 'EXPIRED';
    await membership.save();
    // Continue with request creation
  }
}
```

---

### 2. New Schema Method

**File:** [schema/MembershipRequest.schema.js:241-278](schema/MembershipRequest.schema.js#L241-L278)

**Added Static Method:**

```javascript
/**
 * Check if phone has an active membership from a completed request
 * Returns { hasActiveMembership: boolean, membership: object|null, daysRemaining: number|null }
 */
membershipRequestSchema.statics.checkActiveMembershipFromRequest = async function (phone) {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

  const completedRequest = await this.findOne({
    phone: normalizedPhone,
    status: 'COMPLETED',
    isDeleted: false
  })
    .sort({ createdAt: -1 })
    .populate('userMembershipId');

  if (!completedRequest || !completedRequest.userMembershipId) {
    return { hasActiveMembership: false, membership: null, daysRemaining: null };
  }

  const membership = completedRequest.userMembershipId;
  const now = new Date();

  // Check if membership is active and not expired
  if (
    !membership.isDeleted &&
    membership.status === 'ACTIVE' &&
    membership.endDate > now
  ) {
    const daysRemaining = Math.ceil((membership.endDate - now) / (1000 * 60 * 60 * 24));
    return {
      hasActiveMembership: true,
      membership: membership,
      daysRemaining: daysRemaining
    };
  }

  return { hasActiveMembership: false, membership: membership, daysRemaining: null };
};
```

---

## Validation Flow

### Before Fix

```
User submits request
  ↓
Check PENDING requests only ❌
  ↓
If no PENDING → Allow submission ❌
  ↓
Result: Duplicate requests possible!
```

### After Fix

```
User submits request
  ↓
Check 1: PENDING requests?
  ↓ No
Check 2: COMPLETED request with ACTIVE membership?
  ↓
  ├─ Yes, ACTIVE & not expired → DENY with days remaining message ✅
  ├─ Yes, ACTIVE but date expired → Auto-expire to EXPIRED, then ALLOW ✅
  └─ No active membership → ALLOW ✅
```

---

## Test Scenarios

### Scenario 1: User with PENDING Request

**Database State:**
```javascript
{
  phone: "8085816197",
  status: "PENDING",
  isDeleted: false
}
```

**Request:** Submit new request

**Result:** ❌ **DENIED**

**Response:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. Please wait for admin review.",
  "status": 409
}
```

---

### Scenario 2: User with COMPLETED Request + ACTIVE Membership

**Database State:**
```javascript
// MembershipRequest
{
  phone: "8085816197",
  status: "COMPLETED",
  userMembershipId: ObjectId("..."),
  isDeleted: false
}

// UserMembership
{
  phone: "8085816197",
  status: "ACTIVE",
  endDate: "2025-12-31",  // Future date
  isDeleted: false
}
```

**Request:** Submit new request

**Result:** ❌ **DENIED**

**Response:**
```json
{
  "success": false,
  "error": "You already have an active membership that expires in 352 day(s). You cannot submit a new request until your current membership expires.",
  "status": 409
}
```

**User Impact:** Cannot submit duplicate requests while membership is active

---

### Scenario 3: User with COMPLETED Request + EXPIRED Membership (Date-Based)

**Database State:**
```javascript
// MembershipRequest
{
  phone: "8085816197",
  status: "COMPLETED",
  userMembershipId: ObjectId("..."),
  isDeleted: false
}

// UserMembership
{
  phone: "8085816197",
  status: "ACTIVE",      // ⚠️ Status not updated
  endDate: "2024-01-01", // Past date
  isDeleted: false
}
```

**Request:** Submit new request

**Result:** ✅ **ALLOWED** (after auto-expiring membership)

**Auto-Action:** System updates membership status to "EXPIRED"

**Response:**
```json
{
  "success": true,
  "message": "Membership request submitted successfully. You will be notified once reviewed.",
  "data": {
    "requestId": "...",
    "status": "PENDING"
  }
}
```

**Backend Logs:**
```
[MEMBERSHIP-REQUEST] Found expired ACTIVE membership, updating status to EXPIRED
[MEMBERSHIP-REQUEST] Membership expired, allowing new request submission
[MEMBERSHIP-REQUEST] Request created: ...
```

---

### Scenario 4: User with COMPLETED Request + Already EXPIRED Status

**Database State:**
```javascript
// MembershipRequest
{
  phone: "8085816197",
  status: "COMPLETED",
  userMembershipId: ObjectId("..."),
  isDeleted: false
}

// UserMembership
{
  phone: "8085816197",
  status: "EXPIRED",     // Already updated
  endDate: "2024-01-01",
  isDeleted: false
}
```

**Request:** Submit new request

**Result:** ✅ **ALLOWED**

**Response:**
```json
{
  "success": true,
  "message": "Membership request submitted successfully. You will be notified once reviewed.",
  "data": {
    "requestId": "...",
    "status": "PENDING"
  }
}
```

---

### Scenario 5: User with COMPLETED Request + CANCELLED Membership

**Database State:**
```javascript
// UserMembership
{
  phone: "8085816197",
  status: "CANCELLED",   // Cancelled by admin
  endDate: "2025-12-31",
  isDeleted: true
}
```

**Request:** Submit new request

**Result:** ✅ **ALLOWED**

**Reason:** Membership is not ACTIVE (status is CANCELLED), so user can submit new request

---

### Scenario 6: New User (No Previous Requests)

**Database State:** No records for this phone

**Request:** Submit new request

**Result:** ✅ **ALLOWED**

**Response:**
```json
{
  "success": true,
  "message": "Membership request submitted successfully. You will be notified once reviewed.",
  "data": {
    "requestId": "...",
    "status": "PENDING"
  }
}
```

---

## API Endpoint

### POST /api/web/membership-requests

**Access:** Public (no authentication required)

**Request Body:**
```json
{
  "phone": "+918085816197",
  "name": "John Doe",
  "requestedPlanId": "optional-plan-id"
}
```

**Success Response (200):**
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

**Conflict Response (409) - Pending Request:**
```json
{
  "success": false,
  "error": "You already have a pending membership request. Please wait for admin review.",
  "status": 409
}
```

**Conflict Response (409) - Active Membership:**
```json
{
  "success": false,
  "error": "You already have an active membership that expires in 45 day(s). You cannot submit a new request until your current membership expires.",
  "status": 409
}
```

---

## Auto-Expiry Feature

### What It Does

When a user tries to submit a new request, the system automatically checks if their previous membership's end date has passed. If it has but the status is still "ACTIVE", it automatically updates the status to "EXPIRED".

### Why This Is Useful

- **Prevents Manual Updates:** Admins don't need to manually expire outdated memberships
- **Immediate Effect:** Users can submit new requests as soon as their membership date expires
- **Database Consistency:** Ensures status field matches the actual membership state

### Example

**Before Request Submission:**
```javascript
{
  status: "ACTIVE",
  endDate: "2024-01-01"  // Passed
}
```

**After Request Submission:**
```javascript
{
  status: "EXPIRED",      // Auto-updated
  endDate: "2024-01-01"
}
```

---

## Benefits

### 1. Prevents Duplicate Requests ✅
- Users cannot spam multiple requests
- Reduces admin workload
- Cleaner request queue

### 2. Automatic Expiry ✅
- Auto-expires outdated ACTIVE memberships
- No manual intervention needed
- Database stays consistent

### 3. Clear User Feedback ✅
- Shows exact days remaining
- User knows when they can submit again
- Reduces support tickets

### 4. Maintains Data Integrity ✅
- One active membership per user at a time
- Status fields accurately reflect membership state
- Audit trail remains clear

---

## Edge Cases Handled

### ✅ Multiple COMPLETED Requests
Uses `.sort({ createdAt: -1 })` to get the most recent completed request first.

### ✅ Soft-Deleted Memberships
Checks `isDeleted: false` to exclude deleted memberships.

### ✅ CANCELLED/REFUNDED Memberships
Only blocks for `status: 'ACTIVE'`, other statuses allow new submissions.

### ✅ Phone Number Formats
Normalizes phone to last 10 digits, so all formats work:
- `+918085816197` → `8085816197`
- `918085816197` → `8085816197`
- `8085816197` → `8085816197`

### ✅ Date Comparison
Uses `endDate > now` for active check and `endDate <= now` for expiry check.

### ✅ Missing userMembershipId
Checks `if (completedRequest && completedRequest.userMembershipId)` before accessing membership.

---

## Testing

### Manual Test

```bash
# Test 1: Submit initial request (should succeed)
curl -X POST http://localhost:5000/api/web/membership-requests \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+918085816197",
    "name": "Test User"
  }'

# Expected: 201 Created

# Test 2: Complete the request (via admin panel)
# - Admin approves
# - Payment link sent
# - User pays
# - Status becomes COMPLETED
# - UserMembership created with ACTIVE status

# Test 3: Try to submit another request (should fail)
curl -X POST http://localhost:5000/api/web/membership-requests \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+918085816197",
    "name": "Test User"
  }'

# Expected: 409 Conflict
# Message: "You already have an active membership that expires in X day(s)..."
```

### Database Test

```javascript
// Setup: Create completed request with active membership
const request = await MembershipRequest.create({
  phone: "8085816197",
  name: "Test User",
  status: "COMPLETED",
  userMembershipId: membershipId
});

const membership = await UserMembership.create({
  phone: "8085816197",
  status: "ACTIVE",
  endDate: new Date(Date.now() + 30*24*60*60*1000), // +30 days
  // ... other fields
});

// Test: Try to submit new request
const result = await submitMembershipRequest(req, res);

// Expected: Conflict error with days remaining message
```

---

## Monitoring

### Console Logs to Watch

```
[MEMBERSHIP-REQUEST] Active membership found for phone: 8085816197 Days remaining: 45
```
↳ User denied due to active membership

```
[MEMBERSHIP-REQUEST] Found expired ACTIVE membership, updating status to EXPIRED
[MEMBERSHIP-REQUEST] Membership expired, allowing new request submission
```
↳ Auto-expired membership, allowing new request

```
[MEMBERSHIP-REQUEST] Request created: 65f1a2b3c4d5e6f7g8h9i0j1
```
↳ New request successfully created

---

## Related Files

1. **[src/Membership/membership.request.controller.js](src/Membership/membership.request.controller.js#L31-L108)** - Main validation logic
2. **[schema/MembershipRequest.schema.js](schema/MembershipRequest.schema.js#L241-L278)** - New static method
3. **[schema/UserMembership.schema.js](schema/UserMembership.schema.js#L84-L90)** - Status enum

---

## Summary

✅ **Problem:** Users could submit duplicate requests even with active memberships

✅ **Solution:** Added validation to check for COMPLETED requests with ACTIVE memberships

✅ **Bonus:** Auto-expires outdated ACTIVE memberships

✅ **Result:** Prevents duplicates, maintains data integrity, improves user experience

**No configuration needed - feature works automatically on all membership request submissions.**
