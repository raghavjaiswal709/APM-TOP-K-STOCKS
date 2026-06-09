import { NextRequest, NextResponse } from 'next/server';
import { getCreds, addLog, pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const creds = getCreds().find(u => u.id === userId);
  if (!creds) return NextResponse.json({ error: `User "${userId}" not found in config.ini` }, { status: 404 });

  addLog({ level: 'info', action: 'GET_AUTH_URL', message: `Requesting auth URL for ${userId}` });

  try {
    const { ok, data } = await pyFetch('/auth-url', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user:         userId,
        client_id:    creds.clientId,
        secret_key:   creds.secretKey,
        redirect_uri: creds.redirectUri,
      }),
    });

    if (!ok) throw new Error((data?.message as string) ?? 'Python API error');

    addLog({
      level:   'success',
      action:  'GET_AUTH_URL',
      message: `Auth URL received for ${userId}`,
    });

    return NextResponse.json({ auth_url: data.auth_url });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'GET_AUTH_URL', message: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
