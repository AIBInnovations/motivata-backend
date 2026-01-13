# Fix ALL Deleted Memberships - MongoDB Commands

## Issue
Multiple users may have deleted memberships that still grant access to features because:
- The membership has `isDeleted: true` (soft deleted)
- But `status` is still `"ACTIVE"` or `"PENDING"` (should be "CANCELLED")
- Feature access check was finding these and granting access

## Quick Fix - Run This MongoDB Command

### Step 1: Check How Many Are Affected

```javascript
// Connect to your database
mongosh "your-mongodb-connection-string"

// Switch to motivata database
use motivata

// Count how many problematic memberships exist
db.usermemberships.countDocuments({
  isDeleted: true,
  status: { $in: ["ACTIVE", "PENDING"] }
})
```

### Step 2: See Which Users Are Affected

```javascript
// List all affected users
db.usermemberships.find(
  {
    isDeleted: true,
    status: { $in: ["ACTIVE", "PENDING"] }
  },
  {
    phone: 1,
    status: 1,
    isDeleted: 1,
    endDate: 1,
    "planSnapshot.name": 1
  }
).sort({ phone: 1 })
```

### Step 3: Fix ALL Affected Memberships

```javascript
// Update all deleted memberships to CANCELLED status
db.usermemberships.updateMany(
  {
    isDeleted: true,
    status: { $in: ["ACTIVE", "PENDING"] }
  },
  {
    $set: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "Deleted by admin - retroactive fix"
    }
  }
)
```

**Expected Output:**
```javascript
{
  acknowledged: true,
  matchedCount: X,    // Number of memberships found
  modifiedCount: X    // Number of memberships updated
}
```

### Step 4: Verify the Fix

```javascript
// Check if any problematic memberships still exist
db.usermemberships.countDocuments({
  isDeleted: true,
  status: { $in: ["ACTIVE", "PENDING"] }
})

// Should return: 0
```

### Step 5: Verify Feature Access is Revoked

```javascript
// For each affected phone, check if they still have valid access
db.usermemberships.find({
  isDeleted: false,
  status: "ACTIVE",
  endDate: { $gte: new Date() }
}).sort({ phone: 1 })

// This shows users who STILL have valid access (different memberships)
// Users not in this list will be denied feature access
```

---

## Alternative: MongoDB Compass GUI

1. **Open MongoDB Compass**
2. **Connect to your database**
3. **Navigate to:** `motivata` database → `usermemberships` collection

4. **Filter for problematic memberships:**
   ```json
   {
     "isDeleted": true,
     "status": { "$in": ["ACTIVE", "PENDING"] }
   }
   ```

5. **Select all matching documents** (if Compass supports bulk edit)
   OR edit each one individually:
   - Click "Edit Document"
   - Change `status` from `"ACTIVE"` to `"CANCELLED"`
   - Add field: `cancelledAt` = current date
   - Add field: `cancellationReason` = `"Deleted by admin"`
   - Click "Update"

---

## Alternative: Node.js Script

If you have Node.js access and MongoDB connection:

```bash
# Set your MongoDB connection string
export MONGODB_URI="your-mongodb-connection-string"

# Run the fix script
node fix-all-deleted-active-memberships.js
```

This script will:
- Find all problematic memberships
- Show detailed info for each one
- Update all of them to CANCELLED status
- Verify the fix worked
- Show which users lost access vs still have valid memberships

---

## What This Fixes

### Before Fix:
```javascript
{
  _id: ObjectId("..."),
  phone: "8085816197",
  status: "ACTIVE",         // ❌ Still active!
  paymentStatus: "SUCCESS",
  isDeleted: true,          // Marked as deleted
  deletedAt: ISODate("..."),
  // User CAN still access features ❌
}
```

### After Fix:
```javascript
{
  _id: ObjectId("..."),
  phone: "8085816197",
  status: "CANCELLED",      // ✅ Now cancelled
  paymentStatus: "SUCCESS",
  isDeleted: true,
  deletedAt: ISODate("..."),
  cancelledAt: ISODate("..."),      // ✅ Added
  cancellationReason: "Deleted by admin - retroactive fix",
  // User CANNOT access features ✅
}
```

---

## Testing After Fix

### Test Feature Access for Affected Users

For each affected phone number, test:

```bash
curl -X POST http://your-backend-url/api/web/feature-access/check \
  -H "Content-Type: application/json" \
  -d '{"featureKey":"SOS","phone":"PHONE_NUMBER"}'
```

**Expected Response (if no other valid memberships):**
```json
{
  "success": true,
  "data": {
    "hasAccess": false,
    "reason": "NO_ACTIVE_MEMBERSHIP",
    "message": "This feature requires an active membership"
  }
}
```

**If they DO have another valid membership:**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "reason": "MEMBERSHIP_VALID",
    "message": "Access granted",
    "membership": { ... }
  }
}
```

---

## Important Notes

### This Fix is Safe Because:
1. ✅ Only affects memberships where `isDeleted: true` (already deleted by admin)
2. ✅ Only changes status from ACTIVE/PENDING to CANCELLED (semantic correction)
3. ✅ Doesn't modify memberships that are truly active (isDeleted: false)
4. ✅ Adds proper cancellation metadata for audit trail

### Users Affected:
- Users whose memberships were deleted via admin panel
- But still had `status: "ACTIVE"` in database
- Were able to access SOS, Connect, Challenge features illegally

### Users NOT Affected:
- Users with valid, non-deleted memberships (isDeleted: false)
- Users with expired memberships (already handled correctly)
- Users with properly cancelled memberships (status already CANCELLED)

---

## Expected Impact

After running this fix:

1. **Users who were deleted will lose access immediately**
   - App will show "Membership Required" modal
   - Cannot access SOS, Connect, or Challenge features
   - No backend restart needed

2. **Users with valid memberships unaffected**
   - If a user has multiple memberships
   - And one was deleted but another is still valid
   - They will still have access via the valid membership

3. **Audit trail improved**
   - All deleted memberships now have proper cancellation data
   - cancelledAt timestamp shows when they were cancelled
   - cancellationReason explains why

---

## Rollback (If Needed)

If you need to undo this change (unlikely):

```javascript
// WARNING: Only run if you need to revert
db.usermemberships.updateMany(
  {
    isDeleted: true,
    status: "CANCELLED",
    cancellationReason: "Deleted by admin - retroactive fix"
  },
  {
    $set: {
      status: "ACTIVE"
    },
    $unset: {
      cancelledAt: "",
      cancellationReason: ""
    }
  }
)
```

But this would re-introduce the bug, so only do this if absolutely necessary.

---

## Summary

**Single Command to Fix Everything:**

```javascript
db.usermemberships.updateMany(
  { isDeleted: true, status: { $in: ["ACTIVE", "PENDING"] } },
  { $set: {
    status: "CANCELLED",
    cancelledAt: new Date(),
    cancellationReason: "Deleted by admin - retroactive fix"
  }}
)
```

**Then verify:**
```javascript
db.usermemberships.countDocuments({ isDeleted: true, status: "ACTIVE" })
// Should return 0
```

**Done!** All deleted memberships are now properly cancelled and won't grant feature access.
