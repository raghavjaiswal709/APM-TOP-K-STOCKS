'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, useTransition } from 'react';
import { getSocket, onReconnect, isSocketConnected, onSocketSourceChange, getSocketSourceLabel } from '@/lib/socket';
import dynamic from 'next/dynamic';
import { usePersistentState, useScrollRestoration } from '@/hooks/useStateRestoration';
import { usePageState } from '@/app/context/PageStateContext';
import { useIntradayShapes } from '@/hooks/useClusteringV2';
import type { IntradayShapePattern } from '@/types/clustering';
import { ARCHETYPE_COLORS } from '@/types/clustering';
import { usePatternOverlay } from '@/hooks/usePatternOverlay';
import { PatternOverlayPanel } from './PatternOverlayPanel';
import { AppSidebar } from "@/app/components/app-sidebar";
import { CompanyList } from "@/app/components/CompanyList";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "@/app/components/toggleButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WatchlistSelector } from "@/app/components/controllers/WatchlistSelector2/WatchlistSelector";
import { ImageCarousel } from "../market-data/components/ImageCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useClusterSymbols } from "@/hooks/useClusterSymbols";
import { TrendingUp, TrendingDown, Minus, Wifi, Award, Clock, Building2, Database, AlertCircle, WifiOff, Activity, Calendar as CalendarIcon, Images, ChevronDown, ChevronUp, PanelBottomOpen, PanelBottomClose, AlertTriangle, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { MarketClosedBanner } from "@/app/components/MarketClosedBanner";
import { isMarketOpen } from "@/lib/marketHours";
import {
  fetchHistoricalData,
  fetchHistoricalDataAsOHLC,
  detectDataGaps,
  mergeOHLCData,
  needsExternalDataBackfill,
  getMarketStatus,
  OHLCCandle
} from "@/lib/historicalDataFetcher";
import { useDesirability } from "@/hooks/useDesirability";
import { DesirabilityPanel } from "../market-data/components/DesirabilityPanel";
import { sentimentService } from '@/app/services/sentimentService';
import { SubscriptionManagerModal } from "../market-data/components/SubscriptionManagerModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ListChecks, Settings2, Briefcase, BarChart2 } from 'lucide-react';
import { gttService, type GttPrediction } from '@/app/services/gttService';
import { Zap } from 'lucide-react';

// Prediction Integration
import { usePredictionPolling } from '@/hooks/usePredictionPolling';
import { useGttPolling } from '@/hooks/useGttPolling';
import { useGttCountdown } from '@/hooks/useGttCountdown';
import { usePredictionCountdown } from '@/hooks/usePredictionCountdown';
import { transformGttToChartPredictions, ALL_HORIZON_KEYS, HORIZON_LINE_CONFIG } from '@/lib/gttTransformers';
import AIPredictionsDashboard from '../market-data/components/AIPredictionsDashboard';
import { LiveDataDashboard } from '../market-data/components/LiveDataDashboard';
import PredictionAPIService from '@/lib/predictionService';
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Portfolio Mode
import { PortfolioMode } from "@/app/components/PortfolioMode";

declare global {
  interface Window {
    __latestCompanySentiment?: any;
  }
}

// Cluster overlay uses the shared chart component from market-data
const LightWeightStockChart = dynamic(() => import('../market-data/components/MarketDataStockChart').then(mod => ({ default: mod.MarketDataStockChart })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-blue-500">Loading chart...</div>
    </div>
  )
});


const UMAPClusterDashboard = dynamic(() => import('../market-data/components/umap/UMAPClusterDashboard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-cyan-500">Loading UMAP Analysis...</div>
    </div>
  )
});

interface MarketData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
}

interface ChartUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingHours {
  start: string;
  end: string;
  current: string;
  isActive: boolean;
}

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  marker?: string;
}

const ClusterOverlayPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTheme();
  const { updateMarketDataState } = usePageState();

  // Use persistent state for key UI state (load directly from localStorage)
  const [selectedSymbol, setSelectedSymbol] = usePersistentState<string>(
    'cluster-overlay-selectedSymbol',
    ''
  );
  const [selectedCompany, setSelectedCompany] = usePersistentState<string | null>(
    'cluster-overlay-selectedCompany',
    null
  );
  const [selectedExchange, setSelectedExchange] = usePersistentState<string | null>(
    'cluster-overlay-selectedExchange',
    null
  );
  const [selectedWatchlist, setSelectedWatchlist] = usePersistentState<string>(
    'cluster-overlay-selectedWatchlist',
    ''
  );

  // UI state preservation
  const [isAnalysisVisible, setIsAnalysisVisible] = usePersistentState<boolean>(
    'cluster-overlay-isAnalysisVisible',
    false  // Collapsed by default
  );

  // Portfolio Mode State
  const [portfolioModeEnabled, setPortfolioModeEnabled] = usePersistentState<boolean>(
    'cluster-overlay-portfolioModeEnabled',
    false
  );

  const [chartActiveIndicators, setChartActiveIndicators] = usePersistentState<string[]>(
    'cluster-overlay-chartActiveIndicators',
    []
  );
  const [chartActiveType, setChartActiveType] = usePersistentState<string>(
    'cluster-overlay-chartActiveType',
    'candlestick'
  );

  // Prediction Integration State
  const [showPredictions, setShowPredictions] = usePersistentState<boolean>(
    'cluster-overlay-showPredictions',
    true
  );
  const [showVolume, setShowVolume] = usePersistentState<boolean>(
    'cluster-overlay-showVolume',
    true
  );
  const [predictionMode, setPredictionMode] = usePersistentState<'overlay' | 'comparison'>(
    'cluster-overlay-predictionMode',
    'overlay'
  );
  const [gttChartType, setGttChartType] = usePersistentState<'candlestick' | 'line'>(
    'cluster-overlay-gttChartType',
    'candlestick'
  );
  const [isGttEnabled, setIsGttEnabled] = usePersistentState<boolean>(
    'cluster-overlay-isGttEnabled',
    true
  );
  // GTT per-horizon visibility: each of the 10 horizons + input_close can be toggled
  const [gttHorizonVisibility, setGttHorizonVisibility] = usePersistentState<Record<string, boolean>>(
    'cluster-overlay-gttHorizonVisibility',
    // Default: all visible
    Object.fromEntries([...ALL_HORIZON_KEYS.map(k => [k, true]), ['input_close', true]])
  );

  // Chart interval for candle aggregation (1m = 1 candle per minute, 5m = 1 candle per 5 min, etc.)
  const [chartInterval, setChartInterval] = usePersistentState<string>(
    'cluster-overlay-chartInterval',
    '1m'
  );

  // Scroll restoration for main page
  useScrollRestoration('cluster-overlay-main-scroll');

  // Track if we've already loaded data (to prevent re-fetching on navigation)
  const hasLoadedDataRef = useRef<boolean>(false);
  const hasInitializedSocketRef = useRef<boolean>(false);

  // Health check state for prediction services
  // Health check state — NEVER persisted, always re-checked fresh on mount
  const [predictionServiceHealth, setPredictionServiceHealth] = useState<'checking' | 'available' | 'unavailable'>(
    'checking'
  );
  const [gttServiceHealth, setGttServiceHealth] = useState<'checking' | 'available' | 'unavailable'>(
    'checking'
  );
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [predictionsOutdated, setPredictionsOutdated] = useState<boolean>(false);

  // Live countdown to the next GTT prediction cycle (ticks every second)
  const gttCountdown = useGttCountdown();
  // Live countdown to the next regular prediction fetch (every 5 min, ticks every second)
  const predCountdown = usePredictionCountdown();

  // Market Data State — plain useState (NOT persisted: live data is refreshed
  // immediately via socket + backfill on mount; serialising MB of ticks to
  // localStorage on every tick was the #1 performance killer).
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, MarketData[]>>({});
  const [ohlcData, setOhlcData] = useState<Record<string, OHLCData[]>>({});
  const [chartUpdates, setChartUpdates] = useState<Record<string, ChartUpdate[]>>({});

  const [socketStatus, setSocketStatus] = useState<string>('Disconnected');
  const [socketSource, setSocketSource] = useState<'server' | 'localhost'>('server');
  const [hasBackfillData, setHasBackfillData] = useState(false);
  // lastDataReceived moved to ref — only read in the 30s health-check interval,
  // no need to trigger re-renders on every live tick.
  const lastDataReceivedRef = useRef<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  // dataCount / updateFrequency / activeSymbols / backgroundDataPoints are
  // never rendered in JSX — use refs to avoid re-renders on every tick/heartbeat.
  const dataCountRef = useRef<number>(0);
  const updateFrequencyRef = useRef<number>(0);
  const [tradingHours, setTradingHours] = useState<TradingHours>({
    start: '',
    end: '',
    current: '',
    isActive: false
  });

  const activeSymbolsRef = useRef<string[]>([]);
  const backgroundDataPointsRef = useRef<number>(0);
  const [gradientMode, setGradientMode] = useState<'profit' | 'loss' | 'neutral'>('neutral');
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [activeTab, setActiveTab] = usePersistentState<'live' | 'predictions'>(
    'cluster-overlay-activeTab',
    'live'
  );
  const [marketOpen, setMarketOpen] = useState<boolean>(true);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [historicalDataStatus, setHistoricalDataStatus] = useState<string>('');
  // ✅ Increment this whenever handleDateChange is called — ensures the backfill
  // useEffect re-runs even if effectiveDate didn't change (e.g. hookSelectedDate
  // already equalled the newly-selected date).
  const [forceRefetchKey, setForceRefetchKey] = useState<number>(0);
  const [overallSentiment, setOverallSentiment] = useState<string>('NEUTRAL');
  const [isSentimentFetching, setIsSentimentFetching] = useState<boolean>(false);

  // NEW: Maps for company list display
  const [desirabilityMap, setDesirabilityMap] = useState<Record<string, { score: number; classification: string; reoccurrenceProbability: number }>>({});
  const [sentimentMap, setSentimentMap] = useState<Record<string, 'BULLISH' | 'BEARISH' | 'NEUTRAL'>>({});

  // Subscription Management State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionErrors, setSubscriptionErrors] = useState<{
    code: number;
    message: string;
    invalidSymbols: string[];
    timestamp: number;
  } | null>(null);
  const [failedSymbols, setFailedSymbols] = useState<string[]>([]);
  const [stoppedSymbols, setStoppedSymbols] = useState<string[]>([]);
  const [permanentlyStoppedSymbols, setPermanentlyStoppedSymbols] = useState<string[]>([]);

  // Auth status state for orange banner
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Track which symbols have been backfilled to avoid duplicate fetches
  const backfilledSymbolsRef = useRef<Set<string>>(new Set());

  // AbortController for cancelling in-flight historical data fetches on company switch
  const historicalFetchAbortRef = useRef<AbortController | null>(null);

  // Date synchronization (persistent)
  const [currentDate, setCurrentDate] = usePersistentState<string | null>(
    'cluster-overlay-currentDate',
    null
  );
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);

  // Show all companies filter state (persistent)
  const [showAllCompanies, setShowAllCompanies] = usePersistentState<boolean>(
    'cluster-overlay-showAllCompanies',
    false
  );

  // Fullscreen mode state for chart section (persistent)
  const [isChartFullscreen, setIsChartFullscreen] = usePersistentState<boolean>(
    'cluster-overlay-isChartFullscreen',
    false
  );

  // ─── Intraday Shape Overlay State ──────────────────────────────────────────
  const [showIntradayOverlay, setShowIntradayOverlay] = usePersistentState<boolean>(
    'cluster-overlay-showIntradayOverlay',
    false
  );
  const [selectedUmapPattern, setSelectedUmapPattern] = usePersistentState<string>(
    'cluster-overlay-selectedUmapPattern',
    'P0'
  );

  // Shared X-Axis state for chart synchronization
  const [sharedXRange, setSharedXRange] = useState<[Date, Date] | undefined>(undefined);

  // Deferred initialization for heavy operations (smooth page transitions)
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Resizable analysis panel
  const [analysisHeight, setAnalysisHeight] = useState<number>(45); // percentage
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag handler for resizable panel
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = ((containerRect.bottom - e.clientY) / containerRect.height) * 100;

    // Clamp between 20% and 80%
    const clampedHeight = Math.max(20, Math.min(80, newHeight));
    setAnalysisHeight(clampedHeight);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Resizable & collapsible sidebar (company list)
  const [sidebarWidth, setSidebarWidth] = useState<number>(280); // pixels
  const [isSidebarDragging, setIsSidebarDragging] = useState<boolean>(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);
  const mainRowRef = useRef<HTMLDivElement>(null);

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarDragging(true);
  }, []);

  const handleSidebarMouseMove = useCallback((e: MouseEvent) => {
    if (!isSidebarDragging || !mainRowRef.current) return;
    const containerRect = mainRowRef.current.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    // Clamp between 200px and 500px
    const clampedWidth = Math.max(200, Math.min(500, newWidth));
    setSidebarWidth(clampedWidth);
  }, [isSidebarDragging]);

  const handleSidebarMouseUp = useCallback(() => {
    setIsSidebarDragging(false);
  }, []);

  useEffect(() => {
    if (isSidebarDragging) {
      document.addEventListener('mousemove', handleSidebarMouseMove);
      document.addEventListener('mouseup', handleSidebarMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      return () => {
        document.removeEventListener('mousemove', handleSidebarMouseMove);
        document.removeEventListener('mouseup', handleSidebarMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isSidebarDragging, handleSidebarMouseMove, handleSidebarMouseUp]);

  // Sync state to context on changes (for state persistence across navigation)
  useEffect(() => {
    updateMarketDataState({
      selectedSymbol,
      selectedCompany,
      selectedExchange,
      selectedWatchlist,
      isAnalysisVisible,
      portfolioModeEnabled,
      showPredictions,
      predictionMode,
      gttChartType,
      isGttEnabled,
      activeTab,
      showAllCompanies,
      isChartFullscreen,
      currentDate,
      scrollPosition: window.scrollY,
    });
  }, [
    selectedSymbol,
    selectedCompany,
    selectedExchange,
    selectedWatchlist,
    isAnalysisVisible,
    portfolioModeEnabled,
    showPredictions,
    predictionMode,
    gttChartType,
    isGttEnabled,
    activeTab,
    showAllCompanies,
    isChartFullscreen,
    currentDate,
    updateMarketDataState,
  ]);

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChartFullscreen) {
        setIsChartFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChartFullscreen]);

  // Bidirectional X-axis synchronization handler with throttling
  const handleXRangeChange = useCallback((range: [Date, Date]) => {
    console.log('🎯 [Parent] Received range change:', range);
    setSharedXRange(range);
  }, []);

  const {
    companies,
    loading: watchlistLoading,
    error: watchlistError,
    selectedDate: hookSelectedDate,
    availableDates,
  } = useWatchlist({ date: currentDate || undefined, showAllCompanies });

  // PAA resolution for PatternPool Overlay (3 | 5 | 9 | 15) — declared here so
  // useClusterSymbols can receive it before patternOverlay block further below.
  const [patternPaaWidth, setPatternPaaWidth] = usePersistentState<number>(
    'cluster-overlay-patternPaaWidth',
    15
  );

  // Fetch set of company codes that have PatternPool cluster data for the selected resolution
  const { clusterSymbols } = useClusterSymbols(patternPaaWidth);

  // Date Synchronization Logic
  const effectiveDate = currentDate || hookSelectedDate;

  const latestAvailableDate = useMemo(() => {
    if (!availableDates || availableDates.length === 0) return null;
    return [...availableDates].sort().reverse()[0];
  }, [availableDates]);

  const isLatestDate = useMemo(() => {
    if (!effectiveDate || !latestAvailableDate) return true;
    return effectiveDate === latestAvailableDate;
  }, [effectiveDate, latestAvailableDate]);

  // ── Date Navigator helpers ───────────────────────────────────────────────
  // Sorted ascending list of all trading dates available in the watchlist DB
  const sortedDates = useMemo(() => {
    if (!availableDates || availableDates.length === 0) return [];
    return [...availableDates].sort();
  }, [availableDates]);

  // Index of the currently-viewed date in sortedDates (-1 if not found → treat as last)
  const currentDateIdx = useMemo(() => {
    if (sortedDates.length === 0) return -1;
    if (!effectiveDate) return sortedDates.length - 1; // no explicit date → at "latest"
    const idx = sortedDates.indexOf(effectiveDate);
    return idx >= 0 ? idx : sortedDates.length - 1;
  }, [effectiveDate, sortedDates]);

  // Refs
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const frequencyIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const socketRef = useRef<any>(null);
  const selectedSymbolRef = useRef<string>('');
  const isSubscribedRef = useRef<Set<string>>(new Set());
  // Persistent set of all symbols we WANT subscribed (survives disconnects)
  const allSubscribedSymbolsRef = useRef<Set<string>>(new Set());
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for latest data state (for stale-closure-free access in callbacks)
  const ohlcDataRef = useRef(ohlcData);
  const historicalDataRef = useRef(historicalData);

  // Track cumulative volume per symbol for real-time delta calculation
  // Format: Map<symbol, Map<minuteTimestamp, cumulativeVolumeAtStartOfMinute>>
  const cumulativeVolumeRef = useRef<Map<string, Map<number, number>>>(new Map());

  // ───────────────────────────────────────────────────────────────────────────
  // Cross-symbol leak guard (see market-data/page.tsx for full context)
  // ───────────────────────────────────────────────────────────────────────────
  const referencePriceRef = useRef<Map<string, number>>(new Map());
  const PRICE_SANITY_MAX_DEVIATION = 0.20;

  const isPriceSaneForSymbol = useCallback((symbol: string, price: number | undefined | null): boolean => {
    if (!symbol || price == null || !Number.isFinite(price) || price <= 0) return false;
    const ref = referencePriceRef.current.get(symbol);
    if (!ref || ref <= 0) return true;
    return Math.abs(price - ref) / ref <= PRICE_SANITY_MAX_DEVIATION;
  }, []);

  const updateReferencePrice = useCallback((symbol: string, price: number | undefined | null) => {
    if (!symbol || price == null || !Number.isFinite(price) || price <= 0) return;
    referencePriceRef.current.set(symbol, price);
  }, []);

  // Prediction Polling Integration
  const {
    isPolling,
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
    refetch: refetchPredictions,
    predictions,
    loading: predictionLoading,
    error: predictionError,
    lastUpdated: predictionLastUpdated,
    dataAge: predictionDataAge,
    updateTrigger,
    elapsedTime,
    timeRemaining,
    pollCount,
    progressPercentage,
    nextPollTime,
    timeUntilNextPoll,
  } = usePredictionPolling({
    company: selectedCompany || selectedSymbol.split(':')[1]?.split('-')[0] || '',
    pollInterval: 5 * 60 * 1000, // Poll every 5 minutes to sync with server prediction times (9:15, 9:20, etc.)
    totalDuration: 7 * 60 * 60 * 1000, // Run for entire market day (9:15 AM - 3:30 PM = ~6.25 hours)
    enabled: showPredictions && isClient && predictionServiceHealth === 'available',
    autoStart: true,
    onUpdate: (data) => {
      console.log(`✅ [PREDICTION UPDATE] Predictions updated for ${selectedCompany}:`, data.count, 'predictions');
    },
    onError: (error) => {
      console.warn('⚠️ Prediction unavailable:', error);
    },
    onComplete: () => {
      console.log('✅ Prediction collection completed for 25 minutes');
    },
  });

  // GTT Polling Integration
  const {
    predictions: rawGttPredictions,
    loading: gttLoading,
    error: gttError,
    lastUpdated: gttLastUpdated,
    isPolling: isGttPolling,
    startPolling: startGttPolling,
    stopPolling: stopGttPolling
  } = useGttPolling({
    symbol: selectedSymbol,
    enabled: isGttEnabled && isClient && !!selectedSymbol && gttServiceHealth === 'available',
    pollInterval: 60000
  });

  const gttChartData = useMemo(() => {
    if (!rawGttPredictions) return null;
    return transformGttToChartPredictions(rawGttPredictions);
  }, [rawGttPredictions]);

  // Both prediction types are now passed separately to the chart.
  // Regular predictions (port 5112) → predictions prop, controlled by showPredictions
  // GTT predictions (port 5113) → gttPredictions prop, controlled by isGttEnabled

  // Check if predictions are outdated (not from today)
  useEffect(() => {
    if (!predictions || !predictions.predictions) {
      setPredictionsOutdated(false);
      return;
    }

    const predictionKeys = Object.keys(predictions.predictions);
    if (predictionKeys.length === 0) {
      setPredictionsOutdated(false);
      return;
    }

    // Get today's date in IST
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Check if any prediction timestamp is from today
    const hasToday = predictionKeys.some(key => key.startsWith(todayIST));

    console.log(`🔍 [PREDICTION CHECK] Today IST: ${todayIST}, Keys sample: ${predictionKeys.slice(0, 3).join(', ')}, Has today: ${hasToday}`);

    setPredictionsOutdated(!hasToday);
  }, [predictions]);

  const {
    score: desirabilityScore,
    classification: desirabilityClassification,
    loading: desirabilityLoading,
    error: desirabilityError,
    data: desirabilityData,
    refetch: refetchDesirability,
  } = useDesirability(selectedSymbol);

  // ─── Intraday Shapes for Overlay ────────────────────────────────────────────
  // Derive plain company code (e.g. "RELIANCE") from the full symbol (e.g. "NSE:RELIANCE-EQ")
  const overlaySymbol = useMemo(() => {
    if (!selectedSymbol) return '';
    if (selectedSymbol.includes(':')) return selectedSymbol.split(':')[1]?.split('-')[0] || '';
    return selectedSymbol.split('-')[0];
  }, [selectedSymbol]);

  const {
    data: intradayShapesData,
    loading: intradayShapesLoading,
  } = useIntradayShapes(overlaySymbol, 30, showIntradayOverlay && !!overlaySymbol);

  // Resolved pattern object for the currently selected P-label
  const activeIntradayPattern = useMemo((): IntradayShapePattern | null => {
    if (!intradayShapesData || !selectedUmapPattern) return null;
    return intradayShapesData.patterns[selectedUmapPattern] ?? null;
  }, [intradayShapesData, selectedUmapPattern]);

  // All available pattern keys sorted, for the selector UI
  const intradayPatternKeys = useMemo(() => {
    if (!intradayShapesData) return [];
    return Object.keys(intradayShapesData.patterns).sort();
  }, [intradayShapesData]);

  // Today's open price (first candle's open of the day)
  const todayOpenPrice = useMemo(() => {
    if (!selectedSymbol) return 0;
    const candles = ohlcData[selectedSymbol];
    if (!candles || candles.length === 0) return 0;
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const todayCandles = candles.filter(c => {
      const d = new Date(c.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return d === todayIST;
    }).sort((a, b) => a.timestamp - b.timestamp);
    return todayCandles[0]?.open ?? 0;
  }, [selectedSymbol, ohlcData]);

  // ─── PatternPool Overlay (port 8765) ─────────────────────────────────────────
  const [showPatternOverlay, setShowPatternOverlay] = usePersistentState<boolean>(
    'cluster-overlay-showPatternOverlay',
    true
  );
  const [showTop3Lines, setShowTop3Lines] = usePersistentState<boolean>(
    'cluster-overlay-showTop3Lines',
    true
  );
  const [showBeyondTop3Lines, setShowBeyondTop3Lines] = usePersistentState<boolean>(
    'cluster-overlay-showBeyondTop3Lines',
    false
  );
  // patternPaaWidth is declared earlier (before useClusterSymbols) — used here too.

  const patternOverlayState = usePatternOverlay({
    symbol: overlaySymbol,
    enabled: !!overlaySymbol,
    replayDate: effectiveDate || null,
    paaWidthMin: patternPaaWidth,
  });

  // ── Pattern overlay toolbar controls: expand/collapse ────────────────────
  const [isPanelExpanded, setIsPanelExpanded] = usePersistentState<boolean>(
    'cluster-overlay-patternPanelExpanded', false
  );
  const [patternPanelPos, setPatternPanelPos] = useState<{ left: number; top: number } | null>(null);
  const patternPanelRef = useRef<HTMLDivElement | null>(null);

  const isLoadingDesirability = desirabilityLoading;

  const handleFetchDesirabilityScore = useCallback(() => {
    refetchDesirability();
  }, [refetchDesirability]);

  const desirabilityDescription = useMemo(() => {
    if (!desirabilityScore) return 'N/A';
    if (desirabilityScore >= 0.7) return 'Highly Desirable';
    if (desirabilityScore >= 0.5) return 'Moderately Desirable';
    if (desirabilityScore >= 0.3) return 'Acceptable';
    return 'Not Desirable';
  }, [desirabilityScore]);

  // Update desirability map when data is fetched for selected company
  useEffect(() => {
    if (desirabilityData && selectedSymbol) {
      const companyCode = selectedSymbol.includes(':')
        ? selectedSymbol.split(':')[1]?.split('-')[0]
        : selectedSymbol.split('-')[0];
      if (companyCode && desirabilityData.top_pattern) {
        setDesirabilityMap(prev => ({
          ...prev,
          [companyCode]: {
            score: desirabilityData.top_pattern.desirability_score,
            classification: desirabilityData.top_pattern.classification,
            reoccurrenceProbability: desirabilityData.top_pattern.reoccurrence_probability
          },
          [selectedSymbol]: {
            score: desirabilityData.top_pattern.desirability_score,
            classification: desirabilityData.top_pattern.classification,
            reoccurrenceProbability: desirabilityData.top_pattern.reoccurrence_probability
          }
        }));
      }
    }
  }, [desirabilityData, selectedSymbol]);

  const predictionRevision = useMemo(() => {
    if (!predictions || predictions.count === 0) return 0;
    return updateTrigger;
  }, [predictions, updateTrigger]);

  const handleTimerEnd = useCallback(async () => {
    console.log('⏰ [TIMER END] Timer reached 0 - triggering immediate refresh');
    try {
      const result = await refetchPredictions();
      console.log('✅ [TIMER END] Refresh completed:', result?.count || 0, 'predictions');
    } catch (error) {
      console.error('❌ [TIMER END] Refresh failed:', error);
    }
  }, [refetchPredictions]);

  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 [MANUAL REFRESH] Button clicked, fetching predictions...');
    try {
      const result = await refetchPredictions();
      console.log('✅ [MANUAL REFRESH] Predictions refreshed:', result?.count || 0, 'predictions');
    } catch (error) {
      console.error('❌ [MANUAL REFRESH] Refresh failed:', error);
    }
  }, [refetchPredictions]);

  // Utility Functions
  const validateAndFormatSymbol = useCallback((companyCode: string, exchange: string, marker?: string): string => {
    const normalizedSymbol = companyCode
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9&.\-]/g, '');

    if (!normalizedSymbol) return '';

    const finalMarker = marker && marker.trim() ? marker.trim().toUpperCase() : 'EQ';
    const normalizedExchange = (exchange || 'NSE').trim().toUpperCase();

    console.log(`🔍 [validateAndFormatSymbol] Input: ${companyCode}, Exchange: ${normalizedExchange}, Marker: "${marker}" → ${normalizedSymbol}-${finalMarker}`);

    switch (normalizedExchange) {
      case 'NSE':
        return `NSE:${normalizedSymbol}-${finalMarker}`;
      case 'BSE':
        return `BSE:${normalizedSymbol}-${finalMarker}`;
      default:
        return `${normalizedExchange}:${normalizedSymbol}-${finalMarker}`;
    }
  }, []);

  // Keep ref in sync so socket reconnect callback always has fresh value
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  // Keep data refs in sync for stale-closure-free access
  useEffect(() => { ohlcDataRef.current = ohlcData; }, [ohlcData]);
  useEffect(() => { historicalDataRef.current = historicalData; }, [historicalData]);

  const handleCompanyChange = useCallback((companyCode: string | null, exchange?: string, marker?: string) => {
    console.log(`🏢 [handleCompanyChange] Full arguments:`, { companyCode, exchange, marker });

    // ✅ Cancel any in-flight historical data fetch for the previous company
    if (historicalFetchAbortRef.current) {
      historicalFetchAbortRef.current.abort();
      historicalFetchAbortRef.current = null;
    }

    const newSymbol = (companyCode && exchange)
      ? validateAndFormatSymbol(companyCode, exchange, marker)
      : '';

    if (newSymbol && newSymbol !== selectedSymbol) {
      // ✅ Always show the loader on company switch.
      //
      // Previously we did an "instant switch" when ohlcDataRef.current[newSymbol]
      // had any cached candles from background subscriptions. That cache can be
      // stale (wrong date, partial backfill, or polluted by a past cross-symbol
      // leak), so the chart kept showing data that didn't match the company in
      // the sidebar. Force a fresh fetch every time and gate the chart behind
      // the loader until the new symbol's OHLC arrives — backfill is fast, the
      // tiny extra latency is well worth the correctness guarantee.
      console.log(`📡 [handleCompanyChange] Switching to ${newSymbol} — clearing stale state and fetching fresh`);

      // ✅ Drop any previously-cached state for the new symbol so the chart
      // cannot momentarily show stale candles before fresh data lands.
      setOhlcData(prev => {
        if (!prev[newSymbol]) return prev;
        const next = { ...prev };
        delete next[newSymbol];
        return next;
      });
      setHistoricalData(prev => {
        if (!prev[newSymbol]) return prev;
        const next = { ...prev };
        delete next[newSymbol];
        return next;
      });
      setChartUpdates(prev => {
        if (!prev[newSymbol]) return prev;
        const next = { ...prev };
        delete next[newSymbol];
        return next;
      });
      // Allow the backfill effect to re-run for this symbol
      backfilledSymbolsRef.current.forEach(key => {
        if (key.startsWith(newSymbol)) {
          backfilledSymbolsRef.current.delete(key);
        }
      });

      setIsLoadingHistorical(true);
      setHistoricalDataStatus('Loading data...');
    }

    setSelectedCompany(companyCode);
    setSelectedExchange(exchange || null);

    if (companyCode && exchange) {
      console.log(`✅ [handleCompanyChange] Formatted symbol: ${newSymbol}`);
      setSelectedSymbol(newSymbol);

      // Persist selected company to subscribed_companies.json
      if (newSymbol && newSymbol !== selectedSymbol) {
        fetch('/api/admin/subscribed-companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [newSymbol] }),
        })
          .then(r => r.json())
          .then(d => console.log(`💾 [subscribed] Saved ${newSymbol}:`, d))
          .catch(err => console.warn('[subscribed] Save failed:', err));
      }
    } else {
      setSelectedSymbol('');
    }
  }, [validateAndFormatSymbol, selectedSymbol]);

  const handleDateChange = useCallback((date: string) => {
    console.log(`📅 Date changed to: ${date}`);

    // ✅ Cancel any in-flight fetch for the old date
    if (historicalFetchAbortRef.current) {
      historicalFetchAbortRef.current.abort();
      historicalFetchAbortRef.current = null;
    }

    // ✅ Clear cached data for the current symbol so it re-fetches for the new date
    if (selectedSymbol) {
      setOhlcData(prev => {
        const updated = { ...prev };
        delete updated[selectedSymbol];
        return updated;
      });
      setHistoricalData(prev => {
        const updated = { ...prev };
        delete updated[selectedSymbol];
        return updated;
      });
      // Clear backfill tracking so data is re-fetched for the new date
      backfilledSymbolsRef.current.forEach(key => {
        if (key.startsWith(selectedSymbol)) {
          backfilledSymbolsRef.current.delete(key);
        }
      });
      setIsLoadingHistorical(true);
      setHistoricalDataStatus('Loading data...');
    }

    setCurrentDate(date);
    // ✅ Always bump the refetch key so the backfill useEffect fires even when
    // the selected date string equals what effectiveDate was already resolving to.
    setForceRefetchKey(k => k + 1);
  }, [selectedSymbol]);

  // Navigate to the previous available trading date
  const handlePrevDate = useCallback(() => {
    if (currentDateIdx > 0) {
      handleDateChange(sortedDates[currentDateIdx - 1]);
    }
  }, [currentDateIdx, sortedDates, handleDateChange]);

  // Navigate to the next available trading date
  const handleNextDate = useCallback(() => {
    if (currentDateIdx < sortedDates.length - 1) {
      handleDateChange(sortedDates[currentDateIdx + 1]);
    }
  }, [currentDateIdx, sortedDates, handleDateChange]);

  // ── URL param auto-select: ?company=RELIANCE&exchange=NSE ──
  // Uses window.location.search (no Suspense / useSearchParams needed)
  const urlParamAppliedRef = useRef(false);
  useEffect(() => {
    if (urlParamAppliedRef.current || !companies || companies.length === 0) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlCompany = params.get('company');
    if (!urlCompany) return;
    urlParamAppliedRef.current = true;
    const urlExchange = params.get('exchange') || undefined;
    const urlMarker = params.get('marker') || undefined;
    const found = companies.find((c: any) => c.company_code === urlCompany);
    handleCompanyChange(
      urlCompany,
      urlExchange || found?.exchange || 'NSE',
      urlMarker || found?.marker || 'EQ'
    );
  }, [companies, handleCompanyChange]);

  // Subscription Handlers
  const handleSubscribeCompanies = useCallback(async (companyCodes: string[]) => {
    if (!companyCodes || companyCodes.length === 0) return;

    // Always resolve the live socket — getSocket() returns the module-level singleton
    // which is already the real socket after the placeholder→real migration.
    // This avoids a race where socketRef still holds the disconnected placeholder.
    const activeSocket = getSocket();
    if (!activeSocket || !activeSocket.connected) {
      // One more chance: sync our ref and check again
      socketRef.current = activeSocket;
      if (!activeSocket || !activeSocket.connected) {
        toast.error('Not connected to server. Please wait for connection.');
        return;
      }
    }
    // Keep ref in sync
    socketRef.current = activeSocket;

    setIsSubscribing(true);
    try {
      console.log(`📤 Sending subscription request for ${companyCodes.length} companies via WebSocket to port 5001`);

      const fyersSymbols = companyCodes
        .map(code => {
          const company = companies?.find((c: any) => c.company_code === code);
          const exchange = company?.exchange || 'NSE';
          const marker = company?.marker || 'EQ';

          if (!marker || marker.toUpperCase() === 'STOPPED' || marker === '') {
            console.log(`⏭️ Skipping ${code}: marker is "${marker}"`);
            return null;
          }

          return `${exchange}:${code}-${marker}`;
        })
        .filter((s): s is string => s !== null);

      if (fyersSymbols.length === 0) {
        toast.warning('No valid companies to subscribe (all are STOPPED or invalid)');
        setIsSubscribing(false);
        return;
      }

      console.log(`📤 Converted to Fyers symbols:`, fyersSymbols.slice(0, 5), `... (${fyersSymbols.length} total)`);

      // ✅ Pre-register symbols BEFORE emitting so data arriving during/before callback
      // is accepted by handlers (avoids race where historical data arrives before callback fires)
      fyersSymbols.forEach(s => {
        allSubscribedSymbolsRef.current.add(s);
      });

      activeSocket.emit('subscribe_companies', {
        symbols: fyersSymbols,
        companyCodes: companyCodes
      }, (response: any) => {
        setIsSubscribing(false);

        if (response && response.success) {
          console.log('✅ Subscription successful:', response);
          toast.success(`Successfully subscribed to ${response.count || fyersSymbols.length} companies`);

          fyersSymbols.forEach(s => {
            isSubscribedRef.current.add(s);
            // allSubscribedSymbolsRef already updated above
          });

          const failedSymbols = response.failed || response.invalid_symbols || [];
          const successfulSymbols = fyersSymbols.filter((s: string) => !failedSymbols.includes(s));

          if (successfulSymbols.length > 0) {
            console.log('💾 Saving successful subscriptions:', successfulSymbols.length);
            fetch('/api/admin/subscribed-companies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: successfulSymbols }),
            }).catch(err => console.error('Failed to save successful subscriptions:', err));
          }

          if (response.failed && response.failed.length > 0) {
            console.log('⚠️ Some symbols failed:', response.failed);
            fetch('/api/admin/failed-subscriptions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: response.failed }),
            }).catch(err => console.error('Failed to report failed symbols:', err));

            toast.warning(`${response.failed.length} symbol(s) failed to subscribe`);
          }
        } else {
          const errorMsg = response?.error || response?.message || 'Subscription failed';
          console.error('❌ Subscription failed:', response);
          toast.error(errorMsg);

          // ✅ Roll back pre-registered symbols on full failure
          fyersSymbols.forEach(s => {
            allSubscribedSymbolsRef.current.delete(s);
          });

          const invalidSymbols = response?.invalid_symbols || response?.invalidSymbols || [];
          if (invalidSymbols.length > 0) {
            console.log('🚫 Invalid symbols detected:', invalidSymbols);
            fetch('/api/admin/failed-subscriptions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: invalidSymbols }),
            }).catch(err => console.error('Failed to report invalid symbols:', err));

            setSubscriptionErrors({
              code: response?.code || -300,
              message: errorMsg,
              invalidSymbols: invalidSymbols,
              timestamp: Date.now()
            });

            setFailedSymbols(prev => [...new Set([...prev, ...invalidSymbols])]);
          }
        }
      });

      setTimeout(() => {
        setIsSubscribing(false);
      }, 30000);

    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      toast.error(error.message || 'Failed to update subscriptions');
      setIsSubscribing(false);
    }
  }, [companies]);

  const handleMultiAction = useCallback(
    (action: 'multi-chart' | 'new-tabs' | 'historical' | 'subscribe', codes: string[]) => {
      if (codes.length === 0) return;
      if (action === 'subscribe') {
        handleSubscribeCompanies(codes);
      } else if (action === 'multi-chart') {
        window.open(`/live-market?companies=${encodeURIComponent(codes.join(','))}`, '_blank');
      } else if (action === 'new-tabs') {
        codes.forEach(code => {
          const company = companies?.find((c: any) => c.company_code === code);
          const exchange = encodeURIComponent(company?.exchange || 'NSE');
          const marker = encodeURIComponent(company?.marker || 'EQ');
          window.open(`/market-data?company=${code}&exchange=${exchange}&marker=${marker}`, '_blank');
        });
      } else if (action === 'historical') {
        codes.forEach(code => {
          const company = companies?.find((c: any) => c.company_code === code);
          const exchange = encodeURIComponent(company?.exchange || 'NSE');
          const marker = encodeURIComponent(company?.marker || 'EQ');
          window.open(`/?company=${code}&exchange=${exchange}&marker=${marker}`, '_blank');
        });
      }
    },
    [companies, handleSubscribeCompanies]
  );

  const handleSubscribeAll = useCallback(() => {
    if (isSubscribing) {
      toast.warning("Subscription already in progress");
      return;
    }

    if (!companies || companies.length === 0) {
      toast.error("No companies available");
      return;
    }

    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
    }

    const targetList = filteredCompanies.length > 0 ? filteredCompanies : companies;
    const companyCodes = targetList.map((c: any) => c.company_code).filter(Boolean);

    handleSubscribeCompanies(companyCodes);
  }, [companies, handleSubscribeCompanies, isSubscribing, filteredCompanies]);

  // Event Handlers
  const handleConnect = useCallback(() => {
    // Refresh socketRef to the current real socket.
    // getSocket() returns the module-level singleton which is updated after the
    // placeholder→real-socket migration, so this cures a stale-ref race where
    // socketRef still points to the disconnected placeholder.
    socketRef.current = getSocket();
    console.log('✅ Connected to server');
    setSocketStatus('Connected');
    setIsReconnecting(false);
    setSocketSource(getSocketSourceLabel());

    if (socketRef.current) {
      socketRef.current.emit('get_trading_status', {}, (response: any) => {
        if (response) {
          setTradingHours({
            start: response.trading_start || '',
            end: response.trading_end || '',
            current: response.current_time || '',
            isActive: response.trading_active || false
          });

          if (response.active_symbols) {
            activeSymbolsRef.current = response.active_symbols;
          }
          if (response.total_data_points) {
            backgroundDataPointsRef.current = response.total_data_points;
          }
        }
      });

      // ✅ Re-subscribe ALL previously tracked symbols, not just the selected one
      // This ensures background data keeps flowing for all companies
      // Use allSubscribedSymbolsRef because isSubscribedRef gets cleared on disconnect
      const symbolsToResubscribe = Array.from(allSubscribedSymbolsRef.current);
      const currentSymbol = selectedSymbolRef.current;

      // Always include the currently selected symbol
      if (currentSymbol && !symbolsToResubscribe.includes(currentSymbol)) {
        symbolsToResubscribe.push(currentSymbol);
      }

      if (symbolsToResubscribe.length > 0) {
        console.log(`🔄 Re-subscribing to ${symbolsToResubscribe.length} symbols after reconnection`);
        // Use subscribe_companies for batch re-subscription (more efficient)
        socketRef.current.emit('subscribe_companies', {
          symbols: symbolsToResubscribe,
          companyCodes: symbolsToResubscribe.map(s => s.split(':')[1]?.split('-')[0] || s)
        }, (response: any) => {
          if (response && response.success) {
            symbolsToResubscribe.forEach(s => isSubscribedRef.current.add(s));
            console.log(`✅ Successfully re-subscribed to ${symbolsToResubscribe.length} symbols after reconnection`);
          }
        });
      }
    }
  }, []);  // ✅ Removed selectedSymbol dep — use ref instead

  const handleDisconnect = useCallback((reason: string) => {
    console.log('❌ Disconnected:', reason);

    if (reason !== 'io client disconnect') {
      setSocketStatus('Reconnecting...');
      setIsReconnecting(true);
      console.log('🔄 Will attempt to reconnect automatically...');
    } else {
      setSocketStatus(`Disconnected: ${reason}`);
      setIsReconnecting(false);
    }
    isSubscribedRef.current.clear();
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('❌ Socket error:', error);

    const isSubscriptionError = error && (
      error.code === -300 ||
      error.type === 'sub' ||
      error.invalid_symbols ||
      (typeof error.message === 'string' && (
        error.message.includes('invalid_symbols') ||
        error.message.includes('-300') ||
        error.message.includes('STOPPED')
      ))
    );

    if (isSubscriptionError) {
      console.error('🚫 Subscription error detected:', error);

      let invalidSymbols = error.invalid_symbols || [];
      if (invalidSymbols.length === 0 && typeof error.message === 'string') {
        const match = error.message.match(/invalid_symbols['":\s]*\[([^\]]+)\]/);
        if (match) {
          invalidSymbols = match[1]
            .split(',')
            .map((s: string) => s.trim().replace(/['"]/g, ''))
            .filter((s: string) => s.length > 0);
        }
      }

      setSubscriptionErrors({
        code: error.code || -300,
        message: error.message || 'Invalid symbol subscription failed',
        invalidSymbols: invalidSymbols,
        timestamp: Date.now()
      });

      setFailedSymbols(prev => {
        const combined = [...new Set([...prev, ...invalidSymbols])];
        return combined;
      });
    } else {
      setSocketStatus('Error');
    }
  }, []);

  const handleSubscriptionError = useCallback((error: any) => {
    console.error('🚫 Fyers subscription error:', error);

    let errorData = error;
    let errorMessage = '';

    if (typeof error === 'string') {
      errorMessage = error;
      try {
        errorData = JSON.parse(error);
      } catch {
        errorData = { message: error };
      }
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || JSON.stringify(error);
    }

    let invalidSymbols: string[] = [];

    if (Array.isArray(errorData.invalid_symbols)) {
      invalidSymbols = errorData.invalid_symbols;
    } else if (Array.isArray(errorData.invalidSymbols)) {
      invalidSymbols = errorData.invalidSymbols;
    }

    if (invalidSymbols.length === 0 && errorMessage) {
      const match = errorMessage.match(/invalid_symbols['":\s]*\[([^\]]+)\]/);
      if (match) {
        invalidSymbols = match[1]
          .split(',')
          .map((s: string) => s.trim().replace(/['"]/g, ''))
          .filter((s: string) => s.length > 0);
      }
    }

    console.log('🔍 Parsed invalid symbols:', invalidSymbols);

    if (invalidSymbols.length > 0) {
      fetch('/api/admin/failed-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbols: invalidSymbols }),
      }).catch(err => console.error('Failed to report invalid symbols:', err));
    }

    setSubscriptionErrors({
      code: errorData.code || -300,
      message: errorData.message || errorMessage || 'Symbol subscription failed',
      invalidSymbols: invalidSymbols,
      timestamp: Date.now()
    });

    setFailedSymbols(prev => {
      const combined = [...new Set([...prev, ...invalidSymbols])];
      return combined;
    });
  }, []);

  const clearSubscriptionErrors = useCallback(() => {
    setSubscriptionErrors(null);
    setFailedSymbols([]);
  }, []);

  const handleMarketDataUpdate = useCallback((data: MarketData) => {
    if (!data || !data.symbol) return;

    // ✅ Strict symbol guard: reject data for symbols we never subscribed to.
    // This prevents stale/leaked data from corrupting state after reconnects.
    if (
      allSubscribedSymbolsRef.current.size > 0 &&
      !allSubscribedSymbolsRef.current.has(data.symbol) &&
      data.symbol !== selectedSymbolRef.current
    ) {
      return;
    }

    // ✅ Cross-symbol leak guard
    if (!isPriceSaneForSymbol(data.symbol, data.ltp as unknown as number)) {
      return;
    }
    updateReferencePrice(data.symbol, data.ltp as unknown as number);

    updateCountRef.current++;
    lastDataReceivedRef.current = Date.now();
    dataCountRef.current++;

    setMarketData(prev => ({
      ...prev,
      [data.symbol]: data
    }));

    setHistoricalData(prev => {
      const symbol = data.symbol;
      const existingHistory = prev[symbol] || [];

      const dataMap = new Map<number, MarketData>();

      existingHistory.forEach(point => {
        dataMap.set(point.timestamp, point);
      });

      dataMap.set(data.timestamp, data);

      const newHistory = Array.from(dataMap.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50000);

      return {
        ...prev,
        [symbol]: newHistory
      };
    });
  }, []);

  const handleChartUpdate = useCallback((update: ChartUpdate) => {
    if (!update || !update.symbol) return;

    // ✅ Strict symbol guard: only process updates for subscribed symbols
    if (
      allSubscribedSymbolsRef.current.size > 0 &&
      !allSubscribedSymbolsRef.current.has(update.symbol) &&
      update.symbol !== selectedSymbolRef.current
    ) {
      return;
    }

    // ✅ Cross-symbol leak guard
    if (!isPriceSaneForSymbol(update.symbol, update.price)) {
      return;
    }
    updateReferencePrice(update.symbol, update.price);

    // ✅ Live-indicator heartbeat
    lastDataReceivedRef.current = Date.now();
    updateCountRef.current++;

    setChartUpdates(prev => {
      const symbolUpdates = prev[update.symbol] || [];
      const newUpdates = [...symbolUpdates, update].slice(-1000);

      return {
        ...prev,
        [update.symbol]: newUpdates
      };
    });

    // ===== REAL-TIME OHLC UPDATE =====
    // Update OHLC candle for the current minute with real-time tick data
    // This ensures smooth chart updates without waiting for batch OHLC data
    setOhlcData(prev => {
      const existingCandles = prev[update.symbol] || [];
      const minuteTs = Math.floor(update.timestamp / 60) * 60;
      const price = update.price;
      const cumulativeVolume = update.volume || 0;  // vol_traded_today (cumulative)

      // Get or create the symbol's volume tracking map
      if (!cumulativeVolumeRef.current.has(update.symbol)) {
        cumulativeVolumeRef.current.set(update.symbol, new Map());
      }
      const symbolVolumeMap = cumulativeVolumeRef.current.get(update.symbol)!;

      // Find or create the current minute's candle
      const candleMap = new Map<number, OHLCData>();
      existingCandles.forEach(c => candleMap.set(c.timestamp, c));

      const existingCandle = candleMap.get(minuteTs);

      if (existingCandle) {
        // Update existing candle
        // Calculate volume delta: current cumulative - cumulative at start of this minute
        if (!symbolVolumeMap.has(minuteTs)) {
          // First real-time tick for a historically-loaded candle.
          // Use a "virtual" start = (cumulativeVolume - historicalVolume) so that
          // volumeDelta on this tick equals historicalVolume (preserving it), and
          // subsequent ticks correctly accumulate on top of it.
          symbolVolumeMap.set(minuteTs, cumulativeVolume - (existingCandle.volume ?? 0));
        }
        const startOfMinuteVolume = symbolVolumeMap.get(minuteTs)!;
        const volumeDelta = Math.max(0, cumulativeVolume - startOfMinuteVolume);

        // Anchor the deviation gate to a STABLE baseline so a single drifting
        // tick can't keep poisoning subsequent ticks via a mutating close.
        const anchorOpen = existingCandle.open > 0 ? existingCandle.open : price;
        const refPrice = referencePriceRef.current.get(update.symbol) ?? anchorOpen;
        const baseline = refPrice > 0 ? refPrice : anchorOpen;
        const priceDeviation = baseline > 0 ? Math.abs(price - baseline) / baseline : 0;
        const safePrice = priceDeviation > PRICE_SANITY_MAX_DEVIATION ? baseline : price;

        candleMap.set(minuteTs, {
          ...existingCandle,
          high: Math.max(existingCandle.high, safePrice),
          low: Math.min(existingCandle.low, safePrice),
          close: safePrice,
          volume: volumeDelta
        });
      } else {
        // Create new candle for this minute
        // Store the cumulative volume at the START of this new minute
        // This is used to calculate delta for the entire minute
        symbolVolumeMap.set(minuteTs, cumulativeVolume);

        // Clean up old minute entries (keep only last 500 minutes ≈ full trading day).
        // Minutes are inserted chronologically so the minimum key is the oldest.
        // Use Map.size check instead of O(N) sort+shift.
        if (symbolVolumeMap.size > 500) {
          let oldest = Infinity;
          for (const k of symbolVolumeMap.keys()) {
            if (k < oldest) oldest = k;
          }
          symbolVolumeMap.delete(oldest);
        }

        // Use trusted reference price as the baseline for the new candle's
        // open; fall back to the previous candle's close only when no ref.
        const prevCandles = Array.from(candleMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        const lastCandle = prevCandles.length > 0 ? prevCandles[prevCandles.length - 1] : null;
        const refPrice = referencePriceRef.current.get(update.symbol);
        const baseline = refPrice && refPrice > 0
          ? refPrice
          : (lastCandle?.close ?? 0);
        const deviation = baseline > 0 ? Math.abs(price - baseline) / baseline : 0;
        const safeOpen = (baseline > 0 && deviation > PRICE_SANITY_MAX_DEVIATION) ? baseline : price;

        candleMap.set(minuteTs, {
          timestamp: minuteTs,
          open: safeOpen,
          high: safeOpen,
          low: safeOpen,
          close: safeOpen,
          volume: 0  // First tick of minute, delta is 0
        });
      }

      const merged = Array.from(candleMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      return {
        ...prev,
        [update.symbol]: merged
      };
    });
  }, [isPriceSaneForSymbol, updateReferencePrice]);

  const handleHistoricalData = useCallback((data: { symbol: string, data: MarketData[] }) => {
    if (!data || !data.symbol || !Array.isArray(data.data)) return;

    // ✅ Strict symbol guard
    if (
      allSubscribedSymbolsRef.current.size > 0 &&
      !allSubscribedSymbolsRef.current.has(data.symbol) &&
      data.symbol !== selectedSymbolRef.current
    ) {
      return;
    }

    console.log(`📈 Received historical data for ${data.symbol}: ${data.data.length} points`);

    // ✅ Live-indicator heartbeat
    lastDataReceivedRef.current = Date.now();

    const sortedData = [...data.data].sort((a, b) => a.timestamp - b.timestamp);

    setHistoricalData(prev => {
      const existingData = prev[data.symbol] || [];
      const dataMap = new Map<number, MarketData>();

      existingData.forEach(point => {
        dataMap.set(point.timestamp, point);
      });

      sortedData.forEach(point => {
        dataMap.set(point.timestamp, point);
      });

      const mergedData = Array.from(dataMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`📈 [handleHistoricalData] Merged: ${existingData.length} existing + ${sortedData.length} new = ${mergedData.length} total points`);

      return {
        ...prev,
        [data.symbol]: mergedData
      };
    });

    if (sortedData.length > 0) {
      // ✅ Seed leak-guard reference from latest historical close
      const last = sortedData[sortedData.length - 1];
      const seed = (last as any).close ?? last.ltp;
      updateReferencePrice(data.symbol, seed as number);

      setMarketData(prev => ({
        ...prev,
        [data.symbol]: last
      }));

      const chartData = sortedData.map(item => ({
        symbol: data.symbol,
        price: item.ltp,
        timestamp: item.timestamp,
        volume: item.volume || 0,
        change: item.change || 0,
        changePercent: item.changePercent || 0
      }));

      setChartUpdates(prev => {
        const existingUpdates = prev[data.symbol] || [];
        const updateMap = new Map<number, typeof chartData[0]>();

        existingUpdates.forEach(update => {
          updateMap.set(update.timestamp, update);
        });

        chartData.forEach(update => {
          updateMap.set(update.timestamp, update);
        });

        const mergedUpdates = Array.from(updateMap.values())
          .sort((a, b) => a.timestamp - b.timestamp);

        return {
          ...prev,
          [data.symbol]: mergedUpdates
        };
      });
    }
  }, [updateReferencePrice]);

  const handleOhlcData = useCallback((data: { symbol: string, data: OHLCData[] }) => {
    if (!data || !data.symbol || !Array.isArray(data.data)) {
      console.warn(`📊 Invalid OHLC data received:`, data);
      return;
    }

    // ✅ Strict symbol guard: only process OHLC for subscribed symbols
    if (
      allSubscribedSymbolsRef.current.size > 0 &&
      !allSubscribedSymbolsRef.current.has(data.symbol) &&
      data.symbol !== selectedSymbolRef.current
    ) {
      return;
    }

    console.log(`📊 Received OHLC data for ${data.symbol}: ${data.data.length} candles`);
    // ✅ Live-indicator heartbeat
    lastDataReceivedRef.current = Date.now();
    // Debug: Log first and last candle to verify OHLC values
    if (data.data.length > 0) {
      const first = data.data[0];
      const last = data.data[data.data.length - 1];
      console.log(`📊 First OHLC:`, { ts: first.timestamp, o: first.open, h: first.high, l: first.low, c: first.close, v: first.volume });
      console.log(`📊 Last OHLC:`, { ts: last.timestamp, o: last.open, h: last.high, l: last.low, c: last.close, v: last.volume });
    }

    // IMPORTANT: MERGE incoming candles with existing data (don't replace!)
    // This preserves historical backfill data while adding real-time updates
    setOhlcData(prev => {
      const existingCandles = prev[data.symbol] || [];
      const candleMap = new Map<number, OHLCData>();

      // Safeguard: detect and fix corrupted candles from the server.
      //
      // Two independent checks:
      //  1. OHLC range check — a 1-minute candle with (high-low)/close > 50% is
      //     impossible under normal market conditions. Filter these out entirely.
      //     (Caused by stale/wrong LTP on first tick after subscription, e.g.
      //     Fyers sending wrong initial price for a newly subscribed symbol.)
      //  2. Volume outlier check — a candle with volume > 50× the median is clearly
      //     wrong (caused by history candle being updated with cumulative vol_traded_today
      //     instead of the per-minute delta). Clamp outlier candles to 10× median.
      //     NOTE: We do NOT convert the entire dataset to deltas here because the
      //     backend already sends delta volumes for all candles except the spike.
      //     Converting ALL to deltas would make all per-minute middle candles = 0.
      let sanitizedCandles = data.data;
      if (data.data.length >= 1) {
        const sorted = [...data.data].sort((a, b) => a.timestamp - b.timestamp);

        // --- Check 1: Filter corrupted OHLC candles (impossible price range) ---
        let ohlcFiltered = sorted.filter(candle => {
          const close = candle.close ?? 0;
          if (close <= 0) return false;
          const rangeRatio = (candle.high - candle.low) / close;
          if (rangeRatio > 0.50) {
            console.warn(`📊 [handleOhlcData] Filtering corrupted OHLC candle for ${data.symbol}: ts=${candle.timestamp}, O=${candle.open}, H=${candle.high}, L=${candle.low}, C=${candle.close}, range=${(rangeRatio * 100).toFixed(1)}%`);
            return false;
          }
          return true;
        });

        // --- Check 2: Clamp outlier volume candles (volume spike from cumulative vol bug) ---
        if (ohlcFiltered.length > 0) {
          const nonZeroVols = ohlcFiltered.map(c => c.volume ?? 0).filter(v => v > 0).sort((a, b) => a - b);
          if (nonZeroVols.length > 0) {
            const median = nonZeroVols[Math.floor(nonZeroVols.length / 2)];
            const threshold = median * 50; // 50× median is clearly wrong
            const hasOutlier = ohlcFiltered.some(c => (c.volume ?? 0) > threshold);
            if (hasOutlier) {
              const clampTo = median * 10; // Clamp to 10× median — preserve other candles as-is
              console.warn(`📊 [handleOhlcData] Clamping outlier volume candle(s) for ${data.symbol} (median=${median}, threshold=${threshold}, clampTo=${clampTo})`);
              ohlcFiltered = ohlcFiltered.map(candle => ({
                ...candle,
                volume: Math.min(candle.volume ?? 0, clampTo)
              }));
            }
          }
        }

        sanitizedCandles = ohlcFiltered;
      }

      // Add existing candles first (historical backfill)
      existingCandles.forEach(candle => {
        candleMap.set(candle.timestamp, candle);
      });

      // Add/update with sanitized candles (real-time takes priority)
      sanitizedCandles.forEach(candle => {
        candleMap.set(candle.timestamp, candle);
      });

      // Convert to sorted array
      const merged = Array.from(candleMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      // ✅ Seed leak-guard reference from latest known close
      if (merged.length > 0) {
        updateReferencePrice(data.symbol, merged[merged.length - 1].close);
      }

      console.log(`📊 [handleOhlcData] Merged: ${existingCandles.length} existing + ${data.data.length} new = ${merged.length} total`);

      return {
        ...prev,
        [data.symbol]: merged
      };
    });
  }, [updateReferencePrice]);

  const handleHeartbeat = useCallback((data: any) => {
    if (!data) return;

    // ✅ Heartbeats arrive every 10s — proof that the live pipeline is alive,
    // even on a thinly-traded symbol that produces sparse ticks.
    lastDataReceivedRef.current = Date.now();

    setTradingHours(prev => ({
      ...prev,
      current: new Date().toISOString(),
      isActive: data.trading_active || false
    }));

    if (data.active_symbols && Array.isArray(data.active_symbols)) {
      activeSymbolsRef.current = data.active_symbols;
    }
    if (typeof data.total_cached_points === 'number') {
      backgroundDataPointsRef.current = data.total_cached_points;
    }
  }, []);

  // Formatters
  const formatPrice = useCallback((price?: number) => {
    return price?.toFixed(2) || '0.00';
  }, []);

  const formatChange = useCallback((change?: number, percent?: number) => {
    if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  }, []);

  const getChangeClass = useCallback((change?: number) => {
    if (!change && change !== 0) return '';
    return change >= 0 ? 'text-green-500' : 'text-red-500';
  }, []);

  // Effects
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const timeDiff = (now - lastUpdateTimeRef.current) / 1000;
      const frequency = timeDiff > 0 ? Math.round(updateCountRef.current / timeDiff) : 0;
      updateFrequencyRef.current = frequency; // ref only — not rendered, no re-render needed
      updateCountRef.current = 0;
      lastUpdateTimeRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setIsClient(true);
    console.log('Component mounted');

    const checkMarketStatus = () => {
      const status = isMarketOpen();
      setMarketOpen(status.isOpen);
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  // Auth status check — show orange banner when not authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/fyers/status');
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(data.authenticated === true && data.token_valid === true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
    const authInterval = setInterval(checkAuth, 60000);
    return () => clearInterval(authInterval);
  }, []);

  // Trigger deferred initialization on next frame for smooth page transitions
  useEffect(() => {
    if (!isClient) return;

    // Use requestAnimationFrame to defer initialization until after page is interactive
    const frameId = requestAnimationFrame(() => {
      startTransition(() => {
        setIsInitialized(true);
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [isClient, startTransition]);

  // Health check for prediction services - DEFERRED for smooth page load
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    // Always re-check GTT health on mount — the GTT server may have started/stopped
    // Only skip if both are already confirmed available (not 'unavailable' which needs re-check)

    const checkPredictionServicesHealth = async () => {
      setIsCheckingHealth(true);

      try {
        const predictionHealth = await PredictionAPIService.checkHealth({ timeout: 5000 });
        // Must check running/status fields — the proxy always returns HTTP 200 even when service is down
        const isPredAvailable = predictionHealth?.running === true || predictionHealth?.status === 'healthy';
        setPredictionServiceHealth(isPredAvailable ? 'available' : 'unavailable');
        console.log('✅ [Health Check] Prediction service:', isPredAvailable ? 'available' : 'unavailable', predictionHealth);
      } catch (error) {
        console.warn('❌ [Health Check] Prediction service unavailable:', error);
        setPredictionServiceHealth('unavailable');
      }

      try {
        const gttHealth = await gttService.healthCheck();
        const isGttAvailable = gttHealth.proxy || gttHealth.backend;
        setGttServiceHealth(isGttAvailable ? 'available' : 'unavailable');
        console.log('✅ [Health Check] GTT service:', gttHealth);
      } catch (error) {
        console.warn('❌ [Health Check] GTT service unavailable:', error);
        setGttServiceHealth('unavailable');
      }

      setIsCheckingHealth(false);
    };

    checkPredictionServicesHealth();

    const healthCheckInterval = setInterval(checkPredictionServicesHealth, 120000);

    return () => clearInterval(healthCheckInterval);
  }, [isClient, isInitialized]);

  // Fetch subscription status from JSON files - DEFERRED
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    // Skip initial fetch if we already have cached data
    if (hasLoadedDataRef.current &&
      (failedSymbols.length > 0 || stoppedSymbols.length > 0 || permanentlyStoppedSymbols.length > 0)) {
      console.log('⚡ [Subscription Status] Using cached data');
      return;
    }

    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/admin/subscription-status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setFailedSymbols(data.data.failed || []);
            setStoppedSymbols(data.data.stopped || []);
            setPermanentlyStoppedSymbols(data.data.permanentlyStopped || []);
            console.log('📊 Subscription status loaded:', data.counts);
          }
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      }
    };

    fetchSubscriptionStatus();

    const interval = setInterval(fetchSubscriptionStatus, 30000);
    return () => clearInterval(interval);
  }, [isClient, isInitialized]);

  // Socket initialization - runs ONCE, listeners persist across company switches
  // CRITICAL: This must NOT depend on selectedSymbol. The socket is a singleton
  // and listeners handle data for ALL symbols via data.symbol routing.
  useEffect(() => {
    if (!isClient || !isInitialized) return;

    // Truly one-time init: if socket already set up, just ensure ref is current
    if (hasInitializedSocketRef.current) {
      if (!socketRef.current) {
        socketRef.current = getSocket();
      }
      return;
    }

    console.log('🚀 Initializing WebSocket connection...');
    hasInitializedSocketRef.current = true;

    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('subscriptionError', handleSubscriptionError);
    socket.on('fyersError', handleSubscriptionError);
    socket.on('marketDataUpdate', handleMarketDataUpdate);
    socket.on('chartUpdate', handleChartUpdate);
    socket.on('historicalData', handleHistoricalData);
    socket.on('ohlcData', handleOhlcData);
    socket.on('heartbeat', handleHeartbeat);

    const unsubscribeReconnect = onReconnect(() => {
      console.log('🔄 Reconnection callback triggered');
      if (!socketRef.current) return;

      // ✅ Re-subscribe ALL tracked symbols on reconnect (not just current)
      const allSymbols = Array.from(allSubscribedSymbolsRef.current);
      const currentSymbol = selectedSymbolRef.current;
      if (currentSymbol && !allSymbols.includes(currentSymbol)) {
        allSymbols.push(currentSymbol);
      }

      if (allSymbols.length > 0) {
        console.log(`🔄 Re-subscribing to ${allSymbols.length} symbols after reconnection`);
        isSubscribedRef.current.clear();
        socketRef.current.emit('subscribe_companies', {
          symbols: allSymbols,
          companyCodes: allSymbols.map(s => s.split(':')[1]?.split('-')[0] || s)
        }, (response: any) => {
          if (response && response.success) {
            allSymbols.forEach(s => isSubscribedRef.current.add(s));
            console.log(`✅ Re-subscribed to ${allSymbols.length} symbols after reconnection`);
          }
        });
      }
    });

    // ✅ Sync `socketStatus` with the actual socket.connected on mount.
    // The socket is a module-singleton — if it was already connected before
    // this page mounted (e.g. user navigated from market-movers), the 'connect'
    // event won't re-fire and we'd be stuck showing Offline.
    if (socket.connected) {
      setSocketStatus('Connected');
      setIsReconnecting(false);
    }

    // Track which server (primary/fallback) is active and update the UI badge
    const unsubscribeSource = onSocketSourceChange(label => setSocketSource(label));
    setSocketSource(getSocketSourceLabel());

    // Cleanup only runs on unmount (deps are stable after init)
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socket.off('subscriptionError', handleSubscriptionError);
      socket.off('fyersError', handleSubscriptionError);
      socket.off('marketDataUpdate', handleMarketDataUpdate);
      socket.off('chartUpdate', handleChartUpdate);
      socket.off('historicalData', handleHistoricalData);
      socket.off('ohlcData', handleOhlcData);
      socket.off('heartbeat', handleHeartbeat);
      unsubscribeReconnect();
      unsubscribeSource();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, isInitialized]);

  // Subscribe + backfill on symbol change
  // ✅ KEY DESIGN: We NEVER unsubscribe on switch — all companies stay subscribed
  // and accumulate data in the background. Switching just changes the view.
  useEffect(() => {
    if (!isClient || !selectedSymbol || !socketRef.current) return;

    const socket = socketRef.current;
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    // ✅ When the user has explicitly chosen a historical date, use it for port-6969 fetches.
    // Otherwise fall back to today (live mode).
    const fetchDate = currentDate || todayIST;

    // Check if we already have valid cached OHLC data for the TARGET date
    const hasCachedOhlcData = ohlcData[selectedSymbol] && ohlcData[selectedSymbol].length > 0;
    const cacheIsFromTargetDate = hasCachedOhlcData && (() => {
      const firstCandle = ohlcData[selectedSymbol][0];
      const candleDate = new Date(firstCandle.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return candleDate === fetchDate;
    })();

    // Pre-compute the backfill key so all paths below can use it
    const backfillKey = `${selectedSymbol}_${fetchDate}`;
    const hasBeenBackfilled = backfilledSymbolsRef.current.has(backfillKey);

    // ✅ FAST PATH: Data cached from target date + subscribed + backfill complete → nothing to do
    if (cacheIsFromTargetDate && isSubscribedRef.current.has(selectedSymbol) && hasBeenBackfilled) {
      console.log(`⚡ [Data] Instant switch to ${selectedSymbol} — ${ohlcData[selectedSymbol].length} candles cached, backfill done`);
      hasLoadedDataRef.current = true;
      setIsLoadingHistorical(false);
      setHistoricalDataStatus('');
      setHasBackfillData(true);
      return; // Fully complete — nothing more to do
    }

    // ✅ If we have SOME data for the target date, show it immediately (no spinner)
    // while we silently fill any gaps via backfill below.
    // CRITICAL: Do NOT short-circuit here — always proceed to backfill unless
    // hasBeenBackfilled is true, because WebSocket can inject partial data
    // (e.g. only the last hour) between a data-clear and the backfill effect.
    if (cacheIsFromTargetDate) {
      console.log(`⚡ [Data] Partial cache for ${selectedSymbol} (${ohlcData[selectedSymbol].length} candles) — showing instantly, will fill gaps`);
      hasLoadedDataRef.current = true;
      setIsLoadingHistorical(false);
      setHistoricalDataStatus('');
      setHasBackfillData(hasBeenBackfilled);
      // Intentional fall-through: still need to subscribe and run backfill below
    } else {
      console.log(`📡 [Data] No cache for ${selectedSymbol} — subscribing + fetching...`);
      setHasBackfillData(false);
    }

    // Subscribe if not already subscribed (needed for both partial-cache and no-cache paths)
    if (!isSubscribedRef.current.has(selectedSymbol)) {
      // ✅ Pre-register so handlers accept data immediately (before callback fires)
      allSubscribedSymbolsRef.current.add(selectedSymbol);
      socket.emit('subscribe', { symbol: selectedSymbol }, (response: any) => {
        if (response && response.success) {
          isSubscribedRef.current.add(selectedSymbol);
          console.log(`✅ Subscribed to ${selectedSymbol} (${cacheIsFromTargetDate ? 'had partial cache' : 'no cache'})`);
        }
      });
    }

    // If fully backfilled, subscription is all we needed — no fetch required
    if (hasBeenBackfilled) {
      return;
    }

    /**
     * ROBUST HISTORICAL DATA BACKFILL
     * 
     * This function handles three scenarios:
     * 1. After market hours: Fetch ENTIRE day's data from external server (6969)
     * 2. Mid-day subscription: Broker only sends data from subscription time,
     *    so we backfill from 9:15 AM to subscription time from external server
     * 3. Market open with full data: No backfill needed
     */
    const fetchAndBackfillHistoricalData = async (signal: AbortSignal) => {
      // ✅ Use the user-selected historical date when set; otherwise fall back to today.
      // `fetchDate` is already computed above: currentDate || todayIST.
      // Using fetchDate ensures port-6969 is queried for the correct trading day.
      const todayForFetch = todayIST; // alias — todayIST is in the outer useEffect scope

      // backfillKey is declared in the outer scope — reuse it here (don't redeclare)
      // Guard: if somehow we get here despite the key existing, bail out.
      if (backfilledSymbolsRef.current.has(backfillKey)) {
        console.log(`📡 [Backfill] Already backfilled ${backfillKey}, skipping`);
        setIsLoadingHistorical(false);
        setHasBackfillData(true);
        return;
      }

      // Check if cancelled before starting
      if (signal.aborted) {
        setIsLoadingHistorical(false);
        return;
      }

      // Only show the loading spinner if we have NO partial data to display yet.
      // When cacheIsFromTargetDate is true we already cleared the spinner above.
      if (!cacheIsFromTargetDate) {
        setIsLoadingHistorical(true);
      }
      setHistoricalDataStatus('Checking data completeness...');

      try {
        // For historical dates (not today), always treat as "after market" — fetch the full day.
        const isHistoricalMode = fetchDate !== todayForFetch;
        const marketStatus = isMarketOpen();
        const isAfterMarket = isHistoricalMode || marketStatus.reason === 'after-market';

        console.log(`📡 [Backfill] Symbol: ${selectedSymbol}, FetchDate: ${fetchDate} (effectiveDate=${effectiveDate}, mode: ${isHistoricalMode ? 'historical' : 'live'}), Market: ${marketStatus.isOpen ? 'OPEN' : marketStatus.reason}`);

        // Always fetch external data to fill any gaps
        // After market / historical: need full day
        // During market: fill gaps from 9:15 AM to now
        setHistoricalDataStatus(`Fetching ${isAfterMarket ? 'full day' : 'historical'} data...`);

        const result = await fetchHistoricalData(selectedSymbol, fetchDate);

        // Bail out if company changed while we were fetching
        if (signal.aborted) {
          console.log(`🛑 [Backfill] Aborted for ${selectedSymbol} - company changed`);
          return;
        }

        if (result.success && result.data.length > 0) {
          console.log(`✅ [Backfill] Fetched ${result.data.length} ticks, ${result.ohlc?.length || 0} candles from external server`);

          // ✅ Check if the returned data covers the full trading day.
          // For historical dates the session ends at 15:30 IST (10:00 UTC).
          // If the last candle is before 15:00 IST (~09:30 UTC), the data is
          // incomplete — don't cache it so a future visit can re-fetch.
          const isDataComplete = (() => {
            if (!isHistoricalMode) return true; // live day — always treat as complete
            if (!result.ohlc || result.ohlc.length === 0) return false;
            const lastCandle = result.ohlc[result.ohlc.length - 1];
            // 15:00 IST = 09:30 UTC
            const marketEndUTC = Date.UTC(
              ...fetchDate.split('-').map(Number) as [number, number, number],
              9, 30, 0
            ) / 1000;
            return lastCandle.timestamp >= marketEndUTC;
          })();

          if (isDataComplete) {
            // Mark as fully backfilled — fast path can skip on next visit
            backfilledSymbolsRef.current.add(backfillKey);
            setHasBackfillData(true);
          } else {
            // Partial data: show a warning but still display what we have.
            // Do NOT add to backfilledSymbolsRef so the next date-change re-fetches.
            const lastCandle = result.ohlc && result.ohlc.length > 0 ? result.ohlc[result.ohlc.length - 1] : null;
            const lastTime = lastCandle
              ? new Date(lastCandle.timestamp * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
              : 'unknown';
            console.warn(`⚠️ [Backfill] Incomplete data for ${fetchDate}: last candle at ${lastTime} IST (expected 15:30). Showing partial data.`);
            setHistoricalDataStatus(`Partial data: available until ${lastTime} IST`);
            setHasBackfillData(true);
          }

          // ===== MERGE EXTERNAL OHLC WITH EXISTING OHLC =====
          if (result.ohlc && result.ohlc.length > 0) {
            setOhlcData(prev => {
              const existingCandles = prev[selectedSymbol] || [];

              // Convert to OHLCCandle format if needed
              const externalCandles: OHLCCandle[] = result.ohlc!.map(c => ({
                timestamp: c.timestamp,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
              }));

              // Merge: external first (fills gaps), then real-time (takes priority)
              const merged = mergeOHLCData(existingCandles as OHLCCandle[], externalCandles);

              console.log(`✅ [Backfill] Merged OHLC: ${existingCandles.length} existing + ${externalCandles.length} external = ${merged.length} total`);

              if (merged.length > 0) {
                const firstTime = new Date(merged[0].timestamp * 1000).toLocaleTimeString('en-IN');
                const lastTime = new Date(merged[merged.length - 1].timestamp * 1000).toLocaleTimeString('en-IN');
                console.log(`✅ [Backfill] Time range: ${firstTime} → ${lastTime}`);
              }

              return {
                ...prev,
                [selectedSymbol]: merged as OHLCData[]
              };
            });

            setHistoricalDataStatus(`Complete: ${result.ohlc.length} candles loaded`);
          }

          // ===== ALSO MERGE TICK DATA FOR HISTORICAL REFERENCE =====
          const externalData: MarketData[] = result.data.map(point => ({
            symbol: selectedSymbol,
            ltp: point.ltp,
            change: 0,
            changePercent: 0,
            open: point.open_price,
            high: point.high_price,
            low: point.low_price,
            close: point.ltp,
            volume: point.vol_traded_today,
            timestamp: point.timestamp,
            bid: point.bid_price,
            ask: point.ask_price
          }));

          setHistoricalData(prev => {
            const existingData = prev[selectedSymbol] || [];
            const dataMap = new Map<number, MarketData>();

            // External data first (fills gaps)
            externalData.forEach(point => {
              dataMap.set(point.timestamp, point);
            });

            // Existing data overwrites (real-time takes priority)
            existingData.forEach(point => {
              dataMap.set(point.timestamp, point);
            });

            const mergedData = Array.from(dataMap.values())
              .sort((a, b) => a.timestamp - b.timestamp);

            console.log(`✅ [Backfill] Merged ticks: ${existingData.length} existing + ${externalData.length} external = ${mergedData.length} total`);

            return {
              ...prev,
              [selectedSymbol]: mergedData
            };
          });

          // Update current market data with latest
          if (externalData.length > 0) {
            const latestData = externalData[externalData.length - 1];
            setMarketData(prev => {
              // Only update if we don't have real-time data
              const existing = prev[selectedSymbol];
              if (!existing || latestData.timestamp > existing.timestamp) {
                return {
                  ...prev,
                  [selectedSymbol]: latestData
                };
              }
              return prev;
            });
          }
        } else {
          console.warn(`⚠️ [Backfill] No external data available: ${result.error || 'Unknown'}`);
          // ✅ DON'T mark as backfilled on failure — allow retry later
          // backfilledSymbolsRef.current.add(backfillKey) is NOT called here
          setHistoricalDataStatus(isAfterMarket
            ? 'After-market: Historical data server unavailable'
            : 'Historical server unavailable — showing live data only');
        }
      } catch (error) {
        // Don't log errors for aborted requests (company changed mid-fetch)
        if (!signal.aborted) {
          console.error(`❌ [Backfill] Error:`, error);
          // ✅ Clear, user-friendly message — don't mark as backfilled so retry is possible
          setHistoricalDataStatus('Historical data server unavailable — showing live data');
        }
      } finally {
        // ✅ CRITICAL: Always clear loading IMMEDIATELY so live data can render
        // If aborted, the new company's effect will set isLoadingHistorical=true again.
        setIsLoadingHistorical(false);
        hasLoadedDataRef.current = true; // ✅ Mark as loaded so chart can render with whatever data exists
        if (!signal.aborted) {
          // Keep status message visible for 8s (longer for awareness), then clear
          setTimeout(() => setHistoricalDataStatus(''), 8000);
        }
      }
    };

    // ✅ Create AbortController for this fetch cycle
    const abortController = new AbortController();
    historicalFetchAbortRef.current = abortController;

    // Fetch immediately — no artificial delay, speed is critical
    const fetchTimer = setTimeout(() => {
      fetchAndBackfillHistoricalData(abortController.signal);
    }, 100); // Near-instant: just yield to let React commit state updates

    // Safety timeout: if loading is still true after 8s, force-clear it
    const safetyTimer = setTimeout(() => {
      setIsLoadingHistorical(prev => {
        if (prev) {
          console.warn('⚠️ [Safety] Force-clearing isLoadingHistorical after 8s timeout');
          setHistoricalDataStatus('Historical data server slow — showing live data');
          // Clear the status message after 8s
          setTimeout(() => setHistoricalDataStatus(''), 8000);
          return false;
        }
        return prev;
      });
    }, 8000);

    return () => {
      clearTimeout(fetchTimer);
      clearTimeout(safetyTimer);
      // ✅ Cancel any in-flight fetch when effect re-runs (company/date changed)
      abortController.abort();
      // ✅ CRITICAL: Do NOT unsubscribe — keep all subscriptions alive
      // so background data continues flowing for ALL companies.
      // The data stores are keyed by symbol, so switching companies
      // just changes which key we read from.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, isClient, effectiveDate, forceRefetchKey]);

  useEffect(() => {
    const fetchSentiment = async () => {
      if (!selectedSymbol) {
        setOverallSentiment('NEUTRAL');
        return;
      }
      setIsSentimentFetching(true);
      try {
        const sentiment = await sentimentService.fetchSentiment(selectedSymbol);
        setOverallSentiment(sentiment);

        // Update sentiment map for company list display
        const companyCode = selectedSymbol.includes(':')
          ? selectedSymbol.split(':')[1]?.split('-')[0]
          : selectedSymbol.split('-')[0];
        if (companyCode) {
          setSentimentMap(prev => ({
            ...prev,
            [companyCode]: sentiment as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
            [selectedSymbol]: sentiment as 'BULLISH' | 'BEARISH' | 'NEUTRAL'
          }));
        }
      } catch (error) {
        console.error('Failed to fetch sentiment:', error);
        setOverallSentiment('NEUTRAL');
      } finally {
        setIsSentimentFetching(false);
      }
    };
    fetchSentiment();
  }, [selectedSymbol]);

  // ✅ Status reconciler — keep the visible badge synced to the real socket
  // every 3s so the Live/Offline label always reflects truth.
  useEffect(() => {
    if (!isClient) return;
    const tick = () => {
      const connected = isSocketConnected();
      setSocketStatus(prev => {
        if (connected && prev !== 'Connected') return 'Connected';
        if (!connected && prev === 'Connected') return 'Reconnecting...';
        return prev;
      });
      setIsReconnecting(prev => (connected ? false : prev));
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [isClient]);

  // Connection Health Monitor
  useEffect(() => {
    if (!isClient || !socketRef.current || !selectedSymbol) return;

    // ✅ 3-minute threshold — lastDataReceivedRef is now updated by heartbeats
    // every 10s, plus every tick / historical / ohlc payload. A truly healthy
    // socket cannot be falsely declared stale and force-disconnected, which
    // was making the indicator flip to Offline mid-session.
    const STALE_THRESHOLD = 180000;

    const healthCheckInterval = setInterval(() => {
      const socket = socketRef.current;
      if (!socket) return;

      const isConnected = isSocketConnected();
      // Use ref — no need to re-run this effect every time a tick arrives
      const timeSinceLastData = lastDataReceivedRef.current
        ? Date.now() - lastDataReceivedRef.current
        : null;

      if (isConnected && tradingHours.isActive && timeSinceLastData && timeSinceLastData > STALE_THRESHOLD) {
        console.warn('⚠️ Connection appears stale (no heartbeat or tick for 3 min), forcing reconnection...');
        isSubscribedRef.current.clear();
        socket.disconnect();
        setTimeout(() => {
          socket.connect();
        }, 1000);
      }
    }, 30000);

    return () => clearInterval(healthCheckInterval);
  }, [isClient, selectedSymbol, tradingHours.isActive]);

  // Memoized data
  const currentData = useMemo(() =>
    marketData[selectedSymbol] || null,
    [marketData, selectedSymbol]
  );

  const symbolHistory = useMemo(() =>
    historicalData[selectedSymbol] || [],
    [historicalData, selectedSymbol]
  );

  const symbolOhlc = useMemo(() =>
    ohlcData[selectedSymbol] || [],
    [ohlcData, selectedSymbol]
  );

  const symbolChartUpdates = useMemo(() =>
    chartUpdates[selectedSymbol] || [],
    [chartUpdates, selectedSymbol]
  );

  const isDataStale = useMemo(() => predictionDataAge > 600, [predictionDataAge]);

  // =====================================================================
  // CHART DATA PREPARATION
  // Use OHLC data ONLY for candlesticks - these are proper aggregated candles
  // The WebSocket sends ohlcData with proper open/high/low/close per minute
  // =====================================================================

  // Helper: Get interval duration in seconds for candle aggregation
  const getIntervalSeconds = useCallback((interval: string): number => {
    switch (interval) {
      case '1m': return 60;
      case '5m': return 5 * 60;
      case '15m': return 15 * 60;
      case '30m': return 30 * 60;
      case '1h': return 60 * 60;
      case '1d': return 24 * 60 * 60;
      default: return 60;
    }
  }, []);

  // Helper: Aggregate 1-minute OHLC candles into larger intervals
  const aggregateCandles = useCallback((
    minuteCandles: Array<{ interval_start: string; open: number; high: number; low: number; close: number; volume: number }>,
    intervalSeconds: number
  ) => {
    if (intervalSeconds <= 60) return minuteCandles; // 1m = no aggregation

    const bucketMap = new Map<number, { open: number; high: number; low: number; close: number; volume: number; ts: number }>();

    for (const candle of minuteCandles) {
      const ts = Math.floor(new Date(candle.interval_start).getTime() / 1000);
      // Floor timestamp to the interval boundary
      const bucketTs = Math.floor(ts / intervalSeconds) * intervalSeconds;

      const existing = bucketMap.get(bucketTs);
      if (!existing) {
        bucketMap.set(bucketTs, {
          ts: bucketTs,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        });
      } else {
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close; // last close wins
        existing.volume += candle.volume;
      }
    }

    return Array.from(bucketMap.values())
      .sort((a, b) => a.ts - b.ts)
      .map(b => ({
        interval_start: new Date(b.ts * 1000).toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      }));
  }, []);

  const chartData = useMemo(() => {
    // ✅ CRITICAL: Use today's IST date for chart filtering unless the user
    // EXPLICITLY selected a specific date via the date picker (currentDate).
    // hookSelectedDate is the watchlist DB date (e.g. last Friday) — it must NOT
    // drive the chart filter or today's candles get incorrectly excluded.
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const targetDate = currentDate || todayIST; // Only user-set date overrides today
    const intervalSec = getIntervalSeconds(chartInterval);

    // ===== USE OHLC DATA DIRECTLY (1-minute candles from WebSocket/backfill) =====
    if (symbolOhlc && symbolOhlc.length > 0) {
      // First try filtering for the target date
      let validCandles = symbolOhlc
        .filter(candle => {
          if (
            candle.timestamp <= 0 ||
            typeof candle.open !== 'number' || isNaN(candle.open) || candle.open <= 0 ||
            typeof candle.high !== 'number' || isNaN(candle.high) || candle.high <= 0 ||
            typeof candle.low !== 'number' || isNaN(candle.low) || candle.low <= 0 ||
            typeof candle.close !== 'number' || isNaN(candle.close) || candle.close <= 0
          ) {
            return false;
          }
          // Filter candles with impossible high-low range (>50% of close).
          // These indicate corrupted OHLC from a bad first tick after subscription.
          const rangeRatio = (candle.high - candle.low) / candle.close;
          if (rangeRatio > 0.50) return false;
          const candleDate = new Date(candle.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          return candleDate === targetDate;
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      // FALLBACK: Only when NO explicit date was selected (currentDate === null),
      // fall back to today's live data if nothing matched the watchlist-derived date.
      // When the user HAS set an explicit historical date, show nothing rather than
      // the wrong date — the backfill may still be in flight.
      if (validCandles.length === 0 && currentDate === null && targetDate !== todayIST) {
        const todayCandles = symbolOhlc
          .filter(candle => {
            if (
              candle.timestamp <= 0 ||
              typeof candle.open !== 'number' || isNaN(candle.open) || candle.open <= 0 ||
              typeof candle.close !== 'number' || isNaN(candle.close) || candle.close <= 0
            ) return false;
            const candleDate = new Date(candle.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            return candleDate === todayIST;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        if (todayCandles.length > 0) {
          console.log(`📈 [chartData] No data for ${targetDate}, falling back to ${todayCandles.length} live candles from today`);
          validCandles = todayCandles;
        }
      }

      if (validCandles.length > 0) {
        // Convert to standard format first
        const minuteData = validCandles.map(candle => ({
          interval_start: new Date(candle.timestamp * 1000).toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: Math.max(0, candle.volume || 0),
        }));

        // Aggregate to requested interval
        const aggregated = aggregateCandles(minuteData, intervalSec);
        return aggregated;
      }
    }

    // ===== FALLBACK: Create candles from historical tick data =====
    if (symbolHistory && symbolHistory.length > 0) {
      console.log(`📈 [chartData] Creating candles from historical tick data`);

      // Try targetDate first, then fall back to today
      const datesToTry = targetDate !== todayIST ? [targetDate, todayIST] : [targetDate];

      for (const filterDate of datesToTry) {
        const minuteCandles = new Map<number, { open: number, high: number, low: number, close: number, volume: number, firstTimestamp: number }>();

        const sortedHistory = [...symbolHistory]
          .filter(p => {
            if (p.ltp <= 0 || isNaN(p.ltp)) return false;
            const tickDate = new Date(p.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            return tickDate === filterDate;
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        if (sortedHistory.length === 0) continue;

        let prevCumulativeVolume = 0;

        sortedHistory.forEach((p, index) => {
          const minuteTs = Math.floor(p.timestamp / 60) * 60;
          const price = p.ltp;

          const currentCumulativeVolume = p.volume || 0;
          let deltaVolume = 0;
          if (index > 0 && currentCumulativeVolume >= prevCumulativeVolume) {
            deltaVolume = currentCumulativeVolume - prevCumulativeVolume;
          }
          prevCumulativeVolume = currentCumulativeVolume;

          const existing = minuteCandles.get(minuteTs);

          if (!existing) {
            minuteCandles.set(minuteTs, {
              open: price,
              high: price,
              low: price,
              close: price,
              volume: deltaVolume,
              firstTimestamp: p.timestamp,
            });
          } else {
            existing.high = Math.max(existing.high, price);
            existing.low = Math.min(existing.low, price);
            existing.close = price;
            existing.volume += deltaVolume;
          }
        });

        // Convert to standard format
        const minuteData = Array.from(minuteCandles.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([timestamp, candle]) => ({
            interval_start: new Date(timestamp * 1000).toISOString(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));

        // Aggregate to requested interval
        const aggregated = aggregateCandles(minuteData, intervalSec);
        console.log(`📈 [chartData] ${sortedHistory.length} ticks → ${minuteData.length} 1m → ${aggregated.length} ${chartInterval} candles (date: ${filterDate})`);
        return aggregated;
      }
    }

    return [];
  }, [symbolOhlc, symbolHistory, currentDate, chartInterval, getIntervalSeconds, aggregateCandles]);

  // ─────────────────────────────────────────────────────────────────────────
  // Page-level readiness gate
  // ─────────────────────────────────────────────────────────────────────────
  // MUST be declared BEFORE the `if (!isClient) return …` early return below.
  // Otherwise on the first SSR render (`isClient=false`) these hooks are not
  // executed, but on the second render (`isClient=true`) they ARE, which
  // changes the hook count and trips React's Rules-of-Hooks check.
  //
  // The cluster-overlay page combines three async data sources: live OHLC
  // (isLoadingHistorical), GTT predictions (gttLoading), and pattern-overlay
  // analysis (patternOverlayState.loading). Rendering the chart before any of
  // these settle causes two visible defects:
  //  1. The TradingView chart autoFits to a not-yet-final container size on
  //     first paint, leaving the candles "zoomed in" until a later resize.
  //  2. On company switch, the previous company's panels remain on screen
  //     until the new data arrives, looking like the switch failed.
  //
  // Fix: a single `pageReady` flag covers the entire main content. While it's
  // false we render a single full-page loader and the chart/panels never
  // mount on a half-laid-out container.
  const [layoutStable, setLayoutStable] = useState(false);
  const READY_HARD_TIMEOUT_MS = 8000;
  const readyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset stability whenever the user switches companies. We re-enable it
  // after data settles (below).
  useEffect(() => {
    setLayoutStable(false);
  }, [selectedSymbol]);

  // Once all data sources are settled (or the hard timeout fires), wait two
  // animation frames so the flex layout has finished computing widths/heights,
  // then mark layout stable so the chart mounts at its real size.
  useEffect(() => {
    if (!isClient || !selectedSymbol) return;
    const dataSettled =
      !isLoadingHistorical &&
      !gttLoading &&
      !patternOverlayState.loading &&
      // Only gate on intraday shapes when the overlay is actually enabled.
      // When disabled the hook is a no-op and never transitions to loading.
      (!showIntradayOverlay || !intradayShapesLoading);

    if (dataSettled) {
      // Use a closure variable to track raf2 — cannot set properties on number
      // primitives in strict mode (TypeError in Next.js 15 / V8).
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setLayoutStable(true));
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }

    if (!readyTimeoutRef.current) {
      readyTimeoutRef.current = setTimeout(() => {
        console.warn('[cluster-overlay] ready-gate hard timeout; rendering with partial data');
        setLayoutStable(true);
        readyTimeoutRef.current = null;
      }, READY_HARD_TIMEOUT_MS);
    }
  }, [
    isClient,
    selectedSymbol,
    isLoadingHistorical,
    gttLoading,
    patternOverlayState.loading,
    showIntradayOverlay,
    intradayShapesLoading,
  ]);

  useEffect(() => () => {
    if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
  }, []);

  // The page is ready when: client is hydrated, a company is selected, and the
  // layout has had a chance to stabilise after all data sources settled.
  // When no company is selected, we still want to render the empty-state panel
  // immediately so the user sees the "Select a company" prompt.
  const pageReady = isClient && (!selectedSymbol || layoutStable);

  // Loading state
  if (!isClient) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex-1">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Cluster Overlay</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <ModeToggle />
          </header>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-xl animate-pulse">Loading market data...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  const pageTitle = selectedCompany ? `${selectedCompany} - Cluster Overlay` : "Cluster Overlay";

  // Combined loading gate: show unified loader until chart data + GTT are both ready
  // Prevents cluster/GTT panels from rendering before live market data is ready
  const allDataReady = !isLoadingHistorical && !gttLoading;
  // `pageReady`, `layoutStable`, and the readiness effects are all declared
  // ABOVE the `if (!isClient) return …` early return — required for Rules of
  // Hooks to hold across the SSR→client hydration boundary.

  // Main render - using recommendations page layout
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden flex flex-col h-screen">

        {/* HEADER */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* ── Date Navigator ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDate}
              disabled={sortedDates.length === 0 || currentDateIdx <= 0}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous trading day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium border border-border/60 hover:bg-accent hover:border-border transition-colors min-w-[155px] justify-center"
                  title="Pick a trading date"
                >
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {effectiveDate
                      ? format(new Date(effectiveDate + 'T00:00:00'), 'EEE, dd MMM yyyy')
                      : 'Select Date'}
                  </span>
                  {!currentDate && (
                    <span className="ml-0.5 text-[9px] font-bold tracking-wide text-emerald-500 uppercase shrink-0">Live</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center" sideOffset={4}>
                <div className="p-3">
                  <div className="flex items-center justify-between mb-2 gap-4">
                    <span className="text-xs font-semibold text-muted-foreground">Trading Date</span>
                    {currentDate && (
                      <button
                        onClick={() => handleDateChange(sortedDates[sortedDates.length - 1] || '')}
                        className="text-[10px] text-blue-500 hover:text-blue-600 font-medium hover:underline underline-offset-2"
                      >
                        Jump to Latest
                      </button>
                    )}
                  </div>
                  <Calendar
                    mode="single"
                    selected={effectiveDate ? new Date(effectiveDate + 'T00:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) handleDateChange(format(date, 'yyyy-MM-dd'));
                    }}
                    disabled={(date) => {
                      const dateStr = format(date, 'yyyy-MM-dd');
                      return sortedDates.length > 0 && !sortedDates.includes(dateStr);
                    }}
                    initialFocus
                  />
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={handleNextDate}
              disabled={sortedDates.length === 0 || currentDateIdx >= sortedDates.length - 1}
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next trading day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {isLoadingHistorical && (
              <div className="h-3 w-3 rounded-full border border-muted-foreground/40 border-t-transparent animate-spin shrink-0" />
            )}
          </div>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Header Controls — all items h-7, text-xs, consistent border+tint color system */}
          <div className="flex items-center gap-1.5">
            {/* Connection Status — compact dot + label + source tooltip */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${socketStatus === 'Connected'
                  ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]'
                  : isReconnecting
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`} />
              <span
                className={`font-medium cursor-default select-none ${socketStatus === 'Connected'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isReconnecting
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                title={
                  socketStatus === 'Connected'
                    ? hasBackfillData
                      ? `Live Fyers data + historical backfill from server (port 6969) — socket on ${socketSource === 'server' ? 'remote server (100.93.172.21:5001)' : 'localhost:5001'}`
                      : `Live Fyers data only (port 5001) — socket on ${socketSource === 'server' ? 'remote server (100.93.172.21:5001)' : 'localhost:5001 (remote server unreachable)'}`
                    : socketStatus
                }
              >
                {socketStatus === 'Connected'
                  ? <>Live <span className={`text-[10px] font-normal opacity-70 ml-0.5 ${
                      hasBackfillData
                        ? 'text-sky-500 dark:text-sky-400'
                        : 'text-emerald-500 dark:text-emerald-400'
                    }`}>({hasBackfillData ? 'server + fyers' : 'fyers'})</span></>
                  : isReconnecting ? 'Reconnecting'
                    : 'Offline'}
              </span>
            </div>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Subscription Manager */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubscribeAll}
                disabled={isSubscribing || !companies.length}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                {isSubscribing
                  ? <div className="h-3 w-3 rounded-full border border-current border-t-transparent animate-spin" />
                  : <ListChecks className="h-3 w-3 text-emerald-500" />
                }
                Subscribe All
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSubscriptionModalOpen(true)}
                disabled={isSubscribing}
                className="h-7 w-7"
                title="Manage Subscriptions"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Prediction Service Status */}
            {predictionServiceHealth === 'checking' || isCheckingHealth ? (
              <div className="h-7 px-2.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-muted-foreground/50 border-t-transparent animate-spin" />
                Checking...
              </div>
            ) : predictionServiceHealth === 'unavailable' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      disabled
                      className="h-7 px-2.5 rounded-md text-xs font-medium border border-red-500/20 bg-red-500/8 text-red-500 dark:text-red-400 cursor-not-allowed inline-flex items-center gap-1.5 opacity-75"
                    >
                      <AlertCircle className="h-3 w-3" />
                      Predictions
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-white max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-red-400">⚠ Regular Prediction Service — DOWN</p>
                      <p className="text-zinc-400">Port: 5112 · Service not responding</p>
                      {selectedCompany && <p className="text-zinc-400">Company: {selectedCompany}</p>}
                      <p className="text-zinc-500">Health checks run every 2 min. Start the prediction server to enable.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowPredictions(!showPredictions)}
                      className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 border ${showPredictions
                          ? predictionsOutdated
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/15'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/15'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted/60'
                        }`}
                    >
                      {predictionsOutdated && showPredictions ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <Activity className="h-3 w-3" />
                      )}
                      {showPredictions ? 'Predictions ON' : 'Predictions OFF'}
                      {/* Countdown to next prediction fetch — only when server is available AND predictions are ON */}
                      {predCountdown.inMarketHours && showPredictions && predictionServiceHealth === 'available' && (
                        <span
                          className={`font-mono text-[10px] tabular-nums leading-none px-1 py-0.5 rounded ${predCountdown.seconds <= 30
                              ? 'bg-amber-400/30 text-amber-600 dark:text-amber-200'   // urgent: < 30s
                              : predCountdown.seconds <= 90
                                ? 'bg-blue-400/20 text-blue-500 dark:text-blue-300'      // soon: < 90s
                                : showPredictions
                                  ? 'text-blue-500/60 dark:text-blue-300/60'               // normal, ON
                                  : 'text-gray-500 dark:text-gray-400'                     // normal, OFF
                            }`}
                          title={`Next prediction fetch at ${predCountdown.nextPredictionTime} IST`}
                        >
                          {predCountdown.formatted}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-white max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-green-400">✓ Regular Prediction Service — Available</p>
                      <p className="text-zinc-400">Port: 5112 · {showPredictions ? 'Enabled (orange line on chart)' : 'Disabled — click to enable'}</p>
                      {selectedCompany && <p className="text-zinc-400">Company: {selectedCompany}</p>}
                      {showPredictions && predictions && (
                        <p className="text-zinc-400">Predictions: {predictions.count || Object.keys(predictions.predictions || {}).length} points</p>
                      )}
                      {predictionsOutdated && showPredictions && (
                        <p className="text-red-400">⚠️ Prediction data is outdated (not from today).</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* GTT Service Status */}
            {gttServiceHealth === 'checking' || isCheckingHealth ? (
              <div className="h-7 px-2.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-full border border-muted-foreground/50 border-t-transparent animate-spin" />
                GTT...
              </div>
            ) : gttServiceHealth === 'unavailable' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      disabled
                      className="h-7 px-2.5 rounded-md text-xs font-medium border border-amber-500/20 bg-amber-500/8 text-amber-600 dark:text-amber-400 cursor-not-allowed inline-flex items-center gap-1.5 opacity-75"
                    >
                      <Zap className="h-3 w-3" />
                      GTT
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-white max-w-xs">
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-orange-400">⚠ GTT Prediction Service — DOWN</p>
                      <p className="text-zinc-400">Port: 5113 (via backend 5002) · Service not responding</p>
                      {selectedCompany && <p className="text-zinc-400">Company: {selectedCompany}</p>}
                      <p className="text-zinc-500">Health checks run every 2 min. Start the GTT server to enable.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              /* Split-button: Main click = toggle GTT, Dropdown arrow = control panel */
              <div className="flex items-center">
                {/* Main GTT toggle button */}
                <button
                  onClick={() => setIsGttEnabled(!isGttEnabled)}
                  className={`h-7 px-2.5 rounded-l-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 border border-r-0 ${isGttEnabled
                      ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25 hover:bg-violet-500/15'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-muted/60'
                    }`}
                >
                  <Zap className="h-3 w-3" />
                  {isGttEnabled ? 'GTT ON' : 'GTT OFF'}
                  {isGttEnabled && gttCountdown.inMarketHours && (
                    <span
                      className={`font-mono text-[10px] tabular-nums leading-none px-1 py-0.5 rounded ${gttCountdown.seconds <= 60
                          ? 'bg-amber-400/25 text-amber-600 dark:text-amber-300'
                          : gttCountdown.seconds <= 180
                            ? 'bg-violet-400/20 text-violet-500 dark:text-violet-300'
                            : 'text-violet-500/60 dark:text-violet-400/60'
                        }`}
                      title={`Next GTT prediction at ${gttCountdown.nextPredictionTime} IST`}
                    >
                      {gttCountdown.formatted}
                    </span>
                  )}
                </button>
                {/* Dropdown arrow — opens GTT control panel */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`h-7 px-1.5 rounded-r-md transition-colors inline-flex items-center border ${isGttEnabled
                          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25 hover:bg-violet-500/20'
                          : 'bg-transparent text-muted-foreground border-border hover:bg-muted/60'
                        }`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="end" className="w-80 p-0" sideOffset={4}>
                    <div className="p-3 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-purple-400" />
                          <span className="font-semibold text-sm">GTT Control Panel</span>
                        </div>
                        <Badge variant={isGttEnabled ? "default" : "secondary"} className={cn("text-[10px]", isGttEnabled ? "bg-purple-600" : "")}>
                          {isGttEnabled ? 'ON' : 'OFF'}
                        </Badge>
                      </div>

                      {/* Info */}
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Port: 5113 · Multi-horizon predictions (H1–H5)</p>
                        {selectedCompany && <p>Company: {selectedCompany}</p>}
                        {isGttEnabled && gttChartData && (
                          <p>{gttChartData.total_predictions} predictions · {gttChartData.inputCloseCount} input_close pts</p>
                        )}
                      </div>

                      {/* Master Toggle */}
                      <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/50">
                        <span className="text-xs font-medium">GTT Engine</span>
                        <button
                          onClick={() => setIsGttEnabled(!isGttEnabled)}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                            isGttEnabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm",
                            isGttEnabled ? "translate-x-4.5" : "translate-x-0.5"
                          )} />
                        </button>
                      </div>

                      {/* Per-horizon toggles — only when GTT is ON */}
                      {isGttEnabled && (
                        <div className="space-y-1 border-t pt-2">
                          {/* Quick group toggles */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <button
                              onClick={() => {
                                const newVis = { ...gttHorizonVisibility };
                                const allS1On = ALL_HORIZON_KEYS.filter(k => k.startsWith('S1_')).every(k => newVis[k] !== false);
                                ALL_HORIZON_KEYS.filter(k => k.startsWith('S1_')).forEach(k => { newVis[k] = !allS1On; });
                                setGttHorizonVisibility(newVis);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-medium"
                            >
                              {ALL_HORIZON_KEYS.filter(k => k.startsWith('S1_')).every(k => gttHorizonVisibility[k] !== false) ? 'Hide' : 'Show'} All S1
                            </button>
                            <button
                              onClick={() => {
                                const newVis = { ...gttHorizonVisibility };
                                const allS2On = ALL_HORIZON_KEYS.filter(k => k.startsWith('S2_')).every(k => newVis[k] !== false);
                                ALL_HORIZON_KEYS.filter(k => k.startsWith('S2_')).forEach(k => { newVis[k] = !allS2On; });
                                setGttHorizonVisibility(newVis);
                              }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 font-medium"
                            >
                              {ALL_HORIZON_KEYS.filter(k => k.startsWith('S2_')).every(k => gttHorizonVisibility[k] !== false) ? 'Hide' : 'Show'} All S2
                            </button>
                          </div>

                          {/* S1 horizons */}
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">S1 Model — Solid</p>
                          {ALL_HORIZON_KEYS.filter(k => k.startsWith('S1_')).map(hk => {
                            const cfg = HORIZON_LINE_CONFIG[hk];
                            return (
                              <label key={hk} className="flex items-center justify-between py-0.5 px-2 rounded hover:bg-muted/50 cursor-pointer">
                                <span className="flex items-center gap-2 text-xs">
                                  <span className="w-3 h-0.5 inline-block rounded" style={{ borderBottom: `2px ${cfg.style} ${cfg.color}` }} />
                                  {cfg.label}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={gttHorizonVisibility[hk] !== false}
                                  onChange={() => setGttHorizonVisibility({ ...gttHorizonVisibility, [hk]: !(gttHorizonVisibility[hk] !== false) })}
                                  className="h-3.5 w-3.5 rounded border-gray-300 accent-purple-600"
                                />
                              </label>
                            );
                          })}

                          {/* S2 horizons */}
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2">S2 Model — Dashed</p>
                          {ALL_HORIZON_KEYS.filter(k => k.startsWith('S2_')).map(hk => {
                            const cfg = HORIZON_LINE_CONFIG[hk];
                            return (
                              <label key={hk} className="flex items-center justify-between py-0.5 px-2 rounded hover:bg-muted/50 cursor-pointer">
                                <span className="flex items-center gap-2 text-xs">
                                  <span className="w-3 h-0.5 inline-block rounded" style={{ borderBottom: `2px ${cfg.style} ${cfg.color}` }} />
                                  {cfg.label}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={gttHorizonVisibility[hk] !== false}
                                  onChange={() => setGttHorizonVisibility({ ...gttHorizonVisibility, [hk]: !(gttHorizonVisibility[hk] !== false) })}
                                  className="h-3.5 w-3.5 rounded border-gray-300 accent-cyan-600"
                                />
                              </label>
                            );
                          })}

                          {/* Input Close */}
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-2">Anchor</p>
                          <label className="flex items-center justify-between py-0.5 px-2 rounded hover:bg-muted/50 cursor-pointer">
                            <span className="flex items-center gap-2 text-xs">
                              <span className="w-3 h-0.5 inline-block rounded" style={{ borderBottom: '2px dotted #64748b' }} />
                              Input Close
                            </span>
                            <input
                              type="checkbox"
                              checked={gttHorizonVisibility['input_close'] !== false}
                              onChange={() => setGttHorizonVisibility({ ...gttHorizonVisibility, input_close: !(gttHorizonVisibility['input_close'] !== false) })}
                              className="h-3.5 w-3.5 rounded border-gray-300 accent-green-600"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            {/* Portfolio Mode */}
            <div className="flex items-center">
              <PortfolioMode
                enabled={portfolioModeEnabled}
                onToggle={setPortfolioModeEnabled}
                selectedCompany={selectedCompany}
                selectedCompanyName={selectedCompany || ''}
                exchange={selectedSymbol?.includes(':') ? selectedSymbol.split(':')[0] : 'NSE'}
                currentPrice={marketData[selectedSymbol]?.ltp || 0}
              />
            </div>

            <ModeToggle />
          </div>
        </header>

        {/* Market Closed Banner */}
        {!marketOpen && (
          <div className="border-b">
            <MarketClosedBanner />
          </div>
        )}

        {/* Auth Warning Banner */}
        {isAuthenticated === false && (
          <div className="bg-orange-500/90 text-white px-4 py-2 flex items-center gap-2 text-sm font-medium border-b border-orange-600/50">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>Dashboard is not authenticated — this data is from server, not updating live</span>
          </div>
        )}

        {/* MAIN CONTENT ROW */}
        <div className="flex flex-1 min-h-0 overflow-hidden" ref={mainRowRef}>

          {/* LEFT: CHART & ANALYSIS SPLIT */}
          <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden" ref={containerRef}>

            {/* ✅ READINESS LOADER (scoped to chart + panels area only — the
                company-list sidebar to the right stays interactive so the user
                can switch companies while data loads). Sits ABOVE the chart so
                it never paints into a half-resolved flex container (the
                "zoomed-in" first-render glitch) and so a previous company's
                data is never visible while new data is in-flight. */}
            {selectedCompany && !pageReady && (
              <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Loading {selectedCompany}…
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground/70">
                      {isLoadingHistorical && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Chart data
                        </span>
                      )}
                      {gttLoading && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                          GTT predictions
                        </span>
                      )}
                      {patternOverlayState.loading && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                          Pattern overlay
                        </span>
                      )}
                      {!isLoadingHistorical && !gttLoading && !patternOverlayState.loading && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Stabilising view…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* In-pane chart loader kept for transitions AFTER pageReady (e.g.,
                date picker re-fetch on the same company). The pageReady gate
                above handles initial load + company switch.  */}
            {selectedCompany && pageReady && !allDataReady && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-9 w-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">Loading market data...</p>
                    <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/70">
                      {isLoadingHistorical && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />Chart data</span>}
                      {gttLoading && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />GTT predictions</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Outdated Predictions Warning Banner */}
            {showPredictions && predictionsOutdated && predictions && predictions.count > 0 && (
              <div className="bg-red-600 text-white px-4 py-2 flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>⚠️ Running with outdated prediction data. The predictions displayed are not from today.</span>
              </div>
            )}

            {/* Upper: Chart - takes remaining space */}
            <div
              className="relative border-b flex flex-col overflow-hidden flex-1"
              style={{
                flex: isAnalysisVisible ? `0 0 ${100 - analysisHeight}%` : '1 1 auto',
                transition: isDragging ? 'none' : 'flex-basis 300ms ease-in-out',
                minHeight: '200px'
              }}
            >
              {selectedCompany && (marketOpen || chartData.length > 0) ? (
                <div className="relative w-full flex-1 min-h-0 flex flex-col">
                  <LightWeightStockChart
                    // ✅ Hard-remount when the user switches companies. Without
                    // this key, the chart library keeps its previous series
                    // and overlays the new symbol's candles on top of the old
                    // ones, which looks like "same data sticks across switches".
                    key={selectedSymbol}
                    companyId={selectedCompany}
                    data={chartData}
                    interval={chartInterval}
                    loading={isLoadingHistorical}
                    height="100%"
                    className="w-full h-full"
                    theme={theme === 'light' ? 'light' : 'dark'}
                    defaultChartType={chartActiveType}
                    indicators={chartActiveIndicators}
                    onIndicatorsChange={setChartActiveIndicators}
                    onChartTypeChange={setChartActiveType}
                    predictions={predictionServiceHealth === 'available' ? predictions : null}
                    showPredictions={showPredictions && predictionServiceHealth === 'available'}
                    gttPredictions={gttServiceHealth === 'available' ? gttChartData : null}
                    showGttPredictions={isGttEnabled && gttServiceHealth === 'available'}
                    gttHorizonVisibility={gttHorizonVisibility}
                    onIntervalChange={setChartInterval}
                    statusMessage={historicalDataStatus && !isLoadingHistorical && historicalDataStatus.includes('unavailable') ? historicalDataStatus : null}
                    intradayShapePattern={showIntradayOverlay ? activeIntradayPattern : null}
                    showIntradayOverlay={showIntradayOverlay}
                    todayOpenPrice={todayOpenPrice}
                    patternCurves={showPatternOverlay ? patternOverlayState.curves : null}
                    showPatternOverlay={showPatternOverlay}
                    showTop3PatternLines={showTop3Lines}
                    showBeyondTop3PatternLines={showBeyondTop3Lines}
                    lockToMarketHours={true}
                    lockedDate={effectiveDate || null}
                    showVolume={showVolume}
                    toolbarSlot={(
                      /* ── Pattern Overlay controls — inline in chart toolbar, next to lock icon ── */
                      <div
                        ref={patternPanelRef}
                        className="flex items-center gap-1.5 select-none border-l border-border/40 ml-1 pl-2"
                      >
                        {/* Drag grip (visual indicator) */}
                        <div className="flex flex-col gap-[3px] mr-0.5 opacity-30 shrink-0">
                          <div className="flex gap-[3px]">
                            <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                            <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                          </div>
                          <div className="flex gap-[3px]">
                            <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                            <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pattern Overlay
                        </span>

                        {/* PAA Resolution selector */}
                        <div className="flex items-center gap-0.5 ml-1">
                          {([3, 5, 9, 15] as const).map(w => (
                            <button
                              key={w}
                              onClick={(e) => { e.stopPropagation(); setPatternPaaWidth(w); }}
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${patternPaaWidth === w ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`}
                              title={`Switch to ${w}-minute PAA resolution`}
                            >
                              {w}m
                            </button>
                          ))}
                        </div>

                        {/* Top-3 toggle (#1–#3) */}
                        <div className="flex items-center gap-0.5 ml-1.5" title="Show/hide top-3 pattern lines (#1–#3)">
                          <span className="text-[9px] text-muted-foreground font-mono select-none">#1-3</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowTop3Lines(!showTop3Lines); }}
                            disabled={!showPatternOverlay}
                            className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors disabled:opacity-40 ${showTop3Lines && showPatternOverlay ? 'bg-violet-600' : 'bg-gray-400 dark:bg-gray-600'}`}
                            title={showTop3Lines ? 'Hide #1–#3 lines' : 'Show #1–#3 lines'}
                          >
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform shadow-sm ${showTop3Lines ? 'translate-x-2.5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>

                        {/* Bands toggle */}
                        <div className="flex items-center gap-0.5" title="Show/hide confidence band lines (faint upper & lower bounds)">
                          <span className="text-[9px] text-muted-foreground font-mono select-none">Bands</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowBeyondTop3Lines(!showBeyondTop3Lines); }}
                            disabled={!showPatternOverlay}
                            className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors disabled:opacity-40 ${showBeyondTop3Lines && showPatternOverlay ? 'bg-cyan-600' : 'bg-gray-400 dark:bg-gray-600'}`}
                            title={showBeyondTop3Lines ? 'Hide confidence bands' : 'Show confidence bands'}
                          >
                            <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform shadow-sm ${showBeyondTop3Lines ? 'translate-x-2.5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>

                        {/* Expand/collapse chevron — click to show/hide PatternOverlayPanel dropdown */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPanelExpanded && patternPanelRef.current) {
                              const rect = patternPanelRef.current.getBoundingClientRect();
                              setPatternPanelPos({ left: Math.max(8, Math.min(window.innerWidth - 448, rect.left)), top: rect.bottom + 6 });
                            }
                            setIsPanelExpanded(prev => !prev);
                          }}
                          className="ml-1 p-0.5 rounded hover:bg-accent transition-colors"
                          title={isPanelExpanded ? 'Collapse panel' : 'Expand panel'}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${isPanelExpanded ? '' : 'rotate-180'}`} />
                        </button>

                        {/* Master toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowPatternOverlay(!showPatternOverlay); }}
                          className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${showPatternOverlay ? 'bg-violet-600' : 'bg-gray-400 dark:bg-gray-600'}`}
                          title={showPatternOverlay ? 'Hide all chart overlay lines' : 'Show all chart overlay lines'}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${showPatternOverlay ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                        </button>

                        {/* Vol toggle — icon-only, positioned before chart's reset-view button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); }}
                          className={`ml-1 p-1 rounded transition-colors border-l border-border/40 pl-2 ${
                            showVolume
                              ? 'text-sky-400 hover:text-sky-300'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          title={showVolume ? 'Hide volume histogram' : 'Show volume histogram'}
                        >
                          <BarChart2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  />

                  {/* ── PatternOverlayPanel dropdown — fixed overlay, shown when expanded ── */}
                  {isPanelExpanded && patternPanelPos && (
                    <div
                      style={{
                        position: 'fixed',
                        left: patternPanelPos.left,
                        top: patternPanelPos.top,
                        zIndex: 9999,
                        width: 440,
                        maxWidth: 'calc(100vw - 24px)',
                        maxHeight: 'min(60vh, 520px)',
                      }}
                      className="bg-background/90 border border-border/60 rounded-lg shadow-xl backdrop-blur-sm flex flex-col overflow-hidden"
                    >
                      <PatternOverlayPanel
                        state={patternOverlayState}
                        symbol={overlaySymbol}
                        paaWidthMin={patternPaaWidth}
                        className="flex-1 min-h-0"
                      />
                    </div>
                  )}
                </div>
              ) : !selectedCompany ? (
                <div className="flex flex-1 min-h-0 items-center justify-center text-muted-foreground p-8 text-center flex-col gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Database size={32} />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Select a Company</h2>
                  <p className="max-w-md">
                    Select a company from the sidebar to view live market data and charts.
                  </p>
                </div>
              ) : (
                /* Market closed + company selected — show a centered placeholder (banner is already at top) */
                <div className="flex flex-1 min-h-0 items-center justify-center text-muted-foreground p-8 text-center flex-col gap-3">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock size={28} className="text-amber-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedCompany}</h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Live chart will be available when the market opens. You can still view analysis data below.
                  </p>
                </div>
              )}
            </div>

            {/* Analysis Panel - Always visible toggle bar, sticky at bottom */}
            <Tabs defaultValue="livedata" className="flex flex-col min-h-0" style={{ flex: isAnalysisVisible ? `0 0 ${analysisHeight}%` : '0 0 auto' }}>
              {/* Toggle Button with TabsList - ALWAYS VISIBLE */}
              <div className="flex-none bg-background z-20 border-t sticky bottom-0">
                {isAnalysisVisible ? (
                  <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/30">
                    {/* Tabs on the left */}
                    <TabsList className="h-7 bg-muted/50 p-0.5">
                      <TabsTrigger value="livedata" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Live Data</TabsTrigger>
                      <TabsTrigger value="predictions" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">AI Predictions & GTT</TabsTrigger>
                      <TabsTrigger value="charts" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Metrices</TabsTrigger>
                      <TabsTrigger value="umap" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">UMAP Clustering</TabsTrigger>
                    </TabsList>
                    {/* Drag handle and hide button on the right */}
                    <div
                      className="flex items-center gap-2 cursor-ns-resize group"
                      onMouseDown={handleMouseDown}
                      title="Drag to resize analysis panel"
                    >
                      <div className="h-0.5 w-6 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50 transition-colors"></div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-xs gap-1 opacity-60 hover:opacity-100 pointer-events-auto px-2 py-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAnalysisVisible(!isAnalysisVisible);
                        }}
                      >
                        <ChevronDown className="h-3 w-3" />
                        Hide Analysis
                      </Button>
                      <div className="h-0.5 w-6 rounded-full bg-muted-foreground/30 group-hover:bg-primary/50 transition-colors"></div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors py-2 cursor-pointer border-t shadow-lg"
                    onClick={() => setIsAnalysisVisible(!isAnalysisVisible)}
                  >
                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 opacity-80 hover:opacity-100">
                      <ChevronUp className="h-3 w-3" />
                      Show Analysis Panel
                    </Button>
                  </div>
                )}
              </div>

              {/* Analysis Panel with TabsContent - Only show when visible AND conditions met */}
              {isAnalysisVisible && selectedCompany && (
                <div className="flex-1 min-h-0 flex flex-col bg-background/50 overflow-hidden">
                  <div className="flex-1 overflow-hidden relative">
                    <TabsContent value="predictions" className="h-full m-0">
                      <ScrollArea className="h-full w-full">
                        {((showPredictions && predictionServiceHealth === 'available') || (isGttEnabled && gttServiceHealth === 'available')) ? (
                          <AIPredictionsDashboard
                            isPolling={isPolling}
                            elapsedTime={elapsedTime}
                            timeRemaining={timeRemaining}
                            pollCount={pollCount}
                            nextPollTime={nextPollTime}
                            timeUntilNextPoll={timeUntilNextPoll}
                            onStart={startPolling}
                            onPause={pausePolling}
                            onStop={stopPolling}
                            onRefresh={handleManualRefresh}
                            predictions={predictionServiceHealth === 'available' ? predictions : null}
                            company={selectedCompany || selectedSymbol}
                            dataAge={predictionDataAge}
                            isStale={isDataStale}
                            isLoading={predictionLoading}
                            isGttEnabled={isGttEnabled && gttServiceHealth === 'available'}
                            gttLoading={gttLoading}
                            gttError={gttError}
                            gttData={gttServiceHealth === 'available' ? gttChartData : null}
                          />) : (
                          <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                            <div className="text-center">
                              <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">AI Predictions are disabled</p>
                              <p className="text-xs mt-1">
                                {predictionServiceHealth === 'unavailable' && gttServiceHealth === 'unavailable'
                                  ? 'Both prediction services are unavailable. Check if servers are running.'
                                  : predictionServiceHealth === 'unavailable'
                                    ? 'Regular prediction service (port 5112) is unavailable. GTT can be enabled separately.'
                                    : gttServiceHealth === 'unavailable'
                                      ? 'GTT prediction service (port 5113) is unavailable. Regular predictions can be enabled separately.'
                                      : 'Enable predictions or GTT in the toolbar to view this panel.'}
                              </p>
                            </div>
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="charts" className="h-full m-0 p-0">
                      <div className="h-full">
                        <ImageCarousel
                          companyCode={selectedCompany || ''}
                          exchange={selectedExchange || ''}
                          gradientMode={gradientMode}
                          onGradientModeChange={setGradientMode}
                          onSentimentLoadingChange={setSentimentLoading}
                          selectedDate={effectiveDate || undefined}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="livedata" className="h-full m-0">
                      <ScrollArea className="h-full w-full">
                        <LiveDataDashboard
                          company={selectedCompany || ''}
                          symbol={selectedSymbol}
                          currentData={currentData}
                          desirabilityScore={desirabilityScore}
                          desirabilityClassification={desirabilityClassification}
                          desirabilityData={desirabilityData}
                          desirabilityLoading={desirabilityLoading}
                          onRefreshDesirability={handleFetchDesirabilityScore}
                          overallSentiment={overallSentiment}
                          isSentimentFetching={isSentimentFetching}
                        />
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="umap" className="h-full m-0">
                      <ScrollArea className="h-full w-full">
                        {/* ✅ Hard-remount the entire UMAP dashboard when the
                            user switches companies. The component already syncs
                            `initialSymbol → symbol` via a useEffect, but the
                            underlying clustering hooks can briefly show prior
                            company's panels during the transition. Keying it
                            guarantees the previous company's cluster data
                            cannot be seen even for a frame. */}
                        <UMAPClusterDashboard
                          key={selectedCompany || selectedSymbol || 'RELIANCE'}
                          initialSymbol={selectedCompany || selectedSymbol || 'RELIANCE'}
                        />
                      </ScrollArea>
                    </TabsContent>
                  </div>
                </div>
              )}
            </Tabs>
          </div>

          {/* RIGHT: SIDEBAR (Company List) - Draggable & Collapsible */}
          {isSidebarVisible ? (
            <div
              className="relative bg-background flex flex-col shrink-0 transition-all"
              style={{
                width: sidebarWidth,
                transition: isSidebarDragging ? 'none' : 'width 300ms ease-in-out',
              }}
            >
              {/* Drag Handle (left edge) */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/40 active:bg-primary/60 z-10 group"
                onMouseDown={handleSidebarMouseDown}
                title="Drag to resize sidebar"
              >
                <div className="absolute inset-y-0 -left-0.5 w-2 group-hover:bg-primary/20" />
              </div>
              {/* Collapse button */}
              <div className="flex items-center justify-between px-2 py-1 border-b border-l bg-muted/20">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Companies</span>
                <button
                  onClick={() => setIsSidebarVisible(false)}
                  className="p-0.5 rounded hover:bg-accent transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden border-l">
                <CompanyList
                  companies={companies || []}
                  selectedCompanyCode={selectedCompany}
                  onSelect={(companyCode: string) => {
                    const company = companies?.find((c: any) => c.company_code === companyCode);
                    if (company) {
                      handleCompanyChange(companyCode, company.exchange, company.marker);
                    }
                  }}
                  loading={watchlistLoading}
                  selectedWatchlistDate={effectiveDate}
                  onWatchlistDateChange={handleDateChange}
                  availableDates={availableDates}
                  showAllCompanies={showAllCompanies}
                  onShowAllCompaniesChange={setShowAllCompanies}
                  desirabilityMap={desirabilityMap}
                  sentimentMap={sentimentMap}
                  multiSelectMode={true}
                  showSubscribeButton={true}
                  onMultiAction={handleMultiAction}
                  clusterSymbols={clusterSymbols}
                />
              </div>
            </div>
          ) : (
            /* Collapsed sidebar - show expand button */
            <div className="w-8 bg-background border-l flex flex-col items-center py-2 shrink-0">
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Expand sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="mt-2 flex-1 flex items-center">
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  Companies
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Subscription Manager Modal */}
        <SubscriptionManagerModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
          availableCompanies={companies}
          filteredCompanies={filteredCompanies}
          currentSubscriptions={Array.from(isSubscribedRef.current)}
          onConfirm={handleSubscribeCompanies}
          currentDate={effectiveDate}
          isLatestDate={isLatestDate}
        />

      </SidebarInset>
    </SidebarProvider>
  );
};

export default ClusterOverlayPage;
