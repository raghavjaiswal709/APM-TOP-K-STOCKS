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

    const { ok, status, data } = await pyFetch('/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const startedBy = (data?.started_by as string) ?? null;
    const startedAt = (data?.started_at as string) ?? null;

    // The double-start guard. Returned as 200 with conflict:true rather than
    // rethrown: the refusal body carries started_by/started_at, which is
    // exactly what the operator needs, and an error status throws it away.
    if (status === 409 || (data?.running === true && data?.accepted !== true)) {
      const message = (data?.message as string)
        ?? (data?.error as string)
        ?? `${name} is already running${startedBy ? `, started by ${startedBy}` : ''}.`;
      addLog({
        level: 'warning',
        action: 'START_SERVICE',
        message: `${name} already running — started by ${startedBy ?? 'unknown'}`,
      });
      return NextResponse.json({ accepted: false, conflict: true, service: name, startedBy, startedAt, message });
    }

    // The controller reports /start failures under `error`, not `message` —
    // reading only `message` reduced a real "Permission denied: access_token.txt"
    // to a bare "HTTP 502".
    if (!ok || data?.accepted !== true) {
      throw new Error(
        (data?.message as string) ?? (data?.error as string) ?? `Python API returned HTTP ${status}`,
      );
    }

    addLog({
      level: 'success',
      action: 'START_SERVICE',
      message: `${name} started${startedBy ? ` by ${startedBy}` : ''}`,
    });
    return NextResponse.json({ ...data, accepted: true, conflict: false, startedBy, startedAt });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'START_SERVICE', message: `Failed to start ${name}: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
