// @ts-nocheck
'use client';

import React, { useMemo, useState } from 'react';
import Plot from '@/app/market-data/components/LazyPlot';
import type { IntradayShapesResponse } from '@/types/clustering';
import { ARCHETYPE_COLORS, PATTERN_COLORS } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface IntradayShapesChartProps {
  data: IntradayShapesResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

/**
 * Convert minute index → IST time string (market opens 9:15).
 * 0 → 09:15, 374 → 15:29
 */
function minuteToTime(min: number): string {
  const totalMin = 9 * 60 + 15 + min;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export default function IntradayShapesChart({ data, loading, height = 420, isDark = true }: IntradayShapesChartProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);
  const patternKeys = useMemo(() => (data ? Object.keys(data.patterns).sort() : []), [data]);
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  // Default to first pattern
  const activePattern = selectedPattern ?? patternKeys[0] ?? null;

  const traces = useMemo(() => {
    if (!data || !activePattern || !data.patterns[activePattern]) return [];

    const p = data.patterns[activePattern];
    const nMin = p.n_minutes;
    const xLabels = Array.from({ length: nMin }, (_, i) => minuteToTime(i));

    const result: any[] = [];

    // p25 band (lower bound, invisible)
    if (p.p25_shape?.length) {
      result.push({
        x: xLabels,
        y: p.p25_shape,
        type: 'scatter',
        mode: 'lines',
        name: 'P25',
        line: { color: 'transparent', width: 0 },
        showlegend: false,
        hoverinfo: 'skip',
      });
    }

    // p75 band (upper bound, fill down to p25)
    if (p.p75_shape?.length && p.p25_shape?.length) {
      result.push({
        x: xLabels,
        y: p.p75_shape,
        type: 'scatter',
        mode: 'lines',
        name: 'P25–P75 Band',
        line: { color: 'transparent', width: 0 },
        fill: 'tonexty',
        fillcolor: 'rgba(139, 92, 246, 0.15)',
        hoverinfo: 'skip',
      });
    }

    // Median shape (bold center)
    if (p.median_shape?.length) {
      const color = ARCHETYPE_COLORS[p.archetype] || PATTERN_COLORS[parseInt(activePattern) % PATTERN_COLORS.length];
      result.push({
        x: xLabels,
        y: p.median_shape,
        type: 'scatter',
        mode: 'lines',
        name: `Median (${p.h_label})`,
        line: { color, width: 3 },
        hovertemplate: '<b>%{x}</b><br>Shape: %{y:.4f}<extra></extra>',
      });
    }

    // Core shapes (thin semi-transparent)
    if (p.core_shapes?.length) {
      p.core_shapes.forEach((shape, i) => {
        result.push({
          x: xLabels,
          y: shape,
          type: 'scatter',
          mode: 'lines',
          name: i === 0 ? 'Core Shapes' : undefined,
          showlegend: i === 0,
          legendgroup: 'core',
          line: { color: 'rgba(139, 92, 246, 0.2)', width: 1 },
          hoverinfo: 'skip',
        });
      });
    }

    // Noise shapes (dashed gray)
    if (p.noise_shapes?.length) {
      p.noise_shapes.forEach((shape, i) => {
        result.push({
          x: xLabels,
          y: shape,
          type: 'scatter',
          mode: 'lines',
          name: i === 0 ? 'Noise Shapes' : undefined,
          showlegend: i === 0,
          legendgroup: 'noise',
          line: { color: 'rgba(113, 113, 122, 0.3)', width: 1, dash: 'dot' },
          hoverinfo: 'skip',
        });
      });
    }

    return result;
  }, [data, activePattern]);

  const layout = useMemo(() => {
    const p = data?.patterns?.[activePattern || ''];
    return {
      title: {
        text: `<b>Intraday Shape</b> — ${p?.h_label || ''} <sub>${p?.archetype || ''} | ${p?.n_core || 0} core + ${p?.n_noise || 0} noise days</sub>`,
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      xaxis: {
        title: { text: 'Time (IST)', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 9, color: C.text },
        tickangle: -45,
        nticks: 20,
      },
      yaxis: {
        title: { text: 'Normalized Shape', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
        zeroline: true,
        zerolinecolor: '#52525b',
        zerolinewidth: 1,
      },
      plot_bgcolor: C.bg,
      paper_bgcolor: C.bg,
      font: { color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      height,
      margin: { l: 55, r: 16, t: 45, b: 60 },
      hovermode: 'x unified' as const,
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right' as const,
        y: 1,
        bgcolor: C.legendBg,
        bordercolor: C.legendBorder,
        borderwidth: 1,
        font: { size: 9, color: C.textBright },
      },
    };
  }, [data, activePattern, height, C]);

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
        No intraday shapes (requires DB)
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Pattern selector tabs */}
      <div className="flex flex-wrap gap-1.5 px-3 mb-2">
        {patternKeys.map((key, i) => {
          const p = data.patterns[key];
          const isActive = key === activePattern;
          return (
            <button
              key={key}
              onClick={() => setSelectedPattern(key)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors border ${
                isActive
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-muted text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {p.h_label} <span className="opacity-60">({p.archetype})</span>
            </button>
          );
        })}
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
