import { Module } from '@nestjs/common';
import { StockModule } from './stock/stocks.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LiveMarketModule } from './live-market/live-market.module';

// import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
   
    WatchlistModule, 
    StockModule,     
      LiveMarketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
