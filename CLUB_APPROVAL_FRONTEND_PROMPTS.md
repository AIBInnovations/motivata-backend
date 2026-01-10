# Club Approval System - Frontend Implementation Guide

## Overview
This document provides detailed implementation instructions for integrating the Club Join Approval system into both the Admin Frontend and Mobile App Frontend.

The system supports two flows:
1. **Open Clubs**: Users can join immediately without approval
2. **Approval-Required Clubs**: Users submit join requests that admins must approve/reject

---

## ADMIN FRONTEND IMPLEMENTATION

### Feature 1: Club Approval Setting Toggle

**Location**: Club Edit/Settings Page

**UI Requirements**:
- Add a toggle switch labeled "Require Admin Approval for Joining"
- Display current state (ON = requires approval, OFF = open to all)
- Show help text: "When enabled, users must request to join and wait for admin approval"

**API Integration**:

```javascript
// Update club approval setting
PUT /api/web/clubs/:clubId/approval-setting
Headers: { Authorization: Bearer <admin-token> }
Body: {
  requiresApproval: true  // or false
}

Response:
{
  success: true,
  message: "Club approval setting updated successfully",
  data: {
    club: {
      id: "club_id",
      name: "Club Name",
      requiresApproval: true
    }
  }
}
```

**Implementation Steps**:
1. Add toggle component in club settings form
2. Fetch current `requiresApproval` value when loading club details
3. On toggle change, call the API to update the setting
4. Show success/error toast message
5. Update local state to reflect new setting

---

### Feature 2: Join Requests Management Page

**Location**: New page - "Club Join Requests" or integrate into Clubs section

**UI Requirements**:
- Table/list view of all join requests
- Columns: User Name, User Email/Phone, Club Name, Status, Request Date, User Note
- Filter by Status (All, Pending, Approved, Rejected)
- Filter by Club (dropdown of all clubs)
- Search by user name
- Pagination (20 items per page)
- Action buttons: Approve, Reject (only for PENDING requests)

**API Integration**:

```javascript
// Get all join requests
GET /api/web/clubs/join-requests/all?page=1&limit=20&status=PENDING&clubId=&search=
Headers: { Authorization: Bearer <admin-token> }

Response:
{
  success: true,
  message: "Join requests fetched successfully",
  data: {
    requests: [
      {
        id: "request_id",
        user: {
          id: "user_id",
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890"
        },
        club: {
          id: "club_id",
          name: "Fitness Club",
          description: "...",
          thumbnail: "url"
        },
        status: "PENDING",  // PENDING | APPROVED | REJECTED
        userNote: "I'm interested in fitness",
        rejectionReason: null,
        adminNotes: null,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: "2025-01-09T10:00:00Z",
        updatedAt: "2025-01-09T10:00:00Z"
      }
    ],
    pagination: {
      currentPage: 1,
      totalPages: 5,
      totalCount: 100,
      limit: 20,
      hasNextPage: true,
      hasPrevPage: false
    }
  }
}
```

---

### Feature 3: Approve Join Request

**UI Requirements**:
- Modal/dialog with:
  - User details (name, email, phone)
  - Club name
  - User's note (if provided)
  - Optional admin notes field (text area, max 500 chars)
  - Approve button
  - Cancel button

**API Integration**:

```javascript
// Approve join request
POST /api/web/clubs/join-requests/:requestId/approve
Headers: { Authorization: Bearer <admin-token> }
Body: {
  adminNotes: "Welcome to the club!"  // optional
}

Response:
{
  success: true,
  message: "Join request approved successfully",
  data: {
    requestId: "request_id",
    status: "APPROVED",
    memberCount: 156
  }
}
```

**Implementation Steps**:
1. Show approve modal when admin clicks Approve button
2. Display user info and club details
3. Provide optional admin notes field
4. Call approve API on confirmation
5. Show success message
6. Refresh the requests list
7. Optionally send notification to user (via your notification system)

---

### Feature 4: Reject Join Request

**UI Requirements**:
- Modal/dialog with:
  - User details
  - Club name
  - **Required** rejection reason field (text area, max 500 chars)
  - Optional admin notes field (text area, max 500 chars)
  - Reject button (disabled if rejection reason empty)
  - Cancel button

**API Integration**:

```javascript
// Reject join request
POST /api/web/clubs/join-requests/:requestId/reject
Headers: { Authorization: Bearer <admin-token> }
Body: {
  rejectionReason: "Club is currently full",  // required
  adminNotes: "Try again next month"  // optional
}

Response:
{
  success: true,
  message: "Join request rejected successfully",
  data: {
    requestId: "request_id",
    status: "REJECTED",
    rejectionReason: "Club is currently full"
  }
}
```

**Implementation Steps**:
1. Show reject modal when admin clicks Reject button
2. Display user info and club details
3. Provide required rejection reason field with validation
4. Provide optional admin notes field
5. Disable submit until rejection reason is filled
6. Call reject API on confirmation
7. Show success message
8. Refresh the requests list
9. Optionally send notification to user with rejection reason

---

### Feature 5: Display Club Approval Status

**Location**: Clubs list page

**UI Requirements**:
- Add badge/tag next to club name showing:
  - "Open to All" (green) if `requiresApproval: false`
  - "Approval Required" (orange) if `requiresApproval: true`
- This helps admins quickly identify which clubs need approval

**Implementation**:
- Club list API already returns `requiresApproval` field
- Add conditional rendering based on this field

---

### Admin Dashboard Enhancements (Optional)

Add metrics card showing:
- Total pending join requests count
- Link to join requests management page

---

## MOBILE APP FRONTEND IMPLEMENTATION

### Feature 1: Club Join Flow - Updated

**Location**: Club Detail Screen

**Current Flow**: User clicks "Join" → Immediately becomes member

**New Flow**:
1. User clicks "Join" button
2. Check club's `requiresApproval` field:
   - If `false`: Join immediately (current behavior)
   - If `true`: Show join request dialog

**UI Requirements for Approval-Required Clubs**:
- Dialog/bottom sheet with:
  - Title: "Request to Join [Club Name]"
  - Message: "This club requires admin approval. Your request will be reviewed."
  - Optional text area: "Tell us why you want to join" (max 500 chars)
  - Submit button: "Send Request"
  - Cancel button

**API Integration**:

```javascript
// Join club (handles both flows automatically)
POST /api/app/connect/clubs/:clubId/join
Headers: { Authorization: Bearer <user-token> }
Body: {
  userNote: "I love fitness and want to connect with others"  // optional
}

Response for Open Club:
{
  success: true,
  message: "Joined club successfully",
  data: {
    requiresApproval: false,
    memberCount: 156
  }
}

Response for Approval-Required Club:
{
  success: true,
  message: "Join request submitted successfully. Waiting for admin approval.",
  data: {
    requiresApproval: true,
    status: "PENDING"
  }
}
```

**Implementation Steps**:
1. When user clicks Join, call the API
2. Backend automatically handles the flow based on club settings
3. Check response:
   - If `requiresApproval: false` → Show "Successfully joined!" and update UI
   - If `requiresApproval: true` → Show "Request submitted! You'll be notified when approved"
4. Update button state accordingly

---

### Feature 2: Join Request Status Indicators

**Location**: Club Detail Screen

**UI Requirements**:
- Update "Join" button based on user's membership status:
  - Not a member → "Join" button (green)
  - Pending approval → "Request Pending" button (orange, disabled)
  - Approved → "Leave" button (red) or "Joined" badge
  - Rejected → "Request Rejected" with info icon

**API Integration**:

```javascript
// Get club details (existing API, already returns isJoined)
GET /api/app/connect/clubs/:clubId
Headers: { Authorization: Bearer <user-token> }

Response:
{
  success: true,
  message: "Club fetched successfully",
  data: {
    club: {
      id: "club_id",
      name: "Fitness Club",
      description: "...",
      thumbnail: "url",
      memberCount: 156,
      postCount: 243,
      isJoined: false,  // or true if member
      requiresApproval: true,  // NEW FIELD
      createdAt: "...",
      updatedAt: "..."
    }
  }
}
```

**Implementation**:
- Fetch club details
- Check `isJoined` and check if user has pending/rejected request
- Render appropriate button state

---

### Feature 3: My Join Requests Screen

**Location**: New screen in Profile/Settings → "My Join Requests"

**UI Requirements**:
- List view of user's join requests
- Each item shows:
  - Club thumbnail and name
  - Status badge (Pending/Approved/Rejected)
  - Request date
  - Rejection reason (if rejected)
- Filter by status (All, Pending, Approved, Rejected)
- Pagination (pull to refresh, infinite scroll)

**API Integration**:

```javascript
// Get user's join requests
GET /api/app/connect/clubs/my-join-requests?page=1&limit=20&status=PENDING
Headers: { Authorization: Bearer <user-token> }

Response:
{
  success: true,
  message: "Join requests fetched successfully",
  data: {
    requests: [
      {
        id: "request_id",
        club: {
          id: "club_id",
          name: "Fitness Club",
          description: "...",
          thumbnail: "url",
          memberCount: 156,
          postCount: 243
        },
        status: "PENDING",  // PENDING | APPROVED | REJECTED
        userNote: "I love fitness",
        rejectionReason: null,  // filled if rejected
        reviewedAt: null,
        createdAt: "2025-01-09T10:00:00Z",
        updatedAt: "2025-01-09T10:00:00Z"
      }
    ],
    pagination: {
      currentPage: 1,
      totalPages: 3,
      totalCount: 50,
      limit: 20,
      hasNextPage: true,
      hasPrevPage: false
    }
  }
}
```

**Implementation Steps**:
1. Create new screen accessible from profile/settings
2. Fetch join requests on load
3. Display list with proper status badges
4. Show rejection reason for rejected requests
5. Implement pull-to-refresh
6. Add pagination/infinite scroll

---

### Feature 4: Club List - Show Approval Badge

**Location**: Clubs List Screen

**UI Requirements**:
- Add small badge on club card showing:
  - "Open" (green) if `requiresApproval: false`
  - "Requires Approval" (orange) if `requiresApproval: true`

**API Integration**:

```javascript
// Get all clubs (existing API)
GET /api/app/connect/clubs?page=1&limit=20
Headers: { Authorization: Bearer <user-token> } // optional

Response:
{
  success: true,
  message: "Clubs fetched successfully",
  data: {
    clubs: [
      {
        id: "club_id",
        name: "Fitness Club",
        description: "...",
        thumbnail: "url",
        memberCount: 156,
        postCount: 243,
        isJoined: false,
        requiresApproval: true,  // NEW FIELD
        createdAt: "...",
        updatedAt: "..."
      }
    ],
    pagination: { ... }
  }
}
```

**Implementation**:
- Club list API already returns `requiresApproval`
- Add badge component based on this field

---

### Feature 5: Notifications Integration

**Recommended**: Integrate with your existing notification system

**Events to Notify Users**:
1. **Join Request Approved**: "Your request to join [Club Name] has been approved!"
2. **Join Request Rejected**: "Your request to join [Club Name] was not approved. Reason: [reason]"

**Implementation**:
- Backend sends these notifications when admin approves/rejects
- App displays push notification
- Deep link to club detail page or join requests page

---

## ERROR HANDLING

### Common Error Responses

```javascript
// Club not found
{
  success: false,
  message: "Club not found",
  error: "..."
}

// Already a member
{
  success: false,
  message: "Already a member of this club",
  error: "..."
}

// Pending request exists
{
  success: false,
  message: "You already have a pending join request for this club",
  error: "..."
}

// Request already rejected
{
  success: false,
  message: "Your previous join request was rejected",
  error: "..."
}

// Validation error
{
  success: false,
  message: "Validation failed",
  errors: [
    { field: "rejectionReason", message: "Rejection reason is required" }
  ]
}

// Unauthorized (401)
{
  success: false,
  message: "Authentication required",
  error: "..."
}

// Forbidden (403)
{
  success: false,
  message: "Admin access required",
  error: "..."
}
```

**Error Handling Best Practices**:
1. Display user-friendly error messages
2. Handle network errors gracefully
3. Show retry options for failed requests
4. Validate user input before API calls
5. Handle expired tokens (redirect to login)

---

## TESTING CHECKLIST

### Admin Frontend Testing
- [ ] Toggle club approval setting ON/OFF
- [ ] View all join requests with filters (pending/approved/rejected)
- [ ] Search join requests by user name
- [ ] Filter join requests by club
- [ ] Approve a join request
- [ ] Reject a join request with reason
- [ ] Try to approve/reject already processed request (should fail)
- [ ] Check pagination works correctly
- [ ] Verify club badges show correct status

### Mobile App Testing
- [ ] Join an open club (no approval required)
- [ ] Request to join an approval-required club
- [ ] Submit join request with optional note
- [ ] View pending request status on club page
- [ ] View all join requests in "My Join Requests" screen
- [ ] Filter join requests by status
- [ ] View rejection reason for rejected request
- [ ] Receive notification when request approved
- [ ] Receive notification when request rejected
- [ ] Try to submit duplicate request (should fail)
- [ ] Check club list shows approval badges

---

## API ENDPOINTS SUMMARY

### Admin Endpoints
Base URL: `/api/web/clubs`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| PUT | `/:clubId/approval-setting` | Update club approval setting | Admin |
| GET | `/join-requests/all` | Get all join requests | Admin |
| POST | `/join-requests/:requestId/approve` | Approve join request | Admin |
| POST | `/join-requests/:requestId/reject` | Reject join request | Admin |

### User Endpoints
Base URL: `/api/app/connect/clubs`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get all clubs (includes requiresApproval) | Optional |
| GET | `/:clubId` | Get club details (includes requiresApproval) | Optional |
| POST | `/:clubId/join` | Join club or request to join | Required |
| GET | `/my-join-requests` | Get user's join requests | Required |

---

## NOTES

1. **Backwards Compatibility**: Existing clubs have `requiresApproval: false` by default, so current behavior is preserved.

2. **Existing Memberships**: Existing club members have `status: 'APPROVED'` automatically set.

3. **User Experience**: When a club switches from "approval required" to "open", existing pending requests should be manually approved by admin or auto-approved (contact backend team if auto-approval is needed).

4. **Performance**: Join requests list is paginated. For large datasets, implement proper loading states and infinite scroll.

5. **Real-time Updates**: Consider implementing WebSocket/polling for real-time updates on join request status changes.

6. **Analytics**: Track metrics like:
   - Number of join requests per club
   - Average approval time
   - Approval/rejection rate

---

## SUPPORT

For questions or issues:
- Check API responses for detailed error messages
- Contact backend team for API-related issues
- Refer to existing club features for UI patterns

---

**Happy Coding! Let me know if you need any clarification.**
