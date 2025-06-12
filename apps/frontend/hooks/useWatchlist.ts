import { useState, useEffect, useRef, useCallback } from 'react';

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  pe_ratio?: number;
  N1_Pattern_count?: number;
}

interface WatchlistResponse {
  companies: MergedCompany[];
  exists: boolean;
  total: number;
}

interface UseWatchlistOptions {
  externalWatchlist?: string;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');
  const [companies, setCompanies] = useState<MergedCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [availableMarkers, setAvailableMarkers] = useState<string[]>([]);

  const prevExternalWatchlist = useRef(options.externalWatchlist);
  
  const activeWatchlist = options.externalWatchlist || selectedWatchlist;

  useEffect(() => {
    if (options.externalWatchlist && 
        options.externalWatchlist !== prevExternalWatchlist.current && 
        options.externalWatchlist !== selectedWatchlist) {
      console.log(`[useWatchlist] External watchlist changed from ${prevExternalWatchlist.current} to ${options.externalWatchlist}`);
      prevExternalWatchlist.current = options.externalWatchlist;
      setSelectedWatchlist(options.externalWatchlist);
    }
  }, [options.externalWatchlist, selectedWatchlist]);

  useEffect(() => {
    let isCancelled = false;
    
    async function fetchWatchlist() {
      console.log(`[useWatchlist] Starting to fetch watchlist: ${activeWatchlist}`);
      setLoading(true);
      setError(null);

      try {
        const today = "2025-06-05";
        const apiUrl = `http://localhost:5000/api/watchlist/${activeWatchlist}?date=${today}`;
        
        console.log(`[useWatchlist] Fetching from: ${apiUrl}`);

        try {
          const healthCheck = await fetch('http://localhost:5000/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
          });
          console.log(`[useWatchlist] Backend health check: ${healthCheck.status}`);
        } catch (healthError) {
          console.error(`[useWatchlist] Backend health check failed:`, healthError);
          throw new Error('Backend server is not running on localhost:3001. Please start the backend server.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(apiUrl, { 
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          mode: 'cors'
        });
        
        clearTimeout(timeoutId);

        console.log(`[useWatchlist] Response status: ${response.status}`);
        console.log(`[useWatchlist] Response headers:`, Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[useWatchlist] Error response body:`, errorText);
          
          if (response.status === 404) {
            throw new Error(`Watchlist ${activeWatchlist} not found for date ${today}. Check if the endpoint exists.`);
          } else if (response.status === 500) {
            throw new Error(`Server error (${response.status}): ${errorText || 'Internal server error'}`);
          } else {
            throw new Error(`HTTP error ${response.status}: ${errorText || response.statusText}`);
          }
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text();
          console.error(`[useWatchlist] Non-JSON response:`, responseText);
          throw new Error('Server returned non-JSON response. Check API endpoint.');
        }

        const data: WatchlistResponse = await response.json();
        
        if (isCancelled) return;
        
        console.log(`[useWatchlist] Raw API response for watchlist ${activeWatchlist}:`, data);

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response format from server');
        }

        if (!Array.isArray(data.companies)) {
          console.warn(`[useWatchlist] No companies array in response:`, data);
          setCompanies([]);
          setExists(false);
          setTotalCompanies(0);
          setAvailableExchanges([]);
          setAvailableMarkers([]);
          setError(`No companies found for watchlist ${activeWatchlist} on ${today}`);
          return;
        }

        const validCompanies = data.companies.filter((company: MergedCompany) => {
          const isValid = company.company_code && 
                          company.name && 
                          company.exchange &&
                          company.marker;
          
          if (!isValid) {
            console.warn(`[useWatchlist] Invalid company filtered out:`, company);
          }
          return isValid;
        });

        console.log(`[useWatchlist] Valid companies after filtering for ${activeWatchlist}: ${validCompanies.length} out of ${data.companies.length}`);

        setCompanies(validCompanies);
        setExists(data.exists !== false); // Default to true if not specified
        setTotalCompanies(data.total || validCompanies.length);
        
        const exchanges = [...new Set(validCompanies.map((c: MergedCompany) => c.exchange))];
        const markers = [...new Set(validCompanies.map((c: MergedCompany) => c.marker))];
        
        setAvailableExchanges(exchanges);
        setAvailableMarkers(markers);
        
        console.log(`[useWatchlist] Successfully loaded ${validCompanies.length} companies from watchlist ${activeWatchlist}`);
        console.log(`[useWatchlist] Available exchanges: ${exchanges.join(', ')}`);
        
      } catch (err: any) {
        if (isCancelled) return;
        
        console.error(`[useWatchlist] Error fetching watchlist ${activeWatchlist}:`, err);
        console.error(`[useWatchlist] Error details:`, {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
        
        let errorMessage = 'Failed to fetch watchlist data.';
        
        if (err.name === 'AbortError') {
          errorMessage = 'Request timed out. Please try again.';
        } else if (err.message.includes('Backend server is not running')) {
          errorMessage = err.message;
        } else if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
          errorMessage = 'Cannot connect to backend server. Please ensure:\n1. Backend is running on http://localhost:3001\n2. No firewall blocking the connection\n3. CORS is properly configured';
        } else if (err.message.includes('not found')) {
          errorMessage = err.message;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
        
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

    fetchWatchlist();
    
    return () => {
      isCancelled = true;
    };
  }, [activeWatchlist]);

  const getCompanyByCode = useCallback(async (companyCode: string, exchange?: string): Promise<MergedCompany | null> => {
    try {
      const queryParams = new URLSearchParams({ companyCode });
      if (exchange) {
        queryParams.append('exchange', exchange);
      }
      
      const response = await fetch(`http://localhost:5000/api/watchlist/company/${companyCode}?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.company;
    } catch (error) {
      console.error('[useWatchlist] Error fetching company by code:', error);
      return null;
    }
  }, []);

  const getFilteredCompanies = useCallback((filters: {
    exchange?: string;
    marker?: string;
    minValidDays?: number;
  }) => {
    return companies.filter(company => {
      if (filters.exchange && company.exchange.toUpperCase() !== filters.exchange.toUpperCase()) {
        return false;
      }
      if (filters.marker && company.marker.toUpperCase() !== filters.marker.toUpperCase()) {
        return false;
      }
      if (filters.minValidDays && (!company.total_valid_days || company.total_valid_days < filters.minValidDays)) {
        return false;
      }
      return true;
    });
  }, [companies]);

  return { 
    selectedWatchlist: activeWatchlist, 
    setSelectedWatchlist, 
    companies, 
    loading, 
    error, 
    exists,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    getCompanyByCode,
    getFilteredCompanies
  };
}
