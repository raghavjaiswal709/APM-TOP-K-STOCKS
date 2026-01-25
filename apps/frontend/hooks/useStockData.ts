
import { useState, useCallback, useRef, useEffect } from 'react';
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<DataCache>({});
  const loadingQueueRef = useRef<Set<string>>(new Set());
  const getCacheKey = useCallback((company: string, start: Date, end: Date, interval: string) => {
    return `${company}_${interval}_${start.getTime()}_${end.getTime()}`;
  }, []);
  const getCachedData = useCallback((start: Date, end: Date) => {
    const key = getCacheKey(companyCode || '', start, end, interval);
    return cacheRef.current[key] || null;
  }, [getCacheKey, companyCode, interval]);
  const setCachedData = useCallback((start: Date, end: Date, data: StockDataPoint[]) => {
    const key = getCacheKey(companyCode || '', start, end, interval);
    cacheRef.current[key] = data;
  }, [getCacheKey, companyCode, interval]);
  const fetchData = useCallback(async (
    startDate?: Date,
    endDate?: Date,
    options: {
      fetchAllData?: boolean;
      merge?: boolean;
      priority?: 'high' | 'normal';
    } = {}
  ) => {
    if (!companyCode) {
      setError('No company selected');
      return [];
    }
    const { fetchAllData = false, merge = false, priority = 'normal' } = options;
    if (!startDate && !fetchAllData) {
      setError('Either provide a start date or set fetchAllData to true');
      return [];
    }
    const requestKey = `${companyCode}_${startDate?.getTime()}_${endDate?.getTime()}`;
    if (loadingQueueRef.current.has(requestKey)) {
      console.log('Request already in progress, skipping duplicate:', requestKey);
      return [];
    }
    if (startDate && endDate && enableIncrementalLoading) {
      const cachedData = getCachedData(startDate, endDate);
      if (cachedData) {
        console.log('Returning cached data for range:', startDate, endDate);
        if (merge) {
          setData(prevData => mergeData(prevData, cachedData));
        } else {
          setData(cachedData);
        }
        return cachedData;
      }
    }
    if (abortControllerRef.current && priority !== 'high') {
      abortControllerRef.current.abort();
    }
    loadingQueueRef.current.add(requestKey);
    setLoading(true);
    setError(null);
    try {
      abortControllerRef.current = new AbortController();
      const queryParams = new URLSearchParams({
        exchange,
        interval,
        ...indicators.length > 0 && { indicators: indicators.join(',') }
      });
      if (startDate) {
        queryParams.append('startDate', startDate.toISOString());
        queryParams.append('endDate', endDate?.toISOString() || new Date(startDate.getTime() + 6.25 * 60 * 60 * 1000).toISOString());
      } else {
        queryParams.append('fetchAllData', 'true');
      }
      const url = `/api/companies/${companyCode}/ohlcv?${queryParams.toString()}`;
      console.log(`Fetching stock data: ${url}`);
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const jsonData = await response.json() as StockDataPoint[];
      console.log(`Successfully fetched ${jsonData.length} data points`);
      if (startDate && endDate && enableIncrementalLoading) {
        setCachedData(startDate, endDate, jsonData);
      }
      if (jsonData.length > 0) {
        const newStart = new Date(jsonData[0].interval_start);
        const newEnd = new Date(jsonData[jsonData.length - 1].interval_start);
        setDataRange(prev => ({
          start: prev.start ? (newStart < prev.start ? newStart : prev.start) : newStart,
          end: prev.end ? (newEnd > prev.end ? newEnd : prev.end) : newEnd
        }));
      }
      if (merge) {
        setData(prevData => mergeData(prevData, jsonData));
      } else {
        setData(jsonData);
      }
      return jsonData;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return [];
      }
      console.error('Error fetching stock data:', err);
      setError(`Failed to fetch stock data: ${err.message}`);
      return [];
    } finally {
      loadingQueueRef.current.delete(requestKey);
      setLoading(false);
    }
  }, [companyCode, exchange, interval, indicators, enableIncrementalLoading, getCachedData, setCachedData]);
  const mergeData = useCallback((existing: StockDataPoint[], newData: StockDataPoint[]): StockDataPoint[] => {
    const combined = [...existing, ...newData];
    const uniqueMap = new Map<string, StockDataPoint>();
    combined.forEach(item => {
      uniqueMap.set(item.interval_start, item);
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
      new Date(a.interval_start).getTime() - new Date(b.interval_start).getTime()
    );
  }, []);
  const fetchIncrementalData = useCallback(async (start: Date, end: Date) => {
    return fetchData(start, end, { merge: true, priority: 'high' });
  }, [fetchData]);
  const fetchAllData = useCallback(async () => {
    return fetchData(undefined, undefined, { fetchAllData: true });
  }, [fetchData]);
  const clearData = useCallback(() => {
    setData([]);
    setError(null);
    setDataRange({ start: null, end: null });
    cacheRef.current = {};
    loadingQueueRef.current.clear();
  }, []);
  const loadDataForRange = useCallback(async (visibleStart: Date, visibleEnd: Date) => {
    if (!enableIncrementalLoading) return;

    // Dynamic buffer: fetch 5x the visible range in both directions (total ~10x buffer + viewport)
    const viewportDuration = visibleEnd.getTime() - visibleStart.getTime();
    // Min buffer of 1 day to ensure we don't fetch tiny chunks on high zoom
    const minBuffer = 24 * 60 * 60 * 1000;
    const buffer = Math.max(viewportDuration * 5, minBuffer);

    const expandedStart = new Date(visibleStart.getTime() - buffer);
    const expandedEnd = new Date(visibleEnd.getTime() + buffer);

    // Throttle checks
    const requestKey = `range_${expandedStart.getTime()}_${expandedEnd.getTime()}`;
    if (loadingQueueRef.current.has(requestKey)) return;

    const gaps: { start: Date; end: Date }[] = [];

    // Check left gap (history)
    if (!dataRange.start || expandedStart < dataRange.start) {
      // Only fetch if we are significantly past the cached start
      // or if we have no data
      gaps.push({
        start: expandedStart,
        end: dataRange.start || visibleStart
      });
    }

    // Check right gap (future/recent) -- usually less needed if live, but good for range scrolling
    if (!dataRange.end || expandedEnd > dataRange.end) {
      // For right gap, we often cap at "Now" if it's real-time, but fetch can handle that validation
      gaps.push({
        start: dataRange.end || visibleEnd,
        end: expandedEnd
      });
    }

    if (gaps.length > 0) {
      // loadingQueueRef.current.add(requestKey); // Add to queue to throttle
      // We rely on fetchIncrementalData's internal queue check, but preventing spam here is good.
      // But fetchIncrementalData generates its own key.
      // Let's just iterate.
      for (const gap of gaps) {
        console.log(`Fetching gap: ${gap.start.toISOString()} to ${gap.end.toISOString()}`);
        await fetchIncrementalData(gap.start, gap.end);
      }
      // loadingQueueRef.current.delete(requestKey);
    }
  }, [enableIncrementalLoading, dataRange, fetchIncrementalData]);
  useEffect(() => {
    clearData();
  }, [companyCode, clearData]);
  return {
    data,
    loading,
    error,
    dataRange,
    fetchData,
    fetchAllData,
    fetchIncrementalData,
    loadDataForRange,
    clearData
  };
}

