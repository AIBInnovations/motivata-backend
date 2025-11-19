# Motivata Admin Panel - Frontend Requirements Report

## Executive Summary
The Motivata admin panel is a comprehensive event management system with two-tier admin hierarchy (Super Admin & Management Staff), supporting full event lifecycle management, payment processing, coupon management, and user management.

---

## 1. Admin Roles & Access Control

### Role Hierarchy
| Role | Access Level | Key Permissions |
|------|-------------|-----------------|
| **SUPER_ADMIN** | Full System Access | All CRUD operations, Admin management, Permanent deletions, System configuration |
| **MANAGEMENT_STAFF** | Limited Access | Event management, Coupon management, View reports, QR verification (based on assigned access array) |

### Admin Status
- **ACTIVATED**: Full access to assigned features
- **DEACTIVATED**: No system access (soft locked)

---

## 2. Frontend Pages & Structure

### 2.1 Authentication Pages (Public)

#### Login Page (`/admin/login`)
**Purpose**: Admin authentication entry point
**Features**:
- Email & password login
- Remember me option
- Forgot password link
- JWT token storage (access + refresh tokens)

**API**: `POST /api/web/auth/login`

#### Register Page (`/admin/register`) - CONDITIONAL
**Purpose**: First-time super admin registration
**Visibility**: Only shown when no admins exist in system
**Fields**: Name, Email, Phone, Password, Confirm Password
**API**: `POST /api/web/auth/register`

---

### 2.2 Dashboard & Home

#### Main Dashboard (`/admin/dashboard`)
**Purpose**: Central hub with key metrics and quick actions

**Metrics Cards**:
1. **Total Events** (Live/Draft/Expired counts)
2. **Total Revenue** (With time period selector)
3. **Total Enrollments** (This month vs last month)
4. **Active Coupons** (Usage statistics)
5. **Active Users** (Growth rate)

**Charts/Graphs**:
- Revenue trend (Line chart - last 30/90 days)
- Event enrollment statistics (Bar chart)
- Category-wise event distribution (Pie chart)
- Payment status breakdown (Donut chart)

**Quick Actions**:
- Create New Event (Button)
- Create Coupon (Button)
- View Recent Enrollments (List preview)
- Pending Payments Alert (If any)

**Recent Activity Feed**:
- Last 10 enrollments with user details
- Recent payments
- New user registrations

---

### 2.3 Event Management

#### Events List Page (`/admin/events`)
**Purpose**: View, filter, and manage all events

**Features**:
- **Table View** with columns:
  - Thumbnail image
  - Event name
  - Category badge
  - Mode (ONLINE/OFFLINE/HYBRID)
  - City (for offline events)
  - Price (with compareAtPrice strikethrough)
  - Available Seats
  - Start Date - End Date
  - Status Badge (LIVE/EXPIRED)
  - Actions (View/Edit/Delete dropdown)

- **Filters Panel**:
  - Category dropdown (12 categories)
  - Mode selector (ONLINE/OFFLINE/HYBRID)
  - City autocomplete
  - isLive toggle
  - Price range slider (min-max)
  - Date range picker (start date)
  - Search bar (name/description)

- **Sorting Options**:
  - Created Date (newest/oldest)
  - Start Date
  - Price (low to high / high to low)
  - Name (A-Z / Z-A)

- **Bulk Actions**:
  - Bulk delete (soft delete)
  - Export to CSV
  - Update expired events status

- **Pagination**: 10/25/50/100 per page

**APIs**:
- `GET /api/web/events` (List with filters)
- `DELETE /api/web/events/:id` (Soft delete)
- `POST /api/web/events/update-expired` (Batch update)

---

#### Create Event Page (`/admin/events/create`)
**Purpose**: Add new event to the system

**Form Sections**:

**1. Basic Information**
- Event Name* (max 200 chars)
- Description* (Rich text editor, max 5000 chars)
- Category* (Dropdown: TECHNOLOGY, EDUCATION, MEDICAL, COMEDY, ENTERTAINMENT, BUSINESS, SPORTS, ARTS, MUSIC, FOOD, LIFESTYLE, OTHER)

**2. Media**
- Thumbnail Image* (URL input + Upload button)
- Thumbnail Video (Optional URL)
- Additional Images (Multiple URL inputs)
- Image preview section

**3. Event Details**
- Mode* (Radio: ONLINE/OFFLINE/HYBRID)
- City* (Text input - conditionally required for OFFLINE/HYBRID)
- Start Date & Time* (DateTime picker - must be future)
- End Date & Time* (DateTime picker - must be after start)

**4. Pricing**
- Price* (Number input, min: 0)
- Compare At Price (Optional - for showing discounts)
- Available Seats* (Number input, min: 1)

**5. Coupons**
- Multi-select dropdown of active coupons
- Search coupons by code
- Preview selected coupons

**Validation**:
- All required fields must be filled
- Start date must be in future
- End date must be after start date
- City required for OFFLINE/HYBRID modes
- Compare at price must be ≥ regular price

**Actions**:
- Save as Draft (isLive: false)
- Publish Event (isLive: true)
- Cancel

**API**: `POST /api/web/events`

---

#### Edit Event Page (`/admin/events/:id/edit`)
**Purpose**: Modify existing event details

**Features**:
- Same form as Create Event
- Pre-populated with existing data
- Shows "Created by" and "Last updated by" info
- Additional actions:
  - Save Changes
  - Cancel
  - Delete Event
  - View Event (opens detail page)

**Warning Alerts**:
- If event has enrollments: "X users enrolled - changes may affect them"
- If event is LIVE: "Event is currently LIVE"

**API**: `PUT /api/web/events/:id`

---

#### Event Detail Page (`/admin/events/:id`)
**Purpose**: Comprehensive view of single event

**Sections**:

**1. Event Header**
- Large thumbnail image/video
- Event name and category badge
- Status indicator (LIVE/EXPIRED)
- Action buttons: Edit, Delete, Duplicate

**2. Event Information**
- Description (formatted)
- Mode and location
- Start and end dates
- Created by (admin name) and date
- Last updated by and date

**3. Pricing & Availability**
- Current price
- Original price (if different)
- Available seats
- Seats sold (calculated)
- Revenue generated

**4. Applied Coupons**
- List of applicable coupons
- Usage count per coupon for this event
- Discount amounts

**5. Enrollments Section**
- Total enrollments count
- Quick view of last 5 enrollments
- "View All Attendees" button → navigates to filtered enrollment list

**6. Statistics**
- Enrollment trend chart
- Revenue breakdown
- Popular payment methods

**API**: `GET /api/web/events/:id`

---

#### Deleted Events Page (`/admin/events/deleted`)
**Purpose**: View and manage soft-deleted events

**Features**:
- Table view similar to Events List
- Shows deletion date and deleted by admin
- Actions per row:
  - Restore (soft undelete)
  - Permanent Delete (Super Admin only, with confirmation)
  - View Details

**APIs**:
- `GET /api/web/events/deleted`
- `POST /api/web/events/:id/restore`
- `DELETE /api/web/events/:id/permanent` (Super Admin only)

---

### 2.4 Coupon Management

#### Coupons List Page (`/admin/coupons`)
**Purpose**: Manage discount coupons

**Table Columns**:
- Coupon Code (uppercase)
- Discount % (badge)
- Max Discount Amount
- Min Purchase Amount
- Usage (X / Y or X / Unlimited)
- Usage Per User
- Valid From - Valid Until
- Status (Active/Inactive badge)
- Actions (Edit/Delete/Toggle Status)

**Filters**:
- Active/Inactive/All
- Date range (validity)
- Usage status (Available/Exhausted)
- Search by code

**Quick Stats**:
- Total active coupons
- Most used coupon
- Total discount given

**API**: `GET /api/web/coupons`

---

#### Create/Edit Coupon Page (`/admin/coupons/create`, `/admin/coupons/:id/edit`)
**Purpose**: Create or modify coupon codes

**Form Fields**:
1. **Coupon Code*** (Text, 3-50 chars, auto-uppercase)
2. **Discount Percentage*** (Number, 0-100%)
3. **Max Discount Amount*** (₹, minimum 0)
4. **Min Purchase Amount*** (₹, default 0)
5. **Usage Limits**:
   - Max Total Usage (Number or "Unlimited" checkbox)
   - Max Usage Per User* (Number, default 1)
6. **Validity Period**:
   - Valid From* (Date picker)
   - Valid Until* (Date picker)
7. **Description** (Optional, max 500 chars)
8. **Status** (Active/Inactive toggle)

**Preview Section**:
- Shows how coupon will display to users
- Example discount calculation

**Validation**:
- Unique coupon code
- Valid until > Valid from
- Max discount ≤ potential discount amount

**APIs**:
- `POST /api/web/coupons` (Create)
- `PUT /api/web/coupons/:id` (Update)

---

#### Deleted Coupons Page (`/admin/coupons/deleted`)
**Features**:
- List of soft-deleted coupons
- Restore or permanently delete
- Similar to deleted events page

**APIs**:
- `GET /api/web/coupons/deleted`
- `POST /api/web/coupons/:id/restore`
- `DELETE /api/web/coupons/:id/permanent` (Super Admin only)

---

### 2.5 Enrollment Management

#### Enrollments List Page (`/admin/enrollments`)
**Purpose**: View and manage all user enrollments

**Table Columns**:
- Enrollment ID
- User Name (email/phone)
- Event Name (link to event)
- Ticket Count
- Total Amount Paid
- Coupon Used
- Enrollment Date
- Ticket Status (ACTIVE/CANCELLED/REFUNDED badges)
- Actions (View/Cancel dropdown)

**Filters**:
- Event selector (searchable dropdown)
- User search (name/email/phone)
- Status (Active/Cancelled/Refunded)
- Date range
- Payment status

**Bulk Actions**:
- Export to Excel/CSV
- Send bulk email/SMS (if integrated)

**API**: `GET /api/web/enrollments`

---

#### Event Attendees Page (`/admin/enrollments/event/:eventId`)
**Purpose**: View all attendees for specific event

**Features**:
- Event details header (name, date, total enrollments)
- Attendee list with ticket details
- Per-ticket information:
  - Phone number
  - Ticket status
  - QR scan status (Scanned/Not Scanned)
  - Scanned by (admin name) and time
- Download attendee list (PDF/Excel)
- Check-in statistics:
  - Total tickets: X
  - Checked in: Y
  - Pending: Z
  - Cancelled: A

**API**: `GET /api/web/enrollments/event/:eventId`

---

#### Enrollment Detail Page (`/admin/enrollments/:id`)
**Purpose**: Detailed view of single enrollment

**Sections**:

**1. Enrollment Summary**
- Enrollment ID and date
- User details (name, email, phone)
- Event details (name, date, location)

**2. Payment Information**
- Order ID
- Payment ID
- Amount breakdown:
  - Original amount
  - Discount (if coupon used)
  - Final amount paid
- Payment status
- Payment date and method

**3. Tickets**
- Table of all tickets with phone numbers
- Individual ticket status
- QR code display per ticket
- Download QR buttons
- Scan history

**4. Actions**
- Cancel entire enrollment
- Cancel individual tickets
- Resend confirmation email/SMS
- Download all QR codes (ZIP)
- View payment receipt

**API**: `GET /api/web/enrollments/:id`

---

#### Mock Enrollment Page (`/admin/enrollments/mock-enrollment`) - TEST ONLY
**Purpose**: Create test enrollments without payment

**Form**:
- User selector (or create new test user)
- Event selector
- Number of tickets
- Phone numbers for tickets

**Note**: Should be hidden in production or have prominent "TEST MODE" warning

**API**: `POST /api/web/enrollments/mock-enrollment`

---

### 2.6 Payment Management

#### Payments List Page (`/admin/payments`)
**Purpose**: View all payment transactions

**Table Columns**:
- Order ID
- Payment ID
- User Name
- Event Name
- Amount
- Discount
- Final Amount
- Coupon Code
- Status (PENDING/SUCCESS/FAILED/REFUNDED)
- Payment Date
- Actions (View Details)

**Filters**:
- Status (All/Pending/Success/Failed/Refunded)
- Date range
- Amount range
- Event selector
- User search
- Coupon code

**Summary Cards**:
- Total Revenue (SUCCESS only)
- Pending Payments
- Failed Payments
- Total Discounts Given

**Export Options**:
- Export filtered results to Excel
- Generate revenue report

**API**: `GET /api/web/payments`

---

#### Payment Detail Page (`/admin/payments/:id`)
**Purpose**: Detailed view of payment transaction

**Sections**:

**1. Payment Information**
- Order ID, Payment ID, Signature
- Status with timeline
- Amount breakdown
- Payment date and time

**2. User Details**
- User name, email, phone
- User ID (link to user profile)

**3. Event/Product Details**
- Event name (link to event)
- Ticket count
- Price per ticket

**4. Coupon Details** (if applicable)
- Coupon code
- Discount percentage
- Discount amount
- Final amount

**5. Transaction History**
- Order created timestamp
- Payment initiated
- Payment success/failure
- Any refund information

**6. Razorpay Details** (if available)
- Payment method
- Bank/Card details (masked)
- Transaction ID

**API**: `GET /api/web/payments/:id`

---

### 2.7 User Management

#### Users List Page (`/admin/users`)
**Purpose**: View and manage registered users

**Table Columns**:
- User ID
- Name
- Email
- Phone
- Total Enrollments
- Total Spent
- Last Login
- Registration Date
- Status (Active/Deleted)
- Actions (View/Edit/Delete)

**Filters**:
- Search (name/email/phone)
- Registration date range
- Status (Active/Deleted)
- Enrollment count range
- Spending range

**Stats Cards**:
- Total Users
- Active Users (logged in last 30 days)
- New Users (this month)
- Deleted Users

**API**: `GET /api/web/auth/users`

---

#### User Detail Page (`/admin/users/:id`)
**Purpose**: Comprehensive user profile

**Sections**:

**1. User Information**
- Name, email, phone
- Registration date
- Last login
- Account status

**2. Enrollment History**
- List of all events enrolled
- Ticket details
- Total spent

**3. Payment History**
- All payment transactions
- Success rate
- Total amount

**4. Activity Timeline**
- Registration
- Logins
- Enrollments
- Payments

**5. Actions**
- Edit user details
- Soft delete user
- Restore user (if deleted)
- Permanently delete (Super Admin only)
- Send notification

**APIs**:
- `GET /api/web/auth/users/:id`
- `PUT /api/web/auth/users/:id`
- `DELETE /api/web/auth/users/:id` (Soft delete)
- `POST /api/web/auth/users/:id/restore`
- `DELETE /api/web/auth/users/:id/permanent` (Super Admin only)

---

### 2.8 QR Code Verification (Mobile-Optimized)

#### QR Scanner Page (`/admin/tickets/verify`)
**Purpose**: Real-time ticket verification at event venue

**Features**:

**1. Scanner Interface**
- Camera view for QR scanning
- Manual token input option
- Large feedback area

**2. Verification Results** (After scan)
- ✓ Success: Green screen
  - Event name
  - User name and phone
  - Ticket status
  - Previous scan info (if rescanned)
  - "Mark as Checked In" button

- ✗ Failure: Red screen
  - Error message
  - Possible reasons (Invalid, Cancelled, Wrong Event, etc.)

**3. Statistics Panel**
- Event selector
- Total tickets for event
- Checked in count
- Pending count
- Recent check-ins list

**4. Offline Mode** (PWA)
- Cache verification data
- Sync when online

**API**: `GET /api/web/tickets/verify?token={jwt_token}`

**Technical Notes**:
- JWT token embedded in QR code
- Token contains: enrollmentId, phone, eventId
- Token expiry should be event end date
- Real-time validation against database

---

### 2.9 Admin Management (Super Admin Only)

#### Admins List Page (`/admin/admins`)
**Purpose**: Manage admin accounts (Super Admin only)

**Table Columns**:
- Name
- Email
- Phone
- Role (SUPER_ADMIN/MANAGEMENT_STAFF badge)
- Access Permissions (tags)
- Status (ACTIVATED/DEACTIVATED)
- Last Login
- Actions (View/Edit/Delete)

**Features**:
- Cannot delete self
- Cannot change own role
- Filters: Role, Status, Search

**API**: `GET /api/web/auth/admins`

---

#### Create/Edit Admin Page (`/admin/admins/create`, `/admin/admins/:id/edit`)
**Purpose**: Add or modify admin accounts

**Form Fields**:
1. **Name*** (Text)
2. **Email*** (Unique)
3. **Phone*** (Unique, 10 digits)
4. **Password*** (Min 6 chars - only on create)
5. **Role*** (Dropdown: SUPER_ADMIN/MANAGEMENT_STAFF)
6. **Access Permissions** (Multi-select checkboxes):
   - Events Management
   - Coupons Management
   - User Management
   - Payments View
   - Enrollments Management
   - QR Verification
   - Reports Access
   - (Super Admin gets all by default)
7. **Status** (Toggle: ACTIVATED/DEACTIVATED)

**Validation**:
- Unique email and phone
- Strong password requirements
- At least one Super Admin must exist

**APIs**:
- `POST /api/web/auth/create` (Create)
- `PUT /api/web/auth/admins/:id` (Update)

---

#### Admin Detail Page (`/admin/admins/:id`)
**Purpose**: View admin profile and activity

**Sections**:
- Admin information
- Role and permissions
- Activity log:
  - Events created/updated
  - Coupons created
  - Users managed
  - Last login history

**API**: `GET /api/web/auth/admins/:id`

---

### 2.10 Profile & Settings

#### My Profile Page (`/admin/profile`)
**Purpose**: Admin's own profile management

**Sections**:

**1. Personal Information**
- Name (editable)
- Email (editable - unique check)
- Phone (editable - unique check)
- Role (read-only)
- Access Permissions (read-only)
- Last Login

**2. Change Password**
- Current password
- New password
- Confirm new password

**3. Activity History**
- Recent actions
- Login history
- Sessions (active devices)

**APIs**:
- `GET /api/web/auth/profile`
- `PUT /api/web/auth/profile`
- `PUT /api/web/auth/change-password`

---

#### Settings Page (`/admin/settings`) - FUTURE
**Purpose**: System-wide configuration

**Potential Settings**:
- Email templates
- SMS settings
- Payment gateway config (Razorpay keys - encrypted)
- Notification preferences
- System logs
- Backup/Export data

---

### 2.11 Reports & Analytics (Future Enhancement)

#### Reports Dashboard (`/admin/reports`)
**Purpose**: Business intelligence and analytics

**Available Reports**:

1. **Revenue Report**
   - Total revenue by time period
   - Category-wise revenue
   - Event-wise revenue
   - Coupon impact analysis

2. **Enrollment Report**
   - Total enrollments trend
   - Event popularity
   - User engagement metrics
   - Repeat user analysis

3. **Payment Report**
   - Success/Failure rates
   - Payment method distribution
   - Refund statistics
   - Average order value

4. **Coupon Performance**
   - Most used coupons
   - Discount given vs revenue generated
   - Coupon ROI

5. **User Analytics**
   - User growth rate
   - User lifetime value
   - Geographic distribution
   - User engagement

**Export Options**:
- PDF
- Excel
- CSV
- Email scheduled reports

---

## 3. Common UI Components

### 3.1 Navigation
**Sidebar Menu** (Collapsible):
```
├── Dashboard
├── Events
│   ├── All Events
│   ├── Create Event
│   └── Deleted Events
├── Coupons
│   ├── All Coupons
│   ├── Create Coupon
│   └── Deleted Coupons
├── Enrollments
│   ├── All Enrollments
│   └── Mock Enrollment
├── Payments
├── Users
│   ├── All Users
│   └── Deleted Users
├── QR Verification
├── Admins (Super Admin only)
│   ├── All Admins
│   └── Create Admin
├── Reports (Future)
└── Settings
```

**Top Header**:
- App logo/name
- Quick search (global)
- Notification bell (payment failures, new enrollments)
- Profile dropdown:
  - My Profile
  - Settings
  - Logout

---

### 3.2 Reusable Components

1. **Data Table Component**
   - Sorting
   - Filtering
   - Pagination
   - Column visibility toggle
   - Export functionality
   - Bulk actions

2. **Status Badge**
   - Color-coded (green/red/yellow/gray)
   - Different styles per context

3. **Date Range Picker**
   - Presets (Today, Last 7 days, Last 30 days, This month, Custom)

4. **Confirmation Modal**
   - For delete operations
   - Required for permanent delete (Super Admin)
   - Shows impact (e.g., "This event has 10 enrollments")

5. **Loading States**
   - Skeleton screens
   - Spinners
   - Progress indicators

6. **Empty States**
   - No data illustrations
   - Call-to-action buttons

7. **Error Boundaries**
   - Graceful error handling
   - Fallback UI

8. **Toast Notifications**
   - Success, Error, Warning, Info
   - Auto-dismiss or manual close

---

## 4. User Flows

### 4.1 Creating an Event (Full Flow)

**Steps**:
1. Admin logs in → Dashboard
2. Click "Create New Event" or Navigate to Events → Create Event
3. Fill form sections (Basic Info → Media → Details → Pricing → Coupons)
4. Real-time validation on each field blur
5. Preview section shows event card as users will see it
6. Click "Save as Draft" (isLive: false) or "Publish" (isLive: true)
7. Success toast: "Event created successfully"
8. Redirect to Event Detail page
9. Options: Edit, Delete, Duplicate, View Public Page

**Error Handling**:
- Form validation errors highlighted in red
- API errors shown in toast
- Unsaved changes warning on navigation

---

### 4.2 User Enrollment Journey (From User Perspective - Admin monitors)

**User Side Flow** (Admin should understand this):
1. User browses events (`GET /api/app/events`)
2. User selects event and sees details
3. User applies coupon (optional) (`POST /api/app/coupons/validate`)
4. User creates payment order (`POST /api/app/payments/create-order`)
5. Razorpay payment gateway opens
6. User completes payment
7. User verifies payment (`POST /api/app/payments/verify`)
8. System creates enrollment (`POST /api/app/enrollments`)
9. User receives confirmation with QR codes
10. User downloads QR codes (`GET /api/app/tickets/:enrollmentId/qr/:phone`)

**Admin Monitoring Points**:
- Payment created (PENDING) appears in payments list
- Payment success → Enrollment automatically created
- Admin can see enrollment in real-time
- Admin can view/download QR codes for user
- Admin can cancel enrollment if needed

---

### 4.3 Event Day Check-in Flow

**Setup** (Before event):
1. Admin navigates to QR Verification page
2. Selects event from dropdown
3. Views check-in statistics (0 checked in initially)

**Check-in Process**:
1. User arrives with QR code (phone screen or printed)
2. Admin scans QR code with device camera
3. System validates token (`GET /api/web/tickets/verify?token={jwt}`)
4. If valid:
   - Shows green success screen
   - Displays: Event name, User name, Phone, Ticket status
   - Admin clicks "Mark as Checked In"
   - Updates database: isTicketScanned = true, ticketScannedAt = now, ticketScannedBy = adminId
   - Plays success sound/vibration
   - Statistics update in real-time
5. If invalid:
   - Shows red error screen
   - Displays error reason
   - Admin can manually verify or contact support

**Re-scan Handling**:
- If ticket already scanned, show warning
- Display previous scan time and admin who scanned
- Option to allow re-entry (confirmation required)

---

### 4.4 Coupon Creation & Application

**Admin Creates Coupon**:
1. Navigate to Coupons → Create Coupon
2. Enter code (e.g., "EARLYBIRD50")
3. Set 50% discount
4. Set max discount ₹500
5. Set min purchase ₹1000
6. Set valid from: Today
7. Set valid until: Event start date
8. Set max usage: 100
9. Set max usage per user: 1
10. Save and activate

**User Applies Coupon** (Admin monitors):
1. User selects event (price ₹1500)
2. User enters "EARLYBIRD50" at checkout
3. System validates:
   - Coupon exists and active
   - Within validity dates
   - Min purchase met (₹1500 ≥ ₹1000) ✓
   - Usage limit not exceeded
   - User hasn't used before
4. Calculate discount: 50% of ₹1500 = ₹750
5. Apply max cap: min(₹750, ₹500) = ₹500
6. Final amount: ₹1500 - ₹500 = ₹1000
7. User completes payment of ₹1000
8. Coupon usage count increments

**Admin Views Impact**:
- Coupon page shows usage: 1/100
- Coupon detail shows revenue impact
- Payment detail shows coupon applied

---

### 4.5 Handling Payment Failure

**Scenario**: User's payment fails

**Flow**:
1. User initiates payment → Creates order (status: PENDING)
2. Razorpay payment fails (insufficient funds, declined, etc.)
3. User calls failure callback (`POST /api/app/payments/failure`)
4. Payment status updated to FAILED with failure reason
5. Enrollment NOT created
6. User sees error message

**Admin Actions**:
1. Admin sees payment in Payments list with FAILED status
2. Admin can view failure reason
3. Admin can contact user to retry
4. Admin can create mock enrollment if payment done outside system
5. Failed payments count in dashboard statistics

---

## 5. Key Features & Functionality

### 5.1 Event Management
- ✓ Full CRUD operations
- ✓ Soft delete + permanent delete (Super Admin)
- ✓ Rich media support (images, videos)
- ✓ Category and mode-based filtering
- ✓ Auto status update (expired events)
- ✓ Duplicate event functionality
- ✓ Event analytics
- ✓ Coupon linking

### 5.2 Coupon System
- ✓ Percentage-based discounts
- ✓ Maximum discount cap
- ✓ Minimum purchase requirement
- ✓ Usage limits (total + per user)
- ✓ Validity period
- ✓ Active/Inactive toggle
- ✓ Usage tracking
- ✓ Soft delete + restore

### 5.3 Enrollment Management
- ✓ View all enrollments
- ✓ Filter by event, user, status, date
- ✓ View event attendees
- ✓ Cancel enrollments (full or partial)
- ✓ Ticket-level status tracking
- ✓ QR code generation and management
- ✓ Mock enrollment for testing

### 5.4 Payment Integration
- ✓ Razorpay integration
- ✓ Order creation and verification
- ✓ Payment status tracking
- ✓ Failure handling
- ✓ Refund support (future)
- ✓ Revenue reports
- ✓ Coupon discount calculation

### 5.5 User Management
- ✓ View all users
- ✓ User activity tracking
- ✓ Soft delete + restore
- ✓ Permanent delete (Super Admin)
- ✓ User enrollment history
- ✓ User spending analytics

### 5.6 QR Code System
- ✓ JWT-based secure tokens
- ✓ Per-ticket QR generation
- ✓ Phone-based ticket identification
- ✓ Real-time verification
- ✓ Scan status tracking
- ✓ Re-scan detection
- ✓ Admin tracking (who scanned)
- ✓ Download QR as PNG

### 5.7 Admin Management (Super Admin)
- ✓ Two-tier role system
- ✓ Granular access control
- ✓ Admin CRUD operations
- ✓ Activity logging
- ✓ Status management (activate/deactivate)
- ✓ Self-protection (can't delete self)

### 5.8 Security Features
- ✓ JWT-based authentication
- ✓ Refresh token mechanism
- ✓ Role-based access control (RBAC)
- ✓ Password hashing (bcrypt)
- ✓ Token expiry and refresh
- ✓ Protected routes
- ✓ Soft delete for data preservation

---

## 6. Public Routes (User-facing - Admin monitors these)

### What Users Can Do Without Admin:

**Event Discovery**:
- `GET /api/app/events` - Browse all live events
- `GET /api/app/events/upcoming` - View upcoming events
- `GET /api/app/events/category/:category` - Browse by category
- `GET /api/app/events/:id` - View event details

**Authentication**:
- `POST /api/app/auth/register` - Self-registration
- `POST /api/app/auth/login` - Email/phone login
- User profile management

**Coupon Discovery**:
- `GET /api/app/coupons` - View active coupons
- `POST /api/app/coupons/validate` - Validate and apply coupons

**Payment & Enrollment**:
- `POST /api/app/payments/create-order` - Initiate payment
- `POST /api/app/payments/verify` - Verify payment success
- `POST /api/app/enrollments` - Create enrollment after payment
- `GET /api/app/enrollments` - View own enrollments
- `POST /api/app/enrollments/:id/cancel` - Cancel own enrollment

**Tickets**:
- `GET /api/app/tickets/:enrollmentId/qr/:phone` - Download QR code
- `GET /api/app/tickets/:enrollmentId/token` - Get JWT token for QR

---

## 7. Technical Specifications

### 7.1 State Management
**Recommended**: Redux Toolkit or Zustand

**Stores**:
- `authStore`: Admin auth state, tokens, profile
- `eventsStore`: Events data, filters, pagination
- `couponsStore`: Coupons data, filters
- `enrollmentsStore`: Enrollments data, filters
- `paymentsStore`: Payments data, filters
- `usersStore`: Users data, filters
- `adminsStore`: Admins data (Super Admin only)
- `uiStore`: Sidebar state, modals, toasts, loading states

### 7.2 API Client
- Axios with interceptors
- Auto-attach JWT token to headers
- Auto-refresh token on 401
- Centralized error handling
- Request/response logging (dev mode)

### 7.3 Form Management
**Recommended**: React Hook Form + Yup/Zod validation

**Key Forms**:
- Event creation/editing (complex, multi-step)
- Coupon creation/editing
- Admin creation/editing
- User profile editing

### 7.4 File Upload
**Considerations**:
- Backend should provide upload endpoint (or S3 pre-signed URLs)
- Image compression before upload
- Progress indicators
- Preview functionality
- Multiple file handling

### 7.5 Real-time Features
**Potential WebSocket/Polling for**:
- Dashboard statistics live update
- Payment status updates
- QR scan notifications
- New enrollment alerts

### 7.6 Responsive Design
- **Desktop-first** for admin panel
- **Mobile-optimized** for QR verification page
- Tablet support for dashboard viewing
- Breakpoints: 320px, 768px, 1024px, 1440px

### 7.7 Performance Optimization
- Lazy loading for routes
- Virtual scrolling for large tables
- Image lazy loading
- Pagination for all lists
- Debounced search inputs
- Memoization for expensive computations
- Service worker for offline QR verification

### 7.8 Security Measures (Frontend)
- XSS prevention (sanitize user inputs)
- CSRF protection
- Secure token storage (httpOnly cookies recommended)
- Input validation on all forms
- Role-based UI rendering
- Mask sensitive data (payment details)

---

## 8. Data Models (Frontend Interfaces)

### Admin
```typescript
interface Admin {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'SUPER_ADMIN' | 'MANAGEMENT_STAFF';
  access: string[];
  status: 'ACTIVATED' | 'DEACTIVATED';
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### User
```typescript
interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  enrollments: {
    event: string;
    certificate: string[];
  }[];
  isDeleted: boolean;
  deletedAt: Date | null;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Event
```typescript
interface Event {
  _id: string;
  name: string;
  description: string;
  imageUrls: string[];
  thumbnail: {
    imageUrl?: string;
    videoUrl?: string;
  };
  isLive: boolean;
  mode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  city?: string;
  category: EventCategory;
  startDate: Date;
  endDate: Date;
  price: number;
  compareAtPrice?: number;
  availableSeats: number;
  coupons: string[]; // Coupon IDs
  createdBy: string; // Admin ID
  updatedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

type EventCategory =
  | 'TECHNOLOGY'
  | 'EDUCATION'
  | 'MEDICAL'
  | 'COMEDY'
  | 'ENTERTAINMENT'
  | 'BUSINESS'
  | 'SPORTS'
  | 'ARTS'
  | 'MUSIC'
  | 'FOOD'
  | 'LIFESTYLE'
  | 'OTHER';
```

### Coupon
```typescript
interface Coupon {
  _id: string;
  code: string;
  discountPercent: number;
  maxDiscountAmount: number;
  minPurchaseAmount: number;
  maxUsageLimit: number | null;
  usageCount: number;
  maxUsagePerUser: number;
  validFrom: Date;
  validUntil: Date;
  description?: string;
  isActive: boolean;
  createdBy: string;
  updatedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Payment
```typescript
interface Payment {
  _id: string;
  orderId: string;
  paymentId: string | null;
  signature: string | null;
  userId: string;
  type: 'EVENT' | 'SESSION' | 'OTHER' | 'PRODUCT';
  eventId?: string;
  sessionId?: string;
  amount: number;
  couponCode?: string;
  discountAmount: number;
  finalAmount: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  purchaseDateTime: Date;
  metadata?: any;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Enrollment
```typescript
interface Enrollment {
  _id: string;
  paymentId: string;
  orderId: string;
  userId: string;
  eventId: string;
  ticketCount: number;
  tickets: Map<string, Ticket>; // Key: phone number
  createdAt: Date;
  updatedAt: Date;
}

interface Ticket {
  status: 'ACTIVE' | 'CANCELLED' | 'REFUNDED';
  cancelledAt: Date | null;
  cancellationReason: string | null;
  isTicketScanned: boolean;
  ticketScannedAt: Date | null;
  ticketScannedBy: string | null; // Admin ID
}
```

---

## 9. API Response Format

All API responses follow this structure:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

### Paginated Response
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": {
    "items": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalCount": 95,
      "limit": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## 10. Validation Rules Summary

### Event Validation
- Name: Required, max 200 chars
- Description: Required, max 5000 chars
- Start date: Must be in future
- End date: Must be after start date
- Price: Required, min 0
- Compare at price: Must be ≥ regular price
- Available seats: Required, min 1
- City: Required for OFFLINE/HYBRID modes

### Coupon Validation
- Code: Required, 3-50 chars, unique, uppercase
- Discount %: Required, 0-100
- Max discount: Required, min 0
- Min purchase: Required, min 0
- Valid until: Must be after valid from
- Usage per user: Min 1

### Admin Validation
- Name: Required, 2-100 chars
- Email: Required, valid email, unique
- Phone: Required, 10 digits, unique
- Password: Required (create only), min 6 chars
- Role: Required, enum

### User Validation
- Name: Required, 2-100 chars
- Email: Required, valid email, unique
- Phone: Required, 10 digits, unique
- Password: Required, min 8 chars

---

## 11. Error Handling Strategy

### Types of Errors

**1. Network Errors**
- Show retry button
- Cache form data
- Toast: "Network error. Please check your connection."

**2. Validation Errors**
- Inline field errors (red text below field)
- Highlight invalid fields
- Scroll to first error
- Toast: "Please fix validation errors"

**3. Authorization Errors (401)**
- Auto-redirect to login
- Store intended route
- Toast: "Session expired. Please login again."

**4. Forbidden Errors (403)**
- Show permission denied message
- Suggest contacting Super Admin
- Toast: "You don't have permission for this action"

**5. Not Found Errors (404)**
- Show 404 page with back button
- Suggest valid routes
- Toast: "Resource not found"

**6. Server Errors (500)**
- Generic error message
- Log error details
- Show support contact
- Toast: "Something went wrong. Please try again later."

**7. Business Logic Errors**
- Show specific error message from API
- Provide actionable next steps
- Toast: API error message

---

## 12. Notification Strategy

### Toast Notifications
**Success**:
- Event created/updated/deleted
- Coupon created/updated
- Admin created/updated
- Profile updated
- Password changed

**Error**:
- API failures
- Validation failures
- Permission denied
- Network issues

**Warning**:
- Unsaved changes
- Duplicate actions
- Low stock/seats

**Info**:
- Background processes
- Tips and suggestions

### Email Notifications (Backend sends)
- New enrollment (to user)
- Payment success (to user)
- Payment failure (to user and admin)
- Enrollment cancellation (to user)
- Event updates (to enrolled users)
- Admin account creation (to new admin)

### SMS Notifications (Backend sends)
- Enrollment confirmation with QR link
- Payment OTP (via payment gateway)
- Event reminders (day before)

---

## 13. Testing Checklist

### Unit Tests
- Form validation logic
- Utility functions
- Component rendering
- State management actions

### Integration Tests
- API integration
- Authentication flow
- Form submissions
- Routing

### E2E Tests (Critical Flows)
1. Admin login → Create event → Publish
2. Create coupon → Apply to event → Validate discount
3. View enrollment → Cancel enrollment
4. QR scan → Verify ticket
5. Create admin → Assign permissions → Login as new admin

### Accessibility Tests
- Keyboard navigation
- Screen reader compatibility
- Color contrast
- Focus management
- ARIA labels

### Performance Tests
- Large table rendering (1000+ rows)
- Image loading optimization
- API response time
- Bundle size analysis

---

## 14. Deployment Considerations

### Environment Variables
```
REACT_APP_API_BASE_URL
REACT_APP_RAZORPAY_KEY
REACT_APP_ENV (development/staging/production)
REACT_APP_VERSION
```

### Build Optimization
- Code splitting per route
- Tree shaking
- Image optimization
- CSS minification
- Gzip compression

### Browser Support
- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

### PWA Features (Optional)
- Offline support for QR scanner
- Add to home screen
- Push notifications
- Service worker caching

---

## 15. Future Enhancements

### Phase 2 Features
1. **Advanced Analytics**
   - Custom date range reports
   - Cohort analysis
   - Funnel visualization
   - A/B testing for events

2. **Communication Module**
   - Bulk email to users
   - SMS campaigns
   - Push notifications
   - In-app messaging

3. **Advanced Coupons**
   - User-specific coupons
   - Event-specific coupons
   - Buy X Get Y offers
   - Referral coupons

4. **CRM Features**
   - User segments
   - Targeted campaigns
   - Automated workflows
   - Lead scoring

5. **Content Management**
   - Blog/News section
   - FAQs management
   - Terms & Conditions editor
   - Email template editor

6. **Multi-language Support**
   - i18n implementation
   - RTL support
   - Regional currency

7. **Advanced Event Features**
   - Multi-day events
   - Recurring events
   - Event packages/bundles
   - Early bird pricing tiers

8. **Refund Management**
   - Refund requests workflow
   - Partial refunds
   - Refund approval system
   - Automated refund processing

9. **Feedback System**
   - Post-event surveys
   - Ratings and reviews
   - NPS tracking
   - Sentiment analysis

10. **Integration Hub**
    - Google Calendar sync
    - Zoom integration
    - Google Meet integration
    - Social media posting

---

## 16. Quick Reference: Page Count Summary

### Total Pages: **~35 pages**

**Authentication**: 2 pages
- Login
- Register (conditional)

**Dashboard**: 1 page

**Events**: 5 pages
- List
- Create
- Edit
- Detail
- Deleted

**Coupons**: 4 pages
- List
- Create
- Edit
- Deleted

**Enrollments**: 4 pages
- List
- Event Attendees
- Detail
- Mock Enrollment

**Payments**: 2 pages
- List
- Detail

**Users**: 2 pages
- List
- Detail

**QR Verification**: 1 page

**Admins** (Super Admin only): 4 pages
- List
- Create
- Edit
- Detail

**Profile & Settings**: 2 pages
- My Profile
- Settings

**Reports** (Future): 1 page

**Error Pages**: 3 pages
- 404 Not Found
- 403 Forbidden
- 500 Server Error

---

## 17. Development Timeline Estimate

### Phase 1 - Core Setup (1-2 weeks)
- Project setup (React, routing, state management)
- Authentication system
- API client setup
- Basic layout and navigation

### Phase 2 - Event Management (2-3 weeks)
- Events list with filters
- Create/Edit event forms
- Event detail page
- Soft delete functionality

### Phase 3 - Coupon System (1-2 weeks)
- Coupons list
- Create/Edit coupons
- Coupon validation UI
- Soft delete functionality

### Phase 4 - Enrollments & Payments (2-3 weeks)
- Enrollments list with filters
- Event attendees view
- Payment list and details
- Cancel enrollment functionality

### Phase 5 - User Management (1 week)
- Users list
- User detail page
- User actions (edit, delete, restore)

### Phase 6 - QR Verification (1-2 weeks)
- QR scanner implementation
- Real-time verification
- Check-in statistics
- Mobile optimization

### Phase 7 - Admin Management (1 week)
- Admins list (Super Admin)
- Create/Edit admin
- Role and permission management

### Phase 8 - Dashboard & Analytics (1-2 weeks)
- Dashboard metrics
- Charts and graphs
- Recent activity feed

### Phase 9 - Polish & Testing (2 weeks)
- UI/UX refinements
- Responsive design
- Accessibility improvements
- Bug fixes
- Testing

### **Total: 12-18 weeks (3-4.5 months)**

---

## 18. Priority Features (MVP)

### Must Have (MVP)
✓ Authentication (Login)
✓ Dashboard (Basic metrics)
✓ Events (List, Create, Edit, Delete, Detail)
✓ Enrollments (List, View, Cancel)
✓ Payments (List, View)
✓ Users (List, View)
✓ QR Verification
✓ Profile management

### Should Have
✓ Coupons (Full CRUD)
✓ Event filters and search
✓ Soft delete and restore
✓ Admin management (Super Admin)
✓ Dashboard analytics
✓ Event attendees view

### Nice to Have
✓ Deleted items management
✓ Advanced filters
✓ Export functionality
✓ Reports
✓ Bulk actions
✓ Email/SMS integration

---

## Conclusion

This frontend report provides a comprehensive blueprint for building the Motivata admin panel. The system is designed to be scalable, maintainable, and user-friendly, with clear separation of concerns and role-based access control.

### Key Takeaways:
1. **Two-tier admin system** with Super Admin and Management Staff roles
2. **Full event lifecycle management** from creation to check-in
3. **Robust coupon system** with usage tracking and validation
4. **Real-time QR verification** for event check-in
5. **Comprehensive payment tracking** with Razorpay integration
6. **Soft delete architecture** for data preservation
7. **Role-based access control** throughout the system
8. **Mobile-optimized QR scanner** for event staff
9. **Scalable architecture** for future enhancements
10. **Security-first approach** with JWT authentication

---

**Document Version**: 1.0
**Last Updated**: 2025-01-19
**Author**: System Analysis based on Backend API Structure
**Status**: Ready for Frontend Development
