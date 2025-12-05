# Sessions & SOS Quiz System - Implementation Plan

> **Stack**: Node.js + Express.js + MongoDB (ES Modules)

---

## Overview

### SOS Quiz System
- **Generic SOS (GSOS)**: 1-day program
- **Intensive SOS (ISOS)**: 7/14/30-day programs
- New users start from Day 1, progress tracked in separate schema (not User schema)
- Admins manage programs and daily quizzes
- Each day has unique questions

### Sessions Module
- Admin-only session creation/management
- Users browse and book sessions
- Types: OTO (One-to-One), OTM (One-to-Many)
- Categories: therapeutic, personal_development, health, mental_wellness, career, relationships, spirituality, other
- On booking: Host's Calendly link shared via email/whatsapp for slot selection

---

## Directory Structure

```
src/
├── Session/
│   ├── session.schema.js
│   ├── sessionBooking.schema.js
│   ├── session.service.js
│   ├── session.admin.controller.js
│   ├── session.user.controller.js
│   ├── session.admin.route.js
│   ├── session.user.route.js
│   └── session.validation.js
├── Quiz/
│   ├── schemas/
│   │   ├── sosProgram.schema.js
│   │   ├── quiz.schema.js
│   │   └── userSOSProgress.schema.js
│   ├── quiz.service.js
│   ├── quiz.admin.controller.js
│   ├── quiz.user.controller.js
│   ├── quiz.admin.route.js
│   ├── quiz.user.route.js
│   └── quiz.validation.js
└── shared/
    └── pagination.util.js
```

---

## Database Schemas

### Session Schema
```
title, shortDescription, longDescription (required)
price, compareAtPrice (pricing)
duration (minutes), sessionType (OTO/OTM), category (enum)
isLive, availableSlots, bookedSlots
host, hostEmail, hostPhone, calendlyLink
sessionDate, imageUrl, tags[]
createdBy, updatedBy (Admin refs)
isDeleted, deletedAt, deletedBy (soft delete)
timestamps
```
**Virtuals**: remainingSlots, isFullyBooked, discountPercent
**Methods**: softDelete(), restore(), bookSlot(), cancelBooking()

### SessionBooking Schema
```
userId, sessionId (refs)
bookingReference (SB-XXXXXX, unique)
status: pending | confirmed | scheduled | completed | cancelled | no_show
contactMethod: email | whatsapp | both
userEmail, userPhone
calendlyEventUri, scheduledSlot
paymentStatus: pending | paid | refunded | free
paymentId, amountPaid
userNotes, adminNotes
cancelledAt, cancellationReason, cancelledBy
bookedAt, timestamps
```

### SOSProgram Schema
```
title, description, imageUrl
type: GSOS | ISOS
durationDays: 1 (GSOS) or 7/14/30 (ISOS)
isActive
createdBy, updatedBy
isDeleted, deletedAt, deletedBy
timestamps
```
**Validation**: GSOS=1 day, ISOS=7/14/30 days only

### Quiz Schema
```
programId (ref)
dayNumber (1 to program.durationDays)
title, description
questions[]: {
  questionText, questionType (text/single-choice/multiple-choice/scale/boolean)
  options[]: { text, value, order }
  isRequired, order, points, metadata
}
isActive, order
createdBy, updatedBy
isDeleted, deletedAt, deletedBy
timestamps
```
**Index**: programId+dayNumber (unique compound)

### UserSOSProgress Schema
```
userId, programId (refs) - unique compound
currentDay, status: not_started | in_progress | completed | abandoned
startedAt, completedAt, lastActivityAt
dailyProgress[]: {
  dayNumber, quizId, status: pending | completed
  completedAt, responses[]: { questionId, answer, answeredAt }
  score
}
totalScore
timestamps
```
**Virtuals**: progressPercentage, completedDays

---

## API Endpoints

### Admin - Sessions (`/api/web/sessions`)
| Method | Route | Action |
|--------|-------|--------|
| POST | / | Create session |
| GET | / | List sessions (paginated, filters) |
| GET | /:id | Get session |
| PUT | /:id | Update session |
| DELETE | /:id | Soft delete session |
| GET | /bookings | List all bookings |
| PUT | /bookings/:bookingId | Update booking status |

### User - Sessions (`/api/app/sessions`)
| Method | Route | Action |
|--------|-------|--------|
| GET | / | List live sessions (public) |
| GET | /categories | Get categories with counts |
| GET | /:id | Get session details |
| POST | /:id/book | Book session (auth required) |
| GET | /bookings | Get user's bookings |
| GET | /bookings/:bookingId | Get single booking |
| POST | /bookings/:bookingId/cancel | Cancel booking |

### Admin - Quiz (`/api/web/quizzes`)
| Method | Route | Action |
|--------|-------|--------|
| POST | /programs | Create program |
| GET | /programs | List programs |
| GET | /programs/:programId | Get program with quizzes |
| PUT | /programs/:programId | Update program |
| DELETE | /programs/:programId | Delete program (cascades) |
| POST | /programs/:programId/quiz | Create quiz for day |
| GET | /:quizId | Get quiz |
| PUT | /:quizId | Update quiz |
| DELETE | /:quizId | Delete quiz |

### User - Quiz (`/api/app/quizzes`)
| Method | Route | Action |
|--------|-------|--------|
| GET | /programs | List active programs (public) |
| GET | /programs/:programId | Get program with progress |
| POST | /programs/:programId/start | Start program |
| GET | /programs/:programId/quiz/today | Get today's quiz |
| POST | /:quizId/submit | Submit quiz responses |
| GET | /progress | Get overall progress |
| GET | /progress/:programId/history | Get detailed history |

---

## Key Business Logic

### Session Booking Flow
1. User selects session → validates: isLive, !isFullyBooked, no existing booking
2. Generate unique bookingReference (SB-XXXXXX)
3. Create booking with pending status
4. Increment bookedSlots atomically
5. Return booking details + calendlyLink

### Quiz Progress Flow
1. User starts program → create progress record, get Day 1 quiz
2. Day calculation: `daysDiff = floor((today - startedAt) / 86400000) + 1`
3. Submit quiz → validate required questions, calculate score, update progress
4. Auto-complete program when all days finished

### Day Tracking Logic
- Current day = days since startedAt + 1 (capped at durationDays)
- Once today's quiz completed → next quiz available tomorrow
- Cannot skip days or submit future quizzes

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| SESSION_NOT_FOUND | 404 | Session doesn't exist |
| SESSION_NOT_LIVE | 400 | Session unavailable |
| SESSION_FULLY_BOOKED | 409 | No slots left |
| BOOKING_ALREADY_EXISTS | 409 | Active booking exists |
| BOOKING_ALREADY_CANCELLED | 409 | Already cancelled |
| CANNOT_CANCEL_COMPLETED | 400 | Completed sessions can't cancel |
| PROGRAM_NOT_FOUND | 404 | Program doesn't exist |
| PROGRAM_ALREADY_STARTED | 409 | Already enrolled |
| PROGRAM_NOT_STARTED | 400 | Must start first |
| QUIZ_NOT_FOUND | 404 | Quiz doesn't exist |
| QUIZ_ALREADY_COMPLETED | 409 | Already submitted |
| QUIZ_NOT_AVAILABLE | 404 | No quiz for today |
| REQUIRED_QUESTION_NOT_ANSWERED | 422 | Missing required answers |
| DAY_EXCEEDS_DURATION | 400 | Day > program duration |

---

## Edge Cases

### Sessions
- Race condition on last slot → use atomic `$inc`
- OTO sessions: enforce availableSlots = 1
- compareAtPrice must be >= price
- Soft delete keeps existing bookings

### Quizzes
- Day calculation from startedAt, not user input
- Multiple submissions same day → reject
- Quiz deleted mid-progress → skip to next
- Allow restart of completed program (new progress record)

---

## Implementation Order

1. **Phase 1**: Create shared/pagination.util.js
2. **Phase 2**: Session module (schema → service → controllers → routes → validation)
3. **Phase 3**: Quiz module (schemas → service → controllers → routes → validation)
4. **Phase 4**: Register routes in app.routes.js and admin.routes.js

---

## Conventions
- Services handle business logic, controllers handle HTTP
- Console logs: `[Module] Action: details` (no emojis)
- All deletes are soft deletes
- Use existing response.util.js and validation.middleware.js patterns
