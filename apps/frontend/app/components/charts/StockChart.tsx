'use client'
import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useStockData } from '@/hooks/useStockData';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// Technical indicators list
const availableIndicators = [
  { id: 'ma', name: 'Moving Average', periods: [9, 20, 50, 200] },
  { id: 'ema', name: 'Exponential MA', periods: [9, 20, 50, 200] },
  { id: 'bollinger', name: 'Bollinger Bands', period: 20, stdDev: 2 },
  { id: 'rsi', name: 'RSI', period: 14 },
  { id: 'macd', name: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  { id: 'atr', name: 'ATR', period: 14 },
  { id: 'obv', name: 'On-Balance Volume' },
  { id: 'stoch', name: 'Stochastic', kPeriod: 14, dPeriod: 3 },
  { id: 'vwap', name: 'VWAP' },
  { id: 'fibonacci', name: 'Fibonacci Retracement' }
];

// Chart types
const chartTypes = [
  { id: 'candlestick', name: 'Candlestick' },
  { id: 'ohlc', name: 'OHLC' },
  { id: 'line', name: 'Line' },
  { id: 'area', name: 'Area' },
  { id: 'heiken-ashi', name: 'Heiken Ashi' }
];

// Time intervals
const timeIntervals = [
  { id: '1m', name: '1 min' },
  { id: '5m', name: '5 min' },
  { id: '10m', name: '10 min' },
  { id: '15m', name: '15 min' },
  { id: '30m', name: '30 min' },
  { id: '1h', name: '1 hour' },
  { id: '4h', name: '4 hours' },
  { id: '1d', name: 'Daily' },
  { id: '1w', name: 'Weekly' },
  { id: '1mo', name: 'Monthly' }
];

interface StockChartProps {
  companyId: string | null;
  startDate?: Date;
  endDate?: Date;
  interval?: string;
  indicators?: string[];
  height?: number;
  width?: number;
  defaultChartType?: string;
  showControls?: boolean;
}

export function StockChart({
  companyId,
  startDate,
  endDate,
  interval = '1d',
  indicators = [],
  height = 600,
  width = 1200,
  defaultChartType = 'candlestick',
  showControls = true
}: StockChartProps) {
  // Calculate default dates (last month) if not provided
  const defaultEndDate = useMemo(() => new Date(), []);
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date;
  }, []);

  const effectiveStartDate = startDate || defaultStartDate;
  const effectiveEndDate = endDate || defaultEndDate;

  // Chart state
  const [selectedInterval, setSelectedInterval] = useState(interval);
  const [selectedChartType, setSelectedChartType] = useState(defaultChartType);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
  const [selectedMAperiods, setSelectedMAperiods] = useState<number[]>([20]);
  const [selectedEMAperiods, setSelectedEMAperiods] = useState<number[]>([9]);
  const [showVolume, setShowVolume] = useState(true);
  const [showGridlines, setShowGridlines] = useState(true);
  const [logScale, setLogScale] = useState(false);
  const [drawingMode, setDrawingMode] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [chartTheme, setChartTheme] = useState<'light' | 'dark'>('dark');
  const [crosshair, setCrosshair] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(showControls);

  // Get stock data
  const { data, loading, error } = useStockData({
    companyId,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    interval: selectedInterval,
    indicators: activeIndicators
  });

  useEffect(() => {
    // Update interval when prop changes
    setSelectedInterval(interval);
  }, [interval]);

  useEffect(() => {
    // Update indicators when prop changes
    setActiveIndicators(indicators);
  }, [indicators]);

  useEffect(() => {
    // Update sidebar visibility when prop changes
    setSidebarVisible(showControls);
  }, [showControls]);

  // Utility function to calculate indicators
  const calculateIndicator = (type: string, prices: number[], options = {}) => {
    switch (type) {
      case 'ma': {
        const period = (options as any).period || 20;
        return prices.map((_, i) => {
          if (i < period - 1) return null;
          const slice = prices.slice(i - period + 1, i + 1);
          return slice.reduce((sum, price) => sum + price, 0) / period;
        });
      }
      case 'ema': {
        const period = (options as any).period || 9;
        const k = 2 / (period + 1);
        const ema = [prices[0]];
        
        for (let i = 1; i < prices.length; i++) {
          ema.push(prices[i] * k + ema[i-1] * (1-k));
        }
        
        return Array(period - 1).fill(null).concat(ema.slice(period - 1));
      }
      case 'bollinger': {
        const period = (options as any).period || 20;
        const stdDevMultiplier = (options as any).stdDev || 2;
        const ma = calculateIndicator('ma', prices, { period });
        
        const upperBand = ma.map((avg, i) => {
          if (avg === null) return null;
          const slice = prices.slice(i - period + 1, i + 1);
          const variance = slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period;
          const stdDev = Math.sqrt(variance);
          return avg + (stdDev * stdDevMultiplier);
        });
        
        const lowerBand = ma.map((avg, i) => {
          if (avg === null) return null;
          const slice = prices.slice(i - period + 1, i + 1);
          const variance = slice.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / period;
          const stdDev = Math.sqrt(variance);
          return avg - (stdDev * stdDevMultiplier);
        });
        
        return { middle: ma, upper: upperBand, lower: lowerBand };
      }
      case 'rsi': {
        const period = (options as any).period || 14;
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
          changes.push(prices[i] - prices[i-1]);
        }
        
        const gains = changes.map(change => change > 0 ? change : 0);
        const losses = changes.map(change => change < 0 ? -change : 0);
        
        let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
        
        const rsi = Array(period + 1).fill(null);
        
        for (let i = period; i < changes.length; i++) {
          avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
          avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
          
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
        
        return rsi;
      }
      case 'macd': {
        const fastPeriod = (options as any).fastPeriod || 12;
        const slowPeriod = (options as any).slowPeriod || 26;
        const signalPeriod = (options as any).signalPeriod || 9;
        
        const fastEMA = calculateIndicator('ema', prices, { period: fastPeriod }) as number[];
        const slowEMA = calculateIndicator('ema', prices, { period: slowPeriod }) as number[];
        
        const macdLine = fastEMA.map((fast, i) => {
          if (fast === null || slowEMA[i] === null) return null;
          return fast - slowEMA[i];
        });
        
        // Calculate signal line (EMA of MACD line)
        const validMacd = macdLine.filter(val => val !== null) as number[];
        const signalLine = calculateIndicator('ema', validMacd, { period: signalPeriod }) as number[];
        
        // Pad the signal line with nulls to match the original array length
        const paddedSignalLine = Array(macdLine.length - validMacd.length + signalPeriod - 1).fill(null).concat(signalLine);
        
        // Calculate histogram (MACD line - Signal line)
        const histogram = macdLine.map((macd, i) => {
          if (macd === null || paddedSignalLine[i] === null) return null;
          return macd - paddedSignalLine[i];
        });
        
        return { macdLine, signalLine: paddedSignalLine, histogram };
      }
      case 'obv': {
        if (!data || !data.length) return [];
        
        const obv = [0]; // Start with 0
        
        for (let i = 1; i < data.length; i++) {
          const prevClose = data[i-1].close;
          const currentClose = data[i].close;
          const currentVolume = data[i].volume;
          
          if (currentClose > prevClose) {
            obv.push(obv[i-1] + currentVolume);
          } else if (currentClose < prevClose) {
            obv.push(obv[i-1] - currentVolume);
          } else {
            obv.push(obv[i-1]);
          }
        }
        
        return obv;
      }
      default:
        return [];
    }
  };

  // Helper function to convert candles to Heiken Ashi
  const convertToHeikenAshi = (data: any[]) => {
    const haData = [];
    
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      
      if (i === 0) {
        // First candle is the same as original
        haData.push({
          ...current,
          ha_open: (current.open + current.close) / 2,
          ha_close: (current.open + current.high + current.low + current.close) / 4,
          ha_high: current.high,
          ha_low: current.low
        });
      } else {
        const prev = haData[i-1];
        const ha_open = (prev.ha_open + prev.ha_close) / 2;
        const ha_close = (current.open + current.high + current.low + current.close) / 4;
        const ha_high = Math.max(current.high, ha_open, ha_close);
        const ha_low = Math.min(current.low, ha_open, ha_close);
        
        haData.push({
          ...current,
          ha_open,
          ha_close,
          ha_high,
          ha_low
        });
      }
    }
    
    return haData;
  };

  // Process data for chart
  const { plotData, timeLabels } = useMemo(() => {
    if (!data || !data.length) return { plotData: [], timeLabels: [] };

    const timeLabels = data.map(item => new Date(item.interval_start));
    const plotElements = [];
    
    // Convert to Heiken Ashi if needed
    const chartData = selectedChartType === 'heiken-ashi' ? convertToHeikenAshi(data) : data;

    // Create base price chart
    let priceChart;
    
    switch (selectedChartType) {
      case 'candlestick':
        priceChart = {
          x: timeLabels,
          open: data.map(item => item.open),
          high: data.map(item => item.high),
          low: data.map(item => item.low),
          close: data.map(item => item.close),
          type: 'candlestick',
          name: 'Price',
          decreasing: { line: { color: '#ef5350', width: 3 },
          fillcolor: 'rgba(239, 83, 80, 0.8)'  // Semi-transparent red fill
 }, // Increased width
          increasing: { line: { color: '#26a69a', width: 3 },
          fillcolor: 'rgba(38, 166, 154, 0.8)'  }, // Increased width
          whiskerwidth: 0.6, // Increased from 0.2 for better visibility
          line: { width: 1.5 } // Slightly increased base width
          
        };
        break;
      case 'ohlc':
        priceChart = {
          x: timeLabels,
          open: data.map(item => item.open),
          high: data.map(item => item.high),
          low: data.map(item => item.low),
          close: data.map(item => item.close),
          type: 'ohlc',
          name: 'Price',
          decreasing: { line: { color: '#FF4136', width: 2 } }, // Increased width
          increasing: { line: { color: '#2ECC40', width: 2 } }, // Increased width
          line: { width: 1.5 } // Slightly increased width
        };
        break;
      case 'heiken-ashi':
        priceChart = {
          x: timeLabels,
          open: chartData.map(item => item.ha_open),
          high: chartData.map(item => item.ha_high),
          low: chartData.map(item => item.ha_low),
          close: chartData.map(item => item.ha_close),
          type: 'candlestick',
          name: 'Heiken Ashi',
          decreasing: { line: { color: '#FF4136', width: 2.5 } }, // Increased width
          increasing: { line: { color: '#2ECC40', width: 2.5 } }, // Increased width
          whiskerwidth: 0.6, // Increased from 0.2 for better visibility
          line: { width: 1.5 } // Slightly increased base width
        };
        break;
      case 'line':
        priceChart = {
          x: timeLabels,
          y: data.map(item => item.close),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          line: { color: '#0074D9', width: 2 }
        };
        break;
      case 'area':
        priceChart = {
          x: timeLabels,
          y: data.map(item => item.close),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          fill: 'tozeroy',
          fillcolor: 'rgba(0, 116, 217, 0.3)',
          line: { color: '#0074D9', width: 2 }
        };
        break;
    }
    
    plotElements.push(priceChart);

    // Add volume if enabled
    if (showVolume) {
      const volume = {
        x: timeLabels,
        y: data.map(item => item.volume),
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
          color: data.map((item, i) => {
            if (i > 0) {
              return item.close > data[i-1].close ? 'rgba(46, 204, 64, 0.7)' : 'rgba(255, 65, 54, 0.7)';
            }
            return 'rgba(46, 204, 64, 0.7)';
          })
        }
      };
      plotElements.push(volume);
    }

    // Add selected indicators
    const prices = data.map(item => item.close);

    // MA indicators
    if (activeIndicators.includes('ma')) {
      selectedMAperiods.forEach(period => {
        const ma = calculateIndicator('ma', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ma,
          type: 'scatter',
          mode: 'lines',
          name: `MA(${period})`,
          line: { 
            color: period === 200 ? '#B10DC9' : 
                  period === 50 ? '#FF851B' : 
                  period === 20 ? '#0074D9' : '#7FDBFF',
            width: 1.5 
          }
        });
      });
    }

    // EMA indicators
    if (activeIndicators.includes('ema')) {
      selectedEMAperiods.forEach(period => {
        const ema = calculateIndicator('ema', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ema,
          type: 'scatter',
          mode: 'lines',
          name: `EMA(${period})`,
          line: { 
            color: period === 200 ? '#F012BE' : 
                  period === 50 ? '#FFDC00' : 
                  period === 20 ? '#01FF70' : '#39CCCC',
            width: 1.5,
            dash: 'dash' 
          }
        });
      });
    }

    // Bollinger Bands
    if (activeIndicators.includes('bollinger')) {
      const bands = calculateIndicator('bollinger', prices, { period: 20, stdDev: 2 }) as any;
      
      // Middle band
      plotElements.push({
        x: timeLabels,
        y: bands.middle,
        type: 'scatter',
        mode: 'lines',
        name: 'BB(20) Middle',
        line: { color: 'rgba(75, 192, 192, 0.8)', width: 1 }
      });
      
      // Upper band
      plotElements.push({
        x: timeLabels,
        y: bands.upper,
        type: 'scatter',
        mode: 'lines',
        name: 'BB(20) Upper',
        line: { color: 'rgba(75, 192, 192, 0.6)', width: 1, dash: 'dot' }
      });
      
      // Lower band
      plotElements.push({
        x: timeLabels,
        y: bands.lower,
        type: 'scatter',
        mode: 'lines',
        name: 'BB(20) Lower',
        line: { color: 'rgba(75, 192, 192, 0.6)', width: 1, dash: 'dot' },
        fill: 'tonexty',
        fillcolor: 'rgba(75, 192, 192, 0.1)'
      });
    }

    // RSI
    if (activeIndicators.includes('rsi')) {
      const rsi = calculateIndicator('rsi', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: rsi,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI(14)',
        yaxis: 'y3',
        line: { color: '#FF851B', width: 1.5 }
      });
    }

    // MACD
    if (activeIndicators.includes('macd')) {
      const macd = calculateIndicator('macd', prices) as any;
      
      // MACD Line
      plotElements.push({
        x: timeLabels,
        y: macd.macdLine,
        type: 'scatter',
        mode: 'lines',
        name: 'MACD Line',
        yaxis: 'y4',
        line: { color: '#0074D9', width: 1.5 }
      });
      
      // Signal Line
      plotElements.push({
        x: timeLabels,
        y: macd.signalLine,
        type: 'scatter',
        mode: 'lines',
        name: 'Signal Line',
        yaxis: 'y4',
        line: { color: '#FF4136', width: 1.5 }
      });
      
      // Histogram
      plotElements.push({
        x: timeLabels,
        y: macd.histogram,
        type: 'bar',
        name: 'MACD Histogram',
        yaxis: 'y4',
        marker: {
          color: macd.histogram.map((val: number | null) => 
            val === null ? 'rgba(0,0,0,0)' : 
            val >= 0 ? 'rgba(46, 204, 64, 0.7)' : 'rgba(255, 65, 54, 0.7)'
          )
        }
      });
    }

    // On-Balance Volume
    if (activeIndicators.includes('obv')) {
      const obv = calculateIndicator('obv', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: obv,
        type: 'scatter',
        mode: 'lines',
        name: 'OBV',
        yaxis: 'y5',
        line: { color: '#B10DC9', width: 1.5 }
      });
    }

    return { plotData: plotElements, timeLabels };
  }, [data, selectedChartType, activeIndicators, showVolume, selectedMAperiods, selectedEMAperiods]);

  // Configure layout
  const layout = useMemo(() => {
    // Determine how many indicator panels we need
    const hasRSI = activeIndicators.includes('rsi');
    const hasMACD = activeIndicators.includes('macd');
    const hasOBV = activeIndicators.includes('obv');
    const indicatorCount = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0) + (hasOBV ? 1 : 0);
    
    // Calculate domain ranges for each panel
    let priceChartDomain = [0.3, 1];
    let volumeDomain = [0, 0.2];
    
    if (indicatorCount > 0) {
      const totalIndicatorHeight = 0.3;
      const indicatorHeight = totalIndicatorHeight / indicatorCount;
      
      priceChartDomain = [0.3 + totalIndicatorHeight, 1];
      volumeDomain = [0.2 + totalIndicatorHeight, 0.3 + totalIndicatorHeight];
      
      let currentBottom = 0;
      let rsiDomain, macdDomain, obvDomain;
      
      if (hasRSI) {
        rsiDomain = [currentBottom, currentBottom + indicatorHeight];
        currentBottom += indicatorHeight;
      }
      
      if (hasMACD) {
        macdDomain = [currentBottom, currentBottom + indicatorHeight];
        currentBottom += indicatorHeight;
      }
      
      if (hasOBV) {
        obvDomain = [currentBottom, currentBottom + indicatorHeight];
      }
    }
    
    // Define colors based on theme
    const colors = chartTheme === 'dark' 
      ? {
          bg: '#222',
          text: '#eee',
          grid: '#444',
          axisLine: '#666'
        }
      : {
          bg: '#fff',
          text: '#222',
          grid: '#ddd',
          axisLine: '#999'
        };

    // Configure base layout
    const baseLayout: any = {
      // Plotly layout settings
      dragmode: drawingMode || 'zoom',
      showlegend: true,
      legend: {
        x: 0,
        y: 1,
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text }
      },
      margin: { r: 50, l: 50, b: 50, t: 50, pad: 4 },
      paper_bgcolor: colors.bg,
      plot_bgcolor: colors.bg,
      font: { color: colors.text },
      
      // Main price chart
      xaxis: {
        rangeslider: { visible: false },
        type: 'date',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.axisLine,
        title: { text: '', font: { color: colors.text } },
        // Ensure proper spacing between bars for candlesticks
        rangebreaks: [
          { pattern: 'day of week', bounds: [6, 1] } // Hide weekends
        ],
        autorange: false, // Disable autorange
  range: timeLabels.length > 0 ? 
    [timeLabels[0], timeLabels[timeLabels.length - 1]] : // Set range to actual data limits
    undefined,
  constrain: 'domain', // Constrain panning to the domain
  constraintoward: 'center' // When zooming out, constrain toward center
      },
      yaxis: {
        title: 'Price',
        autorange: true,
        domain: priceChartDomain,
        tickformat: ',.2f',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.axisLine,
        type: logScale ? 'log' : 'linear',
        title: { font: { color: colors.text } }
      },
      
      // Volume panel
      yaxis2: {
        title: 'Volume',
        autorange: true,
        domain: volumeDomain,
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.axisLine,
        title: { font: { color: colors.text } }
      },
      
      // Global
      hovermode: crosshair ? 'x unified' : 'closest',
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: '#0074D9',
        font: { color: colors.text }
      },
      shapes: annotations,
      grid: { rows: 2 + indicatorCount, columns: 1, pattern: 'independent' },
      title: {
        text: companyId ? `${companyId} - ${selectedInterval} Interval` : 'No Company Selected',
        font: { color: colors.text }
      }
    };
    
    // Add RSI panel if needed
    if (hasRSI) {
      baseLayout.yaxis3 = {
        title: 'RSI',
        domain: [0, 0.15],
        range: [0, 100],
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.axisLine,
        tickvals: [0, 30, 70, 100],
        ticktext: ['0', '30', '70', '100'],
        title: { font: { color: colors.text } }
      };
      
      // Add horizontal lines for overbought/oversold levels
      baseLayout.shapes = baseLayout.shapes || [];
      baseLayout.shapes.push(
        {
          type: 'line',
          xref: 'paper',
          yref: 'y3',
          x0: 0,
          y0: 30,
          x1: 1,
          y1: 30,
          line: { color: 'green', width: 1, dash: 'dash' }
        },
        {
          type: 'line',
          xref: 'paper',
          yref: 'y3',
          x0: 0,
          y0: 70,
          x1: 1,
          y1: 70,
          line: { color: 'red', width: 1, dash: 'dash' }
        }
      );
    }
    
    // Add MACD panel if needed
    if (hasMACD) {
      baseLayout.yaxis4 = {
        title: 'MACD',
        domain: hasRSI ? [0.16, 0.30] : [0, 0.15],
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.axisLine,
        title: { font: { color: colors.text } }
      };
      
      // Add zero line
      baseLayout.shapes = baseLayout.shapes || [];
      baseLayout.shapes.push({
        type: 'line',
        xref: 'paper',
        yref: 'y4',
        x0: 0,
        y0: 0,
        x1: 1,
        y1: 0,
        line: { color: colors.text, width: 1, dash: 'dot' }
      });
    }
    
    // Add OBV panel if needed
    if (hasOBV) {
      baseLayout.yaxis5 = {
        title: 'OBV',
        domain: !hasRSI && !hasMACD ? [0, 0.15] :
                !hasRSI || !hasMACD ? [0.16, 0.30] : [0.31, 0.45],
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.axisLine,
        title: { font: { color: colors.text } }
      };
    }
    
    return baseLayout;
  }, [
    companyId, 
    activeIndicators, 
    showGridlines, 
    logScale, 
    drawingMode, 
    chartTheme, 
    crosshair, 
    annotations, 
    selectedInterval
  ]);

  const config = {
    responsive: true,
    scrollZoom: true,
    displayModeBar: true,
    modeBarButtonsToAdd: [
      'drawline',
      'drawopenpath',
      'drawclosedpath',
      'drawcircle',
      'drawrect',
      'eraseshape'
    ],
    modeBarButtonsToRemove: ['autoScale2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'png',
      filename: `${companyId || 'chart'}_${new Date().toISOString().split('T')[0]}`
    }
  };

  // Toggle indicators
  const toggleIndicator = (id: string) => {
    setActiveIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(ind => ind !== id) 
        : [...prev, id]
    );
  };

  // Toggle MA period
  const toggleMAPeriod = (period: number) => {
    setSelectedMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period]
    );
  };

  // Toggle EMA period
  const toggleEMAPeriod = (period: number) => {
    setSelectedEMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period]
    );
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full bg-muted/50 rounded-xl">
        <div className="animate-pulse text-lg">Loading stock data...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex justify-center items-center h-full bg-muted/50 rounded-xl">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  // No company
  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-full bg-muted/50 rounded-xl">
        <div className="text-lg text-gray-500">Please select a company to view chart data</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex relative">
      {/* Main Chart Area */}
      <div className={`h-full transition-all duration-300 ease-in-out ${sidebarVisible ? 'w-5/6' : 'w-full'}`}>
        <Plot
          data={plotData}
          layout={layout}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          config={config}
          onRelayout={(e) => {
            // Handle annotations created by drawing tools
            if (e.shapes) {
              setAnnotations(e.shapes);
            }
          }}
        />
      </div>

      {/* Sidebar Toggle Button */}
      <button 
        className="absolute top-4 right-4 z-10 bg-primary text-primary-foreground p-2 rounded-full shadow-md hover:bg-primary/90 transition-all"
        onClick={toggleSidebar}
        aria-label={sidebarVisible ? "Hide Controls" : "Show Controls"}
      >
        {sidebarVisible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        )}
      </button>

      {/* Controls Panel */}
      <div 
        className={`h-full overflow-y-auto bg-muted/20 border-l border-gray-200 dark:border-gray-700 p-2 transition-all duration-300 ease-in-out ${
          sidebarVisible ? 'w-1/6 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col space-y-4">
          {/* Time Frame Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Time Frame</h3>
            <div className="flex flex-col space-y-1">
              {timeIntervals.map(int => (
                <button
                  key={int.id}
                  className={`px-2 py-1 text-xs rounded ${selectedInterval === int.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary hover:bg-secondary/80'}`}
                  onClick={() => setSelectedInterval(int.id)}
                >
                  {int.name}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Type Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Chart Type</h3>
            <div className="flex flex-col space-y-1">
              {chartTypes.map(type => (
                <button
                  key={type.id}
                  className={`px-2 py-1 text-xs rounded ${selectedChartType === type.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary hover:bg-secondary/80'}`}
                  onClick={() => setSelectedChartType(type.id)}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* Indicators Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Indicators</h3>
            <div className="flex flex-col space-y-1">
              {availableIndicators.map(ind => (
                <div key={ind.id}>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={activeIndicators.includes(ind.id)}
                      onChange={() => toggleIndicator(ind.id)}
                    />
                    <span className="text-xs">{ind.name}</span>
                  </label>

                  {/* Show periods for MA if selected */}
                  {ind.id === 'ma' && activeIndicators.includes('ma') && (
                    <div className="ml-4 mt-1 flex flex-wrap gap-1">
                      {ind.periods.map(period => (
                        <button
                          key={period}
                          className={`px-1.5 py-0.5 text-xs rounded ${selectedMAperiods.includes(period) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-secondary hover:bg-secondary/80'}`}
                          onClick={() => toggleMAPeriod(period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Show periods for EMA if selected */}
                  {ind.id === 'ema' && activeIndicators.includes('ema') && (
                    <div className="ml-4 mt-1 flex flex-wrap gap-1">
                      {ind.periods.map(period => (
                        <button
                          key={period}
                          className={`px-1.5 py-0.5 text-xs rounded ${selectedEMAperiods.includes(period) 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-secondary hover:bg-secondary/80'}`}
                          onClick={() => toggleEMAPeriod(period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Display Options Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Display Options</h3>
            <div className="flex flex-col space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={showVolume}
                  onChange={() => setShowVolume(!showVolume)}
                />
                <span className="text-xs">Show Volume</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={showGridlines}
                  onChange={() => setShowGridlines(!showGridlines)}
                />
                <span className="text-xs">Show Gridlines</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={logScale}
                  onChange={() => setLogScale(!logScale)}
                />
                <span className="text-xs">Log Scale</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={crosshair}
                  onChange={() => setCrosshair(!crosshair)}
                />
                <span className="text-xs">Crosshair</span>
              </label>
            </div>
          </div>

          {/* Drawing Tools Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Drawing Tools</h3>
            <div className="grid grid-cols-2 gap-1">
              <button
                className={`px-2 py-1 text-xs rounded ${drawingMode === 'drawline' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setDrawingMode(drawingMode === 'drawline' ? null : 'drawline')}
              >
                Line
              </button>
              <button
                className={`px-2 py-1 text-xs rounded ${drawingMode === 'drawrect' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setDrawingMode(drawingMode === 'drawrect' ? null : 'drawrect')}
              >
                Rectangle
              </button>
              <button
                className={`px-2 py-1 text-xs rounded ${drawingMode === 'drawcircle' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setDrawingMode(drawingMode === 'drawcircle' ? null : 'drawcircle')}
              >
                Circle
              </button>
              <button
                className={`px-2 py-1 text-xs rounded ${drawingMode === 'drawopenpath' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setDrawingMode(drawingMode === 'drawopenpath' ? null : 'drawopenpath')}
              >
                Path
              </button>
              <button
                className="px-2 py-1 text-xs rounded bg-secondary hover:bg-secondary/80 col-span-2"
                onClick={() => {
                  setAnnotations([]);
                  setDrawingMode(null);
                }}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Theme Panel */}
          <div className="border rounded-md p-2 bg-muted/20">
            <h3 className="font-medium text-sm mb-2">Theme</h3>
            <div className="flex gap-1">
              <button
                className={`px-2 py-1 text-xs rounded flex-1 ${chartTheme === 'light' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setChartTheme('light')}
              >
                Light
              </button>
              <button
                className={`px-2 py-1 text-xs rounded flex-1 ${chartTheme === 'dark' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary hover:bg-secondary/80'}`}
                onClick={() => setChartTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <button
            className="w-full px-2 py-1 text-xs rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              setSelectedChartType(defaultChartType);
              setSelectedInterval(interval);
              setActiveIndicators(indicators);
              setSelectedMAperiods([20]);
              setSelectedEMAperiods([9]);
              setShowVolume(true);
              setShowGridlines(true);
              setLogScale(false);
              setDrawingMode(null);
              setAnnotations([]);
              setCrosshair(true);
            }}
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
