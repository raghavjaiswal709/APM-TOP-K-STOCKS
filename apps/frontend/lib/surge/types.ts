/**
 * Surge types — ported from the DAKSphere Trading Dashboard
 * (`packages/shared/src/surge.ts` + `watchlist.ts`), trimmed to what the
 * watchlists here read.
 *
 * Data comes from the Surge SSE server (`GET /watchlist`, `GET /surges`), the
 * same upstream the dashboard's SurgeScreenerService and
 * SurgeEpisodePollerService poll. See `lib/surge/server.ts`.
 */

/** Mixed case on purpose: the exact detector vocabulary, embedded verbatim in `id`. */
export const SURGE_TYPES = ['Ramp', 'P99', 'Ramp+P99'] as const;
export type SurgeType = (typeof SURGE_TYPES)[number];

/** NEUTRAL means "surging, but with no directional bias" — not "no surge". */
export const SURGE_DIRECTIONS = ['UP', 'DOWN', 'NEUTRAL'] as const;
export type SurgeDirection = (typeof SURGE_DIRECTIONS)[number];

/** How evenly the move was distributed across the bin. */
export const SURGE_TERCILES = ['lumpy', 'mild', 'steady'] as const;
export type SurgeTercile = (typeof SURGE_TERCILES)[number];

/** IST is UTC+05:30 all year (no DST). */
export const IST_OFFSET_MINUTES = 330;

export interface SurgeSignal {
  /** Idempotency key, deterministic: `${companyId}:${signalBinIdx}:${surgeType}`. */
  id: string;
  companyId: string;
  /** Plain NSE company code, e.g. `RELIANCE` — the key every watchlist here uses. */
  companyCode: string;
  /** Canonical Fyers form, `NSE:RELIANCE-EQ`. */
  symbol: string;
  signalBinIdx: number;
  binResolution: string;
  surgeType: SurgeType;
  direction: SurgeDirection;
  /** `pace_over_thr` from the detector, clamped to `[0, 1]`; compared to `minScore`. */
  score: number;
  /** Entry price once filled, else the detection bar's close — "where it was when called". */
  price: number;
  /** UNIX seconds. */
  detectedAt: number;
  tercile?: SurgeTercile;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** One row of the Surge screener's daily eligible-company scan. */
export interface ScreenedCompany {
  companyId: number;
  companyCode: string;
  name: string | null;
  watchlistRank: number;
  symbol: string;
  /** Fraction (0.04 = 4%), from that company's episode today; null when it has none. */
  targetMovePct: number | null;
}

/** `GET /api/surge` — today's screen and surge episodes in one payload. */
export interface SurgeSnapshot {
  /** IST trading day the episodes belong to, `YYYY-MM-DD`. */
  date: string;
  screener: {
    date: string;
    n: number;
    source: 'cache' | 'built';
  } | null;
  /** Set when `/watchlist` failed; signals can still be present. */
  screenerError: string | null;
  screened: ScreenedCompany[];
  signals: SurgeSignal[];
  /** Set when `/surges` failed. */
  surgesError: string | null;
  /** UNIX ms the server assembled this snapshot. */
  fetchedAt: number;
}

function canonicalize<T extends string>(allowed: readonly T[], raw: unknown): T | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  return allowed.find((candidate) => candidate.toLowerCase() === key) ?? null;
}

/**
 * Case-insensitive, and for the compound type part-order-insensitive too:
 * the detector labels a combined bin `p99+ramp`, which is our `Ramp+P99`.
 */
export function normalizeSurgeType(raw: unknown): SurgeType | null {
  const exact = canonicalize(SURGE_TYPES, raw);
  if (exact) return exact;
  if (typeof raw !== 'string' || !raw.includes('+')) return null;
  const parts = raw.split('+').map((part) => part.trim().toLowerCase()).sort();
  return (
    SURGE_TYPES.find((candidate) => {
      const candidateParts = candidate.split('+').map((part) => part.toLowerCase()).sort();
      return candidateParts.length === parts.length && candidateParts.every((part, i) => part === parts[i]);
    }) ?? null
  );
}

/**
 * The Surge server sends `mid` for the middle tercile; the dashboard's
 * vocabulary calls it `mild`. Without this alias a `mid` surge would never
 * match the Tercile filter.
 */
export function normalizeSurgeTercile(raw: unknown): SurgeTercile | null {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'mid') return 'mild';
  return canonicalize(SURGE_TERCILES, raw);
}
