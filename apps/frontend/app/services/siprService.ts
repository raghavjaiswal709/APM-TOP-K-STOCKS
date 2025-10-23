// apps/frontend/app/services/siprService.ts
import { siprConfig, getApiUrl, SIPR_CONSTANTS } from '../config/sipr.config';
import type {
  SiprTop3Response,
  SiprSegmentationResponse,
  SiprClusterResponse,
  SiprCentroidResponse,
  SiprPatternReport,
  SiprServiceHealth,
  SiprError,
} from '../types/sipr.types';

class SiprService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    const age = Date.now() - cached.timestamp;
    return age < siprConfig.cacheTTL * 1000;
  }

  private getFromCache<T>(key: string): T | null {
    if (this.isCacheValid(key)) {
      console.log(`✅ Cache HIT: ${key}`);
      return this.cache.get(key)!.data as T;
    }
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  private saveToCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    console.log(`💾 Cached: ${key}`);
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), siprConfig.timeout);

    try {
      console.log(`🌐 Fetching: ${url}`);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Success: ${url}`, data);
      return data;
    } catch (error) {
      clearTimeout(timeout);

      if (retries > 0) {
        console.log(`🔄 Retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.fetchWithRetry<T>(url, options, retries - 1);
      }

      console.error(`❌ Failed: ${url}`, error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): SiprError {
    const errorResponse: SiprError = {
      code: SIPR_CONSTANTS.ERROR_CODES.NETWORK_ERROR,
      message: 'An error occurred',
      timestamp: new Date().toISOString(),
    };

    if (error.name === 'AbortError') {
      errorResponse.code = SIPR_CONSTANTS.ERROR_CODES.TIMEOUT;
      errorResponse.message = 'Request timed out';
      errorResponse.suggestion = 'Please try again in a few moments.';
    } else if (error.message.includes('404')) {
      errorResponse.code = SIPR_CONSTANTS.ERROR_CODES.NOT_FOUND;
      errorResponse.message = 'Pattern data not found';
      errorResponse.suggestion = 'Verify the company code is correct.';
    } else {
      errorResponse.message = error.message || 'Unknown error occurred';
      errorResponse.suggestion = 'Check service health or try again.';
    }

    return errorResponse;
  }

  async checkHealth(): Promise<SiprServiceHealth> {
    const cacheKey = 'sipr_health_check';
    const cached = this.getFromCache<SiprServiceHealth>(cacheKey);
    if (cached) return cached;

    try {
      const url = getApiUrl(SIPR_CONSTANTS.ENDPOINTS.HEALTH);
      const response = await this.fetchWithRetry<SiprServiceHealth>(url);
      this.saveToCache(cacheKey, response);
      return response;
    } catch (error) {
      return {
        message: 'SIPR Pattern Analysis API',
        version: 'unavailable',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getTop3Patterns(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<SiprTop3Response> {
    const cacheKey = `top3_${companyCode}_${months}`;
    const cached = this.getFromCache<SiprTop3Response>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.TOP3(companyCode))}?months=${months}`;
    const response = await this.fetchWithRetry<SiprTop3Response>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  async getTop3PatternsHtml(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<string> {
    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.TOP3_HTML(companyCode))}?months=${months}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(siprConfig.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Top 3 patterns HTML: ${response.statusText}`);
    }

    return await response.text();
  }

  async getTimeSeriesSegmentation(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<SiprSegmentationResponse> {
    const cacheKey = `segmentation_${companyCode}_${months}`;
    const cached = this.getFromCache<SiprSegmentationResponse>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.SEGMENTATION(companyCode))}?months=${months}`;
    const response = await this.fetchWithRetry<SiprSegmentationResponse>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  async getTimeSeriesSegmentationHtml(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<string> {
    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.SEGMENTATION_HTML(companyCode))}?months=${months}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(siprConfig.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch segmentation HTML: ${response.statusText}`);
    }

    return await response.text();
  }

  async getPatternCluster(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<SiprClusterResponse> {
    const cacheKey = `cluster_${companyCode}_${months}`;
    const cached = this.getFromCache<SiprClusterResponse>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.CLUSTER(companyCode))}?months=${months}`;
    const response = await this.fetchWithRetry<SiprClusterResponse>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  async getPatternClusterHtml(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<string> {
    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.CLUSTER_HTML(companyCode))}?months=${months}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(siprConfig.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch cluster HTML: ${response.statusText}`);
    }

    return await response.text();
  }

  async getCentroidShapes(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<SiprCentroidResponse> {
    const cacheKey = `centroids_${companyCode}_${months}`;
    const cached = this.getFromCache<SiprCentroidResponse>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.CENTROIDS(companyCode))}?months=${months}`;
    const response = await this.fetchWithRetry<SiprCentroidResponse>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  async getCentroidShapesHtml(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<string> {
    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.CENTROIDS_HTML(companyCode))}?months=${months}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(siprConfig.timeout),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch centroids HTML: ${response.statusText}`);
    }

    return await response.text();
  }

  async getPatternReport(
    companyCode: string,
    months: number = siprConfig.defaultMonths
  ): Promise<SiprPatternReport> {
    const cacheKey = `report_${companyCode}_${months}`;
    const cached = this.getFromCache<SiprPatternReport>(cacheKey);
    if (cached) return cached;

    const url = `${getApiUrl(SIPR_CONSTANTS.ENDPOINTS.REPORT(companyCode))}?months=${months}`;
    const response = await this.fetchWithRetry<SiprPatternReport>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  async getAllCompanies(): Promise<string[]> {
    const cacheKey = 'all_companies';
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    const url = getApiUrl(SIPR_CONSTANTS.ENDPOINTS.COMPANIES);
    const response = await this.fetchWithRetry<string[]>(url);
    this.saveToCache(cacheKey, response);
    return response;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  clearCompanyCache(companyCode: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(companyCode)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️ Cleared cache for ${companyCode} (${keysToDelete.length} entries)`);
  }
}

export const siprService = new SiprService();
