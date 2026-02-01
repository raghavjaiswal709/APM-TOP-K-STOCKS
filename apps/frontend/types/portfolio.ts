// Portfolio Types for Trading System

export type TradeType = 'BUY' | 'SELL';
export type TradeStatus = 'OPEN' | 'CLOSED' | 'PARTIAL';
export type PositionStatus = 'HOLDING' | 'EXITED';

// Individual trade entry
export interface Trade {
  id: string;
  companyCode: string;
  companyName: string;
  exchange: string;
  
  // Trade details
  tradeType: TradeType;
  shares: number;
  pricePerShare: number;
  totalValue: number;
  
  // Timestamps
  entryTime: string; // ISO timestamp
  exitTime?: string; // ISO timestamp (for SELL trades or closed positions)
  
  // Context
  day: string; // e.g., "Monday Jan-19"
  date: string; // ISO date string YYYY-MM-DD
  
  // Optional notes/recommendation
  recommendation?: string;
  notes?: string;
}

// Position in portfolio (aggregated trades for same stock)
export interface Position {
  id: string;
  companyCode: string;
  companyName: string;
  exchange: string;
  
  // Current state
  status: PositionStatus;
  shares: number;
  avgEntryPrice: number;
  totalInvested: number;
  
  // Current/exit values
  currentPrice?: number;
  exitPrice?: number;
  currentValue?: number;
  
  // P&L
  unrealizedPnL?: number;
  realizedPnL?: number;
  percentReturn?: number;
  
  // Timestamps
  firstEntryDate: string;
  lastUpdateDate: string;
  exitDate?: string;
  
  // Trade history
  trades: Trade[];
}

// Daily summary
export interface DailySummary {
  date: string;
  day: string; // e.g., "Monday Jan-19"
  
  // Trades
  newTrades: number;
  closedTrades: number;
  
  // Financial
  totalInvested: number;
  netPnL: number;
  totalPnL: number;
  avgPercentReturn: number;
  
  // Benchmark comparison
  niftyOpen?: number;
  niftyClose?: number;
  niftyPercentReturn?: number;
  
  // Positions snapshot
  activePositions: number;
  positions: Position[];
}

// Weekly report
export interface WeeklyReport {
  id: string;
  weekLabel: string; // e.g., "Jan 19 - Jan 23"
  startDate: string;
  endDate: string;
  
  // Summary metrics
  totalInvested: number;
  maxInvested: number;
  totalPnL: number;
  avgPercentReturn: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Best/Worst
  bestTrade?: {
    companyCode: string;
    percentReturn: number;
    pnL: number;
  };
  worstTrade?: {
    companyCode: string;
    percentReturn: number;
    pnL: number;
  };
  
  // Benchmark comparison
  niftyAvgReturn?: number;
  outperformance?: number; // vs NIFTY
  
  // K0 Recommendation comparison
  k0TotalPnL?: number;
  k0AvgReturn?: number;
  
  // Daily breakdown
  dailySummaries: DailySummary[];
}

// Monthly report
export interface MonthlyReport {
  id: string;
  month: string; // e.g., "January 2026"
  year: number;
  monthNumber: number;
  
  // Summary metrics
  totalInvested: number;
  maxInvested: number;
  totalPnL: number;
  avgPercentReturn: number;
  
  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Weekly breakdown
  weeklyReports: WeeklyReport[];
  
  // Sector/Stock breakdown
  stockBreakdown: {
    companyCode: string;
    companyName: string;
    trades: number;
    totalPnL: number;
    avgReturn: number;
  }[];
}

// Portfolio state
export interface Portfolio {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  
  // Current state
  totalValue: number;
  totalInvested: number;
  availableCash: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  
  // Positions
  positions: Position[];
  
  // All trades
  trades: Trade[];
}

// Trade entry form data
export interface TradeEntry {
  companyCode: string;
  companyName: string;
  exchange: string;
  tradeType: TradeType;
  shares: number;
  pricePerShare: number;
  timestamp: string;
  recommendation?: string;
  notes?: string;
}

// Portfolio mode state for market-data page
export interface PortfolioModeState {
  enabled: boolean;
  currentPosition?: Position;
  lastTradePrice?: number;
  pendingAction?: 'IN' | 'OUT';
}

// Chart data for visualizations
export interface PnLChartData {
  date: string;
  dailyPnL: number;
  cumulativePnL: number;
  invested: number;
  niftyReturn?: number;
}

export interface TradeHistoryChartData {
  date: string;
  trades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface PositionDistribution {
  companyCode: string;
  value: number;
  percentage: number;
  pnL: number;
}
