import { NextRequest, NextResponse } from 'next/server';
import { getAuthState, setAuthState, addLog, pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, authCode } = await req.json();
  if (!userId || !authCode) {
    return NextResponse.json({ error: 'userId and authCode are required' }, { status: 400 });
  }

  const state = getAuthState(userId);
  if (state.authLocked) {
    return NextResponse.json({ error: 'Auth locked — stop services before re-authenticating' }, { status: 409 });
  }

  addLog({ level: 'info', action: 'EXCHANGE_TOKEN', message: `Exchanging token — user: ${userId}, code: …${authCode.slice(-4)}` });

  try {
    const { ok, data } = await pyFetch('/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user: userId, auth_code: authCode, force: true }),
    });

    if (!ok) throw new Error((data?.message as string) ?? `HTTP error from Python API`);

    if (data.accepted) {
      setAuthState(userId, { authenticated: true, authLocked: true });
      addLog({ level: 'success', action: 'EXCHANGE_TOKEN', message: String(data.message ?? 'Token accepted') });
    } else {
      addLog({ level: 'error', action: 'EXCHANGE_TOKEN', message: 'Token rejected by server' });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'EXCHANGE_TOKEN', message: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
