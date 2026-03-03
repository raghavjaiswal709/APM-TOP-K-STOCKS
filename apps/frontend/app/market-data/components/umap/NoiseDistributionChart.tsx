// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import type { PatternNoiseDistributionResponse } from '@/types/clustering';
import { PATTERN_COLORS } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface NoiseDistributionChartProps {
  data: PatternNoiseDistributionResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

export default function NoiseDistributionChart({ data, loading, height = 340, isDark = true }: NoiseDistributionChartProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);
  const traces = useMemo(() => {
    if (!data?.patterns) return [];

    const patterns = data.patterns.map((p) => p.pattern);
    const coreDays = data.patterns.map((p) => p.core_days);
    const noiseDays = data.patterns.map((p) => p.noise_days);

    return [
      {
        y: patterns,
        x: coreDays,
        type: 'bar' as const,
        name: 'Core Days',
        orientation: 'h' as const,
        marker: { color: '#22c55e', opacity: 0.85 },
        text: coreDays.map(String),
        textposition: 'inside' as const,
        textfont: { size: 11, color: '#fff' },
        hovertemplate: '<b>%{y}</b><br>Core Days: %{x}<extra></extra>',
      },
      {
        y: patterns,
        x: noiseDays,
        type: 'bar' as const,
        name: 'Noise Days',
        orientation: 'h' as const,
        marker: { color: '#f59e0b', opacity: 0.85 },
        text: noiseDays.map(String),
        textposition: 'inside' as const,
        textfont: { size: 11, color: '#fff' },
        hovertemplate: '<b>%{y}</b><br>Noise Days: %{x}<extra></extra>',
      },
    ];
  }, [data]);

  const layout = useMemo(
    () => ({
      title: {
        text: '<b>Core vs Noise Days</b> <sub>per pattern</sub>',
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      barmode: 'stack' as const,
      xaxis: {
        title: { text: 'Number of Days', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
      },
      yaxis: {
        color: C.text,
        tickfont: { size: 11, color: C.textBright },
        automargin: true,
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
    [height, C]
  );

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No noise distribution data
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-3 px-3 mb-1">
        <span className="text-xs text-muted-foreground">
          Total: <span className="text-foreground font-semibold">{data.total_days} days</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Noise: <span className="text-amber-400 font-semibold">{data.total_noise_days}</span> ({(data.overall_noise_fraction * 100).toFixed(1)}%)
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
