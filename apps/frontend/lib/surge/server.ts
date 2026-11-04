/**
 * Server-side client for the Surge SSE server (`surge_sse_server.py`,
 * internal network, no auth) — a port of the trading dashboard's
 * `SurgeScreenerService` (`/watchlist` + `/surges` merge) and
 * `SurgeEpisodePollerService.toSurgeSignal` (episode → SurgeSignal).
 *
 * Import from route handlers only.
 */
import {
  IST_OFFSET_MINUTES,
  normalizeSurgeTercile,
  normalizeSurgeType,
  type ScreenedCompany,
  type SurgeDirection,
  type SurgeSignal,
  type SurgeSnapshot,
} from './types';

export const SURGE_API_URL = (
  process.env.SURGE_SCREENER_API_URL || 'http://100.93.172.21:5220'
).replace(/\/+$/, '');

// A cache miss on /watchlist runs a full daily + per-company intraday scan
// server-side and can take tens of seconds — outlast that cold build.
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * The dashboard polls `/surges` every 30s and refreshes the screen every 60s.
 * Every open watchlist here polls this route, so the upstream calls are
 * shared through a short in-process cache instead of fanning out per tab.
 */
const SURGES_TTL_MS = 15_000;
const WATCHLIST_TTL_MS = 60_000;

interface RawWatchlistRow {
  company_id: number;
  company_code: string;
  name?: string;
  /** The server sends `rank`; older builds sent `watchlist_rank`. */
  rank?: number;
  watchlist_rank?: number;
  [key: string]: unknown;
}

interface RawWatchlistResponse {
  date: string;
  n: number;
  source: 'cache' | 'built';
  watchlist: RawWatchlistRow[];
}

interface RawEpisode {
  date: string;
  company_id: number;
  company_code: string;
  watchlist_rank?: number;
  trigger_seq?: number;
  detector?: string;
  signal_bin_idx: number;
  signal_time?: string;
  signal_open?: number;
  signal_close?: number;
  entry_time?: string;
  entry_price?: number;
  entry_pending?: boolean;
  pace_obs?: number;
  pace_p99_thr?: number;
  pace_over_thr?: number;
  target_move_pct?: number | null;
  gated_pass?: boolean;
  gate_blocked_reason?: string | null;
  tercile?: string;
  [key: string]: unknown;
}

interface RawSurgesResponse {
  date: string;
  episodes: RawEpisode[];
}

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SURGE_API_URL}${path}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    const err = error as Error;
    const reason = err.name === 'AbortError' ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : err.message;
    throw new Error(`Surge server unreachable at ${SURGE_API_URL} — ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Single-flight TTL cache: concurrent callers share one upstream request. */
function cached<T>(ttlMs: number) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return (key: string, load: () => Promise<T>): Promise<T> => {
    const hit = entries.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value;
    const value = load();
    entries.set(key, { at: Date.now(), value });
    // A failure must not be served from cache for the whole TTL.
    value.catch(() => {
      if (entries.get(key)?.value === value) entries.delete(key);
    });
    return value;
  };
}

const cachedWatchlist = cached<RawWatchlistResponse>(WATCHLIST_TTL_MS);
const cachedSurges = cached<RawSurgesResponse>(SURGES_TTL_MS);

function dateQuery(date?: string): string {
  return date ? `?date=${encodeURIComponent(date)}` : '';
}

/** `RELIANCE` → `NSE:RELIANCE-EQ` — the screen only covers NSE equities. */
function toSymbol(companyCode: string): string {
  return `NSE:${companyCode.trim().toUpperCase()}-EQ`;
}

function toEpochSeconds(date: string, hhmm: string | undefined): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  if (!dateMatch || !timeMatch) return null;
  const [, y, mo, d] = dateMatch;
  const [, h, mi] = timeMatch;
  const utcMs =
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - IST_OFFSET_MINUTES * 60_000;
  return Math.floor(utcMs / 1000);
}

function describeReason(episode: RawEpisode): string {
  const parts = [`${episode.detector ?? 'surge'} detector on the ${episode.signal_time ?? '?'} bar`];
  if (typeof episode.pace_obs === 'number' && typeof episode.pace_p99_thr === 'number') {
    parts.push(`pace ${episode.pace_obs.toFixed(2)} vs p99 ${episode.pace_p99_thr.toFixed(2)}`);
  }
  return parts.join(' — ');
}

/** Same mapping as the dashboard's SurgeEpisodePollerService.toSurgeSignal. */
function toSurgeSignal(episode: RawEpisode): SurgeSignal | null {
  const surgeType = normalizeSurgeType(episode.detector);
  if (!surgeType) return null;
  if (!Number.isFinite(episode.company_id) || !episode.company_code) return null;
  if (!Number.isFinite(episode.signal_bin_idx)) return null;

  const companyId = String(episode.company_id);
  const companyCode = episode.company_code.trim().toUpperCase();

  const open = episode.signal_open;
  const close = episode.signal_close;
  let direction: SurgeDirection = 'NEUTRAL';
  if (typeof open === 'number' && typeof close === 'number') {
    if (close > open) direction = 'UP';
    else if (close < open) direction = 'DOWN';
  }

  const detectedAt =
    toEpochSeconds(episode.date, episode.signal_time) ??
    toEpochSeconds(episode.date, episode.entry_time) ??
    Math.floor(Date.now() / 1000);

  const price = typeof episode.entry_price === 'number' ? episode.entry_price : (episode.signal_close ?? 0);

  return {
    id: `${companyId}:${episode.signal_bin_idx}:${surgeType}`,
    companyId,
    companyCode,
    symbol: toSymbol(companyCode),
    signalBinIdx: episode.signal_bin_idx,
    binResolution: '5',
    surgeType,
    direction,
    // Clamped to [0, 1] like the dashboard's SurgeService does on ingest.
    score: typeof episode.pace_over_thr === 'number' ? Math.min(Math.max(episode.pace_over_thr, 0), 1) : 0,
    price,
    detectedAt,
    tercile: normalizeSurgeTercile(episode.tercile) ?? undefined,
    reason: describeReason(episode),
    metadata: {
      watchlistRank: episode.watchlist_rank ?? null,
      targetMovePct: episode.target_move_pct ?? null,
      gatedPass: episode.gated_pass ?? null,
      gateBlockedReason: episode.gate_blocked_reason ?? null,
      triggerSeq: episode.trigger_seq ?? null,
      signalTime: episode.signal_time ?? null,
      entryTime: episode.entry_time ?? null,
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getSurgeSnapshot(date?: string): Promise<SurgeSnapshot> {
  const key = date ?? 'today';
  const [watchlistResult, surgesResult] = await Promise.allSettled([
    cachedWatchlist(key, () => getJson<RawWatchlistResponse>(`/watchlist${dateQuery(date)}`)),
    cachedSurges(key, () => getJson<RawSurgesResponse>(`/surges${dateQuery(date)}`)),
  ]);

  const episodes = surgesResult.status === 'fulfilled' ? (surgesResult.value.episodes ?? []) : [];

  // `id` is deterministic, so a re-sent episode collapses onto one signal —
  // the same dedup the dashboard gets from upserting on it.
  const byId = new Map<string, SurgeSignal>();
  const targetByCompany = new Map<number, number>();
  for (const episode of episodes) {
    const signal = toSurgeSignal(episode);
    if (signal) byId.set(signal.id, signal);
    if (typeof episode.target_move_pct === 'number') {
      targetByCompany.set(episode.company_id, episode.target_move_pct);
    }
  }
  const signals = [...byId.values()].sort((a, b) => a.detectedAt - b.detectedAt);

  const watchlistRes = watchlistResult.status === 'fulfilled' ? watchlistResult.value : null;
  const screened: ScreenedCompany[] = (watchlistRes?.watchlist ?? [])
    .filter((row) => row.company_code)
    .map((row, index) => ({
      companyId: row.company_id,
      companyCode: row.company_code.trim().toUpperCase(),
      name: typeof row.name === 'string' ? row.name : null,
      watchlistRank: Number(row.rank ?? row.watchlist_rank ?? index + 1),
      symbol: toSymbol(row.company_code),
      targetMovePct: targetByCompany.get(row.company_id) ?? null,
    }))
    .sort((a, b) => a.watchlistRank - b.watchlistRank);

  const surgesDate = surgesResult.status === 'fulfilled' ? surgesResult.value.date : null;

  return {
    date: surgesDate ?? watchlistRes?.date ?? new Date(Date.now() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10),
    screener: watchlistRes ? { date: watchlistRes.date, n: watchlistRes.n, source: watchlistRes.source } : null,
    screenerError: watchlistResult.status === 'rejected' ? errorMessage(watchlistResult.reason) : null,
    screened,
    signals,
    surgesError: surgesResult.status === 'rejected' ? errorMessage(surgesResult.reason) : null,
    fetchedAt: Date.now(),
  };
}
