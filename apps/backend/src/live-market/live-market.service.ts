import { Injectable, Logger } from '@nestjs/common';
import { WatchlistService } from '../watchlist/watchlist.service';
import { SubscribeCompaniesDto, UnsubscribeDto } from './dto/live-market.dto';

@Injectable()
export class LiveMarketService {
  private readonly logger = new Logger(LiveMarketService.name);
  private readonly MAX_COMPANIES = 6;

  constructor(private readonly watchlistService: WatchlistService) {}

  async getAvailableCompanies(watchlist: string = 'A') {
    try {
      const companies = await this.watchlistService.getWatchlistData(watchlist);
      
      const availableCompanies = companies.map(company => ({
        company_code: company.company_code,
        name: company.name,
        exchange: company.exchange,
        marker: company.marker,
        symbol: `${company.exchange}:${company.company_code}-${company.marker}`,
        metadata: {
          total_valid_days: company.total_valid_days,
          avg_daily_high_low_range: company.avg_daily_high_low_range,
          median_daily_volume: company.median_daily_volume,
          pe_ratio: company.pe_ratio
        }
      }));

      return {
        success: true,
        companies: availableCompanies,
        total: availableCompanies.length,
        maxSelection: this.MAX_COMPANIES,
        watchlist
      };
    } catch (error) {
      this.logger.error(`Error fetching available companies: ${error.message}`);
      return {
        success: false,
        error: error.message,
        companies: [],
        total: 0,
        maxSelection: this.MAX_COMPANIES,
        watchlist
      };
    }
  }

  getMarketStatus() {
    const now = new Date();
    const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
    
    const marketOpen = new Date(istNow);
    marketOpen.setHours(9, 15, 0, 0);
    
    const marketClose = new Date(istNow);
    marketClose.setHours(15, 30, 0, 0);
    
    const isWeekend = istNow.getDay() === 0 || istNow.getDay() === 6;
    const isMarketHours = !isWeekend && istNow >= marketOpen && istNow <= marketClose;

    return {
      current_time: istNow.toISOString(),
      market_open: marketOpen.toISOString(),
      market_close: marketClose.toISOString(),
      is_trading_hours: isMarketHours,
      is_weekend: isWeekend,
      timezone: 'Asia/Kolkata'
    };
  }

  async subscribeToCompanies(subscribeDto: SubscribeCompaniesDto) {
    try {
      const { companyCodes, clientId } = subscribeDto;

      if (!Array.isArray(companyCodes)) {
        throw new Error('companyCodes must be an array');
      }

      if (companyCodes.length === 0) {
        throw new Error('At least 1 company must be selected');
      }

      if (companyCodes.length > this.MAX_COMPANIES) {
        throw new Error(`Maximum ${this.MAX_COMPANIES} companies allowed`);
      }

      // Validate company codes exist in watchlist
      const availableCompanies = await this.getAvailableCompanies();

      // Solution 1: Check the 'success' property before accessing 'companies'
      if (!availableCompanies.success) {
        throw new Error(`Failed to get available companies: ${availableCompanies.error}`);
      }

      const validCompanyCodes = availableCompanies.companies.map(c => c.company_code);

      const invalidCodes = companyCodes.filter(code => !validCompanyCodes.includes(code));
      if (invalidCodes.length > 0) {
        throw new Error(`Invalid company codes: ${invalidCodes.join(', ')}`);
      }

      // Build symbols
      const symbols = companyCodes.map(code => {
        const company = (availableCompanies.companies as any[]).find(c => c.company_code === code);

        return company?.symbol;
      }).filter(Boolean);

      return {
        success: true,
        message: `Subscribed to ${symbols.length} companies`,
        symbols,
        companyCodes,
        clientId
      };
    } catch (error) {
      this.logger.error(`Error subscribing to companies: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async unsubscribeFromCompanies(unsubscribeDto: UnsubscribeDto) {
    try {
      const { clientId } = unsubscribeDto;

      return {
        success: true,
        message: 'Unsubscribed from all companies',
        clientId
      };
    } catch (error) {
      this.logger.error(`Error unsubscribing: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getHistoricalData(symbol: string, date?: string) {
    try {
      // This would typically fetch from your data source
      // For now, return a placeholder response
      return {
        success: true,
        symbol,
        date: date || new Date().toISOString().split('T')[0],
        data: [],
        message: 'Historical data endpoint - connect to your data source'
      };
    } catch (error) {
      this.logger.error(`Error fetching historical data: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
