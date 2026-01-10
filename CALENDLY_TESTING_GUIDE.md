# Calendly Integration Testing Guide

This guide covers testing the Calendly integration for both **Free Plan (Public Mode)** and **Paid Plan (PAT Mode)**.

---

## Prerequisites

1. **Server Running**: Ensure your backend server is running
   ```bash
   npm start
   # or
   npm run dev
   ```

2. **Admin Authentication**: You need an admin JWT token
   - Login as admin: `POST /api/web/login`
   - Copy the JWT token from the response

3. **Calendly Account**: Create a free account at https://calendly.com

---

## Option 1: Free Plan (Public Mode) - RECOMMENDED FOR TESTING

This mode works with Calendly's free plan using public URLs.

### Step 1: Setup Calendly Event Types

1. Log into your Calendly account at https://calendly.com
2. Go to **Event Types** in the dashboard
3. Create one or more event types (e.g., "30 Minute Meeting")
4. Note down:
   - Your Calendly username (from your profile URL: `calendly.com/YOUR_USERNAME`)
   - Event type slugs (from event URLs: `calendly.com/YOUR_USERNAME/SLUG`)

**Example:**
- Profile URL: `https://calendly.com/johndoe`
- Username: `johndoe`
- Event Type URL: `https://calendly.com/johndoe/30min`
- Event Slug: `30min`

### Step 2: Configure Calendly (Public Mode)

Use Postman or curl to configure Calendly:

**Request:**
```http
POST http://localhost:3000/api/web/calendly/configure-public
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "calendlyUsername": "johndoe",
  "eventTypes": [
    {
      "name": "30 Minute Meeting",
      "slug": "30min",
      "duration": 30
    },
    {
      "name": "60 Minute Consultation",
      "slug": "60min-consultation",
      "duration": 60
    }
  ]
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly configured successfully (public mode)",
  "data": {
    "calendlyUsername": "johndoe",
    "eventTypesCount": 2,
    "connectedAt": "2026-01-05T10:30:00.000Z",
    "mode": "public"
  }
}
```

### Step 3: Check Connection Status

**Request:**
```http
GET http://localhost:3000/api/web/calendly/connection/status
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly connection status retrieved",
  "data": {
    "connected": true,
    "connectionMode": "public",
    "calendlyUsername": "johndoe",
    "eventTypes": [
      {
        "uri": "https://calendly.com/johndoe/30min",
        "name": "30 Minute Meeting",
        "slug": "30min",
        "active": true,
        "duration": 30,
        "schedulingUrl": "https://calendly.com/johndoe/30min"
      },
      {
        "uri": "https://calendly.com/johndoe/60min-consultation",
        "name": "60 Minute Consultation",
        "slug": "60min-consultation",
        "active": true,
        "duration": 60,
        "schedulingUrl": "https://calendly.com/johndoe/60min-consultation"
      }
    ],
    "connectedAt": "2026-01-05T10:30:00.000Z",
    "lastSyncedAt": "2026-01-05T10:30:00.000Z"
  }
}
```

### Step 4: Get Available Slots (Public Endpoint)

This endpoint is **PUBLIC** - no authentication required!

**Request:**
```http
GET http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min
```

**Note:** The event type URI must be URL-encoded. Use:
- Encoded: `https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min`
- Original: `https://calendly.com/johndoe/30min`

**Expected Response (Public Mode):**
```json
{
  "success": true,
  "message": "Calendly booking URL (public mode)",
  "data": {
    "eventTypeUri": "https://calendly.com/johndoe/30min",
    "calendlyUrl": "https://calendly.com/johndoe/30min",
    "mode": "public",
    "message": "Use this URL to embed Calendly widget or redirect users for booking",
    "embedInstructions": {
      "iframe": "<iframe src=\"https://calendly.com/johndoe/30min\" width=\"100%\" height=\"600px\" frameborder=\"0\"></iframe>",
      "redirect": "window.location.href = \"https://calendly.com/johndoe/30min\""
    }
  }
}
```

### Step 5: Test Frontend Integration

In your frontend, you can:

**Option A: Embed with iframe**
```html
<iframe
  src="https://calendly.com/johndoe/30min"
  width="100%"
  height="600px"
  frameborder="0">
</iframe>
```

**Option B: Redirect to Calendly**
```javascript
window.location.href = "https://calendly.com/johndoe/30min";
```

**Option C: Use Calendly's official embed widget**
```html
<!-- Add Calendly embed widget -->
<link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
<script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async></script>

<!-- Inline embed -->
<div class="calendly-inline-widget"
     data-url="https://calendly.com/johndoe/30min"
     style="min-width:320px;height:630px;">
</div>
```

---

## Option 2: Paid Plan (PAT Mode) - For Advanced Features

This mode requires a Calendly **Professional, Teams, or Enterprise** plan.

### Step 1: Generate Personal Access Token

1. Log into Calendly at https://calendly.com
2. Go to **Account Settings** → **Integrations** → **API & Webhooks**
3. Scroll to **Personal Access Tokens** section
4. Click **"Generate New Token"**
5. Give it a name: "Motivata Backend"
6. Copy the generated token (starts with `eyJ...`)
7. **IMPORTANT**: Save this token securely - it won't be shown again

### Step 2: Save Token in Backend

**Request:**
```http
POST http://localhost:3000/api/web/calendly/token
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "accessToken": "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY..."
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly connected successfully",
  "data": {
    "calendlyUserId": "https://api.calendly.com/users/XXXXXXXX",
    "eventTypesCount": 3,
    "connectedAt": "2026-01-05T10:45:00.000Z"
  }
}
```

### Step 3: Check Connection Status

**Request:**
```http
GET http://localhost:3000/api/web/calendly/connection/status
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly connection status retrieved",
  "data": {
    "connected": true,
    "connectionMode": "pat",
    "calendlyUserId": "https://api.calendly.com/users/XXXXXXXX",
    "organizationUri": "https://api.calendly.com/organizations/YYYYYYYY",
    "eventTypes": [
      {
        "uri": "https://api.calendly.com/event_types/ZZZZZ",
        "name": "30 Minute Meeting",
        "slug": "30min",
        "active": true,
        "duration": 30,
        "schedulingUrl": "https://calendly.com/johndoe/30min"
      }
    ],
    "connectedAt": "2026-01-05T10:45:00.000Z",
    "lastSyncedAt": "2026-01-05T10:45:00.000Z",
    "lastValidatedAt": "2026-01-05T10:45:00.000Z"
  }
}
```

### Step 4: Sync Event Types

Refresh event types from Calendly:

**Request:**
```http
POST http://localhost:3000/api/web/calendly/event-types/sync
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Event types synced successfully",
  "data": {
    "eventTypes": [...],
    "syncedAt": "2026-01-05T10:50:00.000Z"
  }
}
```

### Step 5: Get Available Slots (PAT Mode)

**Request:**
```http
GET http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fapi.calendly.com%2Fevent_types%2FZZZZZ?start_date=2026-01-05&end_date=2026-02-05
```

**Expected Response (PAT Mode - Actual Slots):**
```json
{
  "success": true,
  "message": "Available slots retrieved",
  "data": {
    "eventTypeUri": "https://api.calendly.com/event_types/ZZZZZ",
    "slots": [
      {
        "start": "2026-01-05T10:00:00Z",
        "end": "2026-01-05T10:30:00Z",
        "status": "available"
      },
      {
        "start": "2026-01-05T14:00:00Z",
        "end": "2026-01-05T14:30:00Z",
        "status": "available"
      },
      {
        "start": "2026-01-06T09:00:00Z",
        "end": "2026-01-06T09:30:00Z",
        "status": "available"
      }
    ],
    "cached": false
  }
}
```

**Benefits of PAT Mode:**
- Get actual available time slots from Calendly API
- More granular control over booking flow
- Can display slots directly in your UI without redirecting

---

## Testing Disconnect

**Request:**
```http
POST http://localhost:3000/api/web/calendly/connection/disconnect
Authorization: Bearer YOUR_SUPER_ADMIN_JWT_TOKEN
```

**Note:** Requires **Super Admin** role!

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly connection removed successfully"
}
```

---

## Error Scenarios to Test

### 1. Invalid Username (Public Mode)

**Request:**
```http
POST http://localhost:3000/api/web/calendly/configure-public
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "calendlyUsername": "ab",
  "eventTypes": [{"name": "Test", "slug": "test"}]
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Username must be at least 3 characters"
}
```

### 2. Missing Event Types

**Request:**
```http
POST http://localhost:3000/api/web/calendly/configure-public
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "calendlyUsername": "johndoe",
  "eventTypes": []
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "At least one event type is required"
}
```

### 3. Invalid Token (PAT Mode)

**Request:**
```http
POST http://localhost:3000/api/web/calendly/token
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "accessToken": "invalid_token_12345"
}
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Invalid Personal Access Token"
}
```

### 4. Not Connected - Get Slots

**Request:**
```http
GET http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min
```

**Expected Response (when Calendly not configured):**
```json
{
  "success": false,
  "error": "Calendly is not connected. Please contact administrator."
}
```

---

## Complete Postman Collection

Save this as a JSON file and import into Postman:

```json
{
  "info": {
    "name": "Calendly Integration Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Public Mode (Free Plan)",
      "item": [
        {
          "name": "Configure Public",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{admin_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"calendlyUsername\": \"johndoe\",\n  \"eventTypes\": [\n    {\n      \"name\": \"30 Minute Meeting\",\n      \"slug\": \"30min\",\n      \"duration\": 30\n    }\n  ]\n}"
            },
            "url": "{{base_url}}/api/web/calendly/configure-public"
          }
        },
        {
          "name": "Get Slots (Public Mode)",
          "request": {
            "method": "GET",
            "header": [],
            "url": "{{base_url}}/api/app/calendly/slots/https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min"
          }
        }
      ]
    },
    {
      "name": "PAT Mode (Paid Plan)",
      "item": [
        {
          "name": "Save Token",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{admin_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"accessToken\": \"eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY...\"\n}"
            },
            "url": "{{base_url}}/api/web/calendly/token"
          }
        },
        {
          "name": "Sync Event Types",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{admin_token}}"
              }
            ],
            "url": "{{base_url}}/api/web/calendly/event-types/sync"
          }
        },
        {
          "name": "Get Slots (PAT Mode)",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/api/app/calendly/slots/https%3A%2F%2Fapi.calendly.com%2Fevent_types%2FZZZZZ?start_date=2026-01-05&end_date=2026-02-05",
              "query": [
                {
                  "key": "start_date",
                  "value": "2026-01-05"
                },
                {
                  "key": "end_date",
                  "value": "2026-02-05"
                }
              ]
            }
          }
        }
      ]
    },
    {
      "name": "Common Endpoints",
      "item": [
        {
          "name": "Get Connection Status",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{admin_token}}"
              }
            ],
            "url": "{{base_url}}/api/web/calendly/connection/status"
          }
        },
        {
          "name": "Disconnect",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{super_admin_token}}"
              }
            ],
            "url": "{{base_url}}/api/web/calendly/connection/disconnect"
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000"
    },
    {
      "key": "admin_token",
      "value": "YOUR_ADMIN_JWT_TOKEN"
    },
    {
      "key": "super_admin_token",
      "value": "YOUR_SUPER_ADMIN_JWT_TOKEN"
    }
  ]
}
```

---

## Quick Start Checklist

- [ ] Server is running
- [ ] Created Calendly account (free is fine!)
- [ ] Created at least one event type in Calendly
- [ ] Logged in as admin to get JWT token
- [ ] Configured Calendly using `/configure-public` endpoint
- [ ] Checked connection status
- [ ] Tested getting slots from public endpoint
- [ ] (Optional) Embedded Calendly widget in frontend

---

## Support

If you encounter issues:

1. Check server console for error logs starting with `[CALENDLY-CONTROLLER]` or `[CALENDLY-SERVICE]`
2. Verify your Calendly username is correct by visiting `https://calendly.com/YOUR_USERNAME`
3. Ensure event type slugs match exactly (case-sensitive)
4. For PAT mode issues, verify you have a paid Calendly plan

---

## Next Steps

After successful testing:

1. Integrate slot fetching into your session listing page
2. Add Calendly embed widget to session detail page
3. Link session purchases to Calendly booking URLs
4. (Optional) Upgrade to paid plan for PAT mode to get actual slot data
