import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json(
            { success: false, error: 'Symbol parameter is required' },
            { status: 400 }
        );
    }

    try {
        // Proxy to GTT backend on port 5113
        const response = await fetch(`http://100.93.172.21:5113/api/predictions/stock/${symbol}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            throw new Error(`GTT Service error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('[GTT API Route] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch GTT predictions' },
            { status: 500 }
        );
    }
}
