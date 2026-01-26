import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

/**
 * GET /api/admin/subscription-status
 * Get all subscription statuses (subscribed, failed, stopped, permanentlyStopped)
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/subscription-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error.message, 
        data: {
          subscribed: [],
          failed: [],
          stopped: [],
          permanentlyStopped: []
        },
        counts: {
          subscribed: 0,
          failed: 0,
          stopped: 0,
          permanentlyStopped: 0
        }
      },
      { status: 500 }
    );
  }
}
