import { Module } from '@nestjs/common';
import { StockModule } from './stock/stocks.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
   
    WatchlistModule, 
    StockModule,     
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
