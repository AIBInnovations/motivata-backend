# Admin Frontend - Multi-Select Permissions Update

## What Changed

**Field**: `postPermission` → `postPermissions`
**Type**: String → Array
**Values**: `'ADMIN_ONLY'` → `'ADMIN'`

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

## Validation Rules

1. ✓ Can combine: `['ADMIN', 'MEMBERS']`
2. ✗ Cannot combine: `['ANYONE', 'MEMBERS']` - ANYONE must be alone
3. ✓ At least one required

---

## Multi-Select Component

```jsx
import { FormControl, FormLabel, FormGroup, FormControlLabel, Checkbox } from '@mui/material';

const PostPermissionsSelector = ({ value, onChange }) => {
  const [permissions, setPermissions] = useState(value || ['MEMBERS']);

  const handleToggle = (permission) => {
    let newPermissions;

    if (permission === 'ANYONE') {
      // ANYONE is exclusive
      newPermissions = permissions.includes('ANYONE') ? [] : ['ANYONE'];
    } else {
      // Remove ANYONE if selecting others
      newPermissions = permissions.filter(p => p !== 'ANYONE');

      // Toggle the permission
      if (newPermissions.includes(permission)) {
        newPermissions = newPermissions.filter(p => p !== permission);
      } else {
        newPermissions.push(permission);
      }
    }

    // Ensure at least one
    if (newPermissions.length === 0) newPermissions = ['MEMBERS'];

    setPermissions(newPermissions);
    onChange(newPermissions);
  };

  const isAnyoneSelected = permissions.includes('ANYONE');

  return (
    <FormControl>
      <FormLabel>Who can post?</FormLabel>
      <FormGroup>
        <FormControlLabel
          control={<Checkbox checked={permissions.includes('ANYONE')} onChange={() => handleToggle('ANYONE')} />}
          label="Anyone"
        />
        <FormControlLabel
          control={<Checkbox checked={permissions.includes('MEMBERS')} onChange={() => handleToggle('MEMBERS')} disabled={isAnyoneSelected} />}
          label="Members"
        />
        <FormControlLabel
          control={<Checkbox checked={permissions.includes('ADMIN')} onChange={() => handleToggle('ADMIN')} disabled={isAnyoneSelected} />}
          label="Admins"
        />
      </FormGroup>
    </FormControl>
  );
};
```

---

## API Updates

### Create Club
```javascript
// OLD
{ postPermission: "MEMBERS" }

// NEW
{ postPermissions: ["MEMBERS"] }
```

### Update Club
```javascript
// OLD
{ postPermission: "ADMIN_ONLY" }

// NEW
{ postPermissions: ["ADMIN", "MEMBERS"] }
```

### Update Post Permission
```javascript
PUT /api/web/clubs/:clubId/post-permission

// OLD
{ postPermission: "MEMBERS" }

// NEW
{ postPermissions: ["ADMIN", "MEMBERS"] }
```

---

## Display Badges

```jsx
const PostPermissionBadges = ({ permissions }) => {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {permissions.map((permission) => (
        <Chip
          key={permission}
          label={permission}
          size="small"
          color={permission === 'ADMIN' ? 'error' : permission === 'MEMBERS' ? 'primary' : 'success'}
        />
      ))}
    </Box>
  );
};
```

---

## Changes Required

1. **Create/Edit Forms**: Use `PostPermissionsSelector` component
2. **API Calls**: Change `postPermission` → `postPermissions` (array)
3. **Club List**: Display multiple badges
4. **Club Detail**: Show multiple permission cards
5. **Handle Old Data**: `club.postPermissions || ['MEMBERS']`

---

## TypeScript

```typescript
type PostPermission = 'ANYONE' | 'MEMBERS' | 'ADMIN';

interface Club {
  postPermissions: PostPermission[];  // Array now
  // ... other fields
}
```
