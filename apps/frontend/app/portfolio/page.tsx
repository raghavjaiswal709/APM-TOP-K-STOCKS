'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { usePersistentState, useScrollRestoration } from '@/hooks/useStateRestoration';
import { usePageState, usePersistedPortfolioState } from '@/app/context/PageStateContext';
import { AppSidebar } from "@/app/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar as CalendarIcon,
  Download,
  RefreshCw,
  Trash2,
  PieChart,
  BarChart3,
  LineChart,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  Activity,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { usePortfolio } from '@/hooks/usePortfolio';
import { ModeToggle } from "@/app/components/toggleButton";
import { Trade, Position, WeeklyReport, MonthlyReport } from '@/types/portfolio';
import { toast } from 'sonner';

// Import Recharts for visualizations
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';

const COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

// Read live market data from localStorage (shared with market-data page)
function getLiveMarketData(): Record<string, { ltp: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('market-data-marketData');
    if (raw) return JSON.parse(raw);
  } catch { }
  return {};
}

export default function PortfolioPage() {
  const { updatePortfolioState } = usePageState();
  const persistedState = usePersistedPortfolioState();
  
  // Scroll restoration
  useScrollRestoration('portfolio-main-scroll');

  const {
    portfolio,
    positions,
    trades,
    loading,
    error,
    refresh,
    clearAll,
    deleteTrade,
    getPosition,
    getWeeklyReport,
    getMonthlyReport,
    getPnLChartData,
    getPositionDistribution,
    exportTradesToCSV,
    exportWeeklyReportToCSV,
    downloadCSV,
  } = usePortfolio();

  const [activeTab, setActiveTab] = usePersistentState<string>(
    'portfolio-activeTab',
    persistedState?.activeTab || 'overview'
  );
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [livePrices, setLivePrices] = useState<Record<string, { ltp: number }>>(getLiveMarketData());

  // Refresh live prices from localStorage periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setLivePrices(getLiveMarketData());
    }, 2000); // every 2 seconds
    return () => clearInterval(timer);
  }, []);

  // Helper: get LTP for a position symbol (tries various key patterns)
  const getLTP = (companyCode: string, exchange: string): number | null => {
    // Try symbol formats: NSE:SBIN-EQ, SBIN-EQ, NSE:SBIN, etc.
    const keys = [
      `${exchange}:${companyCode}`,
      companyCode,
      `${exchange}:${companyCode}-EQ`,
      `${companyCode}-EQ`,
    ];
    for (const key of keys) {
      if (livePrices[key]?.ltp && livePrices[key].ltp > 0) {
        return livePrices[key].ltp;
      }
    }
    return null;
  };

  // Sync state to context
  useEffect(() => {
    updatePortfolioState({
      activeTab,
      scrollPosition: window.scrollY,
    });
  }, [activeTab, updatePortfolioState]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!trades.length) {
      return {
        totalTrades: 0,
        totalInvested: 0,
        currentMarketValue: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        totalPnL: 0,
        avgReturn: 0,
        winRate: 0,
        winningTrades: 0,
        losingTrades: 0,
        availableCash: portfolio?.availableCash ?? 1000000,
        totalCapital: portfolio?.availableCash ?? 1000000,
        totalBought: 0,
        totalSold: 0,
      };
    }

    let totalInvested = 0;     // cost basis of ACTIVE holdings only
    let currentMarketValue = 0;
    let unrealizedPnL = 0;
    let realizedPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    // Sum up ACTIVE positions
    positions.forEach(pos => {
      totalInvested += pos.totalInvested;
      const ltp = getLTP(pos.companyCode, pos.exchange);
      if (ltp && ltp > 0) {
        const marketVal = pos.shares * ltp;
        currentMarketValue += marketVal;
        unrealizedPnL += marketVal - pos.totalInvested;
      } else {
        currentMarketValue += pos.totalInvested;
      }
      if (pos.realizedPnL) {
        realizedPnL += pos.realizedPnL;
      }
    });

    // Also count realized PnL from fully exited positions
    const companySet = new Set(trades.map(t => t.companyCode));
    companySet.forEach(code => {
      const pos = positions.find(p => p.companyCode === code);
      if (!pos) {
        const fullPos = getPosition(code);
        if (fullPos && fullPos.realizedPnL) {
          realizedPnL += fullPos.realizedPnL;
          if (fullPos.realizedPnL > 0) winningTrades++;
          else if (fullPos.realizedPnL < 0) losingTrades++;
        }
      }
    });

    const totalPnL = unrealizedPnL + realizedPnL;
    const availableCash = portfolio?.availableCash ?? 0;
    // Net worth = cash on hand + market value of holdings
    const totalCapital = availableCash + currentMarketValue;
    // Lifetime totals
    const totalBought = trades.filter(t => t.tradeType === 'BUY').reduce((s, t) => s + t.totalValue, 0);
    const totalSold = trades.filter(t => t.tradeType === 'SELL').reduce((s, t) => s + t.totalValue, 0);

    return {
      totalTrades: trades.length,
      totalInvested,
      currentMarketValue,
      unrealizedPnL,
      realizedPnL,
      totalPnL,
      avgReturn: totalBought > 0 ? (totalPnL / totalBought) * 100 : 0,
      winRate: (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0,
      winningTrades,
      losingTrades,
      availableCash,
      totalCapital,
      totalBought,
      totalSold,
    };
  }, [trades, positions, livePrices, portfolio, getPosition]);

  // Weekly report
  const weeklyReport = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return getWeeklyReport(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  }, [getWeeklyReport, trades]);

  // Monthly report
  const monthlyReport = useMemo(() => {
    return getMonthlyReport(selectedYear, selectedMonth);
  }, [getMonthlyReport, selectedYear, selectedMonth, trades]);

  // P&L chart data
  const pnlChartData = useMemo(() => {
    return getPnLChartData(
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd')
    );
  }, [getPnLChartData, dateRange, trades]);

  // Position distribution
  const positionDistribution = useMemo(() => {
    return getPositionDistribution();
  }, [getPositionDistribution, positions]);

  // Handle CSV download
  const handleExportTrades = () => {
    const csv = exportTradesToCSV();
    downloadCSV(csv, `portfolio-trades-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    toast.success('Trades exported successfully');
  };

  const handleExportWeeklyReport = () => {
    const csv = exportWeeklyReportToCSV(weeklyReport);
    downloadCSV(csv, `weekly-report-${weeklyReport.weekLabel.replace(/ /g, '-')}.csv`);
    toast.success('Weekly report exported successfully');
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all portfolio data? This cannot be undone.')) {
      clearAll();
      toast.success('Portfolio cleared');
    }
  };

  const handleDeleteTrade = (tradeId: string) => {
    if (confirm('Delete this trade?')) {
      deleteTrade(tradeId);
      toast.success('Trade deleted');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Portfolio</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTrades}>
              <Download className="h-4 w-4 mr-1" />
              Export Trades
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
            <ModeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Briefcase className="h-8 w-8 text-amber-600" />
              Portfolio Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Track your trades, analyze performance, and generate reports
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Card 1: Available Cash */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Available Cash</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  ₹{metrics.availableCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Free for trading
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Invested Value (active holdings cost) */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Invested Value</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  ₹{metrics.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {positions.length} active position{positions.length !== 1 ? 's' : ''}
                  {positions.length === 0 && metrics.totalTrades > 0 && ' (all exited)'}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Current Market Value */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Market Value</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  ₹{metrics.currentMarketValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-sm font-medium",
                  metrics.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {metrics.unrealizedPnL >= 0 ? '+' : ''}₹{metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })} unrealized
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Total P&L (Realized + Unrealized) */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total P&L</CardDescription>
                <CardTitle className={cn(
                  "text-2xl flex items-center gap-2",
                  metrics.totalPnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {metrics.totalPnL >= 0 ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                  {metrics.totalPnL >= 0 ? '+' : ''}₹{Math.abs(metrics.totalPnL).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span className={metrics.realizedPnL >= 0 ? "text-green-600" : "text-red-600"}>
                    Realized: {metrics.realizedPnL >= 0 ? '+' : ''}₹{metrics.realizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span className={metrics.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}>
                    Unrealized: {metrics.unrealizedPnL >= 0 ? '+' : ''}₹{metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 5: Net Worth (cash + market value = total capital) */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Net Worth</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  ₹{metrics.totalCapital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-sm font-medium",
                  metrics.avgReturn >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {metrics.avgReturn >= 0 ? '+' : ''}{metrics.avgReturn.toFixed(2)}% overall return
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-6 w-full max-w-3xl">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <PieChart className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="holdings" className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                Holdings
              </TabsTrigger>
              <TabsTrigger value="trades" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Trades
              </TabsTrigger>
              <TabsTrigger value="positions" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Positions
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                Monthly
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* P&L Chart */}
                <Card className="col-span-1 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="h-5 w-5" />
                      Cumulative P&L
                    </CardTitle>
                    <CardDescription>
                      Your profit/loss over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {pnlChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={pnlChartData}>
                            <defs>
                              <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(v: number) => `₹${v}`} />
                            <RechartsTooltip
                              formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'P&L']}
                              labelStyle={{ color: '#888' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="cumulativePnL"
                              stroke="#22c55e"
                              fill="url(#colorPnL)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No trading data available. Start trading to see your P&L chart.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Position Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Position Distribution
                    </CardTitle>
                    <CardDescription>
                      How your investments are allocated
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      {positionDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={positionDistribution}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              nameKey="companyCode"
                              label={(props) => {
                                const payload = props.payload as { companyCode: string; percentage: number } | undefined;
                                if (!payload) return '';
                                return `${payload.companyCode} (${payload.percentage?.toFixed(1) || 0}%)`;
                              }}
                            >
                              {positionDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Value']}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No active positions
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Trades */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Trades
                    </CardTitle>
                    <CardDescription>
                      Your last 5 trades
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trades.length > 0 ? (
                      <div className="space-y-2">
                        {trades.slice(-5).reverse().map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={trade.tradeType === 'BUY' ? 'default' : 'destructive'}
                                className={trade.tradeType === 'BUY' ? 'bg-green-600' : ''}
                              >
                                {trade.tradeType}
                              </Badge>
                              <span className="font-medium">{trade.companyCode}</span>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                {trade.shares} @ ₹{trade.pricePerShare.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">{trade.day}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        No trades yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Holdings Tab - Fyers-style holdings view with live prices */}
            <TabsContent value="holdings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Holdings
                  </CardTitle>
                  <CardDescription>
                    Your current holdings with live market data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {positions.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead className="text-right">Net Quantity</TableHead>
                            <TableHead className="text-right">Avg. Cost Price</TableHead>
                            <TableHead className="text-right">LTP</TableHead>
                            <TableHead className="text-right">Invested Value</TableHead>
                            <TableHead className="text-right">Market Value</TableHead>
                            <TableHead className="text-right">Unrealized P&L</TableHead>
                            <TableHead className="text-right">Unrealized P&L (%)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {positions.map((pos) => {
                            const ltp = getLTP(pos.companyCode, pos.exchange);
                            const investedValue = pos.totalInvested;
                            const marketValue = ltp ? pos.shares * ltp : investedValue;
                            const unrealizedPnL = marketValue - investedValue;
                            const unrealizedPnLPct = investedValue > 0 ? (unrealizedPnL / investedValue) * 100 : 0;

                            return (
                              <TableRow key={pos.id}>
                                <TableCell className="font-medium">
                                  {pos.exchange}:{pos.companyCode}
                                </TableCell>
                                <TableCell className="text-right">{pos.shares}</TableCell>
                                <TableCell className="text-right">₹{pos.avgEntryPrice.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {ltp ? (
                                    <span>₹{ltp.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  ₹{investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right">
                                  ₹{marketValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right font-semibold",
                                  unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {unrealizedPnL >= 0 ? '+' : ''}₹{unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right font-medium",
                                  unrealizedPnLPct >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {unrealizedPnLPct >= 0 ? '+' : ''}{unrealizedPnLPct.toFixed(1)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Holdings Summary Footer */}
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground">Total Invested</p>
                          <p className="text-lg font-bold">
                            ₹{metrics.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <p className="text-xs text-muted-foreground">Current Market Value</p>
                          <p className="text-lg font-bold">
                            ₹{metrics.currentMarketValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className={cn(
                          "p-3 rounded-lg",
                          metrics.unrealizedPnL >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                        )}>
                          <p className="text-xs text-muted-foreground">Total Unrealized P&L</p>
                          <p className={cn(
                            "text-lg font-bold",
                            metrics.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {metrics.unrealizedPnL >= 0 ? '+' : ''}₹{metrics.unrealizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className={cn(
                          "p-3 rounded-lg",
                          metrics.realizedPnL >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                        )}>
                          <p className="text-xs text-muted-foreground">Total Realized P&L</p>
                          <p className={cn(
                            "text-lg font-bold",
                            metrics.realizedPnL >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {metrics.realizedPnL >= 0 ? '+' : ''}₹{metrics.realizedPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No holdings</p>
                      <p className="text-sm mt-1">Enable Portfolio Mode on the Market Data page to start tracking</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trades Tab */}
            <TabsContent value="trades">
              <Card>
                <CardHeader>
                  <CardTitle>Trade History</CardTitle>
                  <CardDescription>
                    All your trading activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trades.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trades.slice().reverse().map((trade) => (
                          <TableRow key={trade.id}>
                            <TableCell>{trade.date}</TableCell>
                            <TableCell className="font-medium">{trade.companyCode}</TableCell>
                            <TableCell>
                              <Badge
                                variant={trade.tradeType === 'BUY' ? 'default' : 'destructive'}
                                className={trade.tradeType === 'BUY' ? 'bg-green-600' : ''}
                              >
                                {trade.tradeType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{trade.shares}</TableCell>
                            <TableCell className="text-right">₹{trade.pricePerShare.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{trade.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                              {trade.notes || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteTrade(trade.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No trades recorded yet</p>
                      <p className="text-sm mt-1">Enable Portfolio Mode on the Market Data page to start tracking</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions">
              <Card>
                <CardHeader>
                  <CardTitle>Active Positions</CardTitle>
                  <CardDescription>
                    Your current holdings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {positions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Company</TableHead>
                          <TableHead>Exchange</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Avg Entry</TableHead>
                          <TableHead className="text-right">Invested</TableHead>
                          <TableHead className="text-right">Unrealized P&L</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">{position.companyCode}</TableCell>
                            <TableCell>{position.exchange}</TableCell>
                            <TableCell className="text-right">{position.shares}</TableCell>
                            <TableCell className="text-right">₹{position.avgEntryPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              ₹{position.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              (position.unrealizedPnL || 0) >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {(position.unrealizedPnL || 0) >= 0 ? '+' : ''}
                              ₹{(position.unrealizedPnL || 0).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={position.status === 'HOLDING' ? 'default' : 'secondary'}>
                                {position.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active positions</p>
                      <p className="text-sm mt-1">Enter the market to create positions</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Weekly Report Tab */}
            <TabsContent value="weekly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Weekly Report</CardTitle>
                    <CardDescription>{weeklyReport.weekLabel}</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportWeeklyReport}>
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Weekly Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Total Bought</p>
                      <p className="text-2xl font-bold">
                        ₹{weeklyReport.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Peak Exposure</p>
                      <p className="text-2xl font-bold">
                        ₹{weeklyReport.maxInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-lg",
                      weeklyReport.totalPnL >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                    )}>
                      <p className="text-sm text-muted-foreground">Total P&L</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        weeklyReport.totalPnL >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {weeklyReport.totalPnL >= 0 ? '+' : ''}₹{weeklyReport.totalPnL.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold">{weeklyReport.winRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Daily Breakdown */}
                  <div>
                    <h4 className="font-semibold mb-3">Daily Breakdown</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Day</TableHead>
                          <TableHead className="text-right">New Trades</TableHead>
                          <TableHead className="text-right">Closed</TableHead>
                          <TableHead className="text-right">Invested</TableHead>
                          <TableHead className="text-right">Net P&L</TableHead>
                          <TableHead className="text-right">% Return</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {weeklyReport.dailySummaries.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell className="font-medium">{day.day}</TableCell>
                            <TableCell className="text-right">{day.newTrades}</TableCell>
                            <TableCell className="text-right">{day.closedTrades}</TableCell>
                            <TableCell className="text-right">
                              ₹{day.totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-medium",
                              day.netPnL >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {day.netPnL >= 0 ? '+' : ''}₹{day.netPnL.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right",
                              day.avgPercentReturn >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {day.avgPercentReturn >= 0 ? '+' : ''}{day.avgPercentReturn.toFixed(2)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Monthly Report Tab */}
            <TabsContent value="monthly">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Monthly Report</CardTitle>
                    <CardDescription>{monthlyReport.month}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(v) => setSelectedMonth(parseInt(v))}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {format(new Date(2000, i, 1), 'MMMM')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(v) => setSelectedYear(parseInt(v))}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Monthly Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Total Trades</p>
                      <p className="text-2xl font-bold">{monthlyReport.totalTrades}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Peak Exposure</p>
                      <p className="text-2xl font-bold">
                        ₹{monthlyReport.maxInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className={cn(
                      "p-4 rounded-lg",
                      monthlyReport.totalPnL >= 0 ? "bg-green-500/10" : "bg-red-500/10"
                    )}>
                      <p className="text-sm text-muted-foreground">Total P&L</p>
                      <p className={cn(
                        "text-2xl font-bold",
                        monthlyReport.totalPnL >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {monthlyReport.totalPnL >= 0 ? '+' : ''}₹{monthlyReport.totalPnL.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold">{monthlyReport.winRate.toFixed(1)}%</p>
                    </div>
                  </div>

                  {/* Stock Breakdown */}
                  {monthlyReport.stockBreakdown.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Stock Performance</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Company</TableHead>
                            <TableHead className="text-right">Trades</TableHead>
                            <TableHead className="text-right">Total P&L</TableHead>
                            <TableHead className="text-right">Avg Return</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyReport.stockBreakdown.map((stock) => (
                            <TableRow key={stock.companyCode}>
                              <TableCell className="font-medium">{stock.companyCode}</TableCell>
                              <TableCell className="text-right">{stock.trades}</TableCell>
                              <TableCell className={cn(
                                "text-right font-medium",
                                stock.totalPnL >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {stock.totalPnL >= 0 ? '+' : ''}₹{stock.totalPnL.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                ₹{stock.avgReturn.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Weekly Breakdown Chart */}
                  {monthlyReport.weeklyReports.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Weekly P&L</h4>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsBarChart data={monthlyReport.weeklyReports}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="weekLabel" fontSize={11} />
                            <YAxis fontSize={11} tickFormatter={(v: number) => `₹${v}`} />
                            <RechartsTooltip
                              formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'P&L']}
                            />
                            <Bar
                              dataKey="totalPnL"
                              fill="#3b82f6"
                              radius={[4, 4, 0, 0]}
                            />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
