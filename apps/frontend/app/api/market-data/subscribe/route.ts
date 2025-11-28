import { NextRequest, NextResponse } from 'next/server';

const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { symbols } = body;

        // Validation
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Invalid symbols array' },
                { status: 400 }
            );
        }

        console.log(`📤 Proxying subscription request for ${symbols.length} symbols to NestJS`);

        // Proxy to NestJS backend with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${NEST_BACKEND_URL}/api/market-data/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symbols }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ Backend error: ${data.error || data.message}`);
            return NextResponse.json(
                { success: false, error: data.error || data.message || 'Subscription failed' },
                { status: response.status }
            );
        }

        console.log(`✅ Subscription successful: ${data.count} companies`);
        return NextResponse.json(data);

    } catch (error: any) {
        console.error(`❌ API Route Error:`, error);

        if (error.name === 'AbortError') {
            return NextResponse.json(
                { success: false, error: 'Request timeout - service may be overloaded' },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint for fetching current subscriptions
export async function GET(request: NextRequest) {
    try {
        console.log(`📡 Fetching current subscriptions from backend`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${NEST_BACKEND_URL}/api/market-data/subscriptions`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error(`❌ Failed to fetch subscriptions:`, error);
        return NextResponse.json(
            { success: false, error: error.message, subscriptions: [] },
            { status: error.name === 'AbortError' ? 504 : 500 }
        );
    }
}
