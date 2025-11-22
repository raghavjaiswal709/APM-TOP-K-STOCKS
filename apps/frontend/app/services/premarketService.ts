// Pre-Market API Service
// Base URL for Pre-Market API - routes through backend to avoid CORS issues
export const PREMARKET_API_BASE_URL = '/api/premarket';

/**
 * Types for Pre-Market API responses
 */

export interface PremarketHeadline {
  id: string;
  text: string;
  timestamp: string; // ISO format: "2025-11-17T10:30:00"
  gpt4o_sentiment: string; // "Positive" | "Negative" | "Neutral"
  price_movement_1hr?: {
    pre: string;
    post: string;
    price_change_pct: number;
  };
  rel_vol_1hr?: number;
  price_movement_1day?: {
    pre: string;
    post: string;
    price_change_pct: number;
  };
  rel_vol_1day?: number;
  price_movement_7day?: {
    pre: string;
    post: string;
    price_change_pct: number;
  };
  rel_vol_7day?: number;
}

export interface PremarketHeadlinesResponse {
  stock_ticker: string;
  headlines: PremarketHeadline[];
  total_headlines: number;
  cached: boolean;
}

export interface PremarketPrediction {
  stock_ticker: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasoning: string;
  headlines_analyzed: number;
  timestamp: string;
}

export interface PremarketPredictionsResponse {
  predictions: PremarketPrediction[];
  total_stocks: number;
  generated_at: string;
  cached: boolean;
}

export interface PremarketChartListResponse {
  stock_ticker: string;
  date: string;
  intraday_charts: string[];
  interday_charts: string[];
  total_charts: number;
}

export interface PremarketGenerationStatus {
  is_generating: boolean;
  completed: boolean;
  progress: number;
  total: number;
  started_at?: string;
  completed_at?: string;
  errors: string[];
  cached_predictions: number;
  cached_headlines: number;
}

/**
 * Pre-Market API Service Class
 */
class PremarketService {
  private baseUrl: string;

  constructor(baseUrl: string = PREMARKET_API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch headlines for a specific stock with automatic fallback
   * 1. Try cached endpoint (fast, in-memory): /api/premarket/headlines/{stock_code}/cached
   * 2. Fallback to on-disk endpoint (slower): /api/premarket/headlines/{stock_code}
   */
  async fetchHeadlinesCached(stockCode: string): Promise<PremarketHeadlinesResponse> {
    try {
      // First try: cached endpoint (fast)
      const cachedUrl = `${this.baseUrl}/headlines/${stockCode}`;
      console.log(`📰 [1/2] Fetching cached headlines for ${stockCode}`);

      const cachedResponse = await fetch(cachedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (cachedResponse.ok) {
        const data = await cachedResponse.json();
        console.log(`✅ [CACHED] Fetched ${data.total_headlines} headlines for ${stockCode}`);
        return data;
      }

      // If cached failed (404 or error), try on-disk endpoint
      if (cachedResponse.status === 404 || cachedResponse.status === 425) {
        console.log(`⚠️ Cached data not available (${cachedResponse.status}), trying on-disk endpoint...`);

        // Second try: on-disk endpoint (reads from disk)
        const onDiskUrl = `${this.baseUrl}/headlines/${stockCode}`;
        console.log(`📰 [2/2] Fetching headlines from disk for ${stockCode}`);

        const onDiskResponse = await fetch(onDiskUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!onDiskResponse.ok) {
          if (onDiskResponse.status === 404) {
            console.warn(`⚠️ No headlines found for ${stockCode} (checked cache and disk)`);
            return this.createEmptyHeadlinesResponse(stockCode);
          }
          if (onDiskResponse.status >= 500) {
            console.error(`❌ Server error (${onDiskResponse.status}) for ${stockCode}, returning empty data`);
            return this.createEmptyHeadlinesResponse(stockCode);
          }
          throw new Error(`HTTP ${onDiskResponse.status}: ${onDiskResponse.statusText}`);
        }

        const data = await onDiskResponse.json();
        console.log(`✅ [ON-DISK] Fetched ${data.total_headlines} headlines for ${stockCode}`);
        return data;
      }

      // Handle server errors (500+) gracefully
      if (cachedResponse.status >= 500) {
        console.error(`❌ Server error (${cachedResponse.status}) for ${stockCode}, returning empty data`);
        return this.createEmptyHeadlinesResponse(stockCode);
      }

      // Other client errors (400-499) should still throw
      console.error(`❌ HTTP ${cachedResponse.status} error for ${stockCode}`);
      return this.createEmptyHeadlinesResponse(stockCode);
    } catch (error) {
      console.error(`❌ Error fetching headlines for ${stockCode}:`, error);
      // Return empty data instead of throwing to prevent UI crashes
      return this.createEmptyHeadlinesResponse(stockCode);
    }
  }

  /**
   * Create an empty headlines response for graceful degradation
   */
  private createEmptyHeadlinesResponse(stockCode: string): PremarketHeadlinesResponse {
    return {
      stock_ticker: stockCode,
      headlines: [],
      total_headlines: 0,
      cached: false
    };
  }

  /**
   * Fetch prediction for a specific stock with automatic fallback
   * 1. Try cached endpoint (fast, in-memory): /api/premarket/predictions/{stock_code}
   * 2. Fallback to on-demand endpoint (slower): /api/premarket/sentiment/{stock_code}
   */
  async fetchPrediction(stockCode: string): Promise<PremarketPrediction> {
    try {
      // First try: cached endpoint (fast)
      const cachedUrl = `${this.baseUrl}/predictions/${stockCode}`;
      console.log(`🔮 [1/2] Fetching cached prediction for ${stockCode}`);

      const cachedResponse = await fetch(cachedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (cachedResponse.ok) {
        const data = await cachedResponse.json();
        console.log(`✅ [CACHED] Prediction for ${stockCode}: ${data.sentiment} (${data.confidence})`);
        return data;
      }

      // If cached failed (404 or 425), try on-demand endpoint
      if (cachedResponse.status === 404 || cachedResponse.status === 425) {
        console.log(`⚠️ Cached prediction not available (${cachedResponse.status}), computing on-demand...`);

        // Second try: on-demand endpoint (computes live)
        const onDemandUrl = `${this.baseUrl}/sentiment/${stockCode}`;
        console.log(`🔮 [2/2] Computing prediction on-demand for ${stockCode}`);

        const onDemandResponse = await fetch(onDemandUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!onDemandResponse.ok) {
          if (onDemandResponse.status === 404) {
            console.warn(`⚠️ No prediction available for ${stockCode}`);
            return this.createNeutralPrediction(stockCode);
          }
          if (onDemandResponse.status >= 500) {
            console.error(`❌ Server error (${onDemandResponse.status}) for ${stockCode}, returning neutral prediction`);
            return this.createNeutralPrediction(stockCode);
          }
          throw new Error(`HTTP ${onDemandResponse.status}: ${onDemandResponse.statusText}`);
        }

        const data = await onDemandResponse.json();
        console.log(`✅ [ON-DEMAND] Computed prediction for ${stockCode}: ${data.sentiment} (${data.confidence})`);
        return data;
      }

      // Handle server errors (500+) gracefully
      if (cachedResponse.status >= 500) {
        console.error(`❌ Server error (${cachedResponse.status}) for ${stockCode}, returning neutral prediction`);
        return this.createNeutralPrediction(stockCode);
      }

      // Other client errors
      console.error(`❌ HTTP ${cachedResponse.status} error for ${stockCode}`);
      return this.createNeutralPrediction(stockCode);
    } catch (error) {
      console.error(`❌ Error fetching prediction for ${stockCode}:`, error);
      // Return neutral prediction instead of throwing
      return this.createNeutralPrediction(stockCode);
    }
  }

  /**
   * Create a neutral prediction for graceful degradation
   */
  private createNeutralPrediction(stockCode: string): PremarketPrediction {
    return {
      stock_ticker: stockCode,
      sentiment: 'NEUTRAL',
      confidence: 'LOW',
      score: 0,
      reasoning: 'Prediction unavailable due to service error',
      headlines_analyzed: 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Fetch all predictions with automatic fallback
   * 1. Try cached endpoint (fast, in-memory): /api/premarket/predictions
   * 2. Fallback to batch endpoint (slower): /api/premarket/batch
   */
  async fetchAllPredictions(): Promise<PremarketPredictionsResponse> {
    try {
      // First try: cached endpoint (fast)
      const cachedUrl = `${this.baseUrl}/predictions`;
      console.log(`🔮 [1/2] Fetching all cached predictions`);

      const cachedResponse = await fetch(cachedUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (cachedResponse.ok) {
        const data = await cachedResponse.json();
        console.log(`✅ [CACHED] Fetched ${data.total_stocks} predictions`);
        return data;
      }

      // If cached failed (425 or error), try batch endpoint
      if (cachedResponse.status === 425 || cachedResponse.status === 404) {
        console.log(`⚠️ Cached predictions not available (${cachedResponse.status}), computing batch on-demand...`);

        // Second try: batch endpoint (computes live for all stocks)
        const batchUrl = `${this.baseUrl}/batch`;
        console.log(`🔮 [2/2] Computing all predictions on-demand (batch)`);

        const batchResponse = await fetch(batchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!batchResponse.ok) {
          throw new Error(`HTTP ${batchResponse.status}: ${batchResponse.statusText}`);
        }

        const data = await batchResponse.json();
        console.log(`✅ [ON-DEMAND] Computed ${data.total_stocks} predictions (batch)`);
        return data;
      }

      // Other errors from cached endpoint
      throw new Error(`HTTP ${cachedResponse.status}: ${cachedResponse.statusText}`);
    } catch (error) {
      console.error(`❌ Error fetching all predictions:`, error);
      throw error;
    }
  }

  /**
   * List available charts for a stock
   * GET /api/premarket/charts/{stock_code}?date=YYYY-MM-DD
   */
  async listCharts(stockCode: string, date?: string): Promise<PremarketChartListResponse> {
    try {
      const url = date
        ? `${this.baseUrl}/charts/${stockCode}?date=${date}`
        : `${this.baseUrl}/charts/${stockCode}`;

      console.log(`📊 Listing charts for ${stockCode} from ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No charts found for ${stockCode}`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Found ${data.total_charts} charts for ${stockCode} on ${data.date}`);
      return data;
    } catch (error) {
      console.error(`❌ Error listing charts for ${stockCode}:`, error);
      throw error;
    }
  }

  /**
   * Get chart image URL (direct access to PNG)
   * GET /api/premarket/charts/{stock_code}/{date}/{filename}
   */
  getChartImageUrl(stockCode: string, date: string, filename: string): string {
    return `${this.baseUrl}/charts/${stockCode}/${date}/${filename}`;
  }

  /**
   * Check generation status
   * GET /api/premarket/status
   */
  async checkStatus(): Promise<PremarketGenerationStatus> {
    try {
      const url = `${this.baseUrl}/status`;
      console.log(`⏱️ Checking generation status from ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Status: ${data.completed ? 'Completed' : 'In Progress'} (${data.progress}/${data.total})`);
      return data;
    } catch (error) {
      console.error(`❌ Error checking status:`, error);
      throw error;
    }
  }

  /**
   * Trigger prediction generation
   * POST /api/premarket/generate
   */
  async generatePredictions(): Promise<{ message: string; status: PremarketGenerationStatus }> {
    try {
      const url = `${this.baseUrl}/generate`;
      console.log(`🚀 Triggering prediction generation at ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Generation completed: ${data.message}`);
      return data;
    } catch (error) {
      console.error(`❌ Error generating predictions:`, error);
      throw error;
    }
  }

  /**
   * Health check
   * GET /health
   */
  async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Health check failed:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const premarketService = new PremarketService();

// Export class for custom instances
export { PremarketService };
