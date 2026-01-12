# Admin Frontend Implementation Guide
## Membership Request Management System

---

## Overview

This document provides complete implementation details for the admin panel to manage membership requests. Admins can view, approve/reject requests, send payment links, and track the entire membership request lifecycle.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [UI Components](#ui-components)
4. [Implementation Flow](#implementation-flow)
5. [Code Examples](#code-examples)
6. [Error Handling](#error-handling)

---

## 1. API Endpoints

### Base URL
```
https://your-api-domain.com/api/web
```

### Authentication
All admin endpoints require authentication. Include the admin access token in headers:

```javascript
headers: {
  'Authorization': `Bearer ${adminAccessToken}`,
  'Content-Type': 'application/json'
}
```

---

### 1.1 Get All Membership Requests

**Endpoint:** `GET /membership-requests`

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Items per page
- `status` (optional) - Filter by status: `PENDING`, `APPROVED`, `PAYMENT_SENT`, `COMPLETED`, `REJECTED`
- `search` (optional) - Search by name or phone

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests?page=1&limit=10&status=PENDING&search=john`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "_id": "65f1234567890abcdef12345",
        "phone": "9876543210",
        "name": "John Doe",
        "status": "PENDING",
        "requestedPlan": {
          "_id": "65f9876543210abcdef54321",
          "name": "Gold Plan",
          "description": "Premium membership",
          "price": 999,
          "durationInDays": 30,
          "perks": ["Free events", "Priority support"]
        },
        "isExistingUser": true,
        "existingUser": {
          "_id": "65fabcdef1234567890abcd",
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "9876543210"
        },
        "createdAt": "2024-03-15T10:30:00.000Z",
        "updatedAt": "2024-03-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

---

### 1.2 Get Single Request Details

**Endpoint:** `GET /membership-requests/:id`

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests/${requestId}`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65f1234567890abcdef12345",
    "phone": "9876543210",
    "name": "John Doe",
    "status": "PENDING",
    "requestedPlan": {
      "_id": "65f9876543210abcdef54321",
      "name": "Gold Plan",
      "price": 999,
      "durationInDays": 30,
      "perks": ["Free events", "Priority support"]
    },
    "isExistingUser": true,
    "existingUser": {
      "_id": "65fabcdef1234567890abcd",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "enrollments": [],
      "followerCount": 150,
      "postCount": 42,
      "createdAt": "2023-01-10T08:00:00.000Z"
    },
    "createdAt": "2024-03-15T10:30:00.000Z"
  }
}
```

---

### 1.3 Get Pending Requests Count

**Endpoint:** `GET /membership-requests/pending-count`

**Use Case:** Display badge/notification count in admin panel

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests/pending-count`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 12
  }
}
```

---

### 1.4 Approve Request (Send Payment Link)

**Endpoint:** `POST /membership-requests/:id/approve`

**Request Body:**
```json
{
  "planId": "65f9876543210abcdef54321",
  "paymentAmount": 999,
  "adminNotes": "Approved for gold plan with standard pricing",
  "sendWhatsApp": true
}
```

**Fields:**
- `planId` (required) - Membership plan ID to assign
- `paymentAmount` (optional) - Custom payment amount (defaults to plan price)
- `adminNotes` (optional) - Internal notes for reference
- `sendWhatsApp` (optional, default: true) - Send WhatsApp notification with payment link

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests/${requestId}/approve`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      planId: selectedPlanId,
      paymentAmount: 999,
      adminNotes: 'First-time user discount applied',
      sendWhatsApp: true
    })
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Membership request approved and payment link sent successfully",
  "data": {
    "request": {
      "_id": "65f1234567890abcdef12345",
      "status": "PAYMENT_SENT",
      "approvedPlan": {
        "_id": "65f9876543210abcdef54321",
        "name": "Gold Plan"
      },
      "paymentAmount": 999,
      "paymentUrl": "https://rzp.io/l/AbC123XyZ",
      "reviewedBy": {
        "_id": "65fadmin123456789abcdef",
        "name": "Admin User"
      },
      "reviewedAt": "2024-03-15T11:00:00.000Z"
    },
    "payment": {
      "_id": "65fpay123456789abcdef",
      "orderId": "order_AbC123XyZ456",
      "amount": 999,
      "status": "PENDING"
    }
  }
}
```

**What Happens:**
1. Request status changes from `PENDING` → `PAYMENT_SENT`
2. Razorpay payment link is generated
3. Payment link stored in request
4. WhatsApp message sent to user with:
   - Payment link
   - Amount to pay
   - Plan name
   - Expiry info (7 days)
5. User receives message instantly

---

### 1.5 Reject Request

**Endpoint:** `POST /membership-requests/:id/reject`

**Request Body:**
```json
{
  "rejectionReason": "User does not meet eligibility criteria",
  "adminNotes": "User requested corporate plan but is individual"
}
```

**Fields:**
- `rejectionReason` (required) - Reason for rejection (user-facing)
- `adminNotes` (optional) - Internal notes

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests/${requestId}/reject`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      rejectionReason: 'Incomplete information provided',
      adminNotes: 'User needs to provide valid ID proof'
    })
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Membership request rejected successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "status": "REJECTED",
    "rejectionReason": "Incomplete information provided",
    "reviewedBy": {
      "_id": "65fadmin123456789abcdef",
      "name": "Admin User"
    },
    "reviewedAt": "2024-03-15T11:00:00.000Z"
  }
}
```

---

### 1.6 Resend Payment Link

**Endpoint:** `POST /membership-requests/:id/resend-link`

**Use Case:** User didn't receive WhatsApp or link expired (but within 7 days)

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-requests/${requestId}/resend-link`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "message": "Payment link resent successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "paymentUrl": "https://rzp.io/l/AbC123XyZ",
    "paymentAmount": 999
  }
}
```

**Note:** Only works if status is `PAYMENT_SENT`

---

### 1.7 Get Available Membership Plans

**Endpoint:** `GET /membership-plans`

**Use Case:** Populate dropdown when approving request

**Example Request:**
```javascript
const response = await fetch(
  `${baseUrl}/membership-plans`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65f9876543210abcdef54321",
      "name": "Gold Plan",
      "description": "Premium membership with all perks",
      "price": 999,
      "durationInDays": 30,
      "perks": [
        "Free entry to all events",
        "Priority support",
        "Exclusive content access"
      ],
      "maxPurchases": 100,
      "currentPurchases": 45,
      "status": "ACTIVE"
    },
    {
      "_id": "65f9876543210abcdef54322",
      "name": "Silver Plan",
      "description": "Standard membership",
      "price": 499,
      "durationInDays": 30,
      "perks": [
        "Free entry to selected events",
        "Email support"
      ],
      "status": "ACTIVE"
    }
  ]
}
```

---

## 2. Data Models

### 2.1 MembershipRequest Object

```typescript
interface MembershipRequest {
  _id: string;
  phone: string;              // 10-digit normalized phone
  name: string;               // Auto-formatted name

  // Status lifecycle
  status: 'PENDING' | 'APPROVED' | 'PAYMENT_SENT' | 'COMPLETED' | 'REJECTED';

  // Plan references
  requestedPlan?: {
    _id: string;
    name: string;
    price: number;
    durationInDays: number;
    perks: string[];
  };
  approvedPlan?: {
    _id: string;
    name: string;
    price: number;
    durationInDays: number;
  };

  // Payment details
  paymentAmount?: number;
  paymentLinkId?: string;
  paymentUrl?: string;        // Razorpay short URL
  orderId?: string;
  paymentId?: string;         // Set after payment completion

  // Review tracking
  reviewedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  reviewedAt?: string;        // ISO date
  rejectionReason?: string;
  adminNotes?: string;

  // User matching
  isExistingUser?: boolean;   // Computed field
  existingUser?: {
    _id: string;
    name: string;
    email?: string;
    phone: string;
    enrollments: any[];
    followerCount: number;
    postCount: number;
    createdAt: string;
  };

  // Created membership reference
  userMembership?: {
    _id: string;
    status: string;
    startDate: string;
    endDate: string;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}
```

---

### 2.2 Status Flow Diagram

```
PENDING
   |
   ├─> [Admin Approves] ──> PAYMENT_SENT
   |                            |
   |                            ├─> [User Pays] ──> COMPLETED
   |                            |
   |                            └─> [7 days expire] ──> (stays PAYMENT_SENT, can resend)
   |
   └─> [Admin Rejects] ──> REJECTED
```

---

## 3. UI Components

### 3.1 Membership Requests List Page

**Features:**
- Data table with sortable columns
- Status badges with colors
- Search by name/phone
- Filter by status dropdown
- Pagination controls
- Pending count badge in sidebar

**Columns:**
1. Request ID (last 8 chars)
2. Name
3. Phone
4. Requested Plan
5. Status Badge
6. Existing User Indicator
7. Created Date
8. Actions (View/Approve/Reject)

**Sample Table Row:**
```jsx
<tr>
  <td>#...12345</td>
  <td>John Doe</td>
  <td>9876543210</td>
  <td>Gold Plan</td>
  <td><Badge status="PENDING">Pending</Badge></td>
  <td><CheckIcon color="green" /> Yes</td>
  <td>2024-03-15 10:30 AM</td>
  <td>
    <Button onClick={viewDetails}>View</Button>
    <Button onClick={approve} color="green">Approve</Button>
    <Button onClick={reject} color="red">Reject</Button>
  </td>
</tr>
```

**Status Badge Colors:**
- `PENDING` - Yellow/Orange
- `PAYMENT_SENT` - Blue
- `COMPLETED` - Green
- `REJECTED` - Red

---

### 3.2 Request Details Modal/Page

**Layout Sections:**

**A. User Information Card**
```
┌─────────────────────────────────────┐
│ User Details                        │
├─────────────────────────────────────┤
│ Name:           John Doe            │
│ Phone:          +91 9876543210      │
│ Status:         🟡 PENDING          │
│ Submitted:      Mar 15, 2024 10:30  │
│                                     │
│ Existing User:  ✓ Yes               │
│   Email:        john@example.com    │
│   Member Since: Jan 10, 2023        │
│   Enrollments:  5 events            │
│   Followers:    150                 │
└─────────────────────────────────────┘
```

**B. Requested Plan Card**
```
┌─────────────────────────────────────┐
│ Requested Membership Plan           │
├─────────────────────────────────────┤
│ Plan:           Gold Plan           │
│ Price:          ₹999                │
│ Duration:       30 days             │
│ Perks:          • Free events       │
│                 • Priority support  │
│                 • Exclusive content │
└─────────────────────────────────────┘
```

**C. Payment Status Card** (if status is PAYMENT_SENT or COMPLETED)
```
┌─────────────────────────────────────┐
│ Payment Details                     │
├─────────────────────────────────────┤
│ Amount:         ₹999                │
│ Payment Link:   [Copy Link] [QR]   │
│ Order ID:       order_AbC123XyZ456  │
│ Status:         Awaiting Payment    │
│ Sent At:        Mar 15, 2024 11:00  │
│                                     │
│ [Resend Link Button]                │
└─────────────────────────────────────┘
```

**D. Admin Review Card** (if reviewed)
```
┌─────────────────────────────────────┐
│ Admin Review                        │
├─────────────────────────────────────┤
│ Reviewed By:    Admin User          │
│ Reviewed At:    Mar 15, 2024 11:00  │
│ Admin Notes:    First-time discount │
└─────────────────────────────────────┘
```

**E. Action Buttons** (bottom)
- If `PENDING`: [Approve Button] [Reject Button]
- If `PAYMENT_SENT`: [Resend Link Button]
- If `COMPLETED`: [View Membership Button]
- If `REJECTED`: (No actions)

---

### 3.3 Approve Request Modal

**Modal Layout:**
```
┌────────────────────────────────────────────┐
│ Approve Membership Request                 │
├────────────────────────────────────────────┤
│                                            │
│ User: John Doe (+91 9876543210)           │
│                                            │
│ Select Membership Plan: *                  │
│ [Dropdown: Gold Plan, Silver Plan, ...]   │
│                                            │
│ Payment Amount: *                          │
│ [Input: ₹] (Auto-filled from plan)        │
│                                            │
│ Admin Notes:                               │
│ [Textarea: Optional notes]                 │
│                                            │
│ ☑ Send WhatsApp notification               │
│                                            │
│ Preview:                                   │
│ ┌────────────────────────────────────────┐│
│ │ 📱 WhatsApp Message Preview:           ││
│ │                                        ││
│ │ Hello John Doe!                        ││
│ │                                        ││
│ │ Your membership request has been       ││
│ │ approved! 🎉                           ││
│ │                                        ││
│ │ Plan: Gold Plan                        ││
│ │ Amount: ₹999                           ││
│ │ Validity: 30 days                      ││
│ │                                        ││
│ │ Complete payment:                      ││
│ │ https://rzp.io/l/AbC123XyZ             ││
│ │                                        ││
│ │ Link expires in 7 days                 ││
│ └────────────────────────────────────────┘│
│                                            │
│              [Cancel]  [Approve & Send]    │
└────────────────────────────────────────────┘
```

**Form Validation:**
- Plan ID is required
- Payment amount must be > 0
- Amount pre-fills from selected plan price
- Admin can override amount (e.g., for discounts)

---

### 3.4 Reject Request Modal

**Modal Layout:**
```
┌────────────────────────────────────────────┐
│ Reject Membership Request                  │
├────────────────────────────────────────────┤
│                                            │
│ User: John Doe (+91 9876543210)           │
│                                            │
│ Rejection Reason: *                        │
│ [Textarea: Required field]                 │
│ (This will be visible to user)             │
│                                            │
│ Internal Admin Notes:                      │
│ [Textarea: Optional]                       │
│ (Only visible to admins)                   │
│                                            │
│ ⚠️  This action cannot be undone.          │
│                                            │
│              [Cancel]  [Confirm Reject]    │
└────────────────────────────────────────────┘
```

---

### 3.5 Filters & Search Component

```jsx
<div className="filters-section">
  <SearchInput
    placeholder="Search by name or phone"
    value={search}
    onChange={setSearch}
  />

  <StatusFilter
    value={statusFilter}
    onChange={setStatusFilter}
    options={[
      { label: 'All', value: '' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Payment Sent', value: 'PAYMENT_SENT' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Rejected', value: 'REJECTED' }
    ]}
  />

  <Button onClick={clearFilters}>Clear Filters</Button>
</div>
```

---

## 4. Implementation Flow

### 4.1 Page Load Flow

```javascript
// On component mount
useEffect(() => {
  fetchPendingCount();    // For sidebar badge
  fetchMembershipPlans(); // For approve dropdown
  fetchRequests();        // Main data
}, []);

// Poll for new requests every 30 seconds (optional)
useEffect(() => {
  const interval = setInterval(fetchPendingCount, 30000);
  return () => clearInterval(interval);
}, []);
```

---

### 4.2 Approve Request Flow

```javascript
async function approveRequest(requestId) {
  try {
    // 1. Show approve modal
    setShowApproveModal(true);

    // 2. User selects plan and optionally modifies amount
    const formData = {
      planId: selectedPlan._id,
      paymentAmount: customAmount || selectedPlan.price,
      adminNotes: adminNotes,
      sendWhatsApp: true
    };

    // 3. Submit approval
    setLoading(true);
    const response = await fetch(
      `${baseUrl}/membership-requests/${requestId}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      }
    );

    const result = await response.json();

    if (result.success) {
      // 4. Show success message
      showToast('Payment link sent successfully!', 'success');

      // 5. Update UI
      setShowApproveModal(false);
      fetchRequests(); // Refresh list

      // 6. Optionally show payment URL with QR code
      showPaymentDetailsModal(result.data.request.paymentUrl);
    } else {
      showToast(result.message, 'error');
    }

  } catch (error) {
    console.error('Approval failed:', error);
    showToast('Failed to approve request', 'error');
  } finally {
    setLoading(false);
  }
}
```

---

### 4.3 Reject Request Flow

```javascript
async function rejectRequest(requestId) {
  try {
    // 1. Show reject modal
    setShowRejectModal(true);

    // 2. User enters rejection reason
    const formData = {
      rejectionReason: rejectionReason,
      adminNotes: adminNotes
    };

    // 3. Validate
    if (!rejectionReason.trim()) {
      showToast('Rejection reason is required', 'error');
      return;
    }

    // 4. Submit rejection
    setLoading(true);
    const response = await fetch(
      `${baseUrl}/membership-requests/${requestId}/reject`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      }
    );

    const result = await response.json();

    if (result.success) {
      showToast('Request rejected successfully', 'success');
      setShowRejectModal(false);
      fetchRequests(); // Refresh list
    } else {
      showToast(result.message, 'error');
    }

  } catch (error) {
    console.error('Rejection failed:', error);
    showToast('Failed to reject request', 'error');
  } finally {
    setLoading(false);
  }
}
```

---

### 4.4 Resend Payment Link Flow

```javascript
async function resendPaymentLink(requestId) {
  try {
    const confirmed = await confirm(
      'Resend payment link to user via WhatsApp?'
    );

    if (!confirmed) return;

    setLoading(true);
    const response = await fetch(
      `${baseUrl}/membership-requests/${requestId}/resend-link`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      showToast('Payment link resent successfully!', 'success');
    } else {
      showToast(result.message, 'error');
    }

  } catch (error) {
    console.error('Resend failed:', error);
    showToast('Failed to resend link', 'error');
  } finally {
    setLoading(false);
  }
}
```

---

## 5. Code Examples

### 5.1 Complete React Component (List Page)

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MembershipRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [membershipPlans, setMembershipPlans] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // API Base URL
  const API_BASE = 'https://your-api.com/api/web';
  const adminToken = localStorage.getItem('adminToken');

  // Axios instance
  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  // Fetch requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/membership-requests', {
        params: {
          page,
          limit: 10,
          status: statusFilter || undefined,
          search: searchQuery || undefined
        }
      });

      setRequests(response.data.data.requests);
      setTotalPages(response.data.data.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending count
  const fetchPendingCount = async () => {
    try {
      const response = await api.get('/membership-requests/pending-count');
      setPendingCount(response.data.data.count);
    } catch (error) {
      console.error('Failed to fetch pending count:', error);
    }
  };

  // Fetch membership plans
  const fetchMembershipPlans = async () => {
    try {
      const response = await api.get('/membership-plans');
      setMembershipPlans(response.data.data);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchPendingCount();
    fetchMembershipPlans();
  }, []);

  // Fetch on filter/page change
  useEffect(() => {
    fetchRequests();
  }, [page, statusFilter, searchQuery]);

  // Auto-refresh pending count
  useEffect(() => {
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Approve handler
  const handleApprove = (request) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  // Reject handler
  const handleReject = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  // Resend link handler
  const handleResendLink = async (requestId) => {
    if (!confirm('Resend payment link to user?')) return;

    try {
      await api.post(`/membership-requests/${requestId}/resend-link`);
      alert('Payment link resent successfully!');
    } catch (error) {
      alert('Failed to resend link');
    }
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      PENDING: 'bg-yellow-500',
      PAYMENT_SENT: 'bg-blue-500',
      COMPLETED: 'bg-green-500',
      REJECTED: 'bg-red-500'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-white ${colors[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="membership-requests-page">
      <div className="header">
        <h1>Membership Requests</h1>
        <span className="badge">Pending: {pendingCount}</span>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search by name or phone"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="PAYMENT_SENT">Payment Sent</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Requested Plan</th>
              <th>Status</th>
              <th>Existing User</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request._id}>
                <td>#{request._id.slice(-8)}</td>
                <td>{request.name}</td>
                <td>{request.phone}</td>
                <td>{request.requestedPlan?.name || '-'}</td>
                <td><StatusBadge status={request.status} /></td>
                <td>{request.isExistingUser ? '✓ Yes' : '✗ No'}</td>
                <td>{new Date(request.createdAt).toLocaleString()}</td>
                <td>
                  {request.status === 'PENDING' && (
                    <>
                      <button onClick={() => handleApprove(request)}>
                        Approve
                      </button>
                      <button onClick={() => handleReject(request)}>
                        Reject
                      </button>
                    </>
                  )}

                  {request.status === 'PAYMENT_SENT' && (
                    <button onClick={() => handleResendLink(request._id)}>
                      Resend Link
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>

      {/* Modals */}
      {showApproveModal && (
        <ApproveModal
          request={selectedRequest}
          plans={membershipPlans}
          onClose={() => setShowApproveModal(false)}
          onSuccess={() => {
            fetchRequests();
            fetchPendingCount();
          }}
        />
      )}

      {showRejectModal && (
        <RejectModal
          request={selectedRequest}
          onClose={() => setShowRejectModal(false)}
          onSuccess={() => {
            fetchRequests();
            fetchPendingCount();
          }}
        />
      )}
    </div>
  );
};

export default MembershipRequestsPage;
```

---

### 5.2 Approve Modal Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const ApproveModal = ({ request, plans, onClose, onSuccess }) => {
  const [selectedPlanId, setSelectedPlanId] = useState(
    request.requestedPlan?._id || ''
  );
  const [paymentAmount, setPaymentAmount] = useState(
    request.requestedPlan?.price || 0
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [loading, setLoading] = useState(false);

  const API_BASE = 'https://your-api.com/api/web';
  const adminToken = localStorage.getItem('adminToken');

  // Update amount when plan changes
  const handlePlanChange = (planId) => {
    setSelectedPlanId(planId);
    const plan = plans.find(p => p._id === planId);
    if (plan) {
      setPaymentAmount(plan.price);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPlanId) {
      alert('Please select a membership plan');
      return;
    }

    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE}/membership-requests/${request._id}/approve`,
        {
          planId: selectedPlanId,
          paymentAmount: paymentAmount,
          adminNotes: adminNotes,
          sendWhatsApp: sendWhatsApp
        },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        alert('Payment link sent successfully!');
        onSuccess();
        onClose();
      }
    } catch (error) {
      alert('Failed to approve request: ' +
        (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p._id === selectedPlanId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Approve Membership Request</h2>

        <div className="user-info">
          <p><strong>User:</strong> {request.name}</p>
          <p><strong>Phone:</strong> +91 {request.phone}</p>
          {request.isExistingUser && (
            <p className="existing-user">✓ Existing registered user</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Membership Plan: *</label>
            <select
              value={selectedPlanId}
              onChange={(e) => handlePlanChange(e.target.value)}
              required
            >
              <option value="">-- Select Plan --</option>
              {plans
                .filter(plan => plan.status === 'ACTIVE')
                .map(plan => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name} - ₹{plan.price} ({plan.durationInDays} days)
                  </option>
                ))
              }
            </select>
          </div>

          {selectedPlan && (
            <div className="plan-details">
              <h4>Plan Details:</h4>
              <p>{selectedPlan.description}</p>
              <ul>
                {selectedPlan.perks.map((perk, index) => (
                  <li key={index}>{perk}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-group">
            <label>Payment Amount (₹): *</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              min="1"
              required
            />
            <small>You can modify the amount for discounts/offers</small>
          </div>

          <div className="form-group">
            <label>Admin Notes:</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Optional internal notes"
              rows="3"
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
              />
              Send WhatsApp notification with payment link
            </label>
          </div>

          {sendWhatsApp && (
            <div className="whatsapp-preview">
              <h4>📱 WhatsApp Message Preview:</h4>
              <div className="message-box">
                <p>Hello {request.name}!</p>
                <p>Your membership request has been approved! 🎉</p>
                <p><strong>Plan:</strong> {selectedPlan?.name}</p>
                <p><strong>Amount:</strong> ₹{paymentAmount}</p>
                <p><strong>Validity:</strong> {selectedPlan?.durationInDays} days</p>
                <p>Complete payment: [Payment Link]</p>
                <p><em>Link expires in 7 days</em></p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Approve & Send Payment Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveModal;
```

---

### 5.3 Reject Modal Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const RejectModal = ({ request, onClose, onSuccess }) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE = 'https://your-api.com/api/web';
  const adminToken = localStorage.getItem('adminToken');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rejectionReason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE}/membership-requests/${request._id}/reject`,
        {
          rejectionReason: rejectionReason,
          adminNotes: adminNotes
        },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        alert('Request rejected successfully');
        onSuccess();
        onClose();
      }
    } catch (error) {
      alert('Failed to reject request: ' +
        (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Reject Membership Request</h2>

        <div className="user-info">
          <p><strong>User:</strong> {request.name}</p>
          <p><strong>Phone:</strong> +91 {request.phone}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rejection Reason: *</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (visible to user)"
              rows="4"
              required
            />
            <small>This reason may be shared with the user</small>
          </div>

          <div className="form-group">
            <label>Internal Admin Notes:</label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Optional internal notes (not visible to user)"
              rows="3"
            />
          </div>

          <div className="warning">
            ⚠️ This action cannot be undone. The request will be marked as rejected.
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Confirm Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectModal;
```

---

## 6. Error Handling

### 6.1 Common Error Scenarios

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

**Common Errors:**

| Error Code | Scenario | HTTP Status |
|------------|----------|-------------|
| `UNAUTHORIZED` | Invalid/missing admin token | 401 |
| `FORBIDDEN` | Admin lacks permission | 403 |
| `NOT_FOUND` | Request ID not found | 404 |
| `INVALID_STATUS` | Request not in correct status | 400 |
| `VALIDATION_ERROR` | Missing/invalid fields | 400 |
| `PLAN_NOT_FOUND` | Plan ID doesn't exist | 404 |
| `PAYMENT_LINK_ERROR` | Razorpay API failure | 500 |
| `ALREADY_REVIEWED` | Request already approved/rejected | 400 |

---

### 6.2 Error Handling Code

```javascript
// Centralized error handler
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const { status, data } = error.response;

    switch (status) {
      case 401:
        // Redirect to login
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
        break;

      case 403:
        showToast('You do not have permission for this action', 'error');
        break;

      case 404:
        showToast('Resource not found', 'error');
        break;

      case 400:
        // Validation or business logic error
        showToast(data.message || 'Invalid request', 'error');
        break;

      case 500:
        showToast('Server error. Please try again later.', 'error');
        break;

      default:
        showToast(data.message || 'An error occurred', 'error');
    }
  } else if (error.request) {
    // Network error
    showToast('Network error. Please check your connection.', 'error');
  } else {
    // Other errors
    showToast('An unexpected error occurred', 'error');
  }

  console.error('API Error:', error);
};

// Usage in API calls
try {
  const response = await api.post('/membership-requests/123/approve', data);
  // Handle success
} catch (error) {
  handleApiError(error);
}
```

---

### 6.3 Validation Before API Calls

```javascript
// Validate approve form
const validateApproveForm = (formData) => {
  const errors = [];

  if (!formData.planId) {
    errors.push('Please select a membership plan');
  }

  if (!formData.paymentAmount || formData.paymentAmount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }

  if (formData.adminNotes && formData.adminNotes.length > 1000) {
    errors.push('Admin notes cannot exceed 1000 characters');
  }

  return errors;
};

// In submit handler
const handleApprove = async () => {
  const errors = validateApproveForm(formData);

  if (errors.length > 0) {
    setFormErrors(errors);
    return;
  }

  // Proceed with API call
};
```

---

## 7. Testing Checklist

### 7.1 Functional Testing

- [ ] List page loads all requests correctly
- [ ] Pagination works (next/previous)
- [ ] Status filter works for all statuses
- [ ] Search by name works
- [ ] Search by phone works
- [ ] Pending count badge updates
- [ ] View details modal shows all information
- [ ] Existing user indicator shows correctly
- [ ] Approve modal validates required fields
- [ ] Approve sends payment link successfully
- [ ] WhatsApp message is received
- [ ] Payment link is valid and opens correctly
- [ ] Reject modal validates rejection reason
- [ ] Reject marks request as rejected
- [ ] Resend link works for PAYMENT_SENT status
- [ ] Actions disabled for inappropriate statuses
- [ ] After approval, status changes to PAYMENT_SENT
- [ ] After rejection, status changes to REJECTED
- [ ] After payment, status changes to COMPLETED

---

### 7.2 Edge Cases

- [ ] Empty state when no requests exist
- [ ] Loading states show during API calls
- [ ] Error messages display correctly
- [ ] Token expiry redirects to login
- [ ] Network errors handled gracefully
- [ ] Duplicate approval attempts blocked
- [ ] Plan with maxPurchases reached handled
- [ ] Invalid request ID shows error
- [ ] Long names/text truncated properly
- [ ] Special characters in search work
- [ ] Payment link expiry after 7 days
- [ ] User pays after admin approval
- [ ] Admin modifies payment amount (discount)

---

## 8. Additional Features (Optional)

### 8.1 Bulk Actions

```javascript
// Select multiple requests
const [selectedRequests, setSelectedRequests] = useState([]);

// Bulk approve
const bulkApprove = async (requestIds, planId, amount) => {
  const results = await Promise.allSettled(
    requestIds.map(id =>
      api.post(`/membership-requests/${id}/approve`, {
        planId,
        paymentAmount: amount
      })
    )
  );

  // Show summary
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  showToast(`Approved: ${succeeded}, Failed: ${failed}`, 'info');
};
```

---

### 8.2 Export to CSV

```javascript
const exportToCSV = () => {
  const csvData = requests.map(r => ({
    'Request ID': r._id,
    'Name': r.name,
    'Phone': r.phone,
    'Requested Plan': r.requestedPlan?.name || '-',
    'Status': r.status,
    'Existing User': r.isExistingUser ? 'Yes' : 'No',
    'Created At': new Date(r.createdAt).toLocaleString()
  }));

  // Convert to CSV and download
  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `membership-requests-${Date.now()}.csv`;
  link.click();
};
```

---

### 8.3 Real-time Updates (WebSocket)

```javascript
// Connect to WebSocket for live updates
useEffect(() => {
  const ws = new WebSocket('wss://your-api.com/admin-updates');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'NEW_MEMBERSHIP_REQUEST') {
      // Refresh list
      fetchRequests();
      fetchPendingCount();

      // Show notification
      showNotification('New membership request received!');
    }

    if (data.type === 'PAYMENT_COMPLETED') {
      // Refresh list
      fetchRequests();
    }
  };

  return () => ws.close();
}, []);
```

---

## 9. Summary

This implementation guide covers:

✅ All API endpoints with request/response examples
✅ Complete data models and status flow
✅ UI component designs and layouts
✅ React code examples for all features
✅ Error handling strategies
✅ Testing checklist
✅ Optional advanced features

**Key Points:**
- Admin reviews pending requests
- Approves with custom plan and amount
- Payment link auto-sent via WhatsApp
- Link prefilled with user's phone number
- Webhook automatically activates membership after payment
- Admin can track entire lifecycle

**Next Steps:**
1. Implement UI components based on designs
2. Integrate API endpoints
3. Test all flows thoroughly
4. Deploy and monitor

---

## Support & Contact

For backend API issues or questions:
- Check API documentation
- Review error logs
- Contact backend team

---

**Document Version:** 1.0
**Last Updated:** 2024-03-15
**Author:** Backend Team
