# User Website Implementation Guide
## Membership Request Form (Unauthenticated)

---

## Overview

This document provides complete implementation details for the user-facing website to submit membership requests. The website is **completely unauthenticated** - users do not need to register or login to request membership. They simply fill a form with their phone number and name, and submit.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [UI Components](#ui-components)
4. [Implementation Flow](#implementation-flow)
5. [Code Examples](#code-examples)
6. [Payment Flow](#payment-flow)
7. [Error Handling](#error-handling)

---

## 1. API Endpoints

### Base URL
```
https://your-api-domain.com/api/web
```

### Authentication
**NO AUTHENTICATION REQUIRED** for these endpoints. They are public.

---

### 1.1 Get Available Membership Plans

**Endpoint:** `GET /membership-requests/plans`

**Purpose:** Display available membership plans in the form dropdown

**Request:**
```javascript
const response = await fetch(
  'https://your-api.com/api/web/membership-requests/plans'
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
      "displayPrice": "₹999",
      "durationInDays": 30,
      "durationDisplay": "1 Month",
      "perks": [
        "Free entry to all events",
        "Priority support",
        "Exclusive content access",
        "Early bird notifications"
      ],
      "metadata": {
        "popular": true,
        "badge": "Most Popular"
      }
    },
    {
      "_id": "65f9876543210abcdef54322",
      "name": "Silver Plan",
      "description": "Standard membership",
      "price": 499,
      "displayPrice": "₹499",
      "durationInDays": 30,
      "durationDisplay": "1 Month",
      "perks": [
        "Free entry to selected events",
        "Email support"
      ]
    },
    {
      "_id": "65f9876543210abcdef54323",
      "name": "Annual Gold",
      "description": "Save with yearly subscription",
      "price": 9999,
      "displayPrice": "₹9,999",
      "originalPrice": 11988,
      "durationInDays": 365,
      "durationDisplay": "12 Months",
      "perks": [
        "All Gold Plan benefits",
        "2 months free",
        "Priority event access"
      ],
      "metadata": {
        "bestValue": true,
        "badge": "Best Value",
        "discount": "17% OFF"
      }
    }
  ]
}
```

---

### 1.2 Submit Membership Request

**Endpoint:** `POST /membership-requests`

**Purpose:** User submits the membership request form

**Request Body:**
```json
{
  "phone": "9876543210",
  "name": "John Doe",
  "requestedPlanId": "65f9876543210abcdef54321"
}
```

**Fields:**
- `phone` (required) - 10-digit phone number (will be normalized)
- `name` (required) - User's full name (2-100 characters)
- `requestedPlanId` (optional) - Preferred plan ID from dropdown

**Example Request:**
```javascript
const response = await fetch(
  'https://your-api.com/api/web/membership-requests',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      phone: phoneNumber,
      name: fullName,
      requestedPlanId: selectedPlanId
    })
  }
);
const data = await response.json();
```

**Success Response:**
```json
{
  "success": true,
  "message": "Membership request submitted successfully! We'll contact you soon.",
  "data": {
    "requestId": "65f1234567890abcdef12345",
    "phone": "9876543210",
    "name": "John Doe",
    "status": "PENDING",
    "requestedPlan": {
      "name": "Gold Plan",
      "price": 999
    },
    "estimatedResponseTime": "24-48 hours"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "VALIDATION_ERROR",
  "details": {
    "phone": "Phone number must be exactly 10 digits",
    "name": "Name must be between 2 and 100 characters"
  }
}
```

---

### 1.3 Common Error Scenarios

| Error | Scenario | Message |
|-------|----------|---------|
| `VALIDATION_ERROR` | Invalid phone/name format | "Phone must be 10 digits" |
| `DUPLICATE_REQUEST` | Pending request exists for phone | "You already have a pending request" |
| `PLAN_NOT_FOUND` | Invalid plan ID | "Selected plan not found" |
| `PLAN_UNAVAILABLE` | Plan is inactive | "Selected plan is not available" |
| `SERVER_ERROR` | Backend error | "Unable to submit request. Try again." |

---

## 2. Data Models

### 2.1 MembershipPlan Object

```typescript
interface MembershipPlan {
  _id: string;
  name: string;
  description: string;
  price: number;              // In rupees
  displayPrice: string;       // Formatted: "₹999"
  originalPrice?: number;     // For showing discounts
  durationInDays: number;     // 30, 90, 365, etc.
  durationDisplay: string;    // "1 Month", "3 Months", etc.
  perks: string[];            // Array of benefit descriptions
  metadata?: {
    popular?: boolean;        // Show "Most Popular" badge
    bestValue?: boolean;      // Show "Best Value" badge
    badge?: string;           // Custom badge text
    discount?: string;        // "17% OFF"
  };
}
```

---

### 2.2 Request Form Data

```typescript
interface MembershipRequestForm {
  phone: string;              // 10-digit number
  name: string;               // 2-100 characters
  requestedPlanId?: string;   // Optional plan selection
}
```

---

### 2.3 Submit Response

```typescript
interface SubmitResponse {
  success: boolean;
  message: string;
  data?: {
    requestId: string;
    phone: string;
    name: string;
    status: 'PENDING';
    requestedPlan?: {
      name: string;
      price: number;
    };
    estimatedResponseTime: string;
  };
  error?: string;
  details?: Record<string, string>;
}
```

---

## 3. UI Components

### 3.1 Page Layout

**Layout Structure:**
```
┌────────────────────────────────────────────────┐
│              HEADER / NAVBAR                   │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │   Hero Section                           │ │
│  │   "Become a Member"                      │ │
│  │   Subtitle: "Unlock exclusive benefits"  │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │   Membership Plans Section              │ │
│  │   (3 cards: Silver, Gold, Annual)       │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │   Request Form Section                  │ │
│  │   "Request Membership"                   │ │
│  │   - Phone Number Input                   │ │
│  │   - Full Name Input                      │ │
│  │   - Plan Dropdown (optional)             │ │
│  │   - Submit Button                        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │   How It Works Section                  │ │
│  │   (3 steps)                              │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │   FAQ Section                            │ │
│  └──────────────────────────────────────────┘ │
│                                                │
├────────────────────────────────────────────────┤
│              FOOTER                            │
└────────────────────────────────────────────────┘
```

---

### 3.2 Membership Plans Cards

**Design:** 3-column grid on desktop, stacked on mobile

**Plan Card Layout:**
```
┌────────────────────────────────┐
│  [BADGE: Most Popular]         │  ← Optional badge
├────────────────────────────────┤
│                                │
│     Gold Plan                  │  ← Plan name
│     ₹999 / month               │  ← Price
│     [strikethrough: ₹1,199]    │  ← Original price (if discount)
│                                │
│  Premium membership with       │  ← Description
│  all perks                     │
│                                │
│  ✓ Free entry to all events    │  ← Perks list
│  ✓ Priority support            │
│  ✓ Exclusive content           │
│  ✓ Early bird access           │
│                                │
│  [Select This Plan Button]     │  ← CTA
│                                │
└────────────────────────────────┘
```

**Badge Variants:**
- Most Popular → Blue badge
- Best Value → Green badge
- Limited Time → Orange badge

---

### 3.3 Request Form Component

**Form Layout:**
```
┌────────────────────────────────────────────┐
│  Request Membership                        │
│  Fill in your details to get started      │
├────────────────────────────────────────────┤
│                                            │
│  Phone Number: *                           │
│  [+91] [__ __ __ __ __ __ __ __ __ __]   │
│  └─ Enter 10-digit mobile number           │
│                                            │
│  Full Name: *                              │
│  [_____________________________________]   │
│  └─ e.g., John Doe                         │
│                                            │
│  Preferred Plan: (Optional)                │
│  [Dropdown: Select a plan ▼]              │
│  └─ You can choose or let us suggest       │
│                                            │
│  Terms & Conditions                        │
│  ☐ I agree to terms and privacy policy    │
│                                            │
│        [Submit Request Button]             │
│                                            │
└────────────────────────────────────────────┘
```

**Validation Messages:**
```
Phone Number:
  ✗ "Phone number is required"
  ✗ "Phone number must be exactly 10 digits"
  ✗ "Please enter a valid phone number"

Full Name:
  ✗ "Name is required"
  ✗ "Name must be at least 2 characters"
  ✗ "Name cannot exceed 100 characters"

Terms:
  ✗ "Please accept terms and conditions"
```

---

### 3.4 Success Modal

**Design:**
```
┌───────────────────────────────────────────┐
│               ┌─────┐                     │
│               │  ✓  │  Success!           │
│               └─────┘                     │
├───────────────────────────────────────────┤
│                                           │
│  Your membership request has been         │
│  submitted successfully!                  │
│                                           │
│  Request ID: #...12345                    │
│                                           │
│  What happens next?                       │
│                                           │
│  1️⃣  Our team will review your request   │
│     within 24-48 hours                    │
│                                           │
│  2️⃣  You'll receive a payment link via   │
│     WhatsApp on: +91 98765 43210         │
│                                           │
│  3️⃣  Complete the payment to activate    │
│     your membership instantly             │
│                                           │
│  Keep your phone handy!                   │
│                                           │
│            [Done Button]                  │
│                                           │
└───────────────────────────────────────────┘
```

---

### 3.5 How It Works Section

**3-Step Process:**

```
┌──────────────────────────────────────────────────────────┐
│               How It Works                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ①                    ②                    ③            │
│  ┌────┐              ┌────┐              ┌────┐          │
│  │📝  │              │💳  │              │✅  │          │
│  └────┘              └────┘              └────┘          │
│                                                          │
│  Submit Form        Get Payment Link    Activate         │
│                                                          │
│  Fill in your       Receive secure      Complete payment │
│  phone & name       payment link via    & enjoy benefits │
│  in 30 seconds      WhatsApp            instantly        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### 3.6 FAQ Section (Accordion)

**Questions:**
1. Do I need to register to request membership?
   - No! Simply provide your phone number and name.

2. How long does approval take?
   - Usually 24-48 hours. You'll be notified via WhatsApp.

3. What if I don't select a plan?
   - Our team will recommend the best plan for you.

4. Is my payment secure?
   - Yes! We use Razorpay for secure payments.

5. What happens after I pay?
   - Your membership activates instantly and you get full access.

6. Can I cancel or get a refund?
   - Please contact support for refund requests.

---

## 4. Implementation Flow

### 4.1 Page Load Flow

```javascript
// On component mount
useEffect(() => {
  // 1. Fetch available membership plans
  fetchMembershipPlans();

  // 2. Check if there's a success message in URL (after redirect)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    showSuccessMessage();
  }
}, []);
```

---

### 4.2 Form Submission Flow

```
User fills form
      ↓
[Client-side validation]
      ↓
   Valid? ────NO───→ Show validation errors
      ↓ YES
[POST /membership-requests]
      ↓
   Success? ───NO───→ Show error message
      ↓ YES
Show success modal
      ↓
Reset form
      ↓
(User waits for WhatsApp)
```

---

### 4.3 Payment Link Receipt Flow

```
User submits form
      ↓
Admin reviews (24-48h)
      ↓
Admin approves
      ↓
User receives WhatsApp with:
  - Greeting
  - Plan name
  - Amount
  - Payment link
  - Expiry info
      ↓
User clicks link
      ↓
Opens Razorpay page
      ↓
Phone prefilled
      ↓
User completes payment
      ↓
Redirected to success page
      ↓
Membership activated
```

---

## 5. Code Examples

### 5.1 Complete React Component (Main Page)

```jsx
import React, { useState, useEffect } from 'react';

const MembershipRequestPage = () => {
  // State
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    requestedPlanId: ''
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // API Base URL
  const API_BASE = 'https://your-api.com/api/web';

  // Fetch membership plans
  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/membership-requests/plans`
      );
      const data = await response.json();

      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, []);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Phone validation
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (!phoneDigits) {
      newErrors.phone = 'Phone number is required';
    } else if (phoneDigits.length !== 10) {
      newErrors.phone = 'Phone number must be exactly 10 digits';
    }

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Name cannot exceed 100 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      // Normalize phone to 10 digits
      const phoneDigits = formData.phone.replace(/\D/g, '').slice(-10);

      // Submit request
      const response = await fetch(
        `${API_BASE}/membership-requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: phoneDigits,
            name: formData.name.trim(),
            requestedPlanId: formData.requestedPlanId || undefined
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        // Show success modal
        setSubmittedData(data.data);
        setShowSuccessModal(true);

        // Reset form
        setFormData({
          phone: '',
          name: '',
          requestedPlanId: ''
        });

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Handle error
        if (data.error === 'VALIDATION_ERROR' && data.details) {
          setErrors(data.details);
        } else {
          alert(data.message || 'Failed to submit request');
        }
      }
    } catch (error) {
      console.error('Submission error:', error);
      alert('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Select plan (from plan card)
  const selectPlan = (planId) => {
    setFormData(prev => ({
      ...prev,
      requestedPlanId: planId
    }));

    // Scroll to form
    document.getElementById('request-form')?.scrollIntoView({
      behavior: 'smooth'
    });
  };

  return (
    <div className="membership-page">
      {/* Hero Section */}
      <section className="hero">
        <h1>Become a Member</h1>
        <p>Unlock exclusive benefits and premium experiences</p>
      </section>

      {/* Membership Plans */}
      <section className="plans-section">
        <h2>Choose Your Plan</h2>

        {loading ? (
          <div className="loading">Loading plans...</div>
        ) : (
          <div className="plans-grid">
            {plans.map(plan => (
              <PlanCard
                key={plan._id}
                plan={plan}
                onSelect={() => selectPlan(plan._id)}
                isSelected={formData.requestedPlanId === plan._id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Request Form */}
      <section className="form-section" id="request-form">
        <h2>Request Membership</h2>
        <p>Fill in your details to get started</p>

        <form onSubmit={handleSubmit} className="request-form">
          {/* Phone Number */}
          <div className="form-group">
            <label htmlFor="phone">
              Phone Number <span className="required">*</span>
            </label>
            <div className="phone-input">
              <span className="country-code">+91</span>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="9876543210"
                maxLength="10"
                className={errors.phone ? 'error' : ''}
              />
            </div>
            {errors.phone && (
              <span className="error-message">{errors.phone}</span>
            )}
            <small>Enter your 10-digit mobile number</small>
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="name">
              Full Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="John Doe"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && (
              <span className="error-message">{errors.name}</span>
            )}
          </div>

          {/* Plan Selection */}
          <div className="form-group">
            <label htmlFor="requestedPlanId">
              Preferred Plan (Optional)
            </label>
            <select
              id="requestedPlanId"
              name="requestedPlanId"
              value={formData.requestedPlanId}
              onChange={handleChange}
            >
              <option value="">Let us suggest the best plan</option>
              {plans.map(plan => (
                <option key={plan._id} value={plan._id}>
                  {plan.name} - {plan.displayPrice}
                </option>
              ))}
            </select>
            <small>You can choose or let our team recommend</small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-icon">📝</div>
            <h3>1. Submit Form</h3>
            <p>Fill in your phone & name in 30 seconds</p>
          </div>
          <div className="step">
            <div className="step-icon">💳</div>
            <h3>2. Get Payment Link</h3>
            <p>Receive secure payment link via WhatsApp</p>
          </div>
          <div className="step">
            <div className="step-icon">✅</div>
            <h3>3. Activate</h3>
            <p>Complete payment & enjoy benefits instantly</p>
          </div>
        </div>
      </section>

      {/* Success Modal */}
      {showSuccessModal && (
        <SuccessModal
          data={submittedData}
          onClose={() => setShowSuccessModal(false)}
        />
      )}
    </div>
  );
};

export default MembershipRequestPage;
```

---

### 5.2 Plan Card Component

```jsx
const PlanCard = ({ plan, onSelect, isSelected }) => {
  // Check for badges
  const badge = plan.metadata?.badge;
  const isPopular = plan.metadata?.popular;
  const isBestValue = plan.metadata?.bestValue;
  const discount = plan.metadata?.discount;

  return (
    <div className={`plan-card ${isSelected ? 'selected' : ''}`}>
      {/* Badge */}
      {badge && (
        <div className={`badge ${
          isPopular ? 'popular' :
          isBestValue ? 'best-value' : ''
        }`}>
          {badge}
        </div>
      )}

      {/* Plan Name */}
      <h3 className="plan-name">{plan.name}</h3>

      {/* Price */}
      <div className="price">
        <span className="amount">{plan.displayPrice}</span>
        {plan.originalPrice && (
          <span className="original-price">
            ₹{plan.originalPrice}
          </span>
        )}
        {discount && (
          <span className="discount-badge">{discount}</span>
        )}
      </div>

      {/* Duration */}
      <div className="duration">{plan.durationDisplay}</div>

      {/* Description */}
      <p className="description">{plan.description}</p>

      {/* Perks */}
      <ul className="perks-list">
        {plan.perks.map((perk, index) => (
          <li key={index}>
            <span className="check-icon">✓</span>
            {perk}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        className="select-btn"
        onClick={onSelect}
      >
        {isSelected ? 'Selected ✓' : 'Select This Plan'}
      </button>
    </div>
  );
};
```

---

### 5.3 Success Modal Component

```jsx
const SuccessModal = ({ data, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content success-modal" onClick={e => e.stopPropagation()}>
        {/* Success Icon */}
        <div className="success-icon">
          <svg viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="25" fill="none"/>
            <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>

        <h2>Request Submitted Successfully!</h2>

        <p className="modal-description">
          Your membership request has been submitted successfully!
        </p>

        <div className="request-id">
          Request ID: <strong>#{data.requestId.slice(-8)}</strong>
        </div>

        <div className="next-steps">
          <h3>What happens next?</h3>

          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <strong>Team Review</strong>
              <p>Our team will review your request within 24-48 hours</p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <strong>Payment Link via WhatsApp</strong>
              <p>You'll receive a payment link on: +91 {data.phone}</p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <strong>Instant Activation</strong>
              <p>Complete payment to activate your membership instantly</p>
            </div>
          </div>
        </div>

        {data.requestedPlan && (
          <div className="selected-plan">
            <strong>Requested Plan:</strong> {data.requestedPlan.name}
            <br />
            <strong>Price:</strong> ₹{data.requestedPlan.price}
          </div>
        )}

        <div className="tip">
          💡 <strong>Tip:</strong> Keep your phone handy to receive our WhatsApp message!
        </div>

        <button className="close-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};
```

---

### 5.4 Phone Input Formatting (Optional Enhancement)

```jsx
// Auto-format phone as user types
const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, '');

  if (digits.length <= 10) {
    return digits;
  }

  // Limit to 10 digits
  return digits.slice(-10);
};

// In input handler
const handlePhoneChange = (e) => {
  const formatted = formatPhoneNumber(e.target.value);
  setFormData(prev => ({
    ...prev,
    phone: formatted
  }));
};
```

---

### 5.5 Form Validation Helper

```javascript
// Comprehensive validation
const validateField = (name, value) => {
  switch (name) {
    case 'phone':
      const phoneDigits = value.replace(/\D/g, '');
      if (!phoneDigits) {
        return 'Phone number is required';
      }
      if (phoneDigits.length !== 10) {
        return 'Phone number must be exactly 10 digits';
      }
      if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
        return 'Please enter a valid Indian mobile number';
      }
      return '';

    case 'name':
      const trimmed = value.trim();
      if (!trimmed) {
        return 'Name is required';
      }
      if (trimmed.length < 2) {
        return 'Name must be at least 2 characters';
      }
      if (trimmed.length > 100) {
        return 'Name cannot exceed 100 characters';
      }
      if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
        return 'Name can only contain letters and spaces';
      }
      return '';

    default:
      return '';
  }
};

// Real-time validation
const handleBlur = (e) => {
  const { name, value } = e.target;
  const error = validateField(name, value);

  setErrors(prev => ({
    ...prev,
    [name]: error
  }));
};
```

---

## 6. Payment Flow

### 6.1 What Happens After Form Submission

```
User submits form
      ↓
Backend creates MembershipRequest
Status: PENDING
      ↓
User sees success modal
      ↓
[USER WAITS - No action needed]
      ↓
Admin reviews (within 24-48h)
      ↓
Admin approves with plan & amount
      ↓
Backend generates Razorpay payment link
      ↓
WhatsApp sent to user's phone:

    ┌─────────────────────────────────┐
    │ Hello John Doe!                 │
    │                                 │
    │ Your membership request has     │
    │ been approved! 🎉               │
    │                                 │
    │ Plan: Gold Plan                 │
    │ Amount: ₹999                    │
    │ Validity: 30 days               │
    │                                 │
    │ Complete payment:               │
    │ https://rzp.io/l/AbC123XyZ      │
    │                                 │
    │ QR Code: [___]                  │
    │                                 │
    │ Link expires in 7 days          │
    └─────────────────────────────────┘

      ↓
User clicks link
      ↓
Opens Razorpay payment page:

    ┌─────────────────────────────────┐
    │  Pay ₹999                       │
    │  to Motivata                    │
    ├─────────────────────────────────┤
    │  Contact: 9876543210            │ ← Prefilled!
    │  [Continue]                     │
    └─────────────────────────────────┘

      ↓
User enters card/UPI details
      ↓
Payment successful
      ↓
Razorpay sends webhook to backend
      ↓
Backend:
  - Creates UserMembership (status: ACTIVE)
  - Updates MembershipRequest (status: COMPLETED)
  - Calculates start/end dates
      ↓
User redirected to success page
      ↓
Membership is ACTIVE!
```

---

### 6.2 Payment Success Page (Optional)

If Razorpay redirects back to your website after payment:

**URL:** `https://your-website.com/membership-payment-success`

**Design:**
```
┌───────────────────────────────────────────┐
│               ┌─────┐                     │
│               │  ✓  │  Payment Successful!│
│               └─────┘                     │
├───────────────────────────────────────────┤
│                                           │
│  Congratulations! Your membership is      │
│  now ACTIVE. 🎉                           │
│                                           │
│  Membership Details:                      │
│  ┌─────────────────────────────────────┐ │
│  │ Plan:        Gold Plan              │ │
│  │ Amount Paid: ₹999                   │ │
│  │ Valid From:  Mar 15, 2024           │ │
│  │ Valid Until: Apr 14, 2024           │ │
│  │ Status:      🟢 Active              │ │
│  └─────────────────────────────────────┘ │
│                                           │
│  What's Next?                             │
│  • Download our app to access benefits    │
│  • Check your registered email for        │
│    membership confirmation                │
│                                           │
│  [Download App]  [Go to Homepage]         │
│                                           │
└───────────────────────────────────────────┘
```

**Implementation:**
```jsx
const PaymentSuccessPage = () => {
  useEffect(() => {
    // Optional: Fetch membership details from backend
    // using orderId from URL params

    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');

    if (orderId) {
      // Fetch membership details
      fetchMembershipDetails(orderId);
    }
  }, []);

  return (
    <div className="payment-success-page">
      <div className="success-icon">✓</div>
      <h1>Payment Successful!</h1>
      <p>Congratulations! Your membership is now ACTIVE.</p>

      {/* Show membership details */}

      <div className="actions">
        <button onClick={() => window.location.href = '/download'}>
          Download App
        </button>
        <button onClick={() => window.location.href = '/'}>
          Go to Homepage
        </button>
      </div>
    </div>
  );
};
```

---

## 7. Error Handling

### 7.1 Client-Side Validation Errors

**Display Strategy:**
- Show inline error messages below input fields
- Highlight invalid fields with red border
- Disable submit button while errors exist (optional)

**Example:**
```jsx
{errors.phone && (
  <span className="error-message">
    <svg className="error-icon" />
    {errors.phone}
  </span>
)}
```

---

### 7.2 API Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case 400:
        // Validation error
        if (data.error === 'DUPLICATE_REQUEST') {
          showModal(
            'Pending Request Exists',
            'You already have a pending membership request. ' +
            'Please wait for our team to review it. ' +
            'You should receive a payment link within 24-48 hours.'
          );
        } else if (data.error === 'VALIDATION_ERROR') {
          // Show field errors
          if (data.details) {
            setErrors(data.details);
          } else {
            showToast(data.message, 'error');
          }
        } else {
          showToast(data.message || 'Invalid request', 'error');
        }
        break;

      case 404:
        showToast('Selected plan not found', 'error');
        break;

      case 500:
        showModal(
          'Server Error',
          'We\'re experiencing technical difficulties. ' +
          'Please try again in a few minutes.'
        );
        break;

      default:
        showToast('Something went wrong. Please try again.', 'error');
    }
  } else if (error.request) {
    // Network error
    showModal(
      'Network Error',
      'Please check your internet connection and try again.'
    );
  } else {
    showToast('An unexpected error occurred', 'error');
  }
};

// Usage
try {
  const response = await fetch(...);
  const data = await response.json();

  if (!response.ok) {
    handleApiError({ response: { status: response.status, data } });
    return;
  }

  // Success handling
} catch (error) {
  handleApiError(error);
}
```

---

### 7.3 User-Friendly Error Messages

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| `VALIDATION_ERROR: Phone invalid` | "Please enter a valid 10-digit phone number" |
| `DUPLICATE_REQUEST` | "You already have a pending request. We'll contact you soon!" |
| `PLAN_NOT_FOUND` | "Selected plan is no longer available. Please choose another." |
| `PLAN_UNAVAILABLE` | "This plan is currently unavailable. Please select another option." |
| `SERVER_ERROR` | "We're experiencing technical issues. Please try again in a few minutes." |
| `NETWORK_ERROR` | "Network connection lost. Please check your internet and try again." |

---

## 8. Styling Guide

### 8.1 Color Palette

```css
:root {
  /* Primary colors */
  --primary-color: #2563eb;      /* Blue for CTAs */
  --primary-hover: #1d4ed8;
  --primary-light: #dbeafe;

  /* Success/Error */
  --success-color: #10b981;
  --error-color: #ef4444;
  --warning-color: #f59e0b;

  /* Neutral colors */
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
  --bg-light: #f9fafb;

  /* Badge colors */
  --badge-popular: #3b82f6;
  --badge-best-value: #10b981;
  --badge-limited: #f59e0b;
}
```

---

### 8.2 Responsive Breakpoints

```css
/* Mobile first approach */

/* Mobile: 0-639px (default) */

/* Tablet */
@media (min-width: 640px) {
  .plans-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .plans-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .form-section {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

### 8.3 Sample CSS (Plan Card)

```css
.plan-card {
  position: relative;
  background: white;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 32px 24px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.plan-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-4px);
}

.plan-card.selected {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.plan-card .badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.badge.popular {
  background: var(--badge-popular);
}

.badge.best-value {
  background: var(--badge-best-value);
}

.plan-name {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.price {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.price .amount {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-color);
}

.price .original-price {
  font-size: 18px;
  text-decoration: line-through;
  color: var(--text-secondary);
}

.perks-list {
  list-style: none;
  padding: 0;
  margin: 24px 0;
}

.perks-list li {
  display: flex;
  align-items: start;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.check-icon {
  color: var(--success-color);
  font-weight: 700;
}

.select-btn {
  width: 100%;
  padding: 12px 24px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.select-btn:hover {
  background: var(--primary-hover);
}

.plan-card.selected .select-btn {
  background: var(--success-color);
}
```

---

## 9. Testing Checklist

### 9.1 Functional Tests

- [ ] Plans load correctly on page load
- [ ] Form validates phone number (10 digits required)
- [ ] Form validates name (2-100 characters)
- [ ] Form prevents submission with invalid data
- [ ] Success modal appears after successful submission
- [ ] Form resets after successful submission
- [ ] Error messages display for API errors
- [ ] Duplicate request error shows friendly message
- [ ] Plan selection from card updates form dropdown
- [ ] Form submission works without selecting a plan
- [ ] Phone number automatically normalized
- [ ] Name automatically formatted (title case)

---

### 9.2 UI/UX Tests

- [ ] Page is responsive (mobile, tablet, desktop)
- [ ] Plan cards display correctly in grid
- [ ] Badges show on appropriate plans
- [ ] Hover effects work on plan cards
- [ ] Selected plan is visually highlighted
- [ ] Form inputs have proper focus states
- [ ] Error messages are clearly visible
- [ ] Loading states show during API calls
- [ ] Success modal is centered and readable
- [ ] CTA buttons are prominent
- [ ] Form scrolls into view when plan selected

---

### 9.3 Edge Cases

- [ ] Empty plans array handled gracefully
- [ ] Network error displays user-friendly message
- [ ] API timeout handled properly
- [ ] Long plan names don't break layout
- [ ] Long perk descriptions don't overflow
- [ ] Special characters in name handled
- [ ] Phone with country code normalized correctly
- [ ] Form works without JavaScript (progressive enhancement)
- [ ] Back button doesn't resubmit form
- [ ] Page refresh doesn't show stale success modal

---

## 10. Performance Optimization

### 10.1 Image Optimization

```jsx
// Use lazy loading for images
<img
  src="/images/membership-hero.jpg"
  alt="Membership benefits"
  loading="lazy"
/>

// Use modern formats (WebP)
<picture>
  <source srcSet="/images/hero.webp" type="image/webp" />
  <img src="/images/hero.jpg" alt="Hero" />
</picture>
```

---

### 10.2 Code Splitting

```jsx
// Lazy load success modal
const SuccessModal = React.lazy(() =>
  import('./components/SuccessModal')
);

// Usage
<Suspense fallback={<div>Loading...</div>}>
  {showSuccessModal && <SuccessModal {...props} />}
</Suspense>
```

---

### 10.3 API Caching

```javascript
// Cache plans for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let cachedPlans = null;
let cacheTime = null;

const fetchPlans = async () => {
  const now = Date.now();

  if (cachedPlans && cacheTime && (now - cacheTime) < CACHE_DURATION) {
    return cachedPlans;
  }

  const response = await fetch(`${API_BASE}/membership-requests/plans`);
  const data = await response.json();

  cachedPlans = data.data;
  cacheTime = now;

  return cachedPlans;
};
```

---

## 11. Analytics Tracking (Optional)

### 11.1 Track Key Events

```javascript
// Page load
trackEvent('membership_page_view');

// Plan viewed
trackEvent('plan_viewed', {
  planId: plan._id,
  planName: plan.name,
  price: plan.price
});

// Plan selected
trackEvent('plan_selected', {
  planId: plan._id,
  planName: plan.name
});

// Form started
trackEvent('form_started');

// Form submitted
trackEvent('form_submitted', {
  hasSelectedPlan: !!formData.requestedPlanId
});

// Submission success
trackEvent('request_submitted_success', {
  requestId: data.requestId,
  selectedPlan: data.requestedPlan?.name
});

// Submission error
trackEvent('request_submitted_error', {
  error: error.message
});
```

---

### 11.2 Google Analytics Example

```javascript
// Using gtag
window.gtag('event', 'membership_request', {
  event_category: 'Engagement',
  event_label: formData.requestedPlanId ? 'With Plan' : 'Without Plan',
  value: formData.requestedPlanId
});
```

---

## 12. Accessibility (a11y)

### 12.1 Form Accessibility

```jsx
<form onSubmit={handleSubmit} aria-label="Membership request form">
  <div className="form-group">
    <label htmlFor="phone">
      Phone Number
      <span className="required" aria-label="required">*</span>
    </label>
    <input
      type="tel"
      id="phone"
      name="phone"
      aria-required="true"
      aria-invalid={!!errors.phone}
      aria-describedby={errors.phone ? 'phone-error' : undefined}
    />
    {errors.phone && (
      <span id="phone-error" className="error-message" role="alert">
        {errors.phone}
      </span>
    )}
  </div>

  <button type="submit" aria-label="Submit membership request">
    Submit Request
  </button>
</form>
```

---

### 12.2 Keyboard Navigation

```css
/* Focus visible styles */
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

/* Remove default outline for mouse users */
button:focus:not(:focus-visible),
input:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 13. SEO Optimization

### 13.1 Meta Tags

```html
<head>
  <title>Become a Member - Motivata | Exclusive Benefits & Perks</title>

  <meta name="description" content="Join Motivata membership for exclusive benefits, free event access, priority support, and premium experiences. Choose from flexible plans starting at ₹499/month." />

  <meta property="og:title" content="Motivata Membership - Join Today" />
  <meta property="og:description" content="Unlock exclusive benefits with Motivata membership" />
  <meta property="og:image" content="https://your-site.com/og-image.jpg" />
  <meta property="og:url" content="https://your-site.com/membership" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Motivata Membership" />
  <meta name="twitter:description" content="Join for exclusive benefits" />

  <link rel="canonical" href="https://your-site.com/membership" />
</head>
```

---

### 13.2 Structured Data (JSON-LD)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Motivata Gold Membership",
  "description": "Premium membership with exclusive benefits",
  "image": "https://your-site.com/images/gold-plan.jpg",
  "offers": {
    "@type": "Offer",
    "price": "999",
    "priceCurrency": "INR",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

---

## 14. Summary

This guide covers:

✅ Complete API integration (no authentication needed)
✅ UI components with responsive design
✅ Form validation and error handling
✅ Success flow and user feedback
✅ Payment link receipt via WhatsApp
✅ React code examples
✅ Styling guidelines
✅ Testing checklist
✅ Performance optimization
✅ Accessibility best practices

**Key Points:**
- Website is completely public (no user authentication)
- Users only provide: phone number + name + optional plan
- Admin approves → payment link sent via WhatsApp
- Phone number is prefilled in payment page
- Membership activates automatically after payment

**Implementation Steps:**
1. Design UI components based on mockups
2. Integrate public API endpoints
3. Add form validation
4. Implement success/error states
5. Test all flows thoroughly
6. Deploy to production

---

**Document Version:** 1.0
**Last Updated:** 2024-03-15
**Author:** Backend Team
