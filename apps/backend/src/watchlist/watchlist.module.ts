import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { Companies } from './entities/companies.entity';
import { DailyWatchlist } from './entities/daily-watchlist.entity';
import { DailyWatchlistMetrics } from './entities/daily-watchlist-metrics.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Companies,
      DailyWatchlist,
      DailyWatchlistMetrics
    ])
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService],
  exports: [WatchlistService],
})
export class WatchlistModule {}
