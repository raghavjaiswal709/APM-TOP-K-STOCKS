import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

/**
 * GET /api/admin/validate/run
 * SSE proxy for validation streaming
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const failedOnly = searchParams.get('failedOnly') || '';

  const backendUrl = `${BACKEND_URL}/api/admin/validate/run${failedOnly ? `?failedOnly=${failedOnly}` : ''}`;

  try {
    const response = await fetch(backendUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok || !response.body) {
      return new Response(
        JSON.stringify({ error: 'Failed to connect to backend' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a transform stream to pass through the SSE data
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body.getReader();

    // Pipe the backend response to the client
    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
        }
      } catch (error) {
        console.error('Stream error:', error);
      } finally {
        try {
          await writer.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('SSE proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
