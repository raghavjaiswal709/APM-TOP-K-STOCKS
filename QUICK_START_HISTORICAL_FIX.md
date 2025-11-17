# Quick Start Guide - Historical Data Fix

## What Was Fixed

**Problem**: Live chart was losing historical data throughout the day. At 2 PM, it would only show data from 12:30 PM instead of from 9:15 AM.

**Solution**: Implemented automatic historical data fetching from external server to backfill missing data.

## How It Works Now

1. **User selects a company** → Chart immediately subscribes to real-time updates
2. **Automatic historical fetch** → System fetches complete day's data from external server
3. **Data merge** → Combines historical + real-time data without duplicates
4. **Complete display** → Chart shows full trading day from 9:15 AM to current time

## Key Features

✅ **Automatic backfilling** - Missing data is fetched automatically  
✅ **Complete day view** - Shows data from 9:15 AM onwards  
✅ **No data loss** - Historical data is preserved  
✅ **Gap detection** - System identifies missing time ranges  
✅ **User feedback** - Loading status and data completeness shown  
✅ **50,000 point capacity** - Can store full day's tick data  

## Files Changed

| File | Changes |
|------|---------|
| `lib/historicalDataFetcher.ts` | **NEW** - Historical data fetching utilities |
| `app/market-data/page.tsx` | Added auto-fetch on symbol change, status indicators |
| `components/charts/PlotlyChart.tsx` | Fixed data retention, prevented overwriting |

## Testing

### Manual Test
1. Open market-data page at 2 PM
2. Select any company
3. **Expected**: Chart shows data from 9:15 AM to 2 PM (not just recent data)
4. **Check**: Loading indicator appears briefly
5. **Verify**: Status message shows "Complete data: X points"

### Console Test
```javascript
// In browser console:
import { fetchHistoricalData } from '@/lib/historicalDataFetcher';
const result = await fetchHistoricalData('NSE:20MICRONS-EQ', '2025-01-08');
console.log(`Fetched ${result.data.length} points`);
```

## Configuration

### External Server
- **Base URL**: `http://100.93.172.21:6969/Live/LD_DD-MM-YYYY/`
- **File Format**: `{COMPANY}-{EXCHANGE}.json`
- **Data Format**: JSONL (one JSON object per line)

### Data Retention
- **Frontend**: 50,000 points per symbol
- **Time**: 24 hours
- **Trading Hours**: 9:15 AM - 3:30 PM IST

## Troubleshooting

### Issue: Still seeing gaps
**Solution**: Check browser console for:
- Network errors (external server unreachable)
- Parse errors (invalid JSONL format)
- Symbol format errors (incorrect conversion)

### Issue: Slow loading
**Solution**: 
- Check network speed to external server
- Verify data size (should be < 5MB per symbol)
- Look for excessive re-renders in console

### Issue: No historical data
**Solution**:
- Verify external server is running
- Check if date format is correct (DD-MM-YYYY)
- Ensure company exists in external server

## Quick Commands

```bash
# Test the frontend
cd apps/frontend
npm run dev

# Check if external server is accessible
curl http://100.93.172.21:6969/Live/LD_01-08-2025/20MICRONS-NSE.json

# View test script
cat apps/frontend/test-historical-fetcher.ts
```

## Support

For detailed documentation, see `LIVE_CHART_HISTORICAL_FIX.md`

## Summary

The fix ensures users **always see complete trading day data** from 9:15 AM onwards, regardless of when they load the page. The system automatically fetches missing data from the external server and merges it with real-time updates for a seamless experience.

---
**Status**: ✅ Implemented and Ready for Testing
**Impact**: High - Solves critical data loss issue
**Breaking Changes**: None
