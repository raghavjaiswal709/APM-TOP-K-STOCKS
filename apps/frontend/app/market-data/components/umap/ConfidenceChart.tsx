// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import Plot from '@/app/market-data/components/LazyPlot';
import type { ClusteringConfidenceResponse } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface ConfidenceChartProps {
  data: ClusteringConfidenceResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

export default function ConfidenceChart({ data, loading, height = 320, isDark = true }: ConfidenceChartProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);
  const traces = useMemo(() => {
    if (!data?.confidence_timeseries) return [];

    const { dates, confidence } = data.confidence_timeseries;

    return [
      // Confidence line
      {
        x: dates,
        y: confidence,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Confidence',
        line: { color: '#8b5cf6', width: 2.5, shape: 'spline' as const },
        fill: 'tozeroy' as const,
        fillcolor: 'rgba(139, 92, 246, 0.08)',
        hovertemplate: '<b>%{x}</b><br>Confidence: %{y:.2f}<extra></extra>',
      },
      // Rolling average reference line
      {
        x: dates,
        y: Array(dates.length).fill(data.rolling_confidence),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Rolling Avg (${data.rolling_confidence.toFixed(2)})`,
        line: { color: '#f59e0b', width: 1.5, dash: 'dash' as const },
        hoverinfo: 'skip' as const,
      },
      // Overall average reference line
      {
        x: dates,
        y: Array(dates.length).fill(data.overall_confidence),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Overall (${data.overall_confidence.toFixed(2)})`,
        line: { color: '#22c55e', width: 1.5, dash: 'dot' as const },
        hoverinfo: 'skip' as const,
      },
    ];
  }, [data]);

  const layout = useMemo(
    () => ({
      title: {
        text: '<b>Confidence Timeseries</b> <sub>(60 days)</sub>',
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      xaxis: {
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
        tickangle: -45,
      },
      yaxis: {
        title: { text: 'Confidence', font: { size: 11, color: C.text } },
        range: [0, 1.05],
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
      },
      plot_bgcolor: C.bg,
      paper_bgcolor: C.bg,
      font: { color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      height,
      margin: { l: 50, r: 16, t: 40, b: 60 },
      hovermode: 'x unified' as const,
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right' as const,
        y: 1,
        bgcolor: C.legendBg,
        bordercolor: C.legendBorder,
        borderwidth: 1,
        font: { size: 10, color: C.textBright },
        orientation: 'h' as const,
      },
    }),
    [height, C]
  );

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No confidence data
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary stats row */}
      <div className="flex gap-3 px-3 mb-1">
        <span className="text-xs text-muted-foreground">
          Rolling: <span className="text-violet-400 font-semibold">{(data.rolling_confidence * 100).toFixed(1)}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Consistency: <span className="text-emerald-400 font-semibold">{data.rolling_consistency_pct.toFixed(1)}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Overall: <span className="text-blue-400 font-semibold">{(data.overall_confidence * 100).toFixed(1)}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Avg Streak: <span className="text-amber-400 font-semibold">{data.avg_consecutive_same_label.toFixed(1)} days</span>
        </span>
      </div>
      <Plot
        data={traces as any}
        layout={layout}
        config={{ responsive: true, displayModeBar: false }}
        useResizeHandler
        style={{ width: '100%', height }}
      />
    </div>
  );
}
