# Admin Frontend - Club Posting Permissions Implementation Guide

## Overview
Implement club posting permissions management in the admin panel. Admins can configure who can post in each club with three permission levels.

---

## Feature 1: Club Post Permission Dropdown

### Location
Club Create/Edit Form

### UI Requirements

**Add Dropdown Field**:
```jsx
<FormControl fullWidth>
  <InputLabel>Who Can Post</InputLabel>
  <Select
    name="postPermission"
    value={formData.postPermission || 'MEMBERS'}
    onChange={handleChange}
  >
    <MenuItem value="ANYONE">
      <Box>
        <Typography variant="body1">Anyone</Typography>
        <Typography variant="caption" color="textSecondary">
          Any authenticated user can post (no membership required)
        </Typography>
      </Box>
    </MenuItem>
    <MenuItem value="MEMBERS">
      <Box>
        <Typography variant="body1">Members Only</Typography>
        <Typography variant="caption" color="textSecondary">
          Only approved club members can post (default)
        </Typography>
      </Box>
    </MenuItem>
    <MenuItem value="ADMIN_ONLY">
      <Box>
        <Typography variant="body1">Admins Only</Typography>
        <Typography variant="caption" color="textSecondary">
          Only system administrators can post
        </Typography>
      </Box>
    </MenuItem>
  </Select>
  <FormHelperText>
    Controls who has permission to create posts in this club
  </FormHelperText>
</FormControl>
```

### API Integration

**Create Club**:
```javascript
const handleCreateClub = async (formData) => {
  try {
    const response = await fetch('http://YOUR_BASE_URL/api/web/clubs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        description: formData.description,
        thumbnail: formData.thumbnail,
        requiresApproval: formData.requiresApproval || false,
        postPermission: formData.postPermission || 'MEMBERS'  // NEW FIELD
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    showSuccess('Club created successfully!');
    return data.data.club;
  } catch (error) {
    showError(error.message);
    throw error;
  }
};
```

**Update Club**:
```javascript
const handleUpdateClub = async (clubId, formData) => {
  try {
    const response = await fetch(`http://YOUR_BASE_URL/api/web/clubs/${clubId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.name,
        description: formData.description,
        thumbnail: formData.thumbnail,
        requiresApproval: formData.requiresApproval,
        postPermission: formData.postPermission  // NEW FIELD
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    showSuccess('Club updated successfully!');
    return data.data.club;
  } catch (error) {
    showError(error.message);
    throw error;
  }
};
```

---

## Feature 2: Post Permission Badge in Club List

### Location
Clubs List Table/Grid

### UI Component

```jsx
const PostPermissionBadge = ({ permission }) => {
  const config = {
    ANYONE: {
      label: 'Open Posting',
      color: 'success',  // Green
      icon: <PublicIcon fontSize="small" />
    },
    MEMBERS: {
      label: 'Members Only',
      color: 'primary',  // Blue
      icon: <GroupIcon fontSize="small" />
    },
    ADMIN_ONLY: {
      label: 'Admin Only',
      color: 'error',  // Red
      icon: <AdminPanelSettingsIcon fontSize="small" />
    }
  };

  const { label, color, icon } = config[permission] || config.MEMBERS;

  return (
    <Chip
      icon={icon}
      label={label}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

// Usage in table
<TableCell>
  <PostPermissionBadge permission={club.postPermission} />
</TableCell>
```

### Display in Club List

```jsx
const ClubsTable = ({ clubs }) => {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Members</TableCell>
            <TableCell>Posts</TableCell>
            <TableCell>Join Approval</TableCell>
            <TableCell>Post Permission</TableCell>  {/* NEW COLUMN */}
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clubs.map((club) => (
            <TableRow key={club.id}>
              <TableCell>{club.name}</TableCell>
              <TableCell>{club.memberCount}</TableCell>
              <TableCell>{club.postCount}</TableCell>
              <TableCell>
                {club.requiresApproval ? (
                  <Chip label="Required" color="warning" size="small" />
                ) : (
                  <Chip label="Open" color="success" size="small" />
                )}
              </TableCell>
              <TableCell>
                <PostPermissionBadge permission={club.postPermission} />
              </TableCell>
              <TableCell>
                <IconButton onClick={() => handleEdit(club)}>
                  <EditIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
```

---

## Feature 3: Quick Update Post Permission

### Location
Club Detail Page or Quick Actions

### UI Component

```jsx
const QuickPostPermissionUpdate = ({ club, onUpdate }) => {
  const [permission, setPermission] = useState(club.postPermission);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (newPermission) => {
    if (newPermission === permission) return;

    setLoading(true);
    try {
      const response = await fetch(
        `http://YOUR_BASE_URL/api/web/clubs/${club.id}/post-permission`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            postPermission: newPermission
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      setPermission(newPermission);
      showSuccess('Post permission updated successfully!');
      onUpdate?.();
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Post Permission
      </Typography>
      <ToggleButtonGroup
        value={permission}
        exclusive
        onChange={(e, value) => value && handleUpdate(value)}
        disabled={loading}
        size="small"
      >
        <ToggleButton value="ANYONE">
          <Tooltip title="Anyone can post">
            <PublicIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="MEMBERS">
          <Tooltip title="Members only">
            <GroupIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="ADMIN_ONLY">
          <Tooltip title="Admins only">
            <AdminPanelSettingsIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
      {loading && <CircularProgress size={20} />}
    </Box>
  );
};
```

---

## Feature 4: Club Detail Page - Permission Info

### Location
Club Detail/View Page

### UI Component

```jsx
const ClubDetailPermissions = ({ club }) => {
  return (
    <Card>
      <CardHeader title="Permissions & Settings" />
      <CardContent>
        <Grid container spacing={3}>
          {/* Join Approval Setting */}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Join Approval
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                {club.requiresApproval ? (
                  <>
                    <VerifiedUserIcon color="warning" sx={{ mr: 1 }} />
                    <Typography>Admin approval required</Typography>
                  </>
                ) : (
                  <>
                    <LockOpenIcon color="success" sx={{ mr: 1 }} />
                    <Typography>Open to all</Typography>
                  </>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Post Permission Setting - NEW */}
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" color="textSecondary">
                Post Permission
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                {club.postPermission === 'ANYONE' && (
                  <>
                    <PublicIcon color="success" sx={{ mr: 1 }} />
                    <Typography>Anyone can post</Typography>
                  </>
                )}
                {club.postPermission === 'MEMBERS' && (
                  <>
                    <GroupIcon color="primary" sx={{ mr: 1 }} />
                    <Typography>Only members can post</Typography>
                  </>
                )}
                {club.postPermission === 'ADMIN_ONLY' && (
                  <>
                    <AdminPanelSettingsIcon color="error" sx={{ mr: 1 }} />
                    <Typography>Only admins can post</Typography>
                  </>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
```

---

## Feature 5: Admin Post Creation Interface

### Location
New Section: "Create Club Post" or integrate into existing post management

### UI Component

```jsx
const AdminClubPostCreator = () => {
  const [formData, setFormData] = useState({
    caption: '',
    mediaType: 'IMAGE',
    mediaUrls: [],
    clubId: ''
  });
  const [clubs, setClubs] = useState([]);

  useEffect(() => {
    fetchAdminAccessibleClubs();
  }, []);

  const fetchAdminAccessibleClubs = async () => {
    try {
      const response = await fetch('http://YOUR_BASE_URL/api/web/clubs', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      setClubs(data.data.clubs);
    } catch (error) {
      showError('Failed to fetch clubs');
    }
  };

  const handleCreatePost = async () => {
    try {
      // Admins use the SAME endpoint as regular users
      const response = await fetch('http://YOUR_BASE_URL/api/app/connect/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,  // Admin token
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          caption: formData.caption,
          mediaType: formData.mediaType,
          mediaUrls: formData.mediaUrls,
          mediaThumbnail: formData.mediaThumbnail,
          clubId: formData.clubId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      showSuccess('Post created successfully!');
      resetForm();
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Create Club Post (Admin)
      </Typography>

      {/* Club Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Select Club</InputLabel>
        <Select
          value={formData.clubId}
          onChange={(e) => setFormData({ ...formData, clubId: e.target.value })}
        >
          {clubs.map((club) => (
            <MenuItem key={club.id} value={club.id}>
              <Box>
                <Typography>{club.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  <PostPermissionBadge permission={club.postPermission} />
                  {club.postPermission === 'ADMIN_ONLY' && ' - You have posting access'}
                  {club.postPermission === 'MEMBERS' && club.isJoined && ' - Member'}
                  {club.postPermission === 'MEMBERS' && !club.isJoined && ' - Not a member'}
                  {club.postPermission === 'ANYONE' && ' - Open to all'}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Caption */}
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Caption"
        value={formData.caption}
        onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
        sx={{ mb: 2 }}
      />

      {/* Media Type */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Media Type</InputLabel>
        <Select
          value={formData.mediaType}
          onChange={(e) => setFormData({ ...formData, mediaType: e.target.value })}
        >
          <MenuItem value="IMAGE">Image(s)</MenuItem>
          <MenuItem value="VIDEO">Video</MenuItem>
        </Select>
      </FormControl>

      {/* Media Upload */}
      <MediaUploader
        mediaType={formData.mediaType}
        onUpload={(urls) => setFormData({ ...formData, mediaUrls: urls })}
      />

      {/* Submit Button */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleCreatePost}
        disabled={!formData.clubId || formData.mediaUrls.length === 0}
        fullWidth
      >
        Create Post
      </Button>
    </Paper>
  );
};
```

---

## Error Handling

### Common Errors

```javascript
const handleClubError = (error, operation) => {
  // Validation errors (400)
  if (error.status === 400) {
    if (error.message.includes('Post permission must be')) {
      showError('Invalid post permission value. Must be ANYONE, MEMBERS, or ADMIN_ONLY');
    } else {
      showError(error.message);
    }
  }

  // Forbidden (403)
  if (error.status === 403) {
    if (error.message.includes('Admin access required')) {
      showError('You need admin privileges for this action');
      // Redirect to login
    } else if (error.message.includes('member')) {
      showError('You must be a member to post in this club');
    } else if (error.message.includes('admin')) {
      showError('Only admins can post in this club');
    }
  }

  // Not found (404)
  if (error.status === 404) {
    showError('Club not found');
  }

  // Conflict (409)
  if (error.status === 409) {
    showError('This operation conflicts with existing data');
  }

  // Server error (500)
  if (error.status === 500) {
    showError('Server error. Please try again later.');
  }
};
```

---

## TypeScript Types (Optional)

```typescript
type PostPermission = 'ANYONE' | 'MEMBERS' | 'ADMIN_ONLY';

interface Club {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
  memberCount: number;
  postCount: number;
  isJoined: boolean;
  requiresApproval: boolean;
  postPermission: PostPermission;  // NEW
  createdAt: string;
  updatedAt: string;
}

interface CreateClubRequest {
  name: string;
  description: string;
  thumbnail?: string;
  requiresApproval?: boolean;
  postPermission?: PostPermission;  // NEW
}

interface UpdateClubRequest {
  name?: string;
  description?: string;
  thumbnail?: string;
  requiresApproval?: boolean;
  postPermission?: PostPermission;  // NEW
}

interface UpdatePostPermissionRequest {
  postPermission: PostPermission;
}
```

---

## API Endpoints Reference

### Base URL
```
http://YOUR_BASE_URL/api/web
```

### Endpoints

**1. Create Club**
```
POST /clubs
Body: { name, description, thumbnail?, postPermission? }
Response: { success, message, data: { club } }
```

**2. Update Club**
```
PUT /clubs/:clubId
Body: { name?, description?, thumbnail?, requiresApproval?, postPermission? }
Response: { success, message, data: { club } }
```

**3. Update Post Permission (Dedicated)**
```
PUT /clubs/:clubId/post-permission
Body: { postPermission }
Response: { success, message, data: { club: { id, name, postPermission } } }
```

**4. Get All Clubs**
```
GET /clubs
Response: { success, message, data: { clubs, pagination } }
Note: clubs array now includes postPermission field
```

**5. Get Club by ID**
```
GET /clubs/:clubId
Response: { success, message, data: { club } }
Note: club object now includes postPermission field
```

**6. Create Post (Admin using user endpoint)**
```
POST /api/app/connect/posts
Headers: { Authorization: Bearer <admin-token> }
Body: { caption, mediaType, mediaUrls, mediaThumbnail?, clubId? }
Response: { success, message, data: { post } }
```

---

## Testing Checklist

### UI Testing
- [ ] Post permission dropdown appears in create club form
- [ ] Post permission dropdown appears in edit club form
- [ ] Default value is "MEMBERS"
- [ ] All three options are visible and selectable
- [ ] Badge displays correctly in club list
- [ ] Badge colors match permission level (green/blue/red)
- [ ] Quick update buttons work correctly
- [ ] Club detail page shows permission info
- [ ] Admin post creator shows club selection
- [ ] Form validation works

### API Testing
- [ ] Create club with ANYONE permission
- [ ] Create club with MEMBERS permission
- [ ] Create club with ADMIN_ONLY permission
- [ ] Create club without permission (defaults to MEMBERS)
- [ ] Update club permission from MEMBERS to ANYONE
- [ ] Update club permission from ANYONE to ADMIN_ONLY
- [ ] Use dedicated endpoint to update permission
- [ ] Verify updated permission in club list
- [ ] Admin can post to ADMIN_ONLY club
- [ ] Error handling works for invalid values

### Edge Cases
- [ ] Existing clubs without postPermission display correctly
- [ ] Long club names don't break badge layout
- [ ] Permission updates are instant in UI
- [ ] Multiple admins can update concurrently
- [ ] Form resets properly after creation

---

## Notes

1. **Admin Token**: Admins use their admin JWT token for all operations

2. **Post Creation**: Admins create posts using the **user endpoint** (`/api/app/connect/posts`), not a separate admin endpoint

3. **Permission Check**: The backend automatically checks `req.user.userType === 'admin'` for ADMIN_ONLY clubs

4. **Backwards Compatibility**: Existing clubs without `postPermission` will default to MEMBERS

5. **Real-time Updates**: Consider implementing WebSocket for real-time permission updates if multiple admins manage the same club

6. **Icons**: Import from Material-UI:
   ```javascript
   import PublicIcon from '@mui/icons-material/Public';
   import GroupIcon from '@mui/icons-material/Group';
   import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
   ```

---

## Summary

**What to Implement**:
1. Add post permission dropdown to club create/edit forms
2. Display permission badge in club list
3. Add quick permission update controls
4. Show permission info in club detail page
5. Create admin post creation interface
6. Handle all error cases

**Key Points**:
- Three permission levels: ANYONE, MEMBERS, ADMIN_ONLY
- Default is MEMBERS (backwards compatible)
- Admins use regular post endpoint with admin token
- Backend handles all permission checks
- UI should be clear about who can post

**Backend is ready!** All APIs are implemented and tested. Just integrate the frontend components and you're done.
