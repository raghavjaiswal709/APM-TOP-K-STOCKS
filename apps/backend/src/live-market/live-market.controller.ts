import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { LiveMarketService } from './live-market.service';
import { SubscribeCompaniesDto, UnsubscribeDto } from './dto/live-market.dto';

@Controller('live-market')
export class LiveMarketController {
  constructor(private readonly liveMarketService: LiveMarketService) {}

  @Get('available-companies')
  async getAvailableCompanies(@Query('watchlist') watchlist: string = 'A') {
    return this.liveMarketService.getAvailableCompanies(watchlist);
  }

  @Get('market-status')
  getMarketStatus() {
    return this.liveMarketService.getMarketStatus();
  }

  @Post('subscribe')
  async subscribeToCompanies(@Body() subscribeDto: SubscribeCompaniesDto) {
    return this.liveMarketService.subscribeToCompanies(subscribeDto);
  }

  @Post('unsubscribe')
  async unsubscribeFromCompanies(@Body() unsubscribeDto: UnsubscribeDto) {
    return this.liveMarketService.unsubscribeFromCompanies(unsubscribeDto);
  }

  @Get('historical/:symbol')
  async getHistoricalData(
    @Param('symbol') symbol: string,
    @Query('date') date?: string
  ) {
    return this.liveMarketService.getHistoricalData(symbol, date);
  }
}
