import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

/**
 * GET /api/admin/failed-subscriptions
 * Get the list of failed subscriptions
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/failed-subscriptions`, {
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
    console.error('Error fetching failed subscriptions:', error);
    return NextResponse.json(
      { success: false, message: error.message, data: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/failed-subscriptions
 * Report failed subscriptions from the market-data page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.symbols || !Array.isArray(body.symbols)) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload: symbols array required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/admin/failed-subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error saving failed subscriptions:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/failed-subscriptions
 * Clear all failed subscriptions
 */
export async function DELETE() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/failed-subscriptions`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error clearing failed subscriptions:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
