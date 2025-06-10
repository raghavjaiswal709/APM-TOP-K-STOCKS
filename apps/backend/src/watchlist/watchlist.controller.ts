import { Controller, Get, Param, Query, Post } from '@nestjs/common';
import { WatchlistService, MergedCompany } from './watchlist.service';

@Controller('api/watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get(':watchlist')
  async getWatchlist(
    @Param('watchlist') watchlist: string,
    @Query('date') date?: string,
    @Query('exchange') exchange?: string,
  ): Promise<{ companies: MergedCompany[], exists: boolean, total: number }> {
    try {
      const allCompanies = await this.watchlistService.getAllCompaniesWithExchange(watchlist, date);
      
      // Filter by exchange if specified
      let companies = allCompanies;
      if (exchange) {
        const exchanges = exchange.split(',').map(ex => ex.trim().toUpperCase());
        companies = allCompanies.filter(company => 
          exchanges.includes(company.exchange.toUpperCase())
        );
      }
      
      console.log(`Retrieved ${companies.length} companies from watchlist ${watchlist} for exchanges: ${exchange || 'ALL'}`);
      return { 
        companies, 
        exists: true, 
        total: companies.length 
      };
    } catch (error) {
      console.error(`Error fetching watchlist ${watchlist}:`, error);
      return { 
        companies: [], 
        exists: false, 
        total: 0 
      };
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

  @Get(':watchlist/exchanges')
  async getWatchlistExchanges(
    @Param('watchlist') watchlist: string,
    @Query('date') date?: string,
  ): Promise<{ exchanges: string[] }> {
    try {
      const companies = await this.watchlistService.getWatchlistData(watchlist, date);
      const exchanges = [...new Set(companies.map(c => c.exchange).filter(Boolean))];
      return { exchanges };
    } catch (error) {
      return { exchanges: [] };
    }
  }

  @Get()
  async getAvailableWatchlists(): Promise<{ watchlists: string[] }> {
    const watchlists = await this.watchlistService.getAvailableWatchlists();
    return { watchlists };
  }

  @Get('company/:companyCode')
  async getCompanyByCode(
    @Param('companyCode') companyCode: string,
    @Query('exchange') exchange?: string,
  ): Promise<{ company: MergedCompany | null }> {
    const company = await this.watchlistService.getCompanyByCode(companyCode, exchange);
    return { company };
  }

  @Post('refresh-cache')
  async refreshCache(): Promise<{ message: string }> {
    await this.watchlistService.refreshCompanyMasterCache();
    return { message: 'Company master cache refreshed successfully' };
  }
}
