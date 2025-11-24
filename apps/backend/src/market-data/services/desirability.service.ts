import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
    ScoreResponseDto,
    DesirabilityResultDto,
    ClassificationEnum,
    AnalyzeResponseDto,
    ClassificationResponseDto,
    FilterResponseDto,
    GetDesirableResponseDto,
    MetricsResponseDto,
} from '../dto/desirability.dto';

@Injectable()
export class DesirabilityService {
    private readonly logger = new Logger(DesirabilityService.name);
    private readonly DESIRABILITY_API_URL =
        process.env.DESIRABILITY_API_URL || 'http://100.93.172.21:8508';
    private readonly TIMEOUT = 30000; // 30 seconds

    constructor(private readonly httpService: HttpService) {
        this.logger.log('🎯 DesirabilityService initialized');
        this.logger.log(`   Desirability API: ${this.DESIRABILITY_API_URL}`);
    }

    /**
     * Health Check
     * GET /health
     */
    async checkHealth(): Promise<any> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.DESIRABILITY_API_URL}/health`, {
                    timeout: 5000,
                }),
            );
            return response.data;
        } catch (error: any) {
            this.logger.error('❌ Desirability API health check failed:', error.message);
            return { status: 'unhealthy', error: error.message };
        }
    }

    /**
     * Analyze All Clusters
     * POST /desirability/analyze/{symbol}
     */
    async analyzeAllClusters(
        symbol: string,
        method: string = 'spectral',
        computeAllClusters: boolean = true,
    ): Promise<AnalyzeResponseDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/analyze/${symbol}`;
            const response = await firstValueFrom(
                this.httpService.post(url, {
                    symbol,
                    method,
                    compute_all_clusters: computeAllClusters,
                    exchange: 'NSE' // Defaulting to NSE as per typical usage
                }, { timeout: this.TIMEOUT }),
            );
            return response.data;
        } catch (error: any) {
            this.handleError(error, symbol, 'analyzeAllClusters');
            throw error;
        }
    }

    /**
     * Get Single Cluster Classification
     * GET /desirability/classification/{symbol}/{cluster_id}
     */
    async getClusterClassification(
        symbol: string,
        clusterId: number,
        method: string = 'spectral',
    ): Promise<ClassificationResponseDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/classification/${symbol}/${clusterId}?method=${method}`;
            const response = await firstValueFrom(
                this.httpService.get(url, { timeout: this.TIMEOUT }),
            );
            return response.data;
        } catch (error: any) {
            this.handleError(error, symbol, 'getClusterClassification');
            throw error;
        }
    }

    /**
     * Filter Patterns by Desirability
     * POST /desirability/filter-patterns
     */
    async filterPatterns(
        symbol: string,
        clusterIds: number[],
        method: string = 'spectral',
        minThreshold: number = 0.5,
    ): Promise<FilterResponseDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/filter-patterns`;
            const response = await firstValueFrom(
                this.httpService.post(url, {
                    symbol,
                    cluster_ids: clusterIds,
                    method,
                    min_threshold: minThreshold,
                }, { timeout: this.TIMEOUT }),
            );
            return response.data;
        } catch (error: any) {
            this.handleError(error, symbol, 'filterPatterns');
            throw error;
        }
    }

    /**
     * Get Desirable Clusters
     * POST /desirability/get-desirable
     */
    async getDesirableClusters(
        symbol: string,
        method: string = 'spectral',
        minThreshold: number = 0.5,
    ): Promise<GetDesirableResponseDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/get-desirable`;
            const response = await firstValueFrom(
                this.httpService.post(url, {
                    symbol,
                    method,
                    min_threshold: minThreshold,
                }, { timeout: this.TIMEOUT }),
            );
            return response.data;
        } catch (error: any) {
            this.handleError(error, symbol, 'getDesirableClusters');
            throw error;
        }
    }

    /**
     * Get Top Pattern Details
     * GET /desirability/metrics/{symbol}/{cluster_id}
     */
    async getTopPatternDetails(
        symbol: string,
        clusterId: number,
        method: string = 'spectral',
    ): Promise<MetricsResponseDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/metrics/${symbol}/${clusterId}?method=${method}`;
            const response = await firstValueFrom(
                this.httpService.get(url, { timeout: this.TIMEOUT }),
            );
            return response.data;
        } catch (error: any) {
            this.handleError(error, symbol, 'getTopPatternDetails');
            throw error;
        }
    }

    /**
     * Fetches the desirability score for a given stock symbol
     * Updated to use /desirability/top-pattern endpoint
     */
    /**
     * Fetches the desirability score for a given stock symbol
     * Updated to use /desirability/top-pattern endpoint
     */
    async getDesirabilityScore(
        symbol: string,
        method: string = 'spectral',
    ): Promise<DesirabilityResultDto> {
        // Use environment variable (now correctly set in .env)
        const url = `${this.DESIRABILITY_API_URL}/desirability/top-pattern/${symbol}?method=${method}&exchange=NSE`;

        this.logger.log(`� [DEBUG] Requesting Desirability Score`);
        this.logger.log(`   👉 URL: ${url}`);
        this.logger.log(`   👉 Symbol: ${symbol}`);

        try {
            const response = await firstValueFrom(
                this.httpService.get(url, { timeout: this.TIMEOUT }),
            );

            this.logger.log(`✅ [DEBUG] Response Status: ${response.status}`);
            const data = response.data;
            // this.logger.log(`   👉 Data: ${JSON.stringify(data).substring(0, 200)}...`);

            if (!data.top_pattern) {
                this.logger.warn(`⚠️ [DEBUG] No top_pattern found in response`);
                return this.createNeutralResponse(symbol, method);
            }

            const topPattern = data.top_pattern;

            this.logger.log(
                `📊 Top pattern for ${symbol}: ${topPattern.desirability_score} (cluster ${topPattern.cluster_id}, ${topPattern.classification})`,
            );

            // Return the raw data as requested by the user
            return data as any;

            /*
            return {
                symbol: data.symbol,
                maxScore: topPattern.desirability_score,
                classification: topPattern.classification,
                method: data.method,
                timestamp: new Date(data.timestamp),
                clusterId: topPattern.cluster_id?.toString(),
                details: topPattern.details
            };
            */

        } catch (error: any) {
            this.logger.error(`❌ [DEBUG] Request Failed!`);
            this.logger.error(`   👉 Error Message: ${error.message}`);
            if (error.response) {
                this.logger.error(`   👉 Status: ${error.response.status}`);
                this.logger.error(`   👉 Data: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                this.logger.error(`   👉 No response received (Network Error?)`);
            }

            return this.createNeutralResponse(symbol, method);
        }
    }

    private handleError(error: any, symbol: string, method: string) {
        this.logger.error(`❌ Error in ${method} for ${symbol}: ${error.message}`);
        if (error.response) {
            this.logger.error(`   Status: ${error.response.status}`);
            this.logger.error(`   Data: ${JSON.stringify(error.response.data)}`);
        }
    }

    /**
     * Creates a neutral response when the external service is unavailable
     */
    private createNeutralResponse(
        symbol: string,
        method: string,
    ): DesirabilityResultDto {
        return {
            symbol,
            maxScore: null,
            classification: null,
            method,
            timestamp: new Date(),
        };
    }
}
