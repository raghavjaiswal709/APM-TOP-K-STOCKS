import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
// import { MarketDataModule } from './market-data/market-data.module';
import { LiveMarketModule } from './live-market/live-market.module';
import { StockModule } from './stock/stocks.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AuthModule } from './auth/auth.module'; // Add this import
import { LstmaeModule } from './lstmae/lstmae.module';

@Module({
  imports: [
    DatabaseModule,
    // MarketDataModule,
    LiveMarketModule,
    StockModule,
    WatchlistModule,
    AuthModule, 
    LstmaeModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
