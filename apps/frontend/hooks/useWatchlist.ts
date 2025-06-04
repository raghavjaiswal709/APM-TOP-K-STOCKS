import { useState, useEffect } from 'react';

interface Company {
  company_code: string;          
  name: string;                   
  exchange: string;              
  total_valid_days?: number;     
  avg_daily_high_low?: number;
  median_daily_volume?: number;
  avg_trading_ratio?: number;
  N1_Pattern_count?: number;
  avg_daily_high_low_range?: number;
  avg_daily_volume?: number;
  avg_trading_capital?: number;
  instrument_token?: string;
  tradingsymbol?: string;
}

export function useWatchlist() {
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);

  useEffect(() => {
    async function fetchWatchlist() {
      setLoading(true);
      setError(null);

      try {
        const today = '2025-06-03'; 
        
        const apiUrl = `/api/watchlist/${selectedWatchlist}?date=${today}`;
        
        console.log('Fetching watchlist data from:', apiUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); 

        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Watchlist data received:', data);

        const validCompanies = (data.companies || []).filter((company: Company) => 
          company.company_code && 
          company.name && 
          company.exchange
        );

        setCompanies(validCompanies);
        setExists(data.exists);
        
        const exchanges = [...new Set(validCompanies.map((c: Company) => c.exchange))];
        setAvailableExchanges(exchanges);
        
        console.log(`Loaded ${validCompanies.length} companies from watchlist ${selectedWatchlist}`);
        
      } catch (err) {
        console.error('Error fetching watchlist data:', err);
        setError('Failed to fetch watchlist data');
        setCompanies([]);
        setExists(false);
        setAvailableExchanges([]);
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
    availableExchanges
  };
}
