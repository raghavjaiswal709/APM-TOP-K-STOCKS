// apps/frontend/app/api/gtt-predictions/route.ts

import { NextRequest, NextResponse } from 'next/server';

const GTT_BACKEND_URL = process.env.NEXT_PUBLIC_GTT_API_URL || 'http://localhost:5000';

/**
 * ✅ GTT PREDICTIONS PROXY ROUTE
 * Proxies requests to the GTT backend service (PORT 5113)
 * Route: /api/gtt-predictions?symbol=BANDHANBNK
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const symbol = searchParams.get('symbol');

        // Validation
        if (!symbol) {
            return NextResponse.json(
                { error: 'Missing required parameter: symbol' },
                { status: 400 }
            );
        }

        console.log(`[GTT Proxy] 📡 Forwarding request for symbol: ${symbol}`);

        // Forward request to GTT backend
        const backendUrl = `${GTT_BACKEND_URL}/gtt/stock/${symbol}`;
        console.log(`[GTT Proxy] 🔄 Fetching from: ${backendUrl}`);

        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Add timeout
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GTT Proxy] ❌ Backend error (${response.status}):`, errorText);

            return NextResponse.json(
                {
                    error: `GTT backend error: ${response.statusText}`,
                    details: errorText,
                    backendUrl
                },
                { status: response.status }
            );
        }

        const data = await response.json();

        console.log(`[GTT Proxy] ✅ Successfully fetched ${data.total_predictions || 0} predictions`);

        // Return the data with proper headers
        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, max-age=0',
                'Content-Type': 'application/json',
            },
        });

    } catch (error: any) {
        console.error('[GTT Proxy] ❌ Error:', error);

        if (error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Request timeout - GTT backend not responding' },
                { status: 504 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to fetch GTT predictions',
                message: error.message,
                backendUrl: GTT_BACKEND_URL
            },
            { status: 500 }
        );
    }
}

/**
 * ✅ HEALTH CHECK ENDPOINT
 * Route: /api/gtt-predictions/health
 */
export async function HEAD(request: NextRequest) {
    try {
        const backendUrl = `${GTT_BACKEND_URL}/gtt/health`;
        const response = await fetch(backendUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
        });

        return new NextResponse(null, {
            status: response.ok ? 200 : 503,
        });
    } catch {
        return new NextResponse(null, { status: 503 });
    }
}
