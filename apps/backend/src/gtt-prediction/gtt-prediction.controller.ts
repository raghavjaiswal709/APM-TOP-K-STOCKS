import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { GttPredictionService } from './gtt-prediction.service';

@Controller('gtt')
export class GttPredictionController {
    constructor(private readonly gttService: GttPredictionService) { }

    @Get('stock/:symbol')
    async getStockPredictions(@Param('symbol') symbol: string) {
        const data = await this.gttService.getHistory(symbol);
        if (!data) {
            // Return a standard error object as requested, instead of 500
            return {
                symbol,
                error: 'GTT Engine Unavailable or No Data',
                predictions: [],
                latest: null
            };
        }
        return data;
    }

    @Get('latest')
    async getLatestPredictions() {
        const data = await this.gttService.getLatest();
        if (!data) {
            return {
                error: 'GTT Engine Unavailable',
                data: []
            };
        }
        return data;
    }
}
