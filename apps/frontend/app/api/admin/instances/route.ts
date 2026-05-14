import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Action = 'restart' | 'stop' | 'start';
const ALLOWED_ACTIONS: Action[] = ['restart', 'stop', 'start'];

// Instance IDs discovered dynamically from Docker labels
const ALLOWED_INSTANCE_REGEX = /^instance[1-9][0-9]?$/;

// Services that run in each instance
const INSTANCE_SERVICES = ['frontend', 'backend', 'fyers-5001', 'fyers-5010', 'redis'] as const;

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

function dockerRequest(path: string, method = 'GET', body?: string): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      socketPath: '/var/run/docker.sock',
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk: string) => (raw += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, data: raw ? JSON.parse(raw) : null }); }
        catch { resolve({ status: res.statusCode ?? 0, data: raw }); }
      });
    });
    req.setTimeout(10_000, () => req.destroy(new Error('Docker request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** List all containers (including stopped) tagged with com.daks.instance label */
async function listInstanceContainers() {
  const v = await getApiVersion();
  // filters={"label":["com.daks.instance"]}
  const filters = encodeURIComponent(JSON.stringify({ label: ['com.daks.instance'] }));
  const { status, data } = await dockerRequest(`/v${v}/containers/json?all=1&filters=${filters}`);
  if (status !== 200 || !Array.isArray(data)) return [];
  return data as Array<{
    Id: string;
    Names: string[];
    Status: string;
    State: string;
    Labels: Record<string, string>;
  }>;
}

/** GET /api/admin/instances — returns all multi-instance container statuses */
export async function GET() {
  try {
    const containers = await listInstanceContainers();

    // Group containers by instance ID (e.g., "instance1")
    const instances: Record<string, {
      instanceId: string;
      instanceName: string;
      services: Record<string, { containerName: string; state: string; status: string; running: boolean }>;
      totalContainers: number;
      runningContainers: number;
    }> = {};

    for (const c of containers) {
      const instanceId = c.Labels['com.daks.instance'];
      const service = c.Labels['com.daks.service'];
      if (!instanceId) continue;

      if (!instances[instanceId]) {
        const num = instanceId.replace('instance', '');
        instances[instanceId] = {
          instanceId,
          instanceName: `Instance ${num}`,
          services: {},
          totalContainers: 0,
          runningContainers: 0,
        };
      }

      const running = c.State === 'running';
      instances[instanceId].services[service || 'unknown'] = {
        containerName: (c.Names[0] ?? '').replace(/^\//, ''),
        state: c.State,
        status: c.Status,
        running,
      };
      instances[instanceId].totalContainers++;
      if (running) instances[instanceId].runningContainers++;
    }

    return NextResponse.json({ instances });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/instances
 * { instanceId: "instance1", service?: "frontend", action: "restart"|"stop"|"start" }
 * If service is omitted, applies action to all containers in the instance.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { instanceId, service, action } = body as { instanceId: unknown; service?: unknown; action: unknown };

  if (typeof instanceId !== 'string' || !ALLOWED_INSTANCE_REGEX.test(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId — must match instance[1-9]' }, { status: 400 });
  }
  if (!ALLOWED_ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: 'action must be restart, stop, or start' }, { status: 400 });
  }
  // Optional service filter — must be from known list if provided
  if (service !== undefined && !INSTANCE_SERVICES.includes(service as typeof INSTANCE_SERVICES[number])) {
    return NextResponse.json({ error: `service must be one of: ${INSTANCE_SERVICES.join(', ')}` }, { status: 400 });
  }

  try {
    // Discover containers for this instance from Docker labels
    const containers = await listInstanceContainers();
    const targets = containers.filter((c) => {
      const cInstanceId = c.Labels['com.daks.instance'];
      const cService = c.Labels['com.daks.service'];
      if (cInstanceId !== instanceId) return false;
      if (service !== undefined && cService !== service) return false;
      return true;
    });

    if (targets.length === 0) {
      return NextResponse.json({ error: `No containers found for ${instanceId}${service ? ` service=${service}` : ''}` }, { status: 404 });
    }

    const v = await getApiVersion();
    const results: Array<{ containerName: string; success: boolean; message?: string; error?: string }> = [];

    for (const c of targets) {
      const name = (c.Names[0] ?? '').replace(/^\//, '');
      try {
        const { status } = await dockerRequest(`/v${v}/containers/${encodeURIComponent(name)}/${action as Action}`, 'POST');
        if (status === 204 || status === 200 || status === 304) {
          results.push({ containerName: name, success: true, message: `${action} initiated` });
        } else {
          results.push({ containerName: name, success: false, error: `Docker returned HTTP ${status}` });
        }
      } catch (err) {
        results.push({ containerName: name, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const allOk = results.every((r) => r.success);
    return NextResponse.json({ success: allOk, results }, { status: allOk ? 200 : 207 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
