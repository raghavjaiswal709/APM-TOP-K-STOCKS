import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/market-movers/snapshot-1030?code=ADANIGREEN
 *
 * Fetches today's NDJSON file from port 6969 for the given company and returns:
 *   { ltp_at_1030: number, open_price: number, pct: number }
 *
 * The "price at 10:30 AM" is the tick whose timestamp is closest to 10:30 AM IST.
 * The "open_price" is taken from the first valid record in the file.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'Missing ?code= parameter' }, { status: 400 });
  }

  try {
    // Build today's LD date folder in IST
    const now = new Date(Date.now() + 330 * 60 * 1000);
    const d = String(now.getUTCDate()).padStart(2, '0');
    const mo = String(now.getUTCMonth() + 1).padStart(2, '0');
    const y = now.getUTCFullYear();
    const ldFolder = `LD_${d}-${mo}-${y}`;

    // 10:30 AM IST as Unix epoch seconds
    // 10:30 IST = 05:00 UTC → (y, mo-1, d, 5, 0, 0) in UTC
    const target1030 = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      5, 0, 0
    ) / 1000; // in seconds

    const fileUrl = `http://100.93.172.21:6969/Live/${ldFolder}/${code}-NSE.json`;
    const res = await fetch(fileUrl, {
      headers: { 'User-Agent': 'Market-Movers-Snapshot' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Port 6969 returned ${res.status} for ${code}` },
        { status: 502 }
      );
    }

    const rawText = await res.text();
    const lines = rawText.trim().split('\n');

    let openPrice: number | null = null;
    let bestLtp: number | null = null;
    let bestDiff = Infinity;

    for (const line of lines) {
      let obj: Record<string, unknown>;
      try { obj = JSON.parse(line); } catch { continue; }

      const ltp = typeof obj.ltp === 'number' ? obj.ltp : null;
      if (ltp == null || ltp <= 0) continue;

      // First valid record = opening price
      if (openPrice == null) {
        const op = typeof obj.open_price === 'number' ? obj.open_price : null;
        openPrice = op && op > 0 ? op : ltp;
      }

      // Find tick closest to 10:30 AM IST
      const ts = typeof obj.timestamp === 'number' ? obj.timestamp : null;
      if (ts == null) continue;
      const diff = Math.abs(ts - target1030);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestLtp = ltp;
      }
    }

    if (openPrice == null || bestLtp == null) {
      return NextResponse.json(
        { error: `No valid data found for ${code}` },
        { status: 404 }
      );
    }

    const pct = ((bestLtp - openPrice) / openPrice) * 100;
    return NextResponse.json({
      code,
      ltp_at_1030: bestLtp,
      open_price: openPrice,
      pct: Math.round(pct * 100) / 100,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
