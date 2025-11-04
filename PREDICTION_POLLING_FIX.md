# Prediction Polling Fix - Every 5 Minutes Strictly

## Problem Analysis
The prediction data was not being fetched and updated every 5 minutes as expected due to several issues:

1. **Stale Closure Problem**: The `startPolling` callback had `pollCount` and `error` in dependencies, causing stale closures
2. **Cache Interference**: Both frontend (5 min) and backend (1 min) caches were preventing fresh data fetches
3. **No Cache Bypass**: The `refetch` function was not forcing fresh data fetch, potentially returning cached data
4. **Browser Caching**: HTTP requests could be cached by the browser

## Changes Made

### 1. Frontend: `usePredictionPolling.ts`

#### Key Improvements:
- **Removed stale dependencies**: Removed `error` and `pollCount` from `startPolling` callback dependencies
- **Added `pollCountRef`**: Used `useRef` to track poll count without causing re-renders
- **Enhanced logging**: Added detailed console logs for every poll with timestamps
- **Fixed interval clearing**: Ensures no duplicate intervals are created
- **Strict 5-minute intervals**: Explicitly set to 300000ms (5 minutes)

#### Code Changes:
```typescript
// Added ref to avoid stale closure
const pollCountRef = useRef<number>(0);

// Enhanced startPolling with better logging and cache bypass
const startPolling = useCallback(async () => {
  // Clear existing intervals to prevent duplicates
  if (pollIntervalRef.current) {
    clearInterval(pollIntervalRef.current);
  }
  
  // Force fresh fetch on every poll
  const freshData = await refetch();
  
  // Detailed logging for debugging
  console.log(`🔄 Polling predictions for ${company} (Poll #${currentPollCount})`);
  console.log(`⏰ Next poll scheduled for: ${nextPoll.toLocaleTimeString()}`);
}, [enabled, company, pollInterval, refetch, onUpdate, onError]);
```

### 2. Frontend: `usePredictions.ts`

#### Key Improvements:
- **Cache bypass parameter**: Added `bypassCache` parameter to `fetchPredictions`
- **Force refetch**: `refetch()` now always bypasses cache and fetches fresh data
- **Prevent browser caching**: Added timestamp query parameter and cache-control headers
- **Better logging**: Added console logs for cache hits and fresh fetches

#### Code Changes:
```typescript
// Modified signature to support cache bypass
async (attempt = 0, bypassCache = false): Promise<CompanyPredictions | null> => {
  // Only use cache if not bypassing
  if (!bypassCache && attempt === 0) {
    const cached = predictionCache.get(cacheKey);
    if (cached) {
      console.log(`📦 Using cached predictions for ${company}`);
      return cached;
    }
  }
  
  // Add timestamp to prevent browser caching
  const timestamp = Date.now();
  const url = `${baseUrl}/predictions/${company}?t=${timestamp}`;
  
  // Add cache-control headers
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  }
}

// refetch ALWAYS bypasses cache
const refetch = useCallback(async () => {
  console.log(`🔄 Force refetch for ${company} (bypassing cache)`);
  return await fetchPredictions(0, true);
}, [fetchPredictions, company]);
```

### 3. Backend: `prediction.service.ts`

#### Key Improvements:
- **Reduced cache duration**: Changed from 1 minute to 30 seconds
- This ensures that even if frontend polls every 5 minutes, it won't get stale cached data

#### Code Changes:
```typescript
// Reduced from 1 minute to 30 seconds
private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
```

## How It Works Now

### Timeline of a 5-Minute Polling Cycle:

```
T+0s:   🚀 Polling starts
        📥 Immediate fetch (bypasses cache)
        ✅ Poll #1 successful
        
T+300s: ⏰ 5 minutes elapsed
        🔄 Automatic poll triggered
        📥 Force fresh fetch (bypasses cache)
        ✅ Poll #2 successful
        
T+600s: ⏰ 10 minutes elapsed
        🔄 Automatic poll triggered
        📥 Force fresh fetch (bypasses cache)
        ✅ Poll #3 successful
        
... continues every 5 minutes indefinitely
```

### Data Flow:

```
Frontend Component
    ↓
usePredictionPolling (5-minute interval)
    ↓
refetch() [ALWAYS bypasses cache]
    ↓
usePredictions.fetchPredictions(bypassCache=true)
    ↓
GET /predictions/{company}?t={timestamp}
    ↓
Backend API (30-second cache)
    ↓
Python Prediction Service
    ↓
Fresh Prediction Data
```

## Verification Steps

### 1. Check Console Logs
You should see these logs every 5 minutes:
```
🔄 Polling predictions for AXISBANK (Poll #1) at 10:00:00
⏰ Next poll scheduled for: 10:05:00
🔄 Force refetch for AXISBANK (bypassing cache)
🌐 Fetching fresh predictions for AXISBANK... (attempt 1)
✅ Poll #1 successful: 25 predictions at 10:00:00
```

### 2. Monitor Network Tab
- Open browser DevTools → Network tab
- Filter by `/predictions/`
- You should see a new request every 5 minutes
- Each request should have a different timestamp parameter: `?t=1730726400000`
- Response should NOT come from cache (status 200, not 304)

### 3. Check Timestamps
- Look at the `predictedat` field in the prediction data
- It should update every 5 minutes with fresh timestamps

## Testing Checklist

- [ ] Start the application
- [ ] Select a company (e.g., AXISBANK)
- [ ] Enable predictions
- [ ] Wait 5 minutes
- [ ] Check console for poll #2 logs
- [ ] Verify network request was made
- [ ] Check that prediction data updated
- [ ] Wait another 5 minutes
- [ ] Confirm poll #3 occurs
- [ ] Repeat for multiple cycles

## Configuration

Current settings in `page.tsx`:
```typescript
pollInterval: 5 * 60 * 1000, // 5 minutes (300,000ms)
autoStart: true,              // Starts automatically
enabled: showPredictions && isClient,
```

To change polling frequency, modify `pollInterval`:
- 1 minute: `1 * 60 * 1000`
- 3 minutes: `3 * 60 * 1000`
- 5 minutes: `5 * 60 * 1000` (current)
- 10 minutes: `10 * 60 * 1000`

## Troubleshooting

### Issue: Predictions not updating
**Check:**
1. Console logs - Are polls being triggered?
2. Network tab - Are requests being sent?
3. Response data - Is the Python service returning new data?

### Issue: Getting cached data
**Solution:**
- The `refetch()` function now ALWAYS bypasses cache
- Backend cache is only 30 seconds
- Browser caching is prevented with headers and timestamp

### Issue: Polling stops
**Check:**
1. Is `showPredictions` still true?
2. Was there an error? Check error state
3. Did component unmount? Polling stops on unmount

## Performance Considerations

- **Frontend cache**: 5 minutes (helps with component re-renders)
- **Backend cache**: 30 seconds (ensures fresh data from Python service)
- **Network overhead**: One API call every 5 minutes per company
- **Memory**: Poll count and state tracked efficiently with refs

## Future Enhancements

1. **Adaptive polling**: Adjust frequency based on market hours
2. **Error handling**: Exponential backoff on failures
3. **Batch fetching**: Fetch multiple companies in one request
4. **WebSocket support**: Real-time updates instead of polling
5. **Smart caching**: Cache longer during non-market hours
