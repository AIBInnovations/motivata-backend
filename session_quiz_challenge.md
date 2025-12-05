### Rough Otline

# API Documentation: SOS, Sessions & Challenges

> **Version**: 1.0.0
> **Base URL**: `https://motivata.synquic.com` > **Last Updated**: December 2024

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Standard Response Format](#standard-response-format)
4. [Schemas](#schemas)
5. [SOS Quiz System](#sos-quiz-system)
6. [Sessions](#sessions)
7. [Challenges](#challenges)
8. [Webhooks & Notifications](#webhooks--notifications)

---

## Overview

This document outlines the API endpoints, request/response structures, and backend functionality required for:

- **SOS Quiz System**: Generic SOS (1-day) and Intensive SOS (7D, 14D, 30D) programs
- **Sessions**: One-to-One (OTO) and One-to-Many (OTM) session bookings
- **Challenges**: User participation in various challenges

---

## Authentication

All endpoints (except public listing) require Bearer token authentication.

### Headers

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### User Roles

| Role    | Description                    |
| ------- | ------------------------------ |
| `user`  | Regular app user               |
| `admin` | Administrator with CRUD access |

---

## Standard Response Format

All API responses follow this structure:

```typescript
interface ApiResponse<T = any> {
  status: number; // HTTP status code
  message: string; // Human-readable message
  data?: T; // Response payload
  error?: string; // Error details (only on failure)
  meta?: {
    // Pagination metadata (optional)
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Success Response Example

```json
{
  "status": 200,
  "message": "Data retrieved successfully",
  "data": { ... }
}
```

### Error Response Example

```json
{
  "status": 400,
  "message": "Validation failed",
  "error": "Quiz title is required"
}
```

---

## Schemas

### 1. SOS Program Schema

```typescript
/**
 * SOS Program - Represents a quiz program (GSOS or ISOS)
 */
interface SOSProgram {
  _id: string;
  title: string; // "Generic SOS" or "Intensive SOS"
  type: "GSOS" | "ISOS"; // Program type
  description: string; // Program description
  durationDays: number; // 1 for GSOS, 7/14/30 for ISOS
  isActive: boolean; // Whether program is available
  imageUrl?: string; // Program cover image
  createdBy: ObjectId; // Admin who created
  updatedBy?: ObjectId; // Admin who last updated
  createdAt: Date;
  updatedAt: Date;

  // Soft delete fields
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}
```

### 2. Quiz Schema (Daily Questions)

```typescript
/**
 * Quiz - Daily set of questions for an SOS program
 */
interface Quiz {
  _id: string;
  programId: ObjectId; // Reference to SOSProgram
  dayNumber: number; // Day 1, 2, 3... up to durationDays
  title: string; // Quiz title for the day
  description?: string; // Optional description
  questions: Question[]; // Array of questions
  isActive: boolean; // Whether quiz is active
  order: number; // Display order
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}

interface Question {
  _id: string;
  questionText: string; // The question
  questionType: QuestionType; // Type of question
  options?: Option[]; // For choice-based questions
  isRequired: boolean; // Whether answer is mandatory
  order: number; // Question order in quiz
  points?: number; // Optional points for scoring
  metadata?: Record<string, any>; // Additional question config
}

type QuestionType =
  | "text" // Free text input
  | "single-choice" // Radio buttons (select one)
  | "multiple-choice" // Checkboxes (select many)
  | "scale" // 1-10 or 1-5 rating scale
  | "boolean"; // Yes/No

interface Option {
  _id: string;
  text: string;
  value: string | number;
  order: number;
}
```

### 3. User Progress Schema

```typescript
/**
 * UserProgress - Tracks user's progress in SOS programs
 * NOTE: This is a separate collection, does NOT modify User schema
 */
interface UserSOSProgress {
  _id: string;
  userId: ObjectId; // Reference to User
  programId: ObjectId; // Reference to SOSProgram
  currentDay: number; // Current day (starts at 1)
  status: ProgressStatus; // Overall status
  startedAt: Date; // When user started program
  completedAt?: Date; // When user completed program
  lastActivityAt: Date; // Last interaction timestamp
  dailyProgress: DailyProgress[]; // Progress for each day
  createdAt: Date;
  updatedAt: Date;
}

type ProgressStatus = "not_started" | "in_progress" | "completed" | "abandoned";

interface DailyProgress {
  dayNumber: number;
  quizId: ObjectId;
  status: "pending" | "completed";
  completedAt?: Date;
  responses: QuizResponse[];
  score?: number;
}

interface QuizResponse {
  questionId: string;
  answer: string | string[] | number | boolean;
  answeredAt: Date;
}
```

### 4. Session Schema (Already provided - enhanced)

```typescript
/**
 * Session - Coaching/therapy session
 */
interface Session {
  _id: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  price: number;
  compareAtPrice?: number;
  duration: number; // In minutes
  sessionType: "OTO" | "OTM"; // One-to-One or One-to-Many
  category: SessionCategory; // Session category
  isLive: boolean;
  host: string;
  hostEmail?: string; // For notifications
  hostPhone?: string; // For WhatsApp
  availableSlots?: number;
  bookedSlots: number;
  calendlyLink?: string;
  sessionDate?: Date;
  imageUrl?: string;
  tags?: string[]; // For search/filter
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  remainingSlots: number;
  isFullyBooked: boolean;
  discountPercent: number;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}

type SessionCategory =
  | "therapeutic"
  | "personal_development"
  | "health"
  | "mental_wellness"
  | "career"
  | "relationships"
  | "spirituality"
  | "other";
```

### 5. Session Booking Schema

```typescript
/**
 * SessionBooking - User's booking for a session
 */
interface SessionBooking {
  _id: string;
  userId: ObjectId; // Reference to User
  sessionId: ObjectId; // Reference to Session
  bookingReference: string; // Unique booking code (e.g., "SB-ABC123")
  status: BookingStatus;
  bookedAt: Date;

  // User contact preferences
  contactMethod: "email" | "whatsapp" | "both";
  userEmail: string;
  userPhone: string;

  // Calendly integration
  calendlyEventUri?: string; // If linked to Calendly event
  scheduledSlot?: Date; // Selected time slot

  // Payment (if required)
  paymentStatus: "pending" | "paid" | "refunded" | "free";
  paymentId?: string;
  amountPaid?: number;

  // Notes
  userNotes?: string; // User's notes/questions
  adminNotes?: string; // Admin notes

  // Cancellation
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: "user" | "admin" | "host";

  createdAt: Date;
  updatedAt: Date;
}

type BookingStatus =
  | "pending" // Awaiting confirmation
  | "confirmed" // Booking confirmed
  | "scheduled" // Time slot selected via Calendly
  | "completed" // Session completed
  | "cancelled" // Booking cancelled
  | "no_show"; // User didn't attend
```

### 6. Challenge Schema

```typescript
/**
 * Challenge - Defines a challenge program
 */
interface Challenge {
  _id: string;
  title: string; // "30-Day Fitness Challenge"
  description: string;
  shortDescription: string;
  totalDays: number; // Duration in days
  category: ChallengeCategory;
  difficulty: "beginner" | "intermediate" | "advanced";
  imageUrl?: string;
  iconName?: string; // Icon identifier
  iconColor?: string; // Hex color
  isActive: boolean;
  isFeatured: boolean; // Show on homepage
  participantCount: number; // Total participants
  completionCount: number; // Total completions
  dailyTasks: DailyTask[]; // Tasks for each day
  rewards?: ChallengeReward[]; // Completion rewards
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}

type ChallengeCategory =
  | "fitness"
  | "meditation"
  | "reading"
  | "productivity"
  | "health"
  | "learning"
  | "creativity"
  | "social"
  | "finance"
  | "other";

interface DailyTask {
  dayNumber: number;
  title: string;
  description: string;
  taskType: "action" | "reflection" | "learning";
  estimatedMinutes?: number;
  resources?: TaskResource[];
}

interface TaskResource {
  type: "video" | "article" | "audio" | "link";
  title: string;
  url: string;
}

interface ChallengeReward {
  type: "badge" | "points" | "certificate";
  name: string;
  description: string;
  imageUrl?: string;
}
```

### 7. User Challenge Progress Schema

```typescript
/**
 * UserChallengeProgress - Tracks user's challenge participation
 */
interface UserChallengeProgress {
  _id: string;
  userId: ObjectId;
  challengeId: ObjectId;
  currentDay: number; // Current day (1-indexed)
  status: ChallengeProgressStatus;
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  dailyCompletion: DayCompletion[];
  streakCount: number; // Consecutive days completed
  longestStreak: number; // Best streak achieved
  totalPointsEarned: number;
  rewardsEarned: string[]; // Reward IDs
  createdAt: Date;
  updatedAt: Date;
}

type ChallengeProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "abandoned";

interface DayCompletion {
  dayNumber: number;
  taskId: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string; // User notes/reflection
  proofUrl?: string; // Photo/video proof if required
}
```

---

## SOS Quiz System

### Programs

#### GET `/api/app/sos/programs`

Get all available SOS programs.

**Authentication**: Optional (shows all active programs)

**Query Parameters**:

| Param      | Type    | Description                      |
| ---------- | ------- | -------------------------------- |
| `type`     | string  | Filter by type: `GSOS` or `ISOS` |
| `isActive` | boolean | Filter by active status          |

**Response**:

```json
{
  "status": 200,
  "message": "Programs retrieved successfully",
  "data": {
    "programs": [
      {
        "_id": "64abc123...",
        "title": "Generic SOS",
        "type": "GSOS",
        "description": "A quick 1-day self-assessment",
        "durationDays": 1,
        "isActive": true,
        "imageUrl": "https://..."
      },
      {
        "_id": "64abc456...",
        "title": "Intensive SOS - 7 Days",
        "type": "ISOS",
        "description": "A 7-day intensive self-improvement program",
        "durationDays": 7,
        "isActive": true,
        "imageUrl": "https://..."
      }
    ]
  }
}
```

---

#### GET `/api/app/sos/programs/:programId`

Get single program details with user progress.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "Program retrieved successfully",
  "data": {
    "program": {
      "_id": "64abc456...",
      "title": "Intensive SOS - 7 Days",
      "type": "ISOS",
      "description": "...",
      "durationDays": 7,
      "isActive": true
    },
    "userProgress": {
      "currentDay": 3,
      "status": "in_progress",
      "startedAt": "2024-12-01T00:00:00Z",
      "completedDays": 2,
      "progressPercentage": 28.57
    }
  }
}
```

---

#### POST `/api/app/sos/programs/:programId/start`

Start a new SOS program (user enrollment).

**Authentication**: Required

**Request Body**:

```json
{
  "durationDays": 7 // Required for ISOS (7, 14, or 30)
}
```

**Backend Logic**:

1. Check if user already has an active progress for this program
2. If existing progress is abandoned/completed, allow restart
3. Create new `UserSOSProgress` record with `currentDay: 1`
4. Return first day's quiz

**Response**:

```json
{
  "status": 201,
  "message": "Program started successfully",
  "data": {
    "progress": {
      "_id": "64def789...",
      "programId": "64abc456...",
      "currentDay": 1,
      "status": "in_progress",
      "startedAt": "2024-12-05T10:30:00Z"
    },
    "todaysQuiz": {
      "_id": "64quiz001...",
      "dayNumber": 1,
      "title": "Day 1: Self-Discovery",
      "questions": [...]
    }
  }
}
```

---

### Quizzes

#### GET `/api/app/sos/programs/:programId/quiz/today`

Get today's quiz for the user based on their progress.

**Authentication**: Required

**Backend Logic**:

1. Get user's `UserSOSProgress` for this program
2. Determine current day based on `startedAt` and today's date
3. Check if user already completed today's quiz
4. Return appropriate quiz

**Response** (Quiz Available):

```json
{
  "status": 200,
  "message": "Today's quiz retrieved",
  "data": {
    "quiz": {
      "_id": "64quiz003...",
      "dayNumber": 3,
      "title": "Day 3: Understanding Patterns",
      "description": "Let's explore your behavioral patterns",
      "questions": [
        {
          "_id": "q1",
          "questionText": "How would you rate your energy level today?",
          "questionType": "scale",
          "options": [
            { "value": 1, "text": "Very Low" },
            { "value": 2, "text": "Low" },
            { "value": 3, "text": "Moderate" },
            { "value": 4, "text": "High" },
            { "value": 5, "text": "Very High" }
          ],
          "isRequired": true,
          "order": 1
        },
        {
          "_id": "q2",
          "questionText": "What challenges did you face today?",
          "questionType": "multiple-choice",
          "options": [
            { "value": "stress", "text": "Stress at work" },
            { "value": "sleep", "text": "Poor sleep" },
            { "value": "motivation", "text": "Lack of motivation" },
            { "value": "relationships", "text": "Relationship issues" },
            { "value": "health", "text": "Health concerns" },
            { "value": "none", "text": "No major challenges" }
          ],
          "isRequired": true,
          "order": 2
        },
        {
          "_id": "q3",
          "questionText": "Describe one positive thing that happened today",
          "questionType": "text",
          "isRequired": false,
          "order": 3
        }
      ]
    },
    "progress": {
      "currentDay": 3,
      "totalDays": 7,
      "completedDays": 2,
      "isCompleted": false
    }
  }
}
```

**Response** (Already Completed Today):

```json
{
  "status": 200,
  "message": "Today's quiz already completed",
  "data": {
    "alreadyCompleted": true,
    "completedAt": "2024-12-05T09:00:00Z",
    "nextQuizAvailableAt": "2024-12-06T00:00:00Z",
    "progress": {
      "currentDay": 3,
      "totalDays": 7,
      "completedDays": 3
    }
  }
}
```

---

#### POST `/api/app/sos/quiz/:quizId/submit`

Submit quiz responses.

**Authentication**: Required

**Request Body**:

```json
{
  "responses": [
    {
      "questionId": "q1",
      "answer": 4
    },
    {
      "questionId": "q2",
      "answer": ["stress", "sleep"]
    },
    {
      "questionId": "q3",
      "answer": "Had a great conversation with my friend"
    }
  ]
}
```

**Backend Logic**:

1. Validate all required questions are answered
2. Save responses to `UserSOSProgress.dailyProgress`
3. Update `currentDay` if moving to next day
4. Check if program is completed
5. Return updated progress

**Response**:

```json
{
  "status": 200,
  "message": "Quiz submitted successfully",
  "data": {
    "submission": {
      "quizId": "64quiz003...",
      "dayNumber": 3,
      "submittedAt": "2024-12-05T14:30:00Z",
      "score": 85
    },
    "progress": {
      "currentDay": 4,
      "totalDays": 7,
      "completedDays": 3,
      "progressPercentage": 42.86,
      "isCompleted": false
    },
    "nextQuizAvailableAt": "2024-12-06T00:00:00Z"
  }
}
```

---

#### GET `/api/app/sos/progress`

Get user's progress across all SOS programs.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "Progress retrieved successfully",
  "data": {
    "activePrograms": [
      {
        "programId": "64abc456...",
        "programTitle": "Intensive SOS - 7 Days",
        "programType": "ISOS",
        "currentDay": 3,
        "totalDays": 7,
        "status": "in_progress",
        "startedAt": "2024-12-01T00:00:00Z",
        "progressPercentage": 28.57
      }
    ],
    "completedPrograms": [
      {
        "programId": "64abc123...",
        "programTitle": "Generic SOS",
        "programType": "GSOS",
        "completedAt": "2024-11-15T00:00:00Z",
        "finalScore": 78
      }
    ],
    "statistics": {
      "totalProgramsStarted": 3,
      "totalProgramsCompleted": 1,
      "totalQuizzesCompleted": 15,
      "averageScore": 82.5
    }
  }
}
```

---

#### GET `/api/app/sos/progress/:programId/history`

Get detailed history for a specific program.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "History retrieved successfully",
  "data": {
    "programId": "64abc456...",
    "programTitle": "Intensive SOS - 7 Days",
    "dailyHistory": [
      {
        "dayNumber": 1,
        "quizTitle": "Day 1: Self-Discovery",
        "status": "completed",
        "completedAt": "2024-12-01T10:00:00Z",
        "score": 80,
        "responses": [
          {
            "question": "How would you rate your energy level today?",
            "answer": 4,
            "answerText": "High"
          }
        ]
      },
      {
        "dayNumber": 2,
        "quizTitle": "Day 2: Setting Intentions",
        "status": "completed",
        "completedAt": "2024-12-02T11:30:00Z",
        "score": 85
      },
      {
        "dayNumber": 3,
        "quizTitle": "Day 3: Understanding Patterns",
        "status": "pending"
      }
    ]
  }
}
```

---

### Admin Endpoints

#### POST `/api/admin/sos/programs`

Create a new SOS program.

**Authentication**: Admin Required

**Request Body**:

```json
{
  "title": "Intensive SOS - 14 Days",
  "type": "ISOS",
  "description": "A comprehensive 14-day self-improvement journey",
  "durationDays": 14,
  "isActive": true,
  "imageUrl": "https://..."
}
```

**Response**:

```json
{
  "status": 201,
  "message": "Program created successfully",
  "data": {
    "program": { ... }
  }
}
```

---

#### PUT `/api/admin/sos/programs/:programId`

Update an SOS program.

---

#### DELETE `/api/admin/sos/programs/:programId`

Soft delete an SOS program.

---

#### POST `/api/admin/sos/programs/:programId/quiz`

Create a new quiz for a program day.

**Request Body**:

```json
{
  "dayNumber": 5,
  "title": "Day 5: Building Momentum",
  "description": "Let's build on your progress",
  "questions": [
    {
      "questionText": "How motivated do you feel?",
      "questionType": "scale",
      "options": [
        { "value": 1, "text": "Not at all" },
        { "value": 2, "text": "Slightly" },
        { "value": 3, "text": "Moderately" },
        { "value": 4, "text": "Very" },
        { "value": 5, "text": "Extremely" }
      ],
      "isRequired": true,
      "order": 1,
      "points": 10
    }
  ],
  "isActive": true
}
```

---

#### PUT `/api/admin/sos/quiz/:quizId`

Update a quiz (questions, order, etc.).

---

#### DELETE `/api/admin/sos/quiz/:quizId`

Soft delete a quiz.

---

## Sessions

### User Endpoints

#### GET `/api/app/sessions`

Get all available sessions.

**Authentication**: Optional

**Query Parameters**:

| Param         | Type    | Description                  |
| ------------- | ------- | ---------------------------- |
| `category`    | string  | Filter by category           |
| `sessionType` | string  | `OTO` or `OTM`               |
| `isLive`      | boolean | Only live sessions           |
| `minPrice`    | number  | Minimum price filter         |
| `maxPrice`    | number  | Maximum price filter         |
| `host`        | string  | Filter by host name          |
| `page`        | number  | Page number (default: 1)     |
| `limit`       | number  | Items per page (default: 10) |
| `sortBy`      | string  | `price`, `date`, `popular`   |
| `sortOrder`   | string  | `asc` or `desc`              |

**Response**:

```json
{
  "status": 200,
  "message": "Sessions retrieved successfully",
  "data": {
    "sessions": [
      {
        "_id": "64sess001...",
        "title": "Personal Growth Coaching",
        "shortDescription": "One-on-one personal development session",
        "longDescription": "...",
        "price": 1500,
        "compareAtPrice": 2000,
        "duration": 60,
        "sessionType": "OTO",
        "category": "personal_development",
        "isLive": true,
        "host": "Dr. Sarah Smith",
        "availableSlots": 1,
        "bookedSlots": 0,
        "imageUrl": "https://...",
        "remainingSlots": 1,
        "isFullyBooked": false,
        "discountPercent": 25
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

---

#### GET `/api/app/sessions/:sessionId`

Get single session details.

**Authentication**: Optional

**Response**:

```json
{
  "status": 200,
  "message": "Session retrieved successfully",
  "data": {
    "session": {
      "_id": "64sess001...",
      "title": "Personal Growth Coaching",
      "shortDescription": "...",
      "longDescription": "Detailed description of what the session covers...",
      "price": 1500,
      "compareAtPrice": 2000,
      "duration": 60,
      "sessionType": "OTO",
      "category": "personal_development",
      "isLive": true,
      "host": "Dr. Sarah Smith",
      "availableSlots": 1,
      "bookedSlots": 0,
      "calendlyLink": "https://calendly.com/dr-sarah/coaching",
      "sessionDate": null,
      "imageUrl": "https://...",
      "tags": ["coaching", "personal growth", "1:1"],
      "remainingSlots": 1,
      "isFullyBooked": false,
      "discountPercent": 25
    }
  }
}
```

---

#### GET `/api/app/sessions/categories`

Get all session categories with counts.

**Response**:

```json
{
  "status": 200,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "key": "therapeutic",
        "label": "Therapeutic",
        "count": 12,
        "icon": "heart-pulse"
      },
      {
        "key": "personal_development",
        "label": "Personal Development",
        "count": 8,
        "icon": "trending-up"
      },
      {
        "key": "mental_wellness",
        "label": "Mental Wellness",
        "count": 15,
        "icon": "brain"
      }
    ]
  }
}
```

---

#### POST `/api/app/sessions/:sessionId/book`

Book a session.

**Authentication**: Required

**Request Body**:

```json
{
  "contactMethod": "both",
  "userNotes": "I'm looking for help with career transitions"
}
```

**Backend Logic**:

1. Validate session exists and is live
2. Check if slots are available
3. Create `SessionBooking` record
4. Increment `bookedSlots` on session
5. Send notification with Calendly link via preferred method
6. Return booking confirmation

**Response**:

```json
{
  "status": 201,
  "message": "Session booked successfully",
  "data": {
    "booking": {
      "_id": "64book001...",
      "bookingReference": "SB-XYZ789",
      "sessionId": "64sess001...",
      "sessionTitle": "Personal Growth Coaching",
      "host": "Dr. Sarah Smith",
      "status": "pending",
      "bookedAt": "2024-12-05T10:30:00Z",
      "paymentStatus": "pending"
    },
    "calendlyLink": "https://calendly.com/dr-sarah/coaching",
    "nextSteps": "Please select an available time slot on Calendly. You will receive a confirmation email once your booking is confirmed."
  }
}
```

---

#### GET `/api/app/sessions/bookings`

Get user's session bookings.

**Authentication**: Required

**Query Parameters**:

| Param    | Type   | Description              |
| -------- | ------ | ------------------------ |
| `status` | string | Filter by booking status |
| `page`   | number | Page number              |
| `limit`  | number | Items per page           |

**Response**:

```json
{
  "status": 200,
  "message": "Bookings retrieved successfully",
  "data": {
    "bookings": [
      {
        "_id": "64book001...",
        "bookingReference": "SB-XYZ789",
        "session": {
          "_id": "64sess001...",
          "title": "Personal Growth Coaching",
          "host": "Dr. Sarah Smith",
          "duration": 60,
          "imageUrl": "https://..."
        },
        "status": "scheduled",
        "scheduledSlot": "2024-12-10T14:00:00Z",
        "bookedAt": "2024-12-05T10:30:00Z",
        "paymentStatus": "paid",
        "amountPaid": 1500
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "totalPages": 1
  }
}
```

---

#### GET `/api/app/sessions/bookings/:bookingId`

Get single booking details.

**Authentication**: Required

---

#### POST `/api/app/sessions/bookings/:bookingId/cancel`

Cancel a booking.

**Authentication**: Required

**Request Body**:

```json
{
  "reason": "Schedule conflict"
}
```

**Backend Logic**:

1. Validate booking belongs to user
2. Check cancellation policy (if any)
3. Update booking status to `cancelled`
4. Decrement `bookedSlots` on session
5. Process refund if applicable
6. Send cancellation notification

**Response**:

```json
{
  "status": 200,
  "message": "Booking cancelled successfully",
  "data": {
    "booking": {
      "_id": "64book001...",
      "status": "cancelled",
      "cancelledAt": "2024-12-05T12:00:00Z",
      "cancellationReason": "Schedule conflict"
    },
    "refund": {
      "status": "processing",
      "amount": 1500,
      "estimatedDate": "2024-12-10"
    }
  }
}
```

---

### Admin Endpoints

#### POST `/api/admin/sessions`

Create a new session.

**Authentication**: Admin Required

**Request Body**:

```json
{
  "title": "Group Meditation Session",
  "shortDescription": "Weekly group meditation for stress relief",
  "longDescription": "Join our weekly group meditation...",
  "price": 500,
  "compareAtPrice": 750,
  "duration": 45,
  "sessionType": "OTM",
  "category": "mental_wellness",
  "isLive": true,
  "host": "Master Chen",
  "hostEmail": "chen@example.com",
  "hostPhone": "+919876543210",
  "availableSlots": 20,
  "calendlyLink": "https://calendly.com/master-chen/meditation",
  "sessionDate": "2024-12-15T10:00:00Z",
  "imageUrl": "https://...",
  "tags": ["meditation", "group", "stress relief"]
}
```

---

#### PUT `/api/admin/sessions/:sessionId`

Update a session.

---

#### DELETE `/api/admin/sessions/:sessionId`

Soft delete a session.

---

#### GET `/api/admin/sessions/bookings`

Get all bookings (admin view).

**Query Parameters**:

| Param       | Type   | Description                |
| ----------- | ------ | -------------------------- |
| `sessionId` | string | Filter by session          |
| `status`    | string | Filter by status           |
| `startDate` | date   | Filter by date range start |
| `endDate`   | date   | Filter by date range end   |

---

#### PUT `/api/admin/sessions/bookings/:bookingId`

Update booking (confirm, reschedule, add notes).

**Request Body**:

```json
{
  "status": "confirmed",
  "adminNotes": "User confirmed via phone"
}
```

---

## Challenges

### User Endpoints

#### GET `/api/app/challenges`

Get all available challenges.

**Authentication**: Optional

**Query Parameters**:

| Param        | Type    | Description                                 |
| ------------ | ------- | ------------------------------------------- |
| `category`   | string  | Filter by category                          |
| `difficulty` | string  | `beginner`, `intermediate`, `advanced`      |
| `duration`   | string  | `short` (≤7), `medium` (8-21), `long` (>21) |
| `isFeatured` | boolean | Only featured challenges                    |
| `page`       | number  | Page number                                 |
| `limit`      | number  | Items per page                              |

**Response**:

```json
{
  "status": 200,
  "message": "Challenges retrieved successfully",
  "data": {
    "challenges": [
      {
        "_id": "64chal001...",
        "title": "30-Day Fitness Challenge",
        "shortDescription": "Transform your fitness in 30 days",
        "description": "A comprehensive fitness program...",
        "totalDays": 30,
        "category": "fitness",
        "difficulty": "intermediate",
        "imageUrl": "https://...",
        "iconName": "dumbbell",
        "iconColor": "#FF6B6B",
        "isFeatured": true,
        "participantCount": 1250,
        "completionCount": 456
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

#### GET `/api/app/challenges/:challengeId`

Get single challenge details with user progress.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "Challenge retrieved successfully",
  "data": {
    "challenge": {
      "_id": "64chal001...",
      "title": "30-Day Fitness Challenge",
      "description": "...",
      "totalDays": 30,
      "category": "fitness",
      "difficulty": "intermediate",
      "dailyTasks": [
        {
          "dayNumber": 1,
          "title": "Warm-up Basics",
          "description": "10-minute stretching routine",
          "taskType": "action",
          "estimatedMinutes": 10,
          "resources": [
            {
              "type": "video",
              "title": "Beginner Stretching Guide",
              "url": "https://..."
            }
          ]
        }
      ],
      "rewards": [
        {
          "type": "badge",
          "name": "Fitness Warrior",
          "description": "Completed 30-Day Fitness Challenge",
          "imageUrl": "https://..."
        }
      ]
    },
    "userProgress": {
      "status": "in_progress",
      "currentDay": 5,
      "startedAt": "2024-12-01T00:00:00Z",
      "completedDays": 4,
      "streakCount": 4,
      "longestStreak": 4,
      "progressPercentage": 13.33
    }
  }
}
```

---

#### POST `/api/app/challenges/:challengeId/join`

Join a challenge.

**Authentication**: Required

**Backend Logic**:

1. Check if user already participating
2. Create `UserChallengeProgress` record
3. Increment `participantCount` on challenge
4. Return progress record

**Response**:

```json
{
  "status": 201,
  "message": "Challenge joined successfully",
  "data": {
    "progress": {
      "_id": "64prog001...",
      "challengeId": "64chal001...",
      "currentDay": 1,
      "status": "in_progress",
      "startedAt": "2024-12-05T00:00:00Z",
      "streakCount": 0
    },
    "todaysTask": {
      "dayNumber": 1,
      "title": "Warm-up Basics",
      "description": "10-minute stretching routine",
      "estimatedMinutes": 10
    }
  }
}
```

---

#### GET `/api/app/challenges/:challengeId/today`

Get today's task for a challenge.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "Today's task retrieved",
  "data": {
    "task": {
      "dayNumber": 5,
      "title": "Cardio Day",
      "description": "20 minutes of light jogging or brisk walking",
      "taskType": "action",
      "estimatedMinutes": 20,
      "resources": [...]
    },
    "progress": {
      "currentDay": 5,
      "totalDays": 30,
      "completedDays": 4,
      "streakCount": 4,
      "isCompletedToday": false
    }
  }
}
```

---

#### POST `/api/app/challenges/:challengeId/complete-day`

Mark today's task as complete.

**Authentication**: Required

**Request Body**:

```json
{
  "dayNumber": 5,
  "notes": "Did 25 minutes today!",
  "proofUrl": "https://..." // Optional proof image/video
}
```

**Backend Logic**:

1. Validate day number matches current progress
2. Update `dailyCompletion` array
3. Update streak count
4. Check if challenge completed
5. Award rewards if completed

**Response**:

```json
{
  "status": 200,
  "message": "Day completed successfully",
  "data": {
    "completion": {
      "dayNumber": 5,
      "completedAt": "2024-12-05T18:00:00Z"
    },
    "progress": {
      "currentDay": 6,
      "completedDays": 5,
      "streakCount": 5,
      "longestStreak": 5,
      "progressPercentage": 16.67,
      "isCompleted": false
    },
    "streak": {
      "current": 5,
      "message": "5 days in a row! Keep it up!"
    }
  }
}
```

---

#### GET `/api/app/challenges/my-challenges`

Get user's active and completed challenges.

**Authentication**: Required

**Response**:

```json
{
  "status": 200,
  "message": "Challenges retrieved successfully",
  "data": {
    "active": [
      {
        "challengeId": "64chal001...",
        "title": "30-Day Fitness Challenge",
        "currentDay": 5,
        "totalDays": 30,
        "streakCount": 5,
        "progressPercentage": 16.67,
        "imageUrl": "https://..."
      }
    ],
    "completed": [
      {
        "challengeId": "64chal002...",
        "title": "7-Day Meditation Streak",
        "completedAt": "2024-11-20T00:00:00Z",
        "finalStreak": 7,
        "rewardsEarned": ["badge_meditation_master"]
      }
    ],
    "statistics": {
      "totalJoined": 5,
      "totalCompleted": 2,
      "currentStreak": 5,
      "longestEverStreak": 14,
      "totalDaysCompleted": 45
    }
  }
}
```

---

#### POST `/api/app/challenges/:challengeId/leave`

Leave/abandon a challenge.

**Authentication**: Required

**Request Body**:

```json
{
  "reason": "Too difficult" // Optional
}
```

---

### Admin Endpoints

#### POST `/api/admin/challenges`

Create a new challenge.

**Authentication**: Admin Required

**Request Body**:

```json
{
  "title": "21-Day Reading Challenge",
  "description": "Read for 30 minutes every day",
  "shortDescription": "Build a reading habit in 21 days",
  "totalDays": 21,
  "category": "reading",
  "difficulty": "beginner",
  "imageUrl": "https://...",
  "iconName": "book-open",
  "iconColor": "#4ECDC4",
  "isActive": true,
  "isFeatured": false,
  "dailyTasks": [
    {
      "dayNumber": 1,
      "title": "Choose Your Book",
      "description": "Select a book you've been wanting to read",
      "taskType": "action",
      "estimatedMinutes": 15
    }
  ],
  "rewards": [
    {
      "type": "badge",
      "name": "Bookworm",
      "description": "Completed 21-Day Reading Challenge"
    }
  ]
}
```

---

#### PUT `/api/admin/challenges/:challengeId`

Update a challenge.

---

#### DELETE `/api/admin/challenges/:challengeId`

Soft delete a challenge.

---

#### GET `/api/admin/challenges/:challengeId/participants`

Get challenge participants and their progress.

---

## Webhooks & Notifications

### Notification Triggers

| Event                  | Notification Type | Recipients |
| ---------------------- | ----------------- | ---------- |
| Session Booked         | Email + WhatsApp  | User, Host |
| Session Reminder       | Push + Email      | User       |
| Session Cancelled      | Email             | User, Host |
| Quiz Available         | Push              | User       |
| Challenge Day Reminder | Push              | User       |
| Challenge Completed    | Push + Email      | User       |
| Streak Milestone       | Push              | User       |

### Email Templates Needed

1. `session_booking_confirmation` - Sent to user with Calendly link
2. `session_booking_host_notification` - Sent to host about new booking
3. `session_reminder` - Sent 24h before scheduled session
4. `session_cancellation` - Sent on booking cancellation
5. `challenge_welcome` - Sent when user joins challenge
6. `challenge_completion` - Sent when challenge completed
7. `sos_program_complete` - Sent when SOS program completed

### WhatsApp Message Templates

1. **Session Booking**:

   ```
   Hi {userName}!

   Your session "{sessionTitle}" with {hostName} has been booked.

   Book your preferred time slot: {calendlyLink}

   Booking Reference: {bookingReference}
   ```

2. **Session Reminder**:

   ```
   Reminder: Your session "{sessionTitle}" is scheduled for tomorrow at {time}.

   Host: {hostName}
   Duration: {duration} minutes
   ```

---

## Error Codes Reference

| Code | Message            | Description                                |
| ---- | ------------------ | ------------------------------------------ |
| 400  | `INVALID_REQUEST`  | Missing or invalid request parameters      |
| 401  | `UNAUTHORIZED`     | Authentication required or token invalid   |
| 403  | `FORBIDDEN`        | Insufficient permissions                   |
| 404  | `NOT_FOUND`        | Resource not found                         |
| 409  | `CONFLICT`         | Resource conflict (e.g., already enrolled) |
| 422  | `VALIDATION_ERROR` | Request validation failed                  |
| 429  | `RATE_LIMITED`     | Too many requests                          |
| 500  | `SERVER_ERROR`     | Internal server error                      |

### Domain-Specific Errors

| Code | Message                       | Description                         |
| ---- | ----------------------------- | ----------------------------------- |
| 4001 | `QUIZ_ALREADY_COMPLETED`      | Today's quiz already submitted      |
| 4002 | `QUIZ_NOT_AVAILABLE`          | Quiz for this day not available yet |
| 4003 | `PROGRAM_ALREADY_STARTED`     | User already has active progress    |
| 4004 | `SESSION_FULLY_BOOKED`        | No slots available                  |
| 4005 | `BOOKING_ALREADY_CANCELLED`   | Booking already cancelled           |
| 4006 | `CHALLENGE_ALREADY_JOINED`    | Already participating in challenge  |
| 4007 | `CHALLENGE_ALREADY_COMPLETED` | Challenge already completed         |
| 4008 | `INVALID_DAY_NUMBER`          | Day doesn't match current progress  |

---

## Implementation Priority

### Phase 1: Core Features

1. SOS Programs CRUD (Admin)
2. Quiz CRUD (Admin)
3. User SOS Progress tracking
4. Quiz submission flow

### Phase 2: Sessions

1. Session CRUD (Admin)
2. Session listing & filtering
3. Session booking flow
4. Booking management

### Phase 3: Challenges

1. Challenge CRUD (Admin)
2. Challenge listing
3. Join/Leave challenge
4. Daily task completion
5. Streak tracking

### Phase 4: Notifications

1. Email integration
2. WhatsApp integration (Twilio/Meta Business API)
3. Push notifications
4. Scheduled reminders

---

## Notes for Frontend Development

### State Management Considerations

1. **SOS Progress**: Cache user's current day and completion status locally
2. **Session Bookings**: Store booking references for quick access
3. **Challenge Streaks**: Update streak count optimistically, validate on server

### Offline Support

1. Quiz responses can be queued locally if offline
2. Sync when connection restored
3. Show last known progress state

### Error Handling

1. Show user-friendly messages for domain errors
2. Retry failed API calls with exponential backoff
3. Clear error states on successful retry

---

_Document Version: 1.0.0_
_Last Updated: December 2024_
