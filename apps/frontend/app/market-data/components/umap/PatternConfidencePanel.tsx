// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { PatternConfidenceResponse, PerClusterConfidence } from '@/types/clustering';
import { PATTERN_COLORS } from '@/types/clustering';
import { Shield, Eye, Gem, BarChart3 } from 'lucide-react';
import { getChartTheme } from './chartTheme';

interface PatternConfidencePanelProps {
  data: PatternConfidenceResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

function QualityGauge({ label, value, max, icon: Icon, color }: { label: string; value: number; max: number; icon: any; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value + (max < 0 ? 1 : 0)) / (max + (max < 0 ? 1 : 0))) * 100));
  const displayValue = value.toFixed(3);

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <span className={`text-sm font-bold ${color}`}>{displayValue}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color.includes('emerald') ? '#22c55e' : color.includes('violet') ? '#8b5cf6' : color.includes('blue') ? '#3b82f6' : '#f59e0b' }}
        />
      </div>
    </div>
  );
}

export default function PatternConfidencePanel({ data, loading, height = 300, isDark = true }: PatternConfidencePanelProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);

  const chartTraces = useMemo(() => {
    if (!data?.per_cluster_confidence?.length) return [];

    const clusters = data.per_cluster_confidence;

    return [
      // Confidence bar
      {
        x: clusters.map((c) => `C${c.cluster_id}`),
        y: clusters.map((c) => c.avg_confidence),
        type: 'bar' as const,
        name: 'Avg Confidence',
        marker: {
          color: clusters.map((_, i) => PATTERN_COLORS[i % PATTERN_COLORS.length]),
          opacity: 0.85,
        },
        error_y: {
          type: 'data' as const,
          symmetric: false,
          array: clusters.map((c) => c.max_confidence - c.avg_confidence),
          arrayminus: clusters.map((c) => c.avg_confidence - c.min_confidence),
          color: '#71717a',
          thickness: 1.5,
          width: 4,
        },
        text: clusters.map((c) => `${(c.avg_confidence * 100).toFixed(0)}%`),
        textposition: 'outside' as const,
        textfont: { size: 10, color: C.textBright },
        hovertemplate:
          '<b>Cluster %{x}</b><br>' +
          'Avg: %{y:.3f}<br>' +
          'Range: %{error_y.arrayminus:.3f} – %{error_y.array:.3f}<br>' +
          '<extra></extra>',
      },
    ];
  }, [data, C]);

  const chartLayout = useMemo(
    () => ({
      title: {
        text: '<b>Per-Cluster Confidence</b> <sub>(with min/max range)</sub>',
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      xaxis: {
        color: C.text,
        tickfont: { size: 11, color: C.textBright },
      },
      yaxis: {
        title: { text: 'Confidence', font: { size: 11, color: C.text } },
        range: [0, 1.15],
        color: C.text,
        gridcolor: C.grid,
        tickfont: { size: 10, color: C.text },
      },
      plot_bgcolor: C.bg,
      paper_bgcolor: C.bg,
      font: { color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      height,
      margin: { l: 50, r: 16, t: 40, b: 30 },
      showlegend: false,
    }),
    [height, C]
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
        No confidence data available
      </div>
    );
  }

  const q = data.quality_metrics;

  return (
    <div className="space-y-3">
      {/* Quality metrics gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <QualityGauge
          label="Silhouette"
          value={q.silhouette_score}
          max={1}
          icon={Shield}
          color="text-emerald-400"
        />
        <QualityGauge
          label="Silhouette (Reduced)"
          value={q.silhouette_reduced}
          max={1}
          icon={BarChart3}
          color="text-blue-400"
        />
        <QualityGauge
          label="Trustworthiness"
          value={q.trustworthiness}
          max={1}
          icon={Eye}
          color="text-violet-400"
        />
        <QualityGauge
          label="DBCV"
          value={q.dbcv}
          max={1}
          icon={Gem}
          color="text-amber-400"
        />
      </div>

      {/* Overall stats */}
      <div className="flex gap-4 px-1">
        <span className="text-xs text-muted-foreground">
          Overall Confidence: <span className="text-violet-400 font-semibold">{(data.overall_avg_confidence * 100).toFixed(1)}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Consistency: <span className="text-emerald-400 font-semibold">{data.overall_consistency_pct.toFixed(1)}%</span>
        </span>
      </div>

      {/* Per-cluster chart */}
      <Plot
        data={chartTraces as any}
        layout={chartLayout}
        config={{ responsive: true, displayModeBar: false }}
        useResizeHandler
        style={{ width: '100%', height }}
      />

      {/* Per-cluster details table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="px-2 py-1.5 text-left">Cluster</th>
              <th className="px-2 py-1.5 text-right">Avg</th>
              <th className="px-2 py-1.5 text-right">Min</th>
              <th className="px-2 py-1.5 text-right">Max</th>
              <th className="px-2 py-1.5 text-right">Consistency</th>
              <th className="px-2 py-1.5 text-right">Days</th>
              <th className="px-2 py-1.5 text-right">Similarity</th>
            </tr>
          </thead>
          <tbody>
            {data.per_cluster_confidence.map((c, i) => (
              <tr key={c.cluster_id} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-2 py-1.5 font-medium" style={{ color: PATTERN_COLORS[i % PATTERN_COLORS.length] }}>
                  C{c.cluster_id}
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">{(c.avg_confidence * 100).toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{(c.min_confidence * 100).toFixed(0)}%</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{(c.max_confidence * 100).toFixed(0)}%</td>
                <td className="px-2 py-1.5 text-right text-foreground">{c.consistency_pct.toFixed(1)}%</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{c.n_days}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{(c.intra_pattern_similarity * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
