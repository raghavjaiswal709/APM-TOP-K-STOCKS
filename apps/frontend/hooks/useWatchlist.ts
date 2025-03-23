import { useState, useEffect } from 'react';

interface Company {
  company_code: string;
  avg_daily_high_low_range: number;
  avg_daily_volume: number;
  avg_trading_capital: number;
  instrument_token: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
}

export function useWatchlist() {
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);

  useEffect(() => {
    async function fetchWatchlist() {
      setLoading(true);
      setError(null);

      try {
        const today = '2025-02-16'; // Ensure this matches your CSV file dates
        const apiUrl = `/api/watchlist/${selectedWatchlist}?date=${today}`;

        console.log('Fetching watchlist data from:', apiUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout

        const response = await fetch(apiUrl, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Watchlist data received:', data);

        setCompanies(data.companies || []);
        setExists(data.exists);
      } catch (err) {
        console.error('Error fetching watchlist data:', err);
        setError('Failed to fetch watchlist data');
        setCompanies([]);
        setExists(false);
      } finally {
        setLoading(false);
      }
    }

    fetchWatchlist();
  }, [selectedWatchlist]);

  return { selectedWatchlist, setSelectedWatchlist, companies, loading, error, exists };
}
