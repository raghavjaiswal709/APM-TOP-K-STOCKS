
import { useState, useCallback, useRef } from 'react';

interface StockDataPoint {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface DataCache {
  [key: string]: StockDataPoint[];
}
interface UseStockDataParams {
  companyCode: string | null;
  exchange?: string;
  interval?: string;
  indicators?: string[];
  enableIncrementalLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY-CACHE: Module-level singleton that survives hook re-instantiation and
// company switches. Keyed by company+exchange+interval. Auto-expires at IST
// midnight (new calendar day).
// ─────────────────────────────────────────────────────────────────────────────

interface DayCacheEntry {
  data: StockDataPoint[];
  /** IST date string 'YYYY-MM-DD' when this data was cached */
  day: string;
  /** ISO string of the last data point's interval_start — used for incremental append */
  lastTimestamp: string;
}

/** Singleton cache — lives for the lifetime of the JS module */
const dayCache = new Map<string, DayCacheEntry>();

/** Get today's date string in IST (Asia/Kolkata) */
function getTodayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
}

function dayCacheKey(company: string, exchange: string, interval: string): string {
  return `${company}__${exchange}__${interval}`;
}

function getDayCacheEntry(company: string, exchange: string, interval: string): DayCacheEntry | null {
  const key = dayCacheKey(company, exchange, interval);
  const entry = dayCache.get(key);
  if (!entry) return null;
  // Auto-expire: if the cached day is not today, discard
  if (entry.day !== getTodayIST()) {
    dayCache.delete(key);
    return null;
  }
  return entry;
}

function setDayCacheEntry(company: string, exchange: string, interval: string, data: StockDataPoint[]): void {
  if (data.length === 0) return;
  const key = dayCacheKey(company, exchange, interval);
  dayCache.set(key, {
    data,
    day: getTodayIST(),
    lastTimestamp: data[data.length - 1].interval_start,
  });
}

/** Merge + deduplicate + sort two data arrays */
function mergeStockData(existing: StockDataPoint[], incoming: StockDataPoint[]): StockDataPoint[] {
  const map = new Map<string, StockDataPoint>();
  // Existing first, then incoming overwrites duplicates (incoming is fresher)
  for (const p of existing) map.set(p.interval_start, p);
  for (const p of incoming) map.set(p.interval_start, p);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.interval_start).getTime() - new Date(b.interval_start).getTime()
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * useStockData — fetches OHLCV stock data for the dashboard chart.
 *
 * ARCHITECTURE:
 * 1. NO auto-effects inside this hook. The consumer (dashboard page) controls
 *    when to clear and when to fetch. This eliminates all race conditions.
 * 2. Every fetch is tagged with a monotonically increasing `fetchId`.
 *    When data arrives, if the fetchId doesn't match the latest, the result is
 *    silently discarded — preventing stale responses from overwriting fresh state.
 * 3. `clearData()` resets the hook's local state, aborts ALL in-flight requests
 *    (including incremental range fetches), and does NOT wipe the day-cache.
 *    Previously fetched company data survives for instant restore.
 * 4. Day-cache (module singleton): keyed by company+exchange+interval, auto-expires
 *    at IST midnight. On company switch-back, data is restored instantly and only
 *    newer data is fetched incrementally.
 * 5. `sessionRef` tracks the current company+exchange+interval session. Every
 *    async operation checks it before applying results, preventing stale data
 *    from a previous company leaking into the new one.
 */
export function useStockData({
  companyCode,
  exchange = 'NSE',
  interval = '1m',
  indicators = [],
  enableIncrementalLoading = true
}: UseStockDataParams) {
  const [data, setData] = useState<StockDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataRange, setDataRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  // ★ isLoadingMore: true when incremental gap-fill fetches are in progress (e.g. user scrolled left)
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // dataRef always holds the latest data — used inside async fetchData to avoid stale closures
  const dataRef = useRef<StockDataPoint[]>([]);

  // ★ SESSION TRACKING: tracks current company+exchange+interval. Incremented on
  // every clearData() call. Every async path captures the session ID at start and
  // checks it after each await — if it's changed, the operation bails immediately.
  const sessionIdRef = useRef(0);

  // Keep dataRef in sync with state
  const setDataAndRef = useCallback((updater: StockDataPoint[] | ((prev: StockDataPoint[]) => StockDataPoint[])) => {
    if (typeof updater === 'function') {
      setData(prev => {
        const next = updater(prev);
        dataRef.current = next;
        return next;
      });
    } else {
      dataRef.current = updater;
      setData(updater);
    }
  }, []);

  // Monotonically increasing fetch ID — used to discard stale responses
  const fetchIdRef = useRef(0);
  // ★ Set of ALL active AbortControllers — clearData() aborts every one of them
  const activeAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const rangeCacheRef = useRef<DataCache>({});
  const loadingQueueRef = useRef<Set<string>>(new Set());

  const getCacheKey = useCallback((company: string, start: Date, end: Date, intv: string) => {
    return `${company}_${intv}_${start.getTime()}_${end.getTime()}`;
  }, []);

  const getCachedData = useCallback((start: Date, end: Date) => {
    const key = getCacheKey(companyCode || '', start, end, interval);
    return rangeCacheRef.current[key] || null;
  }, [getCacheKey, companyCode, interval]);

  const setCachedData = useCallback((start: Date, end: Date, cacheData: StockDataPoint[]) => {
    const key = getCacheKey(companyCode || '', start, end, interval);
    rangeCacheRef.current[key] = cacheData;
  }, [getCacheKey, companyCode, interval]);

  /** Helper: update dataRange from an array of points */
  const updateDataRange = useCallback((points: StockDataPoint[]) => {
    if (points.length === 0) return;
    const newStart = new Date(points[0].interval_start);
    const newEnd = new Date(points[points.length - 1].interval_start);
    setDataRange(prev => ({
      start: prev.start ? (newStart < prev.start ? newStart : prev.start) : newStart,
      end: prev.end ? (newEnd > prev.end ? newEnd : prev.end) : newEnd,
    }));
  }, []);

  // ───── restoreFromDayCache ─────
  // Instantly restores cached data into the hook state. Returns the cache entry
  // if one exists (same day), or null if not.
  const restoreFromDayCache = useCallback((): DayCacheEntry | null => {
    if (!companyCode) return null;
    const entry = getDayCacheEntry(companyCode, exchange, interval);
    if (!entry) return null;
    console.log(`[useStockData] ★ Day-cache HIT for ${companyCode}/${exchange}/${interval}: ${entry.data.length} points (last=${entry.lastTimestamp})`);
    setDataAndRef(entry.data);
    updateDataRange(entry.data);
    setError(null);
    return entry;
  }, [companyCode, exchange, interval, updateDataRange]);

  // ───── fetchData ─────
  const fetchData = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    options: {
      fetchAllData?: boolean;
      merge?: boolean;
      priority?: 'high' | 'normal';
      /** If true, fetched data will be merged into existing data + day-cache */
      appendToCache?: boolean;
      /** If true, fetch data going backwards. Pass startDate+endDate for days-based range. */
      fetchBefore?: boolean;
      /** Number of candles to fetch (legacy, used with fetchBefore when no startDate is given) */
      limit?: number;
    } = {}
  ) => {
    if (!companyCode) {
      setError('No company selected');
      return [];
    }
    const { fetchAllData = false, merge = false, priority = 'normal', appendToCache = false, fetchBefore = false, limit } = options;

    if (!startDate && !fetchAllData && !fetchBefore) {
      setError('Either provide a start date or set fetchAllData to true');
      return [];
    }

    // Show the left-edge "Fetching candles…" indicator for fetchBefore operations
    if (fetchBefore) setIsLoadingMore(true);

    // ★ Capture session at start — used to bail if company changes mid-flight
    const capturedSession = sessionIdRef.current;
    const capturedCompany = companyCode;
    const capturedExchange = exchange;
    const capturedInterval = interval;

    const requestKey = `${companyCode}_${startDate?.getTime()}_${endDate?.getTime()}_${fetchAllData}_${fetchBefore}_${limit}`;
    if (loadingQueueRef.current.has(requestKey)) {
      console.log('[useStockData] Request already in progress, skipping:', requestKey);
      return [];
    }

    // Check incremental range cache (only for non-fetchAllData, non-fetchBefore range requests)
    if (startDate && endDate && enableIncrementalLoading && !fetchAllData && !fetchBefore) {
      const cachedData = getCachedData(startDate, endDate);
      if (cachedData) {
        console.log('[useStockData] Returning range-cached data');
        if (merge) {
          setDataAndRef(prevData => mergeStockData(prevData, cachedData));
        } else {
          setDataAndRef(cachedData);
        }
        return cachedData;
      }
    }

    // ★ Create a new AbortController and register it in the active set.
    // clearData() will abort ALL controllers in this set.
    const controller = new AbortController();
    activeAbortControllersRef.current.add(controller);

    // Explicit 5-minute timeout — prevents hangs on slow/intermittent connections
    const fetchTimeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    // Tag this fetch with a unique ID to detect stale responses
    const thisFetchId = ++fetchIdRef.current;

    loadingQueueRef.current.add(requestKey);
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        exchange,
        interval,
        ...(indicators.length > 0 && { indicators: indicators.join(',') })
      });
      if (fetchBefore && endDate) {
        // fetchBefore mode: going backwards from endDate
        queryParams.append('endDate', endDate.toISOString());
        queryParams.append('fetchBefore', 'true');
        if (startDate) {
          // Days-based: include explicit start date so backend uses date-range query
          queryParams.append('startDate', startDate.toISOString());
        } else if (limit) {
          // Legacy candle-count mode (backward compat)
          queryParams.append('limit', String(limit));
        }
      } else if (startDate) {
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate?.toISOString() || new Date(startDate.getTime() + 6.25 * 60 * 60 * 1000).toISOString());
      } else {
        queryParams.append('fetchAllData', 'true');
      }

      const url = `/api/companies/${capturedCompany}/ohlcv?${queryParams.toString()}`;
      console.log(`[useStockData] Fetching: ${url} (fetchId=${thisFetchId}, session=${capturedSession})`);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });

      // ★ SESSION CHECK after network await — bail if company switched
      if (sessionIdRef.current !== capturedSession) {
        console.log(`[useStockData] Session changed (was=${capturedSession}, now=${sessionIdRef.current}), discarding response for ${capturedCompany}`);
        return [];
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const jsonData = await response.json() as StockDataPoint[];

      // ★ SESSION CHECK after JSON parse — bail if company switched
      if (sessionIdRef.current !== capturedSession) {
        console.log(`[useStockData] Session changed during parse, discarding response for ${capturedCompany}`);
        return [];
      }

      // ★ STALE RESPONSE CHECK: if fetchIdRef has moved on, discard
      if (fetchIdRef.current !== thisFetchId) {
        console.log(`[useStockData] Discarding stale response (fetchId=${thisFetchId}, current=${fetchIdRef.current})`);
        return [];
      }

      console.log(`[useStockData] Received ${jsonData.length} data points for ${capturedCompany} (fetchId=${thisFetchId})`);

      // Cache range data for incremental loading
      if (startDate && endDate && enableIncrementalLoading) {
        setCachedData(startDate, endDate, jsonData);
      }

      // Determine the final dataset to set
      let finalData: StockDataPoint[];
      if (merge || appendToCache) {
        // Use dataRef.current (always fresh) instead of `data` (stale closure)
        finalData = mergeStockData(dataRef.current, jsonData);
        setDataAndRef(finalData);
      } else {
        finalData = jsonData;
        setDataAndRef(jsonData);
      }

      // Update data range
      updateDataRange(finalData);

      // ★ Update the day-cache with the full merged dataset (use captured values, not closure)
      setDayCacheEntry(capturedCompany, capturedExchange, capturedInterval, finalData);
      console.log(`[useStockData] Day-cache updated for ${capturedCompany}: ${finalData.length} points`);

      return jsonData;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log(`[useStockData] Request aborted for ${capturedCompany}`);
        return [];
      }
      // Only set error if this session is still current
      if (sessionIdRef.current === capturedSession) {
        console.error('[useStockData] Error:', err);
        setError(`Failed to fetch stock data: ${err.message}`);
      }
      return [];
    } finally {
      clearTimeout(fetchTimeoutId);
      // ★ Remove this controller from the active set
      activeAbortControllersRef.current.delete(controller);
      loadingQueueRef.current.delete(requestKey);
      // Only clear loading/indicator if this session is still current
      if (sessionIdRef.current === capturedSession) {
        setLoading(false);
        if (fetchBefore) setIsLoadingMore(false);
      }
    }
  }, [companyCode, exchange, interval, indicators, enableIncrementalLoading, getCachedData, setCachedData, updateDataRange, setDataAndRef]);

  const fetchIncrementalData = useCallback(async (start: Date, end: Date) => {
    return fetchData(start, end, { merge: true, priority: 'high' });
  }, [fetchData]);

  const fetchAllData = useCallback(async () => {
    return fetchData(undefined, undefined, { fetchAllData: true });
  }, [fetchData]);

  /**
   * clearData — resets the hook's local state for a clean slate.
   * ★ Aborts ALL in-flight HTTP requests (primary + incremental range fetches).
   * ★ Bumps sessionId so any async path from the old company bails on next check.
   * Does NOT wipe the module-level day-cache. Previously fetched company data
   * survives for instant restore on switch-back.
   */
  const clearData = useCallback(() => {
    // ★ Bump session — every in-flight async path will see the mismatch and bail
    sessionIdRef.current++;
    fetchIdRef.current++;  // Also invalidate fetchId for extra safety

    // ★ Abort EVERY active HTTP request (not just one)
    for (const controller of activeAbortControllersRef.current) {
      controller.abort();
    }
    activeAbortControllersRef.current.clear();

    dataRef.current = [];
    setData([]);
    setError(null);
    setDataRange({ start: null, end: null });
    rangeCacheRef.current = {};
    loadingQueueRef.current.clear();
    setLoading(false);
    setIsLoadingMore(false);
  }, []);

  const loadDataForRange = useCallback(async (visibleStart: Date, visibleEnd: Date) => {
    if (!enableIncrementalLoading) return;

    // ★ Capture session at start — bail if company changes during gap fetches
    const capturedSession = sessionIdRef.current;

    const viewportDuration = visibleEnd.getTime() - visibleStart.getTime();
    const minBuffer = 24 * 60 * 60 * 1000;
    const buffer = Math.max(viewportDuration * 5, minBuffer);

    const expandedStart = new Date(visibleStart.getTime() - buffer);
    const expandedEnd = new Date(visibleEnd.getTime() + buffer);

    const requestKey = `range_${expandedStart.getTime()}_${expandedEnd.getTime()}`;
    if (loadingQueueRef.current.has(requestKey)) return;

    const gaps: { start: Date; end: Date }[] = [];

    if (!dataRange.start || expandedStart < dataRange.start) {
      gaps.push({
        start: expandedStart,
        end: dataRange.start || visibleStart
      });
    }

    if (!dataRange.end || expandedEnd > dataRange.end) {
      gaps.push({
        start: dataRange.end || visibleEnd,
        end: expandedEnd
      });
    }

    if (gaps.length > 0) {
      // ★ Signal that incremental loading is in progress (shows left-edge spinner)
      setIsLoadingMore(true);
      try {
        for (const gap of gaps) {
          // ★ CHECK SESSION before each gap fetch — bail if company switched
          if (sessionIdRef.current !== capturedSession) {
            console.log(`[useStockData] loadDataForRange: session changed, aborting remaining gaps`);
            return;
          }
          console.log(`[useStockData] Fetching gap: ${gap.start.toISOString()} to ${gap.end.toISOString()}`);
          await fetchIncrementalData(gap.start, gap.end);
        }
      } finally {
        // Only clear if session is still current (avoid resetting for new company)
        if (sessionIdRef.current === capturedSession) {
          setIsLoadingMore(false);
        }
      }
    }
  }, [enableIncrementalLoading, dataRange, fetchIncrementalData]);

  // ★ NO useEffect for companyCode changes! The consumer controls clear + fetch.

  return {
    data,
    loading,
    error,
    dataRange,
    isLoadingMore,
    fetchData,
    fetchAllData,
    fetchIncrementalData,
    loadDataForRange,
    clearData,
    restoreFromDayCache,
  };
}
