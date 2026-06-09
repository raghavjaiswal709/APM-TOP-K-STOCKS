import { NextResponse } from 'next/server';
import { getLogs, clearLogs } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ logs: getLogs() });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ ok: true });
}
