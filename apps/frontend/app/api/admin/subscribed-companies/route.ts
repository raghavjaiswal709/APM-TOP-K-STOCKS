import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/subscribed-companies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching subscribed companies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch subscribed companies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/admin/subscribed-companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving subscribed companies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save subscribed companies' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/admin/subscribed-companies`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error clearing subscribed companies:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to clear subscribed companies' },
      { status: 500 }
    );
  }
}
