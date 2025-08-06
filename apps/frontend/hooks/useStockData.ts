
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
    const buffer = 30 * 60 * 1000;
    const expandedStart = new Date(visibleStart.getTime() - buffer);
    const expandedEnd = new Date(visibleEnd.getTime() + buffer);
    const gaps = [];
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
    for (const gap of gaps) {
      await fetchIncrementalData(gap.start, gap.end);
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

