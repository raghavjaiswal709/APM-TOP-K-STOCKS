// @ts-nocheck
'use client';

import React from 'react';
import type { ActiveClustersResponse, ActiveCluster } from '@/types/clustering';
import { ARCHETYPE_COLORS, ARCHETYPE_ICONS } from '@/types/clustering';
import {
  TrendingUp, TrendingDown, Activity, Shield, Zap, Clock, Target, BarChart3
} from 'lucide-react';

interface ActiveClustersPanelProps {
  data: ActiveClustersResponse | null;
  loading?: boolean;
  isDark?: boolean;
}

function formatPct(v: number, mult = 100) {
  return `${(v * mult).toFixed(1)}%`;
}

function ArchetypeBadge({ archetype }: { archetype: string }) {
  const color = ARCHETYPE_COLORS[archetype] || '#8b5cf6';
  const icon = ARCHETYPE_ICONS[archetype] || '';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border"
      style={{
        color,
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
      }}
    >
      <span>{icon}</span> {archetype.replace('_', ' ')}
    </span>
  );
}

function MetricPill({ label, value, color = 'text-foreground' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: ActiveCluster }) {
  const p = cluster.profile;
  const avgReturnPct = p?.avg_return_pct ?? p?.avg_return ?? 0;
  const isPositiveReturn = avgReturnPct >= 0;
  // h_label lives on the cluster itself, not on profile
  const label = cluster.h_label ?? p?.h_label ?? `C${cluster.cluster_id}`;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 hover:border-accent transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-violet-400">{label}</span>
          <ArchetypeBadge archetype={p?.pattern_archetype ?? 'Indecision'} />
        </div>
        <span className="text-xs text-muted-foreground">
          Cluster #{cluster.cluster_id} • {cluster.days_in_window}d active
        </span>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-4 gap-3 py-2 border-y border-border">
        <MetricPill
          label="Win Rate"
          value={formatPct(p?.win_rate ?? 0)}
          color={(p?.win_rate ?? 0) >= 0.5 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricPill
          label="Avg Return"
          value={`${(avgReturnPct * 100).toFixed(3)}%`}
          color={isPositiveReturn ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricPill
          label="RAR"
          value={(p?.risk_adjusted_return ?? 0).toFixed(3)}
          color={(p?.risk_adjusted_return ?? 0) >= 0 ? 'text-blue-400' : 'text-red-400'}
        />
        <MetricPill
          label="Volatility"
          value={`${((p?.avg_volatility_pct ?? p?.avg_volatility ?? 0) * 100).toFixed(2)}%`}
          color="text-amber-400"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-5 gap-2">
        <MetricPill label="Persistence" value={(p?.persistence ?? 0).toFixed(1)} />
        <MetricPill label="Similarity" value={formatPct(p?.intra_pattern_similarity ?? 0)} />
        <MetricPill label="Days" value={`${p?.n_days ?? 0}`} />
        <MetricPill label="Noise" value={formatPct(cluster.noise_fraction ?? 0)} color={(cluster.noise_fraction ?? 0) > 0.5 ? 'text-amber-400' : 'text-foreground'} />
        <MetricPill label="Recurrence" value={`${p?.recurrence_rate?.toFixed(1) ?? 'N/A'}`} />
      </div>

      {/* Distribution info (from actual API fields) */}
      {(cluster.volatility_distribution || cluster.trend_distribution) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {cluster.volatility_distribution && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Vol: {Object.entries(cluster.volatility_distribution).map(([k, v]) => `${k}:${typeof v === 'number' ? v : 0}`).join(' ')}
            </span>
          )}
          {cluster.trend_distribution && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Trend: {Object.entries(cluster.trend_distribution).map(([k, v]) => `${k}:${typeof v === 'number' ? v : 0}`).join(' ')}
            </span>
          )}
        </div>
      )}

      {/* Derived quality flags */}
      <div className="flex flex-wrap gap-1.5">
        {(p?.persistence ?? 0) > 0.3 && (
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] rounded-full border border-blue-500/30">Persistent</span>
        )}
        {(p?.intra_pattern_similarity ?? 0) > 0.7 && (
          <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[10px] rounded-full border border-violet-500/30">High Similarity</span>
        )}
        {(p?.win_rate ?? 0) > 0.5 && avgReturnPct > 0 && (
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] rounded-full border border-emerald-500/30">Profitable</span>
        )}
        {(cluster.noise_fraction ?? 0) > 0.5 && (
          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded-full border border-amber-500/30">High Noise</span>
        )}
      </div>
    </div>
  );
}

export default function ActiveClustersPanel({ data, loading }: ActiveClustersPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.clusters.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
        No active clusters in the selected window
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-foreground">
          Active Clusters <span className="text-violet-400">({data.n_active_clusters})</span>
        </h3>
        <span className="text-xs text-muted-foreground">{data.window_days}-day window</span>
      </div>
      {data.clusters.map((cluster) => (
        <ClusterCard key={cluster.cluster_id} cluster={cluster} />
      ))}
    </div>
  );
}
