# Historical Data CORS Fix - Root Cause Analysis & Solutions

## 🔴 Root Cause Identified

The historical data fetch is **failing due to CORS (Cross-Origin Resource Sharing) policy**.

### Evidence:
```bash
# Server Response Headers (missing CORS headers):
Content-Type: application/json
Server: SimpleHTTP/0.6 Python/3.12.7
# ❌ Missing: Access-Control-Allow-Origin
# ❌ Missing: Access-Control-Allow-Methods
# ❌ Missing: Access-Control-Allow-Headers
```

### What's Happening:
1. ✅ Server is accessible: HTTP 200 OK
2. ✅ Data exists: 4.8MB JSONL file
3. ✅ Frontend code is correct
4. ❌ **Browser blocks the response** due to missing CORS headers
5. Frontend sees: "No historical data available"

## 📊 CORS Explanation

**CORS Error** occurs when:
- Frontend runs on: `http://localhost:3000` (or your domain)
- Tries to fetch from: `http://100.93.172.21:6969`
- Server doesn't send `Access-Control-Allow-Origin: *` header
- Browser security blocks the response

## 🛠️ Solutions (Choose ONE)

### ✅ Solution 1: Fix External Server (RECOMMENDED)
Add CORS headers to the Python SimpleHTTP server.

**Option A: Use Python HTTP Server with CORS**
```python
# cors_server.py
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        SimpleHTTPRequestHandler.end_headers(self)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == '__main__':
    PORT = 6969
    httpd = HTTPServer(('0.0.0.0', PORT), CORSRequestHandler)
    print(f'Serving on port {PORT} with CORS enabled...')
    httpd.serve_forever()
```

**Run the server:**
```bash
cd /path/to/Live
python3 cors_server.py
```

---

### ✅ Solution 2: Create Next.js API Proxy (BACKEND)
Add a proxy endpoint to bypass CORS.

**Create: `apps/frontend/app/api/historical-data/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const date = searchParams.get('date');
    
    if (!symbol || !date) {
      return NextResponse.json(
        { error: 'Missing symbol or date parameter' },
        { status: 400 }
      );
    }

    // Convert symbol format: NSE:AXISBANK-EQ -> AXISBANK-NSE
    const symbolParts = symbol.split(':');
    if (symbolParts.length !== 2) {
      return NextResponse.json(
        { error: `Invalid symbol format: ${symbol}` },
        { status: 400 }
      );
    }

    const [exchange, codePart] = symbolParts;
    const companyCode = codePart.split('-')[0];
    const externalSymbol = `${companyCode}-${exchange}`;

    // Format date: DD-MM-YYYY
    const [year, month, day] = date.split('-');
    const formattedDate = `${day}-${month}-${year}`;

    // Fetch from external server (server-side, no CORS)
    const externalUrl = `http://100.93.172.21:6969/Live/LD_${formattedDate}/${externalSymbol}.json`;
    
    console.log(`[API Proxy] Fetching: ${externalUrl}`);

    const response = await fetch(externalUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `External server returned ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    const dataPoints = [];

    for (const line of lines) {
      try {
        const point = JSON.parse(line);
        dataPoints.push({
          symbol: symbol,
          ltp: point.ltp || 0,
          vol_traded_today: point.vol_traded_today || 0,
          last_traded_time: point.last_traded_time || point.timestamp,
          bid_size: point.bid_size || 0,
          ask_size: point.ask_size || 0,
          bid_price: point.bid_price || 0,
          ask_price: point.ask_price || 0,
          low_price: point.low_price || 0,
          high_price: point.high_price || 0,
          open_price: point.open_price || 0,
          prev_close_price: point.prev_close_price || 0,
          timestamp: point.timestamp || point.last_traded_time
        });
      } catch (parseError) {
        console.warn(`[API Proxy] Failed to parse line:`, parseError);
      }
    }

    console.log(`[API Proxy] Returning ${dataPoints.length} data points`);

    return NextResponse.json({
      success: true,
      data: dataPoints,
      source: 'external'
    });

  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: [],
        source: 'none'
      },
      { status: 500 }
    );
  }
}
```

**Update: `apps/frontend/lib/historicalDataFetcher.ts`**
```typescript
export async function fetchHistoricalData(
  symbol: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<FetchResult> {
  try {
    // Use Next.js API proxy instead of direct fetch
    const apiUrl = `/api/historical-data?symbol=${encodeURIComponent(symbol)}&date=${date}`;
    
    console.log(`📡 Fetching historical data via API proxy: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log(`✅ Fetched ${result.data.length} historical data points for ${symbol}`);
    
    return result;

  } catch (error) {
    console.error(`❌ Failed to fetch historical data for ${symbol}:`, error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'none'
    };
  }
}
```

---

### ✅ Solution 3: Use Browser Extension (DEV ONLY)
Install CORS Unblock extension for development:
- Chrome: [Allow CORS: Access-Control-Allow-Origin](https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbaginigeejlf)
- Firefox: [CORS Everywhere](https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/)

⚠️ **NOT for production!** Only for testing.

---

## 🎯 Recommended Implementation Order

1. **Immediate (5 min)**: Implement Solution 2 (Next.js API Proxy)
   - No external server changes needed
   - Works immediately
   - Safe and production-ready

2. **Long-term (Optional)**: Ask server team to add CORS headers
   - Better performance (direct fetch)
   - Less server load (no proxy)
   - More scalable

## 📝 Testing After Fix

```bash
# 1. Check if API proxy works
curl http://localhost:3000/api/historical-data?symbol=NSE:AXISBANK-EQ&date=2025-11-17

# 2. Check browser console
# Should see:
# ✅ Fetched XXX historical data points for NSE:AXISBANK-EQ
# ✅ Loaded XXX points (0 gaps detected)

# 3. Verify chart shows full day data (9:15 AM onwards)
```

## 🐛 Debugging Commands

```bash
# Check server CORS headers
curl -I http://100.93.172.21:6969/Live/LD_17-11-2025/AXISBANK-NSE.json

# Test API proxy (after implementation)
curl "http://localhost:3000/api/historical-data?symbol=NSE:AXISBANK-EQ&date=2025-11-17" | jq '.data | length'

# Check browser console for errors
# Open DevTools > Console > Look for CORS errors
```

## 📊 Success Metrics

After fix is applied:
- ✅ No CORS errors in browser console
- ✅ "Loaded XXXX historical data points" status message
- ✅ Chart displays data from 9:15 AM onwards
- ✅ No "no historical data available" error

---

## 🚀 Implementation Steps (Solution 2 - API Proxy)

1. Create API route file (see above)
2. Update historicalDataFetcher.ts (see above)
3. Restart Next.js dev server: `npm run dev`
4. Test with AXISBANK on 17-11-2025
5. Verify in browser console

**Time to implement**: ~10 minutes
**Difficulty**: Easy
**Production ready**: Yes ✅
