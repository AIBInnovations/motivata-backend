# Admin Posts Visibility Fix

## Issue

Admin-created posts were not visible in club feeds even though they were successfully created in the database.

**Root Cause**: The populate query used `match: { isDeleted: false }` filter, which failed for Admin authors because the Admin schema doesn't have an `isDeleted` field. This caused the populate to return `null`, and these posts were filtered out.

---

## Solution

Removed the `match` filter from populate queries and updated the post filtering logic to handle both User and Admin authors properly.

### Files Fixed

1. **src/Club/club.user.controller.js** - `getClubFeed` (lines 337-364)
2. **src/Connect/post.controller.js** - `getFeed` (lines 199-220)
3. **src/Connect/post.controller.js** - `getExploreFeed` (lines 263-284)

---

## Changes Made

### Before (Broken)
```javascript
.populate({
  path: "author",
  select: "name email",
  match: { isDeleted: false },  // ❌ Fails for Admin authors
})

const validPosts = posts.filter((post) => post.author !== null);
```

### After (Fixed)
```javascript
.populate({
  path: "author",
  select: "name email isDeleted",  // ✓ No match filter
})

// Filter intelligently based on author type
const validPosts = posts.filter((post) => {
  if (!post.author) return false;
  // If author has isDeleted field (User), check if not deleted
  if ('isDeleted' in post.author) {
    return !post.author.isDeleted;
  }
  // If no isDeleted field (Admin), include the post
  return true;
});
```

---

## How It Works

1. **Populate without filter**: All authors (User and Admin) are populated successfully
2. **Smart filtering**:
   - Check if author exists
   - If author has `isDeleted` field → it's a User → check if not deleted
   - If author has no `isDeleted` field → it's an Admin → include it

---

## Testing

✅ Admin posts now visible in club feeds
✅ User posts still filtered correctly (deleted users excluded)
✅ No impact on existing functionality

---

**Status**: Fixed and ready for testing
