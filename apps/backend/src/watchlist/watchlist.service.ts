import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import * as moment from 'moment';

export interface Company {
  company_code: string;           
  name: string;                 
  exchange: string;             
  total_valid_days?: number;      
  avg_daily_high_low?: number;
  median_daily_volume?: number;
  avg_trading_ratio?: number;
  N1_Pattern_count?: number;
  avg_daily_high_low_range?: number;
  avg_daily_volume?: number;
  avg_trading_capital?: number;
  instrument_token?: string;
  tradingsymbol?: string;
}

@Injectable()
export class WatchlistService {
  private readonly basePath = path.resolve(process.cwd(), 'data', 'watchlists');

  async getWatchlistData(watchlist: string, date?: string): Promise<Company[]> {
    return new Promise((resolve, reject) => {
      const targetDate = date || moment().format('YYYY-MM-DD');
      
      const fileName = `watchlist_${watchlist}_${targetDate}.csv`;
      const filePath = path.join(this.basePath, fileName);
      
      console.log(`Attempting to read watchlist from: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        console.error(`Watchlist file not found: ${filePath}`);
        return reject(new NotFoundException(`Watchlist ${watchlist} not found for date ${targetDate}`));
      }
      
      const results: Company[] = [];
      
      fs.createReadStream(filePath)
        .pipe(parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }))
        .on('data', (data) => {
          const cleanData: Company = {
            company_code: String(data.company_code).trim(),
            name: String(data.name || data.tradingsymbol || '').trim(),
            exchange: String(data.exchange || 'NSE').trim(),
            // Map new CSV fields
            total_valid_days: data.total_valid_days ? Number(data.total_valid_days) : undefined,
            avg_daily_high_low: data.avg_daily_high_low ? Number(data.avg_daily_high_low) : undefined,
            median_daily_volume: data.median_daily_volume ? Number(data.median_daily_volume) : undefined,
            avg_trading_ratio: data.avg_trading_ratio ? Number(data.avg_trading_ratio) : undefined,
            N1_Pattern_count: data.N1_Pattern_count ? Number(data.N1_Pattern_count) : undefined,
            // Legacy fields for backward compatibility
            avg_daily_high_low_range: data.avg_daily_high_low_range ? Number(data.avg_daily_high_low_range) : undefined,
            avg_daily_volume: data.avg_daily_volume ? Number(data.avg_daily_volume) : undefined,
            avg_trading_capital: data.avg_trading_capital ? Number(data.avg_trading_capital) : undefined,
            instrument_token: data.instrument_token,
            tradingsymbol: data.tradingsymbol,
          };
          
          results.push(cleanData);
        })
        .on('end', () => {
          console.log(`Successfully loaded ${results.length} companies from watchlist ${watchlist}`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`Error reading watchlist CSV: ${error}`);
          reject(error);
        });
    });
  }

  async getAllCompaniesWithExchange(watchlist: string, date?: string): Promise<Company[]> {
    const companies = await this.getWatchlistData(watchlist, date);
    
    // Filter and enhance companies with exchange information
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
    
    return fs.existsSync(filePath);
  }
}
