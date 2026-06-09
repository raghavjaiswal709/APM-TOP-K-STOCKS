import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

export async function POST() {
  try {
    const res = await fetch(`${BACKEND}/api/fyers-control/users/refresh`, { method: 'POST' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }
}
