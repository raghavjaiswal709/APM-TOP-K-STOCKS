import { NextRequest, NextResponse } from 'next/server';
import { getCreds, addLog } from '../_lib/state';

export const dynamic = 'force-dynamic';

// Fyers OAuth URL — built directly from config.ini, no Python API needed.
// Format: https://api-t1.fyers.in/api/v3/generate-authcode?client_id=...&redirect_uri=...&response_type=code&state=None
const FYERS_AUTH_BASE = 'https://api-t1.fyers.in/api/v3/generate-authcode';

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

  const creds = getCreds().find(u => u.id === userId);
  if (!creds) return NextResponse.json({ error: `User "${userId}" not found in config.ini` }, { status: 404 });

  const params = new URLSearchParams({
    client_id:     creds.clientId,
    redirect_uri:  creds.redirectUri,
    response_type: 'code',
    state:         'None',
  });

  const auth_url = `${FYERS_AUTH_BASE}?${params.toString()}`;

  addLog({
    level:   'success',
    action:  'GET_AUTH_URL',
    message: `Auth URL built for ${userId} (client_id: ${creds.clientId.slice(0, 8)}…)`,
  });

  return NextResponse.json({ auth_url });
}
