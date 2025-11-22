import { NextRequest, NextResponse } from 'next/server';

const BASE_IP = 'http://100.93.172.21:6969';

/**
 * API Proxy for MSAX Data
 * Bypasses CORS restrictions by fetching from server-side
 * 
 * Supported Endpoints:
 * 1. Master List: GET /api/msax?type=master
 * 2. Analysis Data: GET /api/msax?type=analysis&ticker=TICKER
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type');
        const ticker = searchParams.get('ticker');

        let targetUrl = '';

        if (type === 'master') {
            targetUrl = `${BASE_IP}/MSAX/`;
        } else if (type === 'analysis') {
            if (!ticker) {
                return NextResponse.json({ error: 'Ticker is required for analysis type' }, { status: 400 });
            }
            targetUrl = `${BASE_IP}/MSAX/${ticker.toUpperCase()}/analysis/regime_analysis.json`;
        } else {
            return NextResponse.json({ error: 'Invalid type parameter. Use "master" or "analysis"' }, { status: 400 });
        }

        console.log(`[MSAX Proxy] Fetching: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'Accept': type === 'analysis' ? 'application/json' : 'text/html',
            },
            signal: AbortSignal.timeout(10000), // 10 seconds timeout
        });

        if (!response.ok) {
            console.error(`[MSAX Proxy] External server returned ${response.status}`);
            return NextResponse.json(
                { error: `External server returned ${response.status}: ${response.statusText}` },
                { status: response.status }
            );
        }

        // For Master List, we return text (HTML)
        if (type === 'master') {
            const text = await response.text();
            return new NextResponse(text, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
                },
            });
        }

        // For Analysis, we return JSON
        if (type === 'analysis') {
            const data = await response.json();
            return NextResponse.json(data, {
                status: 200,
                headers: {
                    'Cache-Control': 'public, max-age=60', // Cache for 1 minute
                },
            });
        }

    } catch (error) {
        console.error('[MSAX Proxy] ❌ Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
