import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { LiveMarketModule } from './live-market/live-market.module';
import { StockModule } from './stock/stocks.module';
import { WatchlistModule } from './watchlist/watchlist.module';
import { AuthModule } from './auth/auth.module';
import { LstmaeModule } from './lstmae/lstmae.module';
import { SiprModule } from './sipr/sipr.module';
import { PredictionModule } from './prediction/prediction.module';
import { PremarketModule } from './premarket/premarket.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    DatabaseModule,
    LiveMarketModule,
    StockModule,
    WatchlistModule,
    AuthModule,
    LstmaeModule,
    SiprModule,
    PredictionModule,
    PremarketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
