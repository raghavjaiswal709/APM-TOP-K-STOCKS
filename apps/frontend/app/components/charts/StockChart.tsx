'use client'
import React, { useMemo, useState, useEffect, useRef, useCallback, useReducer } from 'react';
import dynamic from 'next/dynamic';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { parse as parseDate } from 'date-fns';
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

// ✅ OPTIMIZATION 1: Load Plot only once at module level
const Plot = dynamic(() => import('react-plotly.js'), { 
  ssr: false,
  loading: () => null
});

// ===================== TIMEZONE CONSTANTS =====================
const MARKET_TIMEZONE = 'Asia/Kolkata';
const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DAY_FORMAT = 'yyyy-MM-dd';

// ✅ OPTIMIZATION 2: Frozen config for performance
const CHART_PERFORMANCE_CONFIG = Object.freeze({
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
  RESIZE_DEBOUNCE_MS: 100,
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
  },
  RELAYOUT_DEBOUNCE: 150,  // Reduced from 300 for faster gap detection
  UPDATE_DEBOUNCE: 200,
  BUFFER_THRESHOLD: 200,  // Reduced from 500 - More aggressive proactive loading
  THROTTLE_INTERVAL: 100,  // Throttle interval for buffer zone checks
  AGGRESSIVE_GAP_FILL: true, // Enable immediate gap filling on visible range
  STABLE_UI_REVISION: 'stable-v2',
  PRICE_CHART_HEIGHT_RATIO: 0.60, 
  VOLUME_CHART_HEIGHT_RATIO: 0.40, 
  INDICATOR_CHART_HEIGHT: 120, 
  CHART_GAP: 2,
  LOADING_MIN_DISPLAY_TIME: 300,
  SYNC_RELAYOUT_DELAY: 50
} as const);
const MARKET_HOLIDAYS_2025 = [
  '2023-01-26',
  '2023-03-07',
  '2023-03-30',
  '2023-04-04',
  '2023-04-07',
  '2023-04-14',
  '2023-04-22',
  '2023-05-01',
  '2023-06-28',
  '2023-08-15',
  '2023-09-19',
  '2023-10-02',
  '2023-10-24',
  '2023-11-12',
  '2023-11-27',
  '2023-12-25',
  '2024-01-26',
  '2024-03-08',
  '2024-03-25',
  '2024-03-29',
  '2024-04-11',
  '2024-04-17',
  '2024-05-01',
  '2024-06-17',
  '2024-07-17',
  '2024-08-15',
  '2024-10-02',
  '2024-11-01',
  '2024-11-15',
  '2024-12-25',
  '2025-02-26',
  '2025-03-14',
  '2025-03-31',
  '2025-04-10',
  '2025-04-14',
  '2025-04-18',
  '2025-05-01',
  '2025-08-15',
  '2025-08-27',
  '2025-10-02',
  '2025-10-21',
  '2025-10-22',
  '2025-11-05',
  '2025-12-25'
];

// Create a Set for O(1) holiday lookups
const MARKET_HOLIDAYS_SET = new Set(MARKET_HOLIDAYS_2025);

const STABLE_RANGEBREAKS = [
  { 
    bounds: ['sat', 'mon'], 
    pattern: 'day of week' 
  },
  { 
    bounds: [15.5, 9.25], 
    pattern: 'hour' 
  },
  {
    values: MARKET_HOLIDAYS_2025
  }
];
const availableIndicators = [
  { id: 'ma', name: 'Moving Average', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'ema', name: 'Exponential MA', periods: [5, 9, 20, 50, 100, 200], color: '#ffffff' },
  { id: 'bollinger', name: 'Bollinger Bands', period: 20, stdDev: 2, color: '#ffffff' },
  { id: 'rsi', name: 'RSI', period: 14, color: '#ffffff' },
  { id: 'macd', name: 'MACD', fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#ffffff' },
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
  onRangeChange?: (startDate: Date, endDate: Date) => Promise<void>;
}
// ✅ NON-BLOCKING: Small corner loading indicator (chart remains interactive)
const LoadingIndicator = ({ show }: { show: boolean }) => {
  if (!show) return null;
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white px-3 py-2 rounded-lg shadow-lg"
      style={{
        animation: 'slideInUp 0.3s ease-out'
      }}
    >
      <div className="flex items-center gap-2">
        <div 
          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
          style={{
            animation: 'spin 1s linear infinite'
          }}
        />
        <span className="text-xs font-medium">Loading...</span>
      </div>
    </div>
  );
};
// ✅ TIMEZONE-AWARE: Check if a date is during market hours in IST
const isMarketHours = (date: Date): boolean => {
  // Get the IST day of week and time
  const istDayOfWeek = formatInTimeZone(date, MARKET_TIMEZONE, 'E'); // 'Mon', 'Tue', etc.
  const istTime = formatInTimeZone(date, MARKET_TIMEZONE, 'HH:mm');
  const istDay = formatInTimeZone(date, MARKET_TIMEZONE, DAY_FORMAT); // 'yyyy-MM-dd'
  
  // Check if weekend (Saturday = 6, Sunday = 7 in 'E' format as numbers)
  if (istDayOfWeek === 'Sat' || istDayOfWeek === 'Sun') return false;
  
  // Check if holiday
  if (MARKET_HOLIDAYS_SET.has(istDay)) return false;
  
  // Check market hours (09:15 to 15:30 IST)
  const [hours, mins] = istTime.split(':').map(Number);
  const timeInMinutes = hours * 60 + mins;
  
  return timeInMinutes >= CHART_PERFORMANCE_CONFIG.MARKET_OPEN_MINUTES && 
         timeInMinutes <= CHART_PERFORMANCE_CONFIG.MARKET_CLOSE_MINUTES;
};

// ✅ TIMEZONE-AWARE: Filter data and add IST keys for category axis
interface StockDataPointWithIST extends StockDataPoint {
  ist_key: string;
  ist_date: Date;
}

const filterMarketHoursData = (data: StockDataPoint[]): StockDataPointWithIST[] => {
  if (!data || !data.length) return [];
  
  return data
    .filter(item => {
      const date = new Date(item.interval_start);
      return isMarketHours(date);
    })
    .map(item => {
      const istDate = new Date(item.interval_start);
      const istKey = formatInTimeZone(istDate, MARKET_TIMEZONE, DATE_FORMAT);
      
      return {
        ...item,
        ist_key: istKey,
        ist_date: istDate
      };
    });
};

// ✅ Helper to parse IST timestamp strings back to Date objects
const parseISTTimestamp = (istTimestamp: string): Date => {
  // Format is 'yyyy-MM-dd HH:mm:ss' in IST timezone
  // Parse it and treat it as IST
  return parseDate(istTimestamp, DATE_FORMAT, new Date());
};

const generateMarketTimeline = (startDate: Date, endDate: Date, intervalMinutes: number): Date[] => {
  const timeline: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    if (isMarketHours(current)) {
      timeline.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  return timeline;
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
  height = 1000,
  width = 1200,
  defaultChartType = 'candlestick',
  showControls = true,
  theme = 'dark',
  onThemeChange,
  onIntervalChange,
  onRangeChange
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
  const [autoResize, setAutoResize] = useState<boolean>(CHART_PERFORMANCE_CONFIG.AUTO_RESIZE_ENABLED);
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
  const [priceChartHeight, setPriceChartHeight] = useState(0);
  const [volumeChartHeight, setVolumeChartHeight] = useState(0);
  const [rsiChartHeight, setRsiChartHeight] = useState(0);
  const [macdChartHeight, setMacdChartHeight] = useState(0);
  const [syncedXRange, setSyncedXRange] = useState<[string, string] | null>(null);
  const priceChartRef = useRef<any>(null);
  const volumeChartRef = useRef<any>(null);
  const rsiChartRef = useRef<any>(null);
  const macdChartRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLoadingMoreData, setIsLoadingMoreData] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const [dataRange, setDataRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [allData, setAllData] = useState<StockDataPointWithIST[]>([]);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ STEP 4: Create data map for O(1) lookups by IST key
  const dataMap = useMemo(() => {
    const map = new Map<string, StockDataPointWithIST>();
    for (const item of allData) {
      if (item.ist_key) {
        map.set(item.ist_key, item);
      }
    }
    return map;
  }, [allData]);

  // ✅ STEP 5: Generate master timeline - ONLY valid market timestamps (category axis)
  const [masterTimeline, masterData] = useMemo(() => {
    if (!dataRange.start || !dataRange.end || allData.length === 0) {
      return [[], []];
    }

    const timeline: string[] = [];
    const data: (StockDataPointWithIST | null)[] = [];
    
    // Get interval in minutes
    const intervalMap: Record<string, number> = {
      '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '1d': 375 // 375 = full trading day
    };
    const intervalMinutes = intervalMap[selectedInterval] || 1;
    
    // Start from dataRange.start in IST
    const current = new Date(dataRange.start);
    const end = new Date(dataRange.end);
    
    while (current <= end) {
      if (isMarketHours(current)) {
        const istKey = formatInTimeZone(current, MARKET_TIMEZONE, DATE_FORMAT);
        timeline.push(istKey);
        
        // Look up data in map (null if missing)
        const dataPoint = dataMap.get(istKey) || null;
        data.push(dataPoint);
      }
      
      current.setMinutes(current.getMinutes() + intervalMinutes);
    }
    
    console.log(`✅ Master timeline generated: ${timeline.length} valid market timestamps`);
    return [timeline, data];
  }, [dataRange, dataMap, selectedInterval]);
  
  const lastFetchRangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const [xRange, setXRange] = useState<[string, string] | null>(null);
  const [yRange, setYRange] = useState<[number, number] | null>(null);
  const loadingControllerRef = useRef<AbortController | null>(null);
  const minimumLoadingTimeRef = useRef<NodeJS.Timeout | null>(null);
  const stableTimelineRef = useRef<Date[]>([]);
  const relayoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ CRITICAL: Anchoring refs to prevent view jumping on data load
  const anchorTimestampRef = useRef<string | null>(null);
  const prevXRangeRef = useRef<[number, number] | null>(null);
  const wasLoadingRef = useRef<boolean>(false);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null); // For proactive buffer zone throttling
  useEffect(() => {
    const loadingStyles = `
      @keyframes slideInScale {
        0% {
          opacity: 0;
          transform: translateX(100%) scale(0.8);
        }
        100% {
          opacity: 1;
          transform: translateX(0) scale(1);
        }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes progress {
        0% { width: 0%; }
        50% { width: 70%; }
        100% { width: 100%; }
      }
      @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
      @keyframes scaleIn {
        0% { 
          opacity: 0;
          transform: scale(0.9);
        }
        100% { 
          opacity: 1;
          transform: scale(1);
        }
      }
      @keyframes slideInUp {
        0% { 
          opacity: 0;
          transform: translateY(20px);
        }
        100% { 
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.textContent = loadingStyles;
    document.head.appendChild(styleSheet);
    return () => {
      if (document.head.contains(styleSheet)) {
        document.head.removeChild(styleSheet);
      }
    };
  }, []);
  const getIntervalInMs = useCallback((intervalStr: string): number => {
    const intervalMap: { [key: string]: number } = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '10m': 10 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervalMap[intervalStr] || 60 * 1000;
  }, []);
  // ✅ OPTIMIZATION 9: Pre-compute timestamps to avoid Date parsing in loop
  // ✅ REFACTORED: detectDataGaps now uses dataRange state AND detects internal gaps
  const detectDataGaps = useCallback((visibleRange: [string, string], visibleIndices?: [number, number]) => {
    // Use dataRange state which tracks the true bounds of fetched data
    if (!dataRange.start || !dataRange.end) return null;
    
    try {
      const [visibleStartStr, visibleEndStr] = visibleRange;
      const visibleStart = new Date(visibleStartStr);
      const visibleEnd = new Date(visibleEndStr);
      if (isNaN(visibleStart.getTime()) || isNaN(visibleEnd.getTime())) return null;
      
      // ✅ Use dataRange state for boundaries (not allData)
      const dataStart = new Date(dataRange.start);
      const dataEnd = new Date(dataRange.end);
      const gaps = [];
      const bufferTime = 30 * 60 * 1000;
      
      // Check if user panned before the fetched data
      if (visibleStart < dataStart) {
        console.log('🔍 Gap detected BEFORE data:', {
          visibleStart: visibleStart.toISOString(),
          dataStart: dataStart.toISOString()
        });
        gaps.push({
          type: 'before',
          start: new Date(visibleStart.getTime() - bufferTime),
          end: dataStart,
          priority: 'high'
        });
      }
      
      // Check if user panned after the fetched data
      if (visibleEnd > dataEnd) {
        console.log('🔍 Gap detected AFTER data:', {
          visibleEnd: visibleEnd.toISOString(),
          dataEnd: dataEnd.toISOString()
        });
        gaps.push({
          type: 'after',
          start: dataEnd,
          end: new Date(visibleEnd.getTime() + bufferTime),
          priority: 'high'
        });
      }
      
      // ✅ PART 1: Detect INTERNAL gaps within visible range
      if (visibleIndices && masterTimeline.length > 0 && masterData.length > 0) {
        const [startIdx, endIdx] = visibleIndices;
        const clampedStart = Math.max(0, Math.min(masterData.length - 1, startIdx));
        const clampedEnd = Math.max(0, Math.min(masterData.length - 1, endIdx));
        
        console.log('🔎 Scanning for internal gaps from index', clampedStart, 'to', clampedEnd);
        
        let gapStart: number | null = null;
        
        for (let i = clampedStart; i <= clampedEnd; i++) {
          const dataPoint = masterData[i];
          
          if (dataPoint === null) {
            // Found a null - start or continue gap
            if (gapStart === null) {
              gapStart = i;
            }
          } else {
            // Found data - if we were in a gap, close it
            if (gapStart !== null) {
              const gapEnd = i - 1;
              const gapStartLabel = masterTimeline[gapStart];
              const gapEndLabel = masterTimeline[gapEnd];
              
              if (gapStartLabel && gapEndLabel) {
                const gapStartDate = parseISTTimestamp(gapStartLabel);
                const gapEndDate = parseISTTimestamp(gapEndLabel);
                
                console.log('🔍 Internal gap detected:', {
                  indices: [gapStart, gapEnd],
                  labels: [gapStartLabel, gapEndLabel],
                  dates: [gapStartDate.toISOString(), gapEndDate.toISOString()]
                });
                
                gaps.push({
                  type: 'internal',
                  start: gapStartDate,
                  end: gapEndDate,
                  priority: 'medium'
                });
              }
              
              gapStart = null;
            }
          }
        }
        
        // Handle gap that extends to the end of visible range
        if (gapStart !== null) {
          const gapEnd = clampedEnd;
          const gapStartLabel = masterTimeline[gapStart];
          const gapEndLabel = masterTimeline[gapEnd];
          
          if (gapStartLabel && gapEndLabel) {
            const gapStartDate = parseISTTimestamp(gapStartLabel);
            const gapEndDate = parseISTTimestamp(gapEndLabel);
            
            console.log('🔍 Internal gap detected (extends to end):', {
              indices: [gapStart, gapEnd],
              labels: [gapStartLabel, gapEndLabel],
              dates: [gapStartDate.toISOString(), gapEndDate.toISOString()]
            });
            
            gaps.push({
              type: 'internal',
              start: gapStartDate,
              end: gapEndDate,
              priority: 'medium'
            });
          }
        }
      }
      
      return gaps.length > 0 ? gaps : null;
    } catch (error) {
      console.error('Error in detectDataGaps:', error);
      return null;
    }
  }, [dataRange, masterTimeline, masterData]);
  const fetchMissingData = useCallback(async (gaps: Array<{type: string, start: Date, end: Date, priority?: string}>) => {
    if (!companyId || isLoadingMoreData) {
      console.log('Skipping fetch: no companyId or already loading');
      return;
    }
    const startTime = Date.now();
    setLoadingStartTime(startTime);
    setIsLoadingMoreData(true);
    const loadingDelay = setTimeout(() => {
      setShowLoadingIndicator(true);
    }, 300);
    if (loadingControllerRef.current) {
      loadingControllerRef.current.abort();
    }
    loadingControllerRef.current = new AbortController();
    try {
      console.log('Fetching data for gaps:', gaps);
      const fetchPromises = gaps.map(async (gap) => {
        if (lastFetchRangeRef.current) {
          const overlap = gap.start >= lastFetchRangeRef.current.start && 
                         gap.end <= lastFetchRangeRef.current.end;
          if (overlap) {
            console.log('Skipping duplicate fetch for gap:', gap);
            return [];
          }
        }
        try {
          const params = new URLSearchParams({
            exchange: 'NSE',
            startDate: gap.start.toISOString(),
            endDate: gap.end.toISOString(),
            interval: selectedInterval,
            indicators: activeIndicators.join(','),
            fetchType: 'incremental',
            gapType: gap.type || 'unknown'
          });
          const apiUrl = `/api/companies/${companyId}/ohlcv?${params}`;
          console.log('Fetching from:', apiUrl);
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Accept': 'application/json'
            },
            signal: loadingControllerRef.current?.signal
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error ${response.status}:`, errorText);
            if (response.status === 404) {
              console.warn('API endpoint not found - check your backend');
              return [];
            } else if (response.status === 429) {
              console.warn('Rate limited - backing off');
              await new Promise(resolve => setTimeout(resolve, 1000));
              return [];
            }
            throw new Error(`API Error ${response.status}: ${errorText}`);
          }
          const responseData = await response.json();
          console.log('API Response:', responseData);
          let newData = [];
          if (Array.isArray(responseData)) {
            newData = responseData;
          } else if (responseData.data && Array.isArray(responseData.data)) {
            newData = responseData.data;
          } else if (responseData.results && Array.isArray(responseData.results)) {
            newData = responseData.results;
          } else if (responseData.ohlcv && Array.isArray(responseData.ohlcv)) {
            newData = responseData.ohlcv;
          } else {
            console.warn('Unexpected API response format:', responseData);
            return [];
          }
          if (newData.length === 0) {
            console.warn('No data returned from API for gap:', gap);
            return [];
          }
          lastFetchRangeRef.current = { start: gap.start, end: gap.end };
          const normalizedData = newData
            .map((item: StockDataPoint) => {
              try {
                return {
                  interval_start: typeof item.interval_start === 'string' 
                    ? item.interval_start 
                    : new Date(item.interval_start || item.timestamp || item.time).toISOString(),
                  open: Number(item.open || item.o) || 0,
                  high: Number(item.high || item.h) || 0,
                  low: Number(item.low || item.l) || 0,
                  close: Number(item.close || item.c) || 0,
                  volume: Number(item.volume || item.v) || 0
                };
              } catch (error) {
                console.error('Error normalizing data item:', item, error);
                return null;
              }
            })
            .filter((item: any): item is StockDataPoint => item !== null);
          console.log(`Normalized ${normalizedData.length} data points for gap:`, gap);
          return filterMarketHoursData(normalizedData);
        } catch (error: unknown) {
          if ((error as Error).name === 'AbortError') {
            console.log('Fetch aborted');
            return [];
          }
          console.error(`Error fetching gap data for ${gap.type}:`, error);
          return [];
        }
      });
      const results = await Promise.all(fetchPromises);
      const newDataPoints = results.flat();
      console.log(`Total new data points fetched: ${newDataPoints.length}`);
      if (newDataPoints.length > 0) {
        setAllData(prevData => {
          const combined = [...prevData, ...newDataPoints];
          const uniqueMap = new Map();
          combined.forEach(item => {
            const key = item.interval_start;
            const date = new Date(item.interval_start);
            if (!uniqueMap.has(key) || 
                (item.volume > 0 && uniqueMap.get(key).volume === 0)) {
              uniqueMap.set(key, item);
            }
          });
          const sortedData = Array.from(uniqueMap.values()).sort((a, b) => 
            new Date(a.interval_start).getTime() - new Date(b.interval_start).getTime()
          );
          console.log(`Final data array length: ${sortedData.length}`);
          return sortedData;
        });
        setDataRange(prev => {
          const allDates = newDataPoints.map(d => new Date(d.interval_start));
          const newStart = new Date(Math.min(...allDates.map(d => d.getTime())));
          const newEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
          return {
            start: prev.start ? (newStart < prev.start ? newStart : prev.start) : newStart,
            end: prev.end ? (newEnd > prev.end ? newEnd : prev.end) : newEnd
          };
        });
      } else {
        console.warn('No new data points were fetched');
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Fetch operation aborted');
        return;
      }
      console.error('Error in fetchMissingData:', error);
      if (error.message.includes('fetch')) {
        console.error('Network error - check your API endpoint');
      }
    } finally {
      const elapsedTime = Date.now() - startTime;
      const minLoadingTime = 500;
      clearTimeout(loadingDelay);
      const finishLoading = () => {
        setIsLoadingMoreData(false);
        setShowLoadingIndicator(false);
        setLoadingStartTime(null);
      };
      if (elapsedTime < minLoadingTime) {
        minimumLoadingTimeRef.current = setTimeout(finishLoading, minLoadingTime - elapsedTime);
      } else {
        finishLoading();
      }
    }
  }, [companyId, selectedInterval, activeIndicators, isLoadingMoreData, getIntervalInMs]);
  // ✅ OPTIMIZATION 4: Async non-blocking chart sync
  // ✅ REFACTORED: syncChartRanges now works with category indices (numbers, not date strings)
  const syncChartRanges = useCallback((newXRange: [number, number] | any[], sourceChart: string) => {
    // Store the index-based range for syncing
    setSyncedXRange(newXRange as any);
    setXRange(newXRange as any);
    
    const charts = [
      { ref: priceChartRef, name: 'price' },
      { ref: volumeChartRef, name: 'volume' },
      { ref: rsiChartRef, name: 'rsi' },
      { ref: macdChartRef, name: 'macd' }
    ];
    
    // Use requestAnimationFrame to avoid blocking main thread
    requestAnimationFrame(() => {
      charts.forEach((chart, index) => {
        if (sourceChart !== chart.name && chart.ref.current) {
          // Stagger updates slightly to prevent frame drops
          setTimeout(() => {
            try {
              // ✅ Pass index-based range directly to category axis
              chart.ref.current?.relayout({ 'xaxis.range': newXRange });
            } catch {
              // Silent fail - non-critical
            }
          }, index * CHART_PERFORMANCE_CONFIG.SYNC_RELAYOUT_DELAY);
        }
      });
    });
  }, []);
  // ✅ REFACTORED: handlePriceChartRelayout now works with category axis indices
  const handlePriceChartRelayout = useCallback((eventData: any) => {
    // ✅ DEBUG: Log ALL relayout events to see what we're getting
    console.log('🔧 RELAYOUT EVENT RECEIVED:', eventData);
    console.log('🔧 Event keys:', Object.keys(eventData));
    
    if (isLoadingMoreData) {
      console.log('⏸️ Skipping - already loading');
      return;
    }
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    let newXRange = null;
    let newYRange = null;
    
    // Handle Y-axis
    if (eventData['yaxis.range[0]'] !== undefined && eventData['yaxis.range[1]'] !== undefined) {
      newYRange = [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']];
      console.log('📏 Y-axis range:', newYRange);
      setYRange(newYRange);
    }
    if (eventData['yaxis.autorange'] === true) {
      console.log('📏 Y-axis autorange');
      setYRange(null);
    }
    
    // ✅ Handle X-axis: Category axis provides INDICES, not dates
    if (eventData['xaxis.range[0]'] !== undefined && eventData['xaxis.range[1]'] !== undefined) {
      // Category axis returns indices like [50.2, 150.8]
      newXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
      console.log('📊 X-axis category indices:', newXRange);
      
      // Sync the index-based range to other charts
      syncChartRanges(newXRange, 'price');
    } else if (eventData['xaxis.range']) {
      newXRange = eventData['xaxis.range'];
      console.log('📊 X-axis range (direct):', newXRange);
      syncChartRanges(newXRange, 'price');
    } else {
      console.log('⚠️ No X-axis range found in event data');
    }
    
    if (eventData['xaxis.autorange'] === true) {
      console.log('📊 X-axis autorange');
      setSyncedXRange(null);
      setXRange(null);
    }
    
    // ✅ PART 2: Store anchor timestamp BEFORE any gap detection
    if (newXRange && masterTimeline.length > 0) {
      const [rawStart, rawEnd] = newXRange;
      const centerIndex = Math.floor((rawStart + rawEnd) / 2);
      if (centerIndex >= 0 && centerIndex < masterTimeline.length) {
        anchorTimestampRef.current = masterTimeline[centerIndex];
        prevXRangeRef.current = newXRange as [number, number];
        console.log('⚓ Anchor stored:', { 
          centerIndex, 
          timestamp: anchorTimestampRef.current,
          range: prevXRangeRef.current 
        });
      }
    }
    
    // ✅ PROACTIVE BUFFER ZONE LOADING: Throttled check for edges (TradingView-style)
    if (newXRange && masterTimeline.length > 0 && !isLoadingMoreData) {
      // Clear existing throttle timer
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
      
      // Throttle buffer checks to 100ms
      throttleTimerRef.current = setTimeout(() => {
        const [start, end] = newXRange;
        const bufferSize = CHART_PERFORMANCE_CONFIG.BUFFER_THRESHOLD; // 200 points
        
        console.log('⚡ Proactive buffer check:', {
          start,
          end,
          timelineLength: masterTimeline.length,
          bufferSize,
          leftDistance: start,
          rightDistance: masterTimeline.length - end
        });
        
        const gaps = [];
        
        // Check if approaching LEFT edge
        if (start < bufferSize) {
          console.log('⚡ PROACTIVE: Approaching LEFT edge, triggering fetch');
          const startLabel = masterTimeline[0];
          if (startLabel) {
            const startDate = parseISTTimestamp(startLabel);
            const bufferTime = bufferSize * getIntervalInMs(selectedInterval);
            gaps.push({
              type: 'before',
              start: new Date(startDate.getTime() - bufferTime),
              end: startDate,
              priority: 'high'
            });
          }
        }
        
        // Check if approaching RIGHT edge
        if (end > masterTimeline.length - bufferSize) {
          console.log('⚡ PROACTIVE: Approaching RIGHT edge, triggering fetch');
          const endLabel = masterTimeline[masterTimeline.length - 1];
          if (endLabel) {
            const endDate = parseISTTimestamp(endLabel);
            const bufferTime = bufferSize * getIntervalInMs(selectedInterval);
            gaps.push({
              type: 'after',
              start: endDate,
              end: new Date(endDate.getTime() + bufferTime),
              priority: 'high'
            });
          }
        }
        
        // Immediate background fetch if gaps detected
        if (gaps.length > 0) {
          console.log('⚡ Triggering IMMEDIATE proactive fetch:', gaps);
          fetchMissingData(gaps);
        }
      }, CHART_PERFORMANCE_CONFIG.THROTTLE_INTERVAL); // 100ms throttle
    }
    
    // ✅ Debounced gap detection with category-to-date conversion
    if (relayoutTimeoutRef.current) {
      clearTimeout(relayoutTimeoutRef.current);
    }
    
    relayoutTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Debounce timeout fired');
      console.log('⏰ State check:', { 
        isLoadingMoreData, 
        hasNewXRange: !!newXRange, 
        masterTimelineLength: masterTimeline.length 
      });
      
      if (!isLoadingMoreData && newXRange && masterTimeline.length > 0) {
        try {
          // ✅ Convert category indices to actual date strings
          // CRITICAL: Handle indices that go beyond array bounds (user panned beyond data)
          const rawStartIndex = Math.floor(newXRange[0]);
          const rawEndIndex = Math.ceil(newXRange[1]);
          
          console.log('🔢 Raw indices from relayout:', { rawStartIndex, rawEndIndex, timelineLength: masterTimeline.length });
          
          // ✅ Clamp to valid array bounds
          const startIndex = Math.max(0, Math.min(masterTimeline.length - 1, rawStartIndex));
          const endIndex = Math.max(0, Math.min(masterTimeline.length - 1, rawEndIndex));
          
          console.log('🔢 Clamped indices:', { startIndex, endIndex });
          
          const visibleStartLabel = masterTimeline[startIndex];
          const visibleEndLabel = masterTimeline[endIndex];
          
          console.log('🏷️ Timeline labels:', { visibleStartLabel, visibleEndLabel });
          
          // ✅ Safety check: both labels must exist
          if (!visibleStartLabel || !visibleEndLabel) {
            console.error('❌ Missing timeline labels:', { startIndex, endIndex, visibleStartLabel, visibleEndLabel });
            return;
          }
          
          // Parse IST timestamps back to Date objects
          const visibleStartDate = parseISTTimestamp(visibleStartLabel);
          const visibleEndDate = parseISTTimestamp(visibleEndLabel);
          
          console.log('🔍 Converted indices to dates:', {
            indices: [startIndex, endIndex],
            labels: [visibleStartLabel, visibleEndLabel],
            dates: [visibleStartDate.toISOString(), visibleEndDate.toISOString()]
          });
          
          // ✅ CRITICAL: If user panned BEYOND data bounds, detect gaps
          // Check if rawIndices go beyond the actual data
          let visibleRangeStart = visibleStartDate.toISOString();
          let visibleRangeEnd = visibleEndDate.toISOString();
          
          // If user panned BEFORE the data (negative index), extend the visible range
          if (rawStartIndex < 0) {
            const extraMinutes = Math.abs(rawStartIndex) * (getIntervalInMs(selectedInterval) / 60000);
            const extendedStart = new Date(visibleStartDate.getTime() - extraMinutes * 60000);
            visibleRangeStart = extendedStart.toISOString();
            console.log('📍 User panned BEFORE data, extended start:', visibleRangeStart);
          }
          
          // If user panned AFTER the data (beyond array), extend the visible range
          if (rawEndIndex >= masterTimeline.length) {
            const extraMinutes = (rawEndIndex - masterTimeline.length + 1) * (getIntervalInMs(selectedInterval) / 60000);
            const extendedEnd = new Date(visibleEndDate.getTime() + extraMinutes * 60000);
            visibleRangeEnd = extendedEnd.toISOString();
            console.log('📍 User panned AFTER data, extended end:', visibleRangeEnd);
          }
          
          // ✅ PART 1: Pass both extended range AND visible indices to detectDataGaps
          const visibleRange: [string, string] = [visibleRangeStart, visibleRangeEnd];
          const visibleIndices: [number, number] = [startIndex, endIndex];
          
          const gaps = detectDataGaps(visibleRange, visibleIndices);
          if (gaps && gaps.length > 0) {
            console.log('✅ Gaps detected (before/after/internal), fetching missing data:', gaps);
            fetchMissingData(gaps);
          } else {
            console.log('✅ No gaps detected');
          }
        } catch (error) {
          console.error('❌ Error in price chart gap detection:', error);
        }
      } else {
        console.log('⏸️ Skipping gap detection:', { isLoadingMoreData, hasNewXRange: !!newXRange, timelineLength: masterTimeline.length });
      }
    }, CHART_PERFORMANCE_CONFIG.RELAYOUT_DEBOUNCE);
    
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, CHART_PERFORMANCE_CONFIG.RELAYOUT_DEBOUNCE + 200);
  }, [detectDataGaps, fetchMissingData, isLoadingMoreData, syncChartRanges, masterTimeline, getIntervalInMs, selectedInterval]);
  const handleVolumeChartRelayout = useCallback((eventData: any) => {
    if (isLoadingMoreData) {
      console.log('Skipping volume chart relayout handling - already loading');
      return;
    }
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    let newXRange = null;
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      newXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
    } else if (eventData['xaxis.range']) {
      newXRange = eventData['xaxis.range'];
    }
    console.log('Volume chart relayout event:', { newXRange });
    if (newXRange) {
      syncChartRanges(newXRange, 'volume');
    }
    if (eventData['xaxis.autorange'] === true) {
      setSyncedXRange(null);
      setXRange(null);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, CHART_PERFORMANCE_CONFIG.RELAYOUT_DEBOUNCE + 200);
  }, [isLoadingMoreData, syncChartRanges]);
  const handleRsiChartRelayout = useCallback((eventData: any) => {
    if (isLoadingMoreData) return;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    let newXRange = null;
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      newXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
    } else if (eventData['xaxis.range']) {
      newXRange = eventData['xaxis.range'];
    }
    if (newXRange) {
      syncChartRanges(newXRange, 'rsi');
    }
    if (eventData['xaxis.autorange'] === true) {
      setSyncedXRange(null);
      setXRange(null);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, CHART_PERFORMANCE_CONFIG.RELAYOUT_DEBOUNCE + 200);
  }, [isLoadingMoreData, syncChartRanges]);
  const handleMacdChartRelayout = useCallback((eventData: any) => {
    if (isLoadingMoreData) return;
    setIsUserInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    let newXRange = null;
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      newXRange = [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']];
    } else if (eventData['xaxis.range']) {
      newXRange = eventData['xaxis.range'];
    }
    if (newXRange) {
      syncChartRanges(newXRange, 'macd');
    }
    if (eventData['xaxis.autorange'] === true) {
      setSyncedXRange(null);
      setXRange(null);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, CHART_PERFORMANCE_CONFIG.RELAYOUT_DEBOUNCE + 200);
  }, [isLoadingMoreData, syncChartRanges]);
  // ✅ OPTIMIZATION 5: Merge and de-dupe data to prevent data loss
  useEffect(() => {
    if (data && data.length > 0) {
      const marketHoursData = filterMarketHoursData(data);
      
      // Batch state update with merge logic to prevent data loss
      requestAnimationFrame(() => {
        setAllData(prevData => {
          // ✅ CRITICAL FIX: Merge new data with existing data using IST keys
          const combined = [...prevData, ...marketHoursData];
          const uniqueMap = new Map<string, StockDataPointWithIST>();
          
          combined.forEach(item => {
            const key = item.ist_key; // Use IST key for deduplication
            // Keep item with volume if duplicate, or just keep first occurrence
            if (!uniqueMap.has(key) || (item.volume > 0 && uniqueMap.get(key)!.volume === 0)) {
              uniqueMap.set(key, item);
            }
          });
          
          // Sort by IST timestamp
          const sortedData = Array.from(uniqueMap.values()).sort((a, b) => 
            a.ist_date.getTime() - b.ist_date.getTime()
          );
          
          return sortedData;
        });
        
        if (marketHoursData.length > 0) {
          const start = new Date(marketHoursData[0].interval_start);
          const end = new Date(marketHoursData[marketHoursData.length - 1].interval_start);
          setDataRange({ start, end });
        }
      });
    }
  }, [data]); // ✅ Fixed: Removed isUserInteracting to prevent race condition
  
  // ✅ OPTIMIZATION 6: Clean state on company/interval change to prevent data contamination
  useEffect(() => {
    if (companyId) {
      // Clear all data and ranges when company OR interval changes
      setAllData([]); // ✅ CRITICAL: Clear data to prevent contamination
      setDataRange({ start: null, end: null });
      lastFetchRangeRef.current = null;
      setIsUserInteracting(false);
      
      // Reset zoom state
      setXRange(null);
      setYRange(null);
      setSyncedXRange(null);
      
      // Reset indicator states to prevent stale data
      setActiveIndicators(indicators);
      
      // Clear loading states
      setIsLoadingMoreData(false);
      setShowLoadingIndicator(false);
    }
  }, [companyId, indicators, selectedInterval]); // ✅ CRITICAL FIX: Added selectedInterval to prevent data contamination
  
  // ✅ PART 2: CRITICAL - View Anchoring Effect to prevent jumps on data load
  useEffect(() => {
    // Check if loading just finished
    if (wasLoadingRef.current && !isLoadingMoreData) {
      console.log('⚓ Loading finished, applying anchor...');
      
      const anchor = anchorTimestampRef.current;
      const oldRange = prevXRangeRef.current;
      
      if (!anchor || !oldRange || masterTimeline.length === 0) {
        console.log('⚓ No anchor or empty timeline, skipping:', { 
          hasAnchor: !!anchor, 
          hasOldRange: !!oldRange, 
          timelineLength: masterTimeline.length 
        });
        wasLoadingRef.current = false;
        return;
      }
      
      // 1. Find the new index of our anchor timestamp
      const newAnchorIndex = masterTimeline.indexOf(anchor);
      
      if (newAnchorIndex === -1) {
        console.log('⚓ Anchor not found in timeline (interval changed?), clearing:', anchor);
        anchorTimestampRef.current = null;
        prevXRangeRef.current = null;
        wasLoadingRef.current = false;
        return;
      }
      
      console.log('⚓ Anchor found at new index:', newAnchorIndex, 'was centered in range:', oldRange);
      
      // 2. Calculate the new range based on the anchor's new position
      const [oldStart, oldEnd] = oldRange;
      const rangeWidth = oldEnd - oldStart;
      const oldCenter = (oldStart + oldEnd) / 2;
      const oldStartOffset = oldStart - oldCenter; // How far the start was from the center
      
      const newStart = newAnchorIndex + oldStartOffset;
      const newEnd = newStart + rangeWidth;
      
      console.log('⚓ Calculated new range:', { 
        oldRange, 
        newRange: [newStart, newEnd],
        anchorMoved: newAnchorIndex - oldCenter,
        rangeWidth 
      });
      
      // 3. Set the new, anchored range
      setSyncedXRange([newStart, newEnd] as any);
      
      // 4. Clear the refs
      anchorTimestampRef.current = null;
      prevXRangeRef.current = null;
      
      console.log('⚓ View anchored successfully! 🎯');
    }
    
    // Always update the ref to the current loading state
    wasLoadingRef.current = isLoadingMoreData;
  }, [masterTimeline, isLoadingMoreData]);
  
  // ✅ OPTIMIZATION 8: Batch chart height calculations to prevent multiple re-renders
  useEffect(() => {
    const totalAvailableHeight = isFullscreen ? window.innerHeight - 20 : height - 20;
    const gap = CHART_PERFORMANCE_CONFIG.CHART_GAP;
    const hasRSI = activeIndicators.includes('rsi');
    const hasMACD = activeIndicators.includes('macd');
    let indicatorHeight = 0;
    if (hasRSI) indicatorHeight += CHART_PERFORMANCE_CONFIG.INDICATOR_CHART_HEIGHT + gap;
    if (hasMACD) indicatorHeight += CHART_PERFORMANCE_CONFIG.INDICATOR_CHART_HEIGHT + gap;
    const availableForMainCharts = totalAvailableHeight - indicatorHeight;
    
    // Batch all height updates in a single state update using requestAnimationFrame
    requestAnimationFrame(() => {
      const updates = {
        price: showVolume 
          ? Math.floor(availableForMainCharts * CHART_PERFORMANCE_CONFIG.PRICE_CHART_HEIGHT_RATIO)
          : availableForMainCharts,
        volume: showVolume 
          ? Math.floor(availableForMainCharts * CHART_PERFORMANCE_CONFIG.VOLUME_CHART_HEIGHT_RATIO)
          : 0,
        rsi: hasRSI ? CHART_PERFORMANCE_CONFIG.INDICATOR_CHART_HEIGHT : 0,
        macd: hasMACD ? CHART_PERFORMANCE_CONFIG.INDICATOR_CHART_HEIGHT : 0
      };
      
      setPriceChartHeight(updates.price);
      setVolumeChartHeight(updates.volume);
      setRsiChartHeight(updates.rsi);
      setMacdChartHeight(updates.macd);
    });
  }, [height, isFullscreen, showVolume, activeIndicators]);
  useEffect(() => {
    return () => {
      [loadingTimeoutRef, minimumLoadingTimeRef, relayoutTimeoutRef, interactionTimeoutRef].forEach(ref => {
        if (ref.current) clearTimeout(ref.current);
      });
      if (loadingControllerRef.current) {
        loadingControllerRef.current.abort();
      }
    };
  }, []);
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
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        try {
          if (priceChartRef.current?.resizeHandler) {
            priceChartRef.current.resizeHandler();
          }
          if (volumeChartRef.current?.resizeHandler) {
            volumeChartRef.current.resizeHandler();
          }
          if (rsiChartRef.current?.resizeHandler) {
            rsiChartRef.current.resizeHandler();
          }
          if (macdChartRef.current?.resizeHandler) {
            macdChartRef.current.resizeHandler();
          }
        } catch (error) {
          console.warn('Plotly resize failed:', error);
        }
      }, CHART_PERFORMANCE_CONFIG.RESIZE_DEBOUNCE_MS);
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
  // ✅ OPTIMIZATION 7: Remove redundant filtering - allData is already filtered
  // const filteredData is removed - allData is already market-hours-filtered in useEffect
  
  // ✅ OPTIMIZATION 3: Fixed timestamp bug + optimized aggregation
  const optimizedData = useMemo(() => {
    if (!allData.length) return allData;
    if (allData.length <= CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS) {
      return allData;
    }
    const ratio = Math.ceil(allData.length / CHART_PERFORMANCE_CONFIG.MAX_VISIBLE_POINTS);
    const result: StockDataPoint[] = [];
    for (let i = 0; i < allData.length; i += ratio) {
      const chunk = allData.slice(i, Math.min(i + ratio, allData.length));
      if (chunk.length === 1) {
        result.push(chunk[0]);
      } else {
        // ✅ FIX: Use FIRST timestamp for correct time progression
        const open = chunk[0].open;
        const close = chunk[chunk.length - 1].close;
        let high = chunk[0].high;
        let low = chunk[0].low;
        let volume = 0;
        
        // Optimized single-pass calculation
        for (let j = 0; j < chunk.length; j++) {
          const point = chunk[j];
          if (point.high > high) high = point.high;
          if (point.low < low) low = point.low;
          volume += point.volume;
        }
        
        result.push({
          interval_start: chunk[0].interval_start, // ✅ FIRST not LAST
          open, high, low, close, volume
        });
      }
    }
    return result;
  }, [allData]);
  
  // ✅ OPTIMIZATION 10: Indicator calculation cache to prevent redundant recalculations
  const indicatorCacheRef = useRef<Map<string, any>>(new Map());
  
  const calculateIndicator = useCallback((type: string, prices: number[], options: Record<string, number> = {}) => {
    // Cache key based on type, prices length, and options
    const cacheKey = `${type}-${prices.length}-${JSON.stringify(options)}`;
    if (indicatorCacheRef.current.has(cacheKey)) {
      return indicatorCacheRef.current.get(cacheKey);
    }
    
    let result: any;
    switch (type) {
      case 'ma': {
        const period = options.period || 20;
        const maResult = new Array(prices.length);
        for (let i = 0; i < prices.length; i++) {
          if (i < period - 1) {
            maResult[i] = null;
          } else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
              sum += prices[j];
            }
            maResult[i] = sum / period;
          }
        }
        result = maResult;
        break;
      }
      case 'ema': {
        const period = options.period || 9;
        const k = 2 / (period + 1);
        const result = new Array(prices.length);
        result[0] = prices[0];
        for (let i = 1; i < prices.length; i++) {
          result[i] = prices[i] * k + result[i-1] * (1-k);
        }
        for (let i = 0; i < period - 1; i++) {
          result[i] = null;
        }
        break;
      }
      case 'bollinger': {
        const period = options.period || 20;
        const stdDevMultiplier = options.stdDev || 2;
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
        result = { middle: ma, upper: upperBand, lower: lowerBand };
        break;
      }
      case 'rsi': {
        const period = options.period || 14;
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
        break;
      }
      case 'macd': {
        const fastPeriod = options.fastPeriod || 12;
        const slowPeriod = options.slowPeriod || 26;
        const signalPeriod = options.signalPeriod || 9;
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
        result = { macdLine, signalLine: paddedSignalLine, histogram };
        break;
      }
      default:
        result = [];
    }
    
    // Store in cache
    indicatorCacheRef.current.set(cacheKey, result);
    
    // Limit cache size to prevent memory leaks (max 50 cached indicators)
    if (indicatorCacheRef.current.size > 50) {
      const firstKey = indicatorCacheRef.current.keys().next().value;
      if (firstKey) {
        indicatorCacheRef.current.delete(firstKey);
      }
    }
    
    return result;
  }, []);
  const convertToHeikenAshi = useCallback((data: StockDataPoint[]) => {
    if (!data || data.length === 0) return [];
    const haData: any[] = [];
    let prevHA: any = null;
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
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
          up: 'rgba(34, 197, 94, 0.8)',
          down: 'rgba(239, 68, 68, 0.8)'
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
          up: 'rgba(5, 150, 105, 0.8)',
          down: 'rgba(220, 38, 38, 0.8)'
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
  const priceChartData = useMemo(() => {
    if (!masterData.length) return [];
    // ✅ Use masterTimeline (category strings) for X-axis
    const plotElements = [];
    const chartData = selectedChartType === 'heiken-ashi' ? convertToHeikenAshi(masterData.filter(d => d !== null) as StockDataPointWithIST[]) : masterData;
    let priceChart;
    switch (selectedChartType) {
      case 'candlestick':
        priceChart = {
          x: masterTimeline, // ✅ Category axis
          open: masterData.map(item => item?.open ?? null),
          high: masterData.map(item => item?.high ?? null),
          low: masterData.map(item => item?.low ?? null),
          close: masterData.map(item => item?.close ?? null),
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
          x: masterTimeline, // ✅ Category axis
          open: masterData.map(item => item?.open ?? null),
          high: masterData.map(item => item?.high ?? null),
          low: masterData.map(item => item?.low ?? null),
          close: masterData.map(item => item?.close ?? null),
          type: 'ohlc',
          name: 'Price',
          decreasing: { line: { color: colors.downColor, width: 2 } },
          increasing: { line: { color: colors.upColor, width: 2 } }
        };
        break;
      case 'heiken-ashi':
        priceChart = {
          x: masterTimeline, // ✅ Category axis
          open: chartData.map(item => item?.ha_open ?? null),
          high: chartData.map(item => item?.ha_high ?? null),
          low: chartData.map(item => item?.ha_low ?? null),
          close: chartData.map(item => item?.ha_close ?? null),
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
          x: masterTimeline, // ✅ Category axis
          y: masterData.map(item => item?.close ?? null),
          type: 'scatter',
          mode: 'lines',
          name: 'Price',
          line: { 
            color: colors.line, 
            width: 2.5,
            shape: 'linear'
          },
          connectgaps: false // ✅ Don't connect over missing data
        };
        break;
      case 'area':
        priceChart = {
          x: masterTimeline, // ✅ Category axis
          y: masterData.map(item => item?.close ?? null),
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
          connectgaps: false // ✅ Don't connect over missing data
        };
        break;
    }
    plotElements.push(priceChart);
    const prices = masterData.map(item => item?.close ?? 0);
    if (activeIndicators.includes('ma')) {
      selectedMAperiods.forEach((period, index) => {
        const ma = calculateIndicator('ma', prices, { period });
        plotElements.push({
          x: masterTimeline, // ✅ Category axis
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
          x: masterTimeline, // ✅ Category axis
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
        x: masterTimeline, // ✅ Category axis
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
        x: masterTimeline, // ✅ Category axis
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
        x: masterTimeline, // ✅ Category axis
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
    return plotElements;
  }, [
    masterData,
    masterTimeline,
    selectedChartType, 
    activeIndicators, 
    selectedMAperiods, 
    selectedEMAperiods, 
    colors,
    calculateIndicator,
    convertToHeikenAshi
  ]);
  const volumeChartData = useMemo(() => {
    if (!masterData.length) return [];
    // ✅ Use masterTimeline and masterData
    const volumes = masterData.map(item => item?.volume ?? 0);
    const volumeColors = masterData.map((item, i) => {
      if (i === 0 || !item) return colors.volume.up;
      const currentClose = item.close;
      const previousItem = masterData[i - 1];
      if (!previousItem) return colors.volume.up;
      const previousClose = previousItem.close;
      return currentClose >= previousClose ? colors.volume.up : colors.volume.down;
    });
    const maxVolume = Math.max(...volumes);
    const minVolume = Math.min(...volumes.filter(v => v > 0));
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const normalizedVolumes = volumes.map(vol => {
      if (vol === 0) return 0;
      const minVisibleRatio = 0.02;
      const minVisibleVolume = maxVolume * minVisibleRatio;
      return Math.max(vol, minVisibleVolume);
    });
    const volumeChart = {
      x: masterTimeline, // ✅ Category axis
      y: normalizedVolumes,
      type: 'bar',
      name: 'Volume',
      marker: {
        color: volumeColors,
        line: { 
          width: deviceType === 'mobile' ? 0 : 0.5,
          color: 'rgba(255,255,255,0.1)' 
        },
        opacity: 0.9
      },
      text: volumes.map(vol => vol.toLocaleString()),
      hovertemplate: '<b>Volume:</b> %{text}<br><b>Time:</b> %{x}<extra></extra>',
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text }
      }
    };
    return [volumeChart];
  }, [masterData, masterTimeline, colors, deviceType]);
  const rsiChartData = useMemo(() => {
    if (!masterData.length || !activeIndicators.includes('rsi')) return [];
    // ✅ Use masterTimeline and masterData
    const prices = masterData.map(item => item?.close ?? 0);
    const rsi = calculateIndicator('rsi', prices) as number[];
    return [{
      x: masterTimeline, // ✅ Category axis
      y: rsi,
      type: 'scatter',
      mode: 'lines',
      name: 'RSI(14)',
      line: { 
        color: colors.indicators.rsi, 
        width: 2,
        shape: 'linear'
      },
      connectgaps: false
    }];
  }, [masterData, masterTimeline, activeIndicators, colors, calculateIndicator]);
  const macdChartData = useMemo(() => {
    if (!masterData.length || !activeIndicators.includes('macd')) return [];
    // ✅ Use masterTimeline and masterData
    const prices = masterData.map(item => item?.close ?? 0);
    const macd = calculateIndicator('macd', prices) as any;
    return [
      {
        x: masterTimeline, // ✅ Category axis
        y: macd.macdLine,
        type: 'scatter',
        mode: 'lines',
        name: 'MACD',
        line: { 
          color: colors.indicators.macd, 
          width: 2,
          shape: 'linear'
        },
        connectgaps: false
      },
      {
        x: masterTimeline, // ✅ Category axis
        y: macd.signalLine,
        type: 'scatter',
        mode: 'lines',
        name: 'Signal',
        line: { 
          color: '#fbbf24', 
          width: 2,
          shape: 'linear'
        },
        connectgaps: false
      },
      {
        x: masterTimeline, // ✅ Category axis
        y: macd.histogram,
        type: 'bar',
        name: 'Histogram',
        marker: {
          color: macd.histogram.map((val: number | null) => 
            val === null ? 'rgba(0,0,0,0)' : 
            val >= 0 ? colors.upColor : colors.downColor
          ),
          opacity: 0.7
        }
      }
    ];
  }, [masterData, masterTimeline, activeIndicators, colors, calculateIndicator]);
  const chartTitle = useMemo(() => {
    let title = companyId ? 
      `${companyId} - ${selectedInterval.toUpperCase()} Chart [${masterData.length} points]` : 
      'Select a Company';
    if (isLoadingMoreData) {
      title += ' 🔄 Expanding...';
    }
    return title;
  }, [companyId, selectedInterval, masterData.length, isLoadingMoreData]);
  const priceChartLayout = useMemo(() => {
    const getResponsiveMargin = () => {
      switch (deviceType) {
        case 'mobile':
          return { r: 40, l: 40, b: 10, t: 60, pad: 2 };
        case 'tablet':
          return { r: 50, l: 50, b: 15, t: 70, pad: 3 };
        default:
          return { r: 60, l: 60, b: 40, t: 80, pad: 4 };
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
      uirevision: CHART_PERFORMANCE_CONFIG.STABLE_UI_REVISION + '_price',
      dragmode: drawingMode || 'pan',
      selectdirection: 'diagonal',
      scrollZoom: true,
      doubleClick: 'reset+autosize',
      showlegend: true,
      legend: {
        x: 0,
        y: 1.02,
        orientation: deviceType === 'mobile' ? 'v' : 'h',
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text, size: responsiveFonts.legend },
        xanchor: deviceType === 'mobile' ? 'left' : 'auto',
        yanchor: deviceType === 'mobile' ? 'bottom' : 'auto'
      },
      margin: responsiveMargin,
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        rangeslider: { visible: false },
        type: 'category', // ✅ CHANGED from 'date' to 'category'
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        title: { text: 'Time (IST)', font: { color: colors.text, size: responsiveFonts.axis } },
        autorange: syncedXRange ? false : true,
        range: syncedXRange || undefined,
        fixedrange: false, // ✅ CRITICAL: Allows panning/zooming
        editable: true, // ✅ NEW: Enables interaction with axis
        // ✅ REMOVED rangebreaks - not needed with category axis
        nticks: deviceType === 'mobile' ? 8 : deviceType === 'tablet' ? 12 : 15, // Increased for better label distribution
        showticklabels: true,
        tickangle: deviceType === 'mobile' ? -45 : 0 // Angle labels on mobile
      },
      yaxis: {
        title: { text: 'Price (₹)', font: { color: colors.text, size: responsiveFonts.axis } },
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
        nticks: deviceType === 'mobile' ? 6 : deviceType === 'tablet' ? 8 : 10
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
        text: chartTitle,
        font: { color: colors.text, size: responsiveFonts.title, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      }
    };
    return baseLayout;
  }, [
    showGridlines, 
    logScale, 
    drawingMode, 
    colors, 
    crosshair, 
    annotations, 
    deviceType,
    syncedXRange, 
    yRange,
    chartTitle
  ]);
  const volumeChartLayout = useMemo(() => {
    const getResponsiveMargin = () => {
      switch (deviceType) {
        case 'mobile':
          return { r: 40, l: 40, b: 40, t: 20, pad: 2 };
        case 'tablet':
          return { r: 50, l: 50, b: 45, t: 25, pad: 3 };
        default:
          return { r: 60, l: 60, b: 50, t: 30, pad: 4 };
      }
    };
    const getResponsiveFontSizes = () => {
      switch (deviceType) {
        case 'mobile':
          return { title: 12, axis: 9, tick: 8, legend: 9 };
        case 'tablet':
          return { title: 13, axis: 10, tick: 9, legend: 10 };
        default:
          return { title: 14, axis: 11, tick: 10, legend: 11 };
      }
    };
    const responsiveMargin = getResponsiveMargin();
    const responsiveFonts = getResponsiveFontSizes();
    return {
      autosize: true,
      responsive: true,
      uirevision: CHART_PERFORMANCE_CONFIG.STABLE_UI_REVISION + '_volume',
      dragmode: 'pan',
      selectdirection: 'diagonal',
      scrollZoom: true,
      doubleClick: 'reset+autosize',
      showlegend: false,
      margin: responsiveMargin,
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        type: 'category', // ✅ CHANGED from 'date' to 'category'
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        title: { text: '', font: { color: colors.text, size: responsiveFonts.axis } },
        autorange: syncedXRange ? false : true,
        range: syncedXRange || undefined,
        fixedrange: false,
        // ✅ REMOVED rangebreaks
        nticks: deviceType === 'mobile' ? 8 : deviceType === 'tablet' ? 12 : 15,
        showticklabels: false
      },
      yaxis: {
        title: { text: 'Volume', font: { color: colors.text, size: responsiveFonts.axis } },
        tickformat: '.2s',
        showgrid: showGridlines,
        gridcolor: colors.grid,
        zerolinecolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        side: 'left',
        autorange: true,
        fixedrange: false,
        nticks: deviceType === 'mobile' ? 4 : deviceType === 'tablet' ? 6 : 8
      },
      hovermode: 'x unified',
      hoverdistance: deviceType === 'mobile' ? 50 : 100,
      spikedistance: deviceType === 'mobile' ? 500 : 1000,
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: responsiveFonts.legend }
      },
      title: {
        text: 'Trading Volume',
        font: { color: colors.text, size: responsiveFonts.title, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      }
    };
  }, [
    showGridlines, 
    colors, 
    deviceType,
    syncedXRange
  ]);
  const rsiChartLayout = useMemo(() => {
    const getResponsiveFontSizes = () => {
      switch (deviceType) {
        case 'mobile':
          return { title: 11, axis: 8, tick: 7, legend: 8 };
        case 'tablet':
          return { title: 12, axis: 9, tick: 8, legend: 9 };
        default:
          return { title: 13, axis: 10, tick: 9, legend: 10 };
      }
    };
    const responsiveFonts = getResponsiveFontSizes();
    return {
      autosize: true,
      responsive: true,
      uirevision: CHART_PERFORMANCE_CONFIG.STABLE_UI_REVISION + '_rsi',
      dragmode: 'pan',
      selectdirection: 'diagonal',
      scrollZoom: true,
      doubleClick: 'reset+autosize',
      showlegend: false,
      margin: { r: 60, l: 60, b: 50, t: 30, pad: 4 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        type: 'category', // ✅ CHANGED from 'date' to 'category'
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        title: { text: '', font: { color: colors.text, size: responsiveFonts.axis } },
        autorange: syncedXRange ? false : true,
        range: syncedXRange || undefined,
        fixedrange: false,
        // ✅ REMOVED rangebreaks
        nticks: deviceType === 'mobile' ? 8 : deviceType === 'tablet' ? 12 : 15,
        showticklabels: false
      },
      yaxis: {
        title: { text: 'RSI', font: { color: colors.indicators.rsi, size: responsiveFonts.axis } },
        range: [0, 100],
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        tickvals: [20, 50, 80],
        side: 'left',
        nticks: 3
      },
      hovermode: 'x unified',
      hoverdistance: deviceType === 'mobile' ? 50 : 100,
      spikedistance: deviceType === 'mobile' ? 500 : 1000,
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: responsiveFonts.legend }
      },
      title: {
        text: 'RSI (14)',
        font: { color: colors.text, size: responsiveFonts.title, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      },
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: 70,
          y1: 70,
          line: { color: colors.downColor, width: 1, dash: 'dash' }
        },
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: 30,
          y1: 30,
          line: { color: colors.upColor, width: 1, dash: 'dash' }
        }
      ]
    };
  }, [showGridlines, colors, deviceType, syncedXRange]);
  const macdChartLayout = useMemo(() => {
    const getResponsiveFontSizes = () => {
      switch (deviceType) {
        case 'mobile':
          return { title: 11, axis: 8, tick: 7, legend: 8 };
        case 'tablet':
          return { title: 12, axis: 9, tick: 8, legend: 9 };
        default:
          return { title: 13, axis: 10, tick: 9, legend: 10 };
      }
    };
    const responsiveFonts = getResponsiveFontSizes();
    return {
      autosize: true,
      responsive: true,
      uirevision: CHART_PERFORMANCE_CONFIG.STABLE_UI_REVISION + '_macd',
      dragmode: 'pan',
      selectdirection: 'diagonal',
      scrollZoom: true,
      doubleClick: 'reset+autosize',
      showlegend: true,
      legend: {
        x: 0,
        y: 1.02,
        orientation: 'h',
        bgcolor: 'rgba(0,0,0,0)',
        font: { color: colors.text, size: responsiveFonts.legend - 1 }
      },
      margin: { r: 60, l: 60, b: 50, t: 30, pad: 4 },
      paper_bgcolor: colors.paper,
      plot_bgcolor: colors.bg,
      font: { color: colors.text, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        type: 'category', // ✅ CHANGED from 'date' to 'category'
        showgrid: showGridlines,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        title: { text: 'Time (IST)', font: { color: colors.text, size: responsiveFonts.axis } },
        autorange: syncedXRange ? false : true,
        range: syncedXRange || undefined,
        fixedrange: false,
        // ✅ REMOVED rangebreaks
        nticks: deviceType === 'mobile' ? 8 : deviceType === 'tablet' ? 12 : 15,
        showticklabels: true,
        tickangle: deviceType === 'mobile' ? -45 : 0
      },
      yaxis: {
        title: { text: 'MACD', font: { color: colors.indicators.macd, size: responsiveFonts.axis } },
        showgrid: true,
        gridcolor: colors.grid,
        tickfont: { color: colors.text, size: responsiveFonts.tick },
        side: 'left',
        nticks: deviceType === 'mobile' ? 3 : 5
      },
      hovermode: 'x unified',
      hoverdistance: deviceType === 'mobile' ? 50 : 100,
      spikedistance: deviceType === 'mobile' ? 500 : 1000,
      hoverlabel: {
        bgcolor: colors.bg,
        bordercolor: colors.line,
        font: { color: colors.text, size: responsiveFonts.legend }
      },
      title: {
        text: 'MACD (12,26,9)',
        font: { color: colors.text, size: responsiveFonts.title, family: 'Inter, system-ui, sans-serif' },
        x: 0.5,
        xanchor: 'center'
      }
    };
  }, [showGridlines, colors, deviceType, syncedXRange]);
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
    plotGlPixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    toImageButtonOptions: {
      format: 'png',
      filename: `${companyId || 'chart'}_${new Date().toISOString().split('T')[0]}`,
      height: priceChartHeight,
      width: chartDimensions.width,
      scale: deviceType === 'mobile' ? 1 : 2
    }
  }), [companyId, chartDimensions, deviceType, priceChartHeight]);
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
    if (priceChartRef.current) {
      const update = { dragmode: mode || 'pan' };
      priceChartRef.current.relayout(update);
    }
  }, []);
  const handlePlotUpdate = useCallback((figure: any) => {
    if (figure.layout?.shapes) {
      setAnnotations(figure.layout.shapes);
    }
  }, []);
  const resetChart = useCallback(() => {
    setXRange(null);
    setYRange(null);
    setSyncedXRange(null);
    const resetUpdate = { 
      'xaxis.autorange': true,
      'yaxis.autorange': true,
      'xaxis.range': undefined,
      'yaxis.range': undefined,
      dragmode: 'pan'
    };
    const charts = [priceChartRef, volumeChartRef, rsiChartRef, macdChartRef];
    charts.forEach(chartRef => {
      if (chartRef.current) {
        chartRef.current.relayout(resetUpdate);
      }
    });
    setAnnotations([]);
    setDrawingMode(null);
  }, []);
  const exportChartData = useCallback(() => {
    if (!masterData.length) return;
    const csvContent = [
      'Date,Open,High,Low,Close,Volume',
      ...masterData.filter(item => item !== null).map(item => 
        `${item!.interval_start},${item!.open},${item!.high},${item!.low},${item!.close},${item!.volume}`
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
  }, [masterData, companyId, selectedInterval]);
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
    if (!alertsEnabled || !masterData.length || !priceAlerts.length) return;
    // Get the last non-null data point for current price
    const lastDataPoint = masterData.filter(item => item !== null).slice(-1)[0];
    const currentPrice = lastDataPoint?.close;
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
  }, [masterData, priceAlerts, alertsEnabled, companyId]);
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
  overflowX: isFullscreen ? 'auto' : 'hidden',
  overflowY: isFullscreen ? 'auto' : 'hidden',
  scrollBehavior: 'smooth'
}), [colors.bg, height, isFullscreen]);
  const chartContainerStyle = useMemo(() => {
    const sidebarWidth = sidebarVisible && deviceType !== 'mobile' ? CHART_PERFORMANCE_CONFIG.SIDEBAR_WIDTH : 0;
    return {
      marginLeft: deviceType === 'mobile' ? '0px' : `${sidebarWidth}px`,
      transition: 'margin-left 0.3s ease',
      height: '100%',
      width: deviceType === 'mobile' ? '100%' : sidebarVisible ? `calc(100% - ${sidebarWidth}px)` : '100%',
      minWidth: `${CHART_PERFORMANCE_CONFIG.MIN_CHART_WIDTH}px`,
      position: 'relative' as const,
      display: 'flex',
      flexDirection: 'column' as const
    };
  }, [sidebarVisible, deviceType]);
  const testDynamicLoading = useCallback(() => {
    console.log('=== Testing Dynamic Loading ===');
    console.log('Current allData length:', allData.length);
    console.log('Company ID:', companyId);
    console.log('Is loading:', isLoadingMoreData);
    if (!companyId) {
      console.error('No company ID set');
      return;
    }
    if (allData.length === 0) {
      console.error('No initial data available');
      return;
    }
    const now = new Date();
    const testRange: [string, string] = [
      new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString()
    ];
    console.log('Test range:', testRange);
    const gaps = detectDataGaps(testRange);
    console.log('Detected gaps:', gaps);
    if (gaps && gaps.length > 0) {
      console.log('Triggering test fetch...');
      fetchMissingData(gaps);
    } else {
      console.log('No gaps detected in test range');
      const forcedGap = [{
        type: 'test',
        start: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        end: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        priority: 'high' as const
      }];
      console.log('Forcing test gap:', forcedGap);
      fetchMissingData(forcedGap);
    }
  }, [allData, companyId, detectDataGaps, fetchMissingData, isLoadingMoreData]);
  if (loading && allData.length === 0) {
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
      <LoadingIndicator show={showLoadingIndicator || isLoadingMoreData} />
      {sidebarVisible && deviceType !== 'mobile' && (
        <div 
          className="absolute top-0 left-0 z-8 p-4 rounded-lg shadow-lg border max-h-full overflow-y-auto"
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
            <button
              onClick={testDynamicLoading}
              style={buttonStyle}
              className="w-full justify-center mt-2"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
            >
              🧪 Test Dynamic Loading
            </button>
          </div>
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
                  Show Volume Chart
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
            </div>
          </div>
          <div className="mb-4">
            <div className="space-y-2">
              <button
                onClick={() => {
                  setAnnotations([]);
                  if (priceChartRef.current) {
                    priceChartRef.current.relayout({ shapes: [] });
                  }
                }}
                style={buttonStyle}
                className="w-full justify-center"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
              >
                <Eraser size={14} />
                Clear Drawings
              </button>
            </div>
          </div>
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
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleThemeToggle}
              style={buttonStyle}
              className="justify-center"
            >
              {chartTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setShowVolume(!showVolume)}
              style={showVolume ? activeButtonStyle : buttonStyle}
              className="justify-center"
            >
              Volume
            </button>
            <button
              onClick={resetChart}
              style={buttonStyle}
              className="justify-center"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="absolute top-4 left-4 z-10 rounded-lg shadow-lg"
          style={buttonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.button.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.button.bg}
        >
          <Settings size={16} />
          {deviceType !== 'mobile' && 'Controls'}
        </button>
      )}
      <div 
        ref={chartContainerRef}
        style={chartContainerStyle}
      >
        <div 
          style={{ 
            height: `${priceChartHeight}px`,
            marginBottom: `${CHART_PERFORMANCE_CONFIG.CHART_GAP}px`
          }}
        >
          <Plot
            ref={priceChartRef}
            data={priceChartData}
            layout={priceChartLayout}
            config={config}
            style={{ width: '100%', height: '100%' }}
            onUpdate={handlePlotUpdate}
            onRelayout={handlePriceChartRelayout}
            useResizeHandler={true}
            onInitialized={() => {
              console.log('Price chart initialized');
            }}
          />
        </div>
        {showVolume && volumeChartHeight > 0 && (
          <div 
            style={{ 
              height: `${volumeChartHeight}px`,
              marginBottom: `${CHART_PERFORMANCE_CONFIG.CHART_GAP}px`
            }}
          >
            <Plot
              ref={volumeChartRef}
              data={volumeChartData}
              layout={volumeChartLayout}
              config={config}
              style={{ width: '100%', height: '100%' }}
              onRelayout={handleVolumeChartRelayout}
              useResizeHandler={true}
              onInitialized={() => {
                console.log('Volume chart initialized');
              }}
            />
          </div>
        )}
        {activeIndicators.includes('rsi') && rsiChartHeight > 0 && (
          <div 
            style={{ 
              height: `${rsiChartHeight}px`,
              marginBottom: `${CHART_PERFORMANCE_CONFIG.CHART_GAP}px`
            }}
          >
            <Plot
              ref={rsiChartRef}
              data={rsiChartData}
              layout={rsiChartLayout}
              config={config}
              style={{ width: '100%', height: '100%' }}
              onRelayout={handleRsiChartRelayout}
              useResizeHandler={true}
              onInitialized={() => {
                console.log('RSI chart initialized');
              }}
            />
          </div>
        )}
        {activeIndicators.includes('macd') && macdChartHeight > 0 && (
          <div 
            style={{ 
              height: `${macdChartHeight}px`,
              marginBottom: `${CHART_PERFORMANCE_CONFIG.CHART_GAP}px`
            }}
          >
            <Plot
              ref={macdChartRef}
              data={macdChartData}
              layout={macdChartLayout}
              config={config}
              style={{ width: '100%', height: '100%' }}
              onRelayout={handleMacdChartRelayout}
              useResizeHandler={true}
              onInitialized={() => {
                console.log('MACD chart initialized');
              }}
            />
          </div>
        )}
        <div 
          className="absolute bottom-4 right-4 p-3 rounded-lg shadow-lg border text-xs"
          style={{ 
            backgroundColor: colors.paper,
            borderColor: colors.grid,
            color: colors.text,
            maxWidth: deviceType === 'mobile' ? '200px' : '250px'
          }}
        >
        </div>
        <div className="absolute top-4 left-20">
          <div className="flex items-center space-x-2">
          </div>
        </div>
      </div>
    </div>
  );
}
export default StockChart;

