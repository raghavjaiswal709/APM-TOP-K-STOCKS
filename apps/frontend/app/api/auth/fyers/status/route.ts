import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    
    const response = await fetch(`${backendUrl}/auth/fyers/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn('Backend auth status check failed');
      // Return default status instead of error
      return NextResponse.json({
        authenticated: false,
        token_valid: false,
        expires_at: null,
        services_notified: []
      });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Auth status error:', error);
    // Return default status instead of error
    return NextResponse.json({
      authenticated: false,
      token_valid: false,
      expires_at: null,
      services_notified: []
    });
  }
}
