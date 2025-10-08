// services/lstmaeService.ts
import { lstmaeConfig, getApiUrl, getVisualizationPath, isValidSymbol } from '../config/lstmae.config';
import { LSTMAE_CONSTANTS } from '../constants/lstmae.constants';
import type {
  LSTMAEDashboardResponse,
  LSTMAEServiceHealth,
  LSTMAEError,
  ClusteringMethod,
} from '../../app/types/lstmae.types';

/**
 * LSTMAE Pipeline 2 API Service
 * Handles all communication with Pipeline 2 Visualization Engine (Port 8506)
 * Based on Pipeline 2 Integration Guide - Section 4.6
 */
class LSTMAEService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  /**
   * Check if data is in cache and not expired
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    const ttl = lstmaeConfig.cacheTTL * 1000; // Convert to milliseconds
    return age < ttl;
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)!.data as T;
    }
    return null;
  }

  /**
   * Save data to cache
   */
  private saveToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Make API request with retry logic
   */
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

  /**
   * Handle and format errors according to document section 7
   */
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

  /**
   * Check service health
   * Endpoint: GET /health (Section 4.6)
   */
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

  /**
   * Generate complete dashboard for a symbol
   * Endpoint: POST /visualize/dashboard (Section 4.6)
   * @param symbol - Stock symbol (e.g., "RELIANCE")
   * @param method - Clustering method (default: "spectral")
   * @param forceRefresh - Force regeneration even if cached
   */
  async generateDashboard(
    symbol: string,
    method: ClusteringMethod = LSTMAE_CONSTANTS.DEFAULT_CLUSTERING_METHOD,
    forceRefresh = false
  ): Promise<LSTMAEDashboardResponse> {
    // Validate symbol
    if (!isValidSymbol(symbol)) {
      throw new Error(`Invalid symbol format: ${symbol}`);
    }

    const cacheKey = `dashboard_${symbol}_${method}`;

    // Check cache unless force refresh
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

      // Transform API response to our interface format
      const dashboardResponse: LSTMAEDashboardResponse = {
        success: true,
        symbol: response.symbol,
        plotPaths: {
          dominantPatterns: response.plot_paths?.dominant_patterns || '',
          clusterTimeline: response.plot_paths?.cluster_timeline || '',
          intraday: response.plot_paths?.intraday || '',
          clusterTransitions: response.plot_paths?.cluster_transitions || '',
        },
        dashboardPath: response.dashboard_path || '',
        reportPath: response.report_path || '',
        nDominantPatterns: response.n_dominant_patterns || 0,
        dominantPatterns: response.dominant_patterns || [],
      };

      this.saveToCache(cacheKey, dashboardResponse);
      return dashboardResponse;
    } catch (error) {
      // Fallback to direct file paths if API fails and fallback is enabled
      if (lstmaeConfig.fallbackEnabled) {
        return this.generateFallbackResponse(symbol, method);
      }
      throw error;
    }
  }

  /**
   * Generate fallback response using direct file paths
   * Used when API is unavailable (Section 3.2 - Option 1)
   */
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
      },
      dashboardPath: getVisualizationPath(symbol, `${symbol}_interactive_dashboard.html`),
      reportPath: getVisualizationPath(symbol, `${symbol}_analysis_report.json`),
      nDominantPatterns: 0,
      dominantPatterns: [],
    };
  }

  /**
   * Get specific plot image
   * Endpoint: GET /visualize/{symbol}/plot/{plot_type} (Section 4.6)
   */
  async getPlot(symbol: string, plotType: string, method: ClusteringMethod = 'spectral'): Promise<Blob> {
    const url = `${getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.PLOT(symbol, plotType))}?method=${method}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch plot: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Get analysis report
   * Endpoint: GET /visualize/{symbol}/report (Section 4.6)
   */
  async getReport(symbol: string, method: ClusteringMethod = 'spectral'): Promise<any> {
    const cacheKey = `report_${symbol}_${method}`;
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(LSTMAE_CONSTANTS.ENDPOINTS.REPORT(symbol))}?method=${method}`;
    const response = await this.fetchWithRetry<any>(url);

    this.saveToCache(cacheKey, response);
    return response;
  }

  /**
   * Check if visualization files exist
   */
  async checkVisualizationExists(symbol: string): Promise<boolean> {
    try {
      const dashboard = await this.generateDashboard(symbol);
      return dashboard.success;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific symbol
   */
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

// Export singleton instance
export const lstmaeService = new LSTMAEService();
