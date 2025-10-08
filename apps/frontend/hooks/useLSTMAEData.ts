// hooks/useLSTMAEData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { lstmaeService } from '.././app/services/lstmaeService';
import type {
  LSTMAEDashboardResponse,
  LSTMAEServiceHealth,
  LSTMAEError,
  LSTMAELoadingState,
  ClusteringMethod,
} from '.././app/types/lstmae.types';

interface UseLSTMAEDataReturn {
  dashboard: LSTMAEDashboardResponse | null;
  health: LSTMAEServiceHealth | null;
  loading: LSTMAELoadingState;
  error: LSTMAEError | null;
  refresh: () => Promise<void>;
  checkHealth: () => Promise<void>;
}

/**
 * Custom hook for managing LSTMAE Pipeline 2 data
 * Handles data fetching, caching, and error states
 */
export const useLSTMAEData = (
  symbol: string,
  method: ClusteringMethod = 'spectral',
  autoFetch = true
): UseLSTMAEDataReturn => {
  const [dashboard, setDashboard] = useState<LSTMAEDashboardResponse | null>(null);
  const [health, setHealth] = useState<LSTMAEServiceHealth | null>(null);
  const [loading, setLoading] = useState<LSTMAELoadingState>('idle');
  const [error, setError] = useState<LSTMAEError | null>(null);

  /**
   * Fetch dashboard data
   */
  const fetchDashboard = useCallback(
    async (forceRefresh = false) => {
      if (!symbol) return;

      setLoading('loading');
      setError(null);

      try {
        const data = await lstmaeService.generateDashboard(symbol, method, forceRefresh);
        setDashboard(data);
        setLoading(forceRefresh ? 'success' : 'cached');
      } catch (err: any) {
        const errorObj: LSTMAEError = {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Failed to load dashboard',
          suggestion: err.suggestion,
          timestamp: new Date().toISOString(),
        };
        setError(errorObj);
        setLoading('error');
      }
    },
    [symbol, method]
  );

  /**
   * Check service health
   */
  const checkHealth = useCallback(async () => {
    try {
      const healthStatus = await lstmaeService.checkHealth();
      setHealth(healthStatus);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  }, []);

  /**
   * Refresh dashboard (force regeneration)
   */
  const refresh = useCallback(async () => {
    await fetchDashboard(true);
  }, [fetchDashboard]);

  /**
   * Auto-fetch on mount and symbol change
   */
  useEffect(() => {
    if (autoFetch && symbol) {
      fetchDashboard(false);
      checkHealth();
    }
  }, [symbol, method, autoFetch, fetchDashboard, checkHealth]);

  return {
    dashboard,
    health,
    loading,
    error,
    refresh,
    checkHealth,
  };
};
