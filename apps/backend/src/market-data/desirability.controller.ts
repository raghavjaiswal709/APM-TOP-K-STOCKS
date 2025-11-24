import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DesirabilityService } from './services/desirability.service';

@Controller('desirability')
export class DesirabilityController {
    constructor(private readonly desirabilityService: DesirabilityService) { }

    /**
     * GET /desirability/health
     */
    @Get('health')
    async checkHealth() {
        return await this.desirabilityService.checkHealth();
    }

    /**
     * GET /desirability/scores/:symbol
     * Proxies requests to the Python Pattern Desirability Service
     * @param symbol - Stock symbol (e.g., HDFCBANK, RELIANCE)
     * @param method - Optional clustering method (default: spectral)
     */
    @Get('scores/:symbol')
    async getDesirabilityScore(
        @Param('symbol') symbol: string,
        @Query('method') method?: string,
    ) {
        try {
            return await this.desirabilityService.getDesirabilityScore(symbol, method);
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to fetch desirability score',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * POST /desirability/analyze/:symbol
     */
    @Post('analyze/:symbol')
    async analyzeAllClusters(
        @Param('symbol') symbol: string,
        @Body() body: { method?: string; compute_all_clusters?: boolean },
    ) {
        try {
            return await this.desirabilityService.analyzeAllClusters(
                symbol,
                body.method,
                body.compute_all_clusters,
            );
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to analyze clusters',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * GET /desirability/classification/:symbol/:clusterId
     */
    @Get('classification/:symbol/:clusterId')
    async getClusterClassification(
        @Param('symbol') symbol: string,
        @Param('clusterId') clusterId: number,
        @Query('method') method?: string,
    ) {
        try {
            return await this.desirabilityService.getClusterClassification(
                symbol,
                clusterId,
                method,
            );
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to get cluster classification',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * POST /desirability/filter-patterns
     */
    @Post('filter-patterns')
    async filterPatterns(
        @Body() body: { symbol: string; cluster_ids: number[]; method?: string; min_threshold?: number },
    ) {
        try {
            return await this.desirabilityService.filterPatterns(
                body.symbol,
                body.cluster_ids,
                body.method,
                body.min_threshold,
            );
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to filter patterns',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * POST /desirability/get-desirable
     */
    @Post('get-desirable')
    async getDesirableClusters(
        @Body() body: { symbol: string; method?: string; min_threshold?: number },
    ) {
        try {
            return await this.desirabilityService.getDesirableClusters(
                body.symbol,
                body.method,
                body.min_threshold,
            );
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to get desirable clusters',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * GET /desirability/metrics/:symbol/:clusterId
     */
    @Get('metrics/:symbol/:clusterId')
    async getTopPatternDetails(
        @Param('symbol') symbol: string,
        @Param('clusterId') clusterId: number,
        @Query('method') method?: string,
    ) {
        try {
            return await this.desirabilityService.getTopPatternDetails(
                symbol,
                clusterId,
                method,
            );
        } catch (error) {
            throw new HttpException(
                error.message || 'Failed to get pattern metrics',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
