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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval?: string,
    @Query('indicators') indicators?: string[],
    @Query('firstFifteenMinutes') firstFifteenMinutes?: string,
  ) {
    // **KEY FIX**: Remove the startDate requirement check
    // if (!startDate) {
    //   throw new Error('Start date is required');
    // }

    let startDateTime: Date | undefined;
    let endDateTime: Date | undefined;

    // Handle date parameters - if no dates provided, fetch all data
    if (startDate) {
      startDateTime = new Date(startDate);
      
      if (endDate) {
        endDateTime = new Date(endDate);
      } else {
        // If only start date provided, default to first 15 minutes
        endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + 375);
      }

      // Handle first 15 minutes logic
      if (firstFifteenMinutes === 'true') {
        startDateTime.setHours(9, 15, 0, 0);
        endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + 375);
      }
    }
    // If no startDate provided, both will remain undefined for "fetch all data"

    const params: StockDataRequestDto = {
      companyId,
      startDate: startDateTime,
      endDate: endDateTime,
      interval: interval || '1m',
      indicators: indicators || [],
      firstFifteenMinutes: firstFifteenMinutes === 'true',
    };
    
    return this.stockService.getStockDataFromPython(params);
  }
}
