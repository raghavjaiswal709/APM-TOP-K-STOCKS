// Portfolio Service - handles all portfolio operations with local storage persistence

import {
  Trade,
  Position,
  Portfolio,
  TradeEntry,
  DailySummary,
  WeeklyReport,
  MonthlyReport,
  PnLChartData,
  PositionDistribution,
} from '@/types/portfolio';

const STORAGE_KEY = 'apm_portfolio_data';
const TRADES_KEY = 'apm_portfolio_trades';

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get today's date in IST
const getTodayIST = (): string => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// Get day name
const getDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${months[date.getMonth()]}-${date.getDate()}`;
};

// Parse week number from date
const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

class PortfolioService {
  private trades: Trade[] = [];
  private portfolio: Portfolio | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromStorage();
    }
  }

  // Load data from localStorage
  private loadFromStorage(): void {
    try {
      const tradesData = localStorage.getItem(TRADES_KEY);
      if (tradesData) {
        this.trades = JSON.parse(tradesData);
      }
      const portfolioData = localStorage.getItem(STORAGE_KEY);
      if (portfolioData) {
        this.portfolio = JSON.parse(portfolioData);
      } else {
        this.portfolio = this.createDefaultPortfolio();
        this.saveToStorage();
      }
    } catch (error) {
      console.error('Failed to load portfolio from storage:', error);
      this.trades = [];
      this.portfolio = this.createDefaultPortfolio();
    }
  }

  // Save data to localStorage
  private saveToStorage(): void {
    try {
      localStorage.setItem(TRADES_KEY, JSON.stringify(this.trades));
      if (this.portfolio) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.portfolio));
      }
    } catch (error) {
      console.error('Failed to save portfolio to storage:', error);
    }
  }

  // Create default portfolio
  private createDefaultPortfolio(): Portfolio {
    return {
      id: generateId(),
      name: 'My Portfolio',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalValue: 0,
      totalInvested: 0,
      availableCash: 1000000, // Starting with 10 lakh
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      positions: [],
      trades: [],
    };
  }

  // Get portfolio
  getPortfolio(): Portfolio {
    if (!this.portfolio) {
      this.portfolio = this.createDefaultPortfolio();
    }
    return { ...this.portfolio, trades: [...this.trades] };
  }

  // Get all trades
  getTrades(): Trade[] {
    return [...this.trades];
  }

  // Get trades for a specific company
  getTradesForCompany(companyCode: string): Trade[] {
    return this.trades.filter(t => t.companyCode === companyCode);
  }

  // Get current position for a company
  getPosition(companyCode: string): Position | null {
    const trades = this.getTradesForCompany(companyCode);
    if (trades.length === 0) return null;

    let totalShares = 0;
    let totalCost = 0;
    let realizedPnL = 0;

    const buyTrades: Trade[] = [];
    const sellTrades: Trade[] = [];

    trades.forEach(trade => {
      if (trade.tradeType === 'BUY') {
        buyTrades.push(trade);
        totalShares += trade.shares;
        totalCost += trade.totalValue;
      } else {
        sellTrades.push(trade);
        totalShares -= trade.shares;
        // Calculate realized P&L from sells
        realizedPnL += trade.totalValue - (trade.shares * (totalCost / (totalShares + trade.shares)));
      }
    });

    if (totalShares <= 0) {
      return {
        id: generateId(),
        companyCode,
        companyName: trades[0].companyName,
        exchange: trades[0].exchange,
        status: 'EXITED',
        shares: 0,
        avgEntryPrice: 0,
        totalInvested: 0,
        realizedPnL,
        firstEntryDate: trades[0].date,
        lastUpdateDate: trades[trades.length - 1].date,
        exitDate: trades[trades.length - 1].date,
        trades,
      };
    }

    const avgEntryPrice = totalCost / totalShares;

    return {
      id: generateId(),
      companyCode,
      companyName: trades[0].companyName,
      exchange: trades[0].exchange,
      status: 'HOLDING',
      shares: totalShares,
      avgEntryPrice,
      totalInvested: totalCost,
      realizedPnL,
      firstEntryDate: trades[0].date,
      lastUpdateDate: trades[trades.length - 1].date,
      trades,
    };
  }

  // Get all active positions
  getActivePositions(): Position[] {
    const companySet = new Set(this.trades.map(t => t.companyCode));
    const positions: Position[] = [];

    companySet.forEach(companyCode => {
      const position = this.getPosition(companyCode);
      if (position && position.status === 'HOLDING') {
        positions.push(position);
      }
    });

    return positions;
  }

  // Enter market (BUY)
  enterMarket(entry: TradeEntry): Trade {
    const trade: Trade = {
      id: generateId(),
      companyCode: entry.companyCode,
      companyName: entry.companyName,
      exchange: entry.exchange,
      tradeType: 'BUY',
      shares: entry.shares,
      pricePerShare: entry.pricePerShare,
      totalValue: entry.shares * entry.pricePerShare,
      entryTime: entry.timestamp,
      day: getDayName(entry.timestamp.split('T')[0]),
      date: entry.timestamp.split('T')[0],
      recommendation: entry.recommendation,
      notes: entry.notes,
    };

    this.trades.push(trade);
    this.updatePortfolioState();
    this.saveToStorage();

    return trade;
  }

  // Exit market (SELL)
  exitMarket(entry: TradeEntry): Trade {
    const trade: Trade = {
      id: generateId(),
      companyCode: entry.companyCode,
      companyName: entry.companyName,
      exchange: entry.exchange,
      tradeType: 'SELL',
      shares: entry.shares,
      pricePerShare: entry.pricePerShare,
      totalValue: entry.shares * entry.pricePerShare,
      entryTime: entry.timestamp,
      exitTime: entry.timestamp,
      day: getDayName(entry.timestamp.split('T')[0]),
      date: entry.timestamp.split('T')[0],
      notes: entry.notes,
    };

    this.trades.push(trade);
    this.updatePortfolioState();
    this.saveToStorage();

    return trade;
  }

  // Update portfolio state after trades
  private updatePortfolioState(): void {
    if (!this.portfolio) return;

    const positions = this.getActivePositions();
    let totalInvested = 0;
    let unrealizedPnL = 0;
    let realizedPnL = 0;

    positions.forEach(pos => {
      totalInvested += pos.totalInvested;
      unrealizedPnL += pos.unrealizedPnL || 0;
    });

    // Calculate realized P&L from all closed positions
    const companySet = new Set(this.trades.map(t => t.companyCode));
    companySet.forEach(companyCode => {
      const position = this.getPosition(companyCode);
      if (position) {
        realizedPnL += position.realizedPnL || 0;
      }
    });

    this.portfolio.positions = positions;
    this.portfolio.totalInvested = totalInvested;
    this.portfolio.unrealizedPnL = unrealizedPnL;
    this.portfolio.realizedPnL = realizedPnL;
    this.portfolio.totalPnL = unrealizedPnL + realizedPnL;
    this.portfolio.totalValue = totalInvested + unrealizedPnL;
    this.portfolio.updatedAt = new Date().toISOString();
    this.portfolio.trades = this.trades;
  }

  // Get daily summary
  getDailySummary(date: string): DailySummary {
    const dayTrades = this.trades.filter(t => t.date === date);
    const buyTrades = dayTrades.filter(t => t.tradeType === 'BUY');
    const sellTrades = dayTrades.filter(t => t.tradeType === 'SELL');

    let totalInvested = 0;
    let netPnL = 0;

    buyTrades.forEach(t => {
      totalInvested += t.totalValue;
    });

    sellTrades.forEach(t => {
      // Find corresponding buy for P&L
      const position = this.getPosition(t.companyCode);
      if (position) {
        const avgBuyPrice = position.avgEntryPrice;
        netPnL += (t.pricePerShare - avgBuyPrice) * t.shares;
      }
    });

    return {
      date,
      day: getDayName(date),
      newTrades: buyTrades.length,
      closedTrades: sellTrades.length,
      totalInvested,
      netPnL,
      totalPnL: netPnL,
      avgPercentReturn: totalInvested > 0 ? (netPnL / totalInvested) * 100 : 0,
      activePositions: this.getActivePositions().length,
      positions: this.getActivePositions(),
    };
  }

  // Get weekly report
  getWeeklyReport(startDate: string, endDate: string): WeeklyReport {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dailySummaries: DailySummary[] = [];

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dailySummaries.push(this.getDailySummary(dateStr));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate weekly metrics
    let totalInvested = 0;
    let maxInvested = 0;
    let totalPnL = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    const weekTrades = this.trades.filter(t => {
      const tradeDate = new Date(t.date);
      return tradeDate >= start && tradeDate <= end;
    });

    const sellTrades = weekTrades.filter(t => t.tradeType === 'SELL');
    
    sellTrades.forEach(trade => {
      const position = this.getPosition(trade.companyCode);
      if (position) {
        const pnL = (trade.pricePerShare - position.avgEntryPrice) * trade.shares;
        totalPnL += pnL;
        if (pnL > 0) winningTrades++;
        else if (pnL < 0) losingTrades++;
      }
    });

    dailySummaries.forEach(summary => {
      totalInvested += summary.totalInvested;
      maxInvested = Math.max(maxInvested, summary.totalInvested);
      totalTrades += summary.newTrades + summary.closedTrades;
    });

    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });
    const weekLabel = `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;

    return {
      id: generateId(),
      weekLabel,
      startDate,
      endDate,
      totalInvested: totalInvested / dailySummaries.length, // Average
      maxInvested,
      totalPnL,
      avgPercentReturn: maxInvested > 0 ? (totalPnL / maxInvested) * 100 : 0,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      dailySummaries,
    };
  }

  // Get monthly report
  getMonthlyReport(year: number, month: number): MonthlyReport {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    const monthTrades = this.trades.filter(t => {
      const tradeDate = new Date(t.date);
      return tradeDate >= monthStart && tradeDate <= monthEnd;
    });

    // Get weekly reports for the month
    const weeklyReports: WeeklyReport[] = [];
    let weekStart = new Date(monthStart);
    
    while (weekStart <= monthEnd) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
      
      weeklyReports.push(this.getWeeklyReport(
        weekStart.toISOString().split('T')[0],
        weekEnd.toISOString().split('T')[0]
      ));
      
      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Aggregate metrics
    let totalInvested = 0;
    let maxInvested = 0;
    let totalPnL = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    weeklyReports.forEach(week => {
      totalInvested += week.totalInvested;
      maxInvested = Math.max(maxInvested, week.maxInvested);
      totalPnL += week.totalPnL;
      totalTrades += week.totalTrades;
      winningTrades += week.winningTrades;
      losingTrades += week.losingTrades;
    });

    // Stock breakdown
    const stockMap = new Map<string, { trades: number; pnL: number; name: string }>();
    monthTrades.forEach(trade => {
      const existing = stockMap.get(trade.companyCode) || { trades: 0, pnL: 0, name: trade.companyName };
      existing.trades++;
      if (trade.tradeType === 'SELL') {
        const position = this.getPosition(trade.companyCode);
        if (position) {
          existing.pnL += (trade.pricePerShare - position.avgEntryPrice) * trade.shares;
        }
      }
      stockMap.set(trade.companyCode, existing);
    });

    const stockBreakdown = Array.from(stockMap.entries()).map(([code, data]) => ({
      companyCode: code,
      companyName: data.name,
      trades: data.trades,
      totalPnL: data.pnL,
      avgReturn: data.trades > 0 ? data.pnL / data.trades : 0,
    }));

    const monthName = monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    return {
      id: generateId(),
      month: monthName,
      year,
      monthNumber: month,
      totalInvested: totalInvested / weeklyReports.length,
      maxInvested,
      totalPnL,
      avgPercentReturn: maxInvested > 0 ? (totalPnL / maxInvested) * 100 : 0,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      weeklyReports,
      stockBreakdown,
    };
  }

  // Get P&L chart data
  getPnLChartData(startDate: string, endDate: string): PnLChartData[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const chartData: PnLChartData[] = [];
    let cumulativePnL = 0;

    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const summary = this.getDailySummary(dateStr);
      cumulativePnL += summary.netPnL;

      chartData.push({
        date: dateStr,
        dailyPnL: summary.netPnL,
        cumulativePnL,
        invested: summary.totalInvested,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  }

  // Get position distribution
  getPositionDistribution(): PositionDistribution[] {
    const positions = this.getActivePositions();
    const totalValue = positions.reduce((sum, p) => sum + p.totalInvested, 0);

    return positions.map(p => ({
      companyCode: p.companyCode,
      value: p.totalInvested,
      percentage: totalValue > 0 ? (p.totalInvested / totalValue) * 100 : 0,
      pnL: p.unrealizedPnL || 0,
    }));
  }

  // Export to CSV
  exportTradesToCSV(): string {
    const headers = [
      'Date',
      'Day',
      'Company Code',
      'Company Name',
      'Exchange',
      'Trade Type',
      'Shares',
      'Price/Share',
      'Total Value',
      'Notes'
    ].join(',');

    const rows = this.trades.map(trade => [
      trade.date,
      trade.day,
      trade.companyCode,
      trade.companyName,
      trade.exchange,
      trade.tradeType,
      trade.shares,
      trade.pricePerShare,
      trade.totalValue,
      trade.notes || ''
    ].map(v => `"${v}"`).join(','));

    return [headers, ...rows].join('\n');
  }

  // Export weekly report to CSV
  exportWeeklyReportToCSV(report: WeeklyReport): string {
    const summaryHeaders = 'Metric,Value';
    const summaryRows = [
      `Week,${report.weekLabel}`,
      `Total Invested,${report.totalInvested.toFixed(2)}`,
      `Max Invested,${report.maxInvested.toFixed(2)}`,
      `Total P&L,${report.totalPnL.toFixed(2)}`,
      `Avg % Return,${report.avgPercentReturn.toFixed(4)}`,
      `Total Trades,${report.totalTrades}`,
      `Winning Trades,${report.winningTrades}`,
      `Losing Trades,${report.losingTrades}`,
      `Win Rate,${report.winRate.toFixed(2)}%`,
    ];

    const dailyHeaders = '\n\nDaily Breakdown\nDate,Day,New Trades,Closed Trades,Total Invested,Net P&L,Avg % Return';
    const dailyRows = report.dailySummaries.map(d => [
      d.date,
      d.day,
      d.newTrades,
      d.closedTrades,
      d.totalInvested.toFixed(2),
      d.netPnL.toFixed(2),
      d.avgPercentReturn.toFixed(4)
    ].join(','));

    return [summaryHeaders, ...summaryRows, dailyHeaders, ...dailyRows].join('\n');
  }

  // Clear all data
  clearAllData(): void {
    this.trades = [];
    this.portfolio = this.createDefaultPortfolio();
    this.saveToStorage();
  }

  // Delete a trade
  deleteTrade(tradeId: string): boolean {
    const index = this.trades.findIndex(t => t.id === tradeId);
    if (index === -1) return false;
    
    this.trades.splice(index, 1);
    this.updatePortfolioState();
    this.saveToStorage();
    return true;
  }
}

// Singleton instance
export const portfolioService = new PortfolioService();
export default portfolioService;
