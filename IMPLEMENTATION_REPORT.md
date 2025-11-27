# Implementation Report - Enrollment Visibility Fix

## Overview

Fix enrollment queries so users can see tickets purchased for them by others.

Currently, enrollments are only visible to the buyer (userId). When User A buys tickets for User B, User B cannot see the ticket in their profile.

---

## Files to Modify

- [src/Enrollment/eventEnrollment.controller.js](src/Enrollment/eventEnrollment.controller.js) - Changes 1-4
- [src/cash/cash.controller.js](src/cash/cash.controller.js) - Change 5
- [src/Enrollment/payment.controller.js](src/Enrollment/payment.controller.js) - Change 6

---

## CHANGE 1: getUserEnrollments

### Problem
Query only checks `userId`. Users cannot see tickets bought for them by others.

### Current Code
```javascript
const filter = { userId: req.user.id };
```

### Required Change
```javascript
const user = await User.findById(req.user.id).select('phone');

const filter = {
  $or: [
    { userId: req.user.id },
    { [`tickets.${user.phone}`]: { $exists: true } }
  ]
};
```

### Response Enhancement
Add to each enrollment in response:
```javascript
// After fetching enrollments, map them to add:
const enrichedEnrollments = enrollments.map(enrollment => {
  const isOwner = enrollment.userId.toString() === req.user.id;
  const enrollmentObj = enrollment.toObject();

  return {
    ...enrollmentObj,
    relationship: isOwner ? 'OWNER' : 'TICKET_HOLDER',
    myTicket: enrollment.tickets.get(user.phone) || null,
    // Hide other tickets if not owner
    tickets: isOwner ? enrollmentObj.tickets : undefined
  };
});
```

---

## CHANGE 2: checkEnrollmentStatus

### Problem
Only checks by `userId`. Users whose tickets were bought by others see incorrect status.

### Current Code
```javascript
const enrollment = await EventEnrollment.findOne({
  userId: req.user.id,
  eventId
});
```

### Required Change
```javascript
const user = await User.findById(req.user.id).select('phone');

const enrollment = await EventEnrollment.findOne({
  eventId,
  $or: [
    { userId: req.user.id },
    { [`tickets.${user.phone}`]: { $exists: true } }
  ]
});
```

### Response Enhancement
Add relationship info:
```javascript
const isOwner = enrollment.userId.toString() === req.user.id;
const myTicket = enrollment.tickets.get(user.phone);

return responseUtil.success(res, "Enrollment status retrieved", {
  isEnrolled: true,
  relationship: isOwner ? 'OWNER' : 'TICKET_HOLDER',
  myTicket: myTicket ? {
    phone: user.phone,
    status: myTicket.status,
    isTicketScanned: myTicket.isTicketScanned
  } : null,
  // ... rest of response
});
```

---

## CHANGE 3: getEnrollmentById

### Problem
Users can only view enrollments where they are the buyer.

### Current Code (for non-admin users)
```javascript
const enrollment = await EventEnrollment.findOne({
  _id: id,
  userId: req.user.id
});
```

### Required Change
```javascript
const user = await User.findById(req.user.id).select('phone');

const enrollment = await EventEnrollment.findOne({
  _id: id,
  $or: [
    { userId: req.user.id },
    { [`tickets.${user.phone}`]: { $exists: true } }
  ]
});
```

### Response Enhancement
Same as Change 1 - add `relationship` and `myTicket`, hide other tickets if not owner.

---

## CHANGE 4: cancelEnrollment

### Problem
Users who access enrollment via phone (not owner) should only cancel their own ticket.

### Required Validation
Add after finding enrollment:
```javascript
const isOwner = enrollment.userId.toString() === req.user.id;

if (!isOwner) {
  const user = await User.findById(req.user.id).select('phone');

  // Non-owners cannot cancel all tickets
  if (cancelAll) {
    return responseUtil.forbidden(res, "You can only cancel your own ticket");
  }

  // Non-owners can only cancel their own phone's ticket
  if (phone !== user.phone) {
    return responseUtil.forbidden(res, "You can only cancel your own ticket");
  }
}
```

---

## Implementation Notes

### MongoDB Query for Map Fields
Tickets is a Mongoose Map. Query keys using dot notation:
```javascript
{ [`tickets.${phoneNumber}`]: { $exists: true } }
```

### User Phone Fetch
Each function needs user's phone. Fetch once at start:
```javascript
const user = await User.findById(req.user.id).select('phone');
```

### Response Structure
```javascript
{
  _id: "enrollmentId",
  eventId: { /* populated event */ },
  ticketCount: 3,
  tierName: "VIP",

  // New fields
  relationship: "OWNER" | "TICKET_HOLDER",
  myTicket: {
    phone: "+919876543210",
    status: "ACTIVE",
    isTicketScanned: false
  },
  tickets: { /* Map - only if OWNER */ }
}
```

---

## CHANGE 5: Cash Payment - Create Payment Record

### File to Modify
[src/cash/cash.controller.js](src/cash/cash.controller.js)

### Problem
Cash orders create EventEnrollment but skip Payment record. Admin payment reports are incomplete.

### Required Change
Add import at top:
```javascript
import Payment from '../../schema/Payment.schema.js';
```

In `createCashOrder`, after creating enrollment and before sending response:
```javascript
// Create Payment record for cash transaction
const payment = new Payment({
  orderId: orderId,
  paymentId: paymentId,
  type: 'EVENT',
  eventId: eventId,
  amount: totalAmount,
  finalAmount: totalAmount,
  status: 'SUCCESS',
  purchaseDateTime: new Date(),
  metadata: {
    paymentMethod: 'CASH',
    partnerCode: partner.partnerCode,
    partnerName: partner.name,
    buyer: buyer,
    others: others,
    totalTickets: totalTickets
  }
});
await payment.save();
```

---

## CHANGE 6: Admin Payment Filter by Method

### File to Modify
[src/Enrollment/payment.controller.js](src/Enrollment/payment.controller.js) - in admin payment listing function

### Required Change
Add filter option for payment method:
```javascript
// In the filter building section
if (req.query.paymentMethod === 'CASH') {
  filter['metadata.paymentMethod'] = 'CASH';
} else if (req.query.paymentMethod === 'RAZORPAY') {
  filter['metadata.paymentMethod'] = { $ne: 'CASH' };
}
```

### Route Update (if validation exists)
Add `paymentMethod` to allowed query params:
```javascript
paymentMethod: Joi.string().valid('CASH', 'RAZORPAY').optional()
```

---

## Testing Scenarios

1. User A buys 3 tickets (A's phone + B's phone + C's phone)
2. User B logs in:
   - Sees event in enrolled list with `relationship: "TICKET_HOLDER"`
   - Sees only their ticket data in `myTicket`
   - Cannot see A's or C's ticket details
   - Can cancel only their own ticket
3. User A logs in:
   - Sees event with `relationship: "OWNER"`
   - Sees all tickets in `tickets` field
   - Can cancel any ticket or all tickets
4. Cash order created:
   - Payment record created with `metadata.paymentMethod: 'CASH'`
   - Visible in admin payment reports
5. Admin filters payments:
   - Can filter by `paymentMethod=CASH` or `paymentMethod=RAZORPAY`
