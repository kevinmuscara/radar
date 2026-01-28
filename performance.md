# Performance Optimization Guide

Radar uses a server-side status checking architecture that eliminates client-side load and provides optimal performance for any number of concurrent users.

## Server-Side Status Checking

**Architecture Overview**

Radar performs all status checks on the server at configurable intervals (default: 30 minutes). Results are stored in a SQLite database and served to clients instantly.

**Key Benefits:**

- **Zero client-side overhead**: Clients fetch pre-computed status data
- **Unlimited scalability**: 1 user or 10,000 users = same server load
- **Consistent data**: All users see the same status at the same time
- **No external API throttling**: Services checked once per interval, not per user
- **Instant dashboard loads**: No waiting for status checks
- **Efficient resource usage**: Single check serves all users

**How It Works:**

1. Server checks all resources every N minutes (configurable)
2. Status results stored in `resource_status_cache` database table
3. Failed checks get one automatic retry
4. Persistent failures logged to `status_check_errors` table
5. Clients fetch cached statuses via `/api/cached-statuses` endpoint
6. Dashboard auto-refreshes every 5 minutes to show latest cached data

## Configurable Check Interval

**Default:** 30 minutes
**Range:** 1-60 minutes
**Configuration:** Admin Dashboard → Dashboard Settings → Status Check Interval

```javascript
// Default in StatusChecker.js
this.CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
```

**Choosing the Right Interval:**

- **5-10 minutes**: High-priority services, frequent updates needed
- **15-30 minutes**: Balanced approach for most use cases (recommended)
- **30-60 minutes**: Stable services, reduced server load priority

**Note:** Interval can be changed without restarting the server. The StatusChecker automatically applies the new interval.

## Smart Retry Logic

**Automatic Retries:**

- Failed status checks tracked during initial scan
- One retry attempt for each failure after all resources checked
- Only persistent failures (both attempts fail) logged as errors
- Prevents false alarms from transient network issues

**Benefits:**

- Reduces false error reports
- Batches retries to minimize server load
- Smart error logging only for real issues

## Progress Tracking

**Real-Time Progress Monitoring:**

The admin dashboard displays a progress bar during status checks:

- Shows current resource being checked
- Displays progress (e.g., "15/20")
- Progress updates every 500ms
- Visual indicator at bottom of navigation header

**Benefits:**

- Administrators can see check status in real-time
- Know exactly when manual refresh completes
- Track which resources are taking longer to check

## Manual Refresh Rate Limiting

**Protection Against Abuse:**

- Manual refresh button limited to once per minute
- Server enforces 60-second cooldown
- Prevents spam and unnecessary server load
- Client displays remaining cooldown time

```javascript
const FORCE_REFRESH_COOLDOWN = 60 * 1000; // 1 minute
```

**When Manual Refresh is Triggered:**

1. Cancels any in-progress check
2. Waits for current check to stop (max 5 seconds)
3. Starts fresh check immediately
4. Prevents overlapping requests

## Database Caching

**Status Cache Table:**

```sql
CREATE TABLE resource_status_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER,
  resource_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  status_url TEXT,
  last_checked DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Benefits:**

- Fast indexed lookups by resource name
- Unique constraint prevents duplicate entries
- Timestamp tracking for audit purposes
- Persistent across server restarts

## API Rate Limiting

**Endpoint Protection:**

- **Limit**: 200 requests per minute per IP
- Applies to analyze-api and RSS feed endpoints
- Automatic cleanup every 5 minutes
- Returns 429 Too Many Requests when exceeded

```javascript
const MAX_REQUESTS_PER_MINUTE = 200;
```

**Protected Endpoints:**

- `/api/analyze-api` - API structure analyzer
- `/api/rss` - RSS feed generation
- `/api/force-refresh` - Manual refresh (separate 60s limit)

## Performance Impact

**Scenario: Dashboard with 50 resources, 100 concurrent users**

| Metric | Old Client-Side | New Server-Side | Improvement |
|--------|----------------|-----------------|-------------|
| Status check requests (per page load) | 5,000 (50×100) | 1 | **99.98% reduction** |
| External service API hits (per hour) | 30,000+ | 100 | **99.7% reduction** |
| Dashboard load time | 5-30s (variable) | <500ms | **Instant** |
| Server CPU during peak | High, spiky | Low, constant | **Predictable** |
| Scalability | Limited by checks | Unlimited | **Infinite** |
| Database writes (per hour) | 0 | 100 | Audit trail |

**Real-World Impact:**

- **Before**: 100 users × 50 resources = 5,000 simultaneous external requests
- **After**: 1 scheduled check × 50 resources = 50 sequential requests
- **Result**: 100× reduction in external API load, eliminated rate limiting

## Configuration

**Adjust Check Interval:**

Admin Dashboard → Dashboard Settings → Status Check Interval (1-60 minutes)

Or edit `config/SetupManager.js`:
```javascript
await this.#setSetting("refresh_interval_minutes", "30"); // Change 30 to desired
```

**Adjust Client Refresh Rate:**

Edit `public/script.js`:
```javascript
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes (milliseconds)
```

**Adjust Force Refresh Cooldown:**

Edit `routes/api.js`:
```javascript
const FORCE_REFRESH_COOLDOWN = 60 * 1000; // 1 minute
```

**Adjust API Rate Limit:**

Edit `routes/api.js`:
```javascript
const MAX_REQUESTS_PER_MINUTE = 200; // Requests per IP
```

## Monitoring

**Server Logs:**

```
[StatusChecker] Started (30 min interval)
[StatusChecker] Starting status check...
[StatusChecker] Checking 50 resources
[StatusChecker] Retrying 2 failed resources
[StatusChecker] Failed: ServiceName - Connection timeout
[StatusChecker] Check complete
```

**Admin Dashboard:**

- Progress bar shows real-time check status
- Error table displays persistent failures
- Last updated timestamp on main dashboard

**Database Queries:**

```sql
-- View all cached statuses
SELECT * FROM resource_status_cache;

-- View recent errors
SELECT * FROM status_check_errors 
ORDER BY created_at DESC LIMIT 10;

-- Count statuses by type
SELECT status, COUNT(*) FROM resource_status_cache 
GROUP BY status;
```

## Testing

**Test Status Checker:**

1. Set check interval to 1 minute in admin settings
2. Watch server logs for check cycles
3. Verify database updates with SQL queries
4. Confirm dashboard shows updated statuses

**Test Manual Refresh:**

1. Click "Refresh All Statuses" in admin dashboard
2. Observe progress bar animation
3. Try clicking again immediately (should be rate limited)
4. Check logs for cancellation and restart

**Test Scalability:**

1. Open dashboard in multiple browsers/tabs
2. All should load instantly with same data
3. No increase in status check frequency
4. Server load remains constant

## Best Practices

**Interval Selection:**

- **Mission-critical**: 5-10 minutes
- **Standard monitoring**: 15-30 minutes (recommended)
- **Low-priority/stable**: 30-60 minutes

**Resource Management:**

- Remove unused resources to reduce check time
- Use appropriate check types (API > Heartbeat > Scrape)
- Configure API field paths for faster parsing
- Set reasonable timeouts (10s default)

**Error Handling:**

- Review error table regularly in admin dashboard
- Investigate resources that fail consistently
- Update check types or URLs as needed
- Remove dead resources to improve performance
