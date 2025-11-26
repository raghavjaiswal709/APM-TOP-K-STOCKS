'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useGttPredictions } from '@/hooks/useGttPredictions';

// ============ CONFIGURATION CONSTANTS ============
const FUTURE_BUFFER_MS = 15 * 60 * 1000; // 15 minutes
const PREDICTION_EXTENSION_MS = 75 * 60 * 1000; // 75 minutes for H5

interface DataPoint {
  ltp: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface GttPredictionChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
  chartUpdates: ChartUpdate[];
  tradingHours: {
    start: string;
    end: string;
    current: string;
    isActive: boolean;
  };
}

const GttPredictionChart: React.FC<GttPredictionChartProps> = ({
  symbol,
  data,
  historicalData,
  ohlcData = [],
  chartUpdates = [],
  tradingHours,
}) => {
  const chartRef = useRef<any>(null);
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle'); // Default to candle as requested

  // Fetch Predictions
  const { predictions, loading: predictionsLoading } = useGttPredictions(symbol, true);

  // ============ DATA PREPARATION ============

  // 1. Prepare Main Chart Data (Candle/Line) - Simplified from PlotlyChart
  const mainChartData = useMemo(() => {
    // Merge historical and updates
    // Note: This is a simplified version of PlotlyChart's logic

    if (chartType === 'line') {
      const dataMap = new Map<number, DataPoint>();
      historicalData.forEach(p => dataMap.set(p.timestamp, p));
      chartUpdates.forEach(u => {
        if (!dataMap.has(u.timestamp)) {
          dataMap.set(u.timestamp, { ltp: u.price, timestamp: u.timestamp } as DataPoint);
        }
      });
      if (data) dataMap.set(data.timestamp, data);

      const sorted = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      return {
        x: sorted.map(p => new Date(p.timestamp * 1000)),
        y: sorted.map(p => p.ltp),
        type: 'scatter',
        mode: 'lines',
        name: 'Price',
        line: { color: '#2962FF', width: 2 }
      };
    } else {
      // Candlestick
      const uniqueData = new Map<number, OHLCPoint>();
      ohlcData.forEach(c => uniqueData.set(c.timestamp, c));
      const sorted = Array.from(uniqueData.values()).sort((a, b) => a.timestamp - b.timestamp);

      return {
        x: sorted.map(c => new Date(c.timestamp * 1000)),
        open: sorted.map(c => c.open),
        high: sorted.map(c => c.high),
        low: sorted.map(c => c.low),
        close: sorted.map(c => c.close),
        type: 'candlestick',
        name: 'OHLC',
        increasing: { line: { color: '#26a69a' }, fillcolor: '#26a69a' },
        decreasing: { line: { color: '#ef5350' }, fillcolor: '#ef5350' }
      };
    }
  }, [historicalData, chartUpdates, data, ohlcData, chartType]);

  // 2. Prepare Prediction Trace
  const predictionTrace = useMemo(() => {
    if (!predictions || !predictions.latest) return null;

    const latest = predictions.latest;
    const predTime = new Date(latest.prediction_time).getTime(); // Anchor time

    // Construct points: Anchor -> H1 -> H2 -> H3 -> H4 -> H5
    // Timestamps: Anchor, Anchor+15m, +30m, +45m, +60m, +75m
    const timestamps = [
      new Date(predTime),
      new Date(predTime + 15 * 60 * 1000),
      new Date(predTime + 30 * 60 * 1000),
      new Date(predTime + 45 * 60 * 1000),
      new Date(predTime + 60 * 60 * 1000),
      new Date(predTime + 75 * 60 * 1000),
    ];

    const values = [
      latest.input_close,
      latest.H1_pred,
      latest.H2_pred,
      latest.H3_pred,
      latest.H4_pred,
      latest.H5_pred,
    ];

    return {
      x: timestamps,
      y: values,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'GTT Prediction',
      line: {
        color: '#A855F7', // Neon Purple
        width: 2,
        dash: 'dash'
      },
      marker: {
        size: 6,
        color: '#A855F7'
      },
      hoverinfo: 'x+y+name'
    };
  }, [predictions]);

  // ============ LAYOUT ============
  const layout = useMemo(() => {
    const baseLayout = {
      dragmode: 'pan',
      showlegend: true,
      xaxis: {
        autorange: true,
        rangeslider: { visible: false },
        type: 'date',
        gridcolor: '#333',
        zerolinecolor: '#333',
        // Extend range logic could go here if not using autorange, 
        // but adding data points usually forces plotly to extend.
      },
      yaxis: {
        autorange: true,
        gridcolor: '#333',
        zerolinecolor: '#333',
        fixedrange: false // Allow vertical zoom
      },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#ccc' },
      margin: { l: 50, r: 50, t: 30, b: 30 },
      height: 600,
    };

    return baseLayout;
  }, []);

  // ============ RENDER ============
  return (
    <div className="w-full h-full flex flex-col">
      <div className="w-full h-full relative flex-1">
        {predictionsLoading && (
          <div className="absolute top-2 right-2 z-10 bg-black/50 px-2 py-1 rounded text-xs text-purple-400">
            Updating Predictions...
          </div>
        )}
        <Plot
          ref={chartRef}
          data={[
            mainChartData,
            predictionTrace
          ].filter(Boolean) as any}
          layout={layout as any}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{
            displayModeBar: false,
            scrollZoom: true,
            responsive: true
          }}
        />
      </div>
    </div>
  );
};

export default GttPredictionChart;
