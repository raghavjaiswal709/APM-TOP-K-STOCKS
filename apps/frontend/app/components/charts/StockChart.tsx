
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
  Clock,
  Maximize2,
  Minimize2,
  Monitor,
  Smartphone
} from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

const CHART_PERFORMANCE_CONFIG = {
  MAX_VISIBLE_POINTS: 2000,
  CHUNK_SIZE: 1000,
  WEBGL_THRESHOLD: 5000,
  MARKET_OPEN_MINUTES: 9 * 60 + 15,
  MARKET_CLOSE_MINUTES: 15 * 60 + 30,
  IST_OFFSET: 5.5 * 60 * 60 * 1000,
  ZOOM_WINDOW_MINUTES: 15,
  PRICE_PADDING_PERCENT: 0.08,
  SIDEBAR_WIDTH: 280,
  MIN_CHART_WIDTH: 400,
  MIN_CHART_HEIGHT: 300,
  RESIZE_DEBOUNCE_MS: 150,
  AUTO_RESIZE_ENABLED: true,
  RESPONSIVE_BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1440
  },
  ASPECT_RATIOS: {
    WIDESCREEN: 16/9,
    STANDARD: 4/3,
    SQUARE: 1/1
  }
};

const availableIndicators = [
  { id: 'ma', name: 'Moving Average', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'ema', name: 'Exponential MA', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'bollinger', name: 'Bollinger Bands', period: 20, stdDev: 2, color: '#ffffff' },
  { id: 'rsi', name: 'RSI', period: 14, color: '#ffffff' },
  { id: 'macd', name: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#ffffff' },
  // { id: 'atr', name: 'ATR', period: 14, color: '#ffffff' },
  // { id: 'obv', name: 'On-Balance Volume', color: '#ffffff' },
  // { id: 'stoch', name: 'Stochastic', kPeriod: 14, dPeriod: 3, color: '#ffffff' },
  // { id: 'vwap', name: 'VWAP', color: '#ffffff' },
  // { id: 'fibonacci', name: 'Fibonacci Retracement', color: '#ffffff' }
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
  height = 1000,
  width = 1200,
  defaultChartType = 'candlestick',
  showControls = true,
  theme = 'dark',
  onThemeChange,
  onIntervalChange
}: StockChartProps) {
  
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
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoResize, setAutoResize] = useState(CHART_PERFORMANCE_CONFIG.AUTO_RESIZE_ENABLED);
  const [responsiveMode, setResponsiveMode] = useState<'auto' | 'manual'>('auto');
  const [aspectRatio, setAspectRatio] = useState<keyof typeof CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS>('WIDESCREEN');
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  const [drawingMode, setDrawingMode] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  
  const plotRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const plotRevisionRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [xRange, setXRange] = useState(null);
const [yRange, setYRange] = useState(null);


const handleRelayout = useCallback((eventData) => {
  
  if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
    const newXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
    setXRange(newXRange);
  }
  
  if (eventData['yaxis.range[0]'] && eventData['yaxis.range[1]']) {
    const newYRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
    setYRange(newYRange);
  }
  
  if (eventData['xaxis.autorange']) {
    setXRange(null);
  }
  if (eventData['yaxis.autorange']) {
    setYRange(null);
  }
  
  if (eventData && autoResize) {
    plotRevisionRef.current += 1;
  }
}, [autoResize]);


  const detectDeviceType = useCallback((width: number) => {
    if (width < CHART_PERFORMANCE_CONFIG.RESPONSIVE_BREAKPOINTS.MOBILE) {
      return 'mobile';
    } else if (width < CHART_PERFORMANCE_CONFIG.RESPONSIVE_BREAKPOINTS.TABLET) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }, []);

  useEffect(() => {
    const updateViewportSize = () => {
      const newSize = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      setViewportSize(newSize);
      setDeviceType(detectDeviceType(newSize.width));
    };

    

    updateViewportSize();
    
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(updateViewportSize, CHART_PERFORMANCE_CONFIG.RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [detectDeviceType]);

  useEffect(() => {
    if (!containerRef.current || !autoResize) return;

    const updateContainerDimensions = (entries: ResizeObserverEntry[]) => {
      if (!entries.length) return;
      
      const entry = entries[0];
      const { width: containerWidth, height: containerHeight } = entry.contentRect;
      
      if (containerWidth === 0 || containerHeight === 0) return;

      const sidebarWidth = sidebarVisible ? CHART_PERFORMANCE_CONFIG.SIDEBAR_WIDTH : 0;
      const availableWidth = containerWidth - sidebarWidth;
      const availableHeight = isFullscreen ? window.innerHeight : containerHeight;

      const newContainerDims = {
        width: containerWidth,
        height: containerHeight
      };

      const newChartDims = {
        width: Math.max(availableWidth, CHART_PERFORMANCE_CONFIG.MIN_CHART_WIDTH),
        height: Math.max(availableHeight, CHART_PERFORMANCE_CONFIG.MIN_CHART_HEIGHT)
      };

      if (responsiveMode === 'manual') {
        const targetRatio = CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS[aspectRatio];
        const currentRatio = newChartDims.width / newChartDims.height;
        
        if (currentRatio > targetRatio) {
          newChartDims.width = newChartDims.height * targetRatio;
        } else {
          newChartDims.height = newChartDims.width / targetRatio;
        }
      }

      setContainerDimensions(newContainerDims);
      setChartDimensions(newChartDims);

      if (plotRef.current && plotRef.current.resizeHandler) {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(() => {
          try {
            plotRef.current.resizeHandler();
            plotRevisionRef.current += 1;
          } catch (error) {
            console.warn('Plotly resize failed:', error);
          }
        }, CHART_PERFORMANCE_CONFIG.RESIZE_DEBOUNCE_MS);
      }
    };

    if (window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(updateContainerDimensions);
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      if (resizeObserverRef.current && containerRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current);
        resizeObserverRef.current.disconnect();
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [autoResize, isFullscreen, sidebarVisible, responsiveMode, aspectRatio]);

  const filteredData = useMemo(() => {
    if (!data || !data.length) return [];
    
    return data.filter(item => {
      const date = new Date(item.interval_start);
      const day = date.getDay();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      if (day === 0 || day === 6) return false;
      
      return timeInMinutes >= CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES && 
             timeInMinutes <= CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES;
    });
  }, [data]);

  const optimizedData = useMemo(() => {
    if (!filteredData.length) return filteredData;
    
    if (filteredData.length <= CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS) {
      return filteredData;
    }
    
    const ratio = Math.ceil(filteredData.length / CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS);
    const result: StockDataPoint[] = [];
    
    for (let i = 0; i < filteredData.length; i += ratio) {
      const chunk = filteredData.slice(i, i + ratio);
      if (chunk.length === 1) {
        result.push(chunk[0]);
      } else {
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map(d => d.high));
        const low = Math.min(...chunk.map(d => d.low));
        const volume = chunk.reduce((sum, d) => sum + d.volume, 0);
        
        result.push({
          interval_start: chunk[0].interval_start,
          open, high, low, close, volume
        });
      }
    }
    
    return result;
  }, [filteredData]);

useEffect(() => {
  if (optimizedData && optimizedData.length > 0) {
    setXRange(null);
    setYRange(null);
    
    // Force re-render with auto-range by incrementing revision
    plotRevisionRef.current += 1;
  }
}, [companyId]);
 


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
        
        for (let i = 1; i < prices.length; i++) {
          const change = prices[i] - prices[i-1];
          gains[i-1] = change > 0 ? change : 0;
          losses[i-1] = change < 0 ? -change : 0;
        }
        
        const result = new Array(prices.length).fill(null);
        
        if (gains.length >= period) {
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
      
      default:
        return [];
    }
  }, []);

  const convertToHeikenAshi = useCallback((data: StockDataPoint[]) => {
    if (!data || data.length === 0) return [];
    
    const haData: any[] = [];
    let prevHA: any = null;
    
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      const date = new Date(current.interval_start);
      const day = date.getDay();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;

      if (day === 0 || day === 6) continue;
      
      if (timeInMinutes < CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES || 
          timeInMinutes > CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES) continue;

      const currentHigh = current.high;
      const currentLow = current.low;
      const currentOpen = current.open;
      const currentClose = current.close;

      let haOpen: number;
      let haClose: number;
      let haHigh: number;
      let haLow: number;

      haClose = (currentOpen + currentHigh + currentLow + currentClose) / 4;

      if (prevHA === null) {
        haOpen = (currentOpen + currentClose) / 2;
      } else {
        haOpen = (prevHA.ha_open + prevHA.ha_close) / 2;
      }

      haHigh = Math.max(currentHigh, haOpen, haClose);
      haLow = Math.min(currentLow, haOpen, haClose);

      const haCandle = {
        interval_start: current.interval_start,
        ha_open: haOpen,
        ha_high: haHigh,
        ha_low: haLow,
        ha_close: haClose,
        volume: current.volume,
        original_open: currentOpen,
        original_high: currentHigh,
        original_low: currentLow,
        original_close: currentClose,
        color: haClose >= haOpen ? 'green' : 'red',
        bodySize: Math.abs(haClose - haOpen),
        upperWick: haHigh - Math.max(haOpen, haClose),
        lowerWick: Math.min(haOpen, haClose) - haLow
      };

      haData.push(haCandle);
      prevHA = haCandle;
    }
    
    return haData;
  }, []);

  const colors = useMemo(() => {
    const baseColor = '#27272a';
    const lighterShades = {
      100: '#3f3f46',
      200: '#52525b',
      300: '#71717a',
      400: '#a1a1aa',
      500: '#d4d4d8'
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

  const plotData = useMemo(() => {
    if (!optimizedData.length) return [];

    const timeLabels = optimizedData.map(item => new Date(item.interval_start));
    const plotElements = [];
    
    const chartData = selectedChartType === 'heiken-ashi' ? convertToHeikenAshi(optimizedData) : optimizedData;

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
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          line: { 
            color: colors.line, 
            width: 2.5,
            shape: 'linear'
          },
          connectgaps: true
        };
        break;
        
      case 'area':
        priceChart = {
          x: timeLabels,
          y: optimizedData.map(item => item.close),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          fill: 'tozeroy',
          fillcolor: 'rgba(96, 165, 250, 0.2)',
          line: { 
            color: colors.line, 
            width: 2.5,
            shape: 'linear'
          },
          connectgaps: true
        };
        break;
    }
    
    plotElements.push(priceChart);

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
            width: 2,
            shape: 'linear'
          },
          connectgaps: false
        });
      });
    }

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
            dash: 'dash',
            shape: 'linear'
          },
          connectgaps: false
        });
      });
    }

    if (activeIndicators.includes('bollinger')) {
      const bands = calculateIndicator('bollinger', prices, { period: 20, stdDev: 2 }) as any;
      
      plotElements.push({
        x: timeLabels,
        y: bands.upper,
        type: 'scatter',
        mode: 'lines',
        name: 'BB Upper',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5, 
          dash: 'dot',
          shape: 'linear'
        },
        showlegend: false,
        connectgaps: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.lower,
        type: 'scatter',
        mode: 'lines',
        name: 'BB Lower',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5, 
          dash: 'dot',
          shape: 'linear'
        },
        fill: 'tonexty',
        fillcolor: 'rgba(6, 182, 212, 0.1)',
        showlegend: false,
        connectgaps: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: bands.middle,
        type: 'scatter',
        mode: 'lines',
        name: 'BB(20,2)',
        line: { 
          color: colors.indicators.bollinger, 
          width: 1.5,
          shape: 'linear'
        },
        connectgaps: false
      });
    }

    if (activeIndicators.includes('rsi')) {
      const rsi = calculateIndicator('rsi', prices) as number[];
      plotElements.push({
        x: timeLabels,
        y: rsi,
        type: 'scatter',
        mode: 'lines',
        name: 'RSI(14)',
        yaxis: 'y3',
        line: { 
          color: colors.indicators.rsi, 
          width: 2,
          shape: 'linear'
        },
        connectgaps: false
      });
    }

    if (activeIndicators.includes('macd')) {
      const macd = calculateIndicator('macd', prices) as any;
      
      plotElements.push({
        x: timeLabels,
        y: macd.macdLine,
        type: 'scatter',
        mode: 'lines',
        name: 'MACD',
        yaxis: 'y4',
        line: { 
          color: colors.indicators.macd, 
          width: 2,
          shape: 'linear'
        },
        connectgaps: false
      });
      
      plotElements.push({
        x: timeLabels,
        y: macd.signalLine,
        type: 'scatter',
        mode: 'lines',
        name: 'Signal',
        yaxis: 'y4',
        line: { 
          color: '#fbbf24', 
          width: 2,
          shape: 'linear'
        },
        connectgaps: false
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

    return plotElements;
  }, [
    optimizedData, 
    selectedChartType, 
    activeIndicators, 
    showVolume, 
    selectedMAperiods, 
    selectedEMAperiods, 
    colors,
    calculateIndicator,
    convertToHeikenAshi
  ]);

  const layout = useMemo(() => {
    const hasRSI = activeIndicators.includes('rsi');
    const hasMACD = activeIndicators.includes('macd');
    const indicatorCount = (hasRSI ? 1 : 0) + (hasMACD ? 1 : 0);
    
    let priceChartDomain = [0.3, 1];
    let volumeDomain = [0.15, 0.28];
    
    if (indicatorCount > 0) {
      const indicatorHeight = 0.12;
      const totalIndicatorHeight = indicatorCount * indicatorHeight;
      priceChartDomain = [0.3 + totalIndicatorHeight, 1];
      volumeDomain = [0.15 + totalIndicatorHeight, 0.28 + totalIndicatorHeight];
    }

    const getResponsiveMargin = () => {
      switch (deviceType) {
        case 'mobile':
          return { r: 40, l: 40, b: 40, t: 60, pad: 2 };
        case 'tablet':
          return { r: 50, l: 50, b: 45, t: 70, pad: 3 };
        default:
          return { r: 60, l: 60, b: 50, t: 80, pad: 4 };
      }
    };

    const getResponsiveFontSizes = () => {
      switch (deviceType) {
        case 'mobile':
          return { title: 14, axis: 9, tick: 8, legend: 9 };
        case 'tablet':
          return { title: 15, axis: 10, tick: 9, legend: 10 };
        default:
          return { title: 16, axis: 12, tick: 10, legend: 11 };
      }
    };

    const responsiveMargin = getResponsiveMargin();
    const responsiveFonts = getResponsiveFontSizes();

    const baseLayout: any = {
      autosize: true,
      responsive: true,
      dragmode: drawingMode || 'pan',
    selectdirection: 'diagonal',
      showlegend: true,
      legend: {
        x: 0,
        y: 1.02,
        orientation: deviceType === 'mobile' ? 'v' : 'h',
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text, size: responsiveFonts.legend },
        xanchor: deviceType === 'mobile' ? 'left' : 'auto',
        yanchor: deviceType === 'mobile' ? 'bottom' : 'auto',
         uirevision: 'static'
      },
      margin: responsiveMargin,
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      
       xaxis: {
      rangeslider: { visible: false },
      type: 'date',
      showgrid: showGridlines,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text, size: responsiveFonts.tick },
      title: { text: '', font: { color: colors.text } },
      
      autorange: xRange ? false : true,
      range: xRange || undefined,
      fixedrange: false, 
      constrain: 'domain', 
      constraintoward: 'center',
      
     
      automargin: false, 
      tickmode: 'auto',
      
      rangebreaks: [
        { bounds: ['sat', 'mon'], pattern: 'day of week' },
        { bounds: [15.5, 9.25], pattern: 'hour' }
      ],
      nticks: deviceType === 'mobile' ? 5 : deviceType === 'tablet' ? 8 : 12
    },

      yaxis: {
      title: { text: 'Price (₹)', font: { color: colors.text, size: responsiveFonts.axis } },
      domain: [0.50, 1.0], // Fixed domain instead of priceChartDomain
      tickformat: ',.2f',
      showgrid: showGridlines,
      gridcolor: colors.grid,
      zerolinecolor: colors.grid,
      linecolor: colors.grid,
      type: logScale ? 'log' : 'linear',
      tickfont: { color: colors.text, size: responsiveFonts.tick },
      side: 'left',
      
      autorange: yRange ? false : true,
      range: yRange || undefined,
      fixedrange: false, 
      constrain: 'domain',
      constraintoward: 'center',
      
      automargin: false, 
      scaleanchor: null, 
      scaleratio: null,
      
      nticks: deviceType === 'mobile' ? 6 : deviceType === 'tablet' ? 8 : 10
    },
    
    margin: {
      l: deviceType === 'mobile' ? 40 : 60,
      r: deviceType === 'mobile' ? 40 : 60,
      t: deviceType === 'mobile' ? 30 : 40,
      b: deviceType === 'mobile' ? 40 : 60,
      pad: 5,
      autoexpand: false 
    },

    yaxis2: {
  title: { 
    text: 'Volume', 
    font: { 
      color: colors.text, 
      size: responsiveFonts.axis,
      weight: 'bold'
    },
    standoff: 20
  },
  domain: [0.05, 0.35], 

  autorange: true,        
  fixedrange: false, 
  range: undefined,      

  showgrid: true,
  gridcolor: colors.grid,
  gridwidth: 1,
  zerolinecolor: colors.grid,
  zerolinewidth: 2,
  linecolor: colors.grid,
  linewidth: 2,
  constrain: 'domain',
  constraintoward: 'bottom',
  automargin: true,
  scaleanchor: null,
  scaleratio: null,
  tickfont: { color: colors.text, size: responsiveFonts.tick },
  tickcolor: colors.grid,
  tickwidth: 1,
  ticklen: 5,
  side: 'left',
  nticks: deviceType === 'mobile' ? 5 : 8,
  tickformat: '.2s',
  exponentformat: 'SI',
  separatethousands: true,
  showline: true,
  mirror: true,
  ticks: 'outside',
  rangemode: 'tozero',
  hoverformat: '.3s',
  showspikes: false,
  overlaying: false,
  anchor: 'free',
  position: 1.0
},

      
      hovermode: crosshair ? 'x unified' : 'closest',
      hoverdistance: deviceType === 'mobile' ? 50 : 100,
      spikedistance: deviceType === 'mobile' ? 500 : 1000,
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: responsiveFonts.legend }
      },
      shapes: annotations,
      
      title: {
        text: companyId ? 
          `${companyId} - ${selectedInterval.toUpperCase()} Chart [${optimizedData.length} points]` : 
          'Select a Company',
        font: { color: colors.text, size: responsiveFonts.title, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      },

      uirevision: `responsive_${plotRevisionRef.current}`
    };

    if (hasRSI) {
      baseLayout.yaxis3 = {
        title: { text: 'RSI', font: { color: colors.indicators.rsi, size: responsiveFonts.axis - 2 } },
        domain: [0, 0.12],
        range: [0, 100],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick - 1 },
        tickvals: [20, 50, 80],
        side: 'right',
        nticks: 3
      };
    }
    
    if (hasMACD) {
      const macdBottom = hasRSI ? 0.13 : 0;
      baseLayout.yaxis4 = {
        title: { text: 'MACD', font: { color: colors.indicators.macd, size: responsiveFonts.axis - 2 } },
        domain: [macdBottom, macdBottom + 0.12],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick - 1 },
        side: 'right',
        nticks: deviceType === 'mobile' ? 3 : 5
      };
    }
    
    return baseLayout;
  }, [
    activeIndicators, 
    showGridlines, 
    logScale, 
    drawingMode, 
    colors, 
    crosshair, 
    annotations, 
    selectedInterval,
    companyId,
    optimizedData.length,
    deviceType,
    plotRevisionRef.current,
    xRange, yRange
  ]);

  const config = useMemo(() => ({
    responsive: true,
    useResizeHandler: true,
    autosize: true,
    scrollZoom: true,
    displayModeBar: deviceType !== 'mobile',
    modeBarButtonsToAdd: deviceType !== 'mobile' ? [
      'drawline',
      'drawopenpath',
      'drawclosedpath',
      'drawcircle',
      'drawrect',
      'eraseshape'
    ] : [],
    modeBarButtonsToRemove: deviceType === 'mobile' ? 
      ['select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'] : 
      ['select2d', 'lasso2d'],
    displaylogo: false,
    doubleClick: 'reset+autosize',
    showTips: false,
    plotGlPixelRatio: window.devicePixelRatio || 1,
    toImageButtonOptions: {
      format: 'png',
      filename: `${companyId || 'chart'}_${new Date().toISOString().split('T')[0]}`,
      height: chartDimensions.height,
      width: chartDimensions.width,
      scale: deviceType === 'mobile' ? 1 : 2
    }
  }), [companyId, chartDimensions, deviceType]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  const toggleAutoResize = useCallback(() => {
    setAutoResize(prev => !prev);
  }, []);

  const toggleResponsiveMode = useCallback(() => {
    setResponsiveMode(prev => prev === 'auto' ? 'manual' : 'auto');
  }, []);

  const handleAspectRatioChange = useCallback((ratio: keyof typeof CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS) => {
    setAspectRatio(ratio);
  }, []);

  const toggleIndicator = useCallback((id: string) => {
    setActiveIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(ind => ind !== id) 
        : [...prev, id]
    );
  }, []);

  const toggleMAPeriod = useCallback((period: number) => {
    setSelectedMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period].sort((a, b) => a - b)
    );
  }, []);

  const toggleEMAPeriod = useCallback((period: number) => {
    setSelectedEMAperiods(prev => 
      prev.includes(period) 
        ? prev.filter(p => p !== period) 
        : [...prev, period].sort((a, b) => a - b)
    );
  }, []);

  const handleThemeToggle = useCallback(() => {
    const newTheme = chartTheme === 'dark' ? 'light' : 'dark';
    setChartTheme(newTheme);
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  }, [chartTheme, onThemeChange]);

  const handleIntervalChange = useCallback((newInterval: string) => {
    setSelectedInterval(newInterval);
    if (onIntervalChange) {
      onIntervalChange(newInterval);
    }
  }, [onIntervalChange]);

  const handleChartTypeChange = useCallback((type: string) => {
    setSelectedChartType(type);
  }, []);

  const handleDrawingModeChange = useCallback((mode: string | null) => {
    setDrawingMode(mode);
    if (plotRef.current) {
      const update = { dragmode: mode || 'pan' };
      plotRef.current.relayout(update);
    }
  }, []);

  const handlePlotUpdate = useCallback((figure: any) => {
    if (figure.layout?.shapes) {
      setAnnotations(figure.layout.shapes);
    }
  }, []);

  const handlePlotRelayout = useCallback((eventData: any) => {
    if (eventData && autoResize) {
      plotRevisionRef.current += 1;
    }
  }, [autoResize]);

 const resetChart = useCallback(() => {
  setXRange(null);
  setYRange(null);
  
  if (plotRef.current) {
    const resetUpdate = { 
      'xaxis.autorange': true,
      'yaxis.autorange': true,
      'xaxis.range': undefined,
      'yaxis.range': undefined,
      dragmode: 'pan'
    };
    plotRef.current.relayout(resetUpdate);
  }
  
  setAnnotations([]);
  setDrawingMode(null);
  plotRevisionRef.current += 1;
}, []);

  const exportChartData = useCallback(() => {
    if (!optimizedData.length) return;

    const csvContent = [
      'Date,Open,High,Low,Close,Volume',
      ...optimizedData.map(item => 
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
  }, [optimizedData, companyId, selectedInterval]);

  useEffect(() => {
    if (!autoRefresh || !onIntervalChange) return;

    const interval = setInterval(() => {
      onIntervalChange(selectedInterval);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedInterval, onIntervalChange]);

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

  useEffect(() => {
    if (!alertsEnabled || !optimizedData.length || !priceAlerts.length) return;

    const currentPrice = optimizedData[optimizedData.length - 1]?.close;
    if (!currentPrice) return;

    priceAlerts.forEach(alert => {
      if (alert.triggered) return;

      const shouldTrigger = 
        (alert.type === 'above' && currentPrice >= alert.price) ||
        (alert.type === 'below' && currentPrice <= alert.price);

      if (shouldTrigger) {
        setPriceAlerts(prev => 
          prev.map(a => a.id === alert.id ? { ...a, triggered: true } : a)
        );

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Price Alert: ${companyId}`, {
            body: `Price ${alert.type} ₹${alert.price.toFixed(2)} (Current: ₹${currentPrice.toFixed(2)})`,
            icon: '/favicon.ico'
          });
        }
      }
    });
  }, [optimizedData, priceAlerts, alertsEnabled, companyId]);

  useEffect(() => {
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [alertsEnabled]);

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
          case 'r':
            e.preventDefault();
            resetChart();
            break;
          case 'f':
            e.preventDefault();
            toggleFullscreen();
            break;
          case 'a':
            e.preventDefault();
            toggleAutoResize();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleThemeToggle, resetChart, toggleFullscreen, toggleAutoResize]);

  useEffect(() => {
    setSelectedInterval(interval);
  }, [interval]);

  useEffect(() => {
    setChartTheme(theme);
  }, [theme]);

  const buttonStyle = {
    backgroundColor: colors.button.bg,
    color: colors.button.text,
    border: `1px solid ${colors.grid}`,
    borderRadius: '6px',
    padding: deviceType === 'mobile' ? '4px 8px' : '6px 12px',
    fontSize: deviceType === 'mobile' ? '11px' : '12px',
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

  const containerStyle = useMemo(() => ({
    width: '100%',
    height: isFullscreen ? '100vh' : `${height}px`,
    backgroundColor: colors.bg,
    fontFamily: 'Inter, system-ui, sans-serif',
    position: isFullscreen ? 'fixed' as const : 'relative' as const,
    top: isFullscreen ? 0 : 'auto',
    left: isFullscreen ? 0 : 'auto',
    zIndex: isFullscreen ? 9999 : 'auto',
    overflow: 'hidden',
    minWidth: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_WIDTH}px`,
    minHeight: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_HEIGHT}px`
  }), [colors.bg, height, isFullscreen]);

  const chartContainerStyle = useMemo(() => {
    const sidebarWidth = sidebarVisible && deviceType !== 'mobile' ? CHART_PERFORMANCE_CONFIG.SIDEBAR_WIDTH : 0;
    return {
      marginLeft: deviceType === 'mobile' ? '0px' : `${sidebarWidth}px`,
      transition: 'margin-left 0.3s ease',
      height: '100%',
      width: deviceType === 'mobile' ? '100%' : sidebarVisible ? `calc(100% - ${sidebarWidth}px)` : '100%',
      minWidth: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_WIDTH}px`,
      position: 'relative' as const
    };
  }, [sidebarVisible, deviceType]);

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
          <p className="text-sm opacity-70 mt-2">Optimizing for smooth performance</p>
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
      ref={containerRef}
      style={containerStyle}
    >
      {sidebarVisible && deviceType !== 'mobile' && (
        <div 
          className="absolute top-0 left-0 z-10 p-4 rounded-lg shadow-lg border max-h-full overflow-y-auto"
          style={{ 
            backgroundColor: colors.paper,
            borderColor: colors.grid,
            width: `${CHART_PERFORMANCE_CONFIG.SIDEBAR_WIDTH}px`,
            maxHeight: `${height - 20}px`
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
              Chart Controls
            </h3>
            <div className="flex space-x-1">
              <button
                onClick={toggleFullscreen}
                style={buttonStyle}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setSidebarVisible(false)}
                style={buttonStyle}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                <EyeOff size={16} />
              </button>
            </div>
          </div>

          <div className="mb-4">
            {/* <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Responsive Options
            </label> */}
            {/* <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoResize"
                  checked={autoResize}
                  onChange={toggleAutoResize}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="autoResize" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Auto Resize
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="responsiveAuto"
                  name="responsiveMode"
                  checked={responsiveMode === 'auto'}
                  onChange={() => toggleResponsiveMode()}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="responsiveAuto" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Auto Responsive
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="responsiveManual"
                  name="responsiveMode"
                  checked={responsiveMode === 'manual'}
                  onChange={() => toggleResponsiveMode()}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="responsiveManual" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Manual Aspect Ratio
                </label>
              </div>
              
              {responsiveMode === 'manual' && (
                <div className="ml-6 space-y-1">
                  {Object.keys(CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS).map((ratio) => (
                    <div key={ratio} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id={`aspect-${ratio}`}
                        name="aspectRatio"
                        checked={aspectRatio === ratio}
                        onChange={() => handleAspectRatioChange(ratio as keyof typeof CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS)}
                        style={{ 
                          accentColor: colors.button.bgActive,
                          backgroundColor: colors.button.bg
                        }}
                      />
                      <label htmlFor={`aspect-${ratio}`} className="text-xs cursor-pointer" style={{ color: colors.text }}>
                        {ratio} ({CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS[ratio as keyof typeof CHART_PERFORMANCE_CONFIG.ASPECT_RATIOS].toFixed(2)})
                      </label>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={toggleFullscreen}
                style={isFullscreen ? activeButtonStyle : buttonStyle}
                className="w-full justify-center"
                onMouseEnter={(e) => {
                  if (!isFullscreen) {
                    e.currentTarget.style.backgroundColor = colors.button.bgHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFullscreen) {
                    e.currentTarget.style.backgroundColor = colors.button.bg;
                  }
                }}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div> */}
            
            {/* **RESPONSIVE DIMENSIONS INFO** */}
            {/* <div className="mt-2 text-xs space-y-1" style={{ color: colors.text, opacity: 0.7 }}>
              <div className="flex justify-between">
                <span>Device:</span>
                <span className="flex items-center gap-1">
                  {deviceType === 'mobile' ? <Smartphone size={12} /> : <Monitor size={12} />}
                  {deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Viewport:</span>
                <span>{viewportSize.width}×{viewportSize.height}</span>
              </div>
              <div className="flex justify-between">
                <span>Container:</span>
                <span>{containerDimensions.width}×{containerDimensions.height}</span>
              </div>
              <div className="flex justify-between">
                <span>Chart:</span>
                <span>{chartDimensions.width}×{chartDimensions.height}</span>
              </div>
              <div className="flex justify-between">
                <span>Ratio:</span>
                <span>{chartDimensions.width > 0 ? (chartDimensions.width / chartDimensions.height).toFixed(2) : '0'}</span>
              </div>
            </div> */}
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
            <button
              onClick={resetChart}
              style={buttonStyle}
              className="w-full justify-center mt-2"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              <RotateCcw size={14} />
              Reset Chart
            </button>
          </div>

          {/* Technicaleeeeee Indicators */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Technical Indicators
            </label>
            <div className="space-y-2">
              {availableIndicators.map(indicator => (
                <div key={indicator.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={indicator.id}
                    checked={activeIndicators.includes(indicator.id)}
                    onChange={() => toggleIndicator(indicator.id)}
                    className="rounded"
                    style={{ 
                      accentColor: colors.button.bgActive,
                      backgroundColor: colors.button.bg
                    }}
                  />
                  <label 
                    htmlFor={indicator.id} 
                    className="text-sm cursor-pointer flex-1"
                    style={{ color: colors.text }}
                  >
                    {indicator.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Mving Average Periods */}
          {activeIndicators.includes('ma') && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                MA Periods
              </label>
              <div className="grid grid-cols-3 gap-1">
                {availableIndicators.find(ind => ind.id === 'ma')?.periods?.map(period => (
                  <button
                    key={period}
                    onClick={() => toggleMAPeriod(period)}
                    style={selectedMAperiods.includes(period) ? activeButtonStyle : buttonStyle}
                    onMouseEnter={(e) => {
                      if (!selectedMAperiods.includes(period)) {
                        e.currentTarget.style.backgroundColor = colors.button.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedMAperiods.includes(period)) {
                        e.currentTarget.style.backgroundColor = colors.button.bg;
                      }
                    }}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Exponentoal Moving Average Periods */}
          {activeIndicators.includes('ema') && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                EMA Periods
              </label>
              <div className="grid grid-cols-3 gap-1">
                {availableIndicators.find(ind => ind.id === 'ema')?.periods?.map(period => (
                  <button
                    key={period}
                    onClick={() => toggleEMAPeriod(period)}
                    style={selectedEMAperiods.includes(period) ? activeButtonStyle : buttonStyle}
                    onMouseEnter={(e) => {
                      if (!selectedEMAperiods.includes(period)) {
                        e.currentTarget.style.backgroundColor = colors.button.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedEMAperiods.includes(period)) {
                        e.currentTarget.style.backgroundColor = colors.button.bg;
                      }
                    }}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Display Options */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Display Options
            </label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="volume"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="volume" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Show Volume
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="gridlines"
                  checked={showGridlines}
                  onChange={(e) => setShowGridlines(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="gridlines" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Show Gridlines
                </label>
              </div>
              
              {/* <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="crosshair"
                  checked={crosshair}
                  onChange={(e) => setCrosshair(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="crosshair" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Crosshair
                </label>
              </div> */}
              
              {/* <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="logScale"
                  checked={logScale}
                  onChange={(e) => setLogScale(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="logScale" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Log Scale
                </label>
              </div> */}
            </div>
          </div>

          {/* Advanced Features */}
          {/* <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Advanced Features
            </label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="autoRefresh" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Auto Refresh
                </label>
              </div>
              
              {autoRefresh && (
                <div className="ml-6">
                  <label className="block text-xs mb-1" style={{ color: colors.text }}>
                    Refresh Interval (ms)
                  </label>
                  <input
                    type="number"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    min="1000"
                    max="60000"
                    step="1000"
                    className="w-full text-xs px-2 py-1 rounded border"
                    style={{
                      backgroundColor: colors.button.bg,
                      borderColor: colors.grid,
                      color: colors.text
                    }}
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="alerts"
                  checked={alertsEnabled}
                  onChange={(e) => setAlertsEnabled(e.target.checked)}
                  style={{ 
                    accentColor: colors.button.bgActive,
                    backgroundColor: colors.button.bg
                  }}
                />
                <label htmlFor="alerts" className="text-sm cursor-pointer" style={{ color: colors.text }}>
                  Price Alerts
                </label>
              </div>
            </div>
          </div> */}

          {/* Price Alerts */}
          {/* {alertsEnabled && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                Active Alerts ({priceAlerts.length})
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {priceAlerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className="flex items-center justify-between text-xs p-2 rounded"
                    style={{ backgroundColor: colors.button.bg }}
                  >
                    <span style={{ color: colors.text }}>
                      ₹{alert.price.toFixed(2)} {alert.type}
                    </span>
                    <button
                      onClick={() => removePriceAlert(alert.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="mt-2 space-y-1">
                <input
                  type="number"
                  placeholder="Alert price"
                  className="w-full text-xs px-2 py-1 rounded border"
                  style={{
                    backgroundColor: colors.button.bg,
                    borderColor: colors.grid,
                    color: colors.text
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const price = parseFloat(e.currentTarget.value);
                      if (price > 0) {
                        addPriceAlert(price, 'above');
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
                <div className="flex space-x-1">
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Alert price"]') as HTMLInputElement;
                      const price = parseFloat(input?.value || '0');
                      if (price > 0) {
                        addPriceAlert(price, 'above');
                        if (input) input.value = '';
                      }
                    }}
                    style={buttonStyle}
                    className="flex-1 text-xs justify-center"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
                  >
                    Above
                  </button>
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Alert price"]') as HTMLInputElement;
                      const price = parseFloat(input?.value || '0');
                      if (price > 0) {
                        addPriceAlert(price, 'below');
                        if (input) input.value = '';
                      }
                    }}
                    style={buttonStyle}
                    className="flex-1 text-xs justify-center"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
                  >
                    Below
                  </button>
                </div>
              </div>
            </div>
          )} */}

          {/* Chart Actions */}
          <div className="mb-4">
            {/* <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Chart Actions
            </label> */}
            <div className="space-y-2">
              {/* <button
                onClick={exportChartData}
                style={buttonStyle}
                className="w-full justify-center"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                Export Data (CSV)
              </button> */}
              
              {/* <button
                onClick={() => {
                  if (plotRef.current) {
                    const update = { 'xaxis.autorange': true, 'yaxis.autorange': true };
                    plotRef.current.relayout(update);
                  }
                }}
                style={buttonStyle}
                className="w-full justify-center"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                <ZoomOut size={14} />
                Auto Range
              </button> */}
              
              <button
                onClick={() => {
                  setAnnotations([]);
                  if (plotRef.current) {
                    plotRef.current.relayout({ shapes: [] });
                  }
                }}
                style={buttonStyle}
                className="w-full justify-center"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                <Eraser size={14} />
                Reset
              </button>
            </div>
          </div>

          {/* Chart Info */}
          {/* <div className="mb-4">
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Chart Information
            </label>
            <div className="text-xs space-y-1" style={{ color: colors.text }}>
              <div>Data Points: {optimizedData.length}</div>
              <div>Interval: {selectedInterval}</div>
              <div>Chart Type: {chartTypes.find(t => t.id === selectedChartType)?.name}</div>
              {optimizedData.length > 0 && (
                <>
                  <div>Latest: ₹{optimizedData[optimizedData.length - 1]?.close.toFixed(2)}</div>
                  <div>Volume: {optimizedData[optimizedData.length - 1]?.volume.toLocaleString()}</div>
                </>
              )}
            </div>
          </div> */}

          {/* <div>
            <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
              Keyboard Shortcuts
            </label>
            <div className="text-xs space-y-1" style={{ color: colors.text, opacity: 0.8 }}>
              <div>Ctrl+T: Toggle Theme</div>
              <div>Ctrl+G: Toggle Grid</div>
              <div>Ctrl+V: Toggle Volume</div>
              <div>Ctrl+C: Toggle Crosshair</div>
              <div>Ctrl+L: Toggle Log Scale</div>
              <div>Ctrl+S: Toggle Sidebar</div>
              <div>Ctrl+R: Reset Chart</div>
              <div>Ctrl+F: Toggle Fullscreen</div>
              <div>Ctrl+A: Toggle Auto Resize</div>
            </div>
          </div> */}
        </div>
      )}

      {deviceType === 'mobile' && sidebarVisible && (
        <div 
          className="absolute bottom-0 left-0 right-0 z-10 p-3 border-t"
          style={{ 
            backgroundColor: colors.paper,
            borderColor: colors.grid,
            maxHeight: '40%',
            overflowY: 'auto'
          }}
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold" style={{ color: colors.text }}>
              Controls
            </h4>
            <button
              onClick={() => setSidebarVisible(false)}
              style={buttonStyle}
            >
              <EyeOff size={14} />
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-3">
            {timeIntervals.slice(0, 4).map(interval => (
              <button
                key={interval.id}
                onClick={() => handleIntervalChange(interval.id)}
                style={selectedInterval === interval.id ? activeButtonStyle : buttonStyle}
                className="text-center"
              >
                {interval.name}
              </button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleThemeToggle}
              style={buttonStyle}
              className="justify-center"
            >
              {chartTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              Theme
            </button>
            <button
              onClick={toggleFullscreen}
              style={isFullscreen ? activeButtonStyle : buttonStyle}
              className="justify-center"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              Full
            </button>
          </div>
        </div>
      )}

      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="absolute top-4 left-4 z-10 p-2 rounded-lg shadow-lg border"
          style={{
            backgroundColor: colors.paper,
            borderColor: colors.grid,
            color: colors.text
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.paper}
        >
          <Settings size={deviceType === 'mobile' ? 16 : 20} />
        </button>
      )}

      <div className="absolute top-4 right-4 z-10 flex flex-wrap gap-2">
        {/* {autoResize && (
          <div 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: colors.upColor,
              color: '#ffffff'
            }}
          >
            📐 Responsive
          </div>
        )} */}
        
        {/* Fullscreen Status */}
        {/* {isFullscreen && (
          <div 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: colors.indicators.macd,
              color: '#ffffff'
            }}
          >
            ⛶ Fullscreen
          </div>
        )} */}
        
        {/* Device Type Indicator */}
        {/* <div 
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: colors.indicators.bollinger,
            color: '#ffffff'
          }}
        >
          {deviceType === 'mobile' ? <Smartphone size={10} /> : <Monitor size={10} />}
          {deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}
        </div> */}
        
        {autoRefresh && (
          <div 
            className="px-2 py-1 rounded text-xs font-medium animate-pulse"
            style={{
              backgroundColor: colors.upColor,
              color: '#ffffff'
            }}
          >
            <Clock size={12} className="inline mr-1" />
            Auto-Refresh
          </div>
        )}
        
        {alertsEnabled && priceAlerts.length > 0 && (
          <div 
            className="px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: colors.indicators.rsi,
              color: '#ffffff'
            }}
          >
            🔔 {priceAlerts.length}
          </div>
        )}
      </div>

      <div 
        ref={chartContainerRef}
        style={chartContainerStyle}
      >
        <Plot
  ref={plotRef}
  data={plotData}
  layout={layout}
  config={config}
  style={{ 
    width: '100%', 
    height: '100%',
    minWidth: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_WIDTH}px`,
    minHeight: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_HEIGHT}px`
  }}
  onUpdate={handlePlotUpdate}
  onRelayout={handleRelayout} 
  onRestyle={(data) => {
    console.log('Restyle prevented:', data);
  }}
  useResizeHandler={true}
  divId="stock-chart-plot"
  revision={plotRevisionRef.current} 
/>

      </div>
    </div>
  );
}

export const chartUtils = {
  filterMarketHours: (data: StockDataPoint[]) => {
    return data.filter(item => {
      const date = new Date(item.interval_start);
      const day = date.getDay();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      if (day < 1 || day > 5) return false;
      
      return timeInMinutes >= CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES && 
             timeInMinutes <= CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES;
    });
  },
  
  optimizeDataPoints: (data: StockDataPoint[], maxPoints: number = CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS) => {
    if (!data.length || data.length <= maxPoints) return data;
    
    const ratio = Math.ceil(data.length / maxPoints);
    const result: StockDataPoint[] = [];
    
    for (let i = 0; i < data.length; i += ratio) {
      const chunk = data.slice(i, i + ratio);
      if (chunk.length === 1) {
        result.push(chunk[0]);
      } else {
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        const high = Math.max(...chunk.map(d => d.high));
        const low = Math.min(...chunk.map(d => d.low));
        const volume = chunk.reduce((sum, d) => sum + d.volume, 0);
        
        result.push({
          interval_start: chunk[0].interval_start,
          open, high, low, close, volume
        });
      }
    }
    
    return result;
  },
  
  calculateTechnicalIndicators: (data: StockDataPoint[], indicators: string[]) => {
    const prices = data.map(item => item.close);
    const results: { [key: string]: any } = {};
    
    indicators.forEach(indicator => {
      switch (indicator) {
        case 'ma':
          results.ma20 = chartUtils.calculateMA(prices, 20);
          results.ma50 = chartUtils.calculateMA(prices, 50);
          break;
        case 'ema':
          results.ema9 = chartUtils.calculateEMA(prices, 9);
          results.ema21 = chartUtils.calculateEMA(prices, 21);
          break;
        case 'rsi':
          results.rsi = chartUtils.calculateRSI(prices, 14);
          break;
        case 'macd':
          results.macd = chartUtils.calculateMACD(prices, 12, 26, 9);
          break;
        case 'bollinger':
          results.bollinger = chartUtils.calculateBollingerBands(prices, 20, 2);
          break;
      }
    });
    
    return results;
  },
  
  calculateMA: (prices: number[], period: number) => {
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
  },
  
  calculateEMA: (prices: number[], period: number) => {
    const k = 2 / (period + 1);
    const result = new Array(prices.length);
    result[0] = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      result[i] = prices[i] * k + result[i-1] * (1-k);
    }
    
    for (let i = 0; i < period - 1; i++) {
      result[i] = null;
    }
    
    return result;
  },
  
  calculateRSI: (prices: number[], period: number = 14) => {
    const gains = new Array(prices.length - 1);
    const losses = new Array(prices.length - 1);
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
      gains[i-1] = change > 0 ? change : 0;
      losses[i-1] = change < 0 ? -change : 0;
    }
    
    const result = new Array(prices.length).fill(null);
    
    if (gains.length >= period) {
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
  },
  
  calculateMACD: (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
    const fastEMA = chartUtils.calculateEMA(prices, fastPeriod);
    const slowEMA = chartUtils.calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA.map((fast, i) => {
      if (fast === null || slowEMA[i] === null) return null;
      return fast - slowEMA[i];
    });
    
    const validMacd = macdLine.filter(val => val !== null) as number[];
    const signalLine = chartUtils.calculateEMA(validMacd, signalPeriod);
    
    const paddedSignalLine = Array(macdLine.length - validMacd.length + signalPeriod - 1).fill(null).concat(signalLine);
    
    const histogram = macdLine.map((macd, i) => {
      if (macd === null || paddedSignalLine[i] === null) return null;
      return macd - paddedSignalLine[i];
    });
    
    return { macdLine, signalLine: paddedSignalLine, histogram };
  },
  
  calculateBollingerBands: (prices: number[], period: number = 20, stdDevMultiplier: number = 2) => {
    const ma = chartUtils.calculateMA(prices, period);
    
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
  },
  
  calculateATR: (data: StockDataPoint[], period: number = 14) => {
    const trueRanges = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i-1].close;
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const result = new Array(data.length).fill(null);
    
    if (trueRanges.length >= period) {
      let atr = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
      result[period] = atr;
      
      for (let i = period + 1; i < data.length; i++) {
        atr = ((atr * (period - 1)) + trueRanges[i - 1]) / period;
        result[i] = atr;
      }
    }
    
    return result;
  },
  
  calculateOBV: (data: StockDataPoint[]) => {
    const result = new Array(data.length);
    result[0] = data[0].volume;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i].close > data[i-1].close) {
        result[i] = result[i-1] + data[i].volume;
      } else if (data[i].close < data[i-1].close) {
        result[i] = result[i-1] - data[i].volume;
      } else {
        result[i] = result[i-1];
      }
    }
    
    return result;
  },
  
  calculateStochastic: (data: StockDataPoint[], kPeriod: number = 14, dPeriod: number = 3) => {
    const kPercent = new Array(data.length).fill(null);
    
    for (let i = kPeriod - 1; i < data.length; i++) {
      const periodData = data.slice(i - kPeriod + 1, i + 1);
      const highestHigh = Math.max(...periodData.map(d => d.high));
      const lowestLow = Math.min(...periodData.map(d => d.low));
      const currentClose = data[i].close;
      
      if (highestHigh !== lowestLow) {
        kPercent[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      } else {
        kPercent[i] = 50;
      }
    }
    
    const validK = kPercent.filter(val => val !== null) as number[];
    const dPercent = chartUtils.calculateMA(validK, dPeriod);
    const paddedD = Array(data.length - validK.length).fill(null).concat(dPercent);
    
    return { kPercent, dPercent: paddedD };
  },
  
  calculateVWAP: (data: StockDataPoint[]) => {
    const result = new Array(data.length);
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < data.length; i++) {
      const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
      cumulativePriceVolume += typicalPrice * data[i].volume;
      cumulativeVolume += data[i].volume;
      
      result[i] = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typicalPrice;
    }
    
    return result;
  },
  
  calculateFibonacciLevels: (data: StockDataPoint[], startIndex: number = 0, endIndex?: number) => {
    const end = endIndex || data.length - 1;
    const periodData = data.slice(startIndex, end + 1);
    
    const high = Math.max(...periodData.map(d => d.high));
    const low = Math.min(...periodData.map(d => d.low));
    const range = high - low;
    
    const levels = {
      100: high,
      78.6: high - (range * 0.786),
      61.8: high - (range * 0.618),
      50: high - (range * 0.5),
      38.2: high - (range * 0.382),
      23.6: high - (range * 0.236),
      0: low
    };
    
    return levels;
  },
  
  formatPrice: (price: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(price);
  },
  
  formatVolume: (volume: number) => {
    if (volume >= 10000000) {
      return `${(volume / 10000000).toFixed(2)}Cr`;
    } else if (volume >= 100000) {
      return `${(volume / 100000).toFixed(2)}L`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toString();
  },
  
  formatPercentage: (value: number, decimals: number = 2) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  },
  
  getMarketStatus: () => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    
    if (day === 0 || day === 6) {
      return { status: 'closed', reason: 'Weekend' };
    }
    
    if (timeInMinutes < CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES) {
      return { status: 'pre-market', reason: 'Pre-market hours' };
    } else if (timeInMinutes > CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES) {
      return { status: 'after-market', reason: 'After-market hours' };
    } else {
      return { status: 'open', reason: 'Market is open' };
    }
  },
  
  generateRandomData: (count: number = 100) => {
    const data: StockDataPoint[] = [];
    let price = 1000;
    const now = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getTime() - (count - i) * 60000);
      
      const day = date.getDay();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;
      
      if (day === 0 || day === 6) continue;
      if (timeInMinutes < CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES || 
          timeInMinutes > CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES) continue;
      
      const change = (Math.random() - 0.5) * 20;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 10;
      const low = Math.min(open, close) - Math.random() * 10;
      const volume = Math.floor(Math.random() * 1000000) + 10000;
      
      data.push({
        interval_start: date.toISOString(),
        open,
        high,
        low,
        close,
        volume
      });
      
      price = close;
    }
    
    return data;
  },
  
  detectChartPatterns: (data: StockDataPoint[]) => {
    const patterns = [];
    
    for (let i = 2; i < data.length - 2; i++) {
      const current = data[i];
      const prev = data[i - 1];
      const next = data[i + 1];
      
      if (Math.abs(current.open - current.close) < (current.high - current.low) * 0.1) {
        patterns.push({
          type: 'doji',
          index: i,
          confidence: 0.7,
          description: 'Doji candlestick pattern detected'
        });
      }
      
      if (current.close > current.open && 
          (current.close - current.open) < (current.high - current.low) * 0.3 &&
          (current.low - Math.min(current.open, current.close)) > (current.high - current.low) * 0.6) {
        patterns.push({
          type: 'hammer',
          index: i,
          confidence: 0.8,
          description: 'Hammer candlestick pattern detected'
        });
      }
      
      if (current.open > current.close && 
          (current.open - current.close) < (current.high - current.low) * 0.3 &&
          (current.high - Math.max(current.open, current.close)) > (current.high - current.low) * 0.6) {
        patterns.push({
          type: 'shooting_star',
          index: i,
          confidence: 0.8,
          description: 'Shooting star pattern detected'
        });
      }
    }
    
    return patterns;
  },
  
  calculateSupportsResistances: (data: StockDataPoint[], sensitivity: number = 0.02) => {
    const levels = [];
    const prices = data.map(d => d.close);
    
    for (let i = 2; i < prices.length - 2; i++) {
      const isLocalMax = prices[i] > prices[i-1] && prices[i] > prices[i+1] && 
                         prices[i] > prices[i-2] && prices[i] > prices[i+2];
      const isLocalMin = prices[i] < prices[i-1] && prices[i] < prices[i+1] && 
                         prices[i] < prices[i-2] && prices[i] < prices[i+2];
      
      if (isLocalMax) {
        levels.push({
          type: 'resistance',
          price: prices[i],
          index: i,
          strength: 1
        });
      } else if (isLocalMin) {
        levels.push({
          type: 'support',
          price: prices[i],
          index: i,
          strength: 1
        });
      }
    }
    
    const clusteredLevels = [];
    const threshold = (Math.max(...prices) - Math.min(...prices)) * sensitivity;
    
    levels.forEach(level => {
      const existing = clusteredLevels.find(cl => 
        Math.abs(cl.price - level.price) < threshold && cl.type === level.type
      );
      
      if (existing) {
        existing.strength += 1;
        existing.price = (existing.price + level.price) / 2;
      } else {
        clusteredLevels.push({ ...level });
      }
    });
    
    return clusteredLevels.sort((a, b) => b.strength - a.strength);
  }
};

export const useResponsiveBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < CHART_PERFORMANCE_CONFIG.RESPONSIVE_BREAKPOINTS.MOBILE) {
        setBreakpoint('mobile');
      } else if (width < CHART_PERFORMANCE_CONFIG.RESPONSIVE_BREAKPOINTS.TABLET) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };
    
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);
  
  return breakpoint;
};

export const useChartPerformance = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    dataPoints: 0,
    memoryUsage: 0,
    fps: 0
  });
  
  const updateMetrics = useCallback((newMetrics: Partial<typeof metrics>) => {
    setMetrics(prev => ({ ...prev, ...newMetrics }));
  }, []);
  
  return { metrics, updateMetrics };
};

export default StockChart;

export type { StockDataPoint, StockChartProps };

export { 
  CHART_PERFORMANCE_CONFIG,
  availableIndicators,
  chartTypes,
  timeIntervals,
  drawingTools
};
