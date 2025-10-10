// services/lstmaeService.ts
import { lstmaeConfig, getApiUrl, getVisualizationPath, isValidSymbol } from '.././config/lstmae.config';
import { LSTMAE_CONSTANTS } from '.././constants/lstmae.constants';
import type {
  LSTMAEDashboardResponse,
  LSTMAEServiceHealth,
  LSTMAEError,
  ClusteringMethod,
  PlotUrls,
} from '.././types/lstmae.types';

class LSTMAEService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    const age = Date.now() - cached.timestamp;
    const ttl = lstmaeConfig.cacheTTL * 1000;
    return age < ttl;
  }

  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)!.data as T;
    }
    return null;
  }

  private saveToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = lstmaeConfig.retryAttempts
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), lstmaeConfig.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);

      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, LSTMAE_CONSTANTS.PERFORMANCE.RETRY_DELAY));
        return this.fetchWithRetry<T>(url, options, retries - 1);
      }

      throw this.handleError(error);
    }
  }

  private handleError(error: any): LSTMAEError {
    const errorResponse: LSTMAEError = {
      code: LSTMAE_CONSTANTS.ERROR_CODES.NETWORK_ERROR,
      message: 'An error occurred',
      timestamp: new Date().toISOString(),
    };

    if (error.name === 'AbortError') {
      errorResponse.code = LSTMAE_CONSTANTS.ERROR_CODES.TIMEOUT;
      errorResponse.message = 'Request timed out. The service may be under heavy load.';
      errorResponse.suggestion = 'Please try again in a few moments.';
    } else if (error.message.includes('EmbeddingNotFoundError')) {
      errorResponse.code = LSTMAE_CONSTANTS.ERROR_CODES.EMBEDDING_NOT_FOUND;
      errorResponse.message = error.message;
      errorResponse.suggestion = 'Verify the symbol has been processed by Pipeline 1.';
    } else if (error.message.includes('InsufficientDataError')) {
      errorResponse.code = LSTMAE_CONSTANTS.ERROR_CODES.INSUFFICIENT_DATA;
      errorResponse.message = error.message;
      errorResponse.suggestion = `Minimum ${LSTMAE_CONSTANTS.MIN_DAYS_REQUIRED} days of data required.`;
    } else if (error.message.includes('RedisConnectionError')) {
      errorResponse.code = LSTMAE_CONSTANTS.ERROR_CODES.REDIS_CONNECTION_FAILED;
      errorResponse.message = 'Redis connection failed, using fallback cache.';
      errorResponse.suggestion = 'Performance may be degraded. Service continues with in-memory cache.';
    } else {
      errorResponse.message = error.message || 'Unknown error occurred';
      errorResponse.suggestion = 'Check service health or contact support.';
    }

    return errorResponse;
  }

  async checkHealth(): Promise<LSTMAEServiceHealth> {
    const cacheKey = 'health_check';
    const cached = this.getFromCache<LSTMAEServiceHealth>(cacheKey);
    if (cached) return cached;

    try {
      const url = getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.HEALTH);
      const response = await this.fetchWithRetry<LSTMAEServiceHealth>(url);
      this.saveToCache(cacheKey, response);
      return response;
    } catch (error) {
      return {
        service: 'visualization',
        status: 'unhealthy',
        cacheBackend: 'memory',
        redisAvailable: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // services/lstmaeService.ts

async getPlotViaEndpoint(
  symbol: string,
  plotType: 'dominant_patterns' | 'intraday_patterns' | 'cluster_transitions' | 'cluster_timeline' | 'anomalies' | 'seasonality' | 'transitions_alt',
  method: ClusteringMethod = 'spectral'
): Promise<string> {
  const cacheKey = `plot_${symbol}_${plotType}_${method}`;
  
  const cached = this.getFromCache<string>(cacheKey);
  if (cached) return cached;

  try {
    const plotTypeMap: Record<string, string> = {
      'dominant_patterns': 'dominant_patterns',
      'intraday_patterns': 'intraday',
      'cluster_transitions': 'cluster_transitions',
      'cluster_timeline': 'cluster_timeline',
      'anomalies': 'anomalies',
      'seasonality': 'seasonality',
      'transitions_alt': 'transitions_alt',
    };

    const apiPlotType = plotTypeMap[plotType] || plotType;
    const url = `${getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.PLOT(symbol, apiPlotType))}?method=${method}`;
    
    console.log(`Fetching plot ${plotType} for ${symbol}... (timeout: ${lstmaeConfig.timeout}ms)`);
    
    // ✅ USE INCREASED TIMEOUT (2 minutes for slow network)
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(lstmaeConfig.timeout), // 120000ms = 2 minutes
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plot: ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    this.saveToCache(cacheKey, blobUrl);
    
    console.log(`✓ Successfully fetched plot ${plotType} for ${symbol}`);
    return blobUrl;
  } catch (error) {
    console.error(`✗ Error fetching plot ${plotType} for ${symbol}:`, error);
    throw this.handleError(error);
  }
}


  // services/lstmaeService.ts

// services/lstmaeService.ts

// services/lstmaeService.ts

async getAllPlotsViaEndpoint(
  symbol: string,
  method: ClusteringMethod = 'spectral'
): Promise<PlotUrls> {
  // ✅ Use Promise.allSettled to handle missing plots gracefully
  const results = await Promise.allSettled([
    this.getPlotViaEndpoint(symbol, 'dominant_patterns', method),
    this.getPlotViaEndpoint(symbol, 'intraday_patterns', method),
    this.getPlotViaEndpoint(symbol, 'cluster_transitions', method), // Now works!
    this.getPlotViaEndpoint(symbol, 'cluster_timeline', method),
  ]);

  const [dominantPatterns, intraday, clusterTransitions, clusterTimeline] = results.map(
    (result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.warn('⚠️ Plot failed:', result.reason);
        return '';
      }
    }
  );

  return {
    dominantPatterns,
    intraday,
    clusterTransitions, // Should work now with correct API mapping
    clusterTimeline,
    anomalies: '',
    seasonality: '',
    transitionsAlt: '',
  };
}




  async generateDashboard(
  symbol: string,
  method: ClusteringMethod = LSTMAE_CONSTANTS.DEFAULT_CLUSTERING_METHOD,
  forceRefresh = false
): Promise<LSTMAEDashboardResponse> {
  if (!isValidSymbol(symbol)) {
    throw new Error(`Invalid symbol format: ${symbol}`);
  }

  const cacheKey = `dashboard_${symbol}_${method}`;

  if (!forceRefresh) {
    const cached = this.getFromCache<LSTMAEDashboardResponse>(cacheKey);
    if (cached) return cached;
  }

  try {
    const url = getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.DASHBOARD);
    const response = await this.fetchWithRetry<any>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        method,
        ...(forceRefresh && { force_refresh: true }),
      }),
    });

    console.log('Dashboard API response:', response);

    // ✅ TRANSFORM: Ensure all paths are API routes, not filesystem paths
    const dashboardResponse: LSTMAEDashboardResponse = {
      success: true,
      symbol: symbol,
      plotPaths: {
        // If response has plot_paths, use them, otherwise construct them
        dominantPatterns: response.plot_paths?.dominant_patterns || `/api/lstmae/${symbol}/plot/dominant_patterns`,
        clusterTimeline: response.plot_paths?.cluster_timeline || `/api/lstmae/${symbol}/plot/cluster_timeline`,
        intraday: response.plot_paths?.intraday || `/api/lstmae/${symbol}/plot/intraday`,
        clusterTransitions: response.plot_paths?.cluster_transitions || `/api/lstmae/${symbol}/plot/cluster_transitions`,
      },
      // ✅ CRITICAL: dashboard_path MUST be an API route
      dashboardPath: response.dashboard_path?.startsWith('/api/') 
        ? response.dashboard_path 
        : `/api/lstmae/${symbol}/dashboard-html`,
      reportPath: response.report_path || `/api/lstmae/${symbol}/report`,
      nDominantPatterns: response.n_dominant_patterns || 0,
      dominantPatterns: response.dominant_patterns || [],
    };

    console.log('Transformed dashboard response:', dashboardResponse);

    this.saveToCache(cacheKey, dashboardResponse);
    return dashboardResponse;
  } catch (error) {
    if (lstmaeConfig.fallbackEnabled) {
      return this.generateFallbackResponse(symbol, method);
    }
    throw error;
  }
}

  // services/lstmaeService.ts

private generateFallbackResponse(
  symbol: string,
  method: ClusteringMethod
): LSTMAEDashboardResponse {
  return {
    success: true,
    symbol,
    plotPaths: {
      dominantPatterns: getVisualizationPath(symbol, `${symbol}_dominant_patterns.png`),
      clusterTimeline: getVisualizationPath(symbol, `${symbol}_cluster_timeline.png`),
      intraday: getVisualizationPath(symbol, `${symbol}_intraday_patterns.png`),
      clusterTransitions: getVisualizationPath(symbol, `${symbol}_cluster_transitions.png`),
      anomalies: getVisualizationPath(symbol, `${symbol}_anomalies.png`),
      seasonality: getVisualizationPath(symbol, `${symbol}_seasonality.png`),
      transitionsAlt: getVisualizationPath(symbol, `${symbol}.transitions.png`),
    },
    // ✅ Correct format
    dashboardPath: `/api/lstmae/${symbol}/dashboard-html`, // This endpoint serves the HTML
    reportPath: getVisualizationPath(symbol, `${symbol}_analysis_report.json`),
    nDominantPatterns: 0,
    dominantPatterns: [],
  };
}

  async getReport(symbol: string, method: ClusteringMethod = 'spectral'): Promise<any> {
    const cacheKey = `report_${symbol}_${method}`;
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.REPORT(symbol))}?method=${method}`;
    const response = await this.fetchWithRetry<any>(url);

    this.saveToCache(cacheKey, response);
    return response;
  }

  async checkVisualizationExists(symbol: string): Promise<boolean> {
    try {
      const dashboard = await this.generateDashboard(symbol);
      return dashboard.success;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearSymbolCache(symbol: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(symbol)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

export const lstmaeService = new LSTMAEService();
