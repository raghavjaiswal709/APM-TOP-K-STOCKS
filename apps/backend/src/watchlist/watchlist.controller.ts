import { Controller, Get, Param, Query } from '@nestjs/common';
import { WatchlistService, MergedCompany } from './watchlist.service';

@Controller('api/watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  /**
   * Get available dates
   * GET /api/watchlist/dates
   */
  @Get('dates')
  async getAvailableDates(): Promise<{ dates: string[] }> {
    const dates = await this.watchlistService.getAvailableDates();
    return { dates };
  }

  /**
   * Get watchlist companies
   * GET /api/watchlist?date=YYYY-MM-DD&exchange=NSE,BSE
   * 
   * Note: Since your DB doesn't have A/B/C concept, we removed that parameter
   */
  @Get()
  async getWatchlist(
    @Query('date') date?: string,
    @Query('exchange') exchange?: string,
  ): Promise<{ companies: MergedCompany[], exists: boolean, total: number, date: string }> {
    try {
      const companies = await this.watchlistService.getAllCompaniesWithExchange(date, exchange);
      
      console.log(`Retrieved ${companies.length} companies for exchanges: ${exchange || 'ALL'}`);
      return { 
        companies, 
        exists: true, 
        total: companies.length,
        date: date || new Date().toISOString().split('T')[0]
      };
    } catch (error) {
      console.error(`Error fetching watchlist:`, error);
      return { 
        companies: [], 
        exists: false, 
        total: 0,
        date: date || new Date().toISOString().split('T')[0]
      };
    }
  }

  /**
   * Check if watchlist exists for date
   * GET /api/watchlist/check?date=YYYY-MM-DD
   */
  @Get('check')
  async checkWatchlist(
    @Query('date') date?: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.watchlistService.checkWatchlistExists(date);
    return { exists };
  }

  /**
   * Get available exchanges
   * GET /api/watchlist/exchanges?date=YYYY-MM-DD
   */
  @Get('exchanges')
  async getWatchlistExchanges(
    @Query('date') date?: string,
  ): Promise<{ exchanges: string[] }> {
    const exchanges = await this.watchlistService.getAvailableExchanges(date);
    return { exchanges };
  }

  /**
   * Get company by code
   * GET /api/watchlist/company/:companyCode?exchange=NSE
   */
  @Get('company/:companyCode')
  async getCompanyByCode(
    @Param('companyCode') companyCode: string,
    @Query('exchange') exchange?: string,
  ): Promise<{ company: MergedCompany | null }> {
    const company = await this.watchlistService.getCompanyByCode(companyCode, exchange);
    return { company };
  }

  /**
   * Get company metrics
   * GET /api/watchlist/company/:companyCode/metrics?exchange=NSE&date=YYYY-MM-DD
   */
  @Get('company/:companyCode/metrics')
  async getCompanyMetrics(
    @Param('companyCode') companyCode: string,
    @Query('exchange') exchange: string,
    @Query('date') date: string,
  ): Promise<{ data: any }> {
    const data = await this.watchlistService.getCompanyMetrics(companyCode, exchange, date);
    return { data };
  }
}
