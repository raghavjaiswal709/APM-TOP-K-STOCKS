'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
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

  // 2. Prepare ALL Prediction Traces (showing complete history)
  const predictionTraces = useMemo(() => {
    if (!predictions || !predictions.predictions || predictions.predictions.length === 0) {
      console.log('❌ No predictions available');
      return [];
    }

    const traces: any[] = [];
    const horizonColors = {
      H1: '#10b981', // Green - 15min
      H2: '#3b82f6', // Blue - 30min
      H3: '#f59e0b', // Orange - 45min
      H4: '#ef4444', // Red - 60min
      H5: '#8b5cf6', // Purple - 75min
    };

    // Create separate traces for each horizon to show progression over time
    const horizons = ['H1', 'H2', 'H3', 'H4', 'H5'];
    const timeOffsets = [15, 30, 45, 60, 75]; // minutes ahead for each horizon

    horizons.forEach((horizon, horizonIndex) => {
      const predKey = `${horizon}_pred` as keyof typeof predictions.predictions[0];
      const timeOffset = timeOffsets[horizonIndex] * 60 * 1000; // convert to ms

      const xValues: Date[] = [];
      const yValues: number[] = [];

      predictions.predictions.forEach((pred) => {
        const predTime = new Date(pred.prediction_time).getTime();
        const targetTime = new Date(predTime + timeOffset); // When this prediction is for
        const value = pred[predKey] as number;

        if (value && !isNaN(value)) {
          xValues.push(targetTime);
          yValues.push(value);
        }
      });

      if (xValues.length > 0) {
        traces.push({
          x: xValues,
          y: yValues,
          type: 'scatter',
          mode: 'lines+markers',
          name: `${horizon} (+${timeOffsets[horizonIndex]}min)`,
          line: {
            color: horizonColors[horizon as keyof typeof horizonColors],
            width: 2,
            dash: 'dot'
          },
          marker: {
            size: 5,
            color: horizonColors[horizon as keyof typeof horizonColors],
            symbol: 'diamond'
          },
          hovertemplate: `<b>${horizon} Prediction</b><br>` +
                        'Target Time: %{x|%H:%M:%S}<br>' +
                        'Predicted Price: ₹%{y:.2f}<br>' +
                        '<extra></extra>',
        });
      }
    });

    // Add input_close (anchor points) as a separate trace
    const anchorX: Date[] = [];
    const anchorY: number[] = [];

    predictions.predictions.forEach((pred) => {
      const predTime = new Date(pred.prediction_time);
      const value = pred.input_close;

      if (value && !isNaN(value)) {
        anchorX.push(predTime);
        anchorY.push(value);
      }
    });

    if (anchorX.length > 0) {
      traces.push({
        x: anchorX,
        y: anchorY,
        type: 'scatter',
        mode: 'markers',
        name: 'Prediction Anchor (Input)',
        marker: {
          size: 8,
          color: '#22d3ee', // Cyan for anchor points
          symbol: 'circle',
          line: {
            color: '#fff',
            width: 2
          }
        },
        hovertemplate: '<b>Anchor Point</b><br>' +
                      'Time: %{x|%H:%M:%S}<br>' +
                      'Price: ₹%{y:.2f}<br>' +
                      '<extra></extra>',
      });
    }

    console.log(`✅ Created ${traces.length} GTT prediction traces:`, {
      total_predictions: predictions.predictions.length,
      horizons: horizons,
      trace_counts: traces.map(t => ({ name: t.name, points: t.x?.length || 0 }))
    });

    return traces;
  }, [predictions]);

  // ============ LAYOUT ============
  const layout = useMemo(() => {
    const baseLayout = {
      title: {
        text: `${symbol} - GTT Predictions (All Horizons)`,
        font: { size: 16, color: '#e4e4e7' }
      },
      dragmode: 'pan',
      showlegend: true,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1,
        bgcolor: 'rgba(0,0,0,0.5)',
        bordercolor: '#555',
        borderwidth: 1,
        font: { size: 10, color: '#e4e4e7' }
      },
      xaxis: {
        title: 'Time',
        autorange: true,
        rangeslider: { visible: false },
        type: 'date',
        gridcolor: '#27272a',
        zerolinecolor: '#27272a',
        tickfont: { color: '#a1a1aa', size: 10 },
        tickformat: '%H:%M',
      },
      yaxis: {
        title: 'Price (₹)',
        autorange: true,
        gridcolor: '#27272a',
        zerolinecolor: '#27272a',
        tickfont: { color: '#a1a1aa', size: 10 },
        fixedrange: false // Allow vertical zoom
      },
      paper_bgcolor: '#18181b',
      plot_bgcolor: '#18181b',
      font: { color: '#e4e4e7' },
      margin: { l: 60, r: 20, t: 60, b: 40 },
      height: 650,
      hovermode: 'closest',
    };

    return baseLayout;
  }, [symbol]);

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
            ...predictionTraces
          ].filter(Boolean) as any}
          layout={layout as any}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['select2d', 'lasso2d'],
            scrollZoom: true,
            responsive: true
          }}
        />
      </div>
    </div>
  );
};

export default GttPredictionChart;
