'use client';

/**
 * ClosedPriceDashboard — Time Machine equivalent of LiveDataDashboard.
 * Shows historical closed price and OHLCV data for the selected date/company.
 * No live feeds, no desirability polling — pure historical snapshot.
 */

import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Building2,
  History,
  CalendarDays,
  Layers,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HistoricalDataPoint {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
}

interface ClosedPriceDashboardProps {
  company: string;
  selectedDate: string | null;
  /** Last data point from the historical OHLC series — represents the closed price at end of session */
  currentData: HistoricalDataPoint | null;
  overallSentiment?: string | null;
  /** Total number of data points in the historical series */
  totalDataPoints?: number;
}

const ClosedPriceDashboardInner: React.FC<ClosedPriceDashboardProps> = ({
  company,
  selectedDate,
  currentData,
  overallSentiment,
  totalDataPoints,
}) => {
  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '—';
    return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined || change === null) return '—';
    const sign = change >= 0 ? '+' : '';
    const percent = changePercent ?? 0;
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const getChangeClass = (change?: number) => {
    if (change === undefined || change === null) return 'text-muted-foreground';
    return change >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  const formattedDate = useMemo(() => {
    if (!selectedDate) return null;
    try {
      return new Date(selectedDate).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const sessionTime = useMemo(() => {
    if (!currentData?.timestamp) return null;
    return new Date(currentData.timestamp * 1000).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [currentData?.timestamp]);

  // No company selected
  if (!company) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-muted/50 rounded-full">
          <Building2 className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">No Company Selected</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Select a company and date from the sidebar to view historical price data.
          </p>
        </div>
      </div>
    );
  }

  // No data loaded yet
  if (!currentData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-3">
        <History className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">
          {selectedDate ? 'Loading historical data…' : 'Select a date to load historical price data.'}
        </p>
      </div>
    );
  }

  const closePrice = currentData.close ?? currentData.ltp;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">

      {/* Left Column — Session Info */}
      <div className="lg:col-span-4 space-y-4">

        {/* Time Machine Context Card */}
        <Card className="relative overflow-hidden border border-border/50 bg-card shadow-xl">
          <div className="absolute top-0 left-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

          <CardContent className="relative pt-6 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold text-foreground">Time Machine Session</span>
            </div>

            {/* Date */}
            <div className="bg-muted/30 rounded-xl p-4 border border-violet-500/20 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Historical Date
              </div>
              <div className="text-sm font-semibold text-foreground">{formattedDate ?? selectedDate}</div>
            </div>

            {/* End of session time */}
            {sessionTime && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Last Tick Time
                </div>
                <div className="text-sm font-semibold text-foreground font-mono">{sessionTime}</div>
              </div>
            )}

            {/* Data points */}
            {totalDataPoints !== undefined && (
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" />
                  Data Points Loaded
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {totalDataPoints.toLocaleString()} ticks
                </div>
              </div>
            )}

            {/* Sentiment */}
            <div className="pt-1">
              <div className="text-xs text-muted-foreground mb-2">Sthiti Sentiment</div>
              <Badge className={cn(
                'px-3 py-1.5 text-xs font-semibold w-full justify-center',
                overallSentiment === 'POSITIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : overallSentiment === 'NEGATIVE'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-muted text-muted-foreground border border-border'
              )}>
                {overallSentiment === 'POSITIVE' ? (
                  <><TrendingUp className="h-3 w-3 mr-1" /> Positive</>
                ) : overallSentiment === 'NEGATIVE' ? (
                  <><TrendingDown className="h-3 w-3 mr-1" /> Negative</>
                ) : (
                  'Neutral'
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column — Closed Price Data */}
      <div className="lg:col-span-8">
        <Card className="h-full border border-border/50 bg-card shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

          <CardHeader className="relative border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <Activity className="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    {company}
                    <span className="text-xs text-violet-400 flex items-center gap-1 border border-violet-500/30 rounded-full px-2 py-0.5 bg-violet-500/10">
                      <History className="w-3 h-3" />
                      HISTORICAL
                    </span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {formattedDate ?? selectedDate}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative pt-6 space-y-6">
            {/* Closed Price Hero */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Session Close Price</div>
              <div className="flex items-baseline gap-4">
                <div className="text-5xl font-bold tracking-tight text-foreground">
                  ₹{formatPrice(closePrice)}
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-lg font-semibold',
                  getChangeClass(currentData.change)
                )}>
                  {(currentData.change ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-5 w-5" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5" />
                  )}
                  {formatChange(currentData.change, currentData.changePercent)}
                </div>
              </div>
            </div>

            {/* OHLC Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-violet-500/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Open</div>
                <div className="text-xl font-bold text-foreground tabular-nums">₹{formatPrice(currentData.open)}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-emerald-500/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">High</div>
                <div className="text-xl font-bold text-emerald-400 tabular-nums">₹{formatPrice(currentData.high)}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-red-500/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Low</div>
                <div className="text-xl font-bold text-red-400 tabular-nums">₹{formatPrice(currentData.low)}</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-violet-500/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Close</div>
                <div className="text-xl font-bold text-violet-400 tabular-nums">₹{formatPrice(closePrice)}</div>
              </div>
            </div>

            {/* Volume */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-foreground">Volume</span>
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {currentData.volume?.toLocaleString() ?? '—'}
                </div>
              </div>

              {/* Bid / Ask */}
              {(currentData.bid || currentData.ask) && (
                <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-semibold text-foreground">Bid / Ask</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {currentData.bid && (
                      <div>
                        <div className="text-emerald-400 font-medium">Bid</div>
                        <div className="text-foreground font-semibold">₹{formatPrice(currentData.bid)}</div>
                      </div>
                    )}
                    {currentData.ask && (
                      <div>
                        <div className="text-red-400 font-medium">Ask</div>
                        <div className="text-foreground font-semibold">₹{formatPrice(currentData.ask)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Day Range Progress */}
            {currentData.low && currentData.high && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Session Range</span>
                  <span>₹{formatPrice(currentData.low)} — ₹{formatPrice(currentData.high)}</span>
                </div>
                <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full w-full" />
                  {currentData.ltp && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-violet-500 shadow-lg"
                      style={{
                        left: `${Math.max(0, Math.min(100, ((closePrice - currentData.low) / (currentData.high - currentData.low)) * 100))}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const ClosedPriceDashboard = React.memo(ClosedPriceDashboardInner);
export default ClosedPriceDashboard;
