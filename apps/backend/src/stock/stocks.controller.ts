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
  @Query('indicators') indicators?: string,
  @Query('firstFifteenMinutes') firstFifteenMinutes?: string,
  @Query('fetchType') fetchType?: string, 
) {
  console.log('🎯 API Request received:', {
    companyCode,
    exchange,
    startDate,
    endDate,
    interval,
    fetchType
  });

  let startDateTime: Date | undefined;
  let endDateTime: Date | undefined;

  if (startDate) {
    startDateTime = new Date(startDate);
    
    if (endDate) {
      endDateTime = new Date(endDate);
    } else {
      endDateTime = new Date();
  startDateTime = new Date();
  startDateTime.setDate(startDateTime.getDate() - 7);
    }

    if (firstFifteenMinutes === 'true') {
      startDateTime.setHours(9, 15, 0, 0);
      endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + 15); 

    }
  }

  const params: StockDataRequestDto = {
    companyCode,     
    exchange,
    startDate: startDateTime,
    endDate: endDateTime,
    interval: interval || '1m',
    indicators: indicators ? indicators.split(',') : [],
    firstFifteenMinutes: firstFifteenMinutes === 'true',
  };
  
  const result = await this.stockService.getStockDataFromPython(params);
  
  console.log('✅ API Response:', {
    companyCode,
    dataPoints: result.length,
    fetchType
  });
  
  return result;
}

}
