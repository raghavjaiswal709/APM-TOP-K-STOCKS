import { useState, useEffect } from 'react';

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
  startDate?: Date;
  endDate?: Date;
  interval?: string;
  indicators?: string[];
}

export function useStockData({ 
  companyId, 
  startDate, 
  endDate, 
  interval = '10m',
  indicators = []
}: UseStockDataParams) {
  const [data, setData] = useState<StockDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't fetch if no company is selected
    if (!companyId) {
      setData([]);
      return;
    }

    async function fetchStockData() {
      setLoading(true);
      setError(null);

      try {
        // Build URL with query parameters
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('startDate', startDate.toISOString());
        if (endDate) queryParams.append('endDate', endDate.toISOString());
        if (interval) queryParams.append('interval', interval);
        
        // Add indicators if needed
        indicators.forEach(indicator => {
          queryParams.append('indicators', indicator);
        });

        const url = `/api/companies/${companyId}/ohlcv?${queryParams.toString()}`;
        console.log('Fetching stock data from:', url);

        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const jsonData = await response.json();
        console.log('Stock data received:', jsonData);
        
        setData(jsonData);
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError('Failed to fetch stock data');
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchStockData();
  }, [companyId, startDate, endDate, interval, indicators]);

  return {
    data,
    loading,
    error
  };
}
