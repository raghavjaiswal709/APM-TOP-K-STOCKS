export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5002';

export async function GET() {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  (async () => {
    try {
      const upstream = await fetch(`${BACKEND}/api/fyers-control/logs/stream`, {
        headers: { Accept: 'text/event-stream' },
      });
      const reader = upstream.body!.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) { await writer.close(); return; }
        await writer.write(value);
        return pump();
      };
      await pump();
    } catch {
      try {
        await writer.write(enc.encode(`data: ${JSON.stringify({ level: 'error', action: 'STREAM', message: 'Backend SSE stream disconnected', timestamp: new Date().toISOString() })}\n\n`));
        await writer.close();
      } catch { /* already closed */ }
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
}
