// Portfolio Trades API
import { NextRequest, NextResponse } from 'next/server';

// This API works with client-side localStorage, so we just validate the request
// The actual data management happens on the client side

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Portfolio trades are managed client-side. Use portfolioService on the client.',
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const required = ['companyCode', 'companyName', 'exchange', 'tradeType', 'shares', 'pricePerShare'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate trade type
    if (!['BUY', 'SELL'].includes(body.tradeType)) {
      return NextResponse.json(
        { success: false, error: 'tradeType must be BUY or SELL' },
        { status: 400 }
      );
    }

    // Validate numbers
    if (body.shares <= 0 || body.pricePerShare <= 0) {
      return NextResponse.json(
        { success: false, error: 'shares and pricePerShare must be positive numbers' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Trade validated. Execute on client side.',
      data: body,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
