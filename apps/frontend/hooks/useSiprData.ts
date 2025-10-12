// apps/frontend/hooks/useSiprData.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { siprService } from '../app/services/siprService';
import { siprConfig } from '../app/config/sipr.config';
import type {
  SiprTop3Response,
  SiprPatternReport,
  SiprServiceHealth,
  SiprError,
  SiprLoadingState,
} from '../app/types/sipr.types';

interface UseSiprDataReturn {
  top3Patterns: SiprTop3Response | null;
  patternReport: SiprPatternReport | null;
  health: SiprServiceHealth | null;
  loading: SiprLoadingState;
  error: SiprError | null;
  refresh: () => Promise<void>;
  checkHealth: () => Promise<void>;
}

export const useSiprData = (
  companyCode: string,
  months: number = siprConfig.defaultMonths,
  autoFetch = true
): UseSiprDataReturn => {
  const [top3Patterns, setTop3Patterns] = useState<SiprTop3Response | null>(null);
  const [patternReport, setPatternReport] = useState<SiprPatternReport | null>(null);
  const [health, setHealth] = useState<SiprServiceHealth | null>(null);
  const [loading, setLoading] = useState<SiprLoadingState>('idle');
  const [error, setError] = useState<SiprError | null>(null);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      if (!companyCode) return;

      setLoading('loading');
      setError(null);

      try {
        if (forceRefresh) {
          siprService.clearCompanyCache(companyCode);
        }

        const [top3Data, reportData] = await Promise.all([
          siprService.getTop3Patterns(companyCode, months),
          siprService.getPatternReport(companyCode, months),
        ]);

        setTop3Patterns(top3Data);
        setPatternReport(reportData);
        setLoading('success');
      } catch (err: any) {
        const errorObj: SiprError = {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Failed to load pattern data',
          suggestion: err.suggestion,
          timestamp: new Date().toISOString(),
        };
        setError(errorObj);
        setLoading('error');
      }
    },
    [companyCode, months]
  );

  const checkHealthStatus = useCallback(async () => {
    try {
      const healthStatus = await siprService.checkHealth();
      setHealth(healthStatus);
    } catch (err) {
      console.error('SIPR health check failed:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    if (autoFetch && companyCode) {
      fetchData(false);
      checkHealthStatus();
    }
  }, [companyCode, months, autoFetch, fetchData, checkHealthStatus]);

  return {
    top3Patterns,
    patternReport,
    health,
    loading,
    error,
    refresh,
    checkHealth: checkHealthStatus,
  };
};
