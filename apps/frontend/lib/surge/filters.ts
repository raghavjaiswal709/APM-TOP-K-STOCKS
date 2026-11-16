import {
  IST_OFFSET_MINUTES,
  SURGE_DIRECTIONS,
  SURGE_TERCILES,
  SURGE_TYPES,
  type SurgeDirection,
  type SurgeSignal,
  type SurgeTercile,
  type SurgeType,
} from './types';

/*
 * Surge filters and search — ported from the trading dashboard's
 * `apps/web/src/lib/surge-filters.ts`.
 */

export interface SurgeFilters {
  /** Empty means "any" — every group starts unconstrained. */
  directions: SurgeDirection[];
  types: SurgeType[];
  terciles: SurgeTercile[];
  /** `[0, 1]`; 0 means no floor. */
  minScore: number;
}

export const DEFAULT_SURGE_FILTERS: SurgeFilters = {
  directions: [],
  types: [],
  terciles: [],
  minScore: 0,
};

/** The IST calendar day a UNIX-seconds instant falls on, `YYYY-MM-DD`. */
export function istDayKey(timestampSec: number): string {
  return new Date((timestampSec + IST_OFFSET_MINUTES * 60) * 1000).toISOString().slice(0, 10);
}

/** `NSE:RELIANCE-EQ` → `RELIANCE`; a plain code passes through upper-cased. */
export function companyCodeOf(symbol: string): string {
  return symbol.trim().replace(/^[A-Z]+:/i, '').replace(/-(EQ|BE|INDEX)$/i, '').toUpperCase();
}

/**
 * Comma or space separated names, an exchange prefix or `-EQ` suffix ignored,
 * so pasting `NSE:RELIANCE-EQ` still works.
 */
export function parseSearchTerms(query: string): string[] {
  return query
    .split(/[\s,]+/)
    .map((term) => companyCodeOf(term))
    .filter(Boolean)
    .slice(0, 10);
}

export function matchesSymbolSearch(code: string, terms: string[]): boolean {
  if (!terms.length) return true;
  const name = companyCodeOf(code);
  return terms.some((term) => name.includes(term));
}

export function matchesFilters(signal: SurgeSignal, filters: SurgeFilters): boolean {
  if (filters.directions.length && !filters.directions.includes(signal.direction)) return false;
  if (filters.types.length && !filters.types.includes(signal.surgeType)) return false;
  if (filters.terciles.length && (!signal.tercile || !filters.terciles.includes(signal.tercile))) {
    return false;
  }
  if (filters.minScore > 0 && signal.score < filters.minScore) return false;
  return true;
}

/** How many filter groups are narrowing the list — the number on the filter button. */
export function activeFilterCount(filters: SurgeFilters): number {
  return (
    (filters.directions.length ? 1 : 0) +
    (filters.types.length ? 1 : 0) +
    (filters.terciles.length ? 1 : 0) +
    (filters.minScore > 0 ? 1 : 0)
  );
}

/**
 * Persisted filters are trusted only as far as they still name real values —
 * anything else falls back to "any" rather than silently hiding every surge.
 */
export function sanitizeFilters(raw: unknown): SurgeFilters {
  if (!raw || typeof raw !== 'object') return DEFAULT_SURGE_FILTERS;
  const value = raw as Partial<Record<keyof SurgeFilters, unknown>>;
  const pick = <T extends string>(allowed: readonly T[], list: unknown): T[] =>
    Array.isArray(list) ? allowed.filter((item) => list.includes(item)) : [];
  const minScore = Number(value.minScore);

  return {
    directions: pick(SURGE_DIRECTIONS, value.directions),
    types: pick(SURGE_TYPES, value.types),
    terciles: pick(SURGE_TERCILES, value.terciles),
    minScore: Number.isFinite(minScore) ? Math.min(Math.max(minScore, 0), 1) : 0,
  };
}

// ── target-move floor (the watchlist's own filter, as in the dashboard) ─────

/** One-tap target floors — targets mostly sit between ~1.3% and 4%. */
export const TARGET_MOVE_PRESETS = [0, 0.02, 0.025, 0.03];

/**
 * Compared on the same 2-decimal percent the row shows, so a row reading
 * "2.95%" passes a 2.95% floor even when its raw value is 0.029496. A floor
 * of 0 lets everything through; with a floor set, an unknown target fails.
 */
export function meetsTargetFloor(target: number | null | undefined, floor: number): boolean {
  if (!(floor > 0)) return true;
  if (target === null || target === undefined || !Number.isFinite(target)) return false;
  return Math.round(target * 10_000) >= Math.round(floor * 10_000);
}

/** The episode's target move, carried in the surge's metadata (a fraction). */
export function surgeTargetMove(signal: SurgeSignal | undefined): number | null {
  const value = signal?.metadata?.targetMovePct;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// ── IST trading days ──────────────────────────────────────────────────────

/** Today's IST calendar day, `YYYY-MM-DD`. */
export function todayIstKey(): string {
  return istDayKey(Math.floor(Date.now() / 1000));
}

function isWeekendKey(dayKey: string): boolean {
  const day = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * The last `count` weekdays up to and including today (IST), newest first.
 * The Surge server screens any trading day on request (`/watchlist?date=`)
 * and has no "available dates" list, so every weekday is offered.
 */
export function recentWeekdays(count = 400): string[] {
  const out: string[] = [];
  const cursor = new Date(`${todayIstKey()}T00:00:00Z`);
  while (out.length < count) {
    const key = cursor.toISOString().slice(0, 10);
    if (!isWeekendKey(key)) out.push(key);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return out;
}

/** The latest weekday on or before today (IST) — the default watchlist date. */
export function latestWeekdayKey(): string {
  return recentWeekdays(1)[0];
}

/** `0.04` → `4.00%`. `target_move_pct` is a fraction, not a pre-scaled percentage. */
export function formatTargetMovePct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(2)}%`;
}

export function formatSignedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/** `HH:MM` in IST of a UNIX-seconds instant. */
export function formatTimeIST(timestampSec: number): string {
  return new Date((timestampSec + IST_OFFSET_MINUTES * 60) * 1000).toISOString().slice(11, 16);
}

export function formatPrice(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
