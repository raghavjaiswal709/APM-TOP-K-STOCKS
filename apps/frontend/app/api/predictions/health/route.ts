// apps/frontend/app/api/predictions/health/route.ts
// Health check proxy for prediction server

import { NextRequest, NextResponse } from 'next/server';

const PREDICTION_SERVER_URL = process.env.PREDICTION_SERVER_URL || 'http://100.93.172.21:5112';

/**
 * GET /api/predictions/health
 * Proxies to: http://100.93.172.21:5112/health
 */
export async function GET(request: NextRequest) {
    try {
        console.log(`[Prediction Health] 🏥 Checking health at ${PREDICTION_SERVER_URL}/health`);

        const response = await fetch(`${PREDICTION_SERVER_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
            return NextResponse.json(
                { status: 'stopped', running: false, error: `Server returned ${response.status}` },
                { status: 200 }
            );
        }

        const data = await response.json();
        console.log(`[Prediction Health] ✅ Status: ${data.status}`);

        return NextResponse.json(data, { status: 200 });

    } catch (error: any) {
        console.error('[Prediction Health] ❌ Error:', error.message);

        return NextResponse.json(
            { status: 'stopped', running: false, error: error.message },
            { status: 200 }
        );
    }
}
