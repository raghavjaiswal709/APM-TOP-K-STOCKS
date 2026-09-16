import { NextRequest, NextResponse } from 'next/server';

// API Proxy for Historical Data - Bypasses CORS
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

    // Parse symbol format safely (NSE:GVT&D-EQ, GVT&D-NSE, GVT&D, etc.)
    let exchange = searchParams.get('exchange') || 'NSE';
    let companyCode = symbol.trim();

    if (companyCode.includes(':')) {
      const parts = companyCode.split(':');
      exchange = parts[0].toUpperCase();
      companyCode = parts.slice(1).join(':');
    }

    if (companyCode.toUpperCase().endsWith('-EQ') || companyCode.toUpperCase().endsWith('-BE') || companyCode.toUpperCase().endsWith('-BZ')) {
      companyCode = companyCode.substring(0, companyCode.lastIndexOf('-'));
    } else if (companyCode.toUpperCase().endsWith('-NSE')) {
      exchange = 'NSE';
      companyCode = companyCode.substring(0, companyCode.lastIndexOf('-'));
    } else if (companyCode.toUpperCase().endsWith('-BSE')) {
      exchange = 'BSE';
      companyCode = companyCode.substring(0, companyCode.lastIndexOf('-'));
    }

    const externalSymbol = `${companyCode}-${exchange}`;

    // Parse date: support both YYYY-MM-DD and DD-MM-YYYY
    const cleanDate = date.replace(/^LD_/, '').trim();
    const dateParts = cleanDate.split(/[-/]/);
    if (dateParts.length !== 3) {
      return NextResponse.json(
        { error: `Invalid date format: ${date}` },
        { status: 400 }
      );
    }

    let requestedYear: number;
    let requestedMonth: number;
    let requestedDay: number;

    if (dateParts[0].length === 4) {
      // YYYY-MM-DD
      requestedYear = Number(dateParts[0]);
      requestedMonth = Number(dateParts[1]);
      requestedDay = Number(dateParts[2]);
    } else {
      // DD-MM-YYYY
      requestedDay = Number(dateParts[0]);
      requestedMonth = Number(dateParts[1]);
      requestedYear = Number(dateParts[2]);
    }

    const formattedDay = String(requestedDay).padStart(2, '0');
    const formattedMonth = String(requestedMonth).padStart(2, '0');
    const formattedDate = `${formattedDay}-${formattedMonth}-${requestedYear}`;

    // Encode symbol for URL safety (e.g. GVT&D-NSE -> GVT%26D-NSE)
    const encodedExternalSymbol = encodeURIComponent(externalSymbol);
    
    // Fetch from external server (server-side, no CORS)
    const externalUrl = `http://100.93.172.21:6969/Live/LD_${formattedDate}/${encodedExternalSymbol}.json`;
    
    console.log(`[API Proxy] Symbol: ${symbol} → External Symbol: ${externalSymbol} → Encoded: ${encodedExternalSymbol}`);
    console.log(`[API Proxy] Fetching: ${externalUrl}`);

    const response = await fetch(externalUrl, {
      headers: {
        'Accept': 'application/json',
      },
      // ✅ Timeout for large historical NDJSON files (26k+ rows) over Tailscale
      signal: AbortSignal.timeout(45000), // 45 seconds
    });

    if (!response.ok) {
      console.error(`[API Proxy] External server returned ${response.status}`);
      return NextResponse.json(
        { 
          success: false,
          error: `External server returned ${response.status}: ${response.statusText}`,
          data: [],
          source: 'none'
        },
        { status: response.status }
      );
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    // ✅ FIXED: Use the REQUESTED DATE's 9:15 AM in IST
    // 09:15 IST = 03:45 UTC (IST is UTC+5:30).
    const tradingStartTimestamp = Math.floor(
      Date.UTC(requestedYear, requestedMonth - 1, requestedDay, 3, 45, 0) / 1000
    );
    
    console.log(`[API Proxy] 🕐 Requested date: ${date}`);
    console.log(`[API Proxy] 🕐 Trading start for ${date} (9:15 AM IST): ${new Date(tradingStartTimestamp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`[API Proxy] 🕐 Filter timestamp: ${tradingStartTimestamp}`);
    
    const allDataPoints = [];
    let filteredCount = 0;

    for (const line of lines) {
      try {
        const point = JSON.parse(line);
        const timestamp = point.timestamp || point.last_traded_time;
        
        // Server-side filtering: Only include data from the requested date's 9:15 AM onwards
        if (timestamp >= tradingStartTimestamp) {
          allDataPoints.push({
            symbol: symbol,
            ltp: point.ltp || 0,
            vol_traded_today: point.vol_traded_today || 0,
            last_traded_time: point.last_traded_time || timestamp,
            bid_size: point.bid_size || 0,
            ask_size: point.ask_size || 0,
            bid_price: point.bid_price || 0,
            ask_price: point.ask_price || 0,
            low_price: point.low_price || 0,
            high_price: point.high_price || 0,
            open_price: point.open_price || 0,
            prev_close_price: point.prev_close_price || 0,
            timestamp: timestamp
          });
        } else {
          filteredCount++;
        }
      } catch (parseError) {
        console.warn(`[API Proxy] Failed to parse line:`, parseError);
      }
    }

    console.log(`[API Proxy] ✅ Parsed ${lines.length} total lines`);
    console.log(`[API Proxy] ✅ Returning ${allDataPoints.length} points from requested date (filtered out ${filteredCount} points before 9:15 AM IST)`);
    
    if (allDataPoints.length > 0) {
      const firstPoint = allDataPoints[0];
      const lastPoint = allDataPoints[allDataPoints.length - 1];
      console.log(`[API Proxy] 📊 Data range: ${new Date(firstPoint.timestamp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} → ${new Date(lastPoint.timestamp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    }

    return NextResponse.json({
      success: true,
      data: allDataPoints,
      source: 'external',
      metadata: {
        totalLines: lines.length,
        returnedPoints: allDataPoints.length,
        filteredPoints: filteredCount,
        tradingStartTimestamp: tradingStartTimestamp,
        requestedDate: date,
        filterApplied: 'REQUESTED_DATE_9_15_AM_IST_ONWARDS'
      }
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      }
    });

  } catch (error) {
    console.error('[API Proxy] ❌ Error:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Request timeout - external server took too long to respond',
          data: [],
          source: 'none'
        },
        { status: 504 }
      );
    }
    
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
