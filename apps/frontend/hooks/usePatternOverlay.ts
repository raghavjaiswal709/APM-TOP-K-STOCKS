/**
 * usePatternOverlay — PatternPool Overlay API v2 integration hook
 *
 * Polls /api/pattern-overlay/overlay/v2/{symbol} and
 *       /api/pattern-overlay/overlay/v2/{symbol}/pattern_curves
 * every 15 minutes during IST market hours (09:45 – 15:30).
 *
 * Supports multi-PAA resolution via paaWidthMin option (3 | 5 | 9 | 15).
 *
 * Based on DAKSPHERE PatternPool Overlay API Integration Guide v4.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PatternProfile {
  win_rate: number;
  avg_return: number;
  sax_sim: number;
  archetype: string;
  day_count: number;
  intra_sim?: number;
  risk_adj_ret?: number;
  recurrence?: number;
  persistence?: number;
  is_noise?: boolean;
}

export interface PatternEntry {
  rank: number;
  cluster: string;
  score: number;
  profile: PatternProfile;
}

export interface StepEntry {
  word_step: string;
  slot_end: string;
  volatile: boolean;
  top3: PatternEntry[];
}

export interface GttOverlay {
  enabled: boolean;
  available: boolean;
}

/** Fields returned by /overlay/v2/{symbol} */
export interface OverlayData {
  symbol: string;
  date: string;
  // v2 engine metadata
  engine?: string;
  paa_segment_minutes?: number;
  current_n_segments?: number;
  low_match_confidence?: boolean;
  // lock
  lock_status: 'unlocked' | 'tentative' | 'locked';
  lock_word: string;
  // pattern results
  top3_locked: PatternEntry[];
  current_step: string;
  current_slot: string;
  current_volatile: boolean;
  current_top3: PatternEntry[];
  step_evolution: StepEntry[];
  nearest_days?: string[];
  gtt: GttOverlay;
}

export interface LiveCurve {
  completed_k: number;
  current_slot: string;
  paa_normalized: number[];
  cum_return: number[];
}

export interface HistoricalDay {
  date: string;
  curve: number[];
}

/** Fields returned by /overlay/v2/{symbol}/pattern_curves */
export interface PatternCurveEntry {
  rank: number;
  cluster: string;
  score: number;
  // v2 API returns price-scaled variants; legacy returns normalised
  centroid_price?: number[];
  band_upper_price?: number[];
  band_lower_price?: number[];
  // legacy field names (kept for backward compat)
  centroid?: number[];
  band_upper?: number[];
  band_lower?: number[];
  n_historical: number;
  historical_days: HistoricalDay[];
  meta: PatternProfile;
}

export interface PatternCurvesData {
  symbol: string;
  date: string;
  lock_word: string;
  lock_status: 'unlocked' | 'tentative' | 'locked';
  /** Slot-end times; length depends on resolution (25 @ 15m, 42 @ 9m, 75 @ 5m, 125 @ 3m) */
  time_axis: string[];
  live_curve: LiveCurve;
  patterns: PatternCurveEntry[];
}

/** Parsed fields from /health response */
export interface HealthData {
  allowed_paa_widths: number[];
  default_paa_width: number;
  completed_k: number;
  first_scoring_k: number;
  lock_k: number;
}

export interface PatternOverlayState {
  overlay: OverlayData | null;
  curves: PatternCurvesData | null;
  loading: boolean;
  error: string | null;
  /** true when HTTP 425 is returned (too early / pre-market, before 09:45 IST) */
  tooEarly: boolean;
  /** true after 15:30 IST — market is closed for the day */
  afterMarket: boolean;
  /** true when the pattern overlay service at port 8765 is unreachable */
  serviceDown: boolean;
  lastUpdated: number | null;
  /** ISO date string that was passed to the API (today or replay date) */
  date: string | null;
  /** Parsed /health response — available after first successful health check */
  healthData: HealthData | null;
  /** Currently active PAA resolution in minutes */
  paaWidthMin: number;
  refetch: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get today's date string in Asia/Kolkata (IST) timezone → "YYYY-MM-DD" */
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Return current IST time as { hours, minutes }.
 * IST = UTC+5:30 — computed purely from UTC to avoid local-timezone double-offset.
 */
function nowIST(): { hours: number; minutes: number } {
  const now = new Date();
  // UTC minutes-of-day + 330 (5h30m) = IST minutes-of-day
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMin = (utcMin + 330) % 1440; // 1440 = 24×60, wrap midnight
  return { hours: Math.floor(istMin / 60), minutes: istMin % 60 };
}

/** True if IST clock is in [09:45, 15:30] (inclusive) */
function isInPollWindow(): boolean {
  const { hours, minutes } = nowIST();
  const totalMin = hours * 60 + minutes;
  const startMin = 9 * 60 + 45;   // 09:45
  const endMin   = 15 * 60 + 30;  // 15:30
  return totalMin >= startMin && totalMin <= endMin;
}

/** Classify current IST time relative to market hours */
function getMarketStatus(): 'before' | 'open' | 'after' {
  const { hours, minutes } = nowIST();
  const totalMin = hours * 60 + minutes;
  if (totalMin < 9 * 60 + 45) return 'before';  // before first valid slot
  if (totalMin > 15 * 60 + 30) return 'after';  // market closed
  return 'open';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Allowed PAA resolution values */
export const PAA_WIDTH_OPTIONS = [3, 5, 9, 15] as const;
export type PaaWidthMin = typeof PAA_WIDTH_OPTIONS[number];

interface UsePatternOverlayOptions {
  symbol: string;               // plain company code e.g. "ADANIGREEN"
  enabled?: boolean;
  /** Override date for replay mode (YYYY-MM-DD). Omit for live. */
  replayDate?: string | null;
  /** Historical days to request in pattern_curves (default 5) */
  historicalLimit?: number;
  /** PAA segment width in minutes: 3 | 5 | 9 | 15 (default 15) */
  paaWidthMin?: number;
}

/** 15-minute poll interval in ms */
const POLL_INTERVAL_MS  = 15 * 60 * 1000;
/** Retry interval when service is down (30 s) */
const SERVICE_DOWN_RETRY_MS = 30 * 1000;
/** Retry interval when fetch returns a server error (2 min) */
const FETCH_ERROR_RETRY_MS  = 2 * 60 * 1000;

export function usePatternOverlay({
  symbol,
  enabled = true,
  replayDate = null,
  historicalLimit = 5,
  paaWidthMin = 15,
}: UsePatternOverlayOptions): PatternOverlayState {
  const [overlay, setOverlay] = useState<OverlayData | null>(null);
  const [curves, setCurves] = useState<PatternCurvesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooEarly, setTooEarly] = useState(false);
  const [afterMarket, setAfterMarket] = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const abortRef   = useRef<AbortController | null>(null);
  const timerRef   = useRef<NodeJS.Timeout | null>(null);
  const symbolRef  = useRef(symbol);
  const replayDateRef      = useRef(replayDate);
  const historicalLimitRef = useRef(historicalLimit);
  const paaWidthMinRef     = useRef(paaWidthMin);

  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { replayDateRef.current = replayDate; }, [replayDate]);
  useEffect(() => { historicalLimitRef.current = historicalLimit; }, [historicalLimit]);
  useEffect(() => { paaWidthMinRef.current = paaWidthMin; }, [paaWidthMin]);

  // ── Schedule a one-shot retry ──────────────────────────────────────────
  const scheduleRetry = useCallback((delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      doFetch(symbolRef.current, replayDateRef.current, historicalLimitRef.current, paaWidthMinRef.current);
    }, delayMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main fetch logic ───────────────────────────────────────────────────
  const doFetch = useCallback(async (sym: string, rDate: string | null, hLimit: number, paaW: number) => {
    if (!sym) return;

    // ⚡ Set loading=true immediately so callers can gate rendering BEFORE the
    // health check + fetch complete (health check can take ~1s).
    setLoading(true);
    setError(null);

    // In live mode, check market window
    if (!rDate) {
      const status = getMarketStatus();
      if (status === 'before') {
        setTooEarly(true);
        setAfterMarket(false);
        setLoading(false);
        // Retry in 1 min — will keep checking until window opens
        scheduleRetry(60 * 1000);
        return;
      }
      if (status === 'after') {
        setAfterMarket(true);
        setTooEarly(false);
        // Fall through to fetch — show today's final data even after close.
        // isAfterMkt flag prevents scheduling another poll at the end.
      }
    }

    // Reset pre/post market flags when in window (but keep afterMarket if we just set it)
    setTooEarly(false);
    if (!rDate) {
      const s2 = getMarketStatus();
      if (s2 !== 'after') setAfterMarket(false);
    } else {
      setAfterMarket(false);
    }

    // ── Step 1: health check ─────────────────────────────────────────────
    let healthOk = false;
    try {
      const healthAc = new AbortController();
      const healthRes = await window.fetch('/api/pattern-overlay/health', {
        signal: healthAc.signal,
      });
      healthOk = healthRes.ok;
      if (healthRes.ok) {
        try {
          const hJson = await healthRes.json();
          setHealthData({
            allowed_paa_widths: hJson.allowed_paa_widths ?? [3, 5, 9, 15],
            default_paa_width:  hJson.default_paa_width  ?? 15,
            completed_k:        hJson.completed_k        ?? 0,
            first_scoring_k:    hJson.first_scoring_k    ?? 0,
            lock_k:             hJson.lock_k             ?? 0,
          });
        } catch {
          // Health JSON parse failure is non-fatal
        }
      }
    } catch {
      healthOk = false;
    }

    if (!healthOk) {
      setServiceDown(true);
      setLoading(false);
      console.warn('[PatternOverlay] Health check failed — service may be offline. Retrying in 30s.');
      scheduleRetry(SERVICE_DOWN_RETRY_MS);
      return;
    }
    setServiceDown(false);

    // ── Step 2: fetch overlay + curves ───────────────────────────────────
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const dateParam = rDate || todayIST();
    const paaQs = `paa_width_min=${paaW}`;

    // v2 endpoints with paa_width_min
    const overlayQs = rDate
      ? `?date=${rDate}&${paaQs}`
      : `?${paaQs}`;
    const curvesQs = rDate
      ? `?date=${rDate}&historical_limit=${hLimit}&${paaQs}`
      : `?historical_limit=${hLimit}&${paaQs}`;

    try {
      const [overlayRes, curvesRes] = await Promise.all([
        window.fetch(`/api/pattern-overlay/overlay/v2/${encodeURIComponent(sym)}${overlayQs}`, { signal: ac.signal }),
        window.fetch(`/api/pattern-overlay/overlay/v2/${encodeURIComponent(sym)}/pattern_curves${curvesQs}`, { signal: ac.signal }),
      ]);

      if (ac.signal.aborted) return;

      if (overlayRes.status === 425) {
        setTooEarly(true);
        setLoading(false);
        scheduleRetry(60 * 1000);
        return;
      }

      if (overlayRes.status === 404) {
        // Symbol not built for selected resolution — not an error, show unavailable
        setError(`Symbol "${sym}" not available for ${paaW}-min resolution`);
        setLoading(false);
        scheduleRetry(FETCH_ERROR_RETRY_MS);
        return;
      }

      if (overlayRes.status === 400) {
        // Invalid paa_width_min — fallback warning, don't crash
        console.warn(`[PatternOverlay] 400 Bad Request for paa_width_min=${paaW} — check allowed values`);
        setError(`Invalid resolution ${paaW} min — check allowed values`);
        setLoading(false);
        return;
      }

      if (overlayRes.status === 503) {
        setError('Pattern overlay service temporarily unavailable');
        setLoading(false);
        scheduleRetry(SERVICE_DOWN_RETRY_MS);
        return;
      }

      if (!overlayRes.ok) {
        // 500 or other server error — retry sooner than normal poll interval
        const errText = await overlayRes.text().catch(() => overlayRes.statusText);
        const msg = `Pattern overlay service error (HTTP ${overlayRes.status})`;
        throw Object.assign(new Error(msg), { _retryDelay: FETCH_ERROR_RETRY_MS, _raw: errText });
      }

      const overlayJson: OverlayData = await overlayRes.json();

      let curvesJson: PatternCurvesData | null = null;
      if (curvesRes.ok) {
        curvesJson = await curvesRes.json();
      } else if (curvesRes.status !== 425 && curvesRes.status !== 404) {
        console.warn(`[PatternOverlay] pattern_curves ${curvesRes.status} — overlay-only mode`);
      }

      if (ac.signal.aborted) return;

      setOverlay(overlayJson);
      if (curvesJson) setCurves(curvesJson);
      setDate(dateParam);
      setLastUpdated(Date.now());
      setError(null);

      // Don't poll again after market close — data is final for the day
      if (!rDate && getMarketStatus() === 'after') return;
      // Schedule next normal poll
      scheduleRetry(POLL_INTERVAL_MS);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[PatternOverlay] fetch error:', err);
      setError(err.message || 'Unknown error');
      // Retry sooner on fetch errors, normal interval otherwise
      scheduleRetry(err._retryDelay ?? FETCH_ERROR_RETRY_MS);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleRetry]);

  const refetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doFetch(symbolRef.current, replayDateRef.current, historicalLimitRef.current, paaWidthMinRef.current);
  }, [doFetch]);

  // Main effect — re-runs when symbol, replayDate, paaWidthMin, or enabled changes
  useEffect(() => {
    if (!enabled || !symbol) {
      setOverlay(null);
      setCurves(null);
      setLoading(false);
      setError(null);
      setTooEarly(false);
      setAfterMarket(false);
      setServiceDown(false);
      setLastUpdated(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // ✅ Immediately clear stale data when symbol OR resolution changes so the
    // chart never shows another company's / resolution's overlay while new
    // data is in-flight.
    setOverlay(null);
    setCurves(null);
    setDate(null);

    doFetch(symbol, replayDate, historicalLimit, paaWidthMin);

    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, replayDate, paaWidthMin, enabled]);

  return { overlay, curves, loading, error, tooEarly, afterMarket, serviceDown, lastUpdated, date, healthData, paaWidthMin, refetch };
}
