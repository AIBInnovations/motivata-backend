# Mobile App - Multi-Select Permissions Update

## What Changed

**Field**: `postPermission` → `postPermissions`
**Type**: String → Array

### Before
```json
{
  "postPermission": "MEMBERS"  // Single value
}
```

### After
```json
{
  "postPermissions": ["ADMIN", "MEMBERS"]  // Multiple values
}
```

---

## Permission Check Utility

```javascript
// utils/permissions.js

export const canUserPost = (postPermissions, isJoined, isAdmin) => {
  if (!postPermissions || postPermissions.length === 0) {
    postPermissions = ['MEMBERS'];
  }

  // Check ANYONE
  if (postPermissions.includes('ANYONE')) return true;

  // Check ADMIN
  if (isAdmin && postPermissions.includes('ADMIN')) return true;

  // Check MEMBERS
  if (isJoined && postPermissions.includes('MEMBERS')) return true;

  return false;
};
```

---

## Permission Badges Component

```jsx
// components/PostPermissionBadges.js
import { View, Text, StyleSheet } from 'react-native';

const PostPermissionBadges = ({ permissions }) => {
  if (!permissions || permissions.length === 0) {
    permissions = ['MEMBERS'];
  }

  const colors = {
    ANYONE: { bg: '#E8F5E9', text: '#4CAF50' },
    MEMBERS: { bg: '#E3F2FD', text: '#2196F3' },
    ADMIN: { bg: '#FFEBEE', text: '#F44336' },
  };

  return (
    <View style={styles.container}>
      {permissions.map((permission) => {
        const color = colors[permission] || { bg: '#F5F5F5', text: '#757575' };
        return (
          <View key={permission} style={[styles.badge, { backgroundColor: color.bg }]}>
            <Text style={[styles.text, { color: color.text }]}>
              {permission}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  text: { fontSize: 12, fontWeight: '600' },
});
```

---

## Post Button Visibility

```jsx
// screens/ClubFeedScreen.js
import { canUserPost } from '../utils/permissions';

const ClubFeedScreen = ({ club }) => {
  const { user } = useAuth();

  const canPost = canUserPost(
    club.postPermissions,
    club.isJoined,
    user.userType === 'admin'
  );

  return (
    <View>
      {/* Show/hide post button */}
      {canPost && (
        <TouchableOpacity onPress={handleCreatePost}>
          <Text>Create Post</Text>
        </TouchableOpacity>
      )}

      {!canPost && (
        <Text>You cannot post in this club</Text>
      )}
    </View>
  );
};
```

---

## Club List Item

```jsx
const ClubListItem = ({ club }) => {
  return (
    <View>
      <Text>{club.name}</Text>
      <PostPermissionBadges permissions={club.postPermissions} />
    </View>
  );
};
```

---

## Changes Required

1. **Add Utility**: Create `canUserPost()` function
2. **Add Component**: Create `PostPermissionBadges` component
3. **Update Post Button**: Show/hide based on `canUserPost()`
4. **Update Club List**: Display permission badges
5. **Filter Clubs**: Only show clubs where user can post in create flow
6. **Handle Old Data**: `club.postPermissions || ['MEMBERS']`

---

## TypeScript

```typescript
type PostPermission = 'ANYONE' | 'MEMBERS' | 'ADMIN';

interface Club {
  postPermissions: PostPermission[];  // Array now
  // ... other fields
}
```
