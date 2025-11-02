// types/chartTypes.ts
export interface DataPoint {
  ltp: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  sma20?: number;
  ema9?: number;
  rsi14?: number;
  bid?: number;
  ask?: number;
  buyVolume?: number;
  sellVolume?: number;
}

export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
}

export interface ChartUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  changePercent: number;
}

export interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
  chartUpdates: ChartUpdate[];
  updateFrequency?: number;
  tradingHours: {
    start: string;
    end: string;
    current: string;
    isActive: boolean;
  };
}

export interface ShowIndicators {
  sma20: boolean;
  ema9: boolean;
  rsi: boolean;
  macd: boolean;
  bb: boolean;
  vwap: boolean;
  volume: boolean;
}

export interface ColorTheme {
  bg: string;
  paper: string;
  text: string;
  grid: string;
  line: string;
  upColor: string;
  downColor: string;
  button: {
    bg: string;
    bgActive: string;
    text: string;
  };
  indicator: {
    sma20: string;
    ema9: string;
    rsi: string;
    macd: string;
    bb: string;
    vwap: string;
    bid: string;
    ask: string;
    spread: string;
    buyVolume: string;
    sellVolume: string;
    buyPrice: string;
    sellPrice: string;
    buySellSpread: string;
    volume: string;
    std: string;
  };
}
