import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Notify request:', body);
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
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
  } catch (error) {
    console.error('Notify service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to notify Python service' },
      { status: 500 }
    );
  }
}

