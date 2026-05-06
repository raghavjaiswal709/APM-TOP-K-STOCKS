import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistController } from './watchlist.controller';
import { WatchlistService } from './watchlist.service';
import { CompanyMasterService } from './company-master.service';
import { SectorService } from './sector.service';
import { Companies } from './entities/companies.entity';
import { DailyWatchlist } from './entities/daily-watchlist.entity';
import { DailyWatchlistMetrics } from './entities/daily-watchlist-metrics.entity';
import { WatchlistQuant } from './entities/watchlist-quant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Companies,
      DailyWatchlist,
      DailyWatchlistMetrics,
      WatchlistQuant,
    ])
  ],
  controllers: [WatchlistController],
  providers: [WatchlistService, CompanyMasterService, SectorService],
  exports: [WatchlistService, CompanyMasterService, SectorService],
})
export class WatchlistModule {}
