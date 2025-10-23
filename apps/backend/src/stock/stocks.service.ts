import { Injectable, InternalServerErrorException, RequestTimeoutException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockData } from './entities/stock.entity';
import { StockDataDto, StockDataRequestDto } from './dto/stock-data.dto';
import { exec } from 'child_process';
import * as path from 'path';

interface CacheEntry {
  data: StockDataDto[];
  timestamp: number;
  startDate: Date;
  endDate: Date;
  interval: string;
  companyCode: string;
}

interface DataGap {
  start: Date;
  end: Date;
  type: 'before' | 'after' | 'within';
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);
  private readonly dataCache = new Map<string, CacheEntry>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
  private readonly maxCacheSize = 100; // Maximum cache entries
  private readonly pendingRequests = new Map<string, Promise<StockDataDto[]>>();

  constructor(
    @InjectRepository(StockData)
    private stockRepository: Repository<StockData>,
  ) {
    setInterval(() => this.cleanupCache(), 60 * 1000); // Every minute
  }

 
  async getTop5Companies() {
    return this.stockRepository
      .createQueryBuilder('stock')
      .select('stock.company_code', 'companyCode')
      .addSelect('stock.exchange', 'exchange')
      .addSelect('AVG(stock.close)', 'averageClose')
      .where('stock.exchange IN (:...exchanges)', { exchanges: ['NSE', 'BSE'] })
      .groupBy('stock.company_code, stock.exchange')
      .orderBy('"averageClose"', 'DESC')
      .limit(5)
      .getRawMany();
  }

  async getCompanyHistory(companyCode: string, exchange?: string) {
    const queryBuilder = this.stockRepository
      .createQueryBuilder('stock')
      .where('stock.company_code = :companyCode', { companyCode });
    
    if (exchange) {
      queryBuilder.andWhere('stock.exchange = :exchange', { exchange });
    } else {
      queryBuilder.andWhere('stock.exchange IN (:...exchanges)', { exchanges: ['NSE', 'BSE'] });
    }
    
    return queryBuilder
      .orderBy('stock.date', 'ASC')
      .getMany();
  }


  async getStockDataFromPython(params: StockDataRequestDto): Promise<StockDataDto[]> {
    try {
      this.validateRequest(params);
      
      const startTime = Date.now();
      this.logger.log(`Fetching stock data for ${params.companyCode} from ${params.startDate} to ${params.endDate}`);

      const cachedData = this.getCachedData(params);
      if (cachedData) {
        this.logger.log(`Serving data from cache for ${params.companyCode}`);
        return cachedData;
      }

      const requestKey = this.generateRequestKey(params);
      const pendingRequest = this.pendingRequests.get(requestKey);
      if (pendingRequest) {
        this.logger.log(`Request already pending for ${requestKey}, waiting...`);
        return await pendingRequest;
      }

      const dataPromise = this.executeStockDataFetch(params);
      this.pendingRequests.set(requestKey, dataPromise);

      try {
        const data = await dataPromise;
        
        this.setCachedData(params, data);
        
        this.logger.log(`Successfully fetched ${data.length} data points for ${params.companyCode} in ${Date.now() - startTime}ms`);
        return data;
        
      } finally {
        this.pendingRequests.delete(requestKey);
      }

    } catch (error) {
      this.logger.error(`Error fetching stock data for ${params.companyCode}:`, error);
      throw error;
    }
  }


  private async executeStockDataFetch(params: StockDataRequestDto): Promise<StockDataDto[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(__dirname, '../../data/data_fetch.py');

      let command = `python ${scriptPath} --company_code=${params.companyCode} --interval=${params.interval}`;

      if (params.exchange) {
        command += ` --exchange=${params.exchange}`;
      } else {
        command += ` --exchange=NSE,BSE`;
      }

      /**
       * CRITICAL: Date handling for IST timezone
       * The Python script expects naive datetime strings in IST timezone.
       * Format: "YYYY-MM-DD HH:MM:SS"
       * 
       * The dates coming from params are JavaScript Date objects which could be:
       * 1. Already in IST (if frontend sends IST dates)
       * 2. In UTC (if frontend sends ISO strings)
       * 3. In local timezone (if frontend sends local dates)
       * 
       * We need to ensure the dates are correctly interpreted as IST dates.
       */
      const formatDateForPython = (date: Date, hour: number, minute: number): string => {
        // Create a date string treating the input date as IST
        // We extract year, month, day from the Date object and construct an IST datetime
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hourStr}:${minuteStr}:00`;
      };

      if (params.startDate && params.endDate) {
        // Market hours in IST: 9:15 AM to 3:45 PM
        const startStr = formatDateForPython(params.startDate, 9, 15);
        const endStr = formatDateForPython(params.endDate, 15, 45);

        this.logger.log(`Date range requested: ${params.startDate.toDateString()} to ${params.endDate.toDateString()}`);
        this.logger.log(`Sending to Python: start="${startStr}", end="${endStr}"`);

        command += ` --start_date="${startStr}" --end_date="${endStr}"`;
        command += ' --optimize_for_range=true';

        const bufferMinutes = this.getBufferMinutes(params.interval);
        command += ` --buffer_minutes=${bufferMinutes}`;

        if (params.firstFifteenMinutes) {
          command += ' --first_fifteen_minutes=true';
        }
      } else {
        command += ' --fetch_all_data=true';
        command += ' --limit=2500';
      }

      command += ' --enable_cache=true';
      command += ' --compression=true';
      command += ' --validate_data=true';

      if (params.indicators && params.indicators.length > 0) {
        command += ` --indicators="${params.indicators.join(',')}"`;
      }

      this.logger.debug(`Executing optimized command: ${command}`);

      const timeout = this.getTimeoutForRange(params);

      const timeoutId = setTimeout(() => {
        this.logger.error(`Python script execution timed out after ${timeout}ms`);
        reject(new RequestTimeoutException('Data fetch request timed out. Please try a smaller date range.'));
      }, timeout);

      const childProcess = exec(command, {
        maxBuffer: 1024 * 1024 * 100,
        timeout: timeout,
        cwd: path.resolve(__dirname, '../../data')
      }, (error, stdout, stderr) => {
        clearTimeout(timeoutId);

        if (error) {
          this.logger.error(`Python script execution failed: ${error.message}`);

          if (typeof error.code === 'string' && error.code === 'ENOENT') {
            return reject(new InternalServerErrorException('Python environment not configured properly'));
          }

          if (error.signal === 'SIGTERM') {
            return reject(new RequestTimeoutException('Request was cancelled due to timeout'));
          }

          return reject(new InternalServerErrorException(`Failed to fetch stock data: ${error.message}`));
        }

        if (stderr) {
          const lines = stderr.split('\n').filter(line => line.trim());

          const actualErrors: string[] = [];
          const warnings: string[] = [];
          const infoMessages: string[] = [];

          for (const line of lines) {
            const lowerLine = line.toLowerCase();

            if (
              lowerLine.includes('error:') ||
              lowerLine.includes('traceback') ||
              lowerLine.includes('exception:') ||
              lowerLine.includes('failed:') ||
              lowerLine.includes('critical:') ||
              lowerLine.includes('database connection failed') ||
              lowerLine.includes('no company found') ||
              lowerLine.startsWith('error ')
            ) {
              actualErrors.push(line);
            } else if (
              lowerLine.includes('warning') ||
              lowerLine.includes('userwarning') ||
              lowerLine.includes('deprecation') ||
              (lowerLine.includes('skipped') && lowerLine.includes('invalid'))
            ) {
              warnings.push(line);
            } else if (
              lowerLine.includes('fetching') ||
              lowerLine.includes('data range:') ||
              lowerLine.includes('successfully') ||
              lowerLine.includes('query executed') ||
              (lowerLine.includes('found') && lowerLine.includes('company')) ||
              lowerLine.includes('looking up') ||
              (lowerLine.includes('applied') && lowerLine.includes('buffer')) ||
              lowerLine.includes('processing') ||
              lowerLine.includes('completed') ||
              lowerLine.includes('data points') ||
              lowerLine.includes('querying') ||
              lowerLine.includes('filtered to') ||
              lowerLine.includes('adjusted for') ||
              lowerLine.includes('records for company') ||
              (lowerLine.includes('in ') && lowerLine.includes('s'))
            ) {
              infoMessages.push(line);
            } else if (line.trim()) {
              warnings.push(line);
            }
          }

          if (infoMessages.length > 0) {
            this.logger.log(`Python script info: ${infoMessages.join('; ')}`);
          }

          if (warnings.length > 0) {
            this.logger.warn(`Python script warnings: ${warnings.join('; ')}`);
          }

          if (actualErrors.length > 0) {
            this.logger.error(`Python script errors: ${actualErrors.join('; ')}`);
            return reject(new InternalServerErrorException('Data processing failed with errors'));
          }
        }

        try {
          const results = this.parseOptimizedOutput(stdout, params);

          if (results.length === 0) {
            this.logger.warn(`No data found for ${params.companyCode} in the specified range`);
            return resolve([]);
          }

          const processedResults = this.processAndValidateData(results, params);

          this.logger.log(`Successfully processed ${processedResults.length} data points for ${params.companyCode}`);
          resolve(processedResults);

        } catch (parseError) {
          this.logger.error(`Error parsing Python script output:`, parseError);
          this.logger.debug(`Raw stdout: ${stdout.substring(0, 1000)}...`);
          reject(new InternalServerErrorException('Failed to parse stock data. Data format may be invalid.'));
        }
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.logger.error(`Child process error: ${error.message}`);
        reject(new InternalServerErrorException(`Data fetch process failed: ${error.message}`));
      });

      childProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          this.logger.error(`Python script exited with code ${code}`);
        }
        if (signal) {
          this.logger.warn(`Python script terminated by signal ${signal}`);
        }
      });
    });
  }

  
  private parseOptimizedOutput(stdout: string, params: StockDataRequestDto): StockDataDto[] {
    const lines = stdout.trim().split('\n');
    const results: StockDataDto[] = [];
    let errorCount = 0;
    const maxErrors = 10; 
    
    for (const line of lines) {
      if (line.startsWith('Interval:')) {
        try {
          const parts = line.split(',');
          
          if (parts.length < 6) {
            throw new Error(`Insufficient data fields: expected 6, got ${parts.length}`);
          }
          
          const intervalPart = parts[0].replace('Interval:', '').trim();
          const openPart = parseFloat(parts[1].replace('Open:', '').trim());
          const highPart = parseFloat(parts[2].replace('High:', '').trim());
          const lowPart = parseFloat(parts[3].replace('Low:', '').trim());
          const closePart = parseFloat(parts[4].replace('Close:', '').trim());
          const volumePart = parts[5] ? parseFloat(parts[5].replace('Volume:', '').trim()) : 0;
          
          if (isNaN(openPart) || isNaN(highPart) || isNaN(lowPart) || isNaN(closePart)) {
            throw new Error('Invalid numeric values detected');
          }
          
          if (highPart < Math.max(openPart, closePart) || lowPart > Math.min(openPart, closePart)) {
            throw new Error('Invalid OHLC relationship');
          }
          
          const timestamp = new Date(intervalPart);
          if (isNaN(timestamp.getTime())) {
            throw new Error('Invalid timestamp format');
          }
          
          // Note: Date filtering is already done in Python, but we keep this as safety
          if (params.startDate && params.endDate) {
            // Create date-only comparison to avoid time-of-day issues
            const timestampDateOnly = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
            const startDateOnly = new Date(params.startDate.getFullYear(), params.startDate.getMonth(), params.startDate.getDate());
            const endDateOnly = new Date(params.endDate.getFullYear(), params.endDate.getMonth(), params.endDate.getDate());
            
            if (timestampDateOnly < startDateOnly || timestampDateOnly > endDateOnly) {
              continue; 
            }
          }
          
          results.push({
            interval_start: timestamp,
            open: this.roundToDecimalPlaces(openPart, 2),
            high: this.roundToDecimalPlaces(highPart, 2),
            low: this.roundToDecimalPlaces(lowPart, 2),
            close: this.roundToDecimalPlaces(closePart, 2),
            volume: Math.max(0, Math.round(volumePart)), 
          });
          
        } catch (err) {
          errorCount++;
          this.logger.warn(`Skipping invalid data line (${errorCount}/${maxErrors}): ${line.substring(0, 100)} - Error: ${(err as Error).message}`);
          
          if (errorCount >= maxErrors) {
            throw new Error(`Too many parsing errors (${errorCount}). Data quality may be poor.`);
          }
        }
      } else if (line.startsWith('ERROR:') || line.startsWith('FATAL:')) {
        throw new Error(`Python script error: ${line}`);
      }
    }
    
    if (errorCount > 0) {
      this.logger.warn(`Parsed data with ${errorCount} errors for ${params.companyCode}`);
    }
    
    return results;
  }

 
  private processAndValidateData(data: StockDataDto[], params: StockDataRequestDto): StockDataDto[] {
    if (data.length === 0) return data;
    
    data.sort((a, b) => a.interval_start.getTime() - b.interval_start.getTime());
    
    const uniqueData = data.filter((item, index, array) => 
      index === 0 || item.interval_start.getTime() !== array[index - 1].interval_start.getTime()
    );
    
    if (params.firstFifteenMinutes && uniqueData.length > 0) {
      const startTime = new Date(uniqueData[0].interval_start);
      const endTime = new Date(startTime.getTime() + 15 * 60 * 1000); 
      
      const filteredResults = uniqueData.filter(item => {
        const itemTime = new Date(item.interval_start);
        return itemTime >= startTime && itemTime <= endTime;
      });
      
      this.logger.log(`Filtered to first 15 minutes: ${filteredResults.length} data points`);
      return filteredResults;
    }
    
    const gaps = this.detectDataGaps(uniqueData, params.interval);
    if (gaps.length > 0) {
      this.logger.warn(`Detected ${gaps.length} data gaps for ${params.companyCode}`);
    }
    
    return uniqueData;
  }

 
  private generateRequestKey(params: StockDataRequestDto): string {
    const dateKey = params.startDate && params.endDate 
      ? `${params.startDate.getTime()}-${params.endDate.getTime()}`
      : 'all';
    
    const firstFifteenKey = params.firstFifteenMinutes ? '_first15' : '';
    const indicatorsKey = params.indicators?.length > 0 ? `_${params.indicators.join(',')}` : '';
    
    return `${params.companyCode}_${params.interval}_${params.exchange || 'NSE-BSE'}_${dateKey}${firstFifteenKey}${indicatorsKey}`;
  }

  private getCachedData(params: StockDataRequestDto): StockDataDto[] | null {
    const key = this.generateRequestKey(params);
    const cached = this.dataCache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.dataCache.delete(key);
      return null;
    }
    
    if (params.startDate && params.endDate) {
      if (cached.startDate > params.startDate || cached.endDate < params.endDate) {
        return null; 
      }
    }
    
    return cached.data;
  }

  private setCachedData(params: StockDataRequestDto, data: StockDataDto[]): void {
    if (data.length === 0) return;
    
    const key = this.generateRequestKey(params);
    
    if (this.dataCache.size >= this.maxCacheSize) {
      const oldestKey = this.dataCache.keys().next().value;
      this.dataCache.delete(oldestKey);
    }
    
    const cacheEntry: CacheEntry = {
      data,
      timestamp: Date.now(),
      startDate: params.startDate || data[0].interval_start,
      endDate: params.endDate || data[data.length - 1].interval_start,
      interval: params.interval,
      companyCode: params.companyCode
    };
    
    this.dataCache.set(key, cacheEntry);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.dataCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.dataCache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  private detectDataGaps(data: StockDataDto[], interval: string): DataGap[] {
    if (data.length < 2) return [];
    
    const gaps: DataGap[] = [];
    const expectedInterval = this.getIntervalInMs(interval);
    
    for (let i = 1; i < data.length; i++) {
      const timeDiff = data[i].interval_start.getTime() - data[i-1].interval_start.getTime();
      
      if (timeDiff > expectedInterval * 1.5) { 
        gaps.push({
          start: data[i-1].interval_start,
          end: data[i].interval_start,
          type: 'within'
        });
      }
    }
    
    return gaps;
  }

  private validateRequest(params: StockDataRequestDto): void {
    if (!params.companyCode) {
      throw new BadRequestException('Company code is required');
    }
    
    if (!params.interval) {
      throw new BadRequestException('Interval is required');
    }
    
    if (params.startDate && params.endDate) {
      // Compare only the date parts, not the time
      const startDateOnly = new Date(params.startDate.getFullYear(), params.startDate.getMonth(), params.startDate.getDate());
      const endDateOnly = new Date(params.endDate.getFullYear(), params.endDate.getMonth(), params.endDate.getDate());
      
      if (startDateOnly > endDateOnly) {
        throw new BadRequestException('Start date must be before or equal to end date');
      }
    }
    
    if (params.startDate && params.endDate) {
      const daysDiff = (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24);
      const maxDays = this.getMaxDaysForInterval(params.interval);
      
      if (daysDiff > maxDays) {
        throw new BadRequestException(`Date range too large for interval ${params.interval}. Maximum ${maxDays} days allowed.`);
      }
    }
  }

  private getBufferMinutes(interval: string): number {
    const bufferMap: { [key: string]: number } = {
      '1m': 15,
      '5m': 60,
      '15m': 180,
      '1h': 720,
      '1d': 1440
    };
    return bufferMap[interval] || 30;
  }

  private getTimeoutForRange(params: StockDataRequestDto): number {
    const baseTimeout = 60000; 
    
    if (!params.startDate || !params.endDate) {
      return 300000; 
    }
    
    const daysDiff = (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(Math.min(baseTimeout + (daysDiff * 2000), 300000));
  }

  private getMaxDaysForInterval(interval: string): number {
    const maxDaysMap: { [key: string]: number } = {
      '1m': 365,
      '5m': 365,
      '15m': 365,
      '1h': 365,
      '1d': 1825 // 5 years
    };
    return maxDaysMap[interval] || 30;
  }

  private getIntervalInMs(interval: string): number {
    const intervalMap: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervalMap[interval] || 60 * 1000;
  }

  private roundToDecimalPlaces(value: number, places: number): number {
    return Math.round(value * Math.pow(10, places)) / Math.pow(10, places);
  }

  public clearCache(): void {
    this.dataCache.clear();
    this.pendingRequests.clear();
    this.logger.log('Stock data cache and pending requests cleared');
  }

  public getCacheStats(): any {
    return {
      size: this.dataCache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.dataCache.entries()).map(([key, entry]) => ({
        key,
        companyCode: entry.companyCode,
        interval: entry.interval,
        dataPoints: entry.data.length,
        age: Date.now() - entry.timestamp,
        dateRange: `${entry.startDate.toISOString()} - ${entry.endDate.toISOString()}`
      }))
    };
  }

  async getIncrementalData(
    companyCode: string,
    startDate: Date,
    endDate: Date,
    interval: string,
    exchange?: string,
    indicators: string[] = []
  ): Promise<StockDataDto[]> {
    const params: StockDataRequestDto = {
      companyCode,
      startDate,
      endDate,
      interval,
      exchange,
      firstFifteenMinutes: false,
      indicators
    };

    return this.getStockDataFromPython(params);
  }
}