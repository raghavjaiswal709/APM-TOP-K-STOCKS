import { useState, useCallback, useRef } from 'react';

interface StockDataPoint {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface UseStockDataParams {
  companyId: string | null;
  interval?: string;
  indicators?: string[];
}

export function useStockData({ 
  companyId, 
  interval = '1m',
  indicators = []
}: UseStockDataParams) {
  const [data, setData] = useState<StockDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!companyId) {
      setError('No company selected');
      return;
    }

    if (!startDate) {
      setError('Start date is required');
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setLoading(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', startDate.toISOString());
      
      if (endDate) {
        queryParams.append('endDate', endDate.toISOString());
      } else {
        // If no end date, set end date to start date + 15 minutes
        const endDateTime = new Date(startDate);
        endDateTime.setMinutes(endDateTime.getMinutes() + 15);
        queryParams.append('endDate', endDateTime.toISOString());
        queryParams.append('firstFifteenMinutes', 'true');
      }
      
      queryParams.append('interval', interval);
      
      indicators.forEach(indicator => {
        queryParams.append('indicators', indicator);
      });

      const url = `/api/companies/${companyId}/ohlcv?${queryParams.toString()}`;
      console.log('Fetching stock data from:', url);

      const response = await fetch(url, { 
        signal: abortControllerRef.current.signal 
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const jsonData = await response.json();
      console.log('Stock data received:', jsonData);
      
      setData(jsonData);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Error fetching stock data:', err);
      setError('Failed to fetch stock data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, interval, indicators]);

  const clearData = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  return { data, loading, error, fetchData, clearData };
}
