import { useState, useEffect, useCallback } from 'react';

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  marker?: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  latest_close_price?: number;
  pe_ratio?: number;
  suggested_capital_deployment?: number;
  hourly_median_volume?: number;
}

interface WatchlistResponse {
  companies: MergedCompany[];
  exists: boolean;
  total: number;
  date: string;
}

interface UseWatchlistOptions {
  date?: string;
  showAllCompanies?: boolean;
  refinedFilter?: boolean | null;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [companies, setCompanies] = useState<MergedCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [availableExchanges, setAvailableExchanges] = useState<string[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [availableMarkers, setAvailableMarkers] = useState<string[]>([]);
  const [showAllCompanies, setShowAllCompanies] = useState(options.showAllCompanies || false);
  const [refinedFilter, setRefinedFilter] = useState<boolean | null>(options.refinedFilter !== undefined ? options.refinedFilter : null);
  
  const activeDate = options.date || selectedDate;

  // Fetch available dates on mount
  useEffect(() => {
    async function fetchAvailableDates() {
      try {
        const response = await fetch(`${BASE_URL}/api/watchlist/dates`);
        if (response.ok) {
          const data = await response.json();
          setAvailableDates(data.dates || []);
          
          // Auto-select most recent date if none selected
          if (!selectedDate && data.dates && data.dates.length > 0) {
            setSelectedDate(data.dates[0]);
          }
        }
      } catch (error) {
        console.error('[useWatchlist] Error fetching available dates:', error);
      }
    }

    fetchAvailableDates();
  }, [BASE_URL]);

  // Main data fetching effect
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
          // Fetch date-specific companies
          const dateParam = activeDate || new Date().toISOString().split('T')[0];
          console.log(`[useWatchlist] ===== FETCHING WATCHLIST =====`);
          console.log(`[useWatchlist] Date: ${dateParam}`);
          console.log(`[useWatchlist] Refined Filter: ${refinedFilter}`);
          console.log(`[useWatchlist] ShowAllCompanies: ${showAllCompanies}`);
          
          // Build URL with refined parameter
          apiUrl = `${BASE_URL}/api/watchlist?date=${dateParam}`;
          if (refinedFilter !== null && refinedFilter !== undefined) {
            apiUrl += `&refined=${refinedFilter}`;
            console.log(`[useWatchlist] Added refined parameter to URL: ${refinedFilter}`);
          } else {
            console.log(`[useWatchlist] No refined filter applied (showing all companies for date)`);
          }
        }
        
        console.log(`[useWatchlist] Final API URL: ${apiUrl}`);

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

        setCompanies(validCompanies);
        setExists(showAllCompanies ? true : (data.exists !== false));
        setTotalCompanies(data.total || validCompanies.length);
        
        const exchanges = [...new Set(validCompanies.map((c: MergedCompany) => c.exchange).filter(Boolean))] as string[];
        const markers = [...new Set(validCompanies.map((c: MergedCompany) => c.marker).filter(Boolean))] as string[];
        setAvailableExchanges(exchanges);
        setAvailableMarkers(markers);

        console.log(`[useWatchlist] Loaded ${validCompanies.length} companies`);

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

    if (showAllCompanies || activeDate || availableDates.length > 0) {
      fetchWatchlist();
    }
    
    return () => {
      isCancelled = true;
    };
  }, [activeDate, BASE_URL, showAllCompanies, availableDates.length, refinedFilter]);

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
    refinedFilter,
    setRefinedFilter
  };
}
