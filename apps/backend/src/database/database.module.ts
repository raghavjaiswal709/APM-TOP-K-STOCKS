import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockData } from '../stock/entities/stock.entity';
import { Companies } from '../watchlist/entities/companies.entity';
import { DailyWatchlist } from '../watchlist/entities/daily-watchlist.entity';
import { DailyWatchlistMetrics } from '../watchlist/entities/daily-watchlist-metrics.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_DATABASE || 'company_hist_db',
      entities: [
        StockData,
        Companies,
        DailyWatchlist,
        DailyWatchlistMetrics
      ],
      synchronize: false,
      ssl: false,
      logging: true,
      retryAttempts: 3,
      retryDelay: 3000,
      autoLoadEntities: true,
    }),
  ],
})
export class DatabaseModule {}
