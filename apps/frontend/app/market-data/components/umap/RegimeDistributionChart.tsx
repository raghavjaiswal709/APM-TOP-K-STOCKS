// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import type { PatternRegimeDistributionResponse } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface RegimeDistributionChartProps {
  data: PatternRegimeDistributionResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

export default function RegimeDistributionChart({ data, loading, height = 380, isDark = true }: RegimeDistributionChartProps) {
  const [regimeType, setRegimeType] = useState<'volatility' | 'trend'>('volatility');
  const C = useMemo(() => getChartTheme(isDark), [isDark]);

  const VOLATILITY_COLORS: Record<string, string> = { low: '#22c55e', normal: '#3b82f6', high: '#ef4444' };
  const TREND_COLORS: Record<string, string> = { down: '#ef4444', sideways: '#f59e0b', up: '#22c55e' };

  const traces = useMemo(() => {
    if (!data) return [];

    const isVol = regimeType === 'volatility';
    const distribution = isVol ? data.volatility_distribution : data.trend_distribution;
    const labels = isVol ? data.volatility_labels : data.trend_labels;
    const colors = isVol ? VOLATILITY_COLORS : TREND_COLORS;

    const patterns = Object.keys(distribution);

    return labels.map((label) => ({
      x: patterns,
      y: patterns.map((p) => distribution[p]?.percentages?.[label] || 0),
      type: 'bar' as const,
      name: label.charAt(0).toUpperCase() + label.slice(1),
      marker: { color: colors[label] || '#8b5cf6', opacity: 0.85 },
      text: patterns.map((p) => {
        const pct = distribution[p]?.percentages?.[label] || 0;
        return pct > 5 ? `${pct.toFixed(0)}%` : '';
      }),
      textposition: 'inside' as const,
      textfont: { size: 10, color: '#fff' },
      hovertemplate: `<b>%{x}</b><br>${label}: %{y:.1f}%<extra></extra>`,
    }));
  }, [data, regimeType]);

  const layout = useMemo(
    () => ({
      title: {
        text: `<b>${regimeType === 'volatility' ? 'Volatility' : 'Trend'} Regime Distribution</b> <sub>per pattern</sub>`,
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      barmode: 'group' as const,
      xaxis: {
        title: { text: 'Pattern', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 11, color: C.textBright },
      },
      yaxis: {
        title: { text: 'Percentage (%)', font: { size: 11, color: C.text } },
        range: [0, 105],
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
      },
      plot_bgcolor: C.bg,
      paper_bgcolor: C.bg,
      font: { color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      height,
      margin: { l: 50, r: 16, t: 40, b: 40 },
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
    [height, regimeType, C]
  );

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No regime data
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Toggle buttons */}
      <div className="flex gap-2 px-3 mb-1">
        <button
          onClick={() => setRegimeType('volatility')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            regimeType === 'volatility'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              : 'bg-muted text-muted-foreground border border-border hover:bg-accent'
          }`}
        >
          Volatility
        </button>
        <button
          onClick={() => setRegimeType('trend')}
          className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            regimeType === 'trend'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-muted text-muted-foreground border border-border hover:bg-accent'
          }`}
        >
          Trend
        </button>
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
