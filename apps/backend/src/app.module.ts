// src/app.module.ts
import { Module } from '@nestjs/common';
import { StockModule } from './stock/stocks.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    // Do NOT import TypeOrmModule.forRoot here!
    // Do NOT import DatabaseModule here!
    // Only import DB-free modules here
    MarketDataModule,
    WatchlistModule, // DB-free
    // StockModule,     // DB-dependent, will handle its own DB connection
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
