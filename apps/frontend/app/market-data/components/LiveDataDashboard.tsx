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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesirabilityData } from '@/hooks/useDesirability';
import { useClusteringAnalysis, useClusteringConfidence, useActiveClusters } from '@/hooks/useClusteringV2';
import { ARCHETYPE_COLORS } from '@/types/clustering';

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
  company: string;
  symbol: string;
  currentData: MarketData | null;
  desirabilityScore: number | null;
  desirabilityClassification: string | null;
  desirabilityData: DesirabilityData | null;
  desirabilityLoading: boolean;
  onRefreshDesirability: () => void;
  overallSentiment?: string | null;
  isSentimentFetching?: boolean;
}

function getDesirabilityConfig(score: number | null) {
  if (score === null) return { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/40', label: 'N/A', description: 'Score unavailable', Icon: XCircle };
  if (score >= 0.70) return { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/40', label: 'Highly Desirable', description: 'Strong long opportunity', Icon: TrendingUp };
  if (score >= 0.50) return { color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/40', label: 'Moderately Desirable', description: 'Good opportunity', Icon: TrendingUp };
  if (score >= 0.30) return { color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/40', label: 'Acceptable', description: 'Marginal opportunity', Icon: AlertTriangle };
  return { color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/40', label: 'Not Desirable', description: 'Weak structure', Icon: TrendingDown };
}

function getReoccurrenceConfig(probability: number | null) {
  if (probability === null) return { color: 'text-zinc-400', bgColor: 'bg-zinc-500/10', borderColor: 'border-zinc-500/40', label: 'N/A', description: 'Data unavailable', Icon: XCircle };
  if (probability >= 0.70) return { color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/40', label: 'High Probability', description: 'Pattern repeats frequently', Icon: RefreshCw };
  if (probability >= 0.50) return { color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/40', label: 'Moderate Probability', description: 'Pattern repeats occasionally', Icon: RefreshCw };
  if (probability >= 0.30) return { color: 'text-indigo-400', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/40', label: 'Low Probability', description: 'Pattern repeats infrequently', Icon: AlertTriangle };
  return { color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/40', label: 'Very Low Probability', description: 'Pattern rarely repeats', Icon: TrendingDown };
}

const MiniGauge: React.FC<{ value: number | null; color: string; loading: boolean }> = ({ value, color, loading }) => {
  const r = 22;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-14 h-14 shrink-0">
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="4" fill="none" className="text-muted/20" />
            <circle
              cx="28" cy="28" r={r}
              stroke={color}
              strokeWidth="4" fill="none"
              strokeDasharray={circ}
              strokeDashoffset={circ - ((value ?? 0) * circ)}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold tabular-nums leading-none" style={{ color }}>
              {value !== null ? `${Math.round(value * 100)}%` : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

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

  const { data: umapAnalysis, loading: umapLoading } = useClusteringAnalysis(symbol, 7, !!symbol);
  const { data: umapConfidence } = useClusteringConfidence(symbol, 7, !!symbol);
  const { data: umapActiveClusters } = useActiveClusters(symbol, 7, !!symbol);

  const formatPrice = (price?: number) => {
    if (price == null) return '—';
    return price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatVol = (v?: number) => {
    if (!v) return '—';
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
  };

  const getChangeClass = (change?: number) =>
    change == null ? 'text-muted-foreground' : change >= 0 ? 'text-emerald-400' : 'text-red-400';

  const formatChange = (change?: number, pct?: number) => {
    if (change == null) return '+0.00 (0.00%)';
    const s = change >= 0 ? '+' : '';
    return `${s}${change.toFixed(2)} (${s}${(pct ?? 0).toFixed(2)}%)`;
  };

  if (!company) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-8">
        <div className="w-14 h-14 bg-muted/50 rounded-full flex items-center justify-center">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">No Company Selected</h3>
          <p className="text-xs text-muted-foreground mt-1">Select a company from the sidebar</p>
        </div>
      </div>
    );
  }

  if (!currentData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
        <p className="text-xs text-muted-foreground">Connecting to market data...</p>
      </div>
    );
  }

  const desirabilityGaugeColor = desirabilityScore !== null && desirabilityScore >= 0.5 ? '#10b981' : '#f59e0b';

  return (
    <div className="p-3 space-y-3">

      {/* ── Row 1: Symbol + Price + Sentiment ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/30 pb-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Activity className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
              {symbol}
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Updated: {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
            </div>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tabular-nums">₹{formatPrice(currentData.ltp)}</span>
          <span className={cn('text-sm font-semibold flex items-center gap-0.5', getChangeClass(currentData.change))}>
            {(currentData.change ?? 0) >= 0
              ? <ArrowUpRight className="h-4 w-4" />
              : <ArrowDownRight className="h-4 w-4" />}
            {formatChange(currentData.change, currentData.changePercent)}
          </span>
        </div>

        <div className="ml-auto">
          {isSentimentFetching ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px] text-muted-foreground">...</span>
            </div>
          ) : (
            <Badge className={cn(
              'px-2 py-0.5 text-[10px] font-semibold',
              overallSentiment === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : overallSentiment === 'NEGATIVE' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-muted text-muted-foreground border border-border'
            )}>
              {overallSentiment === 'POSITIVE' ? <><TrendingUp className="h-2.5 w-2.5 mr-0.5 inline" />Positive</>
                : overallSentiment === 'NEGATIVE' ? <><TrendingDown className="h-2.5 w-2.5 mr-0.5 inline" />Negative</>
                : 'Neutral'}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Row 2: OHLC + Volume ── */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { label: 'Open',  val: formatPrice(currentData.open),  cls: 'text-foreground' },
          { label: 'High',  val: formatPrice(currentData.high),  cls: 'text-emerald-400' },
          { label: 'Low',   val: formatPrice(currentData.low),   cls: 'text-red-400' },
          { label: 'Close', val: formatPrice(currentData.close), cls: 'text-foreground' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-muted/20 rounded-lg px-2 py-1.5 border border-border/40">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
            <div className={cn('text-sm font-bold tabular-nums', cls)}>₹{val}</div>
          </div>
        ))}
        <div className="bg-muted/20 rounded-lg px-2 py-1.5 border border-border/40">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
            <BarChart3 className="h-2.5 w-2.5" />Vol
          </div>
          <div className="text-sm font-bold text-blue-400 tabular-nums">{formatVol(currentData.volume)}</div>
        </div>
      </div>

      {/* ── Row 3: Day Range ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Day Range</span>
          <span>₹{formatPrice(currentData.low)} — ₹{formatPrice(currentData.high)}</span>
        </div>
        <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div className="absolute h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full w-full" />
          {currentData.low && currentData.high && currentData.ltp && (
            <div
              className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full border-2 border-blue-500 shadow"
              style={{
                left: `${Math.max(0, Math.min(100, ((currentData.ltp - currentData.low) / (currentData.high - currentData.low)) * 100))}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </div>
      </div>

      {/* ── Row 4: Desirability + Reoccurrence ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Desirability */}
        <div className="rounded-lg p-2 border border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <MiniGauge value={desirabilityScore} color={desirabilityGaugeColor} loading={desirabilityLoading} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 mb-0.5">
                <Gauge className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-semibold text-foreground">Desirability</span>
              </div>
              <span className={cn('text-[9px] font-medium', desirabilityConfig.color)}>{desirabilityConfig.label}</span>
              <p className="text-[9px] text-muted-foreground leading-snug">{desirabilityConfig.description}</p>
            </div>
          </div>
          {details && (
            <div className="grid grid-cols-2 gap-1 mt-1.5">
              <div className="bg-muted/30 rounded px-1.5 py-1 text-center">
                <div className="text-[9px] text-muted-foreground">Trend</div>
                <div className="text-[10px] font-semibold text-foreground">{details.trend_strength?.toFixed(2) ?? 'N/A'}</div>
              </div>
              <div className="bg-muted/30 rounded px-1.5 py-1 text-center">
                <div className="text-[9px] text-muted-foreground">Drawdown</div>
                <div className="text-[10px] font-semibold text-red-400">{details.max_drawdown ? `${(details.max_drawdown * 100).toFixed(1)}%` : 'N/A'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Reoccurrence */}
        <div className="rounded-lg p-2 border border-border/50 bg-muted/20">
          <div className="flex items-center gap-2">
            <MiniGauge value={reoccurrenceProbability} color="#6366f1" loading={desirabilityLoading} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 mb-0.5">
                <RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-semibold text-foreground">Reoccurrence</span>
              </div>
              <span className={cn('text-[9px] font-medium', reoccurrenceConfig.color)}>{reoccurrenceConfig.label}</span>
              <p className="text-[9px] text-muted-foreground leading-snug">{reoccurrenceConfig.description}</p>
            </div>
          </div>
          <Button
            onClick={onRefreshDesirability}
            disabled={desirabilityLoading}
            size="sm"
            variant="outline"
            className="w-full mt-1.5 h-6 text-[10px] gap-1 border-border/60 hover:bg-muted/50"
          >
            {desirabilityLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Row 5: Technical Indicators ── */}
      {(currentData.sma_20 || currentData.ema_9 || currentData.rsi_14) && (
        <div className="bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3 w-3 text-purple-400" />
            <span className="text-[11px] font-semibold text-foreground">Indicators</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {currentData.sma_20 && (
              <div>
                <div className="text-[9px] text-orange-400 font-medium">SMA 20</div>
                <div className="text-sm font-semibold text-foreground">₹{formatPrice(currentData.sma_20)}</div>
              </div>
            )}
            {currentData.ema_9 && (
              <div>
                <div className="text-[9px] text-purple-400 font-medium">EMA 9</div>
                <div className="text-sm font-semibold text-foreground">₹{formatPrice(currentData.ema_9)}</div>
              </div>
            )}
            {currentData.rsi_14 && (
              <div>
                <div className="text-[9px] text-cyan-400 font-medium">RSI 14</div>
                <div className="text-sm font-semibold text-foreground">{currentData.rsi_14.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 6: UMAP Cluster Summary ── */}
      {(umapAnalysis || umapLoading) && (
        <div className="bg-muted/20 rounded-lg px-3 py-2 border border-violet-500/20">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span className="text-[11px] font-semibold text-foreground">UMAP Clusters</span>
            {umapLoading && <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
          </div>
          {umapAnalysis ? (
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-muted/30 rounded px-1.5 py-1 text-center">
                  <div className="text-[9px] text-muted-foreground">Confidence</div>
                  <div className="text-xs font-bold text-emerald-400">
                    {umapConfidence ? `${(umapConfidence.overall_confidence * 100).toFixed(0)}%` : 'N/A'}
                  </div>
                </div>
                <div className="bg-muted/30 rounded px-1.5 py-1 text-center">
                  <div className="text-[9px] text-muted-foreground">Noise</div>
                  <div className="text-xs font-bold text-amber-400">
                    {`${((umapAnalysis.noise?.total_noise_fraction ?? 0) * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div className="bg-muted/30 rounded px-1.5 py-1 text-center">
                  <div className="text-[9px] text-muted-foreground">Clusters</div>
                  <div className="text-xs font-bold text-violet-400">
                    {umapActiveClusters?.n_active_clusters ?? umapAnalysis.active_clusters?.count}
                  </div>
                </div>
              </div>
              {umapActiveClusters?.clusters && umapActiveClusters.clusters.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {umapActiveClusters.clusters.slice(0, 4).map((cluster: any, idx: number) => {
                    const archetype = cluster.profile?.pattern_archetype || 'unknown';
                    const color = ARCHETYPE_COLORS[archetype as keyof typeof ARCHETYPE_COLORS] || '#71717a';
                    return (
                      <span key={idx} className="inline-flex items-center gap-0.5 text-[9px] bg-muted/40 px-1.5 py-0.5 rounded-full border border-border/50">
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-muted-foreground capitalize">{archetype.replace(/_/g, ' ')}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Loading cluster data...</p>
          )}
        </div>
      )}

    </div>
  );
};

export const LiveDataDashboard = React.memo(LiveDataDashboardInner);
