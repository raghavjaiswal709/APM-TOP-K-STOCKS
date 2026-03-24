'use client';

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  XCircle,
  RefreshCw,
  Activity,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Gauge,
  Clock,
  Building2,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DesirabilityData } from '@/hooks/useDesirability';
import { useClusteringAnalysis, useClusteringConfidence, useActiveClusters } from '@/hooks/useClusteringV2';
import { ARCHETYPE_COLORS } from '@/types/clustering';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MarketData {
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
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
}

interface LiveDataDashboardProps {
  // Company info
  company: string;
  symbol: string;
  
  // Live market data
  currentData: MarketData | null;
  
  // Desirability & Reoccurrence
  desirabilityScore: number | null;
  desirabilityClassification: string | null;
  desirabilityData: DesirabilityData | null;
  desirabilityLoading: boolean;
  onRefreshDesirability: () => void;
  
  // Sentiment
  overallSentiment?: string | null;
  isSentimentFetching?: boolean;
}

// Helper functions for score configurations
function getDesirabilityConfig(score: number | null) {
  if (score === null) {
    return {
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/10',
      borderColor: 'border-zinc-500/40',
      gradientFrom: 'from-zinc-500',
      gradientTo: 'to-zinc-600',
      label: 'N/A',
      description: 'Score unavailable',
      Icon: XCircle,
    };
  }

  if (score >= 0.70) {
    return {
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/40',
      gradientFrom: 'from-emerald-500',
      gradientTo: 'to-green-600',
      label: 'Highly Desirable',
      description: 'Strong long opportunity',
      Icon: TrendingUp,
    };
  }

  if (score >= 0.50) {
    return {
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/40',
      gradientFrom: 'from-amber-500',
      gradientTo: 'to-yellow-600',
      label: 'Moderately Desirable',
      description: 'Good opportunity',
      Icon: TrendingUp,
    };
  }

  if (score >= 0.30) {
    return {
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/40',
      gradientFrom: 'from-orange-500',
      gradientTo: 'to-red-500',
      label: 'Acceptable',
      description: 'Marginal opportunity',
      Icon: AlertTriangle,
    };
  }

  return {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/40',
    gradientFrom: 'from-red-500',
    gradientTo: 'to-rose-600',
    label: 'Not Desirable',
    description: 'Weak structure',
    Icon: TrendingDown,
  };
}

function getReoccurrenceConfig(probability: number | null) {
  if (probability === null) {
    return {
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/10',
      borderColor: 'border-zinc-500/40',
      gradientFrom: 'from-zinc-500',
      gradientTo: 'to-zinc-600',
      label: 'N/A',
      description: 'Data unavailable',
      Icon: XCircle,
    };
  }

  if (probability >= 0.70) {
    return {
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/40',
      gradientFrom: 'from-blue-500',
      gradientTo: 'to-indigo-600',
      label: 'High Probability',
      description: 'Pattern repeats frequently',
      Icon: RefreshCw,
    };
  }

  if (probability >= 0.50) {
    return {
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/40',
      gradientFrom: 'from-cyan-500',
      gradientTo: 'to-blue-500',
      label: 'Moderate Probability',
      description: 'Pattern repeats occasionally',
      Icon: RefreshCw,
    };
  }

  if (probability >= 0.30) {
    return {
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/40',
      gradientFrom: 'from-indigo-500',
      gradientTo: 'to-purple-500',
      label: 'Low Probability',
      description: 'Pattern repeats infrequently',
      Icon: AlertTriangle,
    };
  }

  return {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/40',
    gradientFrom: 'from-purple-500',
    gradientTo: 'to-pink-500',
    label: 'Very Low Probability',
    description: 'Pattern rarely repeats',
    Icon: TrendingDown,
  };
}

const LiveDataDashboardInner: React.FC<LiveDataDashboardProps> = ({
  company,
  symbol,
  currentData,
  desirabilityScore,
  desirabilityClassification,
  desirabilityData,
  desirabilityLoading,
  onRefreshDesirability,
  overallSentiment,
  isSentimentFetching,
}) => {
  const desirabilityConfig = useMemo(() => getDesirabilityConfig(desirabilityScore), [desirabilityScore]);
  const reoccurrenceProbability = desirabilityData?.top_pattern?.reoccurrence_probability ?? null;
  const reoccurrenceConfig = useMemo(() => getReoccurrenceConfig(reoccurrenceProbability), [reoccurrenceProbability]);
  const details = desirabilityData?.top_pattern?.details;

  // UMAP v2 Clustering Hooks
  const { data: umapAnalysis, loading: umapLoading } = useClusteringAnalysis(symbol, 7, !!symbol);
  const { data: umapConfidence } = useClusteringConfidence(symbol, 7, !!symbol);
  const { data: umapActiveClusters } = useActiveClusters(symbol, 7, !!symbol);

  const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return '0.00';
    return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined || change === null) return '+0.00 (0.00%)';
    const sign = change >= 0 ? '+' : '';
    const percent = changePercent ?? 0;
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const getChangeClass = (change?: number) => {
    if (change === undefined || change === null) return 'text-muted-foreground';
    return change >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  // Circular gauge for scores
  const radius = 55;
  const circumference = 2 * Math.PI * radius;

  // No company selected state
  if (!company) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-muted/50 rounded-full">
          <Building2 className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">No Company Selected</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Select a company from the sidebar to view live market data
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!currentData) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
        <p className="text-muted-foreground text-sm">Connecting to market data...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
      
      {/* Left Column - Desirability & Reoccurrence Scores */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Desirability Score Card */}
        <Card className="relative overflow-hidden border border-border/50 bg-card shadow-xl">
          {/* Gradient tint at corners based on score */}
          <div className={cn(
            "absolute top-0 left-0 w-32 h-32 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2",
            desirabilityScore !== null && desirabilityScore >= 0.5 ? "bg-emerald-500/15" : "bg-orange-500/10"
          )} />
          <div className={cn(
            "absolute bottom-0 right-0 w-32 h-32 rounded-full blur-3xl translate-x-1/2 translate-y-1/2",
            desirabilityScore !== null && desirabilityScore >= 0.5 ? "bg-emerald-500/10" : "bg-red-500/10"
          )} />
          
          <CardContent className="relative pt-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">Desirability</span>
              </div>
              <Badge 
                className={cn(
                  "px-3 py-1 text-xs font-semibold",
                  desirabilityConfig.bgColor,
                  desirabilityConfig.color,
                  `border ${desirabilityConfig.borderColor}`
                )}
              >
                {desirabilityConfig.label}
              </Badge>
            </div>

            {/* Circular Score Gauge */}
            <div className="flex justify-center mb-6">
              <div className="relative w-40 h-40">
                {desirabilityLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 150 150">
                      {/* Background circle */}
                      <circle
                        cx="75"
                        cy="75"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        className="text-muted/20"
                      />
                      {/* Score circle */}
                      <circle
                        cx="75"
                        cy="75"
                        r={radius}
                        stroke={`url(#desirabilityGradient)`}
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - ((desirabilityScore ?? 0) * circumference)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="desirabilityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={desirabilityScore !== null && desirabilityScore >= 0.5 ? '#10b981' : '#f59e0b'} />
                          <stop offset="100%" stopColor={desirabilityScore !== null && desirabilityScore >= 0.5 ? '#059669' : '#ef4444'} />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn("text-4xl font-bold tracking-tighter tabular-nums", desirabilityConfig.color)}>
                        {desirabilityScore !== null ? `${Math.round(desirabilityScore * 100)}%` : 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">score</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center mb-4">
              {desirabilityConfig.description}
            </p>

            {/* Details Grid */}
            {details && (
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-muted/30 rounded-lg p-2 text-center border border-border/50 cursor-help">
                        <div className="text-muted-foreground">Trend</div>
                        <div className="font-semibold text-foreground">{details.trend_strength?.toFixed(2) ?? 'N/A'}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Trend strength indicator</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="bg-muted/30 rounded-lg p-2 text-center border border-border/50 cursor-help">
                        <div className="text-muted-foreground">Drawdown</div>
                        <div className="font-semibold text-red-400">{details.max_drawdown ? `${(details.max_drawdown * 100).toFixed(1)}%` : 'N/A'}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Maximum drawdown percentage</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        {/* Reoccurrence Score Card */}
        <Card className="relative overflow-hidden border border-border/50 bg-card shadow-xl">
          {/* Blue tint at corners */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          <CardContent className="relative pt-6">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-semibold text-foreground">Reoccurrence</span>
              </div>
              <Badge 
                className={cn(
                  "px-3 py-1 text-xs font-semibold",
                  reoccurrenceConfig.bgColor,
                  reoccurrenceConfig.color,
                  `border ${reoccurrenceConfig.borderColor}`
                )}
              >
                {reoccurrenceConfig.label}
              </Badge>
            </div>

            {/* Circular Score Gauge */}
            <div className="flex justify-center mb-6">
              <div className="relative w-40 h-40">
                {desirabilityLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 150 150">
                      {/* Background circle */}
                      <circle
                        cx="75"
                        cy="75"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="10"
                        fill="none"
                        className="text-muted/20"
                      />
                      {/* Score circle */}
                      <circle
                        cx="75"
                        cy="75"
                        r={radius}
                        stroke="url(#reoccurrenceGradient)"
                        strokeWidth="10"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - ((reoccurrenceProbability ?? 0) * circumference)}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="reoccurrenceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn("text-4xl font-bold tracking-tighter tabular-nums", reoccurrenceConfig.color)}>
                        {reoccurrenceProbability !== null ? `${(reoccurrenceProbability * 100).toFixed(0)}%` : 'N/A'}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">probability</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground text-center mb-4">
              {reoccurrenceConfig.description}
            </p>

            {/* Refresh Button */}
            <Button
              onClick={onRefreshDesirability}
              disabled={desirabilityLoading}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-500"
            >
              {desirabilityLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Scores
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Live Market Data */}
      <div className="lg:col-span-8">
        <Card className="h-full border border-border/50 bg-card shadow-xl overflow-hidden relative">
          {/* Blue tint at corners */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
          
          <CardHeader className="relative border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Activity className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                    {symbol}
                    <span className="text-xs text-emerald-400 animate-pulse flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      LIVE
                    </span>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Updated: {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
                  </CardDescription>
                </div>
              </div>
              
              {/* Sentiment Badge */}
              {isSentimentFetching ? (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <Badge className={cn(
                  "px-3 py-1.5 text-xs font-semibold",
                  overallSentiment === 'POSITIVE'
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : overallSentiment === 'NEGATIVE'
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  {overallSentiment === 'POSITIVE' ? (
                    <><TrendingUp className="h-3 w-3 mr-1" /> Positive</>
                  ) : overallSentiment === 'NEGATIVE' ? (
                    <><TrendingDown className="h-3 w-3 mr-1" /> Negative</>
                  ) : (
                    'Neutral'
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="relative pt-6 space-y-6">
            {/* Price Hero Section */}
            <div className="flex items-baseline gap-4">
              <div className="text-5xl font-bold tracking-tight text-foreground">
                ₹{formatPrice(currentData.ltp)}
              </div>
              <div className={cn(
                "flex items-center gap-1 text-lg font-semibold",
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

            {/* OHLC Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-emerald-500/30 transition-colors">
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
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-blue-500/30 transition-colors">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Close</div>
                <div className="text-xl font-bold text-foreground tabular-nums">₹{formatPrice(currentData.close)}</div>
              </div>
            </div>

            {/* Volume & Indicators */}
            <div className="grid grid-cols-2 gap-4">
              {/* Volume Card */}
              <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-foreground">Volume</span>
                </div>
                <div className="text-2xl font-bold text-foreground tabular-nums">
                  {currentData.volume?.toLocaleString() ?? '0'}
                </div>
              </div>

              {/* Technical Indicators */}
              {(currentData.sma_20 || currentData.ema_9 || currentData.rsi_14) && (
                <div className="bg-muted/20 rounded-xl p-4 border border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-semibold text-foreground">Indicators</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {currentData.sma_20 && (
                      <div>
                        <div className="text-orange-400 font-medium">SMA 20</div>
                        <div className="text-foreground font-semibold">₹{formatPrice(currentData.sma_20)}</div>
                      </div>
                    )}
                    {currentData.ema_9 && (
                      <div>
                        <div className="text-purple-400 font-medium">EMA 9</div>
                        <div className="text-foreground font-semibold">₹{formatPrice(currentData.ema_9)}</div>
                      </div>
                    )}
                    {currentData.rsi_14 && (
                      <div>
                        <div className="text-cyan-400 font-medium">RSI 14</div>
                        <div className="text-foreground font-semibold">{currentData.rsi_14.toFixed(2)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Day Range Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Day Range</span>
                <span>₹{formatPrice(currentData.low)} — ₹{formatPrice(currentData.high)}</span>
              </div>
              <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
                <div 
                  className="absolute h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full"
                  style={{ width: '100%' }}
                />
                {/* Current price marker */}
                {currentData.low && currentData.high && currentData.ltp && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-blue-500 shadow-lg"
                    style={{ 
                      left: `${Math.max(0, Math.min(100, ((currentData.ltp - currentData.low) / (currentData.high - currentData.low)) * 100))}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}
              </div>
            </div>

            {/* UMAP Cluster Summary */}
            {(umapAnalysis || umapLoading) && (
              <div className="bg-muted/20 rounded-xl p-4 border border-violet-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                  <span className="text-sm font-semibold text-foreground">UMAP Cluster Insights</span>
                  {umapLoading && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
                </div>
                {umapAnalysis ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/30 rounded-lg p-2 text-center border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase">Confidence</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {umapConfidence ? `${(umapConfidence.overall_confidence * 100).toFixed(0)}%` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase">Noise</div>
                        <div className="text-sm font-bold text-amber-400">
                          {`${((umapAnalysis.noise?.total_noise_fraction ?? 0) * 100).toFixed(1)}%`}
                        </div>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 text-center border border-border/50">
                        <div className="text-[10px] text-muted-foreground uppercase">Clusters</div>
                        <div className="text-sm font-bold text-violet-400">
                          {umapActiveClusters?.n_active_clusters ?? umapAnalysis.active_clusters?.count}
                        </div>
                      </div>
                    </div>
                    {/* Top archetypes */}
                    {umapActiveClusters?.clusters && umapActiveClusters.clusters.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {umapActiveClusters.clusters.slice(0, 4).map((cluster: any, idx: number) => {
                          const archetype = cluster.profile?.pattern_archetype || 'unknown';
                          const color = ARCHETYPE_COLORS[archetype as keyof typeof ARCHETYPE_COLORS] || '#71717a';
                          return (
                            <span key={idx} className="inline-flex items-center gap-1 text-[10px] bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-muted-foreground capitalize">{archetype.replace(/_/g, ' ')}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-xs text-muted-foreground">Loading cluster data...</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const LiveDataDashboard = React.memo(LiveDataDashboardInner);
