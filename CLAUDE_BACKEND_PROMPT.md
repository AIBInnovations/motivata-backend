# Backend Implementation Prompt for Claude

## Task Overview

Implement a Feature Access Control system in the backend (Node.js + Express + MongoDB) that allows admins to control which features require active membership. The frontend is already complete and waiting for these endpoints.

## Context

We have a Motivata app with membership functionality already implemented. We need to add access control for 3 specific features:

1. **SOS** - Quizzes feature
2. **CONNECT** - Clubs/community feature
3. **CHALLENGE** - Challenges feature

Admins should be able to:
- Toggle whether each feature requires membership or is open to all
- Enable/disable features entirely

Users trying to access features should be checked against these settings and their membership status.

## What You Need to Implement

### 1. Create Mongoose Model: FeatureAccess

**File:** `models/FeatureAccess.js`

```javascript
const mongoose = require('mongoose');

const featureAccessSchema = new mongoose.Schema(
  {
    featureKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    featureName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    requiresMembership: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
featureAccessSchema.index({ featureKey: 1 });

const FeatureAccess = mongoose.model('FeatureAccess', featureAccessSchema);

module.exports = FeatureAccess;
```

### 2. Create Controller: featureAccessController.js

**File:** `controllers/featureAccessController.js`

Implement 3 controller methods:

#### Method 1: getAllFeatureAccess
- Route: `GET /web/feature-access`
- Auth: Required (Admin only)
- Returns: Array of all feature access settings sorted by featureKey

#### Method 2: updateFeatureAccess
- Route: `PUT /web/feature-access`
- Auth: Required (Admin only)
- Body: `{ featureKey: String, requiresMembership: Boolean, isActive: Boolean }`
- Logic: Use `findOneAndUpdate` with `upsert: true` to create or update
- Returns: Updated feature object

#### Method 3: checkFeatureAccess
- Route: `POST /web/feature-access/check`
- Auth: NOT required (public endpoint for mobile apps)
- Body: `{ featureKey: String, phone: String }`
- Logic: **This is the most important method** - implement this flow:

```javascript
async function checkFeatureAccess(req, res) {
  const { featureKey, phone } = req.body;

  // Step 1: Validate input
  if (!featureKey || !phone) {
    return res.status(400).json({
      success: false,
      error: 'Validation error: phone and featureKey are required',
      status: 400,
    });
  }

  // Step 2: Get feature settings
  const feature = await FeatureAccess.findOne({
    featureKey: featureKey.toUpperCase(),
  });

  // Step 3: Check if feature exists and is active
  if (!feature || !feature.isActive) {
    return res.json({
      success: true,
      data: {
        hasAccess: false,
        reason: 'FEATURE_INACTIVE',
        message: 'This feature is currently unavailable',
      },
    });
  }

  // Step 4: Check if membership is required
  if (!feature.requiresMembership) {
    // Feature is open to all
    return res.json({
      success: true,
      data: {
        hasAccess: true,
        reason: 'OPEN_TO_ALL',
        message: 'Access granted',
      },
    });
  }

  // Step 5: Check user's membership status
  const membership = await UserMembership.findOne({
    phone: phone,
    status: 'ACTIVE',
    endDate: { $gte: new Date() },
  }).populate('membershipPlanId');

  // Step 6: Validate membership
  if (!membership) {
    return res.json({
      success: true,
      data: {
        hasAccess: false,
        reason: 'NO_ACTIVE_MEMBERSHIP',
        message: 'This feature requires an active membership',
      },
    });
  }

  // All checks passed - grant access
  const daysRemaining = Math.ceil(
    (membership.endDate - new Date()) / (1000 * 60 * 60 * 24)
  );

  return res.json({
    success: true,
    data: {
      hasAccess: true,
      reason: 'MEMBERSHIP_VALID',
      message: 'Access granted',
      membership: {
        planName: membership.membershipPlanId?.name || 'Unknown Plan',
        endDate: membership.endDate,
        daysRemaining: daysRemaining,
      },
    },
  });
}
```

**Important Notes for Controller:**
- Import both `FeatureAccess` and `UserMembership` models
- Use try-catch for error handling
- Return 500 status for server errors
- The `checkFeatureAccess` endpoint returns 200 even for denied access (the denial is in the data)

### 3. Create Routes: featureAccessRoutes.js

**File:** `routes/featureAccessRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const featureAccessController = require('../controllers/featureAccessController');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// Admin routes - protected
router.get('/feature-access', authenticateAdmin, featureAccessController.getAllFeatureAccess);
router.put('/feature-access', authenticateAdmin, featureAccessController.updateFeatureAccess);

// Public route - can be called from mobile app
router.post('/feature-access/check', featureAccessController.checkFeatureAccess);

module.exports = router;
```

### 4. Register Routes in Main App

**File:** `app.js` or `routes/index.js`

Add this line where other routes are registered:

```javascript
const featureAccessRoutes = require('./routes/featureAccessRoutes');

// Register routes
app.use('/api/web', featureAccessRoutes);
```

### 5. Seed Initial Data (Optional but Recommended)

**File:** `seeds/featureAccessSeed.js`

```javascript
const FeatureAccess = require('../models/FeatureAccess');

const initialFeatures = [
  {
    featureKey: 'SOS',
    featureName: 'SOS Feature (Quizzes)',
    description: 'Access to SOS quizzes and assessments',
    requiresMembership: false,
    isActive: true,
  },
  {
    featureKey: 'CONNECT',
    featureName: 'Connect Feature (Clubs)',
    description: 'Access to clubs and community features',
    requiresMembership: false,
    isActive: true,
  },
  {
    featureKey: 'CHALLENGE',
    featureName: 'Challenge Feature (Challenges)',
    description: 'Access to challenges and competitions',
    requiresMembership: false,
    isActive: true,
  },
];

async function seedFeatureAccess() {
  try {
    for (const feature of initialFeatures) {
      await FeatureAccess.findOneAndUpdate(
        { featureKey: feature.featureKey },
        feature,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Feature access data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding feature access data:', error);
  }
}

module.exports = seedFeatureAccess;
```

Then call this seed function when your server starts (in your main app file):

```javascript
const seedFeatureAccess = require('./seeds/featureAccessSeed');

// After MongoDB connection is established
seedFeatureAccess();
```

## Existing Models You'll Use

### UserMembership Model (Already Exists)

You need to import and use the existing `UserMembership` model in the `checkFeatureAccess` controller. The model structure is:

```javascript
{
  phone: String,
  membershipPlanId: ObjectId, // ref: 'MembershipPlan'
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED',
  startDate: Date,
  endDate: Date,
  // ... other fields
}
```

**Query for active membership:**
```javascript
const membership = await UserMembership.findOne({
  phone: phone,
  status: 'ACTIVE',
  endDate: { $gte: new Date() }
}).populate('membershipPlanId');
```

## API Response Formats

### Standard Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Standard Error Response:
```json
{
  "success": false,
  "error": "Error message",
  "status": 400
}
```

### Access Check Responses:

**Access Granted (Open to All):**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "reason": "OPEN_TO_ALL",
    "message": "Access granted"
  }
}
```

**Access Granted (Valid Membership):**
```json
{
  "success": true,
  "data": {
    "hasAccess": true,
    "reason": "MEMBERSHIP_VALID",
    "message": "Access granted",
    "membership": {
      "planName": "Premium Membership",
      "endDate": "2024-12-31T23:59:59.999Z",
      "daysRemaining": 356
    }
  }
}
```

**Access Denied (Feature Inactive):**
```json
{
  "success": true,
  "data": {
    "hasAccess": false,
    "reason": "FEATURE_INACTIVE",
    "message": "This feature is currently unavailable"
  }
}
```

**Access Denied (No Membership):**
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

## Testing Commands

After implementation, test with these cURL commands:

```bash
# 1. Get all features (admin)
curl -X GET http://localhost:5000/api/web/feature-access \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# 2. Update feature (admin)
curl -X PUT http://localhost:5000/api/web/feature-access \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "featureKey": "SOS",
    "requiresMembership": true,
    "isActive": true
  }'

# 3. Check access (public - no auth)
curl -X POST http://localhost:5000/api/web/feature-access/check \
  -H "Content-Type: application/json" \
  -d '{
    "featureKey": "SOS",
    "phone": "+919876543210"
  }'
```

## Important Implementation Notes

1. **Reason Codes:** Use exactly these reason codes (they match the frontend):
   - `FEATURE_INACTIVE` - Feature is disabled
   - `OPEN_TO_ALL` - No membership required
   - `NO_ACTIVE_MEMBERSHIP` - User has no membership
   - `MEMBERSHIP_VALID` - User has active membership

2. **Feature Keys:** Only these 3 feature keys exist:
   - `SOS`
   - `CONNECT`
   - `CHALLENGE`

3. **Admin Authentication:**
   - GET and PUT endpoints must use `authenticateAdmin` middleware
   - POST check endpoint is public (for mobile app)

4. **Case Sensitivity:**
   - Always convert featureKey to uppercase when querying
   - `featureKey.toUpperCase()`

5. **Date Comparison:**
   - Use `endDate: { $gte: new Date() }` to check if membership is valid

6. **Error Handling:**
   - Wrap all database operations in try-catch
   - Return 500 status for server errors
   - Return 400 status for validation errors

7. **Response Format:**
   - Note that denied access still returns 200 status
   - The denial is indicated in `data.hasAccess: false`

## File Structure

```
backend/
├── models/
│   ├── FeatureAccess.js          (create this)
│   └── UserMembership.js         (already exists - use it)
├── controllers/
│   └── featureAccessController.js (create this)
├── routes/
│   └── featureAccessRoutes.js     (create this)
├── seeds/
│   └── featureAccessSeed.js       (create this)
├── middleware/
│   └── authMiddleware.js          (already exists - use authenticateAdmin)
└── app.js                          (modify to register routes)
```

## Success Criteria

Implementation is successful when:

1. ✅ GET endpoint returns all 3 features
2. ✅ PUT endpoint creates/updates features correctly
3. ✅ POST check endpoint works without authentication
4. ✅ Access is granted when feature is open to all
5. ✅ Access is denied when feature is inactive
6. ✅ Access is granted when user has active membership
7. ✅ Access is denied when user has no membership
8. ✅ All responses follow the specified format
9. ✅ Seeded data appears in database

## Common Pitfalls to Avoid

1. ❌ Don't require authentication on the POST check endpoint
2. ❌ Don't return 403 or 401 for denied access - return 200 with hasAccess: false
3. ❌ Don't forget to populate membershipPlanId when querying UserMembership
4. ❌ Don't forget to convert featureKey to uppercase
5. ❌ Don't forget to check both status='ACTIVE' AND endDate >= now

## Additional Context

- The frontend is already complete and expects these exact endpoints
- The admin panel is at `/feature-access` route
- Mobile apps will call the POST check endpoint before showing features
- The existing membership system already handles purchases and renewals
- This new system only adds the access control layer on top

## Questions to Answer While Implementing

1. Where is the `authenticateAdmin` middleware located? (Use that path in your imports)
2. What is the exact path to the `UserMembership` model? (Use that path in your imports)
3. Where in your app.js should the routes be registered? (Add after other /web routes)

## Start Implementation

Please implement the backend exactly as specified above. Create all 4 files (model, controller, routes, seed) and register the routes in the main app. Use the existing project structure and conventions. Test with the provided cURL commands after implementation.
