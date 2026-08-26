import { NextResponse } from 'next/server';
import { pyFetch } from '../_lib/state';

export const dynamic = 'force-dynamic';

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;

function service(raw: unknown) {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    running:       b.running === true,
    startedBy:     str(b.started_by),
    startedAt:     str(b.started_at),
    lastStoppedBy: str(b.last_stopped_by),
    lastStoppedAt: str(b.last_stopped_at),
    option:        str(b.option),
    stopsAt:       str(b.stops_at),
  };
}

const OFFLINE = {
  running: false, startedBy: null, startedAt: null,
  lastStoppedBy: null, lastStoppedAt: null, option: null, stopsAt: null,
};

/**
 * Full controller state, including who started each service and when.
 *
 * Reads /status rather than /health: /health only returns two booleans, so it
 * cannot answer "who started this", which is the whole point of this panel.
 *
 * Deliberately not logged — every open dashboard polls this on a timer, and
 * logging it buries the actions operators actually care about.
 */
export async function GET() {
  try {
    const { data } = await pyFetch('/status');
    return NextResponse.json({
      reachable: true,
      data: service(data.data),
      min:  service(data.min),
      currentSessionUser: str(data.current_session_user),
      usersLoggedInToday: Array.isArray(data.users_logged_in_today)
        ? (data.users_logged_in_today as unknown[]).filter((u): u is string => typeof u === 'string')
        : [],
      validate: data.validate ?? null,
    });
  } catch (err: unknown) {
    // A stopped service and an unreachable controller look identical unless we
    // say which one it is, and only one of them needs someone to go fix it.
    return NextResponse.json({
      reachable: false,
      data: { ...OFFLINE },
      min:  { ...OFFLINE },
      currentSessionUser: null,
      usersLoggedInToday: [],
      validate: null,
      error: (err as Error).message,
    });
  }
}
