'use client';

import React, { useMemo, useCallback } from 'react';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Zap,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  Sparkles,
  Timer,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CompanyPredictions } from '@/hooks/usePredictions';
import { GttMultiSeriesData } from '@/lib/gttTransformers';
import { getPredictionStats, aggregatePredictions, formatDataAge } from '@/lib/predictionUtils';

interface AIPredictionsDashboardProps {
  // Polling state
  isPolling: boolean;
  elapsedTime: number;
  timeRemaining: number;
  pollCount: number;
  nextPollTime: Date | null;
  timeUntilNextPoll?: number; // kept for prop-compatibility; timer is now in the toolbar button
  
  // Actions
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onRefresh: () => void;
  
  // Predictions data
  predictions: CompanyPredictions | null;
  company: string;
  dataAge: number;
  isStale: boolean;
  isLoading: boolean;
  
  // GTT
  isGttEnabled?: boolean;
  gttLoading?: boolean;
  gttError?: string | null;
  gttData?: GttMultiSeriesData | null;
}

export const AIPredictionsDashboard: React.FC<AIPredictionsDashboardProps> = ({
  isPolling,
  elapsedTime,
  timeRemaining,
  pollCount,
  nextPollTime,
  onStart,
  onPause,
  onStop,
  onRefresh,
  predictions,
  company,
  dataAge,
  isStale,
  isLoading,
  isGttEnabled = false,
  gttLoading = false,
  gttError = null,
  gttData = null,
}) => {
  // Format time helper — guards against Infinity/NaN which can occur when
  // totalDuration is very large (7h) and elapsedTime is 0 (polling not started)
  const formatTime = useCallback((ms: number): string => {
    if (!isFinite(ms) || isNaN(ms) || ms < 0) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Calculate stats from predictions
  const stats = useMemo(() => {
    if (!predictions) return null;
    return getPredictionStats(predictions);
  }, [predictions]);

  const aggregated = useMemo(() => {
    if (!predictions) return null;
    return aggregatePredictions(predictions);
  }, [predictions]);

  const latestPrediction = useMemo(() => {
    if (!predictions || predictions.count === 0) return null;
    const entries = Object.entries(predictions.predictions);
    if (entries.length === 0) return null;
    const [timestamp, data] = entries[entries.length - 1];
    return { timestamp, ...data };
  }, [predictions]);

  const priceChange = aggregated?.priceChangeFromStart ?? 0;
  const isPositive = priceChange >= 0;

  // Check if within market hours (9:15 AM to 3:30 PM IST)
  const isWithinMarketHours = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    return currentTime >= marketOpen && currentTime <= marketClose;
  }, []); // static check — market hours don't change mid-session

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
      
      {/* Left Column - Timer & Controls */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Main Timer Card */}
        <Card className="relative overflow-hidden border border-border/50 bg-card shadow-xl">
          {/* Blue tint at corners */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          
          <CardContent className="relative pt-6">
            
            {/* Status Badge */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <span className="text-sm font-semibold text-foreground">AI Engine</span>
              </div>
              <Badge 
                className={cn(
                  "px-3 py-1 text-xs font-semibold",
                  isPolling && isWithinMarketHours
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                    : !isWithinMarketHours
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {isPolling && isWithinMarketHours ? (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    Active
                  </span>
                ) : !isWithinMarketHours ? (
                  'Market Closed'
                ) : (
                  'Paused'
                )}
              </Badge>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                <div className="text-2xl font-bold text-blue-400">{pollCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Updates</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                <div className="text-2xl font-bold font-mono text-foreground">
                  {isPolling ? formatTime(elapsedTime) : '--:--'}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Elapsed</div>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                <div className="text-2xl font-bold font-mono text-muted-foreground">
                  {isPolling ? formatTime(timeRemaining) : '--:--'}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Remaining</div>
              </div>
            </div>

            {/* Next Update Info */}
            {nextPollTime && isPolling && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/20 py-2 rounded-lg border border-border/50 mb-4">
                <Timer className="h-3.5 w-3.5 text-blue-400" />
                <span>Next update at</span>
                <span className="font-semibold text-blue-400">
                  {nextPollTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            )}
            
            {/* Market Hours Info */}
            {!isWithinMarketHours && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 bg-amber-500/10 py-2 rounded-lg border border-amber-500/20 mb-4">
                <Clock className="h-3.5 w-3.5" />
                <span>Market hours: 9:15 AM - 3:30 PM IST</span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {!isPolling ? (
                <Button
                  onClick={onStart}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 border-0"
                >
                  <Play className="h-4 w-4" />
                  Start
                </Button>
              ) : (
                <Button
                  onClick={onPause}
                  variant="secondary"
                  className="gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button
                onClick={onStop}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
            
            <Button
              onClick={onRefresh}
              disabled={isLoading}
              className="w-full mt-2 gap-2 bg-blue-600 hover:bg-blue-500"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Now
            </Button>
          </CardContent>
        </Card>

        {/* GTT Status Card */}
        {isGttEnabled && (
          <Card className="border border-border/50 bg-card shadow-lg">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Zap className="h-4 w-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">GTT Engine</h3>
                  <p className="text-xs text-muted-foreground">Get The Trend — S1 + S2 + Input Close</p>
                </div>
              </div>
              
              {gttLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading predictions...
                </div>
              ) : gttError ? (
                <div className="text-sm text-red-400">{gttError}</div>
              ) : gttData && gttData.latest ? (
                <div className="space-y-3">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
                    ✓ {gttData.total_predictions} Predictions Active
                  </Badge>

                  {/* Latest prediction details */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latest Prediction</p>
                    <div className="text-xs text-muted-foreground">
                      {(() => {
                        const pt = gttData.latest?.prediction_time;
                        if (!pt) return null;
                        const d = new Date(pt.replace(' ', 'T') + (pt.includes('+') ? '' : '+05:30'));
                        return isNaN(d.getTime()) ? pt : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                      })()}
                    </div>

                    {/* Input Close */}
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-green-500/10 border border-green-500/20">
                      <span className="text-xs flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Input Close
                      </span>
                      <span className="font-mono text-sm font-bold text-green-400">
                        ₹{gttData.latest.input_close?.toFixed(2) ?? '—'}
                      </span>
                    </div>

                    {/* S1 Model Horizons */}
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-purple-500 inline-block rounded" />
                        S1 Model (H1–H5)
                      </p>
                      <div className="grid grid-cols-5 gap-1">
                        {(['S1_H1_pred', 'S1_H2_pred', 'S1_H3_pred', 'S1_H4_pred', 'S1_H5_pred'] as const).map((key, i) => {
                          const val = gttData.latest?.[key];
                          const anchor = gttData.latest?.input_close ?? 0;
                          const diff = val != null ? val - anchor : 0;
                          const isUp = diff >= 0;
                          return (
                            <div key={key} className="bg-muted/30 rounded-lg p-1.5 text-center border border-border/50">
                              <div className="text-[9px] text-muted-foreground">+{(i + 1) * 15}m</div>
                              <div className="text-xs font-bold font-mono text-purple-400">
                                {val != null ? `₹${val.toFixed(1)}` : '—'}
                              </div>
                              {val != null && (
                                <div className={cn("text-[9px] font-mono", isUp ? "text-emerald-400" : "text-red-400")}>
                                  {isUp ? '+' : ''}{diff.toFixed(1)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* S2 Model Horizons */}
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-cyan-500 inline-block rounded" style={{ borderBottom: '1px dashed #00bcd4' }} />
                        S2 Model (H1–H5)
                      </p>
                      <div className="grid grid-cols-5 gap-1">
                        {(['S2_H1_pred', 'S2_H2_pred', 'S2_H3_pred', 'S2_H4_pred', 'S2_H5_pred'] as const).map((key, i) => {
                          const val = gttData.latest?.[key];
                          const anchor = gttData.latest?.input_close ?? 0;
                          const diff = val != null ? val - anchor : 0;
                          const isUp = diff >= 0;
                          return (
                            <div key={key} className="bg-muted/30 rounded-lg p-1.5 text-center border border-border/50">
                              <div className="text-[9px] text-muted-foreground">+{(i + 1) * 15}m</div>
                              <div className="text-xs font-bold font-mono text-cyan-400">
                                {val != null ? `₹${val.toFixed(1)}` : '—'}
                              </div>
                              {val != null && (
                                <div className={cn("text-[9px] font-mono", isUp ? "text-emerald-400" : "text-red-400")}>
                                  {isUp ? '+' : ''}{diff.toFixed(1)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Data point counts */}
                    <div className="flex gap-2 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
                      <span>{gttData.total_predictions} predictions</span>
                      <span>·</span>
                      <span>Input: {gttData.inputCloseCount} pts</span>
                      <span>·</span>
                      <span>{Object.keys(gttData.horizonCounts).filter(k => (gttData.horizonCounts[k] || 0) > 0).length} horizons</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No GTT data available</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Column - Predictions Data */}
      <div className="lg:col-span-8">
        <Card className="h-full border border-border/50 bg-card shadow-xl overflow-hidden relative">
          {/* Blue tint at corners */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
          
          <CardHeader className="relative border-b border-border/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-blue-400">
                    {company} Predictions
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-3 w-3" />
                    {predictions?.count ?? 0} data points
                    <span className="text-muted-foreground/50">•</span>
                    <Clock className="h-3 w-3" />
                    Updated {formatDataAge(dataAge)}
                  </CardDescription>
                </div>
              </div>
              
              {isStale && (
                <Badge variant="destructive" className="bg-red-500/20 text-red-400 border border-red-500/30">
                  Stale Data
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="relative pt-6 space-y-6">
            {!predictions || !stats ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Target className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No prediction data available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Start the engine to fetch predictions</p>
              </div>
            ) : (
              <>
                {/* Latest Prediction Hero */}
                {latestPrediction && (
                  <div className="relative overflow-hidden rounded-2xl bg-muted/30 p-6 border border-border/50">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                    
                    <div className="relative flex items-end justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          Latest AI Forecast
                        </p>
                        <div className="flex items-baseline gap-3">
                          <span className="text-5xl font-bold tracking-tight text-foreground">
                            ₹{latestPrediction.close.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground font-mono">
                            @ {(() => {
                              const predTime = latestPrediction.predictedat || latestPrediction.predicted_at || latestPrediction.timestamp;
                              if (!predTime) return '--:--';
                              const d = new Date(predTime);
                              return isNaN(d.getTime())
                                ? '--:--'
                                : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                            })()}
                          </span>
                        </div>
                      </div>

                      <div className={cn(
                        "flex flex-col items-end p-3 rounded-xl",
                        isPositive 
                          ? "bg-emerald-500/10 border border-emerald-500/20" 
                          : "bg-red-500/10 border border-red-500/20"
                      )}>
                        <div className={cn(
                          "flex items-center gap-1.5 text-lg font-bold",
                          isPositive ? "text-emerald-400" : "text-red-400"
                        )}>
                          {isPositive ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5" />
                          )}
                          {isPositive ? '+' : ''}₹{Math.abs(priceChange).toFixed(2)}
                        </div>
                        <span className={cn(
                          "text-sm font-semibold",
                          isPositive ? "text-emerald-500/80" : "text-red-500/80"
                        )}>
                          ({((Math.abs(priceChange) / (aggregated?.earliestPrice ?? 1)) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Average</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">₹{stats.avgPrice}</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">High</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400 tabular-nums">₹{stats.highPrice}</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-red-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Low</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400 tabular-nums">₹{stats.lowPrice}</p>
                  </div>
                  
                  <div className="bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Range</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400 tabular-nums">₹{stats.priceRange}</p>
                  </div>
                </div>

                {/* Progress Bar - Market Session Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Market Session Progress (9:15 AM - 3:30 PM)</span>
                    <span>{Math.min(100, Math.round((elapsedTime / (6.25 * 60 * 60 * 1000)) * 100))}%</span>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (elapsedTime / (6.25 * 60 * 60 * 1000)) * 100)}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIPredictionsDashboard;
