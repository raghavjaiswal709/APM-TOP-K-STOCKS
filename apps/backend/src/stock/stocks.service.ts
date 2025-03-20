import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
      // Path to the Python script using relative path from the service file
      const scriptPath = path.resolve(__dirname, '../../data/data_fetch.py');
      
      // Construct command with parameters
      const command = `python ${scriptPath} --company_id=${params.companyId} --start_date="${params.startDate.toISOString()}" --end_date="${params.endDate.toISOString()}" --interval=${params.interval}`;

      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          return reject(new InternalServerErrorException('Failed to fetch stock data'));
        }
      });
      
      console.log(`Executing command: ${command}`);
      
      // Execute the command
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          return reject(new InternalServerErrorException('Failed to fetch stock data'));
        }
        
        if (stderr) {
          console.error(`Python script stderr: ${stderr}`);
        }
        
        try {
          // Parse the output into our DTO format
          const lines = stdout.trim().split('\n');
          const results: StockDataDto[] = [];
          
          for (const line of lines) {
            if (line.startsWith('Interval:')) {
              // Parse line format: "Interval: 2024-02-28 10:10:00, Open: 51.4, High: 51.4, Low: 51.4, Close: 51.4, Volume: 9175.0"
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
          resolve(results);
        } catch (parseError) {
          console.error(`Error parsing Python script output: ${parseError}`);
          reject(new InternalServerErrorException('Failed to parse stock data'));
        }
      });
    });
  }
}
