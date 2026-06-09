import { getLogs, subscribeToLogs, type LogEntry } from '../../_lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enc = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      for (const log of getLogs()) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(log)}\n\n`));
      }
      unsubscribe = subscribeToLogs((log: LogEntry) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(log)}\n\n`));
        } catch {
          unsubscribe?.();
          unsubscribe = null;
        }
      });
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
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
