* [ ] 


# Service Integration API Documentation for Website

This documentation covers all APIs needed to integrate the complete service booking system into your website.

---

## Public APIs (No Authentication Required)

### 1. Browse All Services

**GET** `/api/app/services`

Fetch all active services with filtering and pagination.

**Query Parameters:**

* `page` - Page number (default: 1)
* `limit` - Items per page (default: 10, max: 100)
* `sortBy` - Sort field: name, price, displayOrder, createdAt, activeSubscriptionCount (default: displayOrder)
* `sortOrder` - asc or desc (default: asc)
* `category` - Filter by category: CONSULTATION, COACHING, THERAPY, WELLNESS, FITNESS, EDUCATION, OTHER
* `isFeatured` - Filter featured services: true or false
* `requiresApproval` - Filter by approval requirement: true or false
* `search` - Search in name and description

**Request:**

```
GET /api/app/services?page=1&limit=12&sortBy=displayOrder&sortOrder=asc
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Services fetched successfully",
  "data": {
    "services": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Premium Consultation",
        "description": "One-on-one consultation with our expert therapist. Get personalized advice and guidance tailored to your needs.",
        "shortDescription": "60-minute consultation session",
        "price": 2999,
        "compareAtPrice": 3999,
        "durationInDays": 30,
        "category": "CONSULTATION",
        "imageUrl": "https://example.com/consultation.jpg",
        "perks": [
          "Personalized advice",
          "Follow-up email",
          "Action plan document"
        ],
        "maxSubscriptions": null,
        "activeSubscriptionCount": 45,
        "totalSubscriptionCount": 120,
        "displayOrder": 1,
        "isFeatured": true,
        "isActive": true,
        "requiresApproval": false,
        "metadata": {},
        "createdAt": "2025-01-01T10:00:00.000Z",
        "updatedAt": "2025-01-08T15:30:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439055",
        "name": "Elite Coaching Program",
        "description": "6-month comprehensive coaching program with weekly sessions and personalized guidance.",
        "shortDescription": "Transform your life with expert coaching",
        "price": 49999,
        "compareAtPrice": 69999,
        "durationInDays": 180,
        "category": "COACHING",
        "imageUrl": "https://example.com/coaching.jpg",
        "perks": [
          "Weekly 1-hour sessions",
          "24/7 WhatsApp support",
          "Personalized action plan",
          "Progress tracking"
        ],
        "maxSubscriptions": 10,
        "activeSubscriptionCount": 7,
        "totalSubscriptionCount": 15,
        "displayOrder": 2,
        "isFeatured": true,
        "isActive": true,
        "requiresApproval": true,
        "metadata": {},
        "createdAt": "2025-01-01T10:00:00.000Z",
        "updatedAt": "2025-01-08T15:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 15,
      "limit": 12,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Get Featured Services

**GET** `/api/app/services?isFeatured=true&limit=6`

Fetch only featured services for homepage display.

**Request:**

```
GET /api/app/services?isFeatured=true&limit=6&sortBy=displayOrder&sortOrder=asc
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Services fetched successfully",
  "data": {
    "services": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Premium Consultation",
        "shortDescription": "60-minute consultation session",
        "price": 2999,
        "compareAtPrice": 3999,
        "category": "CONSULTATION",
        "imageUrl": "https://example.com/consultation.jpg",
        "isFeatured": true,
        "requiresApproval": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 6,
      "limit": 6
    }
  }
}
```

### 3. Get Services by Category

**GET** `/api/app/services?category=CONSULTATION`

Fetch services filtered by category.

**Request:**

```
GET /api/app/services?category=CONSULTATION&page=1&limit=12
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Services fetched successfully",
  "data": {
    "services": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Premium Consultation",
        "description": "One-on-one consultation with expert",
        "price": 2999,
        "category": "CONSULTATION",
        "requiresApproval": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 3,
      "limit": 12
    }
  }
}
```

### 4. Search Services

**GET** `/api/app/services?search=consultation`

Search services by name or description.

**Request:**

```
GET /api/app/services?search=consultation&page=1&limit=12
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Services fetched successfully",
  "data": {
    "services": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Premium Consultation",
        "description": "One-on-one consultation with expert",
        "price": 2999,
        "requiresApproval": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 2,
      "limit": 12
    }
  }
}
```

### 5. Get Single Service Details

**GET** `/api/app/services/:id`

Fetch complete details of a specific service for service detail page.

**Request:**

```
GET /api/app/services/507f1f77bcf86cd799439011
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Service fetched successfully",
  "data": {
    "service": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Premium Consultation",
      "description": "One-on-one consultation with our expert therapist. Get personalized advice and guidance tailored to your needs. Our experienced professionals will help you navigate challenges and develop strategies for success.",
      "shortDescription": "60-minute consultation session",
      "price": 2999,
      "compareAtPrice": 3999,
      "durationInDays": 30,
      "category": "CONSULTATION",
      "imageUrl": "https://example.com/consultation.jpg",
      "perks": [
        "Personalized advice based on your unique situation",
        "Detailed follow-up email with action items",
        "Comprehensive action plan document",
        "30-day access to resources"
      ],
      "maxSubscriptions": null,
      "activeSubscriptionCount": 45,
      "totalSubscriptionCount": 120,
      "displayOrder": 1,
      "isFeatured": true,
      "isActive": true,
      "requiresApproval": false,
      "metadata": {
        "sessionDuration": "60 minutes",
        "deliveryMode": "Video Call",
        "languagesSupported": ["English", "Hindi"]
      },
      "createdAt": "2025-01-01T10:00:00.000Z",
      "updatedAt": "2025-01-08T15:30:00.000Z"
    }
  }
}
```

**Error Response (404):**

```json
{
  "status": 404,
  "message": "Service not found",
  "error": null,
  "data": {}
}
```

---

## Flow 1: Direct Purchase (No Approval Required)

### 6. Create Direct Purchase

**POST** `/api/app/services/purchase`

Create payment link for services with `requiresApproval: false`. User can purchase immediately.

**Request:**

```
POST /api/app/services/purchase
Headers:
  Content-Type: application/json

Body:
{
  "phone": "9876543210",
  "customerName": "Rajesh Kumar",
  "serviceIds": ["507f1f77bcf86cd799439011"]
}
```

**Response (201):**

```json
{
  "status": 201,
  "message": "Payment link created successfully",
  "data": {
    "serviceOrder": {
      "_id": "507f1f77bcf86cd799439022",
      "orderId": "SVC_LK3J5H8M_A1B2C3D4",
      "services": [
        {
          "serviceId": "507f1f77bcf86cd799439011",
          "serviceName": "Premium Consultation",
          "price": 2999,
          "durationInDays": 30
        }
      ],
      "totalAmount": 2999,
      "expiresAt": "2025-01-10T15:30:00.000Z"
    },
    "paymentLink": "https://rzp.io/i/abc123xyz"
  }
}
```

**Error Response (400 - Service requires approval):**

```json
{
  "status": 400,
  "message": "One or more services not found, inactive, or require admin approval",
  "error": null,
  "data": {}
}
```

**Error Response (400 - Slots full):**

```json
{
  "status": 400,
  "message": "Service \"Premium Consultation\" has reached maximum subscriptions",
  "error": null,
  "data": {}
}
```

### 7. Purchase Multiple Services

**POST** `/api/app/services/purchase`

Create payment link for multiple services at once.

**Request:**

```
POST /api/app/services/purchase
Headers:
  Content-Type: application/json

Body:
{
  "phone": "9876543210",
  "customerName": "Rajesh Kumar",
  "serviceIds": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response (201):**

```json
{
  "status": 201,
  "message": "Payment link created successfully",
  "data": {
    "serviceOrder": {
      "_id": "507f1f77bcf86cd799439022",
      "orderId": "SVC_LK3J5H8M_A1B2C3D4",
      "services": [
        {
          "serviceId": "507f1f77bcf86cd799439011",
          "serviceName": "Premium Consultation",
          "price": 2999,
          "durationInDays": 30
        },
        {
          "serviceId": "507f1f77bcf86cd799439012",
          "serviceName": "Wellness Package",
          "price": 4999,
          "durationInDays": 60
        },
        {
          "serviceId": "507f1f77bcf86cd799439013",
          "serviceName": "Fitness Plan",
          "price": 1999,
          "durationInDays": 30
        }
      ],
      "totalAmount": 9997,
      "expiresAt": "2025-01-10T15:30:00.000Z"
    },
    "paymentLink": "https://rzp.io/i/abc123xyz"
  }
}
```

---

## Flow 2: Request-Based Purchase (Approval Required)

### 8. Submit Service Request

**POST** `/api/app/services/requests`

Submit request for services with `requiresApproval: true`. Admin will review and send payment link.

**Request:**

```
POST /api/app/services/requests
Headers:
  Content-Type: application/json

Body:
{
  "phone": "9876543210",
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "serviceIds": ["507f1f77bcf86cd799439055"],
  "userNote": "I am interested in the 6-month coaching program. I have specific goals around career transition and would like personalized guidance. Available for sessions on weekends."
}
```

**Response (201):**

```json
{
  "status": 201,
  "message": "Service request submitted successfully",
  "data": {
    "serviceRequest": {
      "_id": "507f1f77bcf86cd799439066",
      "phone": "9876543210",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "services": [
        {
          "serviceId": "507f1f77bcf86cd799439055",
          "serviceName": "Elite Coaching Program",
          "price": 49999
        }
      ],
      "totalAmount": 49999,
      "status": "PENDING",
      "userExists": true,
      "userId": "507f1f77bcf86cd799439044",
      "userNote": "I am interested in the 6-month coaching program. I have specific goals around career transition and would like personalized guidance. Available for sessions on weekends.",
      "reviewedBy": null,
      "reviewedAt": null,
      "rejectionReason": null,
      "serviceOrderId": null,
      "adminNotes": null,
      "createdAt": "2025-01-09T10:00:00.000Z",
      "updatedAt": "2025-01-09T10:00:00.000Z"
    }
  }
}
```

### 9. Submit Request for Multiple Services

**POST** `/api/app/services/requests`

Request multiple approval-required services together.

**Request:**

```
POST /api/app/services/requests
Headers:
  Content-Type: application/json

Body:
{
  "phone": "9876543210",
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "serviceIds": [
    "507f1f77bcf86cd799439055",
    "507f1f77bcf86cd799439056"
  ],
  "userNote": "Interested in both coaching and therapy programs for comprehensive support."
}
```

**Response (201):**

```json
{
  "status": 201,
  "message": "Service request submitted successfully",
  "data": {
    "serviceRequest": {
      "_id": "507f1f77bcf86cd799439066",
      "phone": "9876543210",
      "name": "Rajesh Kumar",
      "email": "rajesh@example.com",
      "services": [
        {
          "serviceId": "507f1f77bcf86cd799439055",
          "serviceName": "Elite Coaching Program",
          "price": 49999
        },
        {
          "serviceId": "507f1f77bcf86cd799439056",
          "serviceName": "Therapy Sessions Package",
          "price": 29999
        }
      ],
      "totalAmount": 79998,
      "status": "PENDING",
      "userNote": "Interested in both coaching and therapy programs for comprehensive support.",
      "createdAt": "2025-01-09T10:00:00.000Z"
    }
  }
}
```

### 10. Get User's Service Requests

**GET** `/api/app/services/requests?phone=9876543210`

Check status of submitted service requests.

**Request:**

```
GET /api/app/services/requests?phone=9876543210
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Service requests fetched successfully",
  "data": {
    "serviceRequests": [
      {
        "_id": "507f1f77bcf86cd799439066",
        "phone": "9876543210",
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "services": [
          {
            "serviceId": {
              "_id": "507f1f77bcf86cd799439055",
              "name": "Elite Coaching Program",
              "imageUrl": "https://example.com/coaching.jpg",
              "category": "COACHING"
            },
            "serviceName": "Elite Coaching Program",
            "price": 49999
          }
        ],
        "totalAmount": 49999,
        "status": "APPROVED",
        "userExists": true,
        "userId": "507f1f77bcf86cd799439044",
        "userNote": "I am interested in the 6-month coaching program.",
        "reviewedBy": "507f1f77bcf86cd799439077",
        "reviewedAt": "2025-01-09T11:00:00.000Z",
        "rejectionReason": null,
        "serviceOrderId": "507f1f77bcf86cd799439088",
        "adminNotes": "Approved for enrollment.",
        "createdAt": "2025-01-09T10:00:00.000Z",
        "updatedAt": "2025-01-09T11:00:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439067",
        "phone": "9876543210",
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "services": [
          {
            "serviceId": {
              "_id": "507f1f77bcf86cd799439056",
              "name": "Therapy Sessions Package",
              "imageUrl": "https://example.com/therapy.jpg",
              "category": "THERAPY"
            },
            "serviceName": "Therapy Sessions Package",
            "price": 29999
          }
        ],
        "totalAmount": 29999,
        "status": "PENDING",
        "userNote": "Need therapy sessions for anxiety management.",
        "reviewedBy": null,
        "reviewedAt": null,
        "rejectionReason": null,
        "serviceOrderId": null,
        "createdAt": "2025-01-09T14:00:00.000Z",
        "updatedAt": "2025-01-09T14:00:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439068",
        "phone": "9876543210",
        "name": "Rajesh Kumar",
        "email": "rajesh@example.com",
        "services": [
          {
            "serviceId": {
              "_id": "507f1f77bcf86cd799439057",
              "name": "VIP Wellness Package",
              "imageUrl": "https://example.com/wellness.jpg",
              "category": "WELLNESS"
            },
            "serviceName": "VIP Wellness Package",
            "price": 99999
          }
        ],
        "totalAmount": 99999,
        "status": "REJECTED",
        "userNote": "Want comprehensive wellness support.",
        "reviewedBy": "507f1f77bcf86cd799439077",
        "reviewedAt": "2025-01-09T12:00:00.000Z",
        "rejectionReason": "This program is currently full. We will notify you when new slots open in February.",
        "serviceOrderId": null,
        "createdAt": "2025-01-09T11:30:00.000Z",
        "updatedAt": "2025-01-09T12:00:00.000Z"
      }
    ]
  }
}
```

---

## User Subscriptions

### 11. Get Active Subscriptions by Phone

**GET** `/api/app/services/subscriptions?phone=9876543210`

View all active subscriptions for a user.

**Request:**

```
GET /api/app/services/subscriptions?phone=9876543210
Headers:
  Content-Type: application/json
```

**Response:**

```json
{
  "status": 200,
  "message": "Subscriptions fetched successfully",
  "data": {
    "subscriptions": [
      {
        "_id": "507f1f77bcf86cd799439033",
        "phone": "9876543210",
        "userId": "507f1f77bcf86cd799439044",
        "serviceId": {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Premium Consultation",
          "description": "One-on-one consultation with expert",
          "price": 2999,
          "durationInDays": 30,
          "category": "CONSULTATION",
          "imageUrl": "https://example.com/consultation.jpg",
          "perks": ["Personalized advice", "Follow-up email"],
          "isActive": true
        },
        "serviceOrderId": "507f1f77bcf86cd799439022",
        "status": "ACTIVE",
        "startDate": "2025-01-09T10:00:00.000Z",
        "endDate": "2025-02-08T10:00:00.000Z",
        "amountPaid": 2999,
        "durationInDays": 30,
        "activatedAt": "2025-01-09T10:00:00.000Z",
        "cancelledAt": null,
        "cancellationReason": null,
        "metadata": {},
        "createdAt": "2025-01-09T10:00:00.000Z",
        "updatedAt": "2025-01-09T10:00:00.000Z"
      },
      {
        "_id": "507f1f77bcf86cd799439034",
        "phone": "9876543210",
        "userId": "507f1f77bcf86cd799439044",
        "serviceId": {
          "_id": "507f1f77bcf86cd799439055",
          "name": "Elite Coaching Program",
          "description": "6-month coaching program",
          "price": 49999,
          "durationInDays": 180,
          "category": "COACHING",
          "imageUrl": "https://example.com/coaching.jpg",
          "perks": ["Weekly sessions", "24/7 support"],
          "isActive": true
        },
        "serviceOrderId": "507f1f77bcf86cd799439088",
        "status": "ACTIVE",
        "startDate": "2025-01-09T11:00:00.000Z",
        "endDate": "2025-07-08T11:00:00.000Z",
        "amountPaid": 49999,
        "durationInDays": 180,
        "activatedAt": "2025-01-09T11:00:00.000Z",
        "cancelledAt": null,
        "cancellationReason": null,
        "metadata": {},
        "createdAt": "2025-01-09T11:00:00.000Z",
        "updatedAt": "2025-01-09T11:00:00.000Z"
      }
    ]
  }
}
```

**Response (Empty subscriptions):**

```json
{
  "status": 200,
  "message": "Subscriptions fetched successfully",
  "data": {
    "subscriptions": []
  }
}
```

---

## Complete Website Integration Flow

### Scenario 1: Homepage Service Display

```javascript
// Fetch featured services for homepage
GET /api/app/services?isFeatured=true&limit=6&sortBy=displayOrder&sortOrder=asc
```

### Scenario 2: Services Listing Page

```javascript
// Show all services with filters
GET /api/app/services?page=1&limit=12&sortBy=price&sortOrder=asc

// User applies category filter
GET /api/app/services?category=CONSULTATION&page=1&limit=12

// User searches
GET /api/app/services?search=coaching&page=1&limit=12
```

### Scenario 3: Service Detail Page

```javascript
// Step 1: Get service details
GET /api/app/services/507f1f77bcf86cd799439011

// Step 2: Check if requiresApproval is true or false
// Display appropriate button: "Buy Now" or "Request Access"
```

### Scenario 4: Direct Purchase Flow

```javascript
// User clicks "Buy Now" on service with requiresApproval: false
// Step 1: Collect phone and name in form
// Step 2: Create purchase
POST /api/app/services/purchase
Body: {
  "phone": "9876543210",
  "customerName": "Rajesh Kumar",
  "serviceIds": ["507f1f77bcf86cd799439011"]
}

// Step 3: Redirect user to paymentLink from response
window.location.href = response.data.paymentLink;
```

### Scenario 5: Request-Based Purchase Flow

```javascript
// User clicks "Request Access" on service with requiresApproval: true
// Step 1: Collect phone, name, email, and message in form
// Step 2: Submit request
POST /api/app/services/requests
Body: {
  "phone": "9876543210",
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "serviceIds": ["507f1f77bcf86cd799439055"],
  "userNote": "I am interested in this program..."
}

// Step 3: Show success message
// "Your request has been submitted. We'll review and send you a payment link via WhatsApp within 24 hours."

// Step 4: User can check status later
GET /api/app/services/requests?phone=9876543210
```

### Scenario 6: My Subscriptions Page

```javascript
// Show user's active subscriptions
GET /api/app/services/subscriptions?phone=9876543210

// Display subscription cards with:
// - Service name and details
// - Start date and end date
// - Days remaining
// - Status
```

### Scenario 7: Shopping Cart (Multiple Services)

```javascript
// User adds multiple services to cart
// User proceeds to checkout

// For all direct-purchase services:
POST /api/app/services/purchase
Body: {
  "phone": "9876543210",
  "customerName": "Rajesh Kumar",
  "serviceIds": ["507f...", "507f...", "507f..."]
}

// For services requiring approval:
POST /api/app/services/requests
Body: {
  "phone": "9876543210",
  "name": "Rajesh Kumar",
  "email": "rajesh@example.com",
  "serviceIds": ["507f..."],
  "userNote": "Interested in these services..."
}
```

---

## Error Handling

### Common Error Responses

**400 Bad Request - Invalid phone:**

```json
{
  "status": 400,
  "message": "Validation failed",
  "error": [
    {
      "field": "phone",
      "message": "Phone number must be exactly 10 digits"
    }
  ],
  "data": {}
}
```

**400 Bad Request - Empty service IDs:**

```json
{
  "status": 400,
  "message": "Validation failed",
  "error": [
    {
      "field": "serviceIds",
      "message": "At least one service is required"
    }
  ],
  "data": {}
}
```

**404 Not Found:**

```json
{
  "status": 404,
  "message": "Service not found",
  "error": null,
  "data": {}
}
```

**500 Internal Server Error:**

```json
{
  "status": 500,
  "message": "Failed to create purchase",
  "error": "Internal server error",
  "data": {}
}
```

---

## UI/UX Recommendations

### Service Card Display

Show on each service card:

* Service image
* Name and short description
* Price (with compareAtPrice if available)
* Category badge
* Featured badge (if isFeatured)
* Duration (if durationInDays exists)
* Available slots indicator (if maxSubscriptions exists)
* Button text based on requiresApproval:
  * `false` → "Buy Now" or "Add to Cart"
  * `true` → "Request Access" or "Apply Now"

### Service Detail Page

Display:

* All service information
* Full description
* List of perks
* Duration and pricing
* Availability status
* Clear CTA button based on requiresApproval
* Form for phone/email collection

### Request Status Display

Status badge colors:

* `PENDING` → Yellow/Orange (In Review)
* `APPROVED` → Green (Approved - Payment link sent)
* `REJECTED` → Red (Rejected - Show reason)

### Payment Link Handling

After successful purchase API call:

* Immediately redirect to Razorpay payment link
* Set callback URL to your success page
* Payment link expires in 24 hours

---

## Website Integration Checklist

1. Services listing page with filters
2. Service detail page
3. Shopping cart for multiple services
4. Phone/email collection form
5. Request submission form with message field
6. My subscriptions page
7. Request status tracking page
8. Payment success callback page
9. Error handling and validation messages
10. Responsive design for mobile users
