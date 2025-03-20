// src/watchlist/watchlist.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse';
import * as moment from 'moment';

export interface Company {
  company_code: string;
  avg_daily_high_low_range: number;
  avg_daily_volume: number;
  avg_trading_capital: number;
  instrument_token: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
}

@Injectable()
export class WatchlistService {
  private readonly basePath = path.resolve(process.cwd(), 'data', 'watchlists');

  async getWatchlistData(watchlist: string, date?: string): Promise<Company[]> {
    return new Promise((resolve, reject) => {
      // Use today's date if not provided
      const targetDate = date || moment().format('YYYY-MM-DD');
      
      // Construct the file path
      const fileName = `watchlist_${watchlist}_${targetDate}.csv`;
      const filePath = path.join(this.basePath, fileName);
      
      console.log(`Attempting to read from: ${filePath}`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return reject(new NotFoundException(`Watchlist ${watchlist} not found for date ${targetDate}`));
      }
      
      const results: Company[] = [];
      
      // Create readable stream to process CSV
      fs.createReadStream(filePath)
        .pipe(parse({
          delimiter: ',',
          columns: true,
          skip_empty_lines: true,
        }))
        .on('data', (data) => {
          results.push(data);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async checkWatchlistExists(watchlist: string, date?: string): Promise<boolean> {
    const targetDate = date || moment().format('YYYY-MM-DD');
    const fileName = `watchlist_${watchlist}_${targetDate}.csv`;
    const filePath = path.join(this.basePath, fileName);
    
    return fs.existsSync(filePath);
  }
}
