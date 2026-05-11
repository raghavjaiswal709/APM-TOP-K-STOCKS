import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Date-keyed file so blue state resets automatically each trading day.
function getDataFile(): string {
  // Use IST date (UTC+5:30)
  const now = new Date(Date.now() + 330 * 60 * 1000);
  const d = String(now.getUTCDate()).padStart(2, '0');
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const y = now.getUTCFullYear();
  const dateStr = `${y}-${m}-${d}`;
  return path.join(process.cwd(), '..', 'backend', 'data', `market_movers_blue_${dateStr}.json`);
}

/**
 * GET — returns { companyCode: 'blue' } map for today.
 * Returns 404 when today's file does not exist yet (check has never run today).
 * Returns 200 with {} when the check ran but zero companies qualified.
 */
export async function GET() {
  try {
    const file = getDataFile();
    if (!fs.existsSync(file)) {
      // 404 means "check has not run today" — triggers the blue snapshot on the client
      return NextResponse.json({ error: 'not_checked_yet' }, { status: 404 });
    }
    const content = fs.readFileSync(file, 'utf-8').trim();
    return NextResponse.json(content ? JSON.parse(content) : {});
  } catch {
    return NextResponse.json({ error: 'read_error' }, { status: 500 });
  }
}

/** POST — body: { companyCode: 'blue', ... }  (replaces entire stored map) */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const file = getDataFile();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Only keep blue entries — ignore any other colors that shouldn't be frozen
    const blueOnly: Record<string, string> = {};
    for (const [code, color] of Object.entries(body)) {
      if (color === 'blue') blueOnly[code] = 'blue';
    }
    fs.writeFileSync(file, JSON.stringify(blueOnly, null, 2), 'utf-8');
    return NextResponse.json({ saved: Object.keys(blueOnly).length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
