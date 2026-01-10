# Calendly Integration: Public Mode vs PAT Mode

This document compares the two connection modes for Calendly integration.

---

## Quick Comparison Table

| Feature | Public Mode (Free Plan) | PAT Mode (Paid Plan) |
|---------|------------------------|----------------------|
| **Calendly Plan Required** | Free ✅ | Professional/Teams/Enterprise 💰 |
| **Setup Complexity** | Very Simple ⭐ | Simple ⭐⭐ |
| **Configuration Method** | Manual entry of username & slugs | Automatic via API token |
| **API Authentication** | None | Personal Access Token |
| **Slot Data** | Embed URL only | Actual slot times from API |
| **User Experience** | Redirect to Calendly widget | Can show slots in your app |
| **Caching** | Not needed | 5-minute cache |
| **Token Expiry** | N/A | Never expires (until revoked) |
| **Recommended For** | MVP, Testing, Free tier users | Production, Advanced features |

---

## Public Mode (Free Plan) - RECOMMENDED FOR GETTING STARTED

### ✅ Advantages

1. **Works with Free Calendly Plan**
   - No paid subscription required
   - Perfect for MVPs and startups

2. **Simple Setup**
   - Just enter your Calendly username
   - Manually add event type slugs
   - No API tokens needed

3. **No API Rate Limits**
   - Doesn't consume Calendly API quota
   - No caching complexity

4. **Easy Maintenance**
   - No token management
   - No expiry concerns

### ❌ Limitations

1. **No Actual Slot Data**
   - Can't fetch specific available times via API
   - Returns Calendly embed URL instead

2. **User Redirect Required**
   - Users must visit Calendly website to see slots
   - Can't show slots directly in your app UI

3. **Manual Event Type Management**
   - Must manually enter event type slugs
   - Need to update backend if slugs change in Calendly

### 📋 Use Cases

- **MVP Development**: Get integration working quickly
- **Free Tier Users**: No budget for paid Calendly plan
- **Simple Booking Flow**: Redirect to Calendly is acceptable
- **Testing**: Validate integration before upgrading

### 🔧 Setup Steps

1. Create Calendly account (free)
2. Create event types in Calendly dashboard
3. Note your username and event slugs
4. Call `/api/web/calendly/configure-public` with username and event types
5. Done! ✅

### 📦 Response Format

When users request slots, they get:

```json
{
  "eventTypeUri": "https://calendly.com/johndoe/30min",
  "calendlyUrl": "https://calendly.com/johndoe/30min",
  "mode": "public",
  "embedInstructions": {
    "iframe": "<iframe src=\"...\" />",
    "redirect": "window.location.href = \"...\""
  }
}
```

### 🎨 Frontend Integration

**Option A: Inline Embed**
```html
<div class="calendly-inline-widget"
     data-url="https://calendly.com/johndoe/30min"
     style="min-width:320px;height:630px;">
</div>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
```

**Option B: Popup Embed**
```html
<button onclick="Calendly.initPopupWidget({url: 'https://calendly.com/johndoe/30min'});">
  Book Now
</button>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
```

**Option C: Full Redirect**
```javascript
window.location.href = 'https://calendly.com/johndoe/30min';
```

---

## PAT Mode (Paid Plan) - FOR ADVANCED FEATURES

### ✅ Advantages

1. **Full API Access**
   - Fetch actual available time slots
   - Get slot-level data (start time, end time, status)
   - Access all Calendly API features

2. **Better User Experience**
   - Show slots directly in your app UI
   - No redirect to Calendly required (optional)
   - Custom UI for slot selection

3. **Automatic Sync**
   - Event types auto-synced from Calendly
   - No manual slug entry needed
   - Always up-to-date with Calendly changes

4. **Advanced Features**
   - Can implement slot reservation logic
   - More control over booking flow
   - Webhooks support (future enhancement)

### ❌ Limitations

1. **Requires Paid Plan**
   - Personal Access Token only available on paid plans
   - Costs $12-16/month per user (Professional plan)

2. **API Rate Limits**
   - Calendly API has rate limits
   - Need caching to prevent hitting limits
   - More complex error handling

3. **Token Management**
   - Must securely store and encrypt token
   - Need to handle token validation
   - Manual token generation required

### 📋 Use Cases

- **Production Apps**: Professional user experience
- **Custom Booking UI**: Show slots in your app without redirect
- **Advanced Features**: Need slot-level data for business logic
- **Multiple Event Types**: Automatically sync all event types

### 🔧 Setup Steps

1. Upgrade to Calendly Professional/Teams/Enterprise plan
2. Generate Personal Access Token in Calendly settings
3. Call `/api/web/calendly/token` with the token
4. Backend automatically validates token and syncs event types
5. Done! ✅

### 📦 Response Format

When users request slots, they get actual slot data:

```json
{
  "eventTypeUri": "https://api.calendly.com/event_types/XXXXX",
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
    }
  ],
  "cached": false
}
```

### 🎨 Frontend Integration

**Custom Slot Picker:**
```jsx
function SlotPicker({ eventTypeUri }) {
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    fetch(`/api/app/calendly/slots/${encodeURIComponent(eventTypeUri)}?start_date=2026-01-05&end_date=2026-02-05`)
      .then(res => res.json())
      .then(data => setSlots(data.data.slots));
  }, [eventTypeUri]);

  return (
    <div className="slot-picker">
      {slots.map(slot => (
        <button key={slot.start} onClick={() => bookSlot(slot)}>
          {new Date(slot.start).toLocaleString()}
        </button>
      ))}
    </div>
  );
}
```

---

## Migration Path: Free → Paid

When you're ready to upgrade from Public Mode to PAT Mode:

### Step 1: Keep Public Mode Running

Don't disconnect public mode yet - maintain backward compatibility.

### Step 2: Upgrade Calendly Plan

Subscribe to Professional, Teams, or Enterprise plan.

### Step 3: Generate PAT

Generate Personal Access Token in Calendly settings.

### Step 4: Save Token

Call `/api/web/calendly/token` - this automatically switches to PAT mode.

### Step 5: Verify

Check `/api/web/calendly/connection/status` - should show `"connectionMode": "pat"`.

### Step 6: Update Frontend (Gradual)

Gradually update your frontend to use actual slot data instead of embed URLs.

### Migration is Zero-Downtime ✅

The system automatically detects the connection mode and returns appropriate data format.

---

## Cost Analysis

### Public Mode (Free Plan)

- **Calendly Cost**: $0/month
- **API Calls**: None
- **Infrastructure**: Minimal (no caching needed)
- **Total**: **$0/month**

### PAT Mode (Professional Plan)

- **Calendly Cost**: $12/month (Professional plan)
- **API Calls**: ~10,000/month (rough estimate)
- **Infrastructure**: Redis cache recommended ($10-20/month for high traffic)
- **Total**: **$22-32/month**

---

## Decision Matrix

### Choose **Public Mode** if:
- ✅ You're on a tight budget
- ✅ Building MVP or prototype
- ✅ Calendly widget redirect is acceptable UX
- ✅ Simple booking flow is sufficient
- ✅ Don't need slot-level data

### Choose **PAT Mode** if:
- ✅ Need custom slot display in your app
- ✅ Want professional UX without redirects
- ✅ Require slot-level data for business logic
- ✅ Have budget for paid Calendly plan
- ✅ Need advanced Calendly features

---

## Frequently Asked Questions

### Q: Can I switch between modes?

**A:** Yes! You can switch at any time:
- Public → PAT: Just call `/api/web/calendly/token` with your PAT
- PAT → Public: Call `/api/web/calendly/connection/disconnect` then `/api/web/calendly/configure-public`

### Q: What happens to existing bookings when switching modes?

**A:** Nothing! Bookings are stored in SessionBooking schema independently of the connection mode. Mode only affects how NEW slots are fetched.

### Q: Can I use both modes simultaneously?

**A:** No, the system uses one mode at a time (singleton pattern). However, switching is instant and zero-downtime.

### Q: Does Public Mode require any Calendly configuration?

**A:** Just create event types in Calendly dashboard. The integration works with standard free plan features.

### Q: How often should I sync event types in PAT mode?

**A:** Event types are auto-synced when you save the token. You can manually re-sync anytime by calling `/api/web/calendly/event-types/sync`. Recommended: sync weekly or when you add new event types.

### Q: Is there a rate limit on the public slot endpoint?

**A:** The endpoint itself has no rate limit. In Public Mode, no Calendly API is called. In PAT Mode, slots are cached for 5 minutes to respect Calendly's rate limits.

### Q: Can users book appointments without being logged in?

**A:** Yes! The slot endpoint `/api/app/calendly/slots/:eventTypeUri` is public (no authentication required). Users are redirected to Calendly for the actual booking.

### Q: What happens if my PAT expires or is revoked?

**A:** PATs don't expire automatically, but if revoked:
1. API calls will return 401 errors
2. System automatically marks connection as disconnected
3. Admin receives error message to update token
4. Gracefully falls back to cached data (if available)

---

## Performance Comparison

### API Response Times

| Endpoint | Public Mode | PAT Mode (Cache Hit) | PAT Mode (Cache Miss) |
|----------|-------------|---------------------|----------------------|
| Get Connection Status | ~50ms | ~50ms | ~50ms |
| Get Slots | ~10ms | ~10ms | ~800ms |
| Configure | ~100ms | ~2000ms | N/A |

### Scalability

- **Public Mode**: Scales infinitely (no external API calls)
- **PAT Mode**: Scales well with caching (5-min TTL), limited by Calendly API rate limits without cache

---

## Security Comparison

### Public Mode
- ✅ No sensitive credentials stored
- ✅ No token management needed
- ✅ No encryption overhead
- ⚠️ Public Calendly URLs are visible to all users

### PAT Mode
- 🔒 Token encrypted at rest (AES-256-CBC)
- 🔒 Token never exposed in API responses (`select: false`)
- 🔒 Super admin only can disconnect
- 🔒 Token validation on every API call
- ⚠️ Higher security responsibility

---

## Recommended Approach for Your Use Case

Based on your requirements:
1. ✅ All users see available slots BEFORE purchase
2. ✅ Users get Calendly link AFTER purchase
3. ✅ Single admin (host) account linked
4. ✅ Simple implementation

**Recommendation**: **Start with Public Mode**

### Why?

1. **Meets all requirements** - Users can browse sessions and see Calendly embed before purchase
2. **Zero cost** - No Calendly subscription needed
3. **Simplest implementation** - Just username and slugs
4. **Fast to market** - Test with real users immediately
5. **Easy upgrade path** - Can switch to PAT mode later if needed

### When to upgrade to PAT Mode?

Consider upgrading when:
- You need custom slot display in your app UI
- User feedback indicates redirect is friction point
- You want to implement advanced booking logic
- You have budget for Calendly Professional plan
- You need slot-level analytics

---

## Summary

| Aspect | Public Mode | PAT Mode |
|--------|-------------|----------|
| **Best For** | MVP, Testing, Free tier | Production, Custom UX |
| **Cost** | Free | $12-32/month |
| **Setup Time** | 5 minutes | 10 minutes |
| **User Experience** | Good (redirect) | Excellent (custom UI) |
| **Maintenance** | Very low | Low-medium |
| **Scalability** | Excellent | Good (with cache) |
| **Recommendation** | ⭐ Start here | ⭐ Upgrade later |

---

**Start with Public Mode today, upgrade to PAT Mode when you need advanced features!** 🚀
