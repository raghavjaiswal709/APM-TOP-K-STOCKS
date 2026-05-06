import { useState, useEffect, useCallback, useRef } from 'react';
import { usePersistentState } from './useStateRestoration';

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  // REMOVED: refined not in watchlist_quant
  // refined?: boolean;
  marker?: string;
  // NEW fields from watchlist_quant
  rank?: number;
  last_close?: number;
  median_daily_tv_10d?: number;
  atr_pct_10d?: number;
  iv_10d?: number;
  vol_rank_xs?: number;
  dist_from_high_20d?: number;
  vol_ratio_t1_vs_10d?: number;
  median_tradable_ratio_10d?: number;
  min_tradable_ratio_10d?: number;
  median_p25_window_tv_10d?: number;
  max_position_inr?: number;
  days_capital_data?: number;
  pe_ratio?: number;
  // OLD fields (commented out - no longer in watchlist_quant)
  // total_valid_days?: number;
  // avg_daily_high_low_range?: number;
  // median_daily_volume?: number;
  // avg_trading_capital?: number;
  // latest_close_price?: number;
  // suggested_capital_deployment?: number;
  // hourly_median_volume?: number;
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
  // REMOVED: refined filter — watchlist_quant has no refined column
  // refinedFilter?: boolean | null;
}

export function useWatchlist(options: UseWatchlistOptions = {}) {
  const BASE_URL = '';
  const hasLoadedRef = useRef(false);
  
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = usePersistentState<string[]>(
    'watchlist-availableDates',
    []
  );
  const [companies, setCompanies] = usePersistentState<MergedCompany[]>(
    'watchlist-companies',
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [availableExchanges, setAvailableExchanges] = usePersistentState<string[]>(
    'watchlist-availableExchanges',
    []
  );
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [availableMarkers, setAvailableMarkers] = usePersistentState<string[]>(
    'watchlist-availableMarkers',
    []
  );
  const [showAllCompanies, setShowAllCompanies] = useState(options.showAllCompanies || false);
  // REMOVED: refinedFilter — watchlist_quant has no refined column
  // const [refinedFilter, setRefinedFilter] = useState<boolean | null>(options.refinedFilter !== undefined ? options.refinedFilter : null);
  
  const activeDate = options.date || selectedDate;
  
  // Sync showAllCompanies from options when prop changes
  useEffect(() => {
    if (options.showAllCompanies !== undefined) {
      setShowAllCompanies(options.showAllCompanies);
    }
  }, [options.showAllCompanies]);

  // Fetch available dates on mount
  useEffect(() => {
    // Skip if we already have cached dates
    if (availableDates.length > 0 && hasLoadedRef.current) {
      console.log('⚡ [useWatchlist] Using cached dates');
      return;
    }
    
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
          hasLoadedRef.current = true;
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
          console.log(`[useWatchlist] Fetching watchlist for date: ${dateParam}`);

          // Build URL — refined param removed (not in watchlist_quant)
          apiUrl = `${BASE_URL}/api/watchlist?date=${dateParam}`;
          // OLD: refined param removed
          // if (refinedFilter !== null && refinedFilter !== undefined) {
          //   apiUrl += `&refined=${refinedFilter}`;
          // }
        }
        
        console.log(`[useWatchlist] Fetching from: ${apiUrl}`);

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

        console.log('[useWatchlist] ✅ API Response received:', {
          companiesCount: data.companies?.length || 0,
          total: data.total,
          exists: data.exists,
          // OLD: refined filter removed
          // refinedFilterApplied: refinedFilter
        });

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

        // OLD: refined count debug removed — no refined field in watchlist_quant
        // const refinedCount = validCompanies.filter((c: MergedCompany) => c.refined === true).length;
        // const nonRefinedCount = validCompanies.filter((c: MergedCompany) => c.refined === false || !c.refined).length;
        // console.log('[useWatchlist] 📊 Companies breakdown:', {
        //   total: validCompanies.length,
        //   refined: refinedCount,
        //   nonRefined: nonRefinedCount,
        //   filterActive: refinedFilter !== null ? (refinedFilter ? 'refined-only' : 'non-refined-only') : 'all'
        // });

        setCompanies(validCompanies);
        setExists(showAllCompanies ? true : (data.exists !== false));
        setTotalCompanies(data.total || validCompanies.length);
        
        const exchanges = [...new Set(validCompanies.map((c: MergedCompany) => c.exchange).filter(Boolean))] as string[];
        const markers = [...new Set(validCompanies.map((c: MergedCompany) => c.marker).filter(Boolean))] as string[];
        setAvailableExchanges(exchanges);
        setAvailableMarkers(markers);

        console.log(`[useWatchlist] ✅ Loaded ${validCompanies.length} companies`);

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
  }, [activeDate, BASE_URL, showAllCompanies, availableDates.length]);

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
    // REMOVED: refined filter — watchlist_quant has no refined column
    // refinedFilter,
    // setRefinedFilter
  };
}
