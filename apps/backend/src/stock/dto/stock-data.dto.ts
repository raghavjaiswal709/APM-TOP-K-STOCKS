export class StockDataRequestDto {
  companyCode: string;  
  exchange?: string;
  startDate?: Date;
  endDate?: Date;
  interval: string;
  indicators: string[];
  firstFifteenMinutes?: boolean;
}

export class StockDataDto {
  interval_start: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
