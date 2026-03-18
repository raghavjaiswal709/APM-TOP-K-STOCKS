// usePortfolio hook - React hook for portfolio management

import { useState, useEffect, useCallback } from 'react';
import portfolioService from '@/app/services/portfolioService';
import {
  Portfolio,
  Position,
  Trade,
  TradeEntry,
  WeeklyReport,
  MonthlyReport,
  PnLChartData,
  PositionDistribution,
} from '@/types/portfolio';

interface UsePortfolioReturn {
  // State
  portfolio: Portfolio | null;
  positions: Position[];
  trades: Trade[];
  loading: boolean;
  error: string | null;
  
  // Actions
  enterMarket: (entry: TradeEntry) => Trade | null;
  exitMarket: (entry: TradeEntry) => Trade | null;
  getPosition: (companyCode: string) => Position | null;
  deleteTrade: (tradeId: string) => boolean;
  clearAll: () => void;
  refresh: () => void;
  
  // Reports
  getWeeklyReport: (startDate: string, endDate: string) => WeeklyReport;
  getMonthlyReport: (year: number, month: number) => MonthlyReport;
  getPnLChartData: (startDate: string, endDate: string) => PnLChartData[];
  getPositionDistribution: () => PositionDistribution[];
  
  // Export
  exportTradesToCSV: () => string;
  exportWeeklyReportToCSV: (report: WeeklyReport) => string;
  downloadCSV: (content: string, filename: string) => void;
}

export function usePortfolio(): UsePortfolioReturn {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load portfolio data
  const refresh = useCallback(() => {
    try {
      setLoading(true);
      const portfolioData = portfolioService.getPortfolio();
      const positionsData = portfolioService.getActivePositions();
      const tradesData = portfolioService.getTrades();
      
      setPortfolio(portfolioData);
      setPositions(positionsData);
      setTrades(tradesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: load exclusively from backend (source of truth).
  // Keep loading=true until backend responds so we never flash empty/stale state.
  useEffect(() => {
    setLoading(true);
    portfolioService.loadFromBackend().then(() => {
      refresh();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Enter market (BUY)
  const enterMarket = useCallback((entry: TradeEntry): Trade | null => {
    try {
      const trade = portfolioService.enterMarket(entry);
      refresh();
      return trade;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter market');
      return null;
    }
  }, [refresh]);

  // Exit market (SELL)
  const exitMarket = useCallback((entry: TradeEntry): Trade | null => {
    try {
      const trade = portfolioService.exitMarket(entry);
      refresh();
      return trade;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exit market');
      return null;
    }
  }, [refresh]);

  // Get position for a company
  const getPosition = useCallback((companyCode: string): Position | null => {
    return portfolioService.getPosition(companyCode);
  }, []);

  // Delete a trade
  const deleteTrade = useCallback((tradeId: string): boolean => {
    const result = portfolioService.deleteTrade(tradeId);
    if (result) refresh();
    return result;
  }, [refresh]);

  // Clear all data
  const clearAll = useCallback(() => {
    portfolioService.clearAllData();
    refresh();
  }, [refresh]);

  // Get weekly report
  const getWeeklyReport = useCallback((startDate: string, endDate: string): WeeklyReport => {
    return portfolioService.getWeeklyReport(startDate, endDate);
  }, []);

  // Get monthly report
  const getMonthlyReport = useCallback((year: number, month: number): MonthlyReport => {
    return portfolioService.getMonthlyReport(year, month);
  }, []);

  // Get P&L chart data
  const getPnLChartData = useCallback((startDate: string, endDate: string): PnLChartData[] => {
    return portfolioService.getPnLChartData(startDate, endDate);
  }, []);

  // Get position distribution
  const getPositionDistribution = useCallback((): PositionDistribution[] => {
    return portfolioService.getPositionDistribution();
  }, []);

  // Export trades to CSV
  const exportTradesToCSV = useCallback((): string => {
    return portfolioService.exportTradesToCSV();
  }, []);

  // Export weekly report to CSV
  const exportWeeklyReportToCSV = useCallback((report: WeeklyReport): string => {
    return portfolioService.exportWeeklyReportToCSV(report);
  }, []);

  // Download CSV file
  const downloadCSV = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    portfolio,
    positions,
    trades,
    loading,
    error,
    enterMarket,
    exitMarket,
    getPosition,
    deleteTrade,
    clearAll,
    refresh,
    getWeeklyReport,
    getMonthlyReport,
    getPnLChartData,
    getPositionDistribution,
    exportTradesToCSV,
    exportWeeklyReportToCSV,
    downloadCSV,
  };
}

export default usePortfolio;
