import { Injectable, InternalServerErrorException, RequestTimeoutException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockData } from './entities/stock.entity';
import { StockDataDto, StockDataRequestDto } from './dto/stock-data.dto';
import { exec } from 'child_process';
import * as path from 'path';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockData)
    private stockRepository: Repository<StockData>,
  ) {}

  async getTop5Companies() {
    return this.stockRepository
      .createQueryBuilder('stock')
      .select('stock.company_code', 'companyCode')
      .addSelect('AVG(stock.close)', 'averageClose')
      .groupBy('stock.company_code')
      .orderBy('"averageClose"', 'DESC')
      .limit(5)
      .getRawMany();
  }

  async getCompanyHistory(companyCode: any) {
    return this.stockRepository.find({
      where: { company_code: companyCode },
      order: { date: 'ASC' },
    });
  }

  async getStockDataFromPython(params: StockDataRequestDto): Promise<StockDataDto[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(__dirname, '../../data/data_fetch.py');
      
      // **KEY FIX**: Build command based on whether dates are provided
      let command = `python ${scriptPath} --company_id=${params.companyId} --interval=${params.interval}`;
      
      // Only add date parameters if they exist
      if (params.startDate && params.endDate) {
        command += ` --start_date="${params.startDate.toISOString()}" --end_date="${params.endDate.toISOString()}"`;
        
        // Add first fifteen minutes flag
        if (params.firstFifteenMinutes) {
          command += ' --first_fifteen_minutes=true';
        }
      } else {
        // **NEW**: Add flag to fetch all available data
        command += ' --fetch_all_data=true';
      }
      
      console.log(`Executing command: ${command}`);
      
      const timeout = 300000;
      
      const timeoutId = setTimeout(() => {
        reject(new RequestTimeoutException('Python script execution timed out after 5 minutes'));
      }, timeout);
      
      const childProcess = exec(command, { 
        maxBuffer: 1024 * 1024 * 50,
        timeout: timeout
      }, (error, stdout, stderr) => {
        clearTimeout(timeoutId);
        
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          return reject(new InternalServerErrorException(`Failed to fetch stock data: ${error.message}`));
        }
        
        if (stderr) {
          console.error(`Python script stderr: ${stderr}`);
        }
        
        try {
          const lines = stdout.trim().split('\n');
          const results: StockDataDto[] = [];
          
          for (const line of lines) {
            if (line.startsWith('Interval:')) {
              const parts = line.split(',');
              const intervalPart = parts[0].replace('Interval:', '').trim();
              const openPart = parts[1].replace('Open:', '').trim();
              const highPart = parts[2].replace('High:', '').trim();
              const lowPart = parts[3].replace('Low:', '').trim();
              const closePart = parts[4].replace('Close:', '').trim();
              const volumePart = parts[5].replace('Volume:', '').trim();
              
              results.push({
                interval_start: new Date(intervalPart),
                open: parseFloat(openPart),
                high: parseFloat(highPart),
                low: parseFloat(lowPart),
                close: parseFloat(closePart),
                volume: parseFloat(volumePart),
              });
            }
          }
          
          console.log(`Successfully parsed ${results.length} data points`);
          
          // Filter to first 15 minutes if requested
          if (params.firstFifteenMinutes && results.length > 0) {
            const startTime = new Date(results[0].interval_start);
            const endTime = new Date(startTime.getTime() + 375 * 60 * 1000); // 15 minutes later
            
            const filteredResults = results.filter(item => {
              const itemTime = new Date(item.interval_start);
              return itemTime >= startTime && itemTime <= endTime;
            });
            
            console.log(`Filtered to first 15 minutes: ${filteredResults.length} data points`);
            resolve(filteredResults);
          } else {
            resolve(results);
          }
        } catch (parseError) {
          console.error(`Error parsing Python script output: ${parseError}`);
          reject(new InternalServerErrorException('Failed to parse stock data'));
        }
      });
      
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        console.error(`Child process error: ${error.message}`);
        reject(new InternalServerErrorException(`Child process error: ${error.message}`));
      });
    });
  }
}
