import { NextResponse } from 'next/server';
import { addLog, pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  addLog({ level: 'info', action: 'HEALTH_CHECK', message: 'Polling health…' });
  try {
    const { ok, data } = await pyFetch('/health');
    if (!ok) throw new Error(`Python API returned error`);
    const d = data as { Data: boolean; Min: boolean };
    addLog({ level: 'info', action: 'HEALTH_CHECK', message: `Data=${d.Data}  Min=${d.Min}` });
    return NextResponse.json(d);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'HEALTH_CHECK', message: `Health check failed: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
