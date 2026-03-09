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

    // Track running shares & cost to compute weighted avg correctly
    // When selling, we deduct at the current avg cost (weighted average method)
    let runningShares = 0;
    let runningCost = 0; // total cost of currently held shares
    let realizedPnL = 0;

    trades.forEach(trade => {
      if (trade.tradeType === 'BUY') {
        // Add to position: new weighted average
        runningCost += trade.totalValue; // shares * pricePerShare
        runningShares += trade.shares;
      } else {
        // SELL: compute realized PnL at current avg cost, then deduct
        if (runningShares > 0) {
          const avgCostAtSell = runningCost / runningShares;
          const costBasis = avgCostAtSell * trade.shares;
          realizedPnL += trade.totalValue - costBasis;
          // Deduct sold shares' cost from running totals
          runningCost -= costBasis;
          runningShares -= trade.shares;
          // Clamp to zero to avoid floating point issues
          if (runningShares <= 0) {
            runningShares = 0;
            runningCost = 0;
          }
        }
      }
    });

    if (runningShares <= 0) {
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

    const avgEntryPrice = runningCost / runningShares;

    return {
      id: generateId(),
      companyCode,
      companyName: trades[0].companyName,
      exchange: trades[0].exchange,
      status: 'HOLDING',
      shares: runningShares,
      avgEntryPrice,
      totalInvested: runningCost, // Only the cost of remaining shares
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
    // Deduct cash on buy
    if (this.portfolio) {
      this.portfolio.availableCash -= trade.totalValue;
    }
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
    // Add cash on sell
    if (this.portfolio) {
      this.portfolio.availableCash += trade.totalValue;
    }
    this.updatePortfolioState();
    this.saveToStorage();

    return trade;
  }

  // Update portfolio state after trades
  private updatePortfolioState(): void {
    if (!this.portfolio) return;

    const positions = this.getActivePositions();
    let totalInvested = 0;
    let realizedPnL = 0;

    positions.forEach(pos => {
      totalInvested += pos.totalInvested;
      realizedPnL += pos.realizedPnL || 0;
    });

    // Also include realized PnL from fully exited positions
    const companySet = new Set(this.trades.map(t => t.companyCode));
    companySet.forEach(companyCode => {
      const position = this.getPosition(companyCode);
      if (position && position.status === 'EXITED') {
        realizedPnL += position.realizedPnL || 0;
      }
    });

    this.portfolio.positions = positions;
    this.portfolio.totalInvested = totalInvested;
    this.portfolio.unrealizedPnL = 0; // Will be computed on frontend with live prices
    this.portfolio.realizedPnL = realizedPnL;
    this.portfolio.totalPnL = realizedPnL; // Unrealized added on frontend
    this.portfolio.totalValue = this.portfolio.availableCash + totalInvested;
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

    // Compute sell P&L: replay trades UP TO this date to get correct avg price at time of sell
    sellTrades.forEach(sellTrade => {
      // Get all trades for this company up to and including this sell
      const companyTrades = this.trades.filter(
        t => t.companyCode === sellTrade.companyCode && t.date <= date
      );
      // Replay to find avg cost at time of this sell
      let runShares = 0;
      let runCost = 0;
      for (const t of companyTrades) {
        if (t.tradeType === 'BUY') {
          runCost += t.totalValue;
          runShares += t.shares;
        } else {
          if (runShares > 0) {
            const avgAtSell = runCost / runShares;
            if (t.id === sellTrade.id) {
              // This is our target sell
              netPnL += (t.pricePerShare - avgAtSell) * t.shares;
              break;
            }
            // Previous sell — deduct
            const costBasis = avgAtSell * t.shares;
            runCost -= costBasis;
            runShares -= t.shares;
            if (runShares <= 0) { runShares = 0; runCost = 0; }
          }
        }
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

    // Aggregate weekly metrics from daily summaries
    let totalBought = 0; // Total bought this week
    let totalPnL = 0; // Realized P&L from sells this week
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let maxDayInvested = 0;

    dailySummaries.forEach(summary => {
      totalBought += summary.totalInvested;
      maxDayInvested = Math.max(maxDayInvested, summary.totalInvested);
      totalTrades += summary.newTrades + summary.closedTrades;
      if (summary.netPnL > 0) winningTrades++;
      else if (summary.netPnL < 0) losingTrades++;
      totalPnL += summary.netPnL;
    });

    // Current portfolio exposure (active positions cost)
    const currentExposure = this.getActivePositions().reduce((sum, p) => sum + p.totalInvested, 0);

    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });
    const weekLabel = `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;

    return {
      id: generateId(),
      weekLabel,
      startDate,
      endDate,
      totalInvested: totalBought, // Total amount bought this week
      maxInvested: Math.max(maxDayInvested, currentExposure), // Peak single-day or current
      totalPnL,
      avgPercentReturn: totalBought > 0 ? (totalPnL / totalBought) * 100 : 0,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0,
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

    // Stock breakdown — replay trades to get correct avg cost at time of each sell
    const stockMap = new Map<string, { trades: number; pnL: number; name: string }>();
    monthTrades.forEach(trade => {
      const existing = stockMap.get(trade.companyCode) || { trades: 0, pnL: 0, name: trade.companyName };
      existing.trades++;
      if (trade.tradeType === 'SELL') {
        // Replay all trades for this company up to the sell date to get correct avg
        const companyTrades = this.trades.filter(
          t => t.companyCode === trade.companyCode && t.date <= trade.date
        );
        let runShares = 0;
        let runCost = 0;
        for (const t of companyTrades) {
          if (t.tradeType === 'BUY') {
            runCost += t.totalValue;
            runShares += t.shares;
          } else {
            if (runShares > 0) {
              const avgAtSell = runCost / runShares;
              if (t.id === trade.id) {
                existing.pnL += (t.pricePerShare - avgAtSell) * t.shares;
                break;
              }
              const costBasis = avgAtSell * t.shares;
              runCost -= costBasis;
              runShares -= t.shares;
              if (runShares <= 0) { runShares = 0; runCost = 0; }
            }
          }
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
      totalInvested, // Sum of all buys across the month
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
