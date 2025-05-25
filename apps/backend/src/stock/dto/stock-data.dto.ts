export class StockDataRequestDto {
  companyId: number;
  startDate?: Date; // Made optional
  endDate?: Date;   // Made optional
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
