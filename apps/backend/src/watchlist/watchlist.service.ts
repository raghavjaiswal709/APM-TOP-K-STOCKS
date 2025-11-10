import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Companies } from './entities/companies.entity';
import { DailyWatchlist } from './entities/daily-watchlist.entity';
import { DailyWatchlistMetrics } from './entities/daily-watchlist-metrics.entity';
import { CompanyMasterService } from './company-master.service';
import * as moment from 'moment';

export interface MergedCompany {
  company_id: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  total_valid_days?: number;
  marker?: string;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  latest_close_price?: number;
  pe_ratio?: number;
  suggested_capital_deployment?: number;
  hourly_median_volume?: number;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    @InjectRepository(Companies)
    private companiesRepository: Repository<Companies>,
    
    @InjectRepository(DailyWatchlist)
    private dailyWatchlistRepository: Repository<DailyWatchlist>,
    
    @InjectRepository(DailyWatchlistMetrics)
    private dailyWatchlistMetricsRepository: Repository<DailyWatchlistMetrics>,
    
    private companyMasterService: CompanyMasterService,
  ) {}

  /**
   * Get all available dates from daily_watchlist
   */
  async getAvailableDates(): Promise<string[]> {
    try {
      const dates = await this.dailyWatchlistRepository
        .createQueryBuilder('dw')
        .select('DISTINCT dw.watchlistDate', 'date')
        .orderBy('dw.watchlistDate', 'DESC')
        .getRawMany();

      return dates.map(d => moment(d.date).format('YYYY-MM-DD'));
    } catch (error) {
      this.logger.error(`Error fetching available dates:`, error);
      return [];
    }
  }

  /**
   * Get watchlist companies for a specific date with merged metrics
   */
  async getWatchlistData(date?: string, refinedFilter?: boolean): Promise<MergedCompany[]> {
    const targetDate = date ? moment(date).format('YYYY-MM-DD') : moment().format('YYYY-MM-DD');
    
    try {
      this.logger.log(`Fetching watchlist for date ${targetDate}, refined filter: ${refinedFilter}`);

      // Build where clause with optional refined filter
      const whereClause: any = { watchlistDate: new Date(targetDate) };
      if (refinedFilter !== undefined) {
        whereClause.refined = refinedFilter;
      }

      // Get watchlist entries for the date
      let watchlistEntries = await this.dailyWatchlistRepository.find({
        where: whereClause
      });

      // If no data, try fallback dates
      if (watchlistEntries.length === 0) {
        this.logger.warn(`No data found for ${targetDate}, trying fallback dates`);
        const fallbackDates = this.generateFallbackDates(targetDate);
        
        for (const fallbackDate of fallbackDates) {
          const fallbackWhereClause: any = { watchlistDate: new Date(fallbackDate) };
          if (refinedFilter !== undefined) {
            fallbackWhereClause.refined = refinedFilter;
          }
          
          watchlistEntries = await this.dailyWatchlistRepository.find({
            where: fallbackWhereClause
          });

          if (watchlistEntries.length > 0) {
            this.logger.log(`Using fallback date: ${fallbackDate}`);
            break;
          }
        }
      }

      if (watchlistEntries.length === 0) {
        this.logger.warn(`No watchlist data found`);
        return [];
      }

      // Get company IDs
      const companyIds = [...new Set(watchlistEntries.map(e => e.companyId))];

      // Fetch companies info
      const companies = await this.companiesRepository.find({
        where: { companyId: In(companyIds) }
      });

      // Fetch metrics
      const metrics = await this.dailyWatchlistMetricsRepository.find({
        where: {
          watchlistDate: watchlistEntries[0].watchlistDate,
          companyId: In(companyIds)
        }
      });

      // Merge all data
      const mergedData: MergedCompany[] = watchlistEntries.map(entry => {
        const company = companies.find(c => c.companyId === entry.companyId);
        const metric = metrics.find(m => m.companyId === entry.companyId);
        
        // Get marker from CSV company_master.csv
        const companyCode = company?.companyCode || entry.companyCode;
        const marker = this.companyMasterService.getMarker(companyCode, entry.exchange);
        
        this.logger.debug(`Company ${companyCode} (${entry.exchange}): marker from CSV = ${marker}`);

        return {
          company_id: entry.companyId,
          company_code: companyCode,
          name: company?.name || entry.companyCode,
          exchange: entry.exchange,
          marker: marker, // ✅ Get marker from CSV via CompanyMasterService
          refined: entry.refined,
          total_valid_days: metric?.totalValidDays,
          avg_daily_high_low_range: metric?.avgDailyHighLowRange,
          median_daily_volume: metric?.medianDailyVolume,
          avg_trading_capital: metric?.avgTradingCapital,
          latest_close_price: metric?.latestClosePrice,
          pe_ratio: metric?.peRatio,
          suggested_capital_deployment: metric?.suggestedCapitalDeployment,
          hourly_median_volume: metric?.hourlyMedianVolume
        };
      });

      this.logger.log(`Successfully merged ${mergedData.length} companies (refined filter: ${refinedFilter !== undefined ? refinedFilter : 'ALL'})`);
      return mergedData.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
      this.logger.error(`Error loading watchlist:`, error);
      throw new NotFoundException(`Failed to load watchlist: ${error.message}`);
    }
  }

  /**
   * Get companies with exchange and refined filter
   */
  async getAllCompaniesWithExchange(
    date?: string,
    exchange?: string,
    refinedFilter?: boolean,
  ): Promise<MergedCompany[]> {
    const companies = await this.getWatchlistData(date, refinedFilter);
    
    if (!exchange) return companies;

    const exchanges = exchange.split(',').map(ex => ex.trim().toUpperCase());
    return companies.filter(company => 
      exchanges.includes(company.exchange.toUpperCase())
    );
  }

  /**
   * Check if watchlist exists for a date
   */
  async checkWatchlistExists(date?: string): Promise<boolean> {
    const targetDate = date || moment().format('YYYY-MM-DD');
    
    try {
      const count = await this.dailyWatchlistRepository.count({
        where: { watchlistDate: new Date(targetDate) }
      });

      if (count > 0) return true;

      // Check fallback dates
      const fallbackDates = this.generateFallbackDates(targetDate);
      for (const fallbackDate of fallbackDates) {
        const fallbackCount = await this.dailyWatchlistRepository.count({
          where: { watchlistDate: new Date(fallbackDate) }
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
   * Get available exchanges
   */
  async getAvailableExchanges(date?: string): Promise<string[]> {
    try {
      const targetDate = date || moment().format('YYYY-MM-DD');
      const exchanges = await this.dailyWatchlistRepository
        .createQueryBuilder('dw')
        .select('DISTINCT dw.exchange', 'exchange')
        .where('dw.watchlistDate = :date', { date: new Date(targetDate) })
        .getRawMany();

      return exchanges.map(e => e.exchange);
    } catch (error) {
      this.logger.error('Error fetching exchanges:', error);
      return [];
    }
  }

  /**
   * Get company by code
   */
  async getCompanyByCode(companyCode: string, exchange?: string): Promise<MergedCompany | null> {
    try {
      let company: Companies | null;

      if (exchange) {
        company = await this.companiesRepository.findOne({
          where: {
            companyCode: companyCode.toUpperCase(),
            exchange: exchange.toUpperCase()
          }
        });
      } else {
        const companies = await this.companiesRepository.find({
          where: { companyCode: companyCode.toUpperCase() }
        });
        company = companies.length > 0 ? companies[0] : null;
      }

      if (!company) return null;

      return {
        company_id: company.companyId,
        company_code: company.companyCode,
        name: company.name,
        exchange: company.exchange
      };
    } catch (error) {
      this.logger.error(`Error fetching company by code:`, error);
      return null;
    }
  }

  /**
   * Get company metrics for specific date
   */
  async getCompanyMetrics(companyCode: string, exchange: string, date: string): Promise<DailyWatchlistMetrics | null> {
    try {
      const company = await this.companiesRepository.findOne({
        where: {
          companyCode: companyCode.toUpperCase(),
          exchange: exchange.toUpperCase()
        }
      });

      if (!company) return null;

      const metrics = await this.dailyWatchlistMetricsRepository.findOne({
        where: {
          companyId: company.companyId,
          watchlistDate: new Date(date)
        }
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Error fetching metrics:`, error);
      return null;
    }
  }

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
        queryBuilder.where('UPPER(c.exchange) IN (:...exchanges)', {
          exchanges,
        });
      }

      const companies = await queryBuilder.orderBy('c.name', 'ASC').getMany();

      const mergedData: MergedCompany[] = companies.map((company) => {
        // Get marker from CSV company_master.csv
        const marker = this.companyMasterService.getMarker(company.companyCode, company.exchange);
        
        return {
          company_id: company.companyId,
          company_code: company.companyCode,
          name: company.name,
          exchange: company.exchange,
          marker: marker, // ✅ Get marker from CSV via CompanyMasterService
        };
      });

      this.logger.log(
        `Successfully fetched ${mergedData.length} companies from companies table`,
      );
      return mergedData;
    } catch (error) {
      this.logger.error('Error loading companies from companies table:', error);
      throw new NotFoundException(`Failed to load companies: ${error.message}`);
    }
  }
}
