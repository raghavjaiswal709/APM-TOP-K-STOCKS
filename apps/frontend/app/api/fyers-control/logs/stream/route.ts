import { getLogs, subscribeToLogs, type LogEntry } from '../../_lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enc = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  };

  const stream = new ReadableStream({
    start(controller) {
      for (const log of getLogs()) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(log)}\n\n`));
      }
      unsubscribe = subscribeToLogs((log: LogEntry) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(log)}\n\n`));
        } catch {
          stop();
        }
      });
      heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(': ping\n\n')); } catch { stop(); }
      }, 25_000);
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
