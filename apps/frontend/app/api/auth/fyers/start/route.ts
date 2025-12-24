import { NextRequest, NextResponse } from 'next/server';

// Prefer internal service URL when running in Docker (BACKEND_URL points to service name),
// then fall back to public envs for local/dev host-port access.
const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5502';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean };

    const response = await fetch(`${backendUrl}/auth/fyers/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ force: body?.force ?? false }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.message || data?.error || 'Failed to start authentication process';
      return NextResponse.json({ error: message }, { status: response.status || 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Auth start error for ${backendUrl}:`, error?.message || error);
    return NextResponse.json(
      { error: `Failed to start authentication process (backend: ${backendUrl})` },
      { status: 502 }
    );
  }
}

