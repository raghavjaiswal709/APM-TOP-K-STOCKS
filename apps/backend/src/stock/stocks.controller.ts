import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { StockService } from './stocks.service';

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
}
