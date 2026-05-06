import { Controller, Get, Param, Query } from '@nestjs/common';
import { WatchlistService, MergedCompany } from './watchlist.service';
import { SectorService } from './sector.service';

@Controller('api/watchlist')
export class WatchlistController {
  constructor(
    private readonly watchlistService: WatchlistService,
    private readonly sectorService: SectorService,
  ) {}

  /**
   * Get full sector mapping { SYMBOL: sector }
   * GET /api/watchlist/sectors
   */
  @Get('sectors')
  getSectors(): Record<string, string> {
    return this.sectorService.getAllSectors();
  }

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
   * @param date - The date to fetch watchlist for (YYYY-MM-DD)
   * @param exchange - Comma-separated list of exchanges (e.g., 'NSE,BSE')
   * NOTE: refined param removed — watchlist_quant table has no refined column
   */
  @Get()
  async getWatchlist(
    @Query('date') date?: string,
    @Query('exchange') exchange?: string,
    // OLD: refined param removed — not in watchlist_quant
    // @Query('refined') refinedParam?: string,
  ): Promise<{ companies: MergedCompany[], exists: boolean, total: number, date: string }> {
    try {
      // OLD: refined filter parsing removed
      // let refinedFilter: boolean | undefined;
      // if (refinedParam === 'true') {
      //   refinedFilter = true;
      // } else if (refinedParam === 'false') {
      //   refinedFilter = false;
      // }

      const companies = await this.watchlistService.getAllCompaniesWithExchange(
        date,
        exchange,
        // OLD: refinedFilter removed
      );

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
   * Get all companies from companies table (not date-specific)
   * GET /api/watchlist/all-companies?exchange=NSE,BSE
   * NOTE: This must come BEFORE company/:companyCode to avoid route conflicts
   */
  @Get('all-companies')
  async getAllCompanies(
    @Query('exchange') exchange?: string,
  ): Promise<{ companies: MergedCompany[]; total: number }> {
    try {
      const companies =
        await this.watchlistService.getAllCompaniesFromMaster(exchange);

      console.log(
        `Retrieved ${companies.length} companies from companies table for exchanges: ${exchange || 'ALL'}`,
      );
      return {
        companies,
        total: companies.length,
      };
    } catch (error) {
      console.error(`Error fetching all companies:`, error);
      return {
        companies: [],
        total: 0,
      };
    }
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

  // OLD ENDPOINT — removed: getCompanyMetrics used DailyWatchlistMetrics which is replaced by watchlist_quant
  // @Get('company/:companyCode/metrics')
  // async getCompanyMetrics(
  //   @Param('companyCode') companyCode: string,
  //   @Query('exchange') exchange: string,
  //   @Query('date') date: string,
  // ): Promise<{ data: any }> {
  //   const data = await this.watchlistService.getCompanyMetrics(companyCode, exchange, date);
  //   return { data };
  // }
}
