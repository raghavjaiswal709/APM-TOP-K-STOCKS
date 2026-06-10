// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import Plot from '@/app/market-data/components/LazyPlot';
import type { ClusteringNoiseResponse } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface NoiseChartProps {
  data: ClusteringNoiseResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

export default function NoiseChart({ data, loading, height = 320, isDark = true }: NoiseChartProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);
  const traces = useMemo(() => {
    if (!data?.noise_density_timeseries) return [];

    const { dates, density } = data.noise_density_timeseries;

    return [
      {
        x: dates,
        y: density,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Noise Density',
        line: { color: '#f59e0b', width: 2, shape: 'spline' as const },
        fill: 'tozeroy' as const,
        fillcolor: 'rgba(245, 158, 11, 0.12)',
        hovertemplate: '<b>%{x}</b><br>Noise Density: %{y:.3f}<extra></extra>',
      },
      // Rolling noise fraction reference
      {
        x: dates,
        y: Array(dates.length).fill(data.rolling_noise_fraction),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Rolling (${(data.rolling_noise_fraction * 100).toFixed(1)}%)`,
        line: { color: '#ef4444', width: 1.5, dash: 'dash' as const },
        hoverinfo: 'skip' as const,
      },
      // Total noise fraction reference
      {
        x: dates,
        y: Array(dates.length).fill(data.total_noise_fraction),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `Total (${(data.total_noise_fraction * 100).toFixed(1)}%)`,
        line: { color: '#8b5cf6', width: 1.5, dash: 'dot' as const },
        hoverinfo: 'skip' as const,
      },
    ];
  }, [data]);

  const layout = useMemo(
    () => ({
      title: {
        text: '<b>Noise Density</b> <sub>(30-day rolling)</sub>',
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
        title: { text: 'Noise Fraction', font: { size: 11, color: C.text } },
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
        No noise data
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex gap-3 px-3 mb-1">
        <span className="text-xs text-muted-foreground">
          Noise Days: <span className="text-amber-400 font-semibold">{data.total_noise_days}</span> / {data.total_days}
        </span>
        <span className="text-xs text-muted-foreground">
          Total: <span className="text-red-400 font-semibold">{(data.total_noise_fraction * 100).toFixed(1)}%</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Rolling ({data.rolling_window}d): <span className="text-amber-400 font-semibold">{(data.rolling_noise_fraction * 100).toFixed(1)}%</span>
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
