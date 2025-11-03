import { CompanyPredictions, HealthStatus } from '@/hooks/usePredictions';

const BASE_URL = process.env.NEXT_PUBLIC_PREDICTION_API || 'http://localhost:5112';

export class PredictionAPIService {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds

  /**
   * Fetch predictions for a single company
   */
  static async getCompanyPredictions(
    company: string,
    options?: {
      starttime?: string;
      endtime?: string;
      timeout?: number;
    }
  ): Promise<CompanyPredictions> {
    const url = new URL(`${BASE_URL}/predictions/${company}`);

    if (options?.starttime) {
      url.searchParams.append('start_time', options.starttime);
    }
    if (options?.endtime) {
      url.searchParams.append('end_time', options.endtime);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || this.DEFAULT_TIMEOUT
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw this.handleError(error, `Failed to fetch predictions for ${company}`);
    }
  }

  /**
   * Fetch predictions for multiple companies
   */
  static async getBatchPredictions(
    companies: string[],
    options?: {
      starttime?: string;
      endtime?: string;
      timeout?: number;
    }
  ): Promise<Record<string, CompanyPredictions>> {
    const url = new URL(`${BASE_URL}/predictions/batch/multiple`);

    companies.forEach((company) => {
      url.searchParams.append('companies', company);
    });

    if (options?.starttime) {
      url.searchParams.append('starttime', options.starttime);
    }
    if (options?.endtime) {
      url.searchParams.append('endtime', options.endtime);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || this.DEFAULT_TIMEOUT
      );

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data.results || {};
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to fetch batch predictions for ${companies.join(', ')}`
      );
    }
  }

  /**
   * Get specific prediction for a company at a timestamp
   */
  static async getSpecificPrediction(
    company: string,
    timestamp: string,
    options?: {
      timeout?: number;
    }
  ): Promise<{ company: string; timestamp: string; prediction: any }> {
    const url = `${BASE_URL}/predictions/${company}/${encodeURIComponent(timestamp)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || this.DEFAULT_TIMEOUT
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `API Error: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to fetch prediction for ${company} at ${timestamp}`
      );
    }
  }

  /**
   * Check API health status
   */
  static async checkHealth(options?: { timeout?: number }): Promise<HealthStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || this.DEFAULT_TIMEOUT
      );

      const response = await fetch(`${BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleError(error, 'Failed to check health status');
    }
  }

  /**
   * Get list of available companies
   */
  static async getCompanies(options?: {
    timeout?: number;
  }): Promise<{
    companies: string[];
    count: number;
    details: Record<string, any>;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        options?.timeout || this.DEFAULT_TIMEOUT
      );

      const response = await fetch(`${BASE_URL}/companies`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw this.handleError(error, 'Failed to fetch companies list');
    }
  }

  /**
   * Transform predictions to chart data format
   */
  static transformToChartData(
    predictions: CompanyPredictions,
    actualData?: Record<string, number>
  ): {
    timestamps: string[];
    predictedPrices: number[];
    actualPrices: (number | null)[];
    predictionAges: number[];
  } {
    const timestamps: string[] = [];
    const predictedPrices: number[] = [];
    const actualPrices: (number | null)[] = [];
    const predictionAges: number[] = [];

    const now = Date.now();

    Object.entries(predictions.predictions)
      .sort(([timeA], [timeB]) => timeA.localeCompare(timeB))
      .forEach(([timestamp, prediction]) => {
        timestamps.push(timestamp);
        predictedPrices.push(prediction.close);
        actualPrices.push(actualData?.[timestamp] ?? null);

        // Calculate age in minutes
        const predictionTime = new Date(prediction.predictedat).getTime();
        const ageMinutes = Math.floor((now - predictionTime) / 60000);
        predictionAges.push(ageMinutes);
      });

    return {
      timestamps,
      predictedPrices,
      actualPrices,
      predictionAges,
    };
  }

  /**
   * Calculate accuracy metrics
   */
  static calculateMetrics(
    predictions: CompanyPredictions,
    actualData: Record<string, number>
  ): {
    mae: number;
    rmse: number;
    mape: number;
    accuracy: number;
    matchCount: number;
  } {
    const errors: number[] = [];
    const percentErrors: number[] = [];
    let matchCount = 0;

    Object.entries(predictions.predictions).forEach(([timestamp, prediction]) => {
      if (actualData[timestamp] !== undefined) {
        matchCount++;
        const error = Math.abs(prediction.close - actualData[timestamp]);
        errors.push(error);
        percentErrors.push((error / actualData[timestamp]) * 100);
      }
    });

    if (errors.length === 0) {
      return { mae: 0, rmse: 0, mape: 0, accuracy: 0, matchCount: 0 };
    }

    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    const mse = errors.reduce((sum, error) => sum + error ** 2, 0) / errors.length;
    const rmse = Math.sqrt(mse);
    const mape = percentErrors.reduce((a, b) => a + b, 0) / percentErrors.length;

    return {
      mae,
      rmse,
      mape,
      accuracy: Math.max(0, 100 - mape),
      matchCount,
    };
  }

  /**
   * Check if data is stale (older than 10 minutes)
   */
  static isDataStale(predictedat: string, thresholdMinutes = 10): boolean {
    const predictionTime = new Date(predictedat).getTime();
    const ageMinutes = Math.floor((Date.now() - predictionTime) / 60000);
    return ageMinutes > thresholdMinutes;
  }

  /**
   * Handle API errors consistently
   */
  private static handleError(error: unknown, context: string): Error {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return new Error(`${context}: Request timeout`);
      }
      return new Error(`${context}: ${error.message}`);
    }

    return new Error(`${context}: Unknown error occurred`);
  }
}

export default PredictionAPIService;
