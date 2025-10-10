// hooks/useLSTMAEData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { lstmaeService } from '../app/services/lstmaeService';
import { lstmaeConfig } from '../app/config/lstmae.config';
import type {
  LSTMAEDashboardResponse,
  LSTMAEServiceHealth,
  LSTMAEError,
  LSTMAELoadingState,
  ClusteringMethod,
  PlotUrls,
} from '../app//types/lstmae.types';

interface UseLSTMAEDataReturn {
  dashboard: LSTMAEDashboardResponse | null;
  plotUrls: PlotUrls | null;
  health: LSTMAEServiceHealth | null;
  loading: LSTMAELoadingState;
  error: LSTMAEError | null;
  refresh: () => Promise<void>;
  checkHealth: () => Promise<void>;
}

export const useLSTMAEData = (
  symbol: string,
  method: ClusteringMethod = 'spectral',
  autoFetch = true,
  useEndpointMethod = lstmaeConfig.useEndpointMethod
): UseLSTMAEDataReturn => {
  const [dashboard, setDashboard] = useState<LSTMAEDashboardResponse | null>(null);
  const [plotUrls, setPlotUrls] = useState<PlotUrls | null>(null);
  const [health, setHealth] = useState<LSTMAEServiceHealth | null>(null);
  const [loading, setLoading] = useState<LSTMAELoadingState>('idle');
  const [error, setError] = useState<LSTMAEError | null>(null);

  const fetchDashboard = useCallback(
    async (forceRefresh = false) => {
      if (!symbol) return;

      setLoading('loading');
      setError(null);

      try {
        if (useEndpointMethod) {
          const plots = await lstmaeService.getAllPlotsViaEndpoint(symbol, method);
          setPlotUrls(plots);
          
          const dashboardData = await lstmaeService.generateDashboard(symbol, method, forceRefresh);
          setDashboard(dashboardData);
        } else {
          const data = await lstmaeService.generateDashboard(symbol, method, forceRefresh);
          setDashboard(data);
          setPlotUrls(null);
        }
        
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
    [symbol, method, useEndpointMethod]
  );

  const checkHealthStatus = useCallback(async () => {
    try {
      const healthStatus = await lstmaeService.checkHealth();
      setHealth(healthStatus);
    } catch (err) {
      console.error('Health check failed:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchDashboard(true);
  }, [fetchDashboard]);

  useEffect(() => {
    if (autoFetch && symbol) {
      fetchDashboard(false);
      checkHealthStatus();
    }
  }, [symbol, method, autoFetch, fetchDashboard, checkHealthStatus]);

  return {
    dashboard,
    plotUrls,
    health,
    loading,
    error,
    refresh,
    checkHealth: checkHealthStatus,
  };
};
