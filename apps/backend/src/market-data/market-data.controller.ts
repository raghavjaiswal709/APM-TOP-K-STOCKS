import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get(':symbol')
  getMarketData(@Param('symbol') symbol: string) {
    return this.marketDataService.getMarketData(symbol);
  }

  /*
  @Get('status')
  getMarketStatus() {
    return this.marketDataService.getMarketStatus();
  }

  @Get('quotes')
  getQuotes(@Query('symbols') symbols: string) {
    const symbolArray = symbols.split(',');
    return this.marketDataService.getQuotes(symbolArray);
  }

  @Get('history/:symbol')
  getHistoricalData(
    @Param('symbol') symbol: string,
    @Query('resolution') resolution: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.marketDataService.getHistoricalData(symbol, resolution, from, to);
  }

  @Get('depth/:symbol')
  getMarketDepth(@Param('symbol') symbol: string) {
    return this.marketDataService.getMarketDepth(symbol);
  }

  @Get('option-chain/:symbol')
  getOptionChain(@Param('symbol') symbol: string) {
    return this.marketDataService.getOptionChain(symbol);
  }
  */
}
