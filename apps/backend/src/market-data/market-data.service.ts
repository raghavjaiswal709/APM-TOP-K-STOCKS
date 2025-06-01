
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
    this.logger.debug(`Updated market data for ${symbol}`);
  }

  getMarketData(symbol: string) {
    return this.marketData.get(symbol) || null;
  }

  isMarketCurrentlyOpen(): boolean {
    const today = new Date().getDay();
    if (today === 0 || today === 6) {
      this.logger.warn('Today is a weekend. Markets are closed.');
      return false;
    }
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 100 + minutes;
    
    if (currentTime < 915 || currentTime > 1530) {
      this.logger.warn('Outside market hours (9:15 AM - 3:30 PM IST). Real-time data may not be available.');
      return false;
    }
    
    return true;
  }
}
