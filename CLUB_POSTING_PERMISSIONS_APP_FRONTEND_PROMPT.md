# Mobile App Frontend - Club Posting Permissions Implementation Guide

## Overview
Implement club posting permissions in the mobile app. Users will see different posting capabilities based on club settings. Three permission levels control who can post.

---

## Feature 1: Club Detail Screen - Post Button Visibility

### Location
Club Detail Screen

### UI Requirements

Show/hide "Create Post" button based on user's permission to post in the club.

### Implementation

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ClubDetailScreen = ({ route, navigation }) => {
  const [club, setClub] = useState(null);
  const [canPost, setCanPost] = useState(false);
  const [postButtonText, setPostButtonText] = useState('');

  useEffect(() => {
    fetchClubDetails();
  }, []);

  useEffect(() => {
    if (club) {
      checkPostPermission();
    }
  }, [club]);

  const fetchClubDetails = async () => {
    try {
      const response = await fetch(
        `http://YOUR_BASE_URL/api/app/connect/clubs/${route.params.clubId}`,
        {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setClub(data.data.club);
      }
    } catch (error) {
      console.error('Failed to fetch club:', error);
    }
  };

  const checkPostPermission = () => {
    const { postPermission, isJoined } = club;
    const isAdmin = currentUser?.userType === 'admin';

    let allowed = false;
    let buttonText = 'Create Post';

    switch (postPermission) {
      case 'ANYONE':
        allowed = true;
        buttonText = 'Create Post';
        break;

      case 'MEMBERS':
        allowed = isJoined;
        buttonText = isJoined ? 'Create Post' : 'Join to Post';
        break;

      case 'ADMIN_ONLY':
        allowed = isAdmin;
        buttonText = isAdmin ? 'Create Post (Admin)' : 'Admin Only';
        break;

      default:
        // Fallback to MEMBERS behavior
        allowed = isJoined;
        buttonText = isJoined ? 'Create Post' : 'Join to Post';
    }

    setCanPost(allowed);
    setPostButtonText(buttonText);
  };

  const handlePostButtonPress = () => {
    if (club.postPermission === 'MEMBERS' && !club.isJoined) {
      // Show join dialog
      showJoinClubDialog();
    } else if (club.postPermission === 'ADMIN_ONLY' && !isAdmin) {
      // Show info alert
      Alert.alert(
        'Admin Only',
        'Only administrators can post in this club.',
        [{ text: 'OK' }]
      );
    } else if (canPost) {
      // Navigate to create post
      navigation.navigate('CreatePost', { clubId: club.id });
    }
  };

  return (
    <View style={styles.container}>
      {/* Club Header */}
      <View style={styles.header}>
        <Image source={{ uri: club?.thumbnail }} style={styles.thumbnail} />
        <Text style={styles.clubName}>{club?.name}</Text>
        <Text style={styles.description}>{club?.description}</Text>
      </View>

      {/* Post Permission Info */}
      <PostPermissionInfo permission={club?.postPermission} isJoined={club?.isJoined} />

      {/* Stats */}
      <View style={styles.stats}>
        <Text>{club?.memberCount} Members</Text>
        <Text>{club?.postCount} Posts</Text>
      </View>

      {/* Post Button */}
      <TouchableOpacity
        style={[
          styles.postButton,
          !canPost && styles.postButtonDisabled
        ]}
        onPress={handlePostButtonPress}
        disabled={!canPost && club?.postPermission === 'ADMIN_ONLY'}
      >
        <Text style={styles.postButtonText}>{postButtonText}</Text>
      </TouchableOpacity>

      {/* Club Feed */}
      <ClubFeed clubId={club?.id} />
    </View>
  );
};
```

---

## Feature 2: Post Permission Info Component

### Location
Club Detail Screen (above stats)

### UI Component

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PostPermissionInfo = ({ permission, isJoined }) => {
  const getPermissionInfo = () => {
    switch (permission) {
      case 'ANYONE':
        return {
          icon: 'public',
          color: '#4CAF50',  // Green
          text: 'Anyone can post in this club',
          bgColor: '#E8F5E9'
        };

      case 'MEMBERS':
        return {
          icon: 'group',
          color: '#2196F3',  // Blue
          text: isJoined
            ? 'You can post as a member'
            : 'Only members can post',
          bgColor: '#E3F2FD'
        };

      case 'ADMIN_ONLY':
        return {
          icon: 'admin-panel-settings',
          color: '#F44336',  // Red
          text: 'Only administrators can post',
          bgColor: '#FFEBEE'
        };

      default:
        return {
          icon: 'group',
          color: '#2196F3',
          text: isJoined
            ? 'You can post as a member'
            : 'Only members can post',
          bgColor: '#E3F2FD'
        };
    }
  };

  const info = getPermissionInfo();

  return (
    <View style={[styles.container, { backgroundColor: info.bgColor }]}>
      <Icon name={info.icon} size={20} color={info.color} />
      <Text style={[styles.text, { color: info.color }]}>
        {info.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  text: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PostPermissionInfo;
```

---

## Feature 3: Post Permission Badge in Club List

### Location
Clubs List Screen

### UI Component

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ClubCard = ({ club, onPress }) => {
  const getPermissionBadge = () => {
    const badges = {
      ANYONE: { icon: 'public', color: '#4CAF50', label: 'Open' },
      MEMBERS: { icon: 'group', color: '#2196F3', label: 'Members' },
      ADMIN_ONLY: { icon: 'admin-panel-settings', color: '#F44336', label: 'Admin' }
    };

    return badges[club.postPermission] || badges.MEMBERS;
  };

  const badge = getPermissionBadge();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Image source={{ uri: club.thumbnail }} style={styles.thumbnail} />

      <View style={styles.content}>
        <Text style={styles.name}>{club.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {club.description}
        </Text>

        <View style={styles.footer}>
          <View style={styles.stats}>
            <Text style={styles.statText}>
              {club.memberCount} members • {club.postCount} posts
            </Text>
          </View>

          {/* Post Permission Badge */}
          <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
            <Icon name={badge.icon} size={14} color={badge.color} />
            <Text style={[styles.badgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Join Status Badge */}
        {club.isJoined && (
          <View style={styles.joinedBadge}>
            <Icon name="check-circle" size={16} color="#4CAF50" />
            <Text style={styles.joinedText}>Joined</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stats: {
    flex: 1,
  },
  statText: {
    fontSize: 12,
    color: '#999',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  joinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  joinedText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
});
```

---

## Feature 4: Create Post Screen - Club Selection

### Location
Create Post Screen

### Implementation

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';

const CreatePostScreen = ({ route, navigation }) => {
  const [formData, setFormData] = useState({
    caption: '',
    mediaType: 'IMAGE',
    mediaUrls: [],
    clubId: route.params?.clubId || null
  });
  const [clubs, setClubs] = useState([]);
  const [selectedClub, setSelectedClub] = useState(null);

  useEffect(() => {
    fetchClubsUserCanPostIn();
  }, []);

  const fetchClubsUserCanPostIn = async () => {
    try {
      // Fetch all clubs
      const response = await fetch(
        'http://YOUR_BASE_URL/api/app/connect/clubs',
        {
          headers: {
            Authorization: `Bearer ${userToken}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        // Filter clubs where user can post
        const postableClubs = data.data.clubs.filter(club => {
          const isAdmin = currentUser?.userType === 'admin';

          switch (club.postPermission) {
            case 'ANYONE':
              return true;
            case 'MEMBERS':
              return club.isJoined;
            case 'ADMIN_ONLY':
              return isAdmin;
            default:
              return club.isJoined;
          }
        });

        setClubs(postableClubs);

        // Pre-select club if passed from club detail
        if (route.params?.clubId) {
          const club = postableClubs.find(c => c.id === route.params.clubId);
          setSelectedClub(club);
        }
      }
    } catch (error) {
      console.error('Failed to fetch clubs:', error);
    }
  };

  const handleCreatePost = async () => {
    try {
      const response = await fetch(
        'http://YOUR_BASE_URL/api/app/connect/posts',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            caption: formData.caption,
            mediaType: formData.mediaType,
            mediaUrls: formData.mediaUrls,
            mediaThumbnail: formData.mediaThumbnail,
            clubId: formData.clubId
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        handlePostError(data, response.status);
        return;
      }

      Alert.alert('Success', 'Post created successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
    }
  };

  const handlePostError = (error, status) => {
    if (status === 403) {
      if (error.message.includes('member')) {
        Alert.alert(
          'Join Required',
          'You must join this club to post content.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Join Now',
              onPress: () => navigation.navigate('ClubDetail', {
                clubId: formData.clubId
              })
            }
          ]
        );
      } else if (error.message.includes('admin')) {
        Alert.alert(
          'Admin Only',
          'Only administrators can post in this club.',
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert('Error', error.message || 'Failed to create post');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Club Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Post to:</Text>
        <TouchableOpacity
          style={styles.clubSelector}
          onPress={() => setShowClubPicker(true)}
        >
          {selectedClub ? (
            <View style={styles.selectedClub}>
              <Image
                source={{ uri: selectedClub.thumbnail }}
                style={styles.clubThumb}
              />
              <View style={styles.clubInfo}>
                <Text style={styles.clubName}>{selectedClub.name}</Text>
                <PostPermissionBadge permission={selectedClub.postPermission} />
              </View>
            </View>
          ) : (
            <View style={styles.noClub}>
              <Text style={styles.noClubText}>Select a club (optional)</Text>
              <Icon name="chevron-right" size={24} color="#999" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Caption Input */}
      <TextInput
        style={styles.captionInput}
        placeholder="What's on your mind?"
        multiline
        value={formData.caption}
        onChangeText={(text) => setFormData({ ...formData, caption: text })}
      />

      {/* Media Upload */}
      <MediaUploader
        mediaType={formData.mediaType}
        onMediaSelected={(urls) => setFormData({ ...formData, mediaUrls: urls })}
      />

      {/* Post Button */}
      <TouchableOpacity
        style={[
          styles.postButton,
          formData.mediaUrls.length === 0 && styles.postButtonDisabled
        ]}
        onPress={handleCreatePost}
        disabled={formData.mediaUrls.length === 0}
      >
        <Text style={styles.postButtonText}>Create Post</Text>
      </TouchableOpacity>

      {/* Club Picker Modal */}
      <ClubPickerModal
        visible={showClubPicker}
        clubs={clubs}
        selectedClub={selectedClub}
        onSelect={(club) => {
          setSelectedClub(club);
          setFormData({ ...formData, clubId: club.id });
          setShowClubPicker(false);
        }}
        onClose={() => setShowClubPicker(false)}
      />
    </ScrollView>
  );
};
```

---

## Feature 5: Club Picker Modal

### Location
Create Post Screen (Modal)

### UI Component

```javascript
import React from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, Image } from 'react-native';

const ClubPickerModal = ({ visible, clubs, selectedClub, onSelect, onClose }) => {
  const renderClubItem = ({ item }) => {
    const isSelected = selectedClub?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.clubItem,
          isSelected && styles.clubItemSelected
        ]}
        onPress={() => onSelect(item)}
      >
        <Image source={{ uri: item.thumbnail }} style={styles.clubThumb} />

        <View style={styles.clubInfo}>
          <Text style={styles.clubName}>{item.name}</Text>

          <View style={styles.clubMeta}>
            <PostPermissionBadge permission={item.postPermission} size="small" />
            <Text style={styles.clubStats}>
              {item.memberCount} members
            </Text>
          </View>
        </View>

        {isSelected && (
          <Icon name="check-circle" size={24} color="#4CAF50" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Club</Text>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {clubs.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="group-off" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              No clubs available to post in
            </Text>
            <Text style={styles.emptySubtext}>
              Join a club or create a post in your feed
            </Text>
          </View>
        ) : (
          <FlatList
            data={clubs}
            renderItem={renderClubItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.clubList}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clubList: {
    padding: 16,
  },
  clubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
  },
  clubItemSelected: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  clubThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  clubInfo: {
    flex: 1,
    marginLeft: 12,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clubStats: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
```

---

## Feature 6: Post Permission Badge Component

### Reusable Component

```javascript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PostPermissionBadge = ({ permission, size = 'medium' }) => {
  const config = {
    ANYONE: {
      icon: 'public',
      color: '#4CAF50',
      label: 'Open',
      bgColor: '#E8F5E9'
    },
    MEMBERS: {
      icon: 'group',
      color: '#2196F3',
      label: 'Members',
      bgColor: '#E3F2FD'
    },
    ADMIN_ONLY: {
      icon: 'admin-panel-settings',
      color: '#F44336',
      label: 'Admin',
      bgColor: '#FFEBEE'
    }
  };

  const sizeConfig = {
    small: { fontSize: 10, iconSize: 12, padding: 4 },
    medium: { fontSize: 12, iconSize: 14, padding: 6 },
    large: { fontSize: 14, iconSize: 16, padding: 8 }
  };

  const info = config[permission] || config.MEMBERS;
  const sizeStyle = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: info.bgColor,
          paddingHorizontal: sizeStyle.padding,
          paddingVertical: sizeStyle.padding / 2,
        }
      ]}
    >
      <Icon name={info.icon} size={sizeStyle.iconSize} color={info.color} />
      <Text
        style={[
          styles.label,
          { color: info.color, fontSize: sizeStyle.fontSize }
        ]}
      >
        {info.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default PostPermissionBadge;
```

---

## Error Handling

### Comprehensive Error Handler

```javascript
const handlePostingError = (error, clubId, navigation) => {
  const { status, message } = error;

  // 403 Forbidden - Permission denied
  if (status === 403) {
    if (message.includes('member')) {
      Alert.alert(
        'Join Required',
        'You must be a member of this club to post.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Club',
            onPress: () => navigation.navigate('ClubDetail', { clubId })
          }
        ]
      );
    } else if (message.includes('admin')) {
      Alert.alert(
        'Admin Only',
        'Only administrators can post in this club.',
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert('Access Denied', message);
    }
  }

  // 404 Not Found
  else if (status === 404) {
    Alert.alert(
      'Club Not Found',
      'This club may have been deleted.',
      [{ text: 'OK' }]
    );
  }

  // 400 Bad Request
  else if (status === 400) {
    Alert.alert('Invalid Data', message);
  }

  // 500 Server Error
  else if (status === 500) {
    Alert.alert(
      'Server Error',
      'Something went wrong. Please try again later.',
      [{ text: 'OK' }]
    );
  }

  // Network error
  else if (error.name === 'NetworkError') {
    Alert.alert(
      'Connection Error',
      'Please check your internet connection.',
      [{ text: 'Retry' }, { text: 'Cancel', style: 'cancel' }]
    );
  }

  // Default
  else {
    Alert.alert('Error', message || 'Failed to create post');
  }
};
```

---

## API Integration Summary

### Base URLs
```javascript
const API_BASE = 'http://YOUR_BASE_URL';
const APP_API = `${API_BASE}/api/app`;
```

### Endpoints Used

**1. Get All Clubs**
```javascript
GET /api/app/connect/clubs
Headers: { Authorization: Bearer <token> }
Response includes: postPermission field
```

**2. Get Club Details**
```javascript
GET /api/app/connect/clubs/:clubId
Headers: { Authorization: Bearer <token> }
Response includes: postPermission and isJoined fields
```

**3. Create Post**
```javascript
POST /api/app/connect/posts
Headers: {
  Authorization: Bearer <token>,
  Content-Type: application/json
}
Body: {
  caption: string,
  mediaType: "IMAGE" | "VIDEO",
  mediaUrls: string[],
  mediaThumbnail?: string,
  clubId?: string
}
```

**4. Join Club**
```javascript
POST /api/app/connect/clubs/:clubId/join
Headers: { Authorization: Bearer <token> }
Body: { userNote?: string }
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

interface CreatePostRequest {
  caption?: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrls: string[];
  mediaThumbnail?: string;
  clubId?: string;
}
```

---

## Testing Checklist

### UI Testing
- [ ] Post button visibility changes based on permission
- [ ] Post button text updates correctly
- [ ] Permission info displays in club detail
- [ ] Permission badge shows in club list
- [ ] Badge colors are correct (green/blue/red)
- [ ] Club picker shows only postable clubs
- [ ] Empty state shows when no clubs available

### Functional Testing
- [ ] Create post in ANYONE club without membership
- [ ] Cannot post in MEMBERS club without joining
- [ ] Join prompt appears when trying to post without membership
- [ ] Cannot post in ADMIN_ONLY club as regular user
- [ ] Admin can post in ADMIN_ONLY club
- [ ] Error messages display correctly
- [ ] Post creation succeeds with correct permissions

### Edge Cases
- [ ] Handle clubs without postPermission (defaults to MEMBERS)
- [ ] Handle network errors gracefully
- [ ] Handle deleted clubs
- [ ] Multiple club selection works
- [ ] Pre-selected club from detail screen works

---

## Performance Optimization

### Memoization

```javascript
import { useMemo } from 'react';

const ClubsScreen = () => {
  const [clubs, setClubs] = useState([]);

  const postableClubs = useMemo(() => {
    const isAdmin = currentUser?.userType === 'admin';

    return clubs.filter(club => {
      switch (club.postPermission) {
        case 'ANYONE':
          return true;
        case 'MEMBERS':
          return club.isJoined;
        case 'ADMIN_ONLY':
          return isAdmin;
        default:
          return club.isJoined;
      }
    });
  }, [clubs, currentUser]);

  return (
    <FlatList
      data={postableClubs}
      renderItem={renderClubCard}
    />
  );
};
```

---

## Notes

1. **User Token**: Use the regular user JWT token for all API calls

2. **Admin Users**: Admin status is determined by `currentUser.userType === 'admin'`

3. **Permission Check**: Always check permission before showing post button

4. **Backwards Compatibility**: Existing clubs without `postPermission` default to MEMBERS behavior

5. **Icons**: Use `react-native-vector-icons/MaterialIcons`:
   - ANYONE: `public`
   - MEMBERS: `group`
   - ADMIN_ONLY: `admin-panel-settings`

6. **Join Flow**: For MEMBERS clubs, provide seamless flow to join before posting

7. **Error Messages**: Show user-friendly messages with actionable options

---

## Summary

**What to Implement**:
1. Show/hide post button based on permission
2. Display permission info in club detail
3. Show permission badge in club list
4. Filter clubs in post creation by user's posting ability
5. Handle all error cases gracefully

**Key Points**:
- Three permission levels: ANYONE, MEMBERS, ADMIN_ONLY
- Check `postPermission` field from club API
- Combine with `isJoined` to determine user's posting ability
- Show clear UI indicators for each permission level
- Provide join flow for MEMBERS-only clubs

**Backend is ready!** All APIs return the necessary fields. Just implement the UI logic and you're done!
