// @ts-nocheck
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  useClusteringSymbols,
  useClusteringAnalysis,
  useClusteringConfidence,
  useClusteringNoise,
  useActiveClusters,
  usePatternRiskReturn,
  usePatternNoiseDistribution,
  usePatternRegimeDistribution,
  usePatternConfidence,
  useIntradayShapes,
} from '@/hooks/useClusteringV2';
import type { ClusteringAnalysisResponse } from '@/types/clustering';
import { ARCHETYPE_COLORS, ARCHETYPE_ICONS } from '@/types/clustering';

import ConfidenceChart from './ConfidenceChart';
import NoiseChart from './NoiseChart';
import PatternRiskReturnChart from './PatternRiskReturnChart';
import NoiseDistributionChart from './NoiseDistributionChart';
import RegimeDistributionChart from './RegimeDistributionChart';
import IntradayShapesChart from './IntradayShapesChart';
import ActiveClustersPanel from './ActiveClustersPanel';
import PatternConfidencePanel from './PatternConfidencePanel';

import {
  Activity, BarChart3, TrendingUp, Shield, Zap,
  RefreshCw, ChevronDown, Layers, Eye, Volume2,
  GitBranch, Fingerprint, Target, Clock,
} from 'lucide-react';

// ─── Window presets ──────────────────────────────────────────────────────────
const WINDOW_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '15d', value: 15 },
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
];

// ─── Overview Metric Card ────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-violet-400',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3 hover:border-muted-foreground/40 transition-colors">
      <div className={`p-2 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${color.includes('violet') ? '#8b5cf6' : color.includes('emerald') ? '#22c55e' : color.includes('amber') ? '#f59e0b' : color.includes('blue') ? '#3b82f6' : '#ef4444'}15` }}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, className = '' }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-background border border-border rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function UMAPClusterDashboard({ initialSymbol = 'RELIANCE' }: { initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [window, setWindow] = useState(7);
  const { theme: appTheme } = useTheme();
  const isDark = appTheme !== 'light';

  // Sync symbol when parent changes selection (sidebar company switch)
  useEffect(() => {
    if (initialSymbol && initialSymbol !== symbol) {
      setSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: symbolsData, loading: symbolsLoading } = useClusteringSymbols();
  const { data: analysis, loading: analysisLoading, error: analysisError, refetch: refetchAnalysis } = useClusteringAnalysis(symbol, window);
  const { data: confidence, loading: confLoading } = useClusteringConfidence(symbol, window);
  const { data: noise, loading: noiseLoading } = useClusteringNoise(symbol, window);
  const { data: activeClusters, loading: acLoading } = useActiveClusters(symbol, window);
  const { data: riskReturn, loading: rrLoading } = usePatternRiskReturn(symbol);
  const { data: noiseDist, loading: ndLoading } = usePatternNoiseDistribution(symbol);
  const { data: regime, loading: regimeLoading } = usePatternRegimeDistribution(symbol);
  const { data: patternConf, loading: pcLoading } = usePatternConfidence(symbol);
  const { data: intradayShapes, loading: isLoading } = useIntradayShapes(symbol, 30);

  const symbols = useMemo(() => symbolsData?.symbols || [], [symbolsData]);

  const handleRefresh = useCallback(() => {
    refetchAnalysis();
  }, [refetchAnalysis]);

  // ── Overview metrics from analysis ─────────────────────────────────────────
  const a = analysis;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ──────── Top Bar ──────── */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-violet-500" />
              <h1 className="text-base font-bold text-foreground">UMAP Clustering</h1>
              <span className="text-sm font-semibold text-violet-400">{symbol}</span>
            </div>
            <div className="flex items-center gap-1 bg-muted border border-border rounded-lg p-0.5">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWindow(w.value)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    window === w.value
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {symbolsData && (
              <span className="text-xs text-muted-foreground">
                {symbolsData.count.toLocaleString()} symbols available
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ──────── Error State ──────── */}
      {analysisError && (
        <div className="max-w-[1800px] mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
            {analysisError}
          </div>
        </div>
      )}

      {/* ──────── Dashboard Grid ──────── */}
      <div className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
        {/* Row 1: Overview Metrics */}
        {a && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {/* Confidence - commented out (shows N/A)
            <MetricCard
              label="Confidence"
              value={a.confidence_consistency ? `${(a.confidence_consistency.rolling_confidence * 100).toFixed(0)}%` : 'N/A'}
              sub={a.confidence_consistency ? `Overall: ${(a.confidence_consistency.overall_confidence * 100).toFixed(0)}%` : undefined}
              icon={Shield}
              color="text-violet-400"
            />
            */}
            {/* Consistency - commented out (shows N/A)
            <MetricCard
              label="Consistency"
              value={a.confidence_consistency ? `${a.confidence_consistency.rolling_consistency_pct.toFixed(0)}%` : 'N/A'}
              sub={a.confidence_consistency ? `Overall: ${a.confidence_consistency.overall_consistency_pct.toFixed(0)}%` : undefined}
              icon={Target}
              color="text-emerald-400"
            />
            */}
            <MetricCard
              label="Noise"
              value={a.noise ? `${(a.noise.rolling_noise_fraction * 100).toFixed(0)}%` : 'N/A'}
              sub={a.noise ? `Total: ${a.noise.total_noise_days}/${a.total_days} days` : undefined}
              icon={Volume2}
              color="text-amber-400"
            />
            <MetricCard
              label="Active Clusters"
              value={`${a.active_clusters?.count ?? 0}`}
              sub={`Window: ${a.analysis_window}d`}
              icon={Layers}
              color="text-blue-400"
            />
            <MetricCard
              label="Trustworthiness"
              value={a.quality_metrics?.trustworthiness?.toFixed(3) ?? 'N/A'}
              sub={a.quality_metrics ? `Silhouette: ${a.quality_metrics.silhouette_score.toFixed(3)}` : undefined}
              icon={Eye}
              color="text-cyan-400"
            />
            {/* Lineage MetricCard - commented out (data not available)
            <MetricCard
              label="Lineage"
              value={a.lineage_summary ? `${a.lineage_summary.n_canonical} canonical` : 'N/A'}
              sub={a.lineage_summary ? `${a.lineage_summary.total_runs} runs, ${a.lineage_summary.n_retired} retired` : undefined}
              icon={GitBranch}
              color="text-pink-400"
            />
            */}
          </div>
        )}

        {/* Confidence Timeseries - commented out (endpoint 404)
        <Section title="Confidence Timeseries" icon={Shield}>
          <ConfidenceChart data={confidence} loading={confLoading} height={300} isDark={isDark} />
        </Section>
        */}

        {/* Left: 3 charts stacked | Right: Active Clusters — same fixed height, both scroll */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '900px' }}>
          {/* Left column: scrollable stack of 3 charts */}
          <div className="overflow-y-auto space-y-4 pr-1">
            <Section title="Noise Density" icon={Volume2}>
              <NoiseChart data={noise} loading={noiseLoading} height={240} isDark={isDark} />
            </Section>
            <Section title="Core vs Noise Distribution" icon={BarChart3}>
              <NoiseDistributionChart data={noiseDist} loading={ndLoading} height={240} isDark={isDark} />
            </Section>
            <Section title="Regime Distribution" icon={Activity}>
              <RegimeDistributionChart data={regime} loading={regimeLoading} height={240} isDark={isDark} />
            </Section>
          </div>
          {/* Right column: scrollable Active Clusters */}
          <div className="overflow-y-auto pr-1">
            <Section title="Active Clusters" icon={Layers}>
              <ActiveClustersPanel data={activeClusters} loading={acLoading} isDark={isDark} />
            </Section>
          </div>
        </div>

        {/* Pattern Risk vs Return (full width) */}
        <Section title="Pattern Risk vs Return" icon={TrendingUp}>
          <PatternRiskReturnChart data={riskReturn} loading={rrLoading} height={380} isDark={isDark} />
        </Section>

        {/* Row 5: Intraday Shapes (full width) */}
        <Section title="Intraday Shapes" icon={Zap} className="col-span-full">
          <IntradayShapesChart data={intradayShapes} loading={isLoading} height={420} isDark={isDark} />
        </Section>

        {/* Pattern Confidence & Quality - commented out (endpoint 404)
        <Section title="Pattern Confidence & Quality" icon={Fingerprint} className="col-span-full">
          <PatternConfidencePanel data={patternConf} loading={pcLoading} height={280} isDark={isDark} />
        </Section>
        */}
      </div>
    </div>
  );
}
