import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Whitelisted container keys → actual Docker container names
export const CONTAINERS = {
  'fyers-5001': 'daks-fyers-5001',
  'fyers-5010': 'daks-fyers-5010',
  'backend':    'daks-backend',
  'frontend':   'daks-frontend',
} as const;

export type ContainerKey = keyof typeof CONTAINERS;
type Action = 'restart' | 'stop' | 'start';
const ALLOWED_ACTIONS: Action[] = ['restart', 'stop', 'start'];
const ALLOWED_KEYS = Object.keys(CONTAINERS) as ContainerKey[];

// Cache the negotiated API version so we only ping once per process
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

function dockerRequest(
  path: string,
  method = 'GET',
  body?: string,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath: '/var/run/docker.sock',
      path,
      method,
      headers: body
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          }
        : {},
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode ?? 0, data: raw });
        }
      });
    });

    req.setTimeout(10_000, () => {
      req.destroy(new Error('Docker request timed out'));
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getContainerStatus(containerName: string) {
  try {
    const v = await getApiVersion();
    const { status, data } = await dockerRequest(
      `/v${v}/containers/${encodeURIComponent(containerName)}/json`,
    );
    if (status === 404) return { running: false, status: 'not_found', startedAt: null, restartCount: 0, containerName };
    if (status !== 200 || !data || typeof data !== 'object') {
      return { running: false, status: 'error', startedAt: null, restartCount: 0, containerName };
    }
    const d = data as Record<string, unknown>;
    const state = d.State as Record<string, unknown> | undefined;
    return {
      running: (state?.Running as boolean) ?? false,
      status: (state?.Status as string) ?? 'unknown',
      startedAt: (state?.StartedAt as string) ?? null,
      restartCount: (d.RestartCount as number) ?? 0,
      containerName: ((d.Name as string) ?? '').replace(/^\//, ''),
    };
  } catch {
    return { running: false, status: 'unreachable', startedAt: null, restartCount: 0, containerName };
  }
}

/** GET /api/admin/service-control — returns status of all 4 main containers */
export async function GET() {
  const statuses = await Promise.all(
    ALLOWED_KEYS.map(async (key) => [key, { key, ...await getContainerStatus(CONTAINERS[key]) }])
  );
  return NextResponse.json({ services: Object.fromEntries(statuses) });
}

/** POST /api/admin/service-control — restart/stop/start a container */
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, action } = body as { key: unknown; action: unknown };

  if (!ALLOWED_KEYS.includes(key as ContainerKey)) {
    return NextResponse.json({ error: `key must be one of: ${ALLOWED_KEYS.join(', ')}` }, { status: 400 });
  }
  if (!ALLOWED_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: 'action must be "restart", "stop", or "start"' }, { status: 400 });
  }

  const containerName = CONTAINERS[key as ContainerKey];
  const v = await getApiVersion();
  const apiPath = `/v${v}/containers/${encodeURIComponent(containerName)}/${action as Action}`;

  try {
    const { status } = await dockerRequest(apiPath, 'POST');
    if (status === 204 || status === 200 || status === 304) {
      return NextResponse.json({ success: true, message: `Container ${containerName} ${action} initiated` });
    }
    if (status === 404) {
      return NextResponse.json({ success: false, error: 'Container not found' }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: `Docker daemon returned HTTP ${status}` }, { status: 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
