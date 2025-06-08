export class MarketDataDto {
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
  }
  
  export class HistoricalDataRequestDto {
    symbol: string;
    resolution: string;
    from: string;
    to: string;
  }
  
  export class SubscriptionDto {
    symbol: string;
  }
  