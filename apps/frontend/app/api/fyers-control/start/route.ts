import { NextRequest, NextResponse } from 'next/server';
import { addLog, pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { service, option } = body ?? {};
  if (!service) return NextResponse.json({ error: 'service is required' }, { status: 400 });

  const name = service === 1 ? 'Data' : 'Min';
  addLog({ level: 'info', action: 'START_SERVICE', message: `Starting ${name}${option ? ` (option: ${option})` : ''}` });

  try {
    const payload: Record<string, unknown> = { service };
    if (option) payload.option = option;

    const { ok, data } = await pyFetch('/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!ok) throw new Error((data?.message as string) ?? `Python API error`);
    addLog({ level: 'success', action: 'START_SERVICE', message: `${name} started` });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'START_SERVICE', message: `Failed to start ${name}: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
