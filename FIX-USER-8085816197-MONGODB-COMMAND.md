# Fix User 8085816197 - MongoDB Command

## Issue
User with phone `8085816197` was deleted from admin panel but still has access to members-only features because:
- The membership has `isDeleted: true` (soft deleted)
- But `status` is still `"ACTIVE"` (should be "CANCELLED")
- Feature access check was finding it and granting access

## Quick Fix - Run This MongoDB Command

### Option 1: Using MongoDB Shell (mongosh)

```javascript
// Connect to your database
mongosh "your-mongodb-connection-string"

// Switch to motivata database
use motivata

// Find and update all deleted but still ACTIVE memberships for this phone
db.usermemberships.updateMany(
  {
    phone: "8085816197",
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

// Verify the fix
db.usermemberships.find({ phone: "8085816197" }).pretty()
```

### Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to `motivata` database → `usermemberships` collection
4. Click "Filter" and enter:
   ```json
   { "phone": "8085816197", "isDeleted": true }
   ```
5. For each matching document:
   - Click "Edit Document"
   - Change `status` from `"ACTIVE"` to `"CANCELLED"`
   - Add `cancelledAt` with current date
   - Add `cancellationReason`: `"Deleted by admin"`
   - Click "Update"

### Option 3: Using Node.js Script (when MongoDB is running)

If your MongoDB server is running, you can use the script I created:

```bash
node fix-user-8085816197.js
```

(You'll need to set the correct MONGODB_URI environment variable first)

## Expected Result

**Before Fix:**
```javascript
{
  _id: ObjectId("..."),
  phone: "8085816197",
  status: "ACTIVE",         // ❌ Still active!
  paymentStatus: "SUCCESS",
  isDeleted: true,          // Soft deleted
  deletedAt: ISODate("..."),
  // User can still access features!
}
```

**After Fix:**
```javascript
{
  _id: ObjectId("..."),
  phone: "8085816197",
  status: "CANCELLED",      // ✅ Now cancelled
  paymentStatus: "SUCCESS",
  isDeleted: true,
  deletedAt: ISODate("..."),
  cancelledAt: ISODate("..."),  // ✅ Added
  cancellationReason: "Deleted by admin - retroactive fix",
  // User can no longer access features
}
```

## Verification

After running the fix, test feature access:

```bash
curl -X POST http://your-backend-url/api/web/feature-access/check \
  -H "Content-Type: application/json" \
  -d '{"featureKey":"SOS","phone":"8085816197"}'
```

**Expected Response:**
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

## Have the User Test

1. User opens app
2. Tries to access SOS or Connect feature
3. Should see "Membership Required" modal
4. Access should be denied

## Note

The code fixes I made will prevent this from happening again:
- ✅ `softDelete()` now changes status to "CANCELLED"
- ✅ Feature access query now checks `isDeleted: false`

But for THIS specific user, we need to manually fix the database since they were deleted before the fix was deployed.
