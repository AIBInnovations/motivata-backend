# Using Personal Access Token (PAT) with Free Calendly Account

## ✅ Good News: PAT Works on Free Plan!

Yes, you **CAN** use a Personal Access Token with your **free Calendly account** for most API endpoints!

According to Calendly's official documentation:
> "The API can be used on any subscription plan, including the Free plan"
> (with a few Enterprise-only endpoints being exceptions)

### What Works on Free Plan ✅

- ✅ `/users/me` - Get user information
- ✅ `/event_types` - List your event types
- ✅ `/event_type_available_times` - **Get available slots** (this is what you need!)
- ✅ Create and manage scheduling links
- ✅ Read event bookings

### What Doesn't Work on Free Plan ❌

- ❌ **Webhooks** - Requires paid plan (Standard or higher)
- ❌ Some enterprise-specific endpoints

**For your use case** (fetching available slots to display in your app), the **free plan is sufficient**! 🎉

---

## 🔧 Critical Fix Applied: 7-Day Window Limit

### The Issue

Calendly's `/event_type_available_times` endpoint has a **maximum date range of 7 days per request**.

The original code requested 30 days in a single call, which would fail with an error like:
```
400 Bad Request - "date range exceeds maximum of 7 days"
```

### The Solution

I've updated [calendly.service.js](src/Calendly/calendly.service.js:159-280) to automatically:
1. Split long date ranges into **7-day windows**
2. Make **multiple API requests** (e.g., 4-5 requests for 30 days)
3. **Merge and deduplicate** all results
4. Return combined slots

**Example:** Requesting 30 days of slots:
- Request 1: Days 1-7
- Request 2: Days 8-14
- Request 3: Days 15-21
- Request 4: Days 22-28
- Request 5: Days 29-30
- **Result:** All slots merged into one array

---

## 📍 How to Generate Your PAT (Free Account)

### Step 1: Log Into Calendly

Go to https://calendly.com and sign in with your account.

### Step 2: Navigate to Integrations

1. Click your **profile picture** (top right)
2. Go to **"Account Settings"** or **"Settings"**
3. Click **"Integrations"** in the left sidebar
4. Select **"API & Webhooks"**

### Step 3: Generate Personal Access Token

1. Scroll to **"Personal Access Tokens"** section
2. Click **"Generate New Token"** or **"Get a token now"**
3. Give it a name: **"Motivata Backend API"**
4. Click **"Create Token"**
5. **Copy the token immediately** - it won't be shown again!

**Token format:** Starts with something like `eyJraWQiOiIxY...` (very long string)

### Troubleshooting Token Generation

**Can't find "API & Webhooks"?**
- Make sure you're logged in as the **account owner** (not a team member)
- Check you're in the correct **workspace** if you have multiple
- Try accessing directly: https://calendly.com/integrations/api_webhooks

**"Get a token now" button missing?**
- Some accounts show **"Generate New Token"** button instead
- The UI varies slightly but functionality is the same

---

## 🚀 Setting Up PAT in Your Backend

### Option 1: Using PAT Mode (Recommended for Free Plan)

Now that you have your PAT, you can use **PAT mode** instead of public mode!

#### Step 1: Save Your PAT

**Request:**
```http
POST http://localhost:3000/api/web/calendly/token
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
Content-Type: application/json

{
  "accessToken": "eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY..."
}
```

#### Step 2: Backend Will Automatically

1. ✅ Validate token with Calendly
2. ✅ Fetch your user info
3. ✅ Sync all your event types
4. ✅ Store encrypted token in database
5. ✅ Switch to PAT mode

#### Step 3: Verify Connection

```http
GET http://localhost:3000/api/web/calendly/connection/status
Authorization: Bearer YOUR_ADMIN_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "connectionMode": "pat",
    "calendlyUserId": "https://api.calendly.com/users/XXXXXXXX",
    "eventTypes": [
      {
        "uri": "https://api.calendly.com/event_types/ZZZZZ",
        "name": "30 Minute Meeting",
        "slug": "30min",
        "schedulingUrl": "https://calendly.com/aibinnovations/30min"
      }
    ]
  }
}
```

#### Step 4: Test Fetching Real Slots

```http
GET http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fapi.calendly.com%2Fevent_types%2FZZZZZ?start_date=2026-01-05&end_date=2026-02-05
```

**Response with REAL slot data:**
```json
{
  "success": true,
  "message": "Available slots retrieved",
  "data": {
    "eventTypeUri": "https://api.calendly.com/event_types/ZZZZZ",
    "slots": [
      {
        "start": "2026-01-06T14:00:00Z",
        "end": "2026-01-06T14:30:00Z",
        "status": "available"
      },
      {
        "start": "2026-01-06T15:00:00Z",
        "end": "2026-01-06T15:30:00Z",
        "status": "available"
      }
    ],
    "cached": false
  }
}
```

---

## 🔄 Comparison: Public Mode vs PAT Mode (Free Plan)

| Feature | Public Mode | PAT Mode (Free Plan) |
|---------|-------------|---------------------|
| **Calendly Plan** | Free ✅ | Free ✅ |
| **Setup Complexity** | Very Simple | Simple |
| **API Token Required** | No | Yes |
| **Slot Data** | Embed URL only | **Real slot times from API** ✨ |
| **User Experience** | Redirect to Calendly | Show slots in your app |
| **API Calls** | None | ~4-5 per 30-day request |
| **Rate Limits** | None | Yes (caching helps) |
| **Event Type Sync** | Manual | Automatic |
| **Recommended For** | Quick testing | Production use |

---

## ⚡ Benefits of Upgrading from Public to PAT Mode

### Before (Public Mode)
User clicks "View Available Slots" → Redirected to Calendly website → Sees slots there

### After (PAT Mode with Free Plan)
User clicks "View Available Slots" → Sees **real slots directly in your app** → Better UX! 🎉

### Example in Your App

With PAT mode, your React Native app can display:

```
Available Slots for 30 Minute Meeting:

Monday, Jan 6
  ○ 2:00 PM - 2:30 PM
  ○ 3:00 PM - 3:30 PM

Tuesday, Jan 7
  ○ 10:00 AM - 10:30 AM
  ○ 4:00 PM - 4:30 PM

[Book Now]
```

Instead of just showing a "Visit Calendly" button.

---

## 📊 API Rate Limits (Free Plan)

Calendly doesn't publish exact rate limits, but based on their documentation:

- **Recommended:** Cache responses for 5-15 minutes
- **Our implementation:** 5-minute cache (configurable via `CALENDLY_SLOTS_CACHE_TTL`)
- **Multiple requests:** The 7-day windowing makes 4-5 requests for 30 days, which is fine with caching

### How We Handle Rate Limits

1. **5-minute cache** - Repeated requests for same slots return cached data
2. **Exponential backoff** - If rate limited, retry with delays (1s, 2s, 4s)
3. **Graceful degradation** - If API fails, fall back to cached data

---

## 🧪 Testing Your PAT Setup

### 1. Validate Token Works

```bash
# Test your token directly with Calendly API
curl https://api.calendly.com/users/me \
  -H "Authorization: Bearer YOUR_PAT_HERE"
```

**Expected:** JSON response with your user info

### 2. Configure Backend with PAT

```bash
curl -X POST http://localhost:3000/api/web/calendly/token \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "YOUR_PAT_HERE"}'
```

### 3. Fetch Real Slots (30 days)

```bash
curl "http://localhost:3000/api/app/calendly/slots/https%3A%2F%2Fapi.calendly.com%2Fevent_types%2FXXXXX?start_date=2026-01-05&end_date=2026-02-05"
```

### 4. Check Server Logs

You should see:
```
[CALENDLY-SERVICE] Total days to fetch: 31
[CALENDLY-SERVICE] Fetching window: 2026-01-05T... to 2026-01-12T...
[CALENDLY-SERVICE] Fetched 15 slots for this window
[CALENDLY-SERVICE] Fetching window: 2026-01-13T... to 2026-01-20T...
[CALENDLY-SERVICE] Fetched 12 slots for this window
...
[CALENDLY-SERVICE] Total slots fetched: 45 across 5 requests
```

---

## 🆚 Should You Use Public Mode or PAT Mode?

### Use **Public Mode** if:
- ✅ You want the absolute simplest setup
- ✅ Redirecting users to Calendly is acceptable
- ✅ You don't need to show slot times in your app

### Use **PAT Mode** (Free Plan) if:
- ✅ You want to show **real slot times** in your app
- ✅ You want better user experience (no redirect)
- ✅ You want automatic event type syncing
- ✅ **You have 5 minutes to generate a PAT** 😊

**Recommendation:** Use **PAT Mode** - it's still free and gives much better UX!

---

## 🔐 Security Notes

### Token Security

Your PAT is stored **encrypted** in the database using AES-256-CBC with your `JWT_SECRET`.

**Security checklist:**
- ✅ Token encrypted at rest
- ✅ Never exposed in API responses (`select: false` in schema)
- ✅ Only admins can configure
- ✅ Super admin required to disconnect

### Token Permissions

Your PAT has access to:
- ✅ Read your Calendly data (user info, event types, availability)
- ✅ Create scheduling links
- ❌ Cannot delete or modify events (API is read-only for most endpoints)

**Best practice:** Keep your PAT secret, don't commit to Git

---

## 🚨 Common Issues & Solutions

### Issue 1: "Invalid Personal Access Token"

**Cause:** Token is incorrect or expired

**Solution:**
1. Regenerate token in Calendly settings
2. Copy the new token carefully (include entire string)
3. Save new token via POST /api/web/calendly/token

### Issue 2: "Event type not found"

**Cause:** Event type URI doesn't exist or is inactive

**Solution:**
1. Check event is active in Calendly dashboard
2. Run POST /api/web/calendly/event-types/sync to refresh
3. Verify eventTypeUri in database matches Calendly

### Issue 3: "Rate limit exceeded"

**Cause:** Too many API calls in short time

**Solution:**
1. Rely on 5-minute cache (already implemented)
2. Increase cache TTL if needed: `CALENDLY_SLOTS_CACHE_TTL=600` (10 minutes)
3. Wait a few minutes before retrying

### Issue 4: "No available slots returned"

**Possible causes:**
- Your Calendly availability is not set up
- Date range is too far in the future (check your event's "Date range" settings)
- All slots are booked

**Solution:**
1. Check your event's availability settings in Calendly
2. Ensure you have set your working hours
3. Try a shorter date range (next 7 days)

---

## 📈 Performance Tips

### 1. Caching Strategy

The default 5-minute cache is good for most use cases:

```env
CALENDLY_SLOTS_CACHE_TTL=300  # 5 minutes
```

For high-traffic apps, consider:
- Increase to 10-15 minutes for less frequent updates
- Implement Redis cache for multi-server setups

### 2. Date Range Optimization

Request only what you need:
- **7 days** = 1 API call
- **14 days** = 2 API calls
- **30 days** = 5 API calls

**Recommendation:** Default to 14 days (next 2 weeks) for better performance.

### 3. Conditional Fetching

Only fetch slots when user views a specific session, not on every list view.

---

## 🎯 Next Steps

1. ✅ You already have Calendly account
2. ✅ You already have event created (`https://calendly.com/aibinnovations/30min`)
3. 🔲 Generate Personal Access Token (5 minutes)
4. 🔲 Save PAT to backend via POST /token
5. 🔲 Test fetching real slots
6. 🔲 Update frontend to use real slot data

---

## 📚 Additional Resources

- **Calendly API Docs:** https://developer.calendly.com/
- **Authentication Guide:** https://developer.calendly.com/how-to-authenticate-with-personal-access-tokens
- **Available Times Endpoint:** https://developer.calendly.com/api-docs/6a1be82aef359-list-event-type-available-times
- **Rate Limiting:** https://developer.calendly.com/api-docs/ZG9jOjI3OTA4NzY-rate-limiting

---

## ✨ Summary

**Yes, you CAN use PAT on free Calendly!**

### What Changed:
- ✅ Fixed 7-day window limit (automatic multi-request handling)
- ✅ Added duplicate slot removal
- ✅ Better error handling for each window
- ✅ Detailed logging for debugging

### What You Need to Do:
1. Generate PAT in Calendly (free account works!)
2. Save to backend via POST /api/web/calendly/token
3. Start getting **real slot data** in your app! 🎉

**The implementation is ready - just add your PAT and you're good to go!** 🚀
