import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

/**
 * GET /api/admin/permanently-stopped
 * Get the list of permanently stopped symbols
 */
export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/permanently-stopped`, {
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
    console.error('Error fetching permanently stopped:', error);
    return NextResponse.json(
      { success: false, message: error.message, data: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/permanently-stopped
 * Add symbols to permanently stopped list
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

    const response = await fetch(`${BACKEND_URL}/api/admin/permanently-stopped`, {
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
    console.error('Error adding to permanently stopped:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/permanently-stopped
 * Remove a symbol from permanently stopped (symbol passed in body)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.symbol) {
      return NextResponse.json(
        { success: false, message: 'Symbol required' },
        { status: 400 }
      );
    }

    const encodedSymbol = encodeURIComponent(body.symbol);
    const response = await fetch(`${BACKEND_URL}/api/admin/permanently-stopped/${encodedSymbol}`, {
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
    console.error('Error removing from permanently stopped:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
