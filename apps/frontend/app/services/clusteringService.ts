// ============================================================================
// UMAP Clustering V2 Service
// Connects to: http://100.93.172.21:6968/api/v2/clustering/*
// Proxied via Next.js rewrite: /api/v2/clustering/*
// ============================================================================

import type {
  ClusteringHealthResponse,
  ClusteringSymbolsResponse,
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
} from '@/types/clustering';

const BASE_PATH = '/api/v2/clustering';

/** Encode a symbol for safe use in a URL path segment (handles GVT&D, NSE:X-EQ, etc.) */
const encSym = (symbol: string) => symbol.split('/').map(encodeURIComponent).join('/');

class ClusteringV2Error extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ClusteringV2Error';
    this.status = status;
  }
}

/**
 * Resilient JSON fetch.
 *
 * The clustering V2 backend can transiently return 5xx during model reloads.
 * To stop those transient failures from spilling `ClusteringV2Error: Internal
 * Server Error` into the dev-tools console / Next.js error overlay we:
 *  - retry 5xx and network errors with exponential backoff (3 attempts);
 *  - leave 4xx alone (they indicate a real client-side issue we want to see);
 *  - leave AbortError untouched so cancellation still bubbles.
 */
async function fetchJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = await res.json();
          detail = body.detail || detail;
        } catch {}
        const err = new ClusteringV2Error(detail, res.status);
        // Retry only on 5xx / 429 — 4xx is a real bug we want to surface.
        if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 250 * 2 ** (attempt - 1)));
          lastErr = err;
          continue;
        }
        throw err;
      }
      return res.json();
    } catch (e) {
      // Don't retry on caller-initiated abort.
      if ((e as any)?.name === 'AbortError') throw e;
      lastErr = e;
      if (attempt >= MAX_ATTEMPTS) throw e;
      // Network errors: short backoff
      if (!(e instanceof ClusteringV2Error)) {
        await new Promise(r => setTimeout(r, 250 * 2 ** (attempt - 1)));
      }
    }
  }
  // Defensive — the loop always either returns or throws above.
  throw lastErr ?? new ClusteringV2Error('clustering fetch failed', 500);
}

// ── Simple in-memory cache ───────────────────────────────────────────────────
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  cache.delete(key);
  return null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

// ── Exported Service ─────────────────────────────────────────────────────────
export const clusteringV2Service = {
  /** Health check – verifies API connectivity */
  async health(signal?: AbortSignal): Promise<ClusteringHealthResponse> {
    return fetchJSON('/api/v2/health', signal);
  },

  /** List all symbols with clustering data */
  async getSymbols(signal?: AbortSignal): Promise<ClusteringSymbolsResponse> {
    const key = 'symbols';
    const hit = getCached<ClusteringSymbolsResponse>(key);
    if (hit) return hit;
    const data = await fetchJSON<ClusteringSymbolsResponse>(`${BASE_PATH}/symbols`, signal);
    setCache(key, data);
    return data;
  },

  /** Full analysis (RECOMMENDED START) – single call gives everything */
  async getAnalysis(
    symbol: string,
    window = 7,
    signal?: AbortSignal
  ): Promise<ClusteringAnalysisResponse> {
    const key = `analysis_${symbol}_${window}`;
    const hit = getCached<ClusteringAnalysisResponse>(key);
    if (hit) return hit;
    const data = await fetchJSON<ClusteringAnalysisResponse>(
      `${BASE_PATH}/${encSym(symbol)}/analysis?window=${window}`,
      signal
    );
    setCache(key, data);
    return data;
  },

  /** Confidence timeseries (60 days) */
  async getConfidence(
    symbol: string,
    window = 7,
    signal?: AbortSignal
  ): Promise<ClusteringConfidenceResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/confidence?window=${window}`, signal);
  },

  /** Noise metrics + 30-day density timeseries */
  async getNoise(
    symbol: string,
    rollingWindow = 7,
    signal?: AbortSignal
  ): Promise<ClusteringNoiseResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/noise?rolling_window=${rollingWindow}`, signal);
  },

  /** Active clusters in the given window */
  async getActiveClusters(
    symbol: string,
    window = 7,
    signal?: AbortSignal
  ): Promise<ActiveClustersResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/active-clusters?window=${window}`, signal);
  },

  /** Core vs noise day counts per pattern */
  async getPatternNoiseDistribution(
    symbol: string,
    signal?: AbortSignal
  ): Promise<PatternNoiseDistributionResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/pattern-noise-distribution`, signal);
  },

  /** Return, volatility, win rate, RAR per pattern */
  async getPatternRiskReturn(
    symbol: string,
    signal?: AbortSignal
  ): Promise<PatternRiskReturnResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/pattern-risk-return`, signal);
  },

  /** Volatility and trend regime breakdown per pattern */
  async getPatternRegimeDistribution(
    symbol: string,
    signal?: AbortSignal
  ): Promise<PatternRegimeDistributionResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/pattern-regime-distribution`, signal);
  },

  /** Quality metrics + per-cluster confidence */
  async getPatternConfidence(
    symbol: string,
    signal?: AbortSignal
  ): Promise<PatternConfidenceResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/pattern-confidence`, signal);
  },

  /** Intraday price shapes with median, p25/p75 bands */
  async getIntradayShapes(
    symbol: string,
    maxDaysPerPattern = 30,
    signal?: AbortSignal
  ): Promise<IntradayShapesResponse> {
    return fetchJSON(
      `${BASE_PATH}/${encSym(symbol)}/intraday-shapes?max_days_per_pattern=${maxDaysPerPattern}`,
      signal
    );
  },

  /** Full pattern profiles for all patterns */
  async getPatternProfiles(
    symbol: string,
    signal?: AbortSignal
  ): Promise<PatternProfilesResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/pattern-profiles`, signal);
  },

  /** Raw lineage registry: canonical clusters, retired clusters, events */
  async getLineageRegistry(
    symbol: string,
    signal?: AbortSignal
  ): Promise<LineageRegistryResponse> {
    return fetchJSON(`${BASE_PATH}/${encSym(symbol)}/lineage-registry`, signal);
  },

  /** Clear the in-memory cache */
  clearCache() {
    cache.clear();
  },
};

export default clusteringV2Service;
