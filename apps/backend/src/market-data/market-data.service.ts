// import { Injectable, Logger } from '@nestjs/common';
// import * as fs from 'fs';
// import * as path from 'path';

// @Injectable()
// export class MarketDataService {
//   private readonly logger = new Logger(MarketDataService.name);
//   private marketData = new Map<string, any>();

//   getAccessToken(): string {
//     try {
//       const tokenPath = path.join(process.cwd(), 'data', 'access_token.json');
      
//       if (fs.existsSync(tokenPath)) {
//         const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        
//         if (tokenData.expiry && new Date(tokenData.expiry) > new Date()) {
//           this.logger.log('Using existing access token');
//           return tokenData.token;
//         }
//       }
      
//       this.logger.error('No valid access token found. Please run fyers-auth.js first.');
//       throw new Error('Missing Fyers access token');
//     } catch (error) {
//       this.logger.error('Error reading token file:', error.message);
//       throw new Error('Failed to get access token');
//     }
//   }

//   updateMarketData(symbol: string, data: any) {
//     this.marketData.set(symbol, data);
//   }

//   getMarketData(symbol: string) {
//     return this.marketData.get(symbol) || null;
//   }

//   isMarketCurrentlyOpen(): boolean {
//     // Check if today is a weekend (Saturday = 6, Sunday = 0)
//     const today = new Date().getDay();
//     if (today === 0 || today === 6) {
//       this.logger.warn('Today is a weekend. Markets are closed.');
//       return false;
//     }
    
//     // Check if current time is within market hours (9:15 AM to 3:30 PM IST)
//     const now = new Date();
//     const hours = now.getHours();
//     const minutes = now.getMinutes();
//     const currentTime = hours * 100 + minutes;
    
//     // Market hours: 9:15 AM (915) to 3:30 PM (1530)
//     if (currentTime < 915 || currentTime > 1530) {
//       this.logger.warn('Outside market hours (9:15 AM - 3:30 PM IST). Real-time data may not be available.');
//       return false;
//     }
    
//     return true;
//   }
// }


import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private marketData = new Map<string, any>();

  getAccessToken(): string {
    const token = process.env.FYERS_ACCESS_TOKEN;
    if (!token) {
      this.logger.error('FYERS_ACCESS_TOKEN is not defined in environment');
      throw new Error('Missing Fyers access token');
    }
    return token;
  }

  updateMarketData(symbol: string, data: any) {
    this.marketData.set(symbol, data);
    // Log the data being stored
    this.logger.debug(`Updated market data for ${symbol}`);
  }

  getMarketData(symbol: string) {
    return this.marketData.get(symbol) || null;
  }

  isMarketCurrentlyOpen(): boolean {
    // Check if today is a weekend (Saturday = 6, Sunday = 0)
    const today = new Date().getDay();
    if (today === 0 || today === 6) {
      this.logger.warn('Today is a weekend. Markets are closed.');
      return false;
    }
    
    // Check if current time is within market hours (9:15 AM to 3:30 PM IST)
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    // Market hours: 9:15 AM (915) to 3:30 PM (1530)
    if (currentTime < 915 || currentTime > 1530) {
      this.logger.warn('Outside market hours (9:15 AM - 3:30 PM IST). Real-time data may not be available.');
      return false;
    }
    
    return true;
  }
}
