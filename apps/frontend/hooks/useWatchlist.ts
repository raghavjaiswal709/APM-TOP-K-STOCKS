import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { usePersistentState } from './useStateRestoration';
import {
  isLiveDate,
  surgeSnapshotFetcher,
  surgeSnapshotKey,
  useSurgePrefs,
  type ManualAddition,
} from './useSurge';
import { latestWeekdayKey, recentWeekdays, surgeTargetMove } from '@/lib/surge/filters';
import type { SurgeSnapshot } from '@/lib/surge/types';

/*
 * The app's watchlist.
 *
 * NEW (Surge watchlist): the list is the Surge screener's ranked companies for
 * the date (`GET /api/surge` → the Surge SSE server's `/watchlist` +
 * `/surges`), the same source as the DAKSphere Trading Dashboard's
 * Watchlist panel, followed by any surging name the screen didn't list and
 * the user's own additions (`useSurgePrefs().additions`).
 * The watchlist_quant metrics (last close, ATR, IV, …) are merged onto each
 * row where the same company has them for that date.
 *
 * OLD: the list itself came from `GET /api/watchlist?date=` (watchlist_quant)
 * and the date picker from `GET /api/watchlist/dates` — kept below,
 * commented out.
 *
 * "Show all companies" still loads the master list (`/api/watchlist/all-companies`).
 */

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;          // optional — watchlist_quant may not populate this
  marker?: string;
  // NEW fields from watchlist_quant
  /** Surge screener rank for the date (was the watchlist_quant rank — now `quant_rank`). */
  rank?: number;
  last_close?: number;
  median_daily_tv_10d?: number;
  atr_pct_10d?: number;
  iv_10d?: number;
  vol_rank_xs?: number;
  dist_from_high_20d?: number;
  vol_ratio_t1_vs_10d?: number;
  median_tradable_ratio_10d?: number;
  min_tradable_ratio_10d?: number;
  median_p25_window_tv_10d?: number;
  max_position_inr?: number;
  days_capital_data?: number;
  pe_ratio?: number;
  total_valid_days?: number;   // optional legacy field — used by getFilteredCompanies
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  latest_close_price?: number;
  suggested_capital_deployment?: number;
  hourly_median_volume?: number;
  // NEW (Surge watchlist)
  /** Fraction (0.04 = 4%) — the up-target of the company's surge that day; null until one fills. */
  target_move_pct?: number | null;
  /** The company's watchlist_quant rank, when its metrics were merged in. */
  quant_rank?: number;
  /** `surge`: from the Surge screen / surges; `manual`: one of the user's additions. */
  watchlist_source?: 'surge' | 'manual';
}

// OLD: response shape of GET /api/watchlist?date= — still what the metrics merge reads.
interface WatchlistResponse {
  companies: MergedCompany[];
  exists: boolean;
  total: number;
  date: string;
}

interface UseWatchlistOptions {
  date?: string;
  showAllCompanies?: boolean;
  /** Override the localStorage cache key for companies.
   *  Use a page-specific key to prevent cross-page cache contamination
   *  (e.g. a page with showAllCompanies=true writing 2000+ companies to the
   *  shared key, which then loads into a page that only expects today's watchlist). */
  cacheKey?: string;
  // REMOVED: refined filter — watchlist_quant has no refined column
  // refinedFilter?: boolean | null;
}

// ── watchlist_quant metrics, merged onto the Surge rows ───────────────────

/** Metrics are a daily table — reuse a date's load across hook instances for a while. */
const METRICS_TTL_MS = 10 * 60_000;
const METRICS_TIMEOUT_MS = 10_000;
const metricsCache = new Map<string, { at: number; value: Promise<Map<string, MergedCompany>> }>();

/**
 * `GET /api/watchlist?date=` keyed by company code. Never rejects: metrics
 * are optional, so a failure (or a slow DB) just means rows without them.
 */
function loadQuantMetrics(date: string): Promise<Map<string, MergedCompany>> {
  const hit = metricsCache.get(date);
  if (hit && Date.now() - hit.at < METRICS_TTL_MS) return hit.value;

  const value = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), METRICS_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/watchlist?date=${encodeURIComponent(date)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as WatchlistResponse;
      const byCode = new Map<string, MergedCompany>();
      for (const company of data.companies ?? []) {
        if (company?.company_code) byCode.set(company.company_code.trim().toUpperCase(), company);
      }
      return byCode;
    } catch (error) {
      console.warn(`[useWatchlist] watchlist_quant metrics unavailable for ${date}:`, error);
      metricsCache.delete(date); // retry on the next use
      return new Map<string, MergedCompany>();
    } finally {
      clearTimeout(timer);
    }
  })();

  metricsCache.set(date, { at: Date.now(), value });
  return value;
}

/**
 * The Surge screen in rank order, then surging names the screen didn't list,
 * then the user's additions — each code once, metrics merged where known.
 */
function buildSurgeCompanies(
  snapshot: SurgeSnapshot | undefined,
  metricsByCode: Map<string, MergedCompany>,
  additions: ManualAddition[],
): MergedCompany[] {
  const out: MergedCompany[] = [];
  const seen = new Set<string>();

  for (const row of snapshot?.screened ?? []) {
    const code = row.companyCode;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const metrics = metricsByCode.get(code);
    out.push({
      ...metrics,
      company_id: row.companyId ?? metrics?.company_id,
      company_code: code,
      name: row.name || metrics?.name || code,
      // The Surge screen only covers NSE equities.
      exchange: 'NSE',
      marker: metrics?.marker || 'EQ',
      rank: row.watchlistRank,
      quant_rank: metrics?.rank,
      target_move_pct: row.targetMovePct,
      watchlist_source: 'surge',
    });
  }

  for (const signal of snapshot?.signals ?? []) {
    const code = signal.companyCode;
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const metrics = metricsByCode.get(code);
    const rank = signal.metadata?.watchlistRank;
    out.push({
      ...metrics,
      company_id: Number(signal.companyId) || metrics?.company_id,
      company_code: code,
      name: metrics?.name || code,
      exchange: 'NSE',
      marker: metrics?.marker || 'EQ',
      rank: typeof rank === 'number' ? rank : undefined,
      quant_rank: metrics?.rank,
      target_move_pct: surgeTargetMove(signal),
      watchlist_source: 'surge',
    });
  }

  for (const addition of additions) {
    if (seen.has(addition.code)) continue; // already on the screen
    seen.add(addition.code);
    const metrics = metricsByCode.get(addition.code);
    out.push({
      ...metrics,
      company_code: addition.code,
      name: addition.name || metrics?.name || addition.code,
      exchange: addition.exchange || metrics?.exchange || 'NSE',
      marker: addition.marker || metrics?.marker || 'EQ',
      rank: undefined,
      quant_rank: metrics?.rank,
      target_move_pct: null,
      watchlist_source: 'manual',
    });
  }

  return out;
}

/**
 * What changing the list means for consumers (several reset their selection
 * or re-fetch per-company data when `companies` changes identity). Target
 * moves are deliberately left out: they update through the day, and rows
 * read the live value from the Surge view instead.
 */
function listSignature(companies: MergedCompany[]): string {
  return companies
    .map((c) => `${c.company_code}|${c.rank ?? ''}|${c.name}|${c.marker ?? ''}|${c.watchlist_source ?? ''}|${c.quant_rank ?? ''}`)
    .join(';');
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const BASE_URL = '';
  // OLD: guarded the /dates fetch below.
  // const hasLoadedRef = useRef(false);

  // Determine the localStorage key for companies.
  // Callers can pass a page-specific cacheKey to avoid cross-page contamination
  // (e.g. a page that loads all 2000+ companies polluting a page that only wants today's watchlist).
  // Prefixed so a list cached by the old watchlist_quant source is never painted as the Surge list.
  const companiesStorageKey = `surge:${options.cacheKey || 'watchlist-companies'}`;
  // OLD: const companiesStorageKey = options.cacheKey || 'watchlist-companies';

  // The latest weekday is picked up front — the old hook did the same once
  // /dates came back (it auto-selected the most recent date).
  const [selectedDate, setSelectedDate] = useState<string | null>(() => latestWeekdayKey());
  // OLD: const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // NEW: the Surge server screens any trading day on request, so every
  // recent weekday is selectable (newest first, like the old /dates list).
  const availableDates = useMemo(() => recentWeekdays(), []);
  // OLD: dates came from watchlist_quant
  // const [availableDates, setAvailableDates] = usePersistentState<string[]>(
  //   'watchlist-availableDates',
  //   []
  // );
  const [companies, setCompanies] = usePersistentState<MergedCompany[]>(
    companiesStorageKey,
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [availableExchanges, setAvailableExchanges] = usePersistentState<string[]>(
    'watchlist-availableExchanges',
    []
  );
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [availableMarkers, setAvailableMarkers] = usePersistentState<string[]>(
    'watchlist-availableMarkers',
    []
  );
  const [showAllCompanies, setShowAllCompanies] = useState(options.showAllCompanies || false);
  // REMOVED: refinedFilter — watchlist_quant has no refined column
  // const [refinedFilter, setRefinedFilter] = useState<boolean | null>(options.refinedFilter !== undefined ? options.refinedFilter : null);

  const activeDate = options.date || selectedDate;
  const effectiveDate = activeDate || latestWeekdayKey();
  const live = isLiveDate(effectiveDate);

  // Sync showAllCompanies from options when prop changes
  useEffect(() => {
    if (options.showAllCompanies !== undefined) {
      setShowAllCompanies(options.showAllCompanies);
    }
  }, [options.showAllCompanies]);

  // OLD: Fetch available dates on mount (watchlist_quant) — replaced by recentWeekdays() above.
  // useEffect(() => {
  //   // Skip if we already have cached dates
  //   if (availableDates.length > 0 && hasLoadedRef.current) {
  //     console.log('⚡ [useWatchlist] Using cached dates');
  //     return;
  //   }
  //
  //   async function fetchAvailableDates() {
  //     try {
  //       const response = await fetch(`${BASE_URL}/api/watchlist/dates`);
  //       if (response.ok) {
  //         const data = await response.json();
  //         setAvailableDates(data.dates || []);
  //
  //         // Auto-select most recent date if none selected
  //         if (!selectedDate && data.dates && data.dates.length > 0) {
  //           setSelectedDate(data.dates[0]);
  //         }
  //         hasLoadedRef.current = true;
  //       }
  //     } catch (error) {
  //       console.error('[useWatchlist] Error fetching available dates:', error);
  //     }
  //   }
  //
  //   fetchAvailableDates();
  // }, [BASE_URL]);

  // ── NEW: the Surge watchlist ─────────────────────────────────────────────

  const { additions } = useSurgePrefs();

  // Same SWR key as the Surge view (`useSurgeWatchlist`), so a page's list
  // and its surge blocks share one request. Today's screen is refreshed like
  // the dashboard's (every 60s); a past date's screen is final.
  const {
    data: snapshot,
    error: snapshotError,
    isLoading: snapshotLoading,
  } = useSWR<SurgeSnapshot>(
    showAllCompanies ? null : surgeSnapshotKey(effectiveDate),
    surgeSnapshotFetcher,
    { refreshInterval: live ? 60_000 : 0, revalidateOnFocus: false, dedupingInterval: 10_000 }
  );

  const [metrics, setMetrics] = useState<{ date: string; byCode: Map<string, MergedCompany> } | null>(null);
  useEffect(() => {
    if (showAllCompanies) return;
    let cancelled = false;
    loadQuantMetrics(effectiveDate).then((byCode) => {
      if (!cancelled) setMetrics({ date: effectiveDate, byCode });
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveDate, showAllCompanies]);
  const metricsReady = metrics?.date === effectiveDate;

  const lastSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (showAllCompanies) {
      lastSignatureRef.current = null; // the master list owns `companies` now
      return;
    }

    if (snapshotLoading && !snapshot) {
      setLoading(true);
      return;
    }
    // Wait for the metrics too (they never reject and time out quickly), so
    // the list changes identity once per load instead of twice.
    if (!snapshotError && !metricsReady) {
      setLoading(true);
      return;
    }

    const list = buildSurgeCompanies(snapshotError ? undefined : snapshot, metrics?.byCode ?? new Map(), additions);
    const signature = `${effectiveDate}#${listSignature(list)}`;
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      setCompanies(list);
      setTotalCompanies(list.length);
      setAvailableExchanges([...new Set(list.map((c) => c.exchange).filter(Boolean))] as string[]);
      setAvailableMarkers([...new Set(list.map((c) => c.marker).filter(Boolean))] as string[]);
      console.log(`[useWatchlist] ✅ Surge watchlist for ${effectiveDate}: ${list.length} companies`);
    }

    const screenerFailure = snapshotError
      ? (snapshotError as Error).message
      : snapshot?.screenerError ?? null;
    if (screenerFailure) {
      setError(
        list.length
          ? 'Surge screener unreachable — showing surging names and your additions only'
          : `Surge screener unreachable for ${effectiveDate}`
      );
    } else {
      setError(list.length ? null : `No companies on the Surge screen for ${effectiveDate}`);
    }
    setExists(list.length > 0);
    setLoading(false);
  }, [
    showAllCompanies,
    snapshot,
    snapshotError,
    snapshotLoading,
    metrics,
    metricsReady,
    additions,
    effectiveDate,
    setCompanies,
    setAvailableExchanges,
    setAvailableMarkers,
  ]);

  // ── "Show all companies" (master list) — unchanged ───────────────────────
  // OLD: this effect also loaded the date's watchlist from watchlist_quant;
  // that branch is commented out below, the Surge effect above replaces it.
  useEffect(() => {
    let isCancelled = false;

    async function fetchWatchlist() {
      setLoading(true);
      setError(null);

      try {
        let apiUrl: string;

        if (showAllCompanies) {
          // Fetch all companies regardless of date
          console.log(`[useWatchlist] Fetching all companies`);
          apiUrl = `${BASE_URL}/api/watchlist/all-companies`;
        } else {
          return;
          // OLD: Fetch date-specific companies (watchlist_quant)
          // const dateParam = activeDate || new Date().toISOString().split('T')[0];
          // console.log(`[useWatchlist] Fetching watchlist for date: ${dateParam}`);
          //
          // // Build URL — refined param removed (not in watchlist_quant)
          // apiUrl = `${BASE_URL}/api/watchlist?date=${dateParam}`;
          // // OLD: refined param removed
          // // if (refinedFilter !== null && refinedFilter !== undefined) {
          // //   apiUrl += `&refined=${refinedFilter}`;
          // // }
        }

        console.log(`[useWatchlist] Fetching from: ${apiUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(apiUrl, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          mode: 'cors'
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        if (isCancelled) return;

        console.log('[useWatchlist] ✅ API Response received:', {
          companiesCount: data.companies?.length || 0,
          total: data.total,
          exists: data.exists,
          // OLD: refined filter removed
          // refinedFilterApplied: refinedFilter
        });

        if (!Array.isArray(data.companies)) {
          setCompanies([]);
          setExists(false);
          setTotalCompanies(0);
          setAvailableExchanges([]);
          setAvailableMarkers([]);
          setError(showAllCompanies ? 'No companies found' : `No companies found for date ${activeDate}`);
          return;
        }

        const validCompanies = data.companies.filter((company: MergedCompany) =>
          company.company_code && company.name && company.exchange
        );

        // OLD: refined count debug removed — no refined field in watchlist_quant
        // const refinedCount = validCompanies.filter((c: MergedCompany) => c.refined === true).length;
        // const nonRefinedCount = validCompanies.filter((c: MergedCompany) => c.refined === false || !c.refined).length;
        // console.log('[useWatchlist] 📊 Companies breakdown:', {
        //   total: validCompanies.length,
        //   refined: refinedCount,
        //   nonRefined: nonRefinedCount,
        //   filterActive: refinedFilter !== null ? (refinedFilter ? 'refined-only' : 'non-refined-only') : 'all'
        // });

        setCompanies(validCompanies);
        setExists(showAllCompanies ? true : (data.exists !== false));
        setTotalCompanies(data.total || validCompanies.length);

        const exchanges = [...new Set(validCompanies.map((c: MergedCompany) => c.exchange).filter(Boolean))] as string[];
        const markers = [...new Set(validCompanies.map((c: MergedCompany) => c.marker).filter(Boolean))] as string[];
        setAvailableExchanges(exchanges);
        setAvailableMarkers(markers);

        console.log(`[useWatchlist] ✅ Loaded ${validCompanies.length} companies`);

      } catch (err: unknown) {
        if (isCancelled) return;

        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`[useWatchlist] Error:`, err);
        setError(errorMessage);
        setCompanies([]);
        setExists(false);
        setAvailableExchanges([]);
        setAvailableMarkers([]);
        setTotalCompanies(0);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    if (showAllCompanies) {
      fetchWatchlist();
    }
    // OLD: if (showAllCompanies || activeDate || availableDates.length > 0) {
    //   fetchWatchlist();
    // }

    return () => {
      isCancelled = true;
    };
  }, [BASE_URL, showAllCompanies]);
  // OLD deps: [activeDate, BASE_URL, showAllCompanies, availableDates.length]

  const getFilteredCompanies = useCallback((filters: {
    exchange?: string;
    marker?: string;
    minValidDays?: number;
  }) => {
    return companies.filter(company => {
      if (filters.exchange && company.exchange?.toUpperCase() !== filters.exchange.toUpperCase()) {
        return false;
      }
      if (filters.marker && company.marker?.toUpperCase() !== filters.marker.toUpperCase()) {
        return false;
      }
      if (filters.minValidDays && (!company.total_valid_days || company.total_valid_days < filters.minValidDays)) {
        return false;
      }
      return true;
    });
  }, [companies]);

  return {
    selectedDate,
    setSelectedDate,
    availableDates,
    companies,
    loading,
    error,
    exists,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    getFilteredCompanies,
    showAllCompanies,
    setShowAllCompanies,
    // NEW (Surge watchlist): the screen's status, for a status line.
    screener: showAllCompanies ? null : (snapshot?.screener ?? null),
    // REMOVED: refined filter — watchlist_quant has no refined column
    // refinedFilter,
    // setRefinedFilter
  };
}
