import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { StockService } from './stocks.service';
import { StockDataRequestDto } from './dto/stock-data.dto';

@Controller('api/companies')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('top5')
  async getTop5Companies() {
    return this.stockService.getTop5Companies();
  }

  @Get(':companyCode/history')
  async getCompanyHistory(
    @Param('companyCode') companyCode: string
  ) {
    return this.stockService.getCompanyHistory(companyCode);
  }

  @Get(':companyId/ohlcv')
  async getStockData(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: string,
    @Query('indicators') indicators: string[],
  ) {
    const params: StockDataRequestDto = {
      companyId,
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to 30 days ago
      endDate: endDate ? new Date(endDate) : new Date(), // Default to now
      interval: interval || '10m', // Default to 10-minute intervals
      indicators: indicators || [],
    };
    
    return this.stockService.getStockDataFromPython(params);
  }
}
