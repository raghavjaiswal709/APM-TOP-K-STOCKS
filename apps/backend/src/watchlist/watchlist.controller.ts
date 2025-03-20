// src/watchlist/watchlist.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { WatchlistService, Company } from './watchlist.service';

@Controller('api/watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get(':watchlist')
  async getWatchlist(
    @Param('watchlist') watchlist: string,
    @Query('date') date?: string,
  ): Promise<{ companies: Company[], exists: boolean }> {
    try {
      const companies = await this.watchlistService.getWatchlistData(watchlist, date);
      return { companies, exists: true };
    } catch (error) {
      return { companies: [], exists: false };
    }
  }

  @Get(':watchlist/check')
  async checkWatchlist(
    @Param('watchlist') watchlist: string,
    @Query('date') date?: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.watchlistService.checkWatchlistExists(watchlist, date);
    return { exists };
  }
}
