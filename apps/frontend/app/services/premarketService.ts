// Pre-Market API Service
// Base URL for Pre-Market API - routes through backend to avoid CORS issues
export const PREMARKET_API_BASE_URL = process.env.NEXT_PUBLIC_PREMARKET_API || '/api/premarket';

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
   * Fetch headlines for a specific stock (cached)
   * GET /api/premarket/headlines/{stock_code}/cached
   */
  async fetchHeadlinesCached(stockCode: string): Promise<PremarketHeadlinesResponse> {
    try {
      const url = `${this.baseUrl}/headlines/${stockCode}/cached`;
      console.log(`📰 Fetching cached headlines for ${stockCode} from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No cached headlines found for ${stockCode}`);
        }
        if (response.status === 425) {
          throw new Error('Predictions not yet generated. Call /generate first.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.total_headlines} headlines for ${stockCode}`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching headlines for ${stockCode}:`, error);
      throw error;
    }
  }

  /**
   * Fetch prediction for a specific stock (cached)
   * GET /api/premarket/predictions/{stock_code}
   */
  async fetchPrediction(stockCode: string): Promise<PremarketPrediction> {
    try {
      const url = `${this.baseUrl}/predictions/${stockCode}`;
      console.log(`🔮 Fetching prediction for ${stockCode} from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No prediction found for ${stockCode}`);
        }
        if (response.status === 425) {
          throw new Error('Predictions not yet generated. Call /generate first.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched prediction for ${stockCode}: ${data.sentiment} (${data.confidence})`);
      return data;
    } catch (error) {
      console.error(`❌ Error fetching prediction for ${stockCode}:`, error);
      throw error;
    }
  }

  /**
   * Fetch all predictions (cached)
   * GET /api/premarket/predictions
   */
  async fetchAllPredictions(): Promise<PremarketPredictionsResponse> {
    try {
      const url = `${this.baseUrl}/predictions`;
      console.log(`🔮 Fetching all predictions from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 425) {
          throw new Error('Predictions not yet generated. Call /generate first.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Fetched ${data.total_stocks} predictions`);
      return data;
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
