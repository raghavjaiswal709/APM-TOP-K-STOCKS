// src/hooks/useWatchlist.ts
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
        // Use specific date format matching your file names
        const today = '2025-02-16'; // This should match your actual CSV file dates
        
        // Ensure correct API path construction
        const apiUrl = `/api/watchlist/${selectedWatchlist}?date=${today}`;
        
        console.log('Fetching watchlist data from:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        // Handle non-200 responses properly
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

  return {
    selectedWatchlist,
    setSelectedWatchlist,
    companies,
    loading,
    error,
    exists,
  };
}
