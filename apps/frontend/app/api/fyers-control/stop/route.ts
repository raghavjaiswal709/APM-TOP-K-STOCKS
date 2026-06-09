import { NextRequest, NextResponse } from 'next/server';
import { addLog, setAuthState, getAuthState, pyFetch, getCreds } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { service } = await req.json();
  if (!service) return NextResponse.json({ error: 'service is required' }, { status: 400 });

  const name = service === 1 ? 'Data' : service === 2 ? 'Min' : 'All';
  addLog({ level: 'info', action: 'STOP_SERVICE', message: `Stopping ${name}` });

  try {
    const { ok, data } = await pyFetch('/stop', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ service }),
    });

    if (!ok) throw new Error((data?.message as string) ?? `Python API error`);

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
