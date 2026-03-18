// Portfolio Service — single source of truth is the backend JSON files.
// All reads come from GET /api/portfolio (proxied by Next.js → NestJS :5002).
// All writes fire POST /api/portfolio/save immediately — no localStorage involved.
//
// URL auto-adaptation:
//   Local dev  → Next.js dev server rewrites /api/* → http://localhost:5002/api/*
//   Docker     → Next.js container rewrites /api/* → http://backend:5002/api/*  (Docker DNS)
//   Server     → same Docker path, browser hits relative /api/* on same origin
// No environment-specific URL code needed anywhere in this file.

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

const BACKEND_URL = '/api/portfolio';

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get day name
const getDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${months[date.getMonth()]}-${date.getDate()}`;
};

class PortfolioService {
  private trades: Trade[] = [];
  private portfolio: Portfolio | null = null;

  constructor() {
    // No localStorage — in-memory state is populated exclusively via loadFromBackend().
  }

  // ─── Public: load from backend (call once on app mount) ──────────────────

  /**
   * Fetches the authoritative portfolio state from the backend JSON files.
   * This is the ONLY way data enters in-memory state.
   * Must be awaited before calling any read methods.
   */
  async loadFromBackend(): Promise<void> {
    try {
      const res = await fetch(BACKEND_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { portfolio: Portfolio | null; trades: Trade[] } = await res.json();

      this.trades = Array.isArray(data.trades) ? data.trades : [];

      if (data.portfolio) {
        this.portfolio = data.portfolio;
        this.updatePortfolioState();
      } else {
        this.portfolio = this.portfolio ?? this.createDefaultPortfolio();
      }
    } catch (err) {
      console.warn('[PortfolioService] Backend unavailable — using in-memory state:', err);
      if (!this.portfolio) {
        this.portfolio = this.createDefaultPortfolio();
      }
    }
  }

  // ─── Private: persist to backend ─────────────────────────────────────────

  private saveToBackend(): void {
    fetch(`${BACKEND_URL}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio: this.portfolio, trades: this.trades }),
    }).catch(err => {
      console.error('[PortfolioService] Backend save failed:', err);
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

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

  // ─── Public read API (synchronous, reads in-memory state) ────────────────

  getPortfolio(): Portfolio {
    if (!this.portfolio) {
      this.portfolio = this.createDefaultPortfolio();
    }
    return { ...this.portfolio, trades: [...this.trades] };
  }

  getTrades(): Trade[] {
    return [...this.trades];
  }

  getTradesForCompany(companyCode: string): Trade[] {
    return this.trades.filter(t => t.companyCode === companyCode);
  }

  getPosition(companyCode: string): Position | null {
    const trades = this.getTradesForCompany(companyCode);
    if (trades.length === 0) return null;

    let runningShares = 0;
    let runningCost = 0;
    let realizedPnL = 0;

    trades.forEach(trade => {
      if (trade.tradeType === 'BUY') {
        runningCost += trade.totalValue;
        runningShares += trade.shares;
      } else {
        if (runningShares > 0) {
          const avgCostAtSell = runningCost / runningShares;
          const costBasis = avgCostAtSell * trade.shares;
          realizedPnL += trade.totalValue - costBasis;
          runningCost -= costBasis;
          runningShares -= trade.shares;
          if (runningShares <= 0) { runningShares = 0; runningCost = 0; }
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
      totalInvested: runningCost,
      realizedPnL,
      firstEntryDate: trades[0].date,
      lastUpdateDate: trades[trades.length - 1].date,
      trades,
    };
  }

  getActivePositions(): Position[] {
    const companySet = new Set(this.trades.map(t => t.companyCode));
    const positions: Position[] = [];
    companySet.forEach(companyCode => {
      const position = this.getPosition(companyCode);
      if (position && position.status === 'HOLDING') positions.push(position);
    });
    return positions;
  }

  // ─── Public write API ────────────────────────────────────────────────────

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
    if (this.portfolio) this.portfolio.availableCash -= trade.totalValue;
    this.updatePortfolioState();
    this.saveToBackend();
    return trade;
  }

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
    if (this.portfolio) this.portfolio.availableCash += trade.totalValue;
    this.updatePortfolioState();
    this.saveToBackend();
    return trade;
  }

  deleteTrade(tradeId: string): boolean {
    const index = this.trades.findIndex(t => t.id === tradeId);
    if (index === -1) return false;
    this.trades.splice(index, 1);
    this.updatePortfolioState();
    this.saveToBackend();
    return true;
  }

  clearAllData(): void {
    this.trades = [];
    this.portfolio = this.createDefaultPortfolio();
    this.saveToBackend();
  }

  // ─── Private: recompute portfolio totals ──────────────────────────────────

  private updatePortfolioState(): void {
    if (!this.portfolio) return;

    const positions = this.getActivePositions();
    let totalInvested = 0;
    let realizedPnL = 0;

    positions.forEach(pos => {
      totalInvested += pos.totalInvested;
      realizedPnL += pos.realizedPnL || 0;
    });

    const companySet = new Set(this.trades.map(t => t.companyCode));
    companySet.forEach(companyCode => {
      const position = this.getPosition(companyCode);
      if (position && position.status === 'EXITED') {
        realizedPnL += position.realizedPnL || 0;
      }
    });

    this.portfolio.positions = positions;
    this.portfolio.totalInvested = totalInvested;
    this.portfolio.unrealizedPnL = 0;
    this.portfolio.realizedPnL = realizedPnL;
    this.portfolio.totalPnL = realizedPnL;
    this.portfolio.totalValue = this.portfolio.availableCash + totalInvested;
    this.portfolio.updatedAt = new Date().toISOString();
    this.portfolio.trades = this.trades;
  }

  // ─── Reports ─────────────────────────────────────────────────────────────

  getDailySummary(date: string): DailySummary {
    const dayTrades = this.trades.filter(t => t.date === date);
    const buyTrades = dayTrades.filter(t => t.tradeType === 'BUY');
    const sellTrades = dayTrades.filter(t => t.tradeType === 'SELL');

    let totalInvested = 0;
    let netPnL = 0;

    buyTrades.forEach(t => { totalInvested += t.totalValue; });

    sellTrades.forEach(sellTrade => {
      const companyTrades = this.trades.filter(
        t => t.companyCode === sellTrade.companyCode && t.date <= date
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
            if (t.id === sellTrade.id) {
              netPnL += (t.pricePerShare - avgAtSell) * t.shares;
              break;
            }
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

  getWeeklyReport(startDate: string, endDate: string): WeeklyReport {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dailySummaries: DailySummary[] = [];

    let currentDate = new Date(start);
    while (currentDate <= end) {
      dailySummaries.push(this.getDailySummary(currentDate.toISOString().split('T')[0]));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    let totalBought = 0;
    let totalPnL = 0;
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

    const currentExposure = this.getActivePositions().reduce((sum, p) => sum + p.totalInvested, 0);
    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });

    return {
      id: generateId(),
      weekLabel: `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`,
      startDate,
      endDate,
      totalInvested: totalBought,
      maxInvested: Math.max(maxDayInvested, currentExposure),
      totalPnL,
      avgPercentReturn: totalBought > 0 ? (totalPnL / totalBought) * 100 : 0,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: (winningTrades + losingTrades) > 0
        ? (winningTrades / (winningTrades + losingTrades)) * 100
        : 0,
      dailySummaries,
    };
  }

  getMonthlyReport(year: number, month: number): MonthlyReport {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const monthTrades = this.trades.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });

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

    let totalInvested = 0, maxInvested = 0, totalPnL = 0;
    let totalTrades = 0, winningTrades = 0, losingTrades = 0;

    weeklyReports.forEach(week => {
      totalInvested += week.totalInvested;
      maxInvested = Math.max(maxInvested, week.maxInvested);
      totalPnL += week.totalPnL;
      totalTrades += week.totalTrades;
      winningTrades += week.winningTrades;
      losingTrades += week.losingTrades;
    });

    const stockMap = new Map<string, { trades: number; pnL: number; name: string }>();
    monthTrades.forEach(trade => {
      const existing = stockMap.get(trade.companyCode) || { trades: 0, pnL: 0, name: trade.companyName };
      existing.trades++;
      if (trade.tradeType === 'SELL') {
        const companyTrades = this.trades.filter(
          t => t.companyCode === trade.companyCode && t.date <= trade.date
        );
        let runShares = 0, runCost = 0;
        for (const t of companyTrades) {
          if (t.tradeType === 'BUY') {
            runCost += t.totalValue; runShares += t.shares;
          } else {
            if (runShares > 0) {
              const avgAtSell = runCost / runShares;
              if (t.id === trade.id) { existing.pnL += (t.pricePerShare - avgAtSell) * t.shares; break; }
              const costBasis = avgAtSell * t.shares;
              runCost -= costBasis; runShares -= t.shares;
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

    return {
      id: generateId(),
      month: monthStart.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      year,
      monthNumber: month,
      totalInvested,
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
      chartData.push({ date: dateStr, dailyPnL: summary.netPnL, cumulativePnL, invested: summary.totalInvested });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return chartData;
  }

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

  exportTradesToCSV(): string {
    const headers = ['Date','Day','Company Code','Company Name','Exchange','Trade Type','Shares','Price/Share','Total Value','Notes'].join(',');
    const rows = this.trades.map(trade => [
      trade.date, trade.day, trade.companyCode, trade.companyName, trade.exchange,
      trade.tradeType, trade.shares, trade.pricePerShare, trade.totalValue, trade.notes || ''
    ].map(v => `"${v}"`).join(','));
    return [headers, ...rows].join('\n');
  }

  exportWeeklyReportToCSV(report: WeeklyReport): string {
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
    const dailyRows = report.dailySummaries.map(d =>
      [d.date, d.day, d.newTrades, d.closedTrades, d.totalInvested.toFixed(2), d.netPnL.toFixed(2), d.avgPercentReturn.toFixed(4)].join(',')
    );
    return ['Metric,Value', ...summaryRows, dailyHeaders, ...dailyRows].join('\n');
  }
}

// Singleton instance
export const portfolioService = new PortfolioService();
export default portfolioService;
