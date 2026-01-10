# Calendly Integration - Quick Start Guide (Free Plan)

Get your Calendly integration working in **under 10 minutes** using the free plan! 🚀

---

## Prerequisites Checklist

- [ ] Backend server is running (`npm start` or `npm run dev`)
- [ ] You have admin access to your application
- [ ] You have a Calendly account (or can create one)

---

## Step 1: Create Calendly Account (2 minutes)

1. Go to https://calendly.com/signup
2. Sign up with your email
3. Complete the onboarding wizard
4. Choose the **Free** plan (no credit card required!)

---

## Step 2: Create Event Type in Calendly (3 minutes)

1. After logging in, you'll see the Calendly dashboard
2. Click **"+ Create"** or **"New Event Type"**
3. Select **"One-on-One"** event type
4. Configure your event:
   - **Event name**: `30 Minute Meeting` (or whatever you prefer)
   - **Duration**: 30 minutes
   - **Location**: Zoom, Google Meet, or Phone
5. Click **"Next"** and then **"Create"**
6. Note the event URL: `https://calendly.com/YOUR_USERNAME/EVENT_SLUG`

**Example URL**: `https://calendly.com/johndoe/30min`
- Your username: `johndoe`
- Event slug: `30min`

---

## Step 3: Get Your Admin JWT Token (1 minute)

Login as admin to get your JWT token:

### Using Postman:

```http
POST http://localhost:3000/api/web/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Copy the token from the response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## Step 4: Configure Calendly (1 minute)

Send this request with your Calendly details:

```http
POST http://localhost:3000/api/web/calendly/configure-public
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN_HERE
Content-Type: application/json

{
  "calendlyUsername": "johndoe",
  "eventTypes": [
    {
      "name": "30 Minute Meeting",
      "slug": "30min",
      "duration": 30
    }
  ]
}
```

**Replace:**
- `YOUR_ADMIN_JWT_TOKEN_HERE` with your actual JWT token from Step 3
- `johndoe` with your Calendly username
- `30min` with your actual event slug

**Success Response:**
```json
{
  "success": true,
  "message": "Calendly configured successfully (public mode)",
  "data": {
    "calendlyUsername": "johndoe",
    "eventTypesCount": 1,
    "connectedAt": "2026-01-05T...",
    "mode": "public"
  }
}
```

✅ **Calendly is now connected!**

---

## Step 5: Test It! (2 minutes)

### Check Connection Status

```http
GET http://localhost:3000/api/web/calendly/connection/status
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN_HERE
```

**Expected Response:**
```json
{
  "success": true,
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
      }
    ]
  }
}
```

### Get Available Slots (PUBLIC - No Auth Needed!)

```http
GET http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min
```

**Note**: The URL must be URL-encoded:
- Original: `https://calendly.com/johndoe/30min`
- Encoded: `https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min`

**Expected Response:**
```json
{
  "success": true,
  "message": "Calendly booking URL (public mode)",
  "data": {
    "eventTypeUri": "https://calendly.com/johndoe/30min",
    "calendlyUrl": "https://calendly.com/johndoe/30min",
    "mode": "public",
    "embedInstructions": {
      "iframe": "<iframe src=\"https://calendly.com/johndoe/30min\" width=\"100%\" height=\"600px\" frameborder=\"0\"></iframe>",
      "redirect": "window.location.href = \"https://calendly.com/johndoe/30min\""
    }
  }
}
```

✅ **It works!**

---

## Step 6: Integrate in Frontend (2 minutes)

### Option A: Inline Embed Widget

Add this to your session detail page:

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
</head>
<body>
  <h2>Book Your Session</h2>

  <!-- Calendly inline widget begin -->
  <div
    class="calendly-inline-widget"
    data-url="https://calendly.com/johndoe/30min"
    style="min-width:320px;height:700px;">
  </div>
  <script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script>
  <!-- Calendly inline widget end -->
</body>
</html>
```

### Option B: Popup Button

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet">
  <script src="https://assets.calendly.com/assets/external/widget.js" type="text/javascript" async></script>
</head>
<body>
  <button
    onclick="Calendly.initPopupWidget({url: 'https://calendly.com/johndoe/30min'});">
    Schedule Your Session
  </button>
</body>
</html>
```

### Option C: Simple Redirect

```html
<a href="https://calendly.com/johndoe/30min" target="_blank" class="btn btn-primary">
  Book Your Session
</a>
```

---

## Troubleshooting

### Error: "Calendly username is required"

**Problem**: Missing username in request body

**Solution**: Make sure the request body includes `calendlyUsername` field:
```json
{
  "calendlyUsername": "your_username",
  "eventTypes": [...]
}
```

### Error: "At least one event type is required"

**Problem**: Empty or missing event types array

**Solution**: Include at least one event type:
```json
{
  "calendlyUsername": "johndoe",
  "eventTypes": [
    {
      "name": "30 Minute Meeting",
      "slug": "30min"
    }
  ]
}
```

### Error: "Unauthorized" or "Invalid token"

**Problem**: JWT token is missing or expired

**Solution**: Login again to get a fresh token

### Error: "Slug can only contain lowercase letters, numbers, and hyphens"

**Problem**: Invalid characters in event slug

**Solution**: Use only lowercase letters, numbers, and hyphens in slugs:
- ✅ Good: `30min`, `consultation-60`, `quick-chat`
- ❌ Bad: `30Min`, `consultation_60`, `quick chat`

### Calendly Widget Not Showing

**Problem**: Widget script not loaded or incorrect URL

**Solution**:
1. Verify the Calendly URL is correct by visiting it in your browser
2. Check browser console for JavaScript errors
3. Ensure the widget script is loaded: `https://assets.calendly.com/assets/external/widget.js`

---

## What's Next?

Now that Calendly is integrated, you can:

1. **Link Sessions to Calendly**
   - Add `calendlyEventTypeUri` field when creating sessions
   - Set to the Calendly URL: `https://calendly.com/johndoe/30min`

2. **Show Slots Before Purchase**
   - Fetch slots using the public endpoint
   - Display Calendly widget on session detail page
   - Users can see availability without purchasing

3. **Reveal Calendly Link After Purchase**
   - Your payment flow already handles this! ✅
   - After successful payment, users get access to Calendly booking link

4. **Test the Complete Flow**
   - Create a test session with Calendly link
   - Browse as user, see available slots
   - Purchase session
   - Book appointment on Calendly

---

## Complete curl Examples

If you prefer curl over Postman:

### Configure Calendly

```bash
curl -X POST http://localhost:3000/api/web/calendly/configure-public \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "calendlyUsername": "johndoe",
    "eventTypes": [
      {
        "name": "30 Minute Meeting",
        "slug": "30min",
        "duration": 30
      }
    ]
  }'
```

### Get Connection Status

```bash
curl -X GET http://localhost:3000/api/web/calendly/connection/status \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN_HERE"
```

### Get Slots (Public - No Auth)

```bash
curl -X GET "http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fcalendly.com%2Fjohndoe%2F30min"
```

### Disconnect (Super Admin Only)

```bash
curl -X POST http://localhost:3000/api/web/calendly/connection/disconnect \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT_TOKEN_HERE"
```

---

## Testing with Multiple Event Types

Want to add more event types? Just include them in the array:

```json
{
  "calendlyUsername": "johndoe",
  "eventTypes": [
    {
      "name": "15 Minute Quick Chat",
      "slug": "15min",
      "duration": 15
    },
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

Each event type will be accessible via its own URL:
- `https://calendly.com/johndoe/15min`
- `https://calendly.com/johndoe/30min`
- `https://calendly.com/johndoe/60min-consultation`

---

## Need Help?

Check the detailed guides:
- **[CALENDLY_TESTING_GUIDE.md](./CALENDLY_TESTING_GUIDE.md)** - Comprehensive testing guide for both modes
- **[CALENDLY_MODES_COMPARISON.md](./CALENDLY_MODES_COMPARISON.md)** - Comparison between Public and PAT modes

Or check server logs for errors starting with:
- `[CALENDLY-CONTROLLER]` - Controller errors
- `[CALENDLY-SERVICE]` - API call errors

---

## Success! 🎉

You now have a working Calendly integration that:
- ✅ Works with Calendly's free plan
- ✅ Allows users to browse available slots
- ✅ Integrates seamlessly with your session booking flow
- ✅ Requires zero Calendly API costs

**Total setup time**: Under 10 minutes!

When you're ready for advanced features (showing actual slot times in your app), upgrade to Calendly Professional plan and switch to PAT mode. See [CALENDLY_MODES_COMPARISON.md](./CALENDLY_MODES_COMPARISON.md) for details.
