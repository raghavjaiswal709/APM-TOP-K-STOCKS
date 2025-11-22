import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
    ScoreResponseDto,
    DesirabilityResultDto,
    ClassificationEnum,
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
     * Fetches the desirability score for a given stock symbol
     * @param symbol - The stock symbol to analyze
     * @param method - Optional clustering method (default: 'spectral')
     * @returns The maximum desirability score and its classification
     */
    async getDesirabilityScore(
        symbol: string,
        method: string = 'spectral',
    ): Promise<DesirabilityResultDto> {
        try {
            const url = `${this.DESIRABILITY_API_URL}/desirability/scores/${symbol}?method=${method}`;
            this.logger.debug(`🔄 Fetching desirability score from: ${url}`);

            const response: AxiosResponse<ScoreResponseDto> = await firstValueFrom(
                this.httpService.get(url, {
                    timeout: this.TIMEOUT,
                }),
            );

            this.logger.debug(`✅ Desirability scores fetched for ${symbol}`);

            const data = response.data;

            // Find the maximum score across all clusters
            const scores = data.scores;
            const scoreEntries = Object.entries(scores);

            if (scoreEntries.length === 0) {
                this.logger.warn(`⚠️ No scores returned for ${symbol}`);
                return this.createNeutralResponse(symbol, method);
            }

            // Find cluster with maximum score
            const [maxClusterId, maxScore] = scoreEntries.reduce(
                (max, current) => (current[1] > max[1] ? current : max),
                scoreEntries[0],
            );

            const classification = data.classifications[maxClusterId];

            this.logger.log(
                `📊 Max score for ${symbol}: ${maxScore} (cluster ${maxClusterId}, ${classification})`,
            );

            return {
                symbol,
                maxScore,
                classification,
                method,
                timestamp: new Date(data.timestamp),
                rawScores: scores,
                clusterId: maxClusterId,
            };
        } catch (error: any) {
            // Graceful degradation: return neutral response instead of throwing
            this.logger.error(
                `❌ Failed to fetch desirability for ${symbol}:`,
                error.message,
            );
            this.logger.warn(
                `⚠️ Returning neutral response for ${symbol} due to service unavailability`,
            );

            return this.createNeutralResponse(symbol, method);
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
