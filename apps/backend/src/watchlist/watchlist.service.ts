import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import * as moment from 'moment';

export interface CompanyMaster {
  company_id: number;
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
}

export interface CompanyData {
  company_code: string;
  name: string;
  exchange: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  pe_ratio?: number;
  N1_Pattern_count?: number;
}

export interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  pe_ratio?: number;
  N1_Pattern_count?: number;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);
  private readonly basePath = path.resolve(process.cwd(), 'data', 'watchlists');
  private readonly masterDataPath = path.resolve(process.cwd(), 'data', 'company_master.csv');
  
  private companyMasterCache: CompanyMaster[] = [];
  private cacheLastUpdated: number = 0;
  private readonly cacheValidityMs = 30 * 60 * 1000;

  async getWatchlistData(watchlist: string, date?: string): Promise<MergedCompany[]> {
    const targetDate = date || moment().format('YYYY-MM-DD');
    
    try {
      const companyMaster = await this.loadCompanyMaster();
      const watchlistData = await this.loadWatchlistCSV(watchlist, targetDate);
      const mergedData = this.mergeCompanyData(companyMaster, watchlistData);
      
      this.logger.log(`Merged ${mergedData.length} companies for watchlist ${watchlist}`);
      return mergedData;
      
    } catch (error) {
      this.logger.error(`Error loading watchlist ${watchlist}:`, error);
      throw new NotFoundException(`Failed to load watchlist ${watchlist}: ${error.message}`);
    }
  }

  private async loadCompanyMaster(): Promise<CompanyMaster[]> {
    const now = Date.now();
    if (this.companyMasterCache.length > 0 && (now - this.cacheLastUpdated) < this.cacheValidityMs) {
      return this.companyMasterCache;
    }

    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.masterDataPath)) {
        this.logger.error(`Company master file not found: ${this.masterDataPath}`);
        return reject(new Error('Company master data file not found'));
      }

      const results: CompanyMaster[] = [];

      fs.createReadStream(this.masterDataPath)
        .pipe(parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }))
        .on('data', (data) => {
          try {
            // Handle both possible column name formats
            const company: CompanyMaster = {
              company_id: parseInt(data.company_id) || 0,
              company_code: String(data.company_code || '').trim().toUpperCase(),
              name: String(data['NAME OF COMPANY'] || data.name || '').trim(),
              exchange: String(data.Exchange || data.exchange || 'NSE').trim().toUpperCase(),
              marker: String(data.Marker || data.marker || 'EQ').trim().toUpperCase()
            };

            if (company.company_code && company.name) {
              results.push(company);
              this.logger.debug(`Loaded company: ${company.company_code} - ${company.name}`);
            }
          } catch (error) {
            this.logger.warn(`Skipping invalid company master row: ${JSON.stringify(data)}`);
          }
        })
        .on('end', () => {
          this.companyMasterCache = results;
          this.cacheLastUpdated = Date.now();
          this.logger.log(`Loaded ${results.length} companies from master data`);
          resolve(results);
        })
        .on('error', (error) => {
          this.logger.error(`Error reading company master CSV: ${error}`);
          reject(error);
        });
    });
  }

  private async loadWatchlistCSV(watchlist: string, date: string): Promise<CompanyData[]> {
    const fileName = `watchlist_${watchlist}_${date}.csv`;
    const filePath = path.join(this.basePath, fileName);

    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Watchlist file not found: ${filePath}, trying fallback dates...`);
        
        const fallbackDates = this.generateFallbackDates(date);
        this.tryFallbackDates(watchlist, fallbackDates)
          .then(resolve)
          .catch(reject);
        return;
      }

      const results: CompanyData[] = [];

      fs.createReadStream(filePath)
        .pipe(parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }))
        .on('data', (data) => {
          try {
            const company: CompanyData = {
              company_code: String(data.company_code || '').trim().toUpperCase(),
              name: String(data.name || '').trim(),
              exchange: String(data.exchange || 'NSE').trim().toUpperCase(),
              total_valid_days: data.total_valid_days ? Number(data.total_valid_days) : undefined,
              avg_daily_high_low_range: data.avg_daily_high_low_range ? Number(data.avg_daily_high_low_range) : undefined,
              median_daily_volume: data.median_daily_volume ? Number(data.median_daily_volume) : undefined,
              avg_trading_capital: data.avg_trading_capital ? Number(data.avg_trading_capital) : undefined,
              pe_ratio: data.pe_ratio ? Number(data.pe_ratio) : undefined,
              N1_Pattern_count: data.N1_Pattern_count ? Number(data.N1_Pattern_count) : undefined
            };

            if (company.company_code) {
              results.push(company);
              this.logger.debug(`Loaded watchlist company: ${company.company_code} - ${company.name}`);
            }
          } catch (error) {
            this.logger.warn(`Skipping invalid watchlist row: ${JSON.stringify(data)}`);
          }
        })
        .on('end', () => {
          this.logger.log(`Loaded ${results.length} companies from watchlist CSV: ${fileName}`);
          resolve(results);
        })
        .on('error', (error) => {
          this.logger.error(`Error reading watchlist CSV: ${error}`);
          reject(error);
        });
    });
  }

  private async tryFallbackDates(watchlist: string, fallbackDates: string[]): Promise<CompanyData[]> {
    for (const fallbackDate of fallbackDates) {
      const fileName = `watchlist_${watchlist}_${fallbackDate}.csv`;
      const filePath = path.join(this.basePath, fileName);
      
      if (fs.existsSync(filePath)) {
        this.logger.log(`Using fallback date ${fallbackDate} for watchlist ${watchlist}`);
        return this.loadWatchlistCSV(watchlist, fallbackDate);
      }
    }
    
    throw new Error(`No watchlist data found for ${watchlist} on any fallback dates`);
  }

  private generateFallbackDates(targetDate: string): string[] {
    const date = moment(targetDate);
    const fallbacks: string[] = [];
    
    for (let i = 1; i <= 10; i++) {
      fallbacks.push(date.clone().subtract(i, 'days').format('YYYY-MM-DD'));
    }
    
    return fallbacks;
  }

  private mergeCompanyData(masterData: CompanyMaster[], watchlistData: CompanyData[]): MergedCompany[] {
    const mergedResults: MergedCompany[] = [];
    const masterMap = new Map<string, CompanyMaster[]>();

    // Create a map of master data by company_code
    masterData.forEach(master => {
      const key = master.company_code;
      if (!masterMap.has(key)) {
        masterMap.set(key, []);
      }
      masterMap.get(key)!.push(master);
    });

    this.logger.log(`Master data map has ${masterMap.size} unique company codes`);

    // Merge watchlist data with master data
    watchlistData.forEach(watchlistItem => {
      const masterEntries = masterMap.get(watchlistItem.company_code) || [];
      
      if (masterEntries.length === 0) {
        // No master data found, create entry with default marker
        const merged: MergedCompany = {
          company_code: watchlistItem.company_code,
          name: watchlistItem.name,
          exchange: watchlistItem.exchange,
          marker: 'EQ', // Default marker
          total_valid_days: watchlistItem.total_valid_days,
          avg_daily_high_low_range: watchlistItem.avg_daily_high_low_range,
          median_daily_volume: watchlistItem.median_daily_volume,
          avg_trading_capital: watchlistItem.avg_trading_capital,
          pe_ratio: watchlistItem.pe_ratio,
          N1_Pattern_count: watchlistItem.N1_Pattern_count
        };
        mergedResults.push(merged);
        this.logger.warn(`No master data found for company_code: ${watchlistItem.company_code}`);
      } else {
        // Find exact exchange match or use first available
        let masterEntry = masterEntries.find(m => m.exchange === watchlistItem.exchange);
        if (!masterEntry) {
          masterEntry = masterEntries[0];
        }

        const merged: MergedCompany = {
          company_id: masterEntry.company_id,
          company_code: watchlistItem.company_code,
          name: masterEntry.name || watchlistItem.name,
          exchange: watchlistItem.exchange,
          marker: masterEntry.marker,
          total_valid_days: watchlistItem.total_valid_days,
          avg_daily_high_low_range: watchlistItem.avg_daily_high_low_range,
          median_daily_volume: watchlistItem.median_daily_volume,
          avg_trading_capital: watchlistItem.avg_trading_capital,
          pe_ratio: watchlistItem.pe_ratio,
          N1_Pattern_count: watchlistItem.N1_Pattern_count
        };
        
        mergedResults.push(merged);
        this.logger.debug(`Merged: ${merged.company_code} with marker ${merged.marker}`);
      }
    });

    return mergedResults.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAllCompaniesWithExchange(watchlist: string, date?: string): Promise<MergedCompany[]> {
    const companies = await this.getWatchlistData(watchlist, date);
    
    return companies.filter(company => 
      company.company_code && 
      company.name && 
      company.exchange &&
      ['NSE', 'BSE'].includes(company.exchange.toUpperCase())
    );
  }

  async checkWatchlistExists(watchlist: string, date?: string): Promise<boolean> {
    const targetDate = date || moment().format('YYYY-MM-DD');
    const fileName = `watchlist_${watchlist}_${targetDate}.csv`;
    const filePath = path.join(this.basePath, fileName);
    
    if (fs.existsSync(filePath)) {
      return true;
    }
    
    const fallbackDates = this.generateFallbackDates(targetDate);
    return fallbackDates.some(fallbackDate => {
      const fallbackFileName = `watchlist_${watchlist}_${fallbackDate}.csv`;
      const fallbackPath = path.join(this.basePath, fallbackFileName);
      return fs.existsSync(fallbackPath);
    });
  }

  async getAvailableWatchlists(): Promise<string[]> {
    try {
      const files = fs.readdirSync(this.basePath);
      const watchlistPattern = /^watchlist_([A-Z])_\d{4}-\d{2}-\d{2}\.csv$/;
      const watchlists = new Set<string>();
      
      files.forEach(file => {
        const match = file.match(watchlistPattern);
        if (match) {
          watchlists.add(match[1]);
        }
      });
      
      return Array.from(watchlists).sort();
    } catch (error) {
      this.logger.error('Error reading watchlist directory:', error);
      return [];
    }
  }

  async refreshCompanyMasterCache(): Promise<void> {
    this.companyMasterCache = [];
    this.cacheLastUpdated = 0;
    await this.loadCompanyMaster();
  }

  async getCompanyByCode(companyCode: string, exchange?: string): Promise<MergedCompany | null> {
    const masterData = await this.loadCompanyMaster();
    
    let matches = masterData.filter(company => 
      company.company_code.toUpperCase() === companyCode.toUpperCase()
    );
    
    if (exchange) {
      const exchangeMatch = matches.find(company => 
        company.exchange.toUpperCase() === exchange.toUpperCase()
      );
      if (exchangeMatch) {
        return {
          company_id: exchangeMatch.company_id,
          company_code: exchangeMatch.company_code,
          name: exchangeMatch.name,
          exchange: exchangeMatch.exchange,
          marker: exchangeMatch.marker
        };
      }
    }
    
    if (matches.length > 0) {
      const match = matches[0];
      return {
        company_id: match.company_id,
        company_code: match.company_code,
        name: match.name,
        exchange: match.exchange,
        marker: match.marker
      };
    }
    
    return null;
  }
}
