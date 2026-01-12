# Restore Deleted Membership Plan

## Issue
A membership plan was soft-deleted from the admin frontend but still exists in the database with `isDeleted: true`.

---

## Solution Options

### Option 1: Using API Endpoint (Recommended)

The backend already has a restore endpoint implemented.

**Endpoint:** `POST /api/admin/membership-plans/:id/restore`

**Request:**
```bash
POST http://localhost:5000/api/admin/membership-plans/{planId}/restore
Headers:
  Authorization: Bearer {admin_access_token}
  Content-Type: application/json
```

**Using curl:**
```bash
# Replace YOUR_PLAN_ID and YOUR_ADMIN_TOKEN with actual values
curl -X POST \
  http://localhost:5000/api/admin/membership-plans/YOUR_PLAN_ID/restore \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Using Postman:**
1. Method: `POST`
2. URL: `http://localhost:5000/api/admin/membership-plans/695be44869cdb8c106f6bff6/restore`
   (Replace the ID with your actual plan ID)
3. Headers:
   - `Authorization`: `Bearer {your_admin_token}`
   - `Content-Type`: `application/json`
4. Body: (empty)
5. Click **Send**

**Success Response:**
```json
{
  "success": true,
  "message": "Membership plan restored successfully",
  "data": {
    "plan": {
      "_id": "695be44869cdb8c106f6bff6",
      "name": "Premium Monthly",
      "isDeleted": false,
      "deletedAt": null,
      "deletedBy": null,
      ...
    }
  }
}
```

---

### Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Navigate to `membershipplans` collection
4. Find the deleted plan:
   ```javascript
   { isDeleted: true }
   ```
5. Click **Edit Document** on the deleted plan
6. Update these fields:
   ```json
   {
     "isDeleted": false,
     "deletedAt": null,
     "deletedBy": null
   }
   ```
7. Click **Update**

---

### Option 3: Using MongoDB Shell

```javascript
// Connect to MongoDB
mongosh

// Switch to your database
use motivata

// Find the deleted plan (to verify it exists)
db.membershipplans.findOne({ isDeleted: true })

// Restore the plan by ID
db.membershipplans.updateOne(
  { _id: ObjectId("695be44869cdb8c106f6bff6") }, // Replace with your plan ID
  {
    $set: {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null
    }
  }
)

// Verify restoration
db.membershipplans.findOne({ _id: ObjectId("695be44869cdb8c106f6bff6") })
```

---

### Option 4: Using Node.js Script

Create a file `restore-plan.js`:

```javascript
import mongoose from 'mongoose';
import MembershipPlan from './schema/MembershipPlan.schema.js';

// Connect to MongoDB
const MONGODB_URI = 'mongodb://localhost:27017/motivata'; // Update with your URI
await mongoose.connect(MONGODB_URI);

// Find deleted plan
const planId = '695be44869cdb8c106f6bff6'; // Replace with your plan ID

const plan = await MembershipPlan.findOne({
  _id: planId,
  isDeleted: true
});

if (!plan) {
  console.log('❌ Deleted plan not found');
  process.exit(1);
}

console.log('Found deleted plan:', plan.name);

// Restore using the schema method
await plan.restore();

console.log('✓ Plan restored successfully!');
console.log('Plan details:', {
  id: plan._id,
  name: plan.name,
  isDeleted: plan.isDeleted,
  isActive: plan.isActive
});

await mongoose.disconnect();
```

Run it:
```bash
node restore-plan.js
```

---

## How to Find Your Plan ID

If you don't know the plan ID, here's how to find it:

### Using MongoDB Compass:
1. Open `membershipplans` collection
2. Filter: `{ "isDeleted": true }`
3. Look for your plan name (e.g., "Premium Monthly")
4. Copy the `_id` field

### Using MongoDB Shell:
```javascript
// Find all deleted plans
db.membershipplans.find({ isDeleted: true }, { _id: 1, name: 1, price: 1 })

// Example output:
// {
//   "_id": ObjectId("695be44869cdb8c106f6bff6"),
//   "name": "Premium Monthly",
//   "price": 499
// }
```

### Using API:
If you have admin access, you can list all plans including deleted ones:

```bash
# Get all plans (including deleted)
curl -X GET \
  "http://localhost:5000/api/admin/membership-plans?includeDeleted=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Verify Restoration

After restoring, verify the plan is available:

### Check in Admin Panel:
1. Log into admin panel
2. Navigate to Membership Plans
3. The plan should now be visible

### Check via API:
```bash
# Get single plan by ID
curl -X GET \
  http://localhost:5000/api/admin/membership-plans/695be44869cdb8c106f6bff6 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check in Database:
```javascript
db.membershipplans.findOne(
  { _id: ObjectId("695be44869cdb8c106f6bff6") },
  { name: 1, isDeleted: 1, isActive: 1, deletedAt: 1 }
)

// Should return:
// {
//   "_id": ObjectId("695be44869cdb8c106f6bff6"),
//   "name": "Premium Monthly",
//   "isDeleted": false,
//   "isActive": true,
//   "deletedAt": null
// }
```

---

## Troubleshooting

### Plan Not Found Error
If you get "Deleted plan not found":
- Verify the plan ID is correct
- Check if `isDeleted` is actually `true` in the database
- Ensure you're connected to the correct database

### Unauthorized Error
If you get 401/403 error:
- Verify your admin token is valid
- Check if the token has expired
- Ensure the user has admin permissions

### Plan Still Not Showing in Frontend
If the plan is restored but not showing:
- Check if `isActive` is `true`
- Refresh the frontend page
- Clear browser cache
- Check if the frontend is filtering by `isDeleted`

---

## Prevention

To prevent accidental deletions in the future:

1. **Add Confirmation Dialog** in admin frontend:
   ```javascript
   const handleDelete = async (planId) => {
     const confirmed = window.confirm(
       'Are you sure you want to delete this plan? It can be restored later.'
     );
     if (!confirmed) return;

     // Proceed with deletion
   };
   ```

2. **Add "Restore" Button** in admin panel:
   - Show deleted plans in a separate section
   - Add a "Restore" button for each deleted plan
   - Call the restore API endpoint

3. **Implement Hard Delete** separately:
   - Keep soft delete for regular deletions
   - Add a separate "Permanently Delete" action
   - Require super admin permissions

---

## Quick Command Reference

```bash
# Using the API (recommended)
curl -X POST http://localhost:5000/api/admin/membership-plans/PLAN_ID/restore \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Using MongoDB Shell
mongosh
use motivata
db.membershipplans.updateOne(
  { _id: ObjectId("PLAN_ID") },
  { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
)

# Verify
db.membershipplans.findOne({ _id: ObjectId("PLAN_ID") })
```

---

## Related Files

- Schema: `schema/MembershipPlan.schema.js` (line 181-186: restore method)
- Controller: `src/Membership/membership.controller.js` (line 343-376: restoreMembershipPlan)
- Routes: `src/Membership/admin.membership.route.js` (line 99-103: restore route)

---

**Last Updated:** 2026-01-12
**Status:** Solution Available
