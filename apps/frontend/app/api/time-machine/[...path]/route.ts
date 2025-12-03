import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const resolvedParams = await params;
        const pathSegments = resolvedParams.path || [];
        
        // Filter out empty segments and join
        const filteredSegments = pathSegments.filter(segment => segment && segment.trim() !== '');
        const path = filteredSegments.join('/');
        
        // Add trailing slash for directory listings
        const needsTrailingSlash = !path.includes('.') && !path.endsWith('/');
        const targetUrl = `http://100.93.172.21:6969/${path}${needsTrailingSlash ? '/' : ''}`;

        console.log('🔄 [TIME-MACHINE] Incoming:', request.url);
        console.log('🔄 [TIME-MACHINE] Path segments:', pathSegments);
        console.log('🔄 [TIME-MACHINE] Filtered segments:', filteredSegments);
        console.log('🔄 [TIME-MACHINE] Proxying to:', targetUrl);

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/json,*/*',
                'User-Agent': 'Next.js Time Machine Proxy',
            },
        });

        console.log('✅ [TIME-MACHINE] Status:', response.status);

        if (!response.ok) {
            console.error('❌ [TIME-MACHINE] Failed:', response.statusText);
            return NextResponse.json(
                { error: `Failed to fetch: ${response.statusText}` },
                { status: response.status }
            );
        }

        const contentType = response.headers.get('content-type') || 'text/html';
        const data = await response.text();

        console.log('✅ [TIME-MACHINE] Data length:', data.length);
        console.log('✅ [TIME-MACHINE] Preview:', data.substring(0, 100));

        return new NextResponse(data, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            },
        });
    } catch (error: any) {
        console.error('❌ [TIME-MACHINE] Error:', error);
        return NextResponse.json(
            { error: 'Proxy failed', details: error.message },
            { status: 500 }
        );
    }
}
