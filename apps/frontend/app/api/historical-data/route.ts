import { NextRequest, NextResponse } from 'next/server';

/**
 * API Proxy for Historical Data
 * Bypasses CORS restrictions by fetching from server-side
 */
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
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 seconds
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
    
    // ✅ CRITICAL: Calculate TODAY's 9:15 AM in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const todayIST = new Date(now.getTime() + istOffset);
    const tradingStartIST = new Date(todayIST);
    tradingStartIST.setUTCHours(9, 15, 0, 0); // 9:15 AM IST
    const tradingStartTimestamp = Math.floor((tradingStartIST.getTime() - istOffset) / 1000); // Convert back to Unix timestamp
    
    console.log(`[API Proxy] 🕐 Today's trading start (9:15 AM IST): ${new Date(tradingStartTimestamp * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`[API Proxy] 🕐 Filter timestamp: ${tradingStartTimestamp}`);
    
    const allDataPoints = [];
    let filteredCount = 0;

    for (const line of lines) {
      try {
        const point = JSON.parse(line);
        const timestamp = point.timestamp || point.last_traded_time;
        
        // ✅ SERVER-SIDE FILTERING: Only include data from TODAY 9:15 AM onwards
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
    console.log(`[API Proxy] ✅ Returning ${allDataPoints.length} points from today (filtered out ${filteredCount} old points)`);
    
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
        filterApplied: 'TODAY_ONLY_9_15_AM_IST_ONWARDS'
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
