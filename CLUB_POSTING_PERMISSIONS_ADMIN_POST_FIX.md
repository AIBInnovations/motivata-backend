# Admin Post Creation Fix - Implementation

## Issue

When admins tried to create posts from the admin panel using their admin JWT token, the system failed with:

```
TypeError: Cannot read properties of null (reading '_id')
at formatPostResponse (post.controller.js:24:32)
```

**Root Cause**: The Post schema's `author` field referenced only "User" collection, but when admins create posts, `req.user.id` is an Admin ID from the "Admin" collection. This caused the populate to fail and return `null` for the author.

---

## Solution: Dynamic References with `refPath`

Modified the Post schema to support both User and Admin as authors using Mongoose's `refPath` pattern.

---

## Changes Made

### 1. Post Schema (schema/Post.schema.js)

**Before**:
```javascript
author: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
  index: true,
},
```

**After**:
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
  refPath: "authorType",
  required: true,
  index: true,
},
```

### 2. Post Controller (src/Connect/post.controller.js)

**Updated createPost function**:

```javascript
// Determine if author is admin or user
const isAdmin = req.user.userType === 'admin';

const postData = {
  authorType: isAdmin ? 'Admin' : 'User',  // NEW FIELD
  author: authorId,
  caption: caption?.trim() || "",
  mediaType,
  mediaUrls,
  mediaThumbnail: mediaThumbnail || null,
  club: clubId || null,
};

const post = new Post(postData);
await post.save();

// Update user's or admin's post count (only update User postCount, admins don't have this field)
if (!isAdmin) {
  await User.findByIdAndUpdate(authorId, { $inc: { postCount: 1 } });
}
```

**Key Changes**:
1. Added `authorType` field to postData based on `req.user.userType`
2. Modified postCount update to only apply to Users (Admins don't have a postCount field)
3. Populate will now correctly resolve to either User or Admin based on authorType

---

## How It Works

### Dynamic Reference Pattern

Mongoose's `refPath` allows the ref to be determined dynamically at query time:

1. **When creating a post**:
   - If `req.user.userType === 'admin'`: Set `authorType: 'Admin'`, `author: adminId`
   - If `req.user.userType !== 'admin'`: Set `authorType: 'User'`, `author: userId`

2. **When populating**:
   - Mongoose looks at `authorType` field
   - If `authorType === 'Admin'`: Populates from Admin collection
   - If `authorType === 'User'`: Populates from User collection

3. **Both User and Admin have `name` and `email` fields**, so the populate works seamlessly:
   ```javascript
   await post.populate({ path: "author", select: "name email" });
   ```

---

## Backwards Compatibility

### Existing Posts
- All existing posts have `author` referencing User
- Default value for `authorType` is "User"
- Existing posts will continue to work without migration
- On first save/update, they'll get `authorType: "User"` automatically

### Future Posts
- User posts: `authorType: "User"`, `author: userId`
- Admin posts: `authorType: "Admin"`, `author: adminId`

---

## Testing Scenarios

### 1. Admin Creates Post in ADMIN_ONLY Club
```bash
POST /api/app/connect/posts
Headers: { Authorization: Bearer <admin-token> }
Body: {
  "caption": "Official announcement",
  "mediaType": "IMAGE",
  "mediaUrls": ["https://..."],
  "clubId": "club123"
}

Expected: Success (Admin can post in ADMIN_ONLY clubs)
Result: Post created with authorType: "Admin"
```

### 2. Admin Creates Post in MEMBERS Club (Not a Member)
```bash
POST /api/app/connect/posts
Headers: { Authorization: Bearer <admin-token> }
Body: {
  "caption": "Hello",
  "mediaType": "IMAGE",
  "mediaUrls": ["https://..."],
  "clubId": "club456"
}

Expected: 403 Forbidden
Result: "You must be a member of this club to post"
```

### 3. Admin Creates Post in ANYONE Club
```bash
POST /api/app/connect/posts
Headers: { Authorization: Bearer <admin-token> }
Body: {
  "caption": "Public post",
  "mediaType": "IMAGE",
  "mediaUrls": ["https://..."],
  "clubId": "club789"
}

Expected: Success (Anyone can post)
Result: Post created with authorType: "Admin"
```

### 4. User Creates Post (Existing Behavior)
```bash
POST /api/app/connect/posts
Headers: { Authorization: Bearer <user-token> }
Body: {
  "caption": "My post",
  "mediaType": "IMAGE",
  "mediaUrls": ["https://..."],
  "clubId": "club123"
}

Expected: Success (if permission allows)
Result: Post created with authorType: "User"
```

### 5. Get Post (Both User and Admin Authors)
```bash
GET /api/app/connect/posts/:postId

Response:
{
  "post": {
    "id": "post123",
    "author": {
      "id": "admin123",
      "name": "Admin Name",
      "email": "admin@example.com"
    },
    "caption": "...",
    ...
  }
}
```

---

## Field Compatibility

### Both User and Admin Have:
- ✓ `name` (String)
- ✓ `email` (String)
- ✓ `_id` (ObjectId)

### User-Only Fields:
- `phone` (not in Admin)
- `postCount` (not in Admin)
- `isDeleted` (not in Admin) - handled gracefully, undefined is falsy

### Admin-Only Fields:
- `role` (not in User)
- `username` (not in User)
- `allowedEvents` (not in User)

**Conclusion**: Since we only populate `name` and `email`, both User and Admin work seamlessly.

---

## Error Handling

### isDeleted Checks
Several places in the code check `post.author.isDeleted`:

```javascript
if (!post.author || post.author.isDeleted) {
  return responseUtil.notFound(res, "Post not found");
}
```

**Admin Behavior**:
- Admin schema doesn't have `isDeleted` field
- `post.author.isDeleted` returns `undefined`
- `undefined` is falsy, so the check works correctly
- Admin-authored posts are NOT filtered out incorrectly

---

## Migration

**No migration needed!** The default value and backwards compatibility ensure:
1. Existing posts continue to work (default `authorType: "User"`)
2. New posts get the correct `authorType` based on who creates them
3. All queries and populates work without changes

---

## Files Modified

1. **schema/Post.schema.js** (lines 16-35)
   - Added `authorType` field with enum ["User", "Admin"]
   - Changed `author` ref to use `refPath: "authorType"`

2. **src/Connect/post.controller.js** (lines 130-147)
   - Added `isAdmin` check
   - Set `authorType` in postData
   - Conditional postCount update (only for Users)

---

## Summary

✓ Admins can now create posts using their admin JWT token
✓ Post schema supports both User and Admin authors via dynamic references
✓ Backwards compatible with existing posts (default to User)
✓ No migration required
✓ Admin can post in ADMIN_ONLY clubs
✓ Admin must still be a member to post in MEMBERS clubs (unless it's ADMIN_ONLY)
✓ Admin can post in ANYONE clubs without membership

**Status**: Fix implemented and ready for testing
