// @ts-nocheck
'use client';

import React, { useMemo } from 'react';
import Plot from '@/app/market-data/components/LazyPlot';
import type { PatternRiskReturnResponse } from '@/types/clustering';
import { ARCHETYPE_COLORS, PATTERN_COLORS } from '@/types/clustering';
import { getChartTheme } from './chartTheme';

interface PatternRiskReturnChartProps {
  data: PatternRiskReturnResponse | null;
  loading?: boolean;
  height?: number;
  isDark?: boolean;
}

export default function PatternRiskReturnChart({ data, loading, height = 380, isDark = true }: PatternRiskReturnChartProps) {
  const C = useMemo(() => getChartTheme(isDark), [isDark]);
  const traces = useMemo(() => {
    if (!data?.patterns) return [];

    return data.patterns.map((p, i) => ({
      x: [p.avg_return_pct],
      y: [p.avg_volatility_pct],
      type: 'scatter' as const,
      mode: 'markers+text' as const,
      name: `${p.pattern} (${p.archetype})`,
      marker: {
        size: [Math.max(12, Math.sqrt(p.n_days) * 4)],
        color: ARCHETYPE_COLORS[p.archetype] || PATTERN_COLORS[i % PATTERN_COLORS.length],
        opacity: 0.85,
        line: { width: 2, color: C.bg },
        sizemode: 'diameter' as const,
      },
      text: [p.pattern],
      textposition: 'top center' as const,
      textfont: { size: 11, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      hovertemplate:
        `<b>${p.pattern}</b> — ${p.archetype}<br>` +
        `Return: %{x:.3f}%<br>` +
        `Volatility: %{y:.3f}%<br>` +
        `Win Rate: ${(p.win_rate * 100).toFixed(1)}%<br>` +
        `RAR: ${p.risk_adjusted_return.toFixed(3)}<br>` +
        `Days: ${p.n_days}<br>` +
        `Persistence: ${p.persistence.toFixed(2)}` +
        '<extra></extra>',
    }));
  }, [data]);

  const layout = useMemo(
    () => ({
      title: {
        text: '<b>Pattern Risk vs Return</b> <sub>(bubble size = sample days)</sub>',
        font: { size: 13, color: C.textBright, family: 'Inter, system-ui, sans-serif' },
        x: 0.01,
        xanchor: 'left' as const,
      },
      xaxis: {
        title: { text: 'Avg Return (%)', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
        zeroline: true,
        zerolinecolor: '#52525b',
        zerolinewidth: 1,
      },
      yaxis: {
        title: { text: 'Avg Volatility (%)', font: { size: 11, color: C.text } },
        color: C.text,
        gridcolor: C.grid,
        linecolor: C.line,
        tickfont: { size: 10, color: C.text },
      },
      plot_bgcolor: C.bg,
      paper_bgcolor: C.bg,
      font: { color: C.textBright, family: 'Inter, system-ui, sans-serif' },
      height,
      margin: { l: 55, r: 16, t: 40, b: 50 },
      hovermode: 'closest' as const,
      showlegend: true,
      legend: {
        x: 1,
        xanchor: 'right' as const,
        y: 0,
        yanchor: 'bottom' as const,
        bgcolor: C.legendBg,
        bordercolor: C.legendBorder,
        borderwidth: 1,
        font: { size: 9, color: C.textBright },
      },
      // Quadrant annotations
      annotations: [
        { x: 0.02, y: 0.98, xref: 'paper', yref: 'paper', text: 'High Vol / Low Return', showarrow: false, font: { size: 9, color: '#52525b' } },
        { x: 0.98, y: 0.98, xref: 'paper', yref: 'paper', text: 'High Vol / High Return', showarrow: false, font: { size: 9, color: '#52525b' }, xanchor: 'right' },
        { x: 0.02, y: 0.02, xref: 'paper', yref: 'paper', text: 'Low Vol / Low Return', showarrow: false, font: { size: 9, color: '#52525b' } },
        { x: 0.98, y: 0.02, xref: 'paper', yref: 'paper', text: 'Low Vol / High Return ✓', showarrow: false, font: { size: 9, color: '#22c55e' }, xanchor: 'right' },
      ],
    }),
    [height, C]
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
        No risk-return data
      </div>
    );
  }

  return (
    <Plot
      data={traces as any}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      useResizeHandler
      style={{ width: '100%', height }}
    />
  );
}
