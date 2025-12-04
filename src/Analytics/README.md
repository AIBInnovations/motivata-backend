# Analytics System Documentation

## Overview

The Analytics system provides comprehensive statistics and metrics for the admin dashboard. It tracks communications, user activity, payments, events, and more with detailed time-based breakdowns.

## Features

### 1. Communication Tracking
- **WhatsApp Messages**: Automatic logging of all WhatsApp messages (tickets, vouchers, redemption links)
- **Email Messages**: Automatic logging of all email communications
- **Status Tracking**: SUCCESS, FAILED, PENDING statuses for all communications
- **Category Tracking**: TICKET, VOUCHER, REDEMPTION_LINK, ENROLLMENT_CONFIRMATION, etc.

### 2. Comprehensive Statistics
- User and Admin statistics
- Event enrollment metrics
- Cash ticket tracking
- Payment and revenue analytics
- Event-wise performance
- Admin-wise performance
- Coupon and voucher usage

### 3. Time-Based Breakdowns
All applicable metrics include breakdowns for:
- Lifetime
- This month
- Last month
- Last 3 months
- Last 6 months
- Last 12 months

---

## API Endpoints

### 1. Get Dashboard Statistics

**Endpoint**: `GET /api/web/analytics/dashboard`

**Authentication**: Required (Admin only)

**Response Structure**:

```json
{
  "status": 200,
  "message": "Dashboard statistics fetched successfully",
  "error": null,
  "data": {
    "communications": {
      "lifetime": {
        "email": {
          "total": 1250,
          "successful": 1180,
          "failed": 70,
          "successRate": "94.40%"
        },
        "whatsapp": {
          "total": 3450,
          "successful": 3390,
          "failed": 60,
          "successRate": "98.26%"
        },
        "totalCommunications": 4700
      },
      "thisMonth": { "..." },
      "lastMonth": { "..." },
      "last3Months": { "..." },
      "last6Months": { "..." },
      "last12Months": { "..." }
    },
    "users": {
      "total": 5420,
      "thisMonth": 320,
      "lastMonth": 280,
      "growth": "14.29%"
    },
    "admins": {
      "total": 12,
      "active": 10,
      "inactive": 2,
      "byRole": {
        "SUPER_ADMIN": 2,
        "ADMIN": 5,
        "MANAGEMENT_STAFF": 5
      }
    },
    "cashTickets": {
      "lifetime": {
        "totalMinted": 850,
        "redeemed": 720,
        "pending": 130
      },
      "thisMonth": { "..." },
      "lastMonth": { "..." },
      "last3Months": { "..." },
      "last6Months": { "..." },
      "last12Months": { "..." }
    },
    "enrollments": {
      "lifetime": {
        "onlineEnrollments": 2340,
        "onlineTickets": 3680,
        "cashEnrollments": 720,
        "totalEnrollments": 3060
      },
      "thisMonth": { "..." },
      "lastMonth": { "..." },
      "last3Months": { "..." },
      "last6Months": { "..." },
      "last12Months": { "..." }
    },
    "payments": {
      "lifetime": {
        "totalPayments": 2340,
        "totalRevenue": 8750000,
        "averageOrderValue": 3739.32,
        "totalDiscount": 425000,
        "paymentMethods": [
          {
            "_id": "EVENT",
            "count": 2300,
            "revenue": 8600000
          },
          {
            "_id": "SESSION",
            "count": 40,
            "revenue": 150000
          }
        ],
        "topCoupons": [
          {
            "_id": "FIRST50",
            "usageCount": 450,
            "totalDiscount": 225000
          }
        ]
      },
      "thisMonth": { "..." },
      "lastMonth": { "..." },
      "last3Months": { "..." },
      "last6Months": { "..." },
      "last12Months": { "..." }
    },
    "events": {
      "total": 45,
      "live": 12,
      "upcoming": 8,
      "past": 33,
      "byCategory": {
        "TECHNOLOGY": 15,
        "ENTERTAINMENT": 10,
        "EDUCATION": 8,
        "BUSINESS": 7,
        "OTHER": 5
      },
      "byMode": {
        "OFFLINE": 25,
        "ONLINE": 12,
        "HYBRID": 8
      }
    },
    "eventStats": {
      "lifetime": [
        {
          "eventId": "507f1f77bcf86cd799439011",
          "eventName": "Tech Summit 2025",
          "eventDate": "2025-03-15T00:00:00.000Z",
          "eventCategory": "TECHNOLOGY",
          "eventMode": "OFFLINE",
          "eventCity": "Mumbai",
          "onlineTickets": 450,
          "onlineRevenue": 1350000,
          "onlineOrders": 380,
          "offlineTickets": 120,
          "offlineRevenue": 360000,
          "offlineOrders": 95,
          "totalTickets": 570,
          "totalRevenue": 1710000,
          "totalOrders": 475
        }
      ],
      "thisMonth": [ "..." ]
    },
    "adminPerformance": [
      {
        "adminId": "507f1f77bcf86cd799439012",
        "adminName": "John Doe",
        "adminUsername": "john.admin",
        "adminRole": "ADMIN",
        "totalTickets": 450,
        "totalRecords": 380,
        "redeemedRecords": 320,
        "pendingRecords": 60,
        "totalRevenue": 1350000
      }
    ],
    "coupons": {
      "total": 25,
      "active": 18,
      "topCoupons": [
        {
          "code": "FIRST50",
          "discountValue": 50,
          "discountType": "PERCENTAGE",
          "usageCount": 450,
          "usageLimit": 1000
        }
      ]
    },
    "vouchers": {
      "total": 35,
      "active": 28,
      "totalUsage": 520,
      "totalClaimedPhones": 1850
    },
    "topPerformingEvents": [
      {
        "eventId": "507f1f77bcf86cd799439011",
        "eventName": "Tech Summit 2025",
        "totalRevenue": 1710000,
        "totalTickets": 570,
        "..."
      }
    ],
    "recentActivity": {
      "last24Hours": {
        "payments": 45,
        "enrollments": 52,
        "cashTickets": 18
      }
    },
    "generatedAt": "2025-12-03T10:30:00.000Z"
  }
}
```

---

### 2. Get Communication Logs

**Endpoint**: `GET /api/web/analytics/communications`

**Authentication**: Required (Admin only)

**Query Parameters**:
- `type` (optional): Filter by communication type (EMAIL, WHATSAPP, SMS)
- `category` (optional): Filter by category (TICKET, VOUCHER, REDEMPTION_LINK, etc.)
- `status` (optional): Filter by status (SUCCESS, FAILED, PENDING)
- `startDate` (optional): Start date filter (ISO format: 2025-01-01)
- `endDate` (optional): End date filter (ISO format: 2025-12-31)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Example Request**:
```
GET /api/web/analytics/communications?type=WHATSAPP&status=SUCCESS&page=1&limit=50
```

**Response Structure**:

```json
{
  "status": 200,
  "message": "Communication logs fetched successfully",
  "error": null,
  "data": {
    "logs": [
      {
        "_id": "507f1f77bcf86cd799439013",
        "type": "WHATSAPP",
        "category": "TICKET",
        "recipient": "919876543210",
        "recipientName": "John Doe",
        "status": "SUCCESS",
        "eventId": {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Tech Summit 2025",
          "startDate": "2025-03-15T00:00:00.000Z"
        },
        "orderId": "order_MhXXXXXXXXXX",
        "userId": {
          "_id": "507f1f77bcf86cd799439014",
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "9876543210"
        },
        "enrollmentId": "507f1f77bcf86cd799439015",
        "messageId": "wamid.ABCDefgh123456",
        "subject": null,
        "templateName": "wp_ticket",
        "errorMessage": null,
        "metadata": {
          "eventName": "Tech Summit 2025",
          "qrCodeUrl": "https://cloudinary.com/..."
        },
        "createdAt": "2025-12-03T10:15:00.000Z",
        "updatedAt": "2025-12-03T10:15:05.000Z"
      }
    ],
    "pagination": {
      "total": 3450,
      "page": 1,
      "limit": 50,
      "totalPages": 69
    }
  }
}
```

---

## Database Schema

### CommunicationLog Schema

```javascript
{
  type: String,              // EMAIL, WHATSAPP, SMS, NOTIFICATION, OTHER
  category: String,          // TICKET, VOUCHER, REDEMPTION_LINK, etc.
  recipient: String,         // Phone number or email
  recipientName: String,     // Recipient name (optional)
  status: String,            // SUCCESS, FAILED, PENDING
  eventId: ObjectId,         // Reference to Event (optional)
  orderId: String,           // Order/Payment ID (optional)
  userId: ObjectId,          // Reference to User (optional)
  enrollmentId: ObjectId,    // Reference to EventEnrollment (optional)
  voucherId: ObjectId,       // Reference to Voucher (optional)
  messageId: String,         // Provider message ID (optional)
  subject: String,           // Email subject (optional)
  templateName: String,      // Template used (optional)
  errorMessage: String,      // Error message if failed (optional)
  metadata: Mixed,           // Additional data (optional)
  isDeleted: Boolean,        // Soft delete flag
  deletedAt: Date,           // Deletion timestamp
  createdAt: Date,           // Auto-generated
  updatedAt: Date            // Auto-generated
}
```

---

## Integration Points

### Email Utility Integration

The email utility automatically logs all email communications:

```javascript
import { sendEmail } from './utils/email.util.js';

await sendEmail({
  to: 'user@example.com',
  subject: 'Your Event Ticket',
  html: htmlContent,
  text: textContent,
  attachments: [qrCodeBuffer],
  // Logging parameters (optional)
  category: 'TICKET',
  eventId: event._id,
  orderId: payment.orderId,
  userId: user._id,
  enrollmentId: enrollment._id
});
```

### WhatsApp Utility Integration

The WhatsApp utility automatically logs all WhatsApp messages:

```javascript
import { sendTicketWhatsApp } from './utils/whatsapp.util.js';

await sendTicketWhatsApp({
  phone: '9876543210',
  name: 'John Doe',
  email: 'john@example.com',
  eventName: 'Tech Summit 2025',
  qrCodeUrl: 'https://cloudinary.com/...',
  // Logging parameters (optional)
  eventId: event._id,
  orderId: payment.orderId,
  userId: user._id,
  enrollmentId: enrollment._id
});
```

---

## Analytics Metrics Explained

### 1. Communication Statistics
- **Total**: Total number of communications sent
- **Successful**: Communications successfully delivered
- **Failed**: Communications that failed to deliver
- **Success Rate**: Percentage of successful deliveries

### 2. User Statistics
- **Total**: Total registered users (excluding deleted)
- **This Month**: New users registered this month
- **Last Month**: New users registered last month
- **Growth**: Percentage growth from last month to this month

### 3. Admin Statistics
- **Total**: Total admin accounts
- **Active**: Admins with ACTIVATED status
- **Inactive**: Admins with DEACTIVATED status
- **By Role**: Breakdown by role (SUPER_ADMIN, ADMIN, MANAGEMENT_STAFF)

### 4. Cash Ticket Statistics
- **Total Minted**: Total offline cash tickets generated
- **Redeemed**: Cash tickets that have been redeemed
- **Pending**: Cash tickets waiting to be redeemed

### 5. Enrollment Statistics
- **Online Enrollments**: Enrollments via Razorpay payments
- **Online Tickets**: Total tickets from online enrollments
- **Cash Enrollments**: Enrollments from redeemed cash tickets
- **Total Enrollments**: Sum of online and cash enrollments

### 6. Payment Statistics
- **Total Payments**: Number of successful payments
- **Total Revenue**: Sum of all successful payment amounts
- **Average Order Value**: Average payment amount
- **Total Discount**: Sum of all discounts applied
- **Payment Methods**: Breakdown by payment type (EVENT, SESSION, etc.)
- **Top Coupons**: Most used coupon codes with usage stats

### 7. Event Statistics
- **Total**: Total events (excluding deleted)
- **Live**: Events currently live
- **Upcoming**: Live events with future start dates
- **Past**: Events that have ended
- **By Category**: Event count by category
- **By Mode**: Event count by mode (ONLINE, OFFLINE, HYBRID)

### 8. Event-wise Performance
For each event:
- Online vs Offline ticket sales
- Revenue from online vs offline sources
- Total tickets sold and total revenue
- Event details (name, date, category, mode, city)

### 9. Admin Performance
For each admin:
- Total cash tickets minted
- Total records created
- Redeemed vs pending records
- Total revenue generated

### 10. Coupon & Voucher Statistics
- **Coupons**: Total, active, and top performing coupons
- **Vouchers**: Total, active, usage count, and claimed phones

---

## Usage Examples

### Fetch Dashboard Statistics

```javascript
// Frontend API call
const response = await fetch('/api/web/analytics/dashboard', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const { data } = await response.json();

// Access specific metrics
console.log('Total WhatsApp messages:', data.communications.lifetime.whatsapp.total);
console.log('This month revenue:', data.payments.thisMonth.totalRevenue);
console.log('Top performing event:', data.topPerformingEvents[0].eventName);
```

### Fetch Communication Logs with Filters

```javascript
// Get failed WhatsApp messages from last week
const params = new URLSearchParams({
  type: 'WHATSAPP',
  status: 'FAILED',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date().toISOString(),
  page: 1,
  limit: 50
});

const response = await fetch(`/api/web/analytics/communications?${params}`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const { data } = await response.json();
console.log('Failed messages:', data.logs);
console.log('Total failed:', data.pagination.total);
```

---

## Performance Considerations

### Indexes
The CommunicationLog schema includes the following indexes for optimal query performance:
- `{ type: 1, status: 1, createdAt: -1 }`
- `{ category: 1, createdAt: -1 }`
- `{ eventId: 1, type: 1 }`
- `{ createdAt: -1 }`
- Individual indexes on: `recipient`, `orderId`, `userId`, `enrollmentId`, `voucherId`

### Caching Recommendations
For production environments, consider caching dashboard statistics:
- Cache lifetime statistics (rarely change)
- Cache time-based stats with TTL (e.g., 5 minutes for "this month" stats)
- Invalidate cache on new communications/payments

### Query Optimization
- Dashboard endpoint uses aggregation pipelines for efficiency
- Time-based queries use indexed `createdAt` field
- Pagination limits communication log queries

---

## Future Enhancements

Potential additions to the analytics system:
1. **Real-time Dashboard**: WebSocket integration for live updates
2. **Export Functionality**: CSV/Excel export of statistics
3. **Custom Date Ranges**: User-defined date range filters
4. **Comparison Views**: Compare metrics between time periods
5. **Event Analytics**: Detailed per-event analytics page
6. **Revenue Forecasting**: Predictive analytics based on historical data
7. **Communication Templates**: Track performance by template
8. **Geographic Analytics**: Location-based statistics
9. **User Behavior Analytics**: Track user engagement patterns
10. **A/B Testing**: Track communication effectiveness

---

## Troubleshooting

### Communication logs not appearing
- Check that email/WhatsApp utilities are properly updated
- Verify CommunicationLog schema is imported correctly
- Check for errors in console logs during communication sending

### Incorrect statistics
- Verify date filters are correctly applied
- Check for soft-deleted records being included
- Ensure all related schemas have proper indexes

### Performance issues
- Monitor database query execution times
- Consider implementing caching
- Review index usage with MongoDB explain plans

---

## Support

For issues or questions about the analytics system, contact the development team or refer to the main project documentation.
