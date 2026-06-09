import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/fyers-control/logs`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}

export async function DELETE() {
  try {
    const res = await fetch(`${BACKEND}/api/fyers-control/logs`, { method: 'DELETE' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
