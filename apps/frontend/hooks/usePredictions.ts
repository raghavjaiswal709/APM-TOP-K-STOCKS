import { useState, useCallback, useEffect, useRef } from 'react';

export interface PredictionData {
  timestamp: string;
  close: number;
  predictedat: string;
}

export interface CompanyPredictions {
  company: string;
  predictions: Record<string, PredictionData>;
  count: number;
  starttime?: string;
  endtime?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'stopped';
  running: boolean;
  lastupdate: string;
  activecompanies: string[];
  totalcompanies: number;
  companystatus: Record<string, {
    totalpredictions: number;
    latestprediction: string;
  }>;
}

export interface UsePredictionsOptions {
  company: string;
  enabled?: boolean;
  cacheTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

class PredictionCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private timeout: number;

  constructor(timeout: number = CACHE_TIMEOUT) {
    this.timeout = timeout;
  }

  set(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  isStale(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return true;
    return Date.now() - cached.timestamp > this.timeout;
  }
}

export const predictionCache = new PredictionCache();

export const usePredictions = (options: UsePredictionsOptions) => {
  const {
    company,
    enabled = true,
    cacheTimeout = CACHE_TIMEOUT,
    retryAttempts = RETRY_ATTEMPTS,
    retryDelay = RETRY_DELAY,
  } = options;

  const [predictions, setPredictions] = useState<CompanyPredictions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dataAge, setDataAge] = useState<number>(0);
  const [retrying, setRetrying] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0); // ✅ CRITICAL: Force re-render trigger

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateDataAge = useCallback(() => {
    if (!lastUpdated) return 0;
    return Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
  }, [lastUpdated]);

  const fetchPredictions = useCallback(
    async (attempt = 0, bypassCache = false): Promise<CompanyPredictions | null> => {
      if (!enabled || !company) return null;

      const cacheKey = `predictions_${company}`;
      
      // Only use cache if not bypassing and this is the first attempt
      if (!bypassCache && attempt === 0) {
        const cached = predictionCache.get(cacheKey);
        if (cached) {
          console.log(`📦 Using cached predictions for ${company}`);
          setPredictions(cached);
          setLastUpdated(new Date());
          setError(null);
          return cached;
        }
      }

      try {
        setLoading(true);
        setRetrying(attempt > 0);

        abortControllerRef.current = new AbortController();
        const baseUrl = process.env.NEXT_PUBLIC_PREDICTION_API || 'http://localhost:5112';
        
        // Add timestamp to prevent browser caching
        const timestamp = Date.now();
        const url = `${baseUrl}/predictions/${company}?t=${timestamp}`;

        console.log(`🌐 Fetching fresh predictions for ${company}... (attempt ${attempt + 1})`);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`No predictions available for ${company}`);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: CompanyPredictions = await response.json();

        console.log(`✅ Fetched ${data.count} predictions for ${company}`);
        
        // Always update cache with fresh data
        predictionCache.set(cacheKey, data);
        
        // ✅ CRITICAL: Create new object to force React re-render even if content is identical
        setPredictions({ ...data, _updateId: Date.now() } as any);
        setLastUpdated(new Date());
        setError(null);
        retryCountRef.current = 0;
        setRetrying(false);
        setUpdateTrigger(prev => prev + 1); // ✅ Force re-render

        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        if (
          attempt < retryAttempts &&
          !(err instanceof Error && err.message.includes('No predictions available'))
        ) {
          console.warn(`⚠️ Retry attempt ${attempt + 1}/${retryAttempts} for ${company}`);
          setRetrying(true);
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
          return fetchPredictions(attempt + 1, bypassCache);
        }

        console.error(`❌ Failed to fetch predictions for ${company}:`, errorMessage);
        setError(errorMessage);
        setRetrying(false);

        // Return cached data if available, even if expired
        const expiredCache = predictionCache.get(cacheKey);
        if (expiredCache) {
          console.log(`📦 Using expired cache for ${company} due to error`);
          setPredictions(expiredCache);
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [enabled, company, retryAttempts, retryDelay]
  );

  const refetch = useCallback(async () => {
    // ALWAYS bypass cache when explicitly refetching
    console.log(`🔄 Force refetch for ${company} (bypassing cache)`);
    setUpdateTrigger(prev => prev + 1); // ✅ Force re-render
    return await fetchPredictions(0, true);
  }, [fetchPredictions, company]);

  const clearCache = useCallback(() => {
    predictionCache.clear();
    setPredictions(null);
    setError(null);
    setLastUpdated(null);
  }, []);

  // Update data age every second
  useEffect(() => {
    const timer = setInterval(() => {
      setDataAge(calculateDataAge());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateDataAge]);

  // Initial fetch on mount or when company changes
  useEffect(() => {
    if (enabled && company) {
      console.log(`🔄 Initial fetch triggered for ${company}`);
      // Use cache for initial load to avoid delay
      fetchPredictions(0, false);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, company, fetchPredictions]);

  return {
    predictions,
    loading,
    error,
    lastUpdated,
    dataAge,
    retrying,
    refetch,
    clearCache,
    updateTrigger, // ✅ CRITICAL: Export trigger for parent components
    isStale: !lastUpdated || dataAge > 600, // 10 minutes
  };
};

export const useHealth = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_PREDICTION_API || 'http://localhost:5112';
      const response = await fetch(`${baseUrl}/health`);

      if (!response.ok) throw new Error('Health check failed');

      const data: HealthStatus = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [checkHealth]);

  return { health, loading, error };
};
