# Club Posting Permissions - Implementation Complete

## Overview
Successfully implemented configurable posting permissions for clubs with three permission levels:
1. **ANYONE** - Any authenticated user can post (no membership required)
2. **MEMBERS** - Only approved club members can post (default, maintains backwards compatibility)
3. **ADMIN_ONLY** - Only system admins can post

---

## Changes Made

### 1. Database Schema - Club.schema.js
**File**: `schema/Club.schema.js`

**Added Field** (lines 74-85):
```javascript
postPermission: {
  type: String,
  enum: ['ANYONE', 'MEMBERS', 'ADMIN_ONLY'],
  default: 'MEMBERS',  // Backwards compatible
  index: true,
}
```

---

### 2. Post Creation Logic - post.controller.js
**File**: `src/Connect/post.controller.js`

**Updated** (lines 81-128):
- Replaced simple membership check with switch statement
- Checks `club.postPermission` field
- For `ANYONE`: No restrictions
- For `MEMBERS`: Checks `ClubMember.isMember()`
- For `ADMIN_ONLY`: Checks `req.user.userType === 'admin'`
- Includes fallback for existing clubs without `postPermission`

**Key Code**:
```javascript
const postPermission = club.postPermission || 'MEMBERS';
const isAdmin = req.user.userType === 'admin';

switch (postPermission) {
  case 'ANYONE':
    // No restrictions
    break;
  case 'MEMBERS':
    // Check membership
    break;
  case 'ADMIN_ONLY':
    // Check admin status
    break;
}
```

---

### 3. Admin Club Controller - club.admin.controller.js
**File**: `src/Club/club.admin.controller.js`

#### 3.1 Updated `createClub` (lines 18-50)
- Accepts `postPermission` in request body
- Defaults to 'MEMBERS' if not provided

#### 3.2 Updated `updateClub` (lines 138-176)
- Can update `postPermission` field
- Only updates if provided in request

#### 3.3 New Function: `updateClubPostPermission` (lines 323-348)
- Dedicated endpoint for updating post permission
- Similar to `updateClubApprovalSetting`
- Returns updated club with new permission

---

### 4. User Club Controller - club.user.controller.js
**File**: `src/Club/club.user.controller.js`

**Updated Functions**:

#### 4.1 `getAllClubs` (lines 56-68)
- Added `requiresApproval` to response
- Added `postPermission` to response

#### 4.2 `getClubById` (lines 112-126)
- Added `requiresApproval` to response
- Added `postPermission` to response

#### 4.3 `getMyClubs` (lines 559-586)
- Updated populate to include `requiresApproval` and `postPermission`
- Added fields to formatted response

---

### 5. Validation Middleware - validation.middleware.js
**File**: `middleware/validation.middleware.js`

#### 5.1 Updated `clubSchemas.create` (lines 1427-1433)
```javascript
postPermission: Joi.string()
  .valid('ANYONE', 'MEMBERS', 'ADMIN_ONLY')
  .optional()
  .default('MEMBERS')
  .messages({
    "any.only": "Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY",
  }),
```

#### 5.2 Updated `clubSchemas.update` (lines 1453-1458)
```javascript
postPermission: Joi.string()
  .valid('ANYONE', 'MEMBERS', 'ADMIN_ONLY')
  .optional()
  .messages({
    "any.only": "Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY",
  }),
```

#### 5.3 New Schema: `clubSchemas.updatePostPermission` (lines 1582-1590)
```javascript
updatePostPermission: Joi.object({
  postPermission: Joi.string()
    .valid('ANYONE', 'MEMBERS', 'ADMIN_ONLY')
    .required()
    .messages({
      "any.required": "Post permission is required",
      "any.only": "Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY",
    }),
}),
```

---

### 6. Admin Routes - club.admin.route.js
**File**: `src/Club/club.admin.route.js`

#### 6.1 Updated Imports (line 15)
- Added `updateClubPostPermission` to imports

#### 6.2 New Route (lines 93-103)
```javascript
/**
 * @route   PUT /api/web/clubs/:clubId/post-permission
 * @desc    Update club post permission setting
 * @access  Admin only
 */
router.put(
  "/:clubId/post-permission",
  validateParams(clubSchemas.clubId),
  validateBody(clubSchemas.updatePostPermission),
  updateClubPostPermission
);
```

---

## API Changes

### Modified Endpoints

#### 1. Create Club (Updated)
```
POST /api/web/clubs
Body: {
  name: string,
  description: string,
  thumbnail?: string,
  postPermission?: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"  // NEW
}
```

#### 2. Update Club (Updated)
```
PUT /api/web/clubs/:clubId
Body: {
  name?: string,
  description?: string,
  thumbnail?: string,
  requiresApproval?: boolean,
  postPermission?: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"  // NEW
}
```

#### 3. Get Club Details (Updated Response)
```
GET /api/app/connect/clubs/:clubId
Response: {
  ...existing fields,
  requiresApproval: boolean,
  postPermission: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"  // NEW
}
```

#### 4. Get All Clubs (Updated Response)
```
GET /api/app/connect/clubs
Response: {
  clubs: [{
    ...existing fields,
    requiresApproval: boolean,
    postPermission: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"  // NEW
  }]
}
```

#### 5. Get My Clubs (Updated Response)
```
GET /api/app/connect/clubs/my-clubs
Response: {
  clubs: [{
    ...existing fields,
    requiresApproval: boolean,
    postPermission: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"  // NEW
  }]
}
```

### New Endpoint

#### 6. Update Post Permission (New)
```
PUT /api/web/clubs/:clubId/post-permission
Headers: { Authorization: Bearer <admin-token> }
Body: {
  postPermission: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"
}

Response:
{
  success: true,
  message: "Club post permission updated successfully",
  data: {
    club: {
      id: "club_id",
      name: "Club Name",
      postPermission: "ANYONE"
    }
  }
}
```

---

## Error Messages

### Post Creation Errors

**Members Permission**:
```
403 Forbidden
"You must be a member of this club to post"
```

**Admin Only Permission**:
```
403 Forbidden
"Only admins can post in this club"
```

### Validation Errors

**Invalid Permission Value**:
```
400 Bad Request
"Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY"
```

---

## Admin Authentication

The system uses the following check for admin permissions:
```javascript
const isAdmin = req.user.userType === 'admin';
```

This is based on the JWT token decoded in the `authenticate` middleware.

**Admin Schema** (schema/Admin.schema.js):
- `userType` is set to 'admin' during admin login
- Admin roles: ADMIN, SUPER_ADMIN, MANAGEMENT_STAFF (all have `userType: 'admin'`)

---

## Backwards Compatibility

### Existing Clubs
- All existing clubs without `postPermission` will default to 'MEMBERS'
- Schema default ensures consistent behavior
- Post creation logic includes fallback: `club.postPermission || 'MEMBERS'`

### Existing Code
- No breaking changes to existing API contracts
- All previous functionality maintained
- New fields are additive, not replacing

---

## Testing Scenarios

### 1. ANYONE Permission
- ✓ Non-member user creates post → Success
- ✓ Member user creates post → Success
- ✓ Admin creates post → Success

### 2. MEMBERS Permission (Default)
- ✗ Non-member user creates post → 403 Forbidden
- ✓ Member user creates post → Success
- ✓ Admin creates post → Success (if also a member)

### 3. ADMIN_ONLY Permission
- ✗ Non-member user creates post → 403 Forbidden
- ✗ Member user (non-admin) creates post → 403 Forbidden
- ✓ Admin creates post → Success

### 4. Permission Updates
- ✓ Admin updates club from MEMBERS to ANYONE → Success
- ✓ Admin updates club from ANYONE to ADMIN_ONLY → Success
- ✓ Non-admin tries to update → 401/403 Error

### 5. Backwards Compatibility
- ✓ Existing club (no postPermission) → Defaults to MEMBERS
- ✓ Existing members can still post → Success
- ✓ Non-members blocked as before → 403 Forbidden

---

## Frontend Integration Guide

### Admin Panel Changes

#### 1. Club Create/Edit Form
Add dropdown for post permission:

```javascript
<Select label="Who Can Post" name="postPermission" defaultValue="MEMBERS">
  <option value="ANYONE">Anyone (No membership required)</option>
  <option value="MEMBERS">Members Only (Default)</option>
  <option value="ADMIN_ONLY">Admins Only</option>
</Select>
```

#### 2. Club List Display
Show post permission badge:

```javascript
function PostPermissionBadge({ permission }) {
  const config = {
    ANYONE: { label: "Open Posting", color: "green" },
    MEMBERS: { label: "Members Only", color: "blue" },
    ADMIN_ONLY: { label: "Admin Only", color: "red" }
  };

  const { label, color } = config[permission] || config.MEMBERS;
  return <Badge color={color}>{label}</Badge>;
}
```

#### 3. API Integration

**Create Club**:
```javascript
const response = await fetch('/api/web/clubs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: "Fitness Club",
    description: "...",
    thumbnail: "url",
    postPermission: "MEMBERS"  // or ANYONE, ADMIN_ONLY
  })
});
```

**Update Post Permission**:
```javascript
const response = await fetch(`/api/web/clubs/${clubId}/post-permission`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    postPermission: "ANYONE"
  })
});
```

---

### Mobile App Changes

#### 1. Club Detail Screen
Display post permission info and control post button visibility:

```javascript
function ClubDetailScreen({ club, currentUser }) {
  const canPost = checkCanPost(club.postPermission, club.isJoined, currentUser.isAdmin);

  return (
    <View>
      <Text>{club.name}</Text>
      <PostPermissionInfo permission={club.postPermission} />
      {canPost && <Button onPress={handleCreatePost}>Create Post</Button>}
    </View>
  );
}

function checkCanPost(permission, isJoined, isAdmin) {
  switch (permission) {
    case 'ANYONE':
      return true;
    case 'MEMBERS':
      return isJoined;
    case 'ADMIN_ONLY':
      return isAdmin;
    default:
      return isJoined;  // Fallback to MEMBERS
  }
}

function PostPermissionInfo({ permission }) {
  const messages = {
    ANYONE: "Anyone can post in this club",
    MEMBERS: "Only members can post",
    ADMIN_ONLY: "Only admins can post"
  };

  return <Text style={styles.info}>{messages[permission]}</Text>;
}
```

#### 2. Post Creation Flow
Check permission before allowing post creation:

```javascript
async function handleCreatePost(clubId, postData) {
  try {
    const response = await fetch('/api/app/connect/posts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...postData,
        clubId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 403) {
        // Show appropriate error based on permission
        if (error.message.includes('member')) {
          showToast('You must join this club to post');
        } else if (error.message.includes('admin')) {
          showToast('Only admins can post in this club');
        }
      }
      return;
    }

    showToast('Post created successfully!');
  } catch (error) {
    showToast('Failed to create post');
  }
}
```

#### 3. Error Handling
```javascript
function handlePostError(error, club) {
  if (error.status === 403) {
    switch (club.postPermission) {
      case 'MEMBERS':
        Alert.alert(
          'Join Required',
          'You must join this club to post content.',
          [{ text: 'Join Now', onPress: () => joinClub(club.id) }]
        );
        break;
      case 'ADMIN_ONLY':
        Alert.alert(
          'Admin Only',
          'Only administrators can post in this club.',
          [{ text: 'OK' }]
        );
        break;
    }
  }
}
```

---

## Admin Post Creation - Technical Implementation

### Dynamic Author Reference (User/Admin Support)

Posts can now have either a User or an Admin as the author using Mongoose's `refPath` pattern:

**Post Schema Changes**:
```javascript
/**
 * Author type (User or Admin)
 */
authorType: {
  type: String,
  required: true,
  enum: ["User", "Admin"],
  default: "User",
},

/**
 * Post author (User or Admin who created the post)
 * Uses dynamic reference based on authorType
 */
author: {
  type: mongoose.Schema.Types.ObjectId,
  refPath: "authorType",  // Dynamically resolves to User or Admin
  required: true,
  index: true,
},
```

**How It Works**:
1. When creating a post, the `authorType` is set based on `req.user.userType`
2. If `req.user.userType === 'admin'`: `authorType: 'Admin'`
3. If `req.user.userType !== 'admin'`: `authorType: 'User'`
4. Mongoose automatically populates from the correct collection (User or Admin)

**Backwards Compatibility**:
- Existing posts default to `authorType: "User"`
- No migration required
- All existing functionality continues to work

For detailed information, see `CLUB_POSTING_PERMISSIONS_ADMIN_POST_FIX.md`

---

## Admin Post Creation Endpoint

**Note**: Admins create posts using the **same endpoint** as regular users:

```
POST /api/app/connect/posts
Headers: { Authorization: Bearer <admin-token> }
Body: {
  caption: string,
  mediaType: "IMAGE" | "VIDEO",
  mediaUrls: string[],
  mediaThumbnail?: string,
  clubId?: string
}
```

**How Admin Posting Works**:
1. Admin logs in through admin panel
2. Admin JWT token has `userType: 'admin'`
3. When posting to ADMIN_ONLY club:
   - System checks `req.user.userType === 'admin'`
   - Admin can post even if not a member
4. For MEMBERS or ANYONE clubs:
   - Admin must still be a member (for MEMBERS)
   - Or just authenticated (for ANYONE)

**Admin Window for Posting**:
- Admins can use the same Connect/Social interface as users
- Or create a dedicated admin posting interface
- Both use the same `/api/app/connect/posts` endpoint
- Admin authentication is handled by JWT token

---

## Files Modified

### Created:
1. `CLUB_POSTING_PERMISSIONS_PLAN.md` - Implementation plan
2. `CLUB_POSTING_PERMISSIONS_IMPLEMENTATION.md` - This document
3. `CLUB_POSTING_PERMISSIONS_ADMIN_POST_FIX.md` - Admin post creation fix

### Modified:
1. `schema/Club.schema.js` - Added postPermission field
2. `schema/Post.schema.js` - Added authorType field with refPath for User/Admin authors
3. `src/Connect/post.controller.js` - Updated createPost logic with permission checks and author type handling
4. `src/Club/club.admin.controller.js` - Updated create/update, added updateClubPostPermission
5. `src/Club/club.user.controller.js` - Added postPermission to responses
6. `middleware/validation.middleware.js` - Added validation schemas
7. `src/Club/club.admin.route.js` - Added post-permission route

---

## Summary

### What Was Implemented
✓ Club schema updated with postPermission field
✓ Post schema updated to support both User and Admin authors (refPath pattern)
✓ Post creation logic updated with permission checks
✓ Admin can configure post permissions per club
✓ Admins can create posts in clubs (with proper permissions)
✓ Three permission levels: ANYONE, MEMBERS, ADMIN_ONLY
✓ Validation schemas for all new fields
✓ API endpoints for updating post permissions
✓ All club APIs return postPermission field
✓ Backwards compatible (defaults to MEMBERS)
✓ Error messages for each permission violation
✓ Admin authentication integrated (userType check)
✓ Dynamic author reference (User or Admin) with authorType field

### What's Ready
- Backend fully implemented and ready to test
- API documentation complete
- Frontend integration guide provided
- Error handling specified
- Backwards compatibility ensured

### Next Steps
1. **Testing**: Test all three permission levels
2. **Frontend**: Implement admin panel UI for permission management
3. **Mobile App**: Update post creation flow with permission checks
4. **Documentation**: Share with frontend teams

---

## Quick Reference

### Permission Levels
| Permission | Who Can Post | Use Case |
|------------|--------------|----------|
| ANYONE | Any authenticated user | Public discussion clubs |
| MEMBERS | Approved members only | Member-exclusive content |
| ADMIN_ONLY | System admins only | Announcements, official posts |

### Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/web/clubs` | Create club with permission |
| PUT | `/api/web/clubs/:id` | Update club (incl. permission) |
| PUT | `/api/web/clubs/:id/post-permission` | Update only permission |
| GET | `/api/app/connect/clubs/:id` | Get club (returns permission) |
| POST | `/api/app/connect/posts` | Create post (checks permission) |

### Error Codes
| Code | Message | Reason |
|------|---------|--------|
| 403 | "You must be a member..." | Non-member posting to MEMBERS club |
| 403 | "Only admins can post..." | Non-admin posting to ADMIN_ONLY club |
| 400 | "Post permission must be..." | Invalid permission value |

---

**Implementation Complete! Ready for testing and frontend integration.**
