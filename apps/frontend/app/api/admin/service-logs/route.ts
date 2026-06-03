import { NextRequest } from 'next/server';
import http from 'http';
import { CONTAINERS, ContainerKey } from '../constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_KEYS = Object.keys(CONTAINERS) as ContainerKey[];

let _apiVersion: string | null = null;
async function getApiVersion(): Promise<string> {
  if (_apiVersion) return _apiVersion;
  const { headers } = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = http.request(
      { socketPath: '/var/run/docker.sock', path: '/_ping', method: 'GET' },
      resolve,
    );
    req.setTimeout(5000, () => req.destroy(new Error('ping timeout')));
    req.on('error', reject);
    req.end();
  });
  _apiVersion = (headers['api-version'] as string) || '1.41';
  return _apiVersion;
}

/**
 * Docker log frames use a multiplexed binary protocol:
 *   Byte 0:   stream type (1=stdout, 2=stderr)
 *   Bytes 1-3: zeros
 *   Bytes 4-7: payload size (big-endian uint32)
 *   Then:     payload bytes
 *
 * This function strips those headers and returns clean text lines.
 */
function stripDockerFrameHeaders(buf: Buffer): string {
  let output = '';
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (size === 0) { offset += 8; continue; }
    if (offset + 8 + size > buf.length) break;
    output += buf.subarray(offset + 8, offset + 8 + size).toString('utf8');
    offset += 8 + size;
  }
  return output;
}

/**
 * GET /api/admin/service-logs?key=<containerKey>&tail=100
 * Streams real-time Docker container logs as SSE events.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const key = params.get('key') as ContainerKey | null;
  const tail = Math.min(parseInt(params.get('tail') || '100', 10), 500);

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return new Response(`data: ${JSON.stringify({ error: `key must be one of: ${ALLOWED_KEYS.join(', ')}` })}\n\n`, {
      status: 400,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const containerName = CONTAINERS[key];

  let v: string;
  try {
    v = await getApiVersion();
  } catch {
    return new Response(`data: ${JSON.stringify({ error: 'Docker socket unreachable' })}\n\n`, {
      status: 503,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const logPath = `/v${v}/containers/${encodeURIComponent(containerName)}/logs?stdout=1&stderr=1&follow=1&tail=${tail}&timestamps=1`;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Start Docker log stream in background
  (async () => {
    const sendSSE = async (text: string) => {
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line) continue;
        const payload = `data: ${JSON.stringify({ log: line })}\n\n`;
        await writer.write(new TextEncoder().encode(payload));
      }
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const opts: http.RequestOptions = {
          socketPath: '/var/run/docker.sock',
          path: logPath,
          method: 'GET',
        };

        const req2 = http.request(opts, (res) => {
          if (res.statusCode === 404) {
            writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: `Container ${containerName} not found` })}\n\n`));
            writer.close();
            resolve();
            return;
          }

          let remainder = Buffer.alloc(0);

          res.on('data', (chunk: Buffer) => {
            const combined = Buffer.concat([remainder, chunk]);
            const text = stripDockerFrameHeaders(combined);
            if (text) sendSSE(text).catch(() => {});
            // Keep any trailing partial frame
            remainder = Buffer.alloc(0);
          });

          res.on('end', () => {
            writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ log: '--- stream ended ---' })}\n\n`));
            writer.close();
            resolve();
          });

          res.on('error', reject);
        });

        req2.setTimeout(60 * 60 * 1000); // 1-hour max
        req2.on('error', reject);
        req2.end();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      try {
        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
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
