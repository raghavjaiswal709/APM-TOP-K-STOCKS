// ============================================================================
// useClusteringV2 — Hooks for UMAP Clustering V2 API
// ============================================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { clusteringV2Service } from '@/app/services/clusteringService';
import type {
  ClusteringAnalysisResponse,
  ClusteringConfidenceResponse,
  ClusteringNoiseResponse,
  ActiveClustersResponse,
  PatternNoiseDistributionResponse,
  PatternRiskReturnResponse,
  PatternRegimeDistributionResponse,
  PatternConfidenceResponse,
  IntradayShapesResponse,
  PatternProfilesResponse,
  LineageRegistryResponse,
  ClusteringSymbolsResponse,
} from '@/types/clustering';

// ─── Generic async-data hook ─────────────────────────────────────────────────
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: any[],
  enabled = true
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(() => {
    if (!enabled) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetcher(ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ data: null, loading: false, error: err.message || 'Unknown error' });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    doFetch();
    return () => abortRef.current?.abort();
  }, [doFetch]);

  return { ...state, refetch: doFetch };
}

// ─── Symbols ─────────────────────────────────────────────────────────────────
export function useClusteringSymbols(enabled = true) {
  return useAsyncData<ClusteringSymbolsResponse>(
    (signal) => clusteringV2Service.getSymbols(signal),
    [],
    enabled
  );
}

// ─── Full Analysis (single call dashboard) ───────────────────────────────────
export function useClusteringAnalysis(symbol: string, window = 7, enabled = true) {
  return useAsyncData<ClusteringAnalysisResponse>(
    (signal) => clusteringV2Service.getAnalysis(symbol, window, signal),
    [symbol, window],
    enabled && !!symbol
  );
}

// ─── Confidence ──────────────────────────────────────────────────────────────
export function useClusteringConfidence(symbol: string, window = 7, enabled = true) {
  return useAsyncData<ClusteringConfidenceResponse>(
    (signal) => clusteringV2Service.getConfidence(symbol, window, signal),
    [symbol, window],
    enabled && !!symbol
  );
}

// ─── Noise ───────────────────────────────────────────────────────────────────
export function useClusteringNoise(symbol: string, rollingWindow = 7, enabled = true) {
  return useAsyncData<ClusteringNoiseResponse>(
    (signal) => clusteringV2Service.getNoise(symbol, rollingWindow, signal),
    [symbol, rollingWindow],
    enabled && !!symbol
  );
}

// ─── Active Clusters ─────────────────────────────────────────────────────────
export function useActiveClusters(symbol: string, window = 7, enabled = true) {
  return useAsyncData<ActiveClustersResponse>(
    (signal) => clusteringV2Service.getActiveClusters(symbol, window, signal),
    [symbol, window],
    enabled && !!symbol
  );
}

// ─── Pattern Noise Distribution ──────────────────────────────────────────────
export function usePatternNoiseDistribution(symbol: string, enabled = true) {
  return useAsyncData<PatternNoiseDistributionResponse>(
    (signal) => clusteringV2Service.getPatternNoiseDistribution(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Pattern Risk Return ─────────────────────────────────────────────────────
export function usePatternRiskReturn(symbol: string, enabled = true) {
  return useAsyncData<PatternRiskReturnResponse>(
    (signal) => clusteringV2Service.getPatternRiskReturn(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Pattern Regime Distribution ─────────────────────────────────────────────
export function usePatternRegimeDistribution(symbol: string, enabled = true) {
  return useAsyncData<PatternRegimeDistributionResponse>(
    (signal) => clusteringV2Service.getPatternRegimeDistribution(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Pattern Confidence ──────────────────────────────────────────────────────
export function usePatternConfidence(symbol: string, enabled = true) {
  return useAsyncData<PatternConfidenceResponse>(
    (signal) => clusteringV2Service.getPatternConfidence(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Intraday Shapes ─────────────────────────────────────────────────────────
export function useIntradayShapes(symbol: string, maxDays = 30, enabled = true) {
  return useAsyncData<IntradayShapesResponse>(
    (signal) => clusteringV2Service.getIntradayShapes(symbol, maxDays, signal),
    [symbol, maxDays],
    enabled && !!symbol
  );
}

// ─── Pattern Profiles ────────────────────────────────────────────────────────
export function usePatternProfiles(symbol: string, enabled = true) {
  return useAsyncData<PatternProfilesResponse>(
    (signal) => clusteringV2Service.getPatternProfiles(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Lineage Registry ────────────────────────────────────────────────────────
export function useLineageRegistry(symbol: string, enabled = true) {
  return useAsyncData<LineageRegistryResponse>(
    (signal) => clusteringV2Service.getLineageRegistry(symbol, signal),
    [symbol],
    enabled && !!symbol
  );
}

// ─── Combined hook for full dashboard ────────────────────────────────────────
export function useClusteringDashboard(symbol: string, window = 7, enabled = true) {
  const analysis = useClusteringAnalysis(symbol, window, enabled);
  const confidence = useClusteringConfidence(symbol, window, enabled);
  const noise = useClusteringNoise(symbol, window, enabled);
  const riskReturn = usePatternRiskReturn(symbol, enabled);
  const noiseDistribution = usePatternNoiseDistribution(symbol, enabled);
  const regimeDistribution = usePatternRegimeDistribution(symbol, enabled);
  const patternConfidence = usePatternConfidence(symbol, enabled);

  const isLoading = analysis.loading || confidence.loading || noise.loading ||
    riskReturn.loading || noiseDistribution.loading || regimeDistribution.loading ||
    patternConfidence.loading;

  const errors = [
    analysis.error, confidence.error, noise.error,
    riskReturn.error, noiseDistribution.error, regimeDistribution.error,
    patternConfidence.error,
  ].filter(Boolean);

  return {
    analysis,
    confidence,
    noise,
    riskReturn,
    noiseDistribution,
    regimeDistribution,
    patternConfidence,
    isLoading,
    errors,
    refetchAll: () => {
      analysis.refetch();
      confidence.refetch();
      noise.refetch();
      riskReturn.refetch();
      noiseDistribution.refetch();
      regimeDistribution.refetch();
      patternConfidence.refetch();
    },
  };
}
