import { Module } from '@nestjs/common';
import { LiveMarketController } from './live-market.controller';
import { LiveMarketService } from './live-market.service';
import { LiveMarketGateway } from './websocket/live-market.gateway';
import { WatchlistModule } from '../watchlist/watchlist.module';

@Module({
  imports: [WatchlistModule],
  controllers: [LiveMarketController],
  providers: [LiveMarketService, LiveMarketGateway],
  exports: [LiveMarketService],
})
export class LiveMarketModule {}
