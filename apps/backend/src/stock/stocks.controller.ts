import { Controller, Get, Param, Query } from '@nestjs/common';
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
    @Param('companyCode') companyCode: string,
    @Query('exchange') exchange?: string
  ) {
    return this.stockService.getCompanyHistory(companyCode, exchange);
  }

  @Get(':companyCode/ohlcv')
  async getStockData(
    @Param('companyCode') companyCode: string,  
    @Query('exchange') exchange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('interval') interval?: string,
    @Query('indicators') indicators?: string[],
    @Query('firstFifteenMinutes') firstFifteenMinutes?: string,
  ) {
    let startDateTime: Date | undefined;
    let endDateTime: Date | undefined;

    if (startDate) {
      startDateTime = new Date(startDate);
      
      if (endDate) {
        endDateTime = new Date(endDate);
      } else {
        endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + 375);
      }

      if (firstFifteenMinutes === 'true') {
        startDateTime.setHours(9, 15, 0, 0);
        endDateTime = new Date(startDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + 375);
      }
    }

    const params: StockDataRequestDto = {
      companyCode,     
      exchange,
      startDate: startDateTime,
      endDate: endDateTime,
      interval: interval || '1m',
      indicators: indicators || [],
      firstFifteenMinutes: firstFifteenMinutes === 'true',
    };
    
    return this.stockService.getStockDataFromPython(params);
  }
}
