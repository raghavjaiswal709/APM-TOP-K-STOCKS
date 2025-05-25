'use client'
import React, { useMemo, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  LineChart, 
  CandlestickChart, 
  BarChart3, 
  TrendingUp, 
  Settings, 
  Palette,
  Grid3X3,
  MousePointer,
  Eraser,
  Circle,
  Square,
  Minus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Clock
} from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// Enhanced technical indicators with more options
const availableIndicators = [
  { id: 'ma', name: 'Moving Average', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'ema', name: 'Exponential MA', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'bollinger', name: 'Bollinger Bands', period: 20, stdDev: 2, color: '#ffffff' },
  { id: 'rsi', name: 'RSI', period: 14, color: '#ffffff' },
  { id: 'macd', name: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#ffffff' },
  { id: 'atr', name: 'ATR', period: 14, color: '#ffffff' },
  { id: 'obv', name: 'On-Balance Volume', color: '#ffffff' },
  { id: 'stoch', name: 'Stochastic', kPeriod: 14, dPeriod: 3, color: '#ffffff' },
  { id: 'vwap', name: 'VWAP', color: '#ffffff' },
  { id: 'fibonacci', name: 'Fibonacci Retracement', color: '#ffffff' }
];

const chartTypes = [
  { id: 'candlestick', name: 'Candlestick', icon: CandlestickChart },
  { id: 'ohlc', name: 'OHLC', icon: BarChart3 },
  { id: 'line', name: 'Line', icon: LineChart },
  { id: 'area', name: 'Area', icon: TrendingUp },
  { id: 'heiken-ashi', name: 'Heiken Ashi', icon: CandlestickChart }
];

const timeIntervals = [
  { id: '1m', name: '1m' },
  { id: '5m', name: '5m' },
  { id: '10m', name: '10m' },
  { id: '15m', name: '15m' },
  { id: '30m', name: '30m' },
  { id: '1h', name: '1h' },
  { id: '1d', name: '1D' }
];

const drawingTools = [
  { id: 'drawline', name: 'Trend Line', icon: Minus },
  { id: 'drawrect', name: 'Rectangle', icon: Square },
  { id: 'drawcircle', name: 'Circle', icon: Circle },
  { id: 'drawopenpath', name: 'Free Draw', icon: MousePointer },
  { id: 'eraseshape', name: 'Eraser', icon: Eraser }
];

interface StockDataPoint {
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockChartProps {
  companyId: string | null;
  data?: StockDataPoint[];
  startDate?: Date;
  endDate?: Date;
  interval?: string;
  indicators?: string[];
  loading?: boolean;
  error?: string | null;
  height?: number;
  width?: number;
  defaultChartType?: string;
  showControls?: boolean;
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
  onIntervalChange?: (interval: string) => void;
}

export function StockChart({
  companyId,
  data = [],
  startDate,
  endDate,
  interval = '1m',
  indicators = [],
  loading = false,
  error = null,
  height = 600,
  width = 1200,
  defaultChartType = 'candlestick',
  showControls = true,
  theme = 'dark',
  onThemeChange,
  onIntervalChange
}: StockChartProps) {
  // Chart state management
  const [selectedInterval, setSelectedInterval] = useState(interval);
  const [selectedChartType, setSelectedChartType] = useState(defaultChartType);
  const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
  const [selectedMAperiods, setSelectedMAperiods] = useState<number[]>([20, 50]);
  const [selectedEMAperiods, setSelectedEMAperiods] = useState<number[]>([9, 21]);
  const [showVolume, setShowVolume] = useState(true);
  const [showGridlines, setShowGridlines] = useState(true);
  const [logScale, setLogScale] = useState(false);
  const [crosshair, setCrosshair] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(showControls);
  const [chartTheme, setChartTheme] = useState<'light' | 'dark'>(theme);
  
  // Drawing tools state
  const [drawingMode, setDrawingMode] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  
  // Advanced features state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);

  // Sync interval with props
  useEffect(() => {
    setSelectedInterval(interval);
  }, [interval]);

  // Theme synchronization
  useEffect(() => {
    setChartTheme(theme);
  }, [theme]);

  // Enhanced indicator calculations
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
        
        const validMacd = macdLine.filter(val => val !== null) as number[];
        const signalLine = calculateIndicator('ema', validMacd, { period: signalPeriod }) as number[];
        
        const paddedSignalLine = Array(macdLine.length - validMacd.length + signalPeriod - 1).fill(null).concat(signalLine);
        
        const histogram = macdLine.map((macd, i) => {
          if (macd === null || paddedSignalLine[i] === null) return null;
          return macd - paddedSignalLine[i];
        });
        
        return { macdLine, signalLine: paddedSignalLine, histogram };
      }
      
      case 'obv': {
        if (!data || !data.length) return [];
        
        const obv = [0]; 
        
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

  // Enhanced Heiken Ashi calculation
  const convertToHeikenAshi = (data: any[]) => {
    const haData = [];
    
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      
      if (i === 0) {
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

  // Market hours filtering function
  const filterMarketHours = (data: any[]) => {
    return data.filter(item => {
      const date = new Date(item.interval_start);
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      // Only Monday to Friday (1-5)
      if (day < 1 || day > 5) return false;
      
      // Market hours: 9:15 AM to 3:30 PM IST
      const marketOpen = 9 * 60 + 15; // 9:15 AM in minutes
      const marketClose = 15 * 60 + 30; // 3:30 PM in minutes
      
      return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
    });
  };

  // Generate market hour breaks for rangebreaks
  const generateMarketBreaks = () => {
    const breaks = [];
    
    // Weekend breaks (Saturday and Sunday)
    breaks.push({ pattern: 'day of week', bounds: [6, 1] });
    
    // Daily breaks (3:30 PM to 9:15 AM next day)
    breaks.push({
      pattern: 'hour',
      bounds: [15.5, 9.25] // 3:30 PM to 9:15 AM
    });
    
    return breaks;
  };

  // Enhanced color theme with #27272a base
  const getColorTheme = () => {
    const baseColor = '#27272a';
    const lighterShades = {
      100: '#3f3f46', // lighter
      200: '#52525b', // even lighter
      300: '#71717a', // much lighter
      400: '#a1a1aa', // very light
      500: '#d4d4d8'  // extremely light
    };
    
    if (chartTheme === 'dark') {
      return {
        bg: baseColor,
        paper: baseColor,
        text: lighterShades[500],
        grid: lighterShades[100],
        line: '#60a5fa',
        upColor: '#22c55e',
        downColor: '#ef4444',
        volume: {
          up: 'rgba(34, 197, 94, 0.6)',
          down: 'rgba(239, 68, 68, 0.6)'
        },
        indicators: {
          ma: ['#f59e0b', '#f97316', '#dc2626', '#7c3aed'],
          ema: ['#10b981', '#059669', '#047857', '#065f46'],
          bollinger: '#06b6d4',
          rsi: '#8b5cf6',
          macd: '#ec4899',
          obv: '#f59e0b'
        },
        button: {
          bg: lighterShades[100],
          bgActive: '#60a5fa',
          bgHover: lighterShades[200],
          text: lighterShades[500]
        }
      };
    } else {
      return {
        bg: '#ffffff',
        paper: '#ffffff',
        text: baseColor,
        grid: lighterShades[400],
        line: '#3b82f6',
        upColor: '#059669',
        downColor: '#dc2626',
        volume: {
          up: 'rgba(5, 150, 105, 0.6)',
          down: 'rgba(220, 38, 38, 0.6)'
        },
        indicators: {
          ma: ['#f59e0b', '#f97316', '#dc2626', '#7c3aed'],
          ema: ['#10b981', '#059669', '#047857', '#065f46'],
          bollinger: '#0891b2',
          rsi: '#7c3aed',
          macd: '#be185d',
          obv: '#d97706'
        },
        button: {
          bg: '#f8fafc',
          bgActive: '#3b82f6',
          bgHover: '#f1f5f9',
          text: baseColor
        }
      };
    }
  };

  // Enhanced plot data generation with market hours filtering
  const { plotData, timeLabels } = useMemo(() => {
    if (!data || !data.length) return { plotData: [], timeLabels: [] };

    // Filter data to market hours only
    const filteredData = filterMarketHours(data);
    
    if (!filteredData.length) return { plotData: [], timeLabels: [] };

    const colors = getColorTheme();
    const timeLabels = filteredData.map(item => new Date(item.interval_start));
    const plotElements = [];
    
    const chartData = selectedChartType === 'heiken-ashi' ? convertToHeikenAshi(filteredData) : filteredData;

    // Main price chart
    let priceChart;
    
    switch (selectedChartType) {
      case 'candlestick':
        priceChart = {
          x: timeLabels,
          open: filteredData.map(item => item.open),
          high: filteredData.map(item => item.high),
          low: filteredData.map(item => item.low),
          close: filteredData.map(item => item.close),
          type: 'candlestick',
          name: 'Price',
          decreasing: { 
            line: { color: colors.downColor, width: 1 },
            fillcolor: colors.downColor
          },
          increasing: { 
            line: { color: colors.upColor, width: 1 },
            fillcolor: colors.upColor
          },
          whiskerwidth: 0.8,
          line: { width: 1 }
        };
        break;
        
      case 'ohlc':
        priceChart = {
          x: timeLabels,
          open: filteredData.map(item => item.open),
          high: filteredData.map(item => item.high),
          low: filteredData.map(item => item.low),
          close: filteredData.map(item => item.close),
          type: 'ohlc',
          name: 'Price',
          decreasing: { line: { color: colors.downColor, width: 2 } },
          increasing: { line: { color: colors.upColor, width: 2 } }
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
          decreasing: { 
            line: { color: colors.downColor, width: 1 },
            fillcolor: colors.downColor
          },
          increasing: { 
            line: { color: colors.upColor, width: 1 },
            fillcolor: colors.upColor
          },
          whiskerwidth: 0.8
        };
        break;
        
      case 'line':
        priceChart = {
          x: timeLabels,
          y: filteredData.map(item => item.close),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          line: { color: colors.line, width: 2.5 }
        };
        break;
        
      case 'area':
        priceChart = {
          x: timeLabels,
          y: filteredData.map(item => item.close),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          fill: 'tozeroy',
          fillcolor: `rgba(96, 165, 250, 0.2)`,
          line: { color: colors.line, width: 2.5 }
        };
        break;
    }
    
    plotElements.push(priceChart);

    // Enhanced volume chart
    if (showVolume) {
      const volume = {
        x: timeLabels,
        y: filteredData.map(item => item.volume),
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
          color: filteredData.map((item, i) => {
            if (i > 0) {
              return item.close > filteredData[i-1].close ? colors.volume.up : colors.volume.down;
            }
            return colors.volume.up;
          }),
          line: { width: 0 }
        },
        opacity: 0.7
      };
      plotElements.push(volume);
    }

    const prices = filteredData.map(item => item.close);

    // Enhanced Moving Averages
    if (activeIndicators.includes('ma')) {
      selectedMAperiods.forEach((period, index) => {
        const ma = calculateIndicator('ma', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ma,
          type: 'scatter',
          mode: 'lines',
          name: `MA(${period})`,
          line: { 
            color: colors.indicators.ma[index % colors.indicators.ma.length],
            width: 2
          }
        });
      });
    }

    // Enhanced Exponential Moving Averages
    if (activeIndicators.includes('ema')) {
      selectedEMAperiods.forEach((period, index) => {
        const ema = calculateIndicator('ema', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ema,
          type: 'scatter',
          mode: 'lines',
          name: `EMA(${period})`,
          line: { 
            color: colors.indicators.ema[index % colors.indicators.ema.length],
            width: 2,
            dash: 'dash'
          }
        });
      });
    }

    // Enhanced Bollinger Bands
    if (activeIndicators.includes('bollinger')) {
      const bands = calculateIndicator('bollinger', prices, { period: 20, stdDev: 2 }) as any;
      
      plotElements.push({
        x: timeLabels,
        y: bands.upper,
        type: 'scatter',
        mode: 'lines',
        name: 'BB Upper',
        line: { color: colors.indicators.bollinger, width: 1.5, dash: 'dot' },
        showlegend: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.lower,
        type: 'scatter',
        mode: 'lines',
        name: 'BB Lower',
        line: { color: colors.indicators.bollinger, width: 1.5, dash: 'dot' },
        fill: 'tonexty',
        fillcolor: `rgba(6, 182, 212, 0.1)`,
        showlegend: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.middle,
        type: 'scatter',
        mode: 'lines',
        name: 'BB(20,2)',
        line: { color: colors.indicators.bollinger, width: 1.5 }
      });
    }

    // Enhanced RSI
    if (activeIndicators.includes('rsi')) {
      const rsi = calculateIndicator('rsi', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: rsi,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI(14)',
        yaxis: 'y3',
        line: { color: colors.indicators.rsi, width: 2 }
      });
    }

    // Enhanced MACD
    if (activeIndicators.includes('macd')) {
      const macd = calculateIndicator('macd', prices) as any;
      
      plotElements.push({
        x: timeLabels,
        y: macd.macdLine,
        type: 'scatter',
        mode: 'lines',
        name: 'MACD',
        yaxis: 'y4',
        line: { color: colors.indicators.macd, width: 2 }
      });
      
      plotElements.push({
        x: timeLabels,
        y: macd.signalLine,
        type: 'scatter',
        mode: 'lines',
        name: 'Signal',
        yaxis: 'y4',
        line: { color: '#fbbf24', width: 2 }
      });
      
      plotElements.push({
        x: timeLabels,
        y: macd.histogram,
        type: 'bar',
        name: 'Histogram',
        yaxis: 'y4',
        marker: {
          color: macd.histogram.map((val: number | null) => 
            val === null ? 'rgba(0,0,0,0)' : 
            val >= 0 ? colors.upColor : colors.downColor
          ),
          opacity: 0.7
        }
      });
    }

    // Enhanced OBV
    if (activeIndicators.includes('obv')) {
      const obv = calculateIndicator('obv', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: obv,
        type: 'scatter',
        mode: 'lines',
        name: 'OBV',
        yaxis: 'y5',
        line: { color: colors.indicators.obv, width: 2 }
      });
    }

    return { plotData: plotElements, timeLabels };
  }, [data, selectedChartType, activeIndicators, showVolume, selectedMAperiods, selectedEMAperiods, chartTheme]);

  // Enhanced layout configuration with market hours
  const layout = useMemo(() => {
    const colors = getColorTheme();
    
    // Calculate subplot domains
    const hasRSI = activeIndicators.includes('rsi');
    const hasMACD = activeIndicators.includes('macd');
    const hasOBV = activeIndicators.includes('obv');
    const indicatorCount = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0) + (hasOBV ? 1 : 0);
    
    let priceChartDomain = [0.3, 1];
    let volumeDomain = [0.15, 0.28];
    
    if (indicatorCount > 0) {
      const indicatorHeight = 0.12;
      const totalIndicatorHeight = indicatorCount * indicatorHeight;
      
      priceChartDomain = [0.3 + totalIndicatorHeight, 1];
      volumeDomain = [0.15 + totalIndicatorHeight, 0.28 + totalIndicatorHeight];
    }

    const baseLayout: any = {
      dragmode: drawingMode || 'zoom',
      showlegend: true,
      legend: {
        x: 0,
        y: 1.02,
        orientation: 'h',
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text, size: 11 }
      },
      margin: { r: 60, l: 60, b: 50, t: 80, pad: 4 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      
      // Enhanced main price chart with market hours
      xaxis: {
        rangeslider: { visible: false },
        type: 'date',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: 10 },
        title: { text: '', font: { color: colors.text } },
        rangebreaks: generateMarketBreaks()
      },
      
      yaxis: {
        title: { text: 'Price (₹)', font: { color: colors.text, size: 12 } },
        autorange: true,
        domain: priceChartDomain,
        tickformat: ',.2f',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.grid,
        type: logScale ? 'log' : 'linear',
        tickfont: { color: colors.text, size: 10 },
        side: 'left'
      },
      
      // Enhanced volume panel
      yaxis2: {
        title: { text: 'Volume', font: { color: colors.text, size: 10 } },
        autorange: true,
        domain: volumeDomain,
        showgrid: false,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        side: 'right'
      },
      
      hovermode: crosshair ? 'x unified' : 'closest',
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: 11 }
      },
      shapes: annotations,
      title: {
        text: companyId ? 
          `${companyId} - ${selectedInterval.toUpperCase()} Chart ${startDate && endDate ? 
            `(${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})` : 
            startDate ? `(First 15 mins of ${startDate.toLocaleDateString()})` : 
            '(Market Hours Only)'
          }` : 
          'Select a Company',
        font: { color: colors.text, size: 16, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      }
    };
    
    // Add indicator subplots
    let currentBottom = 0;
    
    if (hasRSI) {
      baseLayout.yaxis3 = {
        title: { text: 'RSI', font: { color: colors.indicators.rsi, size: 10 } },
        domain: [currentBottom, currentBottom + 0.12],
        range: [0, 100],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        tickvals: [20, 50, 80],
        side: 'right'
      };
      
      baseLayout.shapes = baseLayout.shapes || [];
      baseLayout.shapes.push(
        {
          type: 'line',
          xref: 'paper',
          yref: 'y3',
          x0: 0, y0: 30, x1: 1, y1: 30,
          line: { color: colors.upColor, width: 1, dash: 'dash' }
        },
        {
          type: 'line',
          xref: 'paper',
          yref: 'y3',
          x0: 0, y0: 70, x1: 1, y1: 70,
          line: { color: colors.downColor, width: 1, dash: 'dash' }
        }
      );
      currentBottom += 0.13;
    }
    
    if (hasMACD) {
      baseLayout.yaxis4 = {
        title: { text: 'MACD', font: { color: colors.indicators.macd, size: 10 } },
        domain: [currentBottom, currentBottom + 0.12],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        side: 'right'
      };
      
      baseLayout.shapes = baseLayout.shapes || [];
      baseLayout.shapes.push({
        type: 'line',
        xref: 'paper',
        yref: 'y4',
        x0: 0, y0: 0, x1: 1, y1: 0,
        line: { color: colors.text, width: 1, dash: 'dot' }
      });
      currentBottom += 0.13;
    }
    
    if (hasOBV) {
      baseLayout.yaxis5 = {
        title: { text: 'OBV', font: { color: colors.indicators.obv, size: 10 } },
        domain: [currentBottom, currentBottom + 0.12],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        side: 'right'
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
    selectedInterval,
    timeLabels,
    startDate,
    endDate
  ]);

  // Enhanced Plotly configuration
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
    modeBarButtonsToRemove: ['autoScale2d', 'select2d', 'lasso2d'],
    displaylogo: false,
    toImageButtonOptions: {
      format: 'png',
      filename: `${companyId || 'chart'}_${new Date().toISOString().split('T')[0]}`,
      height: 800,
      width: 1200,
      scale: 2
    }
  };

  // Enhanced event handlers
  const toggleIndicator = (id: string) => {
    setActiveIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(ind => ind !== id) 
        : [...prev, id]
    );
  };

  const toggleMAPeriod = (period: number) => {
    setSelectedMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period].sort((a, b) => a - b)
    );
  };

  const toggleEMAPeriod = (period: number) => {
    setSelectedEMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period].sort((a, b) => a - b)
    );
  };

  const handleThemeToggle = () => {
    const newTheme = chartTheme === 'dark' ? 'light' : 'dark';
    setChartTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
    if (onIntervalChange) {
      onIntervalChange(newInterval);
    }
  };

  const resetChart = () => {
    setSelectedChartType(defaultChartType);
    setSelectedInterval(interval);
    setActiveIndicators(indicators);
    setSelectedMAperiods([20, 50]);
    setSelectedEMAperiods([9, 21]);
    setShowVolume(true);
    setShowGridlines(true);
    setLogScale(false);
    setDrawingMode(null);
    setAnnotations([]);
    setCrosshair(true);
    setAutoRefresh(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full rounded-xl" style={{ backgroundColor: '#27272a' }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <div className="text-lg font-medium text-gray-300">Loading market data...</div>
          <div className="text-sm text-gray-400">Fetching latest prices and indicators</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex justify-center items-center h-full rounded-xl" style={{ backgroundColor: '#27272a' }}>
        <div className="text-center">
          <div className="text-red-400 text-lg font-medium mb-2">Error loading data</div>
          <div className="text-sm text-gray-400">{error}</div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No company selected
  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-full rounded-xl" style={{ backgroundColor: '#27272a' }}>
        <div className="text-center">
          <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <div className="text-lg font-medium text-gray-300">Select a company to view chart</div>
          <div className="text-sm text-gray-400 mt-2">Choose from the watchlist to start analyzing</div>
        </div>
      </div>
    );
  }

  // No data available
  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center h-full rounded-xl" style={{ backgroundColor: '#27272a' }}>
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <div className="text-lg font-medium text-gray-300">No data available</div>
          <div className="text-sm text-gray-400 mt-2">
            {startDate && endDate ? 
              `No data found between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}` :
              startDate ? 
                `No data found for first 15 minutes of ${startDate.toLocaleDateString()}` :
                'Select a date range to fetch data'
            }
          </div>
        </div>
      </div>
    );
  }

  const colors = getColorTheme();

  return (
    <div className="w-full h-full flex relative" style={{ backgroundColor: colors.bg }}>
      {/* Main Chart Area */}
      <div className={`h-full transition-all duration-300 ease-in-out ${sidebarVisible ? 'w-4/5' : 'w-full'}`}>
        <Plot
          data={plotData}
          layout={layout}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
          config={config}
          onRelayout={(e) => {
            if (e.shapes) {
              setAnnotations(e.shapes);
            }
          }}
        />
      </div>

      {/* Enhanced Controls Panel */}
      <div 
        className={`h-full overflow-y-auto border-l transition-all duration-300 ease-in-out ${
          sidebarVisible ? 'w-1/5 opacity-100' : 'w-0 opacity-0 overflow-hidden'
        }`}
        style={{ 
          backgroundColor: colors.bg, 
          borderColor: colors.grid,
          color: colors.text
        }}
      >
        <div className="p-3 space-y-4">
          {/* Header with theme toggle */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Chart Controls</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleThemeToggle}
                className="p-1.5 rounded-md hover:bg-opacity-80 transition-colors"
                style={{ backgroundColor: colors.button.bg }}
                title={`Switch to ${chartTheme === 'dark' ? 'light' : 'dark'} theme`}
              >
                {chartTheme === 'dark' ? 
                  <Sun className="h-4 w-4" /> : 
                  <Moon className="h-4 w-4" />
                }
              </button>
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="p-1.5 rounded-md hover:bg-opacity-80 transition-colors"
                style={{ backgroundColor: colors.button.bg }}
                title="Toggle sidebar"
              >
                {sidebarVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Data Info */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Data Info
            </h4>
            <div className="text-xs text-gray-400">
              <div>📊 {data.length} total data points</div>
              <div>⏰ Market hours only</div>
              {startDate && endDate && (
                <div>📅 {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}</div>
              )}
              {startDate && !endDate && (
                <div>🕘 First 15 mins of {startDate.toLocaleDateString()}</div>
              )}
            </div>
          </div>

          {/* Time Frame Panel - RESTORED */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              Time Frame
            </h4>
            <div className="grid grid-cols-2 gap-1">
              {timeIntervals.map(int => (
                <button
                  key={int.id}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    selectedInterval === int.id 
                      ? 'text-white' 
                      : 'hover:bg-opacity-80'
                  }`}
                  style={{
                    backgroundColor: selectedInterval === int.id 
                      ? colors.button.bgActive 
                      : colors.button.bg,
                    color: selectedInterval === int.id 
                      ? '#ffffff' 
                      : colors.text
                  }}
                  onClick={() => handleIntervalChange(int.id)}
                >
                  {int.name}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Type Panel */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <BarChart3 className="h-3 w-3 mr-1" />
              Chart Type
            </h4>
            <div className="space-y-1">
              {chartTypes.map(type => {
                const IconComponent = type.icon;
                return (
                  <button
                    key={type.id}
                    className={`w-full px-2 py-1.5 text-xs rounded flex items-center transition-colors ${
                      selectedChartType === type.id 
                        ? 'text-white' 
                        : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: selectedChartType === type.id 
                        ? colors.button.bgActive 
                        : 'transparent',
                      color: selectedChartType === type.id 
                        ? '#ffffff' 
                        : colors.text
                    }}
                    onClick={() => setSelectedChartType(type.id)}
                  >
                    <IconComponent className="h-3 w-3 mr-2" />
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technical Indicators Panel */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" />
              Technical Indicators
            </h4>
            <div className="space-y-2">
              {availableIndicators.map(ind => (
                <div key={ind.id}>
                  <label className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      className="mr-2 rounded"
                      checked={activeIndicators.includes(ind.id)}
                      onChange={() => toggleIndicator(ind.id)}
                    />
                    <span style={{ color: ind.color }}>{ind.name}</span>
                  </label>

                  {/* MA periods */}
                  {ind.id === 'ma' && activeIndicators.includes('ma') && (
                    <div className="ml-4 mt-1 flex flex-wrap gap-1">
                      {ind.periods.map(period => (
                        <button
                          key={period}
                          className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                            selectedMAperiods.includes(period) 
                              ? 'text-white' 
                              : 'hover:bg-opacity-80'
                          }`}
                          style={{
                            backgroundColor: selectedMAperiods.includes(period) 
                              ? colors.button.bgActive 
                              : colors.button.bg,
                            color: selectedMAperiods.includes(period) 
                              ? '#ffffff' 
                              : colors.text
                          }}
                          onClick={() => toggleMAPeriod(period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* EMA periods */}
                  {ind.id === 'ema' && activeIndicators.includes('ema') && (
                    <div className="ml-4 mt-1 flex flex-wrap gap-1">
                      {ind.periods.map(period => (
                        <button
                          key={period}
                          className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                            selectedEMAperiods.includes(period) 
                              ? 'text-white' 
                              : 'hover:bg-opacity-80'
                          }`}
                          style={{
                            backgroundColor: selectedEMAperiods.includes(period) 
                              ? colors.button.bgActive 
                              : colors.button.bg,
                            color: selectedEMAperiods.includes(period) 
                              ? '#ffffff' 
                              : colors.text
                          }}
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

          {/* Drawing Tools Panel */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <MousePointer className="h-3 w-3 mr-1" />
              Drawing Tools
            </h4>
            <div className="grid grid-cols-2 gap-1">
              {drawingTools.map(tool => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.id}
                    className={`px-2 py-1.5 text-xs rounded flex items-center justify-center transition-colors ${
                      drawingMode === tool.id 
                        ? 'text-white' 
                        : 'hover:bg-opacity-80'
                    }`}
                    style={{
                      backgroundColor: drawingMode === tool.id 
                        ? colors.button.bgActive 
                        : colors.button.bg,
                      color: drawingMode === tool.id 
                        ? '#ffffff' 
                        : colors.text
                    }}
                    onClick={() => setDrawingMode(drawingMode === tool.id ? null : tool.id)}
                    title={tool.name}
                  >
                    <IconComponent className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Options Panel */}
          <div className="border rounded-lg p-3" style={{ borderColor: colors.grid, backgroundColor: colors.button.bg }}>
            <h4 className="font-medium text-xs mb-2 flex items-center">
              <Settings className="h-3 w-3 mr-1" />
              Chart Options
            </h4>
            <div className="space-y-2">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                />
                Show Volume
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={showGridlines}
                  onChange={(e) => setShowGridlines(e.target.checked)}
                />
                Show Gridlines
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={logScale}
                  onChange={(e) => setLogScale(e.target.checked)}
                />
                Log Scale
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="mr-2 rounded"
                  checked={crosshair}
                  onChange={(e) => setCrosshair(e.target.checked)}
                />
                Crosshair
              </label>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetChart}
            className="w-full px-3 py-2 text-xs rounded flex items-center justify-center transition-colors"
            style={{
              backgroundColor: colors.button.bg,
              color: colors.text
            }}
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            Reset Chart
          </button>
        </div>
      </div>

      {/* Toggle Sidebar Button */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="absolute top-4 right-4 p-2 rounded-md shadow-lg transition-colors z-10"
          style={{
            backgroundColor: colors.button.bg,
            color: colors.text
          }}
          title="Show controls"
        >
          <Settings className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
