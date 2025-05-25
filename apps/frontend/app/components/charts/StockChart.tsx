'use client'
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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

// **PERFORMANCE OPTIMIZATION**: Pre-computed constants with enhanced configuration
const CHART_PERFORMANCE_CONFIG = {
  MAX_VISIBLE_POINTS: 2000, // Limit visible points for smooth performance
  CHUNK_SIZE: 1000,
  DEBOUNCE_DELAY: 16, // ~60fps
  WEBGL_THRESHOLD: 1000, // Use WebGL for datasets larger than this
  MARKET_OPEN_MINUTES: 9 * 60 + 15, // 9:15 AM in minutes
  MARKET_CLOSE_MINUTES: 15 * 60 + 30, // 3:30 PM in minutes
  IST_OFFSET: 5.5 * 60 * 60 * 1000, // IST is UTC+5:30
  ZOOM_WINDOW_MINUTES: 15, // 15 minutes before and after for zoom
  PRICE_PADDING_PERCENT: 0.08, // 8% padding for better visibility
};

// Enhanced technical indicators with more options and performance optimizations
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

// **PERFORMANCE**: Web Worker for heavy calculations with enhanced functionality
const createWebWorker = () => {
  if (typeof Worker !== 'undefined') {
    const workerCode = `
      self.onmessage = function(e) {
        const { type, data } = e.data;
        
        if (type === 'CALCULATE_MA') {
          const { prices, period } = data;
          const result = prices.map((_, i) => {
            if (i < period - 1) return null;
            const slice = prices.slice(i - period + 1, i + 1);
            return slice.reduce((sum, price) => sum + price, 0) / period;
          });
          self.postMessage({ type: 'MA_RESULT', result });
        }
        
        if (type === 'CALCULATE_EMA') {
          const { prices, period } = data;
          const k = 2 / (period + 1);
          const ema = [prices[0]];
          
          for (let i = 1; i < prices.length; i++) {
            ema.push(prices[i] * k + ema[i-1] * (1-k));
          }
          
          const result = Array(period - 1).fill(null).concat(ema.slice(period - 1));
          self.postMessage({ type: 'EMA_RESULT', result });
        }
        
        if (type === 'CALCULATE_RSI') {
          const { prices, period } = data;
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
          
          self.postMessage({ type: 'RSI_RESULT', result: rsi });
        }
      };
    `;
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }
  return null;
};

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
  // **ENHANCED**: Chart state management with performance optimization
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
  
  // Advanced features state from 1473-line version
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  
  // **PERFORMANCE**: Refs for performance optimization
  const plotRef = useRef<any>(null);
  const webWorkerRef = useRef<Worker | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // **PERFORMANCE**: Initialize web worker for heavy calculations
  useEffect(() => {
    webWorkerRef.current = createWebWorker();
    return () => {
      if (webWorkerRef.current) {
        webWorkerRef.current.terminate();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Sync interval with props
  useEffect(() => {
    setSelectedInterval(interval);
  }, [interval]);

  // Theme synchronization
  useEffect(() => {
    setChartTheme(theme);
  }, [theme]);

  // **PERFORMANCE**: Debounced update function
  const debouncedUpdate = useCallback((callback: () => void) => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < CHART_PERFORMANCE_CONFIG.DEBOUNCE_DELAY) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(callback);
    } else {
      callback();
      lastUpdateTimeRef.current = now;
    }
  }, []);

  // **ENHANCED**: Market hours filtering function with timezone handling and performance optimization
  const filterMarketHours = useCallback((data: StockDataPoint[]) => {
    if (!data || !data.length) return [];
    
    return data.filter(item => {
      const date = new Date(item.interval_start);
      const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      // Only Monday to Friday (1-5) - exclude weekends
      if (day < 1 || day > 5) return false;
      
      // Market hours: 9:15 AM to 3:30 PM IST (inclusive)
      return timeInMinutes >= CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES && 
             timeInMinutes <= CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES;
    });
  }, []);

  // **ENHANCED**: Generate comprehensive market hour breaks
  const generateMarketBreaks = useCallback(() => {
    const breaks = [];
    
    // Weekend breaks (Saturday and Sunday) - more precise bounds
    breaks.push({ 
      pattern: 'day of week', 
      bounds: [6, 1] // Saturday to Monday
    });
    
    // **ENHANCED**: Daily market closure breaks (3:31 PM to 9:14 AM next day)
    breaks.push({
      pattern: 'hour',
      bounds: [15.517, 9.233] // 3:31 PM (15:31) to 9:14 AM (9:14) - more precise
    });
    
    return breaks;
  }, []);

  // **PERFORMANCE**: Optimized data chunking for smooth rendering
  const optimizeDataForRendering = useCallback((filteredData: StockDataPoint[]) => {
    if (!filteredData.length) return filteredData;
    
    // If dataset is small, return as-is
    if (filteredData.length <= CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS) {
      return filteredData;
    }
    
    // For large datasets, implement intelligent downsampling
    const ratio = Math.ceil(filteredData.length / CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS);
    const optimizedData: StockDataPoint[] = [];
    
    for (let i = 0; i < filteredData.length; i += ratio) {
      const chunk = filteredData.slice(i, i + ratio);
      if (chunk.length === 1) {
        optimizedData.push(chunk[0]);
      } else {
        // For chunks, create aggregate data point preserving OHLC logic
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map(d => d.high));
        const low = Math.min(...chunk.map(d => d.low));
        const volume = chunk.reduce((sum, d) => sum + d.volume, 0);
        
        optimizedData.push({
          interval_start: chunk[0].interval_start,
          open,
          high,
          low,
          close,
          volume
        });
      }
    }
    
    return optimizedData;
  }, []);

  // **ENHANCED**: Calculate optimal zoom range with better market hours awareness
  const calculateOptimalZoomRange = useCallback((filteredData: StockDataPoint[]) => {
    // Check if no specific date range is selected (i.e., "Fetch All Data" was used)
    const isAllDataView = !startDate && !endDate;
    
    if (!isAllDataView || !filteredData.length) {
      return null; // Use default autorange behavior for date-specific queries
    }

    // **ENHANCED**: Get current date in IST timezone
    const now = new Date();
    const istNow = new Date(now.getTime() + CHART_PERFORMANCE_CONFIG.IST_OFFSET);
    const todayDateString = istNow.toISOString().split('T')[0];
    
    // **ENHANCED**: Create today's 9:15 AM IST timestamp
    const targetCenter = new Date(`${todayDateString}T09:15:00.000Z`);
    
    // Find data points for today (market hours only)
    const todayData = filteredData.filter(item => {
      const itemDate = new Date(item.interval_start);
      const itemDateString = itemDate.toISOString().split('T')[0];
      return itemDateString === todayDateString;
    });

    if (todayData.length === 0) {
      // **ENHANCED**: If no data for today, find the most recent trading day
      const sortedData = [...filteredData].sort((a, b) => 
        new Date(b.interval_start).getTime() - new Date(a.interval_start).getTime()
      );
      
      if (sortedData.length > 0) {
        const latestDate = new Date(sortedData[0].interval_start);
        const latestDateString = latestDate.toISOString().split('T')[0];
        const latestDayData = filteredData.filter(item => {
          const itemDate = new Date(item.interval_start);
          const itemDateString = itemDate.toISOString().split('T')[0];
          return itemDateString === latestDateString;
        });
        
        if (latestDayData.length > 0) {
          // Use the latest trading day's 9:15 AM as center
          const latestDayCenter = new Date(`${latestDateString}T09:15:00.000Z`);
          return calculateZoomWindow(latestDayCenter, latestDayData, filteredData);
        }
      }
      return null;
    }

    return calculateZoomWindow(targetCenter, todayData, filteredData);
  }, [startDate, endDate]);

  // **ENHANCED**: Calculate 30-minute zoom window with better data handling
  const calculateZoomWindow = useCallback((centerTime: Date, dayData: StockDataPoint[], allData: StockDataPoint[]) => {
    // **ENHANCED**: Create 30-minute window (15 minutes before and after 9:15 AM)
    const startTime = new Date(centerTime.getTime() - CHART_PERFORMANCE_CONFIG.ZOOM_WINDOW_MINUTES * 60 * 1000);
    const endTime = new Date(centerTime.getTime() + CHART_PERFORMANCE_CONFIG.ZOOM_WINDOW_MINUTES * 60 * 1000);

    // **ENHANCED**: Get price data for the visible window to calculate Y-axis range
    const windowData = dayData.filter(item => {
      const itemTime = new Date(item.interval_start);
      return itemTime >= startTime && itemTime <= endTime;
    });

    let yRange = null;
    if (windowData.length > 0) {
      const prices = windowData.flatMap(item => [item.open, item.high, item.low, item.close]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * CHART_PERFORMANCE_CONFIG.PRICE_PADDING_PERCENT;
      yRange = [minPrice - padding, maxPrice + padding];
    } else if (dayData.length > 0) {
      // **ENHANCED**: Fallback to day's data if no data in 30-min window
      const prices = dayData.flatMap(item => [item.open, item.high, item.low, item.close]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * CHART_PERFORMANCE_CONFIG.PRICE_PADDING_PERCENT;
      yRange = [minPrice - padding, maxPrice + padding];
    }

    return {
      xRange: [startTime.toISOString(), endTime.toISOString()],
      yRange: yRange
    };
  }, []);

  // **ENHANCED**: Comprehensive indicator calculations with performance optimizations
  const calculateIndicator = useCallback((type: string, prices: number[], options = {}) => {
    switch (type) {
      case 'ma': {
        const period = (options as any).period || 20;
        const result = new Array(prices.length);
        
        for (let i = 0; i < prices.length; i++) {
          if (i < period - 1) {
            result[i] = null;
          } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
              sum += prices[j];
            }
            result[i] = sum / period;
          }
        }
        return result;
      }
      
      case 'ema': {
        const period = (options as any).period || 9;
        const k = 2 / (period + 1);
        const result = new Array(prices.length);
        result[0] = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
          result[i] = prices[i] * k + result[i-1] * (1-k);
        }
        
        // Fill initial nulls
        for (let i = 0; i < period - 1; i++) {
          result[i] = null;
        }
        
        return result;
      }
      
      case 'bollinger': {
        const period = (options as any).period || 20;
        const stdDevMultiplier = (options as any).stdDev || 2;
        const ma = calculateIndicator('ma', prices, { period }) as number[];
        
        const upperBand = new Array(prices.length);
        const lowerBand = new Array(prices.length);
        
        for (let i = 0; i < prices.length; i++) {
          if (ma[i] === null) {
            upperBand[i] = null;
            lowerBand[i] = null;
          } else {
            let sumSquares = 0;
            for (let j = i - period + 1; j <= i; j++) {
              const diff = prices[j] - ma[i];
              sumSquares += diff * diff;
            }
            const stdDev = Math.sqrt(sumSquares / period);
            upperBand[i] = ma[i] + (stdDev * stdDevMultiplier);
            lowerBand[i] = ma[i] - (stdDev * stdDevMultiplier);
          }
        }
        
        return { middle: ma, upper: upperBand, lower: lowerBand };
      }
      
      case 'rsi': {
        const period = (options as any).period || 14;
        const gains = new Array(prices.length - 1);
        const losses = new Array(prices.length - 1);
        
        // Calculate price changes
        for (let i = 1; i < prices.length; i++) {
          const change = prices[i] - prices[i-1];
          gains[i-1] = change > 0 ? change : 0;
          losses[i-1] = change < 0 ? -change : 0;
        }
        
        const result = new Array(prices.length).fill(null);
        
        if (gains.length >= period) {
          // Initial average
          let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
          let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
          
          for (let i = period; i < gains.length; i++) {
            avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
            
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            result[i + 1] = 100 - (100 / (1 + rs));
          }
        }
        
        return result;
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
      
      case 'atr': {
        const period = (options as any).period || 14;
        if (!data || data.length < 2) return [];
        
        const trueRanges = [];
        for (let i = 1; i < data.length; i++) {
          const high = data[i].high;
          const low = data[i].low;
          const prevClose = data[i-1].close;
          
          const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
          );
          trueRanges.push(tr);
        }
        
        const atr = new Array(data.length).fill(null);
        
        if (trueRanges.length >= period) {
          // Initial ATR
          let currentATR = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
          atr[period] = currentATR;
          
          // Subsequent ATR values using Wilder's smoothing
          for (let i = period + 1; i < data.length; i++) {
            currentATR = ((currentATR * (period - 1)) + trueRanges[i - 1]) / period;
            atr[i] = currentATR;
          }
        }
        
        return atr;
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
      
      case 'stoch': {
        const kPeriod = (options as any).kPeriod || 14;
        const dPeriod = (options as any).dPeriod || 3;
        
        if (!data || data.length < kPeriod) return { k: [], d: [] };
        
        const kValues = new Array(data.length).fill(null);
        
        for (let i = kPeriod - 1; i < data.length; i++) {
          const slice = data.slice(i - kPeriod + 1, i + 1);
          const highest = Math.max(...slice.map(d => d.high));
          const lowest = Math.min(...slice.map(d => d.low));
          const current = data[i].close;
          
          if (highest === lowest) {
            kValues[i] = 50; // Avoid division by zero
          } else {
            kValues[i] = ((current - lowest) / (highest - lowest)) * 100;
          }
        }
        
        // Calculate %D (SMA of %K)
        const dValues = new Array(data.length).fill(null);
        for (let i = kPeriod + dPeriod - 2; i < data.length; i++) {
          const slice = kValues.slice(i - dPeriod + 1, i + 1).filter(v => v !== null);
          if (slice.length === dPeriod) {
            dValues[i] = slice.reduce((sum, val) => sum + val, 0) / dPeriod;
          }
        }
        
        return { k: kValues, d: dValues };
      }
      
      case 'vwap': {
        if (!data || !data.length) return [];
        
        const vwap = new Array(data.length);
        let cumulativeTPV = 0; // Typical Price * Volume
        let cumulativeVolume = 0;
        
        for (let i = 0; i < data.length; i++) {
          const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
          const volume = data[i].volume;
          
          cumulativeTPV += typicalPrice * volume;
          cumulativeVolume += volume;
          
          vwap[i] = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null;
        }
        
        return vwap;
      }
      
      default:
        return [];
    }
  }, [data]);

  // Enhanced Heiken Ashi calculation with performance optimization
  const convertToHeikenAshi = useCallback((data: StockDataPoint[]) => {
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
  }, []);

  // **ENHANCED**: Color theme with #27272a base and better contrast
  const getColorTheme = useCallback(() => {
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
          obv: '#f59e0b',
          atr: '#14b8a6',
          stoch: '#f472b6',
          vwap: '#84cc16'
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
          obv: '#d97706',
          atr: '#0d9488',
          stoch: '#db2777',
          vwap: '#65a30d'
        },
        button: {
          bg: '#f8fafc',
          bgActive: '#3b82f6',
          bgHover: '#f1f5f9',
          text: baseColor
        }
      };
    }
  }, [chartTheme]);

  // **ENHANCED**: Plot data generation with consistent market hours filtering and all functionalities
  const { plotData, timeLabels, filteredData } = useMemo(() => {
    if (!data || !data.length) return { plotData: [], timeLabels: [], filteredData: [] };

    // **ALWAYS** filter data to market hours only - consistent behavior
    const marketHoursData = filterMarketHours(data);
    const optimizedData = optimizeDataForRendering(marketHoursData);
    
    if (!optimizedData.length) return { plotData: [], timeLabels: [], filteredData: [] };

    const colors = getColorTheme();
    const timeLabels = optimizedData.map(item => new Date(item.interval_start));
    const plotElements = [];
    
    // **PERFORMANCE**: Determine if we should use WebGL
    const useWebGL = optimizedData.length > CHART_PERFORMANCE_CONFIG.WEBGL_THRESHOLD;
    const chartType = useWebGL ? 'scattergl' : 'scatter';
    
    const chartData = selectedChartType === 'heiken-ashi' ? convertToHeikenAshi(optimizedData) : optimizedData;

    // **ENHANCED**: Main price chart with all chart types
    let priceChart;
    
    switch (selectedChartType) {
      case 'candlestick':
        priceChart = {
          x: timeLabels,
          open: optimizedData.map(item => item.open),
          high: optimizedData.map(item => item.high),
          low: optimizedData.map(item => item.low),
          close: optimizedData.map(item => item.close),
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
          open: optimizedData.map(item => item.open),
          high: optimizedData.map(item => item.high),
          low: optimizedData.map(item => item.low),
          close: optimizedData.map(item => item.close),
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
          y: optimizedData.map(item => item.close),
          type: chartType,
          mode: 'lines',
          name: 'Price',
          line: { 
            color: colors.line, 
            width: 2.5,
            shape: 'spline',
            smoothing: 0.8
          }
        };
        break;
        
      case 'area':
        priceChart = {
          x: timeLabels,
          y: optimizedData.map(item => item.close),
          type: chartType,
          mode: 'lines',
          name: 'Price',
          fill: 'tozeroy',
          fillcolor: `rgba(96, 165, 250, 0.2)`,
          line: { 
            color: colors.line, 
            width: 2.5,
            shape: 'spline',
            smoothing: 0.8
          }
        };
        break;
    }
    
    plotElements.push(priceChart);

    // **ENHANCED**: Volume chart with performance optimization
    if (showVolume) {
      const volume = {
        x: timeLabels,
        y: optimizedData.map(item => item.volume),
        type: 'bar',
        name: 'Volume',
        yaxis: 'y2',
        marker: {
          color: optimizedData.map((item, i) => {
            if (i > 0) {
              return item.close > optimizedData[i-1].close ? colors.volume.up : colors.volume.down;
            }
            return colors.volume.up;
          }),
          line: { width: 0 }
        },
        opacity: 0.7
      };
      plotElements.push(volume);
    }

    const prices = optimizedData.map(item => item.close);

    // **ENHANCED**: Moving Averages with performance optimization
    if (activeIndicators.includes('ma')) {
      selectedMAperiods.forEach((period, index) => {
        const ma = calculateIndicator('ma', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ma,
          type: chartType,
          mode: 'lines',
          name: `MA(${period})`,
          line: { 
            color: colors.indicators.ma[index % colors.indicators.ma.length],
            width: 2,
            shape: 'spline',
            smoothing: 1.0
          }
        });
      });
    }

    // **ENHANCED**: Exponential Moving Averages with performance optimization
    if (activeIndicators.includes('ema')) {
      selectedEMAperiods.forEach((period, index) => {
        const ema = calculateIndicator('ema', prices, { period });
        plotElements.push({
          x: timeLabels,
          y: ema,
          type: chartType,
          mode: 'lines',
          name: `EMA(${period})`,
          line: { 
            color: colors.indicators.ema[index % colors.indicators.ema.length],
            width: 2,
            dash: 'dash',
            shape: 'spline',
            smoothing: 1.0
          }
        });
      });
    }

    // **ENHANCED**: Bollinger Bands with performance optimization
    if (activeIndicators.includes('bollinger')) {
      const bands = calculateIndicator('bollinger', prices, { period: 20, stdDev: 2 }) as any;
      
      plotElements.push({
        x: timeLabels,
        y: bands.upper,
        type: chartType,
        mode: 'lines',
        name: 'BB Upper',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5, 
          dash: 'dot',
          shape: 'spline',
          smoothing: 0.6
        },
        showlegend: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.lower,
        type: chartType,
        mode: 'lines',
        name: 'BB Lower',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5, 
          dash: 'dot',
          shape: 'spline',
          smoothing: 0.6
        },
        fill: 'tonexty',
        fillcolor: `rgba(6, 182, 212, 0.1)`,
        showlegend: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.middle,
        type: chartType,
        mode: 'lines',
        name: 'BB(20,2)',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5,
          shape: 'spline',
          smoothing: 0.6
        }
      });
    }

    // **ENHANCED**: RSI with performance optimization
    if (activeIndicators.includes('rsi')) {
      const rsi = calculateIndicator('rsi', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: rsi,
        type: chartType,
        mode: 'lines',
        name: 'RSI(14)',
        yaxis: 'y3',
        line: { 
          color: colors.indicators.rsi, 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
      });
    }

    // **ENHANCED**: MACD with performance optimization
    if (activeIndicators.includes('macd')) {
      const macd = calculateIndicator('macd', prices) as any;
      
      plotElements.push({
        x: timeLabels,
        y: macd.macdLine,
        type: chartType,
        mode: 'lines',
        name: 'MACD',
        yaxis: 'y4',
        line: { 
          color: colors.indicators.macd, 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
      });
      
      plotElements.push({
        x: timeLabels,
        y: macd.signalLine,
        type: chartType,
        mode: 'lines',
        name: 'Signal',
        yaxis: 'y4',
        line: { 
          color: '#fbbf24', 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
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

    // **ENHANCED**: ATR indicator
    if (activeIndicators.includes('atr')) {
      const atr = calculateIndicator('atr', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: atr,
        type: chartType,
        mode: 'lines',
        name: 'ATR(14)',
        yaxis: 'y5',
        line: { 
          color: colors.indicators.atr, 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
      });
    }

    // **ENHANCED**: OBV indicator
    if (activeIndicators.includes('obv')) {
      const obv = calculateIndicator('obv', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: obv,
        type: chartType,
        mode: 'lines',
        name: 'OBV',
        yaxis: 'y6',
        line: { 
          color: colors.indicators.obv, 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
      });
    }

    // **ENHANCED**: Stochastic indicator
    if (activeIndicators.includes('stoch')) {
      const stoch = calculateIndicator('stoch', prices) as any;
      
      plotElements.push({
        x: timeLabels,
        y: stoch.k,
        type: chartType,
        mode: 'lines',
        name: '%K(14)',
        yaxis: 'y7',
        line: { 
          color: colors.indicators.stoch, 
          width: 2,
          shape: 'spline',
          smoothing: 0.8
        }
      });
      
      plotElements.push({
        x: timeLabels,
        y: stoch.d,
        type: chartType,
        mode: 'lines',
        name: '%D(3)',
        yaxis: 'y7',
        line: { 
          color: '#fbbf24', 
          width: 2,
          dash: 'dash',
          shape: 'spline',
          smoothing: 0.8
        }
      });
    }

    // **ENHANCED**: VWAP indicator
    if (activeIndicators.includes('vwap')) {
      const vwap = calculateIndicator('vwap', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: vwap,
        type: chartType,
        mode: 'lines',
        name: 'VWAP',
        line: { 
          color: colors.indicators.vwap, 
          width: 2,
          dash: 'dashdot',
          shape: 'spline',
          smoothing: 0.8
        }
      });
    }

    return { plotData: plotElements, timeLabels, filteredData: optimizedData };
  }, [
    data, 
    selectedChartType, 
    activeIndicators, 
    showVolume, 
    selectedMAperiods, 
    selectedEMAperiods, 
    chartTheme,
    filterMarketHours,
    optimizeDataForRendering,
    getColorTheme,
    calculateIndicator,
    convertToHeikenAshi
  ]);

  // **ENHANCED**: Layout configuration with consistent market hours handling and all indicators
  const layout = useMemo(() => {
    const colors = getColorTheme();
    
    // **ENHANCED**: Calculate optimal zoom range using filtered data
    const zoomRange = calculateOptimalZoomRange(filteredData);
    
    // Calculate subplot domains for all indicators
    const hasRSI = activeIndicators.includes('rsi');
    const hasMACD = activeIndicators.includes('macd');
    const hasATR = activeIndicators.includes('atr');
    const hasOBV = activeIndicators.includes('obv');
    const hasStoch = activeIndicators.includes('stoch');
    
    const indicatorCount = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0) + (hasATR ? 1 : 0) + (hasOBV ? 1 : 0) + (hasStoch ? 1 : 0);
    
    let priceChartDomain = [0.3, 1];
    let volumeDomain = [0.15, 0.28];
    
    if (indicatorCount > 0) {
      const indicatorHeight = 0.12;
      const totalIndicatorHeight = indicatorCount * indicatorHeight;
      
      priceChartDomain = [0.3 + totalIndicatorHeight, 1];
      volumeDomain = [0.15 + totalIndicatorHeight, 0.28 + totalIndicatorHeight];
    }

    const baseLayout: any = {
      // **PERFORMANCE**: Optimized drag mode
      dragmode: drawingMode || 'pan',
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
      
      // **ENHANCED**: Main price chart with consistent market hours and optimal zoom
      xaxis: {
        rangeslider: { visible: false },
        type: 'date',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: 10 },
        title: { text: '', font: { color: colors.text } },
        // **ENHANCED**: Always apply market breaks for consistent behavior
        rangebreaks: generateMarketBreaks(),
        // **ENHANCED**: Apply optimal zoom range if calculated
        ...(zoomRange?.xRange && {
          range: zoomRange.xRange,
          autorange: false
        }),
        // **ENHANCED**: Fallback to autorange if no optimal zoom
        ...(!zoomRange?.xRange && {
          autorange: true
        }),
        // **PERFORMANCE**: Smooth zooming
        fixedrange: false
      },
      
      yaxis: {
        title: { text: 'Price (₹)', font: { color: colors.text, size: 12 } },
        domain: priceChartDomain,
        tickformat: ',.2f',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.grid,
        type: logScale ? 'log' : 'linear',
        tickfont: { color: colors.text, size: 10 },
        side: 'left',
        // **ENHANCED**: Apply optimal Y-axis zoom if calculated
        ...(zoomRange?.yRange && {
          range: zoomRange.yRange,
          autorange: false
        }),
        // **ENHANCED**: Fallback to autorange if no optimal zoom
        ...(!zoomRange?.yRange && {
          autorange: true
        }),
        // **PERFORMANCE**: Smooth zooming
        fixedrange: false
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
      
      // **PERFORMANCE**: Optimized hover mode
      hovermode: crosshair ? 'x unified' : 'closest',
      hoverdistance: 100,
      spikedistance: 1000,
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: 11 }
      },
      shapes: annotations,
      
      // **PERFORMANCE**: Smooth transitions
      transition: {
        duration: 100,
        easing: 'cubic-in-out'
      },
      
      title: {
        text: companyId ? 
          `${companyId} - ${selectedInterval.toUpperCase()} Chart ${startDate && endDate ? 
            `(${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})` : 
            startDate ? `(First 15 mins of ${startDate.toLocaleDateString()})` : 
            zoomRange ? '(Auto-zoomed to 9:15 AM ± 15 mins)' : 
            `(Market Hours Only: 9:15 AM - 3:30 PM) [Optimized: ${filteredData.length} points]`
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
    
    if (hasATR) {
      baseLayout.yaxis5 = {
        title: { text: 'ATR', font: { color: colors.indicators.atr, size: 10 } },
        domain: [currentBottom, currentBottom + 0.12],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        side: 'right'
      };
      currentBottom += 0.13;
    }
    
    if (hasOBV) {
      baseLayout.yaxis6 = {
        title: { text: 'OBV', font: { color: colors.indicators.obv, size: 10 } },
        domain: [currentBottom, currentBottom + 0.12],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: 9 },
        side: 'right'
      };
      currentBottom += 0.13;
    }
    
    if (hasStoch) {
      baseLayout.yaxis7 = {
        title: { text: 'Stoch', font: { color: colors.indicators.stoch, size: 10 } },
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
          yref: 'y7',
          x0: 0, y0: 20, x1: 1, y1: 20,
          line: { color: colors.upColor, width: 1, dash: 'dash' }
        },
        {
          type: 'line',
          xref: 'paper',
          yref: 'y7',
          x0: 0, y0: 80, x1: 1, y1: 80,
          line: { color: colors.downColor, width: 1, dash: 'dash' }
        }
      );
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
    endDate,
    filteredData,
    calculateOptimalZoomRange,
    generateMarketBreaks,
    getColorTheme
  ]);

  // **ENHANCED**: Plotly configuration with performance optimizations
  const config = useMemo(() => ({
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
    // **PERFORMANCE**: Optimized interactions
    doubleClick: 'reset+autosize',
    showTips: false,
    // **PERFORMANCE**: Enable WebGL when needed
    plotGlPixelRatio: window.devicePixelRatio || 1,
    toImageButtonOptions: {
      format: 'png',
      filename: `${companyId || 'chart'}_${new Date().toISOString().split('T')[0]}`,
      height: 800,
      width: 1200,
      scale: 2
    }
  }), [companyId]);

  // **ENHANCED**: Event handlers with debouncing and performance optimization
  const toggleIndicator = useCallback((id: string) => {
    debouncedUpdate(() => {
      setActiveIndicators(prev => 
        prev.includes(id) 
          ? prev.filter(ind => ind !== id) 
          : [...prev, id]
      );
    });
  }, [debouncedUpdate]);

  const toggleMAPeriod = useCallback((period: number) => {
    debouncedUpdate(() => {
      setSelectedMAperiods(prev => 
        prev.includes(period) 
          ? prev.filter(p => p !== period) 
          : [...prev, period].sort((a, b) => a - b)
      );
    });
  }, [debouncedUpdate]);

  const toggleEMAPeriod = useCallback((period: number) => {
    debouncedUpdate(() => {
      setSelectedEMAperiods(prev => 
        prev.includes(period) 
          ? prev.filter(p => p !== period) 
          : [...prev, period].sort((a, b) => a - b)
      );
    });
  }, [debouncedUpdate]);

    const handleThemeToggle = useCallback(() => {
    const newTheme = chartTheme === 'dark' ? 'light' : 'dark';
    setChartTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  }, [chartTheme, onThemeChange]);

  const handleIntervalChange = useCallback((newInterval: string) => {
    debouncedUpdate(() => {
      setSelectedInterval(newInterval);
      if (onIntervalChange) {
        onIntervalChange(newInterval);
      }
    });
  }, [debouncedUpdate, onIntervalChange]);

  const handleChartTypeChange = useCallback((type: string) => {
    debouncedUpdate(() => {
      setSelectedChartType(type);
    });
  }, [debouncedUpdate]);

  const handleDrawingModeChange = useCallback((mode: string | null) => {
    setDrawingMode(mode);
    if (plotRef.current) {
      const update = {
        dragmode: mode || 'pan'
      };
      plotRef.current.relayout(update);
    }
  }, []);

  // **ENHANCED**: Auto-refresh functionality from 1473-line version
  useEffect(() => {
    if (!autoRefresh || !onIntervalChange) return;

    const interval = setInterval(() => {
      onIntervalChange(selectedInterval);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedInterval, onIntervalChange]);

  // **ENHANCED**: Price alerts functionality
  const addPriceAlert = useCallback((price: number, type: 'above' | 'below') => {
    const newAlert = {
      id: Date.now(),
      price,
      type,
      triggered: false,
      createdAt: new Date()
    };
    setPriceAlerts(prev => [...prev, newAlert]);
  }, []);

  const removePriceAlert = useCallback((id: number) => {
    setPriceAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  // **ENHANCED**: Check price alerts
  useEffect(() => {
    if (!alertsEnabled || !data.length || !priceAlerts.length) return;

    const currentPrice = data[data.length - 1]?.close;
    if (!currentPrice) return;

    priceAlerts.forEach(alert => {
      if (alert.triggered) return;

      const shouldTrigger = 
        (alert.type === 'above' && currentPrice >= alert.price) ||
        (alert.type === 'below' && currentPrice <= alert.price);

      if (shouldTrigger) {
        // Update alert as triggered
        setPriceAlerts(prev => 
          prev.map(a => a.id === alert.id ? { ...a, triggered: true } : a)
        );

        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Price Alert: ${companyId}`, {
            body: `Price ${alert.type} ₹${alert.price.toFixed(2)} (Current: ₹${currentPrice.toFixed(2)})`,
            icon: '/favicon.ico'
          });
        }
      }
    });
  }, [data, priceAlerts, alertsEnabled, companyId]);

  // **ENHANCED**: Request notification permission
  useEffect(() => {
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [alertsEnabled]);

  // **ENHANCED**: Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            handleThemeToggle();
            break;
          case 'g':
            e.preventDefault();
            setShowGridlines(prev => !prev);
            break;
          case 'v':
            e.preventDefault();
            setShowVolume(prev => !prev);
            break;
          case 'c':
            e.preventDefault();
            setCrosshair(prev => !prev);
            break;
          case 'l':
            e.preventDefault();
            setLogScale(prev => !prev);
            break;
          case 's':
            e.preventDefault();
            setSidebarVisible(prev => !prev);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleThemeToggle]);

  // **ENHANCED**: Plot event handlers
  const handlePlotUpdate = useCallback((figure: any) => {
    if (figure.layout?.shapes) {
      setAnnotations(figure.layout.shapes);
    }
  }, []);

  const handlePlotClick = useCallback((data: any) => {
    if (drawingMode) {
      // Handle drawing mode clicks
      console.log('Drawing mode click:', data);
    }
  }, [drawingMode]);

  const handlePlotHover = useCallback((data: any) => {
    // Enhanced hover functionality
    if (data.points && data.points.length > 0) {
      const point = data.points[0];
      // Custom hover logic can be added here
    }
  }, []);

  // **ENHANCED**: Reset chart function
  const resetChart = useCallback(() => {
    if (plotRef.current) {
      plotRef.current.relayout({
        'xaxis.autorange': true,
        'yaxis.autorange': true,
        dragmode: 'pan'
      });
    }
    setAnnotations([]);
    setDrawingMode(null);
  }, []);

  // **ENHANCED**: Export chart data
  const exportChartData = useCallback(() => {
    if (!filteredData.length) return;

    const csvContent = [
      'Date,Open,High,Low,Close,Volume',
      ...filteredData.map(item => 
        `${item.interval_start},${item.open},${item.high},${item.low},${item.close},${item.volume}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyId || 'chart'}_${selectedInterval}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredData, companyId, selectedInterval]);

  // **ENHANCED**: Color theme styles
  const colors = getColorTheme();
  const buttonStyle = {
    backgroundColor: colors.button.bg,
    color: colors.button.text,
    border: `1px solid ${colors.grid}`,
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  };

  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: colors.button.bgActive,
    color: '#ffffff',
    borderColor: colors.button.bgActive
  };

  // **ENHANCED**: Loading and error states
  if (loading) {
    return (
      <div 
        className="flex items-center justify-center" 
        style={{ 
          height: `${height}px`, 
          backgroundColor: colors.bg,
          color: colors.text,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading chart data...</p>
          <p className="text-sm opacity-70 mt-2">Filtering market hours and optimizing performance</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="flex items-center justify-center" 
        style={{ 
          height: `${height}px`, 
          backgroundColor: colors.bg,
          color: colors.text,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠</div>
          <p className="text-lg font-medium text-red-400">Error loading chart</p>
          <p className="text-sm opacity-70 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center" 
        style={{ 
          height: `${height}px`, 
          backgroundColor: colors.bg,
          color: colors.text,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm opacity-70 mt-2">Select a company and date range to view the chart</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full" 
      style={{ 
        height: `${height}px`, 
        backgroundColor: colors.bg,
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* **ENHANCED**: Control Panel with all functionalities */}
      {sidebarVisible && (
        <div 
          className="absolute top-0 left-0 z-10 p-4 rounded-lg shadow-lg border max-h-full overflow-y-auto"
          style={{ 
            backgroundColor: colors.paper,
            borderColor: colors.grid,
            width: '280px',
            maxHeight: `${height - 20}px`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Chart Controls
            </h3>
            <button
              onClick={() => setSidebarVisible(false)}
              style={buttonStyle}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              <EyeOff size={16} />
            </button>
          </div>

          {/* Theme Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Theme
            </label>
            <button
              onClick={handleThemeToggle}
              style={buttonStyle}
              className="w-full justify-center"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              {chartTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {chartTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>

          {/* Time Intervals */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Time Interval
            </label>
            <div className="grid grid-cols-4 gap-1">
              {timeIntervals.map(interval => (
                <button
                  key={interval.id}
                  onClick={() => handleIntervalChange(interval.id)}
                  style={selectedInterval === interval.id ? activeButtonStyle : buttonStyle}
                  className="text-center"
                  onMouseEnter={(e) => {
                    if (selectedInterval !== interval.id) {
                      e.currentTarget.style.backgroundColor = colors.button.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedInterval !== interval.id) {
                      e.currentTarget.style.backgroundColor = colors.button.bg;
                    }
                  }}
                >
                  {interval.name}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Types */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Chart Type
            </label>
            <div className="grid grid-cols-2 gap-1">
              {chartTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleChartTypeChange(type.id)}
                    style={selectedChartType === type.id ? activeButtonStyle : buttonStyle}
                    onMouseEnter={(e) => {
                      if (selectedChartType !== type.id) {
                        e.currentTarget.style.backgroundColor = colors.button.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedChartType !== type.id) {
                        e.currentTarget.style.backgroundColor = colors.button.bg;
                      }
                    }}
                  >
                    <Icon size={14} />
                    {type.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Drawing Tools */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Drawing Tools
            </label>
            <div className="grid grid-cols-2 gap-1">
              {drawingTools.map(tool => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleDrawingModeChange(drawingMode === tool.id ? null : tool.id)}
                    style={drawingMode === tool.id ? activeButtonStyle : buttonStyle}
                    onMouseEnter={(e) => {
                      if (drawingMode !== tool.id) {
                        e.currentTarget.style.backgroundColor = colors.button.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (drawingMode !== tool.id) {
                        e.currentTarget.style.backgroundColor = colors.button.bg;
                      }
                    }}
                  >
                    <Icon size={14} />
                    {tool.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technical Indicators */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Technical Indicators
            </label>
            <div className="space-y-2">
              {availableIndicators.map(indicator => (
                <div key={indicator.id}>
                  <button
                    onClick={() => toggleIndicator(indicator.id)}
                    style={activeIndicators.includes(indicator.id) ? activeButtonStyle : buttonStyle}
                    className="w-full justify-start"
                    onMouseEnter={(e) => {
                      if (!activeIndicators.includes(indicator.id)) {
                        e.currentTarget.style.backgroundColor = colors.button.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!activeIndicators.includes(indicator.id)) {
                        e.currentTarget.style.backgroundColor = colors.button.bg;
                      }
                    }}
                  >
                    {indicator.name}
                  </button>
                  
                  {/* MA Period Selection */}
                  {indicator.id === 'ma' && activeIndicators.includes('ma') && (
                    <div className="mt-2 ml-4">
                      <div className="text-xs mb-1" style={{ color: colors.text }}>Periods:</div>
                      <div className="flex flex-wrap gap-1">
                        {indicator.periods?.map(period => (
                          <button
                            key={period}
                            onClick={() => toggleMAPeriod(period)}
                            style={selectedMAperiods.includes(period) ? 
                              { ...activeButtonStyle, fontSize: '10px', padding: '2px 6px' } : 
                              { ...buttonStyle, fontSize: '10px', padding: '2px 6px' }
                            }
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* EMA Period Selection */}
                  {indicator.id === 'ema' && activeIndicators.includes('ema') && (
                    <div className="mt-2 ml-4">
                      <div className="text-xs mb-1" style={{ color: colors.text }}>Periods:</div>
                      <div className="flex flex-wrap gap-1">
                        {indicator.periods?.map(period => (
                          <button
                            key={period}
                            onClick={() => toggleEMAPeriod(period)}
                            style={selectedEMAperiods.includes(period) ? 
                              { ...activeButtonStyle, fontSize: '10px', padding: '2px 6px' } : 
                              { ...buttonStyle, fontSize: '10px', padding: '2px 6px' }
                            }
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chart Options */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Chart Options
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setShowVolume(prev => !prev)}
                style={showVolume ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!showVolume) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showVolume) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                <BarChart3 size={14} />
                Show Volume
              </button>
              
              <button
                onClick={() => setShowGridlines(prev => !prev)}
                style={showGridlines ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!showGridlines) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showGridlines) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                <Grid3X3 size={14} />
                Show Gridlines
              </button>
              
              <button
                onClick={() => setCrosshair(prev => !prev)}
                style={crosshair ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!crosshair) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!crosshair) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                <MousePointer size={14} />
                Crosshair
              </button>
              
              <button
                onClick={() => setLogScale(prev => !prev)}
                style={logScale ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!logScale) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!logScale) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                Log Scale
              </button>
            </div>
          </div>

          {/* Auto Refresh */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Auto Refresh
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setAutoRefresh(prev => !prev)}
                style={autoRefresh ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!autoRefresh) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!autoRefresh) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                <Clock size={14} />
                Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
              
              {autoRefresh && (
                <div className="ml-4">
                  <div className="text-xs mb-1" style={{ color: colors.text }}>Interval (ms):</div>
                  <input
                    type="number"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    min="1000"
                    max="60000"
                    step="1000"
                    style={{
                      ...buttonStyle,
                      width: '100%',
                      textAlign: 'center'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Price Alerts */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Price Alerts
            </label>
            <div className="space-y-2">
              <button
                onClick={() => setAlertsEnabled(prev => !prev)}
                style={alertsEnabled ? activeButtonStyle : buttonStyle}
                className="w-full justify-start"
                onMouseEnter={(e) => {
                  if (!alertsEnabled) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!alertsEnabled) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                Alerts {alertsEnabled ? 'ON' : 'OFF'}
              </button>
              
              {alertsEnabled && (
                <div className="ml-4 space-y-1">
                  {priceAlerts.map(alert => (
                    <div 
                      key={alert.id} 
                      className="flex items-center justify-between text-xs p-2 rounded"
                      style={{ backgroundColor: colors.grid }}
                    >
                      <span style={{ color: colors.text }}>
                        {alert.type} ₹{alert.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removePriceAlert(alert.id)}
                        style={{ 
                          ...buttonStyle, 
                          padding: '2px 4px',
                          fontSize: '10px'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={resetChart}
              style={buttonStyle}
              className="w-full justify-center"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              <RotateCcw size={14} />
              Reset Chart
            </button>
            
            <button
              onClick={exportChartData}
              style={buttonStyle}
              className="w-full justify-center"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              Export Data
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.grid }}>
            <div className="text-xs" style={{ color: colors.text }}>
              <div className="font-medium mb-2">Keyboard Shortcuts:</div>
              <div className="space-y-1 text-xs opacity-70">
                <div>Ctrl+T: Toggle Theme</div>
                <div>Ctrl+G: Toggle Grid</div>
                <div>Ctrl+V: Toggle Volume</div>
                <div>Ctrl+C: Toggle Crosshair</div>
                <div>Ctrl+L: Toggle Log Scale</div>
                <div>Ctrl+S: Toggle Sidebar</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* **ENHANCED**: Show/Hide Sidebar Button */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="absolute top-4 left-4 z-10 rounded-lg shadow-lg"
          style={{
            ...buttonStyle,
            backgroundColor: colors.paper,
            borderColor: colors.grid
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.paper}
        >
          <Settings size={16} />
          <Eye size={16} />
        </button>
      )}

      {/* **ENHANCED**: Performance Info */}
      <div 
        className="absolute top-4 right-4 z-10 px-3 py-2 rounded-lg text-xs font-mono"
        style={{
          backgroundColor: colors.paper,
          borderColor: colors.grid,
          border: `1px solid ${colors.grid}`,
          color: colors.text,
          opacity: 0.8
        }}
      >
        <div>Points: {filteredData.length}</div>
        <div>Optimized: {data.length > CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS ? 'Yes' : 'No'}</div>
        <div>WebGL: {filteredData.length > CHART_PERFORMANCE_CONFIG.WEBGL_THRESHOLD ? 'Yes' : 'No'}</div>
      </div>

      {/* **ENHANCED**: Main Chart with all optimizations */}
      <div style={{ width: '100%', height: '100%' }}>
        <Plot
          ref={plotRef}
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          onUpdate={handlePlotUpdate}
          onClick={handlePlotClick}
          onHover={handlePlotHover}
          useResizeHandler={true}
          className="plotly-chart"
        />
      </div>
    </div>
  );
}

export default StockChart;
