// apps/frontend/app/api/predictions/batch/route.ts
// Batch predictions proxy for prediction server

import { NextRequest, NextResponse } from 'next/server';

const PREDICTION_SERVER_URL = process.env.PREDICTION_SERVER_URL || 'http://100.93.172.21:5112';

/**
 * GET /api/predictions/batch?companies=ICICIBANK&companies=AXISBANK
 * Proxies to: http://100.93.172.21:5112/predictions/batch/multiple
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const companies = searchParams.getAll('companies');
        const startTime = searchParams.get('start_time');
        const endTime = searchParams.get('end_time');

        if (!companies || companies.length === 0) {
            return NextResponse.json(
                { error: 'Missing required parameter: companies' },
                { status: 400 }
            );
        }

        console.log(`[Prediction Batch] 📡 Fetching batch for: ${companies.join(', ')}`);

        // Build URL with query params
        const url = new URL(`${PREDICTION_SERVER_URL}/predictions/batch/multiple`);
        companies.forEach(c => url.searchParams.append('companies', c));
        if (startTime) url.searchParams.append('start_time', startTime);
        if (endTime) url.searchParams.append('end_time', endTime);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(30000), // Longer timeout for batch
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Prediction Batch] ❌ Server error (${response.status}):`, errorText);

            return NextResponse.json(
                { results: {}, error: `Server error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log(`[Prediction Batch] ✅ Got batch results for ${Object.keys(data.results || {}).length} companies`);

        return NextResponse.json(data, { status: 200 });

    } catch (error: any) {
        console.error('[Prediction Batch] ❌ Error:', error.message);

        return NextResponse.json(
            { results: {}, error: error.message },
            { status: 500 }
        );
    }
}
