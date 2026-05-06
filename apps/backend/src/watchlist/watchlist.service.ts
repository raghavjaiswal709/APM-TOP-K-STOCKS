import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Companies } from './entities/companies.entity';
// OLD IMPORTS (commented out - replaced by watchlist_quant table)
// import { DailyWatchlist } from './entities/daily-watchlist.entity';
// import { DailyWatchlistMetrics } from './entities/daily-watchlist-metrics.entity';
// import { In } from 'typeorm';
import { WatchlistQuant } from './entities/watchlist-quant.entity';
import { CompanyMasterService } from './company-master.service';
import * as moment from 'moment';

export interface MergedCompany {
  company_id: number;
  company_code: string;
  name: string;
  exchange: string;
  // REMOVED: refined is not present in watchlist_quant
  // refined?: boolean;
  marker?: string;
  // NEW fields from watchlist_quant
  rank?: number;
  last_close?: number;
  median_daily_tv_10d?: number;
  atr_pct_10d?: number;
  iv_10d?: number;
  vol_rank_xs?: number;
  dist_from_high_20d?: number;
  vol_ratio_t1_vs_10d?: number;
  median_tradable_ratio_10d?: number;
  min_tradable_ratio_10d?: number;
  median_p25_window_tv_10d?: number;
  max_position_inr?: number;
  days_capital_data?: number;
  pe_ratio?: number;
  // OLD fields (commented out - no longer available from watchlist_quant)
  // total_valid_days?: number;
  // avg_daily_high_low_range?: number;
  // median_daily_volume?: number;
  // avg_trading_capital?: number;
  // latest_close_price?: number;
  // suggested_capital_deployment?: number;
  // hourly_median_volume?: number;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    @InjectRepository(Companies)
    private companiesRepository: Repository<Companies>,

    // OLD REPOSITORIES (commented out - replaced by watchlist_quant)
    // @InjectRepository(DailyWatchlist)
    // private dailyWatchlistRepository: Repository<DailyWatchlist>,
    //
    // @InjectRepository(DailyWatchlistMetrics)
    // private dailyWatchlistMetricsRepository: Repository<DailyWatchlistMetrics>,

    @InjectRepository(WatchlistQuant)
    private watchlistQuantRepository: Repository<WatchlistQuant>,

    private companyMasterService: CompanyMasterService,
  ) {}

  /**
   * Get all available dates from watchlist_quant
   * OLD: queried daily_watchlist
   */
  async getAvailableDates(): Promise<string[]> {
    try {
      const dates = await this.watchlistQuantRepository
        .createQueryBuilder('wq')
        .select('DISTINCT wq.watchlistDate', 'date')
        .orderBy('wq.watchlistDate', 'DESC')
        .getRawMany();

      return dates.map(d => moment(d.date).format('YYYY-MM-DD'));
    } catch (error) {
      this.logger.error(`Error fetching available dates:`, error);
      return [];
    }
  }

  /**
   * Get watchlist companies for a specific date from watchlist_quant
   * OLD: queried daily_watchlist + daily_watchlist_metrics + companies tables
   * NEW: single query to watchlist_quant (contains name, exchange, all metrics inline)
   * NOTE: refined filter removed — watchlist_quant has no refined column
   */
  async getWatchlistData(
    date?: string,
    // OLD: refinedFilter removed — not present in watchlist_quant
    // refinedFilter?: boolean,
  ): Promise<MergedCompany[]> {
    const targetDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');

    try {
      this.logger.log(`Fetching watchlist_quant for date ${targetDate}`);

      let entries = await this.watchlistQuantRepository.find({
        where: { watchlistDate: new Date(targetDate) },
        order: { rank: 'ASC' },
      });

      // If no data, try fallback dates
      if (entries.length === 0) {
        this.logger.warn(`No data found for ${targetDate} in watchlist_quant, trying fallback dates`);
        const fallbackDates = this.generateFallbackDates(targetDate);

        for (const fallbackDate of fallbackDates) {
          entries = await this.watchlistQuantRepository.find({
            where: { watchlistDate: new Date(fallbackDate) },
            order: { rank: 'ASC' },
          });

          if (entries.length > 0) {
            this.logger.log(`Using fallback date: ${fallbackDate}`);
            break;
          }
        }
      }

      if (entries.length === 0) {
        this.logger.warn(`No watchlist_quant data found`);
        return [];
      }

      // Map directly — watchlist_quant already contains name, exchange, all metrics
      const mergedData: MergedCompany[] = entries.map(entry => {
        // Try to get marker from company master CSV (not in watchlist_quant schema)
        const marker = this.companyMasterService.getMarker(
          entry.companyCode,
          entry.exchange || '',
        ) || 'EQ';

        return {
          company_id: entry.companyId,
          company_code: entry.companyCode,
          name: entry.name || entry.companyCode,
          exchange: entry.exchange || '',
          marker,
          rank: entry.rank,
          last_close: entry.lastClose ?? undefined,
          median_daily_tv_10d: entry.medianDailyTv10d ?? undefined,
          atr_pct_10d: entry.atrPct10d ?? undefined,
          iv_10d: entry.iv10d ?? undefined,
          vol_rank_xs: entry.volRankXs ?? undefined,
          dist_from_high_20d: entry.distFromHigh20d ?? undefined,
          vol_ratio_t1_vs_10d: entry.volRatioT1vs10d ?? undefined,
          median_tradable_ratio_10d: entry.medianTradableRatio10d ?? undefined,
          min_tradable_ratio_10d: entry.minTradableRatio10d ?? undefined,
          median_p25_window_tv_10d: entry.medianP25WindowTv10d ?? undefined,
          max_position_inr: entry.maxPositionInr ?? undefined,
          days_capital_data: entry.daysCapitalData ?? undefined,
          pe_ratio: entry.peRatio ?? undefined,
        };
      });

      this.logger.log(`✅ Loaded ${mergedData.length} companies from watchlist_quant for ${targetDate}`);
      return mergedData;

    } catch (error) {
      this.logger.error(`Error loading watchlist_quant:`, error);
      throw new NotFoundException(`Failed to load watchlist: ${error.message}`);
    }
  }

  /**
   * Get companies with exchange filter
   * OLD: accepted refinedFilter param — removed, not in watchlist_quant
   */
  async getAllCompaniesWithExchange(
    date?: string,
    exchange?: string,
    // OLD: refinedFilter removed — not present in watchlist_quant
    // refinedFilter?: boolean,
  ): Promise<MergedCompany[]> {
    const companies = await this.getWatchlistData(date);

    if (!exchange) return companies;

    const exchanges = exchange.split(',').map(ex => ex.trim().toUpperCase());
    return companies.filter(company =>
      exchanges.includes(company.exchange.toUpperCase())
    );
  }

  /**
   * Check if watchlist exists for a date (now uses watchlist_quant)
   */
  async checkWatchlistExists(date?: string): Promise<boolean> {
    const targetDate = date || moment().format('YYYY-MM-DD');

    try {
      const count = await this.watchlistQuantRepository.count({
        where: { watchlistDate: new Date(targetDate) },
      });

      if (count > 0) return true;

      // Check fallback dates
      const fallbackDates = this.generateFallbackDates(targetDate);
      for (const fallbackDate of fallbackDates) {
        const fallbackCount = await this.watchlistQuantRepository.count({
          where: { watchlistDate: new Date(fallbackDate) },
        });
        if (fallbackCount > 0) return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking watchlist existence:`, error);
      return false;
    }
  }

  /**
   * Get available exchanges (now uses watchlist_quant)
   */
  async getAvailableExchanges(date?: string): Promise<string[]> {
    try {
      const targetDate = date || moment().format('YYYY-MM-DD');
      const exchanges = await this.watchlistQuantRepository
        .createQueryBuilder('wq')
        .select('DISTINCT wq.exchange', 'exchange')
        .where('wq.watchlistDate = :date', { date: new Date(targetDate) })
        .getRawMany();

      return exchanges.map(e => e.exchange).filter(Boolean);
    } catch (error) {
      this.logger.error('Error fetching exchanges:', error);
      return [];
    }
  }

  /**
   * Get company by code (still uses companies table)
   */
  async getCompanyByCode(companyCode: string, exchange?: string): Promise<MergedCompany | null> {
    try {
      let company: Companies | null;

      if (exchange) {
        company = await this.companiesRepository.findOne({
          where: {
            companyCode: companyCode.toUpperCase(),
            exchange: exchange.toUpperCase(),
          },
        });
      } else {
        const companies = await this.companiesRepository.find({
          where: { companyCode: companyCode.toUpperCase() },
        });
        company = companies.length > 0 ? companies[0] : null;
      }

      if (!company) return null;

      const marker =
        company.marker ||
        this.companyMasterService.getMarker(company.companyCode, company.exchange) ||
        'EQ';

      return {
        company_id: company.companyId,
        company_code: company.companyCode,
        name: company.name,
        exchange: company.exchange,
        marker,
      };
    } catch (error) {
      this.logger.error(`Error fetching company by code:`, error);
      return null;
    }
  }

  // OLD METHOD (commented out — DailyWatchlistMetrics no longer used)
  // async getCompanyMetrics(companyCode: string, exchange: string, date: string): Promise<DailyWatchlistMetrics | null> {
  //   ...
  // }

  /**
   * Generate fallback dates (last 10 days)
   */
  private generateFallbackDates(targetDate: string): string[] {
    const date = moment(targetDate);
    const fallbacks: string[] = [];

    for (let i = 1; i <= 10; i++) {
      fallbacks.push(date.clone().subtract(i, 'days').format('YYYY-MM-DD'));
    }

    return fallbacks;
  }

  /**
   * Get all companies from company_master (not date-specific)
   */
  async getAllCompaniesFromMaster(exchange?: string): Promise<MergedCompany[]> {
    try {
      this.logger.log('Fetching all companies from companies table');

      const queryBuilder = this.companiesRepository.createQueryBuilder('c');

      if (exchange) {
        const exchanges = exchange
          .split(',')
          .map((ex) => ex.trim().toUpperCase());
        queryBuilder.where('UPPER(c.exchange) IN (:...exchanges)', { exchanges });
      }

      const companies = await queryBuilder.orderBy('c.name', 'ASC').getMany();

      const mergedData: MergedCompany[] = companies.map((company) => {
        const marker =
          company.marker ||
          this.companyMasterService.getMarker(company.companyCode, company.exchange) ||
          'EQ';

        return {
          company_id: company.companyId,
          company_code: company.companyCode,
          name: company.name,
          exchange: company.exchange,
          marker,
        };
      });

      this.logger.log(`Successfully fetched ${mergedData.length} companies from companies table`);
      return mergedData;
    } catch (error) {
      this.logger.error('Error loading companies from companies table:', error);
      throw new NotFoundException(`Failed to load companies: ${error.message}`);
    }
  }
}


