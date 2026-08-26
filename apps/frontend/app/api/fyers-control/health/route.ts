import { NextResponse } from 'next/server';
import { addLog, pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

/**
 * Kept for backwards compatibility; prefer /status, which also carries
 * started_by / started_at. Passes the whole body through rather than picking
 * out Data/Min, so the attribution fields survive.
 *
 * No longer logs each poll — it fires on a timer from every open dashboard and
 * drowned the terminal in HEALTH_CHECK lines.
 */
export async function GET() {
  try {
    const { ok, status, data } = await pyFetch('/health');
    if (!ok) throw new Error(`Python API returned HTTP ${status}`);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'HEALTH_CHECK', message: `Health check failed: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
