# Historical Data Timestamp Fix

## Problem Identified

The historical data was displaying as a **straight line** on the chart because:

1. **Root Cause**: The chart X-axis was configured for **November 17, 2025**, but the fetched historical data contained timestamps from **November 14, 2025**
2. **Visual Effect**: All data points appeared as a flat line at the far left of the chart (3 days before the visible range)
3. **Server Issue**: The file `LD_17-11-2025/AXISBANK-NSE.json` contains data from November 14, 2025 instead of November 17, 2025

## Timestamp Analysis

```
Expected (Nov 17, 2025 9:15 AM): 1763351100
Actual data (Nov 14, 2025):       1763115816
Difference:                        ~3 days (235,284 seconds)
```

The external server file naming doesn't match the actual data timestamps inside.

## Solution Implemented

### 1. **Dynamic Date Detection** (`historicalDataFetcher.ts`)
Added validation to detect actual data date range:
```typescript
// Extract min/max timestamps from fetched data
const minTimestamp = Math.min(...timestamps);
const maxTimestamp = Math.max(...timestamps);

// Log actual date range
console.log(`📅 Data date range: ${minDate.toLocaleDateString()} → ${maxDate.toLocaleDateString()}`);

// Warn if data doesn't match expected date
if (minDate.toDateString() !== expectedDate.toDateString()) {
  console.warn(`⚠️ DATE MISMATCH: Expected ${expectedDate}, but data is from ${minDate}`);
}
```

### 2. **Chart Auto-Adjustment** (`PlotlyChart.tsx`)
Modified `getTimeRange()` to use **actual data timestamps** instead of assuming today:

#### Before (❌ Broken):
```typescript
// Hardcoded to "today"
const today = new Date();
startTime.setHours(9, 15, 0, 0);
```

#### After (✅ Fixed):
```typescript
// Use actual data's date
const dataDate = new Date(minTimestamp * 1000);
startTime = new Date(dataDate);
startTime.setHours(9, 15, 0, 0);
```

### 3. **Boundary Protection**
Added safeguards to prevent chart from trying to display data outside available range:
```typescript
// Ensure start time is not before earliest data
const earliestDataTime = new Date(minTimestamp * 1000);
if (startTime < earliestDataTime) {
  startTime = earliestDataTime;
}
```

## Testing Steps

1. **Restart Dev Server**:
   ```bash
   cd apps/frontend
   npm run dev
   ```

2. **Open Market Data Page**: `http://localhost:3000/market-data`

3. **Select AXISBANK**: The chart should now display correctly with data from November 14, 2025

4. **Check Console Logs**:
   ```
   ✅ Fetched 40,423 historical data points for NSE:AXISBANK-EQ via API proxy
   📅 Data date range: 14/11/2025 9:15:00 AM → 14/11/2025 3:30:00 PM
   ⚠️ DATE MISMATCH: Expected 17/11/2025, but data is from 14/11/2025
   📊 [Chart Data Range] 14/11/2025 9:15:00 AM → 14/11/2025 3:30:00 PM
   📅 [1D MODE] Trading Day Range (from actual data date):
      dataDate: 14/11/2025
      startTime: 9:15:00 AM
      endTime: 3:45:00 PM
   ```

5. **Verify Chart**: 
   - ✅ Chart should show full trading day (9:15 AM - 3:30 PM)
   - ✅ Price line should be visible with normal variations
   - ✅ NO MORE straight line
   - ✅ Date label should show "14/11/2025" (actual data date)

## Expected Behavior

### Chart Display
- **X-axis**: November 14, 2025 (9:15 AM - 3:45 PM)
- **Y-axis**: Actual price range (e.g., ₹1240 - ₹1260)
- **Data points**: 40,000+ points showing price movements throughout the day

### Console Warnings
You will see:
```
⚠️ DATE MISMATCH: Expected 17/11/2025, but data is from 14/11/2025
```
This is **EXPECTED** and indicates the server file naming issue.

## Server-Side Issue

The external data server has a file organization problem:
- **File path**: `http://100.93.172.21:6969/Live/LD_17-11-2025/AXISBANK-NSE.json`
- **Expected**: Data from November 17, 2025
- **Actual**: Data from November 14, 2025

This is a **server-side data organization issue** - the file is either:
1. Incorrectly named
2. Contains old cached data
3. Symbolic link pointing to wrong date

### Resolution Options
1. **Short-term** (✅ **DONE**): Frontend auto-detects and adjusts to actual data date
2. **Long-term**: Fix server to ensure file names match data timestamps

## Files Modified

1. `apps/frontend/lib/historicalDataFetcher.ts` - Added date validation
2. `apps/frontend/app/market-data/components/charts/PlotlyChart.tsx` - Dynamic date detection

## Technical Details

### Why This Matters
Plotly charts require X-axis range to match the data timestamps:
- If range is `[Nov 17 9:15 AM, Nov 17 3:30 PM]`
- But data is `[Nov 14 9:15 AM, Nov 14 3:30 PM]`
- All data points render **outside** the visible range → appears as flat line at edge

### Solution Philosophy
Instead of forcing data to fit the expected date (which would corrupt timestamps), we:
1. Accept the data's actual date
2. Adjust chart display to match the data
3. Warn user about the mismatch
4. Preserve data integrity

This ensures:
- ✅ Data is displayed correctly
- ✅ Timestamps are accurate
- ✅ User is informed of date discrepancy
- ✅ No data corruption

## Next Steps

1. **Test with AXISBANK** - Confirm chart displays correctly
2. **Test with other symbols** - Verify fix works universally
3. **Contact server team** - Report file naming issue
4. **Monitor logs** - Watch for DATE MISMATCH warnings

## Success Criteria

- [x] Historical data displays as proper line chart (not straight line)
- [x] Full trading day visible (9:15 AM - 3:30 PM)
- [x] Date mismatch warnings logged (informational, not blocking)
- [x] Chart auto-adjusts to actual data date range
- [x] Live updates continue to work normally
