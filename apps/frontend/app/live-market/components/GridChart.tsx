'use client';

/**
 * GridChart — live-market mini chart using lightweight-charts v5.
 *
 * - Always Area/Line chart (no candlestick)
 * - Shows a 10-minute rolling window: setVisibleRange on every tick
 * - Seeded with historical tick data from backend
 * - Real-time updates via series.update() — O(1)
 * - Auto-sizes via ResizeObserver
 */

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  AreaSeries,
  HistogramSeries,
} from 'lightweight-charts';

/* ── Types ── */
export interface TickData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: number;
}

export interface GridChartProps {
  company: {
    company_code: string;
    name: string;
    exchange: string;
    marker: string;
    symbol: string;
  };
  data: TickData | undefined;
  /** Historical ticks from backend — seeds the chart on mount */
  tickHistory?: TickData[];
  /** Show or hide the volume histogram at the bottom of the chart */
  showVolume?: boolean;
}

/* ── Helpers ── */

/** Normalise a timestamp to Unix seconds */
const toSec = (ts: number) => (ts < 1e10 ? Math.floor(ts) : Math.floor(ts / 1000));

/** Convert tick array to time-sorted { time, value } pairs (monotonic) */
function buildLinePoints(ticks: TickData[]): Array<{ time: Time; value: number }> {
  const out: Array<{ time: Time; value: number }> = [];
  let last = 0;
  for (const t of ticks) {
    let ts = toSec(t.timestamp);
    if (ts <= last) ts = last + 1;
    out.push({ time: ts as Time, value: t.ltp });
    last = ts;
  }
  return out;
}

/* ── Component ── */
const GridChart: React.FC<GridChartProps> = ({ company, data, tickHistory, showVolume = true }) => {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const seriesRef     = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeRef     = useRef<ISeriesApi<'Histogram'> | null>(null);
  const roRef         = useRef<ResizeObserver | null>(null);
  const lastTimeRef   = useRef<number>(0);   // for monotonic line updates

  const isPositive = (data?.change ?? 0) >= 0;
  const lineColor  = isPositive ? '#2ca499' : '#ef4444';

  /* ── Create chart on mount (once per company) ── */
  useEffect(() => {
    if (!containerRef.current) return;

    /* Teardown any existing chart */
    roRef.current?.disconnect();
    try { chartRef.current?.remove(); } catch {}
    chartRef.current = null;
    seriesRef.current = null;
    lastTimeRef.current = 0;

    const el = containerRef.current;
    const w  = el.clientWidth  || 300;
    const h  = el.clientHeight || 180;

    const chart = createChart(el, {
      width:  w,
      height: h,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  '#6b7280',
        fontSize:   9,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#ffffff0a' },
      },
      rightPriceScale: {
        borderVisible: false,
        autoScale:     true,
        scaleMargins:  { top: 0.08, bottom: 0.08 },
        minimumWidth:  52,
      },
      leftPriceScale: { visible: false },
      localization: {
        timeFormatter: (time: number) =>
          new Date(time * 1000).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),
      },
      timeScale: {
        borderVisible:  false,
        timeVisible:    true,
        secondsVisible: false,
        fixRightEdge:   false,
        rightOffset:    3,
        tickMarkFormatter: (time: number) =>
          new Date(time * 1000).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
      },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale:  false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor:               lineColor + '30',
      bottomColor:            lineColor + '04',
      lineWidth:              2,
      crosshairMarkerVisible: false,
      lastValueVisible:       false,
      priceLineVisible:       false,
    });

    /* Seed from tick history (last 10 minutes only) */
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - 600;
    const recent = (tickHistory ?? []).filter(t => toSec(t.timestamp) >= cutoff);
    const pts    = buildLinePoints(recent);
    if (pts.length > 0) {
      series.setData(pts);
      lastTimeRef.current = pts[pts.length - 1].time as number;
    }

    /* Seed live data point if available */
    if (data?.ltp) {
      const ts = toSec(data.timestamp || nowSec);
      const safeTs = Math.max(ts, lastTimeRef.current + 1);
      try { series.update({ time: safeTs as Time, value: data.ltp }); } catch {}
      lastTimeRef.current = safeTs;
    }

    /* Set 10-minute visible range — only valid when data exists */
    try {
      if (lastTimeRef.current > 0) {
        chart.timeScale().setVisibleRange({
          from: (nowSec - 600) as Time,
          to:   (nowSec + 60)  as Time,
        });
      } else {
        chart.timeScale().fitContent();
      }
    } catch { chart.timeScale().fitContent(); }

    chartRef.current  = chart;
    seriesRef.current = series;

    /* Volume histogram series — sits at the bottom, uses secondary price scale */
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      visible: showVolume,
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
      visible: false,
    });
    /* Seed volume from tick history */
    if (recent.length > 0) {
      const volPts = recent
        .filter(t => t.volume != null && t.volume! >= 0)
        .map((t, i) => {
          let ts = toSec(t.timestamp);
          if (i > 0) ts = Math.max(ts, toSec(recent[i - 1].timestamp) + 1);
          return {
            time: ts as Time,
            value: t.volume!,
            color: (t.change ?? 0) >= 0 ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
          };
        });
      if (volPts.length > 0) volSeries.setData(volPts);
    }
    volumeRef.current = volSeries;

    /* Auto-resize via ResizeObserver */
    const ro = new ResizeObserver(entries => {
      if (!chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 10 && height > 10) {
        chartRef.current.resize(width, height);
      }
    });
    ro.observe(el);
    roRef.current = ro;

    return () => {
      ro.disconnect();
      roRef.current = null;
      try { chartRef.current?.remove(); } catch {}
      chartRef.current  = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.company_code]); // recreate only when company changes

  /* ── Toggle volume visibility without recreating the chart ── */
  useEffect(() => {
    if (!volumeRef.current) return;
    volumeRef.current.applyOptions({ visible: showVolume });
  }, [showVolume]);

  /* ── Re-seed when historical data arrives asynchronously ── */
  useEffect(() => {
    if (!seriesRef.current || !tickHistory?.length) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoff = nowSec - 600;
    const recent = tickHistory.filter(t => toSec(t.timestamp) >= cutoff);
    const pts    = buildLinePoints(recent);
    if (pts.length === 0) return;
    try {
      seriesRef.current.setData(pts);
      lastTimeRef.current = pts[pts.length - 1].time as number;
      chartRef.current?.timeScale().setVisibleRange({
        from: (nowSec - 600) as Time,
        to:   (nowSec + 60)  as Time,
      });
    } catch { /* ignore */ }
  }, [tickHistory]);

  /* ── Real-time tick update — fires on every LTP change ── */
  useEffect(() => {
    if (!seriesRef.current || !data?.ltp) return;

    const ts     = toSec(data.timestamp || Date.now() / 1000);
    const safeTs = Math.max(ts, lastTimeRef.current + 1);

    try {
      seriesRef.current.update({ time: safeTs as Time, value: data.ltp });
      lastTimeRef.current = safeTs;

      /* Update volume histogram if volume data is available */
      if (volumeRef.current && data.volume != null && data.volume >= 0) {
        volumeRef.current.update({
          time: safeTs as Time,
          value: data.volume,
          color: (data.change ?? 0) >= 0 ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
        });
      }

      /* Slide 10-minute window forward with each tick */
      chartRef.current?.timeScale().setVisibleRange({
        from: (safeTs - 600) as Time,
        to:   (safeTs + 60)  as Time,
      });
    } catch { /* ignore time-ordering errors */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.ltp, data?.timestamp]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
};

export default GridChart;
