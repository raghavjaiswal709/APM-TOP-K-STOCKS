import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  PredictionResponseDto,
  HealthResponseDto,
  CompaniesResponseDto,
  BatchPredictionResponseDto,
} from './dto/prediction-response.dto';
import { CreatePredictionDto, PredictionQueryDto } from './dto/prediction.dto';

@Injectable()
export class PredictionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PredictionService.name);
  private readonly predictionApiUrl: string;
  private predictionCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache - reduced to ensure fresh data every 5 min
  private lastHealthCheck: { data: HealthResponseDto; timestamp: number } | null = null;
  private readonly HEALTH_CACHE_DURATION = 30 * 1000; // 30 seconds
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(private httpService: HttpService) {
    this.predictionApiUrl = process.env.PREDICTION_API_URL || 'http://localhost:5112';
    this.logger.log(`🔮 Prediction API configured at: ${this.predictionApiUrl}`);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 Prediction Service initialized');
    this.startHealthPolling();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('🛑 Prediction Service destroyed');
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  /**
   * Start background health polling
   */
  private startHealthPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`⚠️ Background health check failed: ${errorMsg}`);
      }
    }, 60000); // Check every minute
  }

  /**
   * Get predictions for a company with optional time filtering
   */
  async getCompanyPredictions(
    company: string,
    query?: PredictionQueryDto
  ): Promise<PredictionResponseDto> {
    const cacheKey = `predictions_${company}_${JSON.stringify(query || {})}`;

    // Check cache
    const cached = this.predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      this.logger.debug(`📦 Returning cached predictions for ${company}`);
      return cached.data;
    }

    try {
      // Try to fetch from prediction API first
      this.logger.debug(`🔄 Fetching predictions for ${company} from API...`);
      const response = await this.fetchFromPredictionAPI(company, query);

      if (response) {
        this.logger.log(`✅ Successfully fetched predictions for ${company}: ${response.count} records`);
        const enrichedResponse = this.enrichPredictionResponse(response);
        this.predictionCache.set(cacheKey, { data: enrichedResponse, timestamp: Date.now() });
        return enrichedResponse;
      } else {
        this.logger.warn(`⚠️ Prediction API returned null for ${company}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to fetch from prediction API: ${errorMsg}`);
    }

    // Fallback to empty response
    this.logger.warn(`📭 Returning empty predictions for ${company}`);
    return {
      company,
      predictions: {},
      count: 0,
    };
  }

  /**
   * Get batch predictions for multiple companies
   */
  async getBatchPredictions(
    companies: string[],
    query?: PredictionQueryDto
  ): Promise<BatchPredictionResponseDto> {
    try {
      const results: Record<string, PredictionResponseDto> = {};
      const errors: Record<string, string> = {};
      let successCount = 0;

      for (const company of companies) {
        try {
          results[company] = await this.getCompanyPredictions(company, query);
          if (results[company].count > 0) {
            successCount++;
          }
        } catch (error) {
          errors[company] = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      this.logger.log(`📊 Batch fetch completed: ${successCount}/${companies.length} with data`);

      return {
        results,
        starttime: query?.starttime,
        endtime: query?.endtime,
        companiesrequested: companies.length,
        companiesfetched: successCount,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Error fetching batch predictions: ${errorMsg}`);
      throw new HttpException(
        'Failed to fetch batch predictions',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get specific prediction for a company at a timestamp
   */
  async getSpecificPrediction(
    company: string,
    timestamp: string
  ): Promise<{ company: string; timestamp: string; prediction: any }> {
    try {
      const predictions = await this.getCompanyPredictions(company);

      if (!predictions.predictions[timestamp]) {
        this.logger.warn(`⚠️ No prediction found for ${company} at ${timestamp}`);
        throw new HttpException(
          `No prediction found for ${company} at ${timestamp}`,
          HttpStatus.NOT_FOUND
        );
      }

      return {
        company,
        timestamp,
        prediction: predictions.predictions[timestamp],
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new HttpException(
        `Error fetching specific prediction: ${errorMsg}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Check API health status
   */
  async checkHealth(): Promise<HealthResponseDto> {
    // Check cache
    if (
      this.lastHealthCheck &&
      Date.now() - this.lastHealthCheck.timestamp < this.HEALTH_CACHE_DURATION
    ) {
      return this.lastHealthCheck.data;
    }

    try {
      this.logger.debug(`🏥 Checking health of prediction API at ${this.predictionApiUrl}...`);
      const response = await firstValueFrom(
        this.httpService.get(`${this.predictionApiUrl}/health`)
      );
      const healthData: HealthResponseDto = response.data;

      this.logger.log(
        `✅ Health check passed - Status: ${healthData.status}, Running: ${healthData.running}`
      );

      this.lastHealthCheck = {
        data: healthData,
        timestamp: Date.now(),
      };

      return healthData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Health check failed: ${errorMsg}`);

      // Return degraded health status
      return {
        status: 'stopped',
        running: false,
        lastupdate: new Date().toISOString(),
        activecompanies: [],
        totalcompanies: 0,
        companystatus: {},
      };
    }
  }

  /**
   * Get list of available companies
   */
  async getCompanies(): Promise<CompaniesResponseDto> {
    const cacheKey = 'companies_list';
    const cached = this.predictionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      this.logger.log('📋 Fetching companies list from prediction API...');
      const response = await firstValueFrom(
        this.httpService.get(`${this.predictionApiUrl}/companies`)
      );
      const companiesData: CompaniesResponseDto = response.data;

      this.logger.log(`✅ Companies fetched: ${companiesData.count} companies`);

      this.predictionCache.set(cacheKey, {
        data: companiesData,
        timestamp: Date.now(),
      });

      return companiesData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to fetch companies: ${errorMsg}`);

      // Return empty list
      return {
        companies: [],
        count: 0,
        details: {},
      };
    }
  }

  /**
   * Save predictions (mock - no database)
   */
  async savePrediction(dto: CreatePredictionDto): Promise<any> {
    try {
      this.logger.log(
        `💾 Saving prediction in memory: ${dto.company} at ${dto.timestamp} = ₹${dto.close}`
      );

      return {
        id: `pred_${Date.now()}`,
        company: dto.company,
        timestamp: dto.timestamp,
        close: dto.close,
        predictedat: dto.predictedat,
        exchange: dto.exchange || 'NSE',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Error saving prediction: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Fetch from prediction API with detailed logging
   */
  private async fetchFromPredictionAPI(
    company: string,
    query?: PredictionQueryDto
  ): Promise<PredictionResponseDto | null> {
    try {
      const params: Record<string, string> = {};

      if (query?.starttime) {
        params.start_time = query.starttime;
        this.logger.debug(`  Start Time: ${query.starttime}`);
      }
      if (query?.endtime) {
        params.end_time = query.endtime;
        this.logger.debug(`  End Time: ${query.endtime}`);
      }

      const url = `${this.predictionApiUrl}/predictions/${company}`;
      this.logger.debug(`📡 API Call: GET ${url}`);
      this.logger.debug(`📦 Params: ${JSON.stringify(params)}`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          params,
        })
      );

      const data = response.data;

      this.logger.debug(`📥 API Response Status: ${response.status}`);
      this.logger.debug(`📥 Response Data: ${JSON.stringify(data).substring(0, 200)}...`);

      if (!data) {
        this.logger.warn(`⚠️ API returned null data for ${company}`);
        return null;
      }

      if (data.count === 0) {
        this.logger.warn(`⚠️ API returned 0 predictions for ${company} (possibly no data for this date)`);
      }

      return data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ API fetch failed for ${company}: ${errorMsg}`);

      // Log additional error details
      if (error instanceof Error) {
        this.logger.error(`   Error Details: ${error.stack}`);
      }

      return null;
    }
  }

  /**
   * Enrich prediction response with summary
   */
  private enrichPredictionResponse(response: PredictionResponseDto): PredictionResponseDto {
    const prices = Object.values(response.predictions).map((p) => p.close);

    if (prices.length === 0) {
      this.logger.debug('📊 No prices to summarize');
      return response;
    }

    const summary = {
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      highPrice: Math.max(...prices),
      lowPrice: Math.min(...prices),
      priceRange: Math.max(...prices) - Math.min(...prices),
      latestPrice: prices[prices.length - 1],
    };

    this.logger.debug(
      `📈 Summary: Avg=₹${summary.avgPrice.toFixed(2)}, High=₹${summary.highPrice.toFixed(2)}, Low=₹${summary.lowPrice.toFixed(2)}`
    );

    return {
      ...response,
      summary,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    const size = this.predictionCache.size;
    this.predictionCache.clear();
    this.lastHealthCheck = null;
    this.logger.log(`🗑️ Prediction cache cleared (${size} entries removed)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.predictionCache.size,
      entries: this.predictionCache.size,
    };
  }
}
