# Club Posting Permissions - Implementation Plan

## Current State Analysis

### Existing Implementation
Currently, club posting has a **single permission model**:
- **Only Club Members Can Post**: Users must be APPROVED members of a club to post
- Check is performed in `post.controller.js` (lines 81-93)
- Uses `ClubMember.isMember(userId, clubId)` to verify membership

### Current Flow
1. User creates post with `clubId`
2. System checks if club exists
3. System verifies user is an APPROVED member
4. If not a member → 403 Forbidden
5. If member → Post created

---

## New Requirement

Add **configurable posting permissions** at the club level with three options:

1. **Anyone Can Post** - No restrictions, any authenticated user can post
2. **Members Can Post** - Only APPROVED club members can post (current behavior)
3. **Only Admins Can Post** - Only system admins can post to this club

---

## Implementation Plan

### Phase 1: Database Schema Changes

#### 1.1 Update Club Schema
**File**: `schema/Club.schema.js`

**Add New Field**:
```javascript
/**
 * Who can post in this club
 * ANYONE - Any authenticated user can post
 * MEMBERS - Only approved club members can post (default)
 * ADMIN_ONLY - Only system admins can post
 */
postPermission: {
  type: String,
  enum: ['ANYONE', 'MEMBERS', 'ADMIN_ONLY'],
  default: 'MEMBERS',
  index: true,
}
```

**Reasoning**:
- `MEMBERS` as default maintains backwards compatibility
- Indexed for efficient querying when filtering clubs by permission type
- Clear enum values that are self-documenting

---

### Phase 2: Controller Updates

#### 2.1 Update Post Creation Logic
**File**: `src/Connect/post.controller.js`

**Current Code** (lines 81-93):
```javascript
if (clubId) {
  const club = await Club.findById(clubId);
  if (!club) {
    return responseUtil.notFound(res, "Club not found");
  }

  const isMember = await ClubMember.isMember(authorId, clubId);
  if (!isMember) {
    return responseUtil.forbidden(res, "You must join this club before posting");
  }
}
```

**New Logic** (replace lines 81-93):
```javascript
if (clubId) {
  const club = await Club.findById(clubId);
  if (!club) {
    return responseUtil.notFound(res, "Club not found");
  }

  // Check posting permissions based on club settings
  const postPermission = club.postPermission || 'MEMBERS'; // fallback for old records

  switch (postPermission) {
    case 'ANYONE':
      // No restrictions, any authenticated user can post
      break;

    case 'MEMBERS':
      // Only approved club members can post
      const isMember = await ClubMember.isMember(authorId, clubId);
      if (!isMember) {
        return responseUtil.forbidden(
          res,
          "You must be a member of this club to post"
        );
      }
      break;

    case 'ADMIN_ONLY':
      // Only system admins can post
      const isAdmin = req.user.role === 'admin'; // Adjust based on your auth system
      if (!isAdmin) {
        return responseUtil.forbidden(
          res,
          "Only admins can post in this club"
        );
      }
      break;

    default:
      // Fallback to MEMBERS permission
      const isMemberDefault = await ClubMember.isMember(authorId, clubId);
      if (!isMemberDefault) {
        return responseUtil.forbidden(
          res,
          "You must be a member of this club to post"
        );
      }
  }
}
```

**Note**: Need to verify how admin role is stored in `req.user`. Might be:
- `req.user.role === 'admin'`
- `req.user.isAdmin === true`
- Separate admin authentication check

---

#### 2.2 Update Admin Club Controller
**File**: `src/Club/club.admin.controller.js`

**Modify `createClub` function** (lines 17-48):
Add `postPermission` to request body extraction:
```javascript
const { name, description, thumbnail, postPermission } = req.body;

const clubData = {
  name,
  description,
  thumbnail: thumbnail || null,
  postPermission: postPermission || 'MEMBERS', // default to MEMBERS
};
```

**Modify `updateClub` function** (lines 137-174):
Add `postPermission` to update logic:
```javascript
const { name, description, thumbnail, requiresApproval, postPermission } = req.body;

// Update only provided fields
if (name !== undefined) club.name = name;
if (description !== undefined) club.description = description;
if (thumbnail !== undefined) club.thumbnail = thumbnail || null;
if (requiresApproval !== undefined) club.requiresApproval = requiresApproval;
if (postPermission !== undefined) club.postPermission = postPermission;
```

**Add New Function: `updateClubPostPermission`**
Similar to `updateClubApprovalSetting`, create a dedicated endpoint:
```javascript
export const updateClubPostPermission = async (req, res) => {
  try {
    const { clubId } = req.params;
    const { postPermission } = req.body;

    const club = await Club.findById(clubId);

    if (!club) {
      return responseUtil.notFound(res, "Club not found");
    }

    club.postPermission = postPermission;
    await club.save();

    return responseUtil.success(res, "Club post permission updated successfully", {
      club: {
        id: club._id,
        name: club.name,
        postPermission: club.postPermission,
      },
    });
  } catch (error) {
    console.error("[CLUB-ADMIN] Update post permission error:", error);
    return responseUtil.internalError(res, "Failed to update post permission", error.message);
  }
};
```

---

#### 2.3 Update User Club Controller
**File**: `src/Club/club.user.controller.js`

**Modify `getClubById` function** (lines 93-127):
Add `postPermission` to response:
```javascript
return responseUtil.success(res, "Club fetched successfully", {
  club: {
    id: club._id,
    name: club.name,
    description: club.description,
    thumbnail: club.thumbnail,
    memberCount: club.memberCount,
    postCount: club.postCount,
    isJoined,
    requiresApproval: club.requiresApproval,
    postPermission: club.postPermission, // NEW FIELD
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
  },
});
```

**Modify `getAllClubs` function** (lines 24-85):
Add `postPermission` to formatted response:
```javascript
const formattedClubs = clubs.map((club) => ({
  id: club._id,
  name: club.name,
  description: club.description,
  thumbnail: club.thumbnail,
  memberCount: club.memberCount,
  postCount: club.postCount,
  isJoined: currentUserId ? joinedClubIds.has(club._id.toString()) : false,
  requiresApproval: club.requiresApproval,
  postPermission: club.postPermission, // NEW FIELD
  createdAt: club.createdAt,
  updatedAt: club.updatedAt,
}));
```

---

### Phase 3: Validation Updates

#### 3.1 Update Validation Schemas
**File**: `middleware/validation.middleware.js`

**Update `clubSchemas.create`** (around line 1414):
```javascript
create: Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Club name is required",
    "string.min": "Club name must be at least 2 characters",
    "string.max": "Club name cannot exceed 100 characters",
  }),
  description: Joi.string().trim().max(1000).required().messages({
    "string.empty": "Club description is required",
    "string.max": "Club description cannot exceed 1000 characters",
  }),
  thumbnail: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "Please provide a valid thumbnail URL",
  }),
  postPermission: Joi.string()
    .valid('ANYONE', 'MEMBERS', 'ADMIN_ONLY')
    .optional()
    .default('MEMBERS')
    .messages({
      "any.only": "Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY",
    }),
}),
```

**Update `clubSchemas.update`** (around line 1432):
```javascript
update: Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    "string.min": "Club name must be at least 2 characters",
    "string.max": "Club name cannot exceed 100 characters",
  }),
  description: Joi.string().trim().max(1000).optional().messages({
    "string.max": "Club description cannot exceed 1000 characters",
  }),
  thumbnail: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "Please provide a valid thumbnail URL",
  }),
  requiresApproval: Joi.boolean().optional().messages({
    "boolean.base": "requiresApproval must be a boolean",
  }),
  postPermission: Joi.string()
    .valid('ANYONE', 'MEMBERS', 'ADMIN_ONLY')
    .optional()
    .messages({
      "any.only": "Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY",
    }),
}),
```

**Add New Schema: `clubSchemas.updatePostPermission`**:
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

### Phase 4: Route Updates

#### 4.1 Add Admin Route
**File**: `src/Club/club.admin.route.js`

**Add New Route** (after line 86):
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

**Update Imports** (line 7):
```javascript
import {
  createClub,
  getAllClubs,
  getClubById,
  updateClub,
  deleteClub,
  getClubStats,
  updateClubApprovalSetting,
  updateClubPostPermission, // NEW
  getAllJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "./club.admin.controller.js";
```

---

### Phase 5: Testing Requirements

#### 5.1 Unit Tests Needed

**Test: Club Schema Default**
- Create club without `postPermission`
- Verify default is 'MEMBERS'

**Test: Post Creation - ANYONE Permission**
- Create club with `postPermission: 'ANYONE'`
- Non-member user creates post
- Should succeed

**Test: Post Creation - MEMBERS Permission**
- Create club with `postPermission: 'MEMBERS'`
- Non-member user creates post
- Should fail with 403
- Member user creates post
- Should succeed

**Test: Post Creation - ADMIN_ONLY Permission**
- Create club with `postPermission: 'ADMIN_ONLY'`
- Regular user creates post
- Should fail with 403
- Admin user creates post
- Should succeed

**Test: Update Post Permission**
- Admin updates club from MEMBERS to ANYONE
- Verify update succeeds
- Test posting with new permission

**Test: Backwards Compatibility**
- Existing clubs (no postPermission field)
- Should default to MEMBERS behavior
- Posts should work as before

---

### Phase 6: Frontend Integration Guide

#### 6.1 Admin Frontend Changes

**Club Create/Edit Form**:
```javascript
// Add dropdown/radio buttons for post permission
<Select label="Who Can Post">
  <option value="ANYONE">Anyone</option>
  <option value="MEMBERS">Members Only</option>
  <option value="ADMIN_ONLY">Admins Only</option>
</Select>
```

**API Calls**:
```javascript
// Create club with post permission
POST /api/web/clubs
Body: {
  name: "Club Name",
  description: "...",
  thumbnail: "url",
  postPermission: "MEMBERS"
}

// Update post permission (dedicated endpoint)
PUT /api/web/clubs/:clubId/post-permission
Body: {
  postPermission: "ANYONE"
}

// Or update via general update
PUT /api/web/clubs/:clubId
Body: {
  postPermission: "ADMIN_ONLY"
}
```

**Club List Display**:
- Show badge indicating post permission level
  - "Open Posting" (ANYONE)
  - "Members Only" (MEMBERS)
  - "Admin Only" (ADMIN_ONLY)

---

#### 6.2 Mobile App Frontend Changes

**Club Detail Screen**:
- Display post permission info
- Show appropriate message:
  - "Anyone can post in this club"
  - "Only members can post"
  - "Only admins can post"

**Post Creation Screen**:
- Before showing post creation for a club, check:
  - Fetch club details (includes `postPermission`)
  - If `ANYONE`: Show create post button
  - If `MEMBERS`: Check `isJoined`, show button only if member
  - If `ADMIN_ONLY`: Check if user is admin, show button only for admins

**Error Handling**:
```javascript
// Handle 403 errors when posting
if (error.status === 403) {
  if (error.message.includes("member")) {
    showToast("You must join this club to post");
  } else if (error.message.includes("admin")) {
    showToast("Only admins can post in this club");
  }
}
```

**Club List**:
- Add icon/badge showing post permission
- Filter option: "Show clubs I can post in"

---

### Phase 7: Migration Strategy

#### 7.1 Database Migration (Optional)
Not strictly necessary because:
- Schema has `default: 'MEMBERS'`
- Existing clubs will use default on first read
- Backwards compatible

**If you want to explicitly set all existing clubs**:
```javascript
// Migration script
await Club.updateMany(
  { postPermission: { $exists: false } },
  { $set: { postPermission: 'MEMBERS' } }
);
```

---

## Implementation Checklist

### Backend Changes
- [ ] Update Club schema with `postPermission` field
- [ ] Update `createPost()` logic with permission checks
- [ ] Update `createClub()` to accept `postPermission`
- [ ] Update `updateClub()` to handle `postPermission`
- [ ] Add `updateClubPostPermission()` controller function
- [ ] Update `getClubById()` to return `postPermission`
- [ ] Update `getAllClubs()` to return `postPermission`
- [ ] Add validation schemas for post permission
- [ ] Add admin route for updating post permission
- [ ] Update controller imports in route files

### Testing
- [ ] Test ANYONE permission (non-member can post)
- [ ] Test MEMBERS permission (only members can post)
- [ ] Test ADMIN_ONLY permission (only admins can post)
- [ ] Test backwards compatibility (existing clubs)
- [ ] Test permission updates
- [ ] Test error messages for each restriction

### Documentation
- [ ] Update API documentation
- [ ] Create frontend integration guide
- [ ] Update CLUB_APPROVAL_FRONTEND_PROMPTS.md

---

## API Changes Summary

### New Field in Responses
All club APIs now return:
```javascript
{
  postPermission: "ANYONE" | "MEMBERS" | "ADMIN_ONLY"
}
```

### New/Updated Endpoints

**Create Club** (updated):
```
POST /api/web/clubs
Body: { ..., postPermission?: string }
```

**Update Club** (updated):
```
PUT /api/web/clubs/:clubId
Body: { ..., postPermission?: string }
```

**Update Post Permission** (new):
```
PUT /api/web/clubs/:clubId/post-permission
Body: { postPermission: string }
```

**Get Club** (updated response):
```
GET /api/app/connect/clubs/:clubId
Response: { ..., postPermission: string }
```

---

## Backwards Compatibility

### Existing Clubs
- All existing clubs will default to `postPermission: 'MEMBERS'`
- Current behavior is preserved (members-only posting)
- No breaking changes to existing functionality

### Existing Code
- Post creation logic maintains fallback for missing field
- Default case in switch statement handles undefined values
- Schema default ensures new clubs get sensible value

---

## Error Messages

```javascript
// ANYONE permission - no errors

// MEMBERS permission
"You must be a member of this club to post"

// ADMIN_ONLY permission
"Only admins can post in this club"

// Club not found
"Club not found"

// Validation errors
"Post permission must be one of: ANYONE, MEMBERS, ADMIN_ONLY"
```

---

## Open Questions to Resolve

1. **Admin Role Check**: How is admin role stored in `req.user`?
   - Option A: `req.user.role === 'admin'`
   - Option B: `req.user.isAdmin === true`
   - Option C: Separate middleware check

2. **ADMIN_ONLY Clarification**: Should this be:
   - System admins only (global admins)?
   - Club-specific admins (future feature)?
   - For now, assuming system admins

3. **Join Flow**: For clubs with `postPermission: 'ANYONE'`:
   - Should users still be able to "join" the club?
   - Or is joining optional for ANYONE clubs?
   - Recommendation: Keep join flow, posting just doesn't require it

4. **Feed Display**: For ANYONE clubs:
   - Should posts show in club feed even for non-members?
   - Recommendation: Yes, since posting is open

---

## Estimated Implementation Time

- **Schema + Controller Updates**: 1-2 hours
- **Validation + Routes**: 30 minutes
- **Testing**: 1-2 hours
- **Documentation**: 1 hour
- **Total**: 3.5-5.5 hours

---

## Priority Recommendations

**High Priority**:
1. Schema update
2. Post creation permission logic
3. Admin endpoints for managing permission

**Medium Priority**:
4. Validation schemas
5. Response field additions
6. Frontend guide updates

**Low Priority**:
7. Migration script
8. Advanced filtering by permission

---

Ready to implement! Should I proceed with the implementation?
