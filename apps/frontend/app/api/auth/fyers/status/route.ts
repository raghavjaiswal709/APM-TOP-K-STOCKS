import { NextRequest, NextResponse } from 'next/server';

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5502';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${backendUrl}/auth/fyers/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.warn('Backend auth status check failed');
      return NextResponse.json({
        authenticated: false,
        token_valid: false,
        expires_at: null,
        services_notified: []
      });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Auth status error for ${backendUrl}:`, error?.message || error);
    return NextResponse.json({
      authenticated: false,
      token_valid: false,
      expires_at: null,
      services_notified: []
    });
  }
}

