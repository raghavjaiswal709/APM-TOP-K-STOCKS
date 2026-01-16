import { NextRequest, NextResponse } from 'next/server';

const backendUrl =
  process.env.BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:5502';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }
    console.log('Received auth code:', code);
    console.log('Backend URL:', backendUrl);
    const response = await fetch(`${backendUrl}/auth/fyers/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    console.log('Backend response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      throw new Error(`Token generation failed: ${errorText}`);
    }
    const data = await response.json();
    console.log('Token generated successfully');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Token generation error for ${backendUrl}:`, error?.message || error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}

