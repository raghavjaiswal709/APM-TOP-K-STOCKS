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
    @Query('firstFifteenMinutes') firstFifteenMinutes?: string,
  ) {
    if (!startDate) {
      throw new Error('Start date is required');
    }

    const startDateTime = new Date(startDate);
    let endDateTime = new Date(endDate);

    // Handle first 15 minutes logic
    if (firstFifteenMinutes === 'true') {
      // Set start time to market opening (9:15 AM)
      startDateTime.setHours(9, 15, 0, 0);
      // Set end time to 15 minutes later
      endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + 375);
    }

    const params: StockDataRequestDto = {
      companyId,
      startDate: startDateTime,
      endDate: endDateTime,
      interval: interval || '1m', // Use 1-minute for precise 15-minute data
      indicators: indicators || [],
      firstFifteenMinutes: firstFifteenMinutes === 'true',
    };
    
    return this.stockService.getStockDataFromPython(params);
  }
}
