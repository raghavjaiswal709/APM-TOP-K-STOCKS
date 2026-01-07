import { NextRequest, NextResponse } from 'next/server';

const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let { symbols } = body;

        // Validation
        if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Invalid symbols array' },
                { status: 400 }
            );
        }

        console.log(`📤 Received subscription request for ${symbols.length} items:`, symbols);

        // Convert formatted symbols (NSE:SBIN-EQ) to company codes (SBIN)
        const companyCodes = symbols.map(symbol => {
            // If it's already a plain code (SBIN), use it as is
            if (!symbol.includes(':') && !symbol.includes('-')) {
                return symbol.trim().toUpperCase();
            }
            // If it's a formatted symbol (NSE:SBIN-EQ), extract the company code
            // Format: EXCHANGE:COMPANY_CODE-MARKER
            const match = symbol.match(/([A-Z]+):([A-Z0-9&\.-]+)(?:-([A-Z]+))?/);
            if (match) {
                return match[2]; // Return just the COMPANY_CODE part
            }
            return symbol.trim().toUpperCase();
        }).filter(Boolean);

        if (companyCodes.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No valid company codes extracted' },
                { status: 400 }
            );
        }

        console.log(`📤 Converted to company codes for ${companyCodes.length} companies:`, companyCodes);

        // Proxy to NestJS backend with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(`${NEST_BACKEND_URL}/live-market/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ companyCodes }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok || !data.success) {
            const errorMsg = data.error || data.message || 'Subscription failed';
            console.error(`❌ Backend error: ${errorMsg}`);
            return NextResponse.json(
                { 
                    success: false, 
                    error: errorMsg,
                    count: 0,
                    symbols: []
                },
                { status: response.ok ? 200 : response.status }
            );
        }

        // Backend returns: { success: true, message, symbols[], companyCodes[], clientId }
        const responseData = {
            success: true,
            count: data.symbols?.length || companyCodes.length || 0,
            symbols: data.symbols || [],
            companyCodes: data.companyCodes || companyCodes,
            message: data.message,
        };

        console.log(`✅ Subscription successful: ${responseData.count} companies`);
        return NextResponse.json(responseData);

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
