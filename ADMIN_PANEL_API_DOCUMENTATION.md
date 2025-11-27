# Admin Panel API Documentation

Base URL: `/api/web`

## Response Format

All responses follow this structure:
```json
{
  "status": 200,
  "message": "Success message",
  "error": null,
  "data": { ... }
}
```

On error:
```json
{
  "status": 400,
  "message": "Error message",
  "error": "Error details",
  "data": null
}
```

---

## Authentication

All protected routes require:
```
Authorization: Bearer <access_token>
```

### Admin Roles
- `SUPER_ADMIN` - Full access to all features
- `MANAGEMENT_STAFF` - Limited access based on `access` array

---

## Pages Required

1. **Login Page**
2. **Dashboard** (optional analytics)
3. **Admin Management** (Super Admin only)
4. **Events Management**
5. **Coupons Management**
6. **Payments List**
7. **Enrollments Management**
8. **Ticket Verification** (QR Scanner)
9. **Cash Partners Management**
10. **Profile Settings**

---

# 1. AUTHENTICATION

## Login

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response Data:**
```json
{
  "admin": {
    "_id": "ObjectId",
    "name": "Admin Name",
    "email": "admin@example.com",
    "phone": "1234567890",
    "role": "SUPER_ADMIN | MANAGEMENT_STAFF",
    "access": ["events", "coupons"],
    "status": "ACTIVATED",
    "lastLogin": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

---

## Register First Admin (Initial Setup Only)

**POST** `/auth/register`

Works only when no admins exist in the system.

**Request Body:**
```json
{
  "name": "Admin Name",
  "email": "admin@example.com",
  "phone": "1234567890",
  "password": "password123"
}
```

**Response Data:** Same as login response.

---

## Refresh Token

**POST** `/auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response Data:**
```json
{
  "accessToken": "new_jwt_access_token"
}
```

---

## Logout

**POST** `/auth/logout` (Protected)

**Response Data:** Empty `{}`

---

## Get Profile

**GET** `/auth/profile` (Protected)

**Response Data:**
```json
{
  "admin": {
    "_id": "ObjectId",
    "name": "Admin Name",
    "email": "admin@example.com",
    "phone": "1234567890",
    "role": "SUPER_ADMIN",
    "access": [],
    "status": "ACTIVATED",
    "lastLogin": "2025-01-01T00:00:00.000Z",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

## Update Profile

**PUT** `/auth/profile` (Protected)

**Request Body:**
```json
{
  "name": "New Name",
  "email": "newemail@example.com",
  "phone": "0987654321"
}
```

All fields optional.

**Response Data:** Updated admin object (same structure as Get Profile).

---

## Change Password

**PUT** `/auth/change-password` (Protected)

**Request Body:**
```json
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

**Response Data:** Empty `{}`

---

# 2. ADMIN MANAGEMENT (Super Admin Only)

## Create New Admin

**POST** `/auth/create` (Super Admin)

**Request Body:**
```json
{
  "name": "Staff Name",
  "email": "staff@example.com",
  "phone": "1234567890",
  "password": "password123",
  "role": "MANAGEMENT_STAFF",
  "access": ["events", "coupons"]
}
```

**Response Data:** Same as login response.

---

## List All Admins

**GET** `/auth/admins` (Super Admin)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `status` - "ACTIVATED" | "DEACTIVATED"
- `role` - "SUPER_ADMIN" | "MANAGEMENT_STAFF"
- `search` - Search by name/email/phone

**Response Data:**
```json
{
  "admins": [
    {
      "_id": "ObjectId",
      "name": "Admin Name",
      "email": "admin@example.com",
      "phone": "1234567890",
      "role": "MANAGEMENT_STAFF",
      "access": ["events"],
      "status": "ACTIVATED",
      "lastLogin": "2025-01-01T00:00:00.000Z",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## Get Admin by ID

**GET** `/auth/admins/:id` (Super Admin)

**Response Data:**
```json
{
  "admin": { /* admin object */ }
}
```

---

## Update Admin

**PUT** `/auth/admins/:id` (Super Admin)

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "phone": "1234567890",
  "role": "SUPER_ADMIN | MANAGEMENT_STAFF",
  "access": ["events", "coupons"],
  "status": "ACTIVATED | DEACTIVATED"
}
```

All fields optional.

**Response Data:** Updated admin object.

---

## Delete Admin (Permanent)

**DELETE** `/auth/admins/:id` (Super Admin)

Cannot delete own account.

**Response Data:** Empty `{}`

---

# 3. EVENTS MANAGEMENT

## Create Event

**POST** `/events` (Protected)

**Request Body:**
```json
{
  "name": "Event Name",
  "description": "Event description",
  "imageUrls": ["https://example.com/image.jpg"],
  "thumbnail": {
    "imageUrl": "https://example.com/thumb.jpg",
    "videoUrl": "https://example.com/video.mp4"
  },
  "mode": "ONLINE | OFFLINE | HYBRID",
  "city": "Mumbai",
  "category": "TECHNOLOGY | EDUCATION | MEDICAL | COMEDY | ENTERTAINMENT | BUSINESS | SPORTS | ARTS | MUSIC | FOOD | LIFESTYLE | OTHER",
  "startDate": "2025-12-01T09:00:00.000Z",
  "endDate": "2025-12-01T18:00:00.000Z",
  "price": 1000,
  "compareAtPrice": 1500,
  "availableSeats": 100,
  "coupons": ["couponObjectId"]
}
```

**OR** with multi-tier pricing:
```json
{
  "name": "Event Name",
  "description": "Description",
  "mode": "OFFLINE",
  "city": "Mumbai",
  "category": "TECHNOLOGY",
  "startDate": "2025-12-01T09:00:00.000Z",
  "endDate": "2025-12-01T18:00:00.000Z",
  "pricingTiers": [
    {
      "name": "Early Bird",
      "price": 800,
      "compareAtPrice": 1000,
      "shortDescription": "Limited offer",
      "notes": "First 50 registrations"
    },
    {
      "name": "Regular",
      "price": 1200,
      "shortDescription": "Standard ticket"
    }
  ]
}
```

**Response Data:**
```json
{
  "event": {
    "_id": "ObjectId",
    "name": "Event Name",
    "description": "Description",
    "imageUrls": [],
    "thumbnail": {},
    "isLive": true,
    "mode": "OFFLINE",
    "city": "Mumbai",
    "category": "TECHNOLOGY",
    "startDate": "2025-12-01T09:00:00.000Z",
    "endDate": "2025-12-01T18:00:00.000Z",
    "price": 1000,
    "compareAtPrice": 1500,
    "pricingTiers": [
      {
        "_id": "tierId",
        "name": "Early Bird",
        "price": 800,
        "compareAtPrice": 1000,
        "shortDescription": "Limited offer"
      }
    ],
    "availableSeats": 100,
    "ticketsSold": 0,
    "coupons": [],
    "createdBy": "adminId",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

---

## List All Events

**GET** `/events` (Protected)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `sortBy` - "name" | "startDate" | "endDate" | "price" | "createdAt"
- `sortOrder` - "asc" | "desc"
- `category` - Event category
- `mode` - "ONLINE" | "OFFLINE" | "HYBRID"
- `city` - City name
- `isLive` - true | false
- `minPrice` - Minimum price
- `maxPrice` - Maximum price
- `startDateFrom` - ISO date
- `startDateTo` - ISO date
- `search` - Search in name/description

**Response Data:**
```json
{
  "events": [ /* array of event objects */ ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 50,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Get Event by ID

**GET** `/events/:id` (Protected)

**Response Data:**
```json
{
  "event": {
    /* full event object with populated createdBy, updatedBy */
  }
}
```

---

## Update Event

**PUT** `/events/:id` (Protected)

**Request Body:** Same fields as create, all optional.

**Response Data:** Updated event object.

---

## Soft Delete Event

**DELETE** `/events/:id` (Protected)

Marks event as deleted but keeps in database.

**Response Data:** Empty `{}`

---

## Restore Deleted Event

**POST** `/events/:id/restore` (Protected)

**Response Data:**
```json
{
  "event": { /* restored event object */ }
}
```

---

## Get Deleted Events

**GET** `/events/deleted` (Protected)

**Query Parameters:** Same as List All Events.

**Response Data:**
```json
{
  "events": [
    {
      /* event object with isDeleted, deletedAt, deletedBy fields */
    }
  ],
  "pagination": { ... }
}
```

---

## Permanent Delete Event

**DELETE** `/events/:id/permanent` (Super Admin Only)

Event must be soft-deleted first.

**Response Data:** Empty `{}`

---

## Get Event Ticket Stats

**GET** `/events/:id/ticket-stats` (Protected)

**Response Data:**
```json
{
  "stats": {
    "eventId": "ObjectId",
    "eventName": "Event Name",
    "ticketsSold": 45,
    "availableSeats": 55,
    "hasAvailableSeatsTracking": true,
    "pricingType": "multi-tier | single",
    "tiers": [
      {
        "tierId": "ObjectId",
        "name": "Early Bird",
        "price": 800
      }
    ],
    "price": 1000
  }
}
```

---

## Update Expired Events

**POST** `/events/update-expired` (Protected)

Marks all past events as not live.

**Response Data:**
```json
{
  "updatedCount": 5
}
```

---

# 4. COUPONS MANAGEMENT

## Create Coupon

**POST** `/coupons` (Protected)

**Request Body:**
```json
{
  "code": "SAVE20",
  "discountPercent": 20,
  "maxDiscountAmount": 500,
  "minPurchaseAmount": 1000,
  "maxUsageLimit": 100,
  "maxUsagePerUser": 1,
  "validFrom": "2025-01-01T00:00:00.000Z",
  "validUntil": "2025-12-31T23:59:59.000Z",
  "description": "Save 20% on your purchase",
  "isActive": true
}
```

**Response Data:**
```json
{
  "coupon": {
    "_id": "ObjectId",
    "code": "SAVE20",
    "discountPercent": 20,
    "maxDiscountAmount": 500,
    "minPurchaseAmount": 1000,
    "maxUsageLimit": 100,
    "usageCount": 0,
    "maxUsagePerUser": 1,
    "validFrom": "2025-01-01T00:00:00.000Z",
    "validUntil": "2025-12-31T23:59:59.000Z",
    "description": "Save 20% on your purchase",
    "isActive": true,
    "createdBy": "adminId",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

---

## List All Coupons

**GET** `/coupons` (Protected)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `sortBy` - "code" | "discountPercent" | "validFrom" | "validUntil" | "createdAt"
- `sortOrder` - "asc" | "desc"
- `isActive` - true | false
- `search` - Search in code/description

**Response Data:**
```json
{
  "coupons": [ /* array of coupon objects */ ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalCount": 15,
    "limit": 10
  }
}
```

---

## Get Coupon by ID

**GET** `/coupons/:id` (Protected)

**Response Data:**
```json
{
  "coupon": { /* full coupon object */ }
}
```

---

## Update Coupon

**PUT** `/coupons/:id` (Protected)

**Request Body:** Same fields as create, all optional.

**Response Data:** Updated coupon object.

---

## Soft Delete Coupon

**DELETE** `/coupons/:id` (Protected)

**Response Data:** Empty `{}`

---

## Restore Deleted Coupon

**POST** `/coupons/:id/restore` (Protected)

**Response Data:**
```json
{
  "coupon": { /* restored coupon object */ }
}
```

---

## Get Deleted Coupons

**GET** `/coupons/deleted` (Protected)

**Response Data:**
```json
{
  "coupons": [ /* array with isDeleted, deletedAt, deletedBy */ ]
}
```

---

## Permanent Delete Coupon

**DELETE** `/coupons/:id/permanent` (Super Admin Only)

**Response Data:** Empty `{}`

---

# 5. PAYMENTS

## List All Payments

**GET** `/payments` (Protected)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `sortBy` - "purchaseDateTime" | "amount" | "finalAmount" | "createdAt"
- `sortOrder` - "asc" | "desc"
- `status` - "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"
- `type` - "EVENT" | "SESSION" | "OTHER" | "PRODUCT"
- `eventId` - Filter by event
- `sessionId` - Filter by session
- `paymentMethod` - "CASH" | "RAZORPAY"

**Response Data:**
```json
{
  "payments": [
    {
      "_id": "ObjectId",
      "orderId": "order_xxx",
      "paymentId": "pay_xxx",
      "userId": {
        "_id": "ObjectId",
        "name": "User Name",
        "email": "user@example.com",
        "phone": "1234567890"
      },
      "type": "EVENT",
      "eventId": {
        "_id": "ObjectId",
        "name": "Event Name",
        "startDate": "timestamp",
        "endDate": "timestamp",
        "mode": "OFFLINE",
        "city": "Mumbai"
      },
      "amount": 1000,
      "couponCode": "SAVE20",
      "discountAmount": 200,
      "finalAmount": 800,
      "status": "SUCCESS",
      "purchaseDateTime": "timestamp",
      "metadata": {},
      "createdAt": "timestamp"
    }
  ],
  "pagination": { ... },
  "statistics": {
    "_id": null,
    "totalRevenue": 50000,
    "totalDiscount": 5000,
    "successfulPayments": 45,
    "failedPayments": 3
  }
}
```

---

## Get Payment by ID

**GET** `/payments/:id` (Protected)

**Response Data:**
```json
{
  "payment": { /* full payment object with populated userId, eventId */ }
}
```

---

# 6. ENROLLMENTS

## List All Enrollments

**GET** `/enrollments` (Protected)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `sortBy` - "createdAt" | "updatedAt"
- `sortOrder` - "asc" | "desc"
- `status` - "ACTIVE" | "CANCELLED" | "REFUNDED"
- `eventId` - Filter by event

**Response Data:**
```json
{
  "enrollments": [
    {
      "_id": "ObjectId",
      "paymentId": "pay_xxx",
      "orderId": "order_xxx",
      "userId": {
        "_id": "ObjectId",
        "name": "User Name",
        "email": "user@example.com",
        "phone": "1234567890"
      },
      "eventId": {
        "_id": "ObjectId",
        "name": "Event Name",
        "startDate": "timestamp",
        "endDate": "timestamp",
        "mode": "OFFLINE",
        "city": "Mumbai"
      },
      "ticketCount": 3,
      "tierName": "Early Bird",
      "ticketPrice": 800,
      "tickets": {
        "1234567890": {
          "status": "ACTIVE",
          "isTicketScanned": false,
          "ticketScannedAt": null
        },
        "0987654321": {
          "status": "ACTIVE",
          "isTicketScanned": true,
          "ticketScannedAt": "timestamp"
        }
      },
      "createdAt": "timestamp"
    }
  ],
  "pagination": { ... }
}
```

---

## Get Enrollment by ID

**GET** `/enrollments/:id` (Protected)

**Response Data:**
```json
{
  "enrollment": { /* full enrollment with populated event, user, payment */ }
}
```

---

## Get Event Attendees

**GET** `/enrollments/event/:eventId` (Protected)

**Query Parameters:** Same as List All Enrollments.

**Response Data:**
```json
{
  "event": {
    "id": "ObjectId",
    "name": "Event Name",
    "startDate": "timestamp",
    "endDate": "timestamp"
  },
  "enrollments": [ /* enrollments for this event */ ],
  "pagination": { ... },
  "statistics": {
    "total": 50,
    "active": 45,
    "cancelled": 3,
    "refunded": 2
  }
}
```

---

## Cancel Enrollment

**POST** `/enrollments/:id/cancel` (Protected)

**Request Body (cancel specific ticket):**
```json
{
  "phone": "1234567890",
  "reason": "Customer requested cancellation"
}
```

**Request Body (cancel all tickets):**
```json
{
  "cancelAll": true,
  "reason": "Event cancelled"
}
```

**Response Data:**
```json
{
  "enrollment": { /* updated enrollment */ },
  "cancelledCount": 3
}
```

---

## Create Mock Enrollment (Testing)

**POST** `/enrollments/mock-enrollment` (Protected)

**Request Body:**
```json
{
  "eventId": "ObjectId",
  "phones": ["1234567890", "0987654321"],
  "tierName": "Early Bird"
}
```

**Response Data:**
```json
{
  "enrollment": { /* created enrollment */ },
  "isMock": true
}
```

---

# 7. TICKET VERIFICATION

## Verify Ticket (QR Scan)

**GET** `/tickets/verify?token=<jwt_token>` (Protected)

Used by event staff to scan QR codes.

**Response Data (valid, first scan):**
```json
{
  "isValid": true,
  "isAlreadyScanned": false,
  "scannedAt": "timestamp",
  "ticket": {
    "phone": "1234567890",
    "status": "ACTIVE"
  },
  "enrollment": {
    "id": "ObjectId",
    "user": {
      "name": "User Name",
      "email": "user@example.com",
      "phone": "1234567890"
    },
    "event": {
      "name": "Event Name",
      "startDate": "timestamp",
      "endDate": "timestamp",
      "location": "Mumbai"
    }
  }
}
```

**Response Data (already scanned):**
```json
{
  "isValid": true,
  "isAlreadyScanned": true,
  "scannedAt": "previous_timestamp",
  "ticket": { ... },
  "enrollment": { ... }
}
```

---

# 8. RAZORPAY INTEGRATION

## Create Payment Order

**POST** `/razorpay/create-order` (Public)

**Request Body (single ticket):**
```json
{
  "currency": "INR",
  "type": "EVENT",
  "eventId": "ObjectId",
  "priceTierId": "ObjectId",
  "metadata": {
    "callbackUrl": "https://yourapp.com/payment-success",
    "buyer": {
      "name": "Buyer Name",
      "email": "buyer@example.com",
      "phone": "+919876543210"
    }
  }
}
```

**Request Body (multiple tickets):**
```json
{
  "currency": "INR",
  "type": "EVENT",
  "eventId": "ObjectId",
  "priceTierId": "ObjectId",
  "metadata": {
    "callbackUrl": "https://yourapp.com/payment-success",
    "buyer": {
      "name": "Buyer Name",
      "email": "buyer@example.com",
      "phone": "+919876543210"
    },
    "others": [
      {
        "name": "Friend 1",
        "email": "friend1@example.com",
        "phone": "+919876543211"
      }
    ]
  }
}
```

**Response Data:**
```json
{
  "orderId": "order_MhXXXXXXXXXX",
  "amount": 1600,
  "perTicketPrice": 800,
  "totalTickets": 2,
  "currency": "INR",
  "paymentUrl": "https://rzp.io/i/aBcDeFg",
  "paymentLinkId": "plink_xxx",
  "status": "created",
  "createdAt": 1700000000,
  "gateway": {
    "name": "razorpay",
    "keyId": "rzp_xxx"
  }
}
```

---

## Get Payment Status

**GET** `/razorpay/status/:orderId` (Public)

Use for long-polling to check payment completion.

**Response Data:**
```json
{
  "orderId": "order_xxx",
  "paymentId": "pay_xxx",
  "status": "PENDING | SUCCESS | FAILED",
  "amount": 1600,
  "type": "EVENT",
  "purchaseDateTime": "timestamp",
  "failureReason": null,
  "event": {
    "name": "Event Name",
    "startDate": "timestamp",
    "endDate": "timestamp"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

# 9. CASH PAYMENT (Admin Panel Feature)

## Create Cash Partner

**POST** `/cash/partner` (Public - should be protected)

**Request Body:**
```json
{
  "name": "Partner Store Name",
  "phone": "+919876543210"
}
```

**Response Data:**
```json
{
  "_id": "ObjectId",
  "name": "Partner Store Name",
  "phone": "+919876543210",
  "partnerCode": "123456",
  "eventEnrollments": [],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## Create Cash Order

**POST** `/cash/order` (Public - requires partnerCode)

**Request Body:**
```json
{
  "partnerCode": "123456",
  "type": "EVENT",
  "eventId": "ObjectId",
  "priceTierId": "ObjectId",
  "metadata": {
    "buyer": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "phone": "+919876543210"
    },
    "others": [
      {
        "name": "Guest 1",
        "email": "guest1@example.com",
        "phone": "+919876543211"
      }
    ]
  }
}
```

**Response Data:**
```json
{
  "orderId": "123456_1732770678000",
  "paymentId": "CASH_123456_1732770678000",
  "totalAmount": 1600,
  "ticketCount": 2,
  "eventName": "Event Name",
  "eventId": "ObjectId",
  "enrollmentId": "ObjectId",
  "tierName": "Early Bird",
  "ticketHolders": ["customer@example.com", "guest1@example.com"]
}
```

---

# Data Models Reference

## Admin Fields
- `_id`, `name`, `email`, `phone`, `role`, `access[]`, `status`, `lastLogin`, `createdAt`, `updatedAt`

## Event Fields
- `_id`, `name`, `description`, `imageUrls[]`, `thumbnail{imageUrl, videoUrl}`, `isLive`, `mode`, `city`, `category`, `startDate`, `endDate`, `price`, `compareAtPrice`, `pricingTiers[]`, `availableSeats`, `ticketsSold`, `coupons[]`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

## Coupon Fields
- `_id`, `code`, `discountPercent`, `maxDiscountAmount`, `minPurchaseAmount`, `maxUsageLimit`, `usageCount`, `maxUsagePerUser`, `validFrom`, `validUntil`, `description`, `isActive`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

## Payment Fields
- `_id`, `orderId`, `paymentId`, `signature`, `userId`, `type`, `eventId`, `sessionId`, `amount`, `couponCode`, `discountAmount`, `finalAmount`, `status`, `purchaseDateTime`, `metadata`, `failureReason`, `createdAt`, `updatedAt`

## Enrollment Fields
- `_id`, `paymentId`, `orderId`, `userId`, `eventId`, `ticketCount`, `tierName`, `ticketPrice`, `tickets{phone: {status, cancelledAt, cancellationReason, isTicketScanned, ticketScannedAt, ticketScannedBy}}`, `createdAt`, `updatedAt`

## Cash Partner Fields
- `_id`, `name`, `phone`, `partnerCode`, `eventEnrollments[]`, `createdAt`, `updatedAt`

---

# Admin Panel Features Summary

## Login Page
- Email/password login
- Store tokens in localStorage/secure storage
- Refresh token on 401 errors

## Dashboard
- Quick stats (total events, enrollments, revenue)
- Recent payments
- Upcoming events

## Admin Management (Super Admin)
- List admins with search/filter
- Create new admin
- Edit admin (role, access, status)
- Deactivate/Delete admin

## Events Management
- List events with filters (category, mode, city, status, dates, price range)
- Create event (simple or multi-tier pricing)
- Edit event
- Soft delete / Restore / Permanent delete
- View ticket stats
- Trash bin for deleted events

## Coupons Management
- List coupons with filters
- Create coupon
- Edit coupon
- Toggle active status
- Soft delete / Restore / Permanent delete
- Trash bin for deleted coupons

## Payments
- View all payments with filters
- See payment details
- Filter by payment method (Razorpay/Cash)
- View statistics (revenue, discounts)

## Enrollments
- View all enrollments
- Filter by event, status
- View event attendees
- Cancel tickets (single or all)
- View ticket details (scanned status)

## Ticket Verification
- QR code scanner interface
- Display ticket validity
- Show attendee details
- Mark as scanned

## Cash Payments
- Create cash partners
- Process cash orders
- Select event and pricing tier
- Enter buyer and guest details
- Automatic ticket generation and email sending

## Profile Settings
- View profile
- Update name/email/phone
- Change password
