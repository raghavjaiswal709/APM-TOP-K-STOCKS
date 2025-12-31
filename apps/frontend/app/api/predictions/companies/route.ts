// apps/frontend/app/api/predictions/companies/route.ts
// Companies list proxy for prediction server

import { NextRequest, NextResponse } from 'next/server';

const PREDICTION_SERVER_URL = process.env.PREDICTION_SERVER_URL || 'http://100.93.172.21:5112';

/**
 * GET /api/predictions/companies
 * Proxies to: http://100.93.172.21:5112/companies
 */
export async function GET(request: NextRequest) {
    try {
        console.log(`[Prediction Companies] 📋 Fetching companies from ${PREDICTION_SERVER_URL}/companies`);

        const response = await fetch(`${PREDICTION_SERVER_URL}/companies`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            return NextResponse.json(
                { companies: [], count: 0, error: `Server returned ${response.status}` },
                { status: 200 }
            );
        }

        const data = await response.json();
        console.log(`[Prediction Companies] ✅ Got ${data.count || 0} companies`);

        return NextResponse.json(data, { status: 200 });

    } catch (error: any) {
        console.error('[Prediction Companies] ❌ Error:', error.message);

        return NextResponse.json(
            { companies: [], count: 0, error: error.message },
            { status: 200 }
        );
    }
}
