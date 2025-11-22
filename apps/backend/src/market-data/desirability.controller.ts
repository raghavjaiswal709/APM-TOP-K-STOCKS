import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DesirabilityService } from './services/desirability.service';

@Controller('desirability')
export class DesirabilityController {
    constructor(private readonly desirabilityService: DesirabilityService) { }

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
}
