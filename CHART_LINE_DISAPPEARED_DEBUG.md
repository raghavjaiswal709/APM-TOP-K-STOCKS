# Chart Line Disappeared - Deep Analysis & Fix

## Problem
After implementing the timestamp fix, the chart line completely disappeared instead of showing data.

## Root Cause Analysis

### Potential Issues
1. **Data not reaching the chart component** (historicalData empty)
2. **Timestamp conversion issue** (dates outside visible range)
3. **Chart range mismatch** (X-axis not matching data timestamps)
4. **Data filtering removing all points** (validation too strict)

## Diagnostic Logging Added

### 1. Market Data Page (`page.tsx`)
```typescript
// Line ~630: After fetching and merging historical data
console.log(`🔍 First merged point:`, { timestamp, date, ltp });
console.log(`🔍 Last merged point:`, { timestamp, date, ltp });
```

### 2. PlotlyChart Component (`PlotlyChart.tsx`)
```typescript
// Line ~365: Input data validation
console.log(`🔍 [prepareLineChartData] Input:`, {
  historicalCount,
  firstHistorical,
  lastHistorical
});

// Line ~405: Output data validation  
console.log(`📊 [prepareLineChartData] Output:`, {
  totalPoints,
  firstPoint: { timestamp, date, ltp },
  lastPoint: { timestamp, date, ltp }
});
```

## Testing Steps

### 1. Restart Dev Server
```bash
cd apps/frontend
npm run dev
```

### 2. Open Browser Console
- Press `F12` (Windows) or `Cmd+Option+I` (Mac)
- Go to "Console" tab
- Clear all logs (`Ctrl+L` or Clear button)

### 3. Select AXISBANK
Watch for these log messages in sequence:

#### Expected Log Flow:
```
1. 📡 Fetching historical data for NSE:AXISBANK-EQ...
2. ✅ Fetched 17493 historical points from external server
3. 📅 Data date range: 14/11/2025 9:15:00 AM → 14/11/2025 3:30:00 PM
4. ⚠️ DATE MISMATCH: Expected 17/11/2025, but data is from 14/11/2025
5. 📊 Merged data: 0 local + 17493 external = 17493 total
6. 🔍 First merged point: { timestamp: 1763115816, date: Nov 14 2025 09:23:36, ltp: 1244.4 }
7. 🔍 Last merged point: { timestamp: 1763351127, date: Nov 17 2025 10:45:27, ltp: 1260.5 }
8. ✅ Complete data: 17493 points
9. 🔍 [prepareLineChartData] Input: { historicalCount: 17493, firstHistorical: {...}, lastHistorical: {...} }
10. 📊 [prepareLineChartData] Output: { totalPoints: 17493, firstPoint: {...}, lastPoint: {...} }
11. 📊 [Chart Data Range] 14/11/2025 9:23:36 AM → 17/11/2025 10:45:27 AM
12. 📅 [1D MODE] Trading Day Range (from actual data date): ...
```

### 4. Analyze Output

#### ✅ GOOD SIGNS:
- `historicalCount` > 0 (data was fetched)
- `totalPoints` > 0 (data passed to chart)
- Timestamps are valid Unix seconds (10 digits: 1763115816)
- Dates parse correctly (Nov 14-17, 2025)
- LTP values are reasonable (1240-1260 range)

#### ❌ BAD SIGNS (and solutions):

| Problem | Symptom | Solution |
|---------|---------|----------|
| **No data fetched** | `historicalCount: 0` | Check API proxy response, network tab |
| **Data filtered out** | `totalPoints: 0` when `historicalCount` > 0 | Check `point.ltp > 0` validation |
| **Timestamp NaN** | `timestamp: NaN` | Check API proxy timestamp conversion |
| **Date far in past/future** | Dates in 1970 or 2099 | Timestamp multiplier issue (x1000) |
| **Chart shows but no line** | All logs OK | Check chart range vs data range |

## Common Issues & Fixes

### Issue 1: Data Fetched But Chart Empty
**Symptom**: Logs show data, but chart is blank

**Check**: Compare data timestamp range with chart X-axis range
```javascript
// Data range
First: Nov 14 2025 09:23:36
Last:  Nov 17 2025 10:45:27

// Chart range (should be similar)
[1D MODE] Trading Day Range: 09:15:00 - 15:45:00
```

**Fix**: Already implemented - chart uses actual data timestamps

### Issue 2: Timestamps Wrong Format
**Symptom**: Dates show year 1970 or 2099

**Root Cause**: API proxy not converting timestamps correctly

**Check API Response**:
```bash
curl "http://localhost:3000/api/historical-data?symbol=NSE:AXISBANK-EQ&date=2025-11-17" | ConvertFrom-Json | Select-Object -First 1 -ExpandProperty data | Select-Object timestamp, ltp
```

Expected output:
```
timestamp    ltp
---------    ---
1763115816   1244.4
```

If timestamp is wrong, check `route.ts` line ~80.

### Issue 3: Data Filtered Out
**Symptom**: `historicalCount: 17493` but `totalPoints: 0`

**Root Cause**: Validation too strict in `prepareLineChartData()`

**Check**: Line ~360 in `PlotlyChart.tsx`
```typescript
if (point.ltp > 0 && !isNaN(point.ltp) && point.timestamp > 0) {
  // Add data
}
```

**Debug**:
```javascript
// Add temporary log
historicalData.forEach(point => {
  console.log('Point:', { ltp: point.ltp, valid: point.ltp > 0, isNaN: isNaN(point.ltp), timestamp: point.timestamp });
});
```

### Issue 4: Chart Range Mismatch
**Symptom**: Data exists but renders outside visible range

**Check Console**:
```
📊 [Chart Data Range] 14/11/2025 9:23:36 AM → 17/11/2025 10:45:27 AM
📅 [1D MODE] Trading Day Range: 14/11/2025 09:15:00 - 15:45:00
```

Data should overlap with chart range. If not:
- Data is from Nov 14, chart shows Nov 17 → Use "ALL" timeframe
- Data is 9:23 AM onwards, chart shows 9:15-15:45 → OK (within range)

## Manual Verification Commands

### 1. Check API Proxy
```powershell
$response = Invoke-WebRequest "http://localhost:3000/api/historical-data?symbol=NSE:AXISBANK-EQ&date=2025-11-17" | ConvertFrom-Json

Write-Host "Success: $($response.success)"
Write-Host "Data count: $($response.data.Count)"
Write-Host "First timestamp: $($response.data[0].timestamp)"
Write-Host "First date: $([DateTimeOffset]::FromUnixTimeSeconds($response.data[0].timestamp).DateTime)"
Write-Host "First LTP: $($response.data[0].ltp)"
```

Expected:
```
Success: True
Data count: 17493
First timestamp: 1763115816
First date: 14 November 2025 10:23:36
First LTP: 1244.4
```

### 2. Check External Server Directly
```powershell
$response = Invoke-WebRequest "http://100.93.172.21:6969/Live/LD_17-11-2025/AXISBANK-NSE.json"
$lines = $response.Content.Split("`n")
$firstLine = $lines[0] | ConvertFrom-Json
$firstLine | Select-Object timestamp, ltp
```

Should match API proxy output.

## Emergency Fallback: Force "ALL" Timeframe

If 1D mode is problematic, test with "ALL" timeframe:

**Temporary Fix**: In `PlotlyChart.tsx`, line ~199
```typescript
// Change default timeframe
const [selectedTimeframe, setSelectedTimeframe] = useState<string>('ALL'); // Was: '1m'
```

This will show ALL data regardless of time range, helping isolate the issue.

## Success Criteria

When working correctly:
1. ✅ Console shows `historicalCount: 17493`
2. ✅ Console shows `totalPoints: 17493`
3. ✅ Chart displays a line (not flat, not straight)
4. ✅ Line shows price variations (1240-1260 range)
5. ✅ X-axis shows Nov 14-17, 2025
6. ✅ Hover shows accurate timestamps and prices

## Next Steps After Testing

1. **Share console logs**: Copy all logs from browser console
2. **Check Network tab**: Look for failed requests
3. **Screenshot chart**: Show what you're seeing
4. **Report findings**: Which of the above issues apply?

## Files Modified
- `apps/frontend/lib/historicalDataFetcher.ts` - Date validation + logging
- `apps/frontend/app/market-data/components/charts/PlotlyChart.tsx` - Dynamic date detection + debug logs
- `apps/frontend/app/market-data/page.tsx` - Data merge logging
- `apps/frontend/app/api/historical-data/route.ts` - CORS proxy (unchanged)
