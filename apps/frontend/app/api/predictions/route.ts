// apps/frontend/app/api/predictions/route.ts
// Proxy route for prediction service - fetches directly from prediction server

import { NextRequest, NextResponse } from 'next/server';

// Direct connection to prediction server (NOT through backend)
const PREDICTION_SERVER_URL = process.env.PREDICTION_SERVER_URL || 'http://100.93.172.21:5112';

/**
 * GET /api/predictions?company=ICICIBANK
 * Proxies to: http://100.93.172.21:5112/predictions/{company}
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const company = searchParams.get('company');
        const startTime = searchParams.get('start_time');
        const endTime = searchParams.get('end_time');

        // Validation
        if (!company) {
            return NextResponse.json(
                { error: 'Missing required parameter: company' },
                { status: 400 }
            );
        }

        console.log(`[Prediction Proxy] 📡 Fetching predictions for: ${company}`);

        // Build URL with optional query params
        const url = new URL(`${PREDICTION_SERVER_URL}/predictions/${encodeURIComponent(company)}`);
        if (startTime) url.searchParams.append('start_time', startTime);
        if (endTime) url.searchParams.append('end_time', endTime);

        console.log(`[Prediction Proxy] 🔄 Fetching from: ${url.toString()}`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Prediction Proxy] ❌ Server error (${response.status}):`, errorText);

            if (response.status === 404) {
                return NextResponse.json(
                    { company, predictions: {}, count: 0, error: 'No predictions available' },
                    { status: 200 } // Return 200 with empty data for 404
                );
            }

            return NextResponse.json(
                { error: `Prediction server error: ${response.statusText}`, details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log(`[Prediction Proxy] ✅ Got ${data.count || 0} predictions for ${company}`);

        return NextResponse.json(data, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, max-age=0',
                'Content-Type': 'application/json',
            },
        });

    } catch (error: any) {
        // Downgrade to warn – prediction server (5112) being down is expected
        console.warn('[Prediction Proxy] ⚠️ Prediction service unavailable:', error.message || 'unknown');

        if (error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Request timeout - Prediction server not responding' },
                { status: 504 }
            );
        }

        // Return empty predictions instead of 500 when the service is simply down
        const company = request.nextUrl.searchParams.get('company') || 'unknown';
        return NextResponse.json(
            { company, predictions: {}, count: 0, error: 'Prediction service unavailable' },
            { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } }
        );
    }
}
