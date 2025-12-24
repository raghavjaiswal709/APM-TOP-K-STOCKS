import { NextRequest, NextResponse } from 'next/server';

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5502';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Notify request:', body);
    const response = await fetch(`${backendUrl}/auth/fyers/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Notify error:', errorData);
      throw new Error(`Failed to notify service: ${errorData}`);
    }
    const data = await response.json();
    console.log('Service notified successfully:', body.service);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Notify service error for ${backendUrl}:`, error?.message || error);
    return NextResponse.json(
      { error: error.message || 'Failed to notify Python service' },
      { status: 500 }
    );
  }
}

