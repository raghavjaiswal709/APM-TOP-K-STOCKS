import { NextRequest, NextResponse } from 'next/server';
import { addLog, setAuthState, getAuthState, pyFetch, getCreds, readJson } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { service } = await readJson(req);
  if (service !== 1 && service !== 2 && service !== 3) {
    return NextResponse.json({ error: 'service must be 1 (Data), 2 (Min) or 3 (All)' }, { status: 400 });
  }

  const name = service === 1 ? 'Data' : service === 2 ? 'Min' : 'All';
  addLog({ level: 'info', action: 'STOP_SERVICE', message: `Stopping ${name}` });

  try {
    const { ok, status, data } = await pyFetch('/stop', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ service }),
    });

    if (!ok) {
      throw new Error(
        (data?.message as string) ?? (data?.error as string) ?? `Python API returned HTTP ${status}`,
      );
    }

    if (service === 3) {
      for (const { id } of getCreds()) {
        setAuthState(id, { ...getAuthState(id), authLocked: false });
      }
    }

    addLog({ level: 'success', action: 'STOP_SERVICE', message: `${name} stopped` });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'STOP_SERVICE', message: `Failed to stop ${name}: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
