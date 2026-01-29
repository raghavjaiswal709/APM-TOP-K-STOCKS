'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getSocket, onReconnect, isSocketConnected } from '@/lib/socket';
import dynamic from 'next/dynamic';
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
import { ImageCarousel } from "./components/ImageCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { TrendingUp, TrendingDown, Minus, Wifi, Award, Clock, Building2, Database, AlertCircle, WifiOff, Activity, Calendar as CalendarIcon, Images, ChevronDown, ChevronUp, PanelBottomOpen, PanelBottomClose } from 'lucide-react';
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
import { DesirabilityPanel } from "./components/DesirabilityPanel";
import { sentimentService } from '@/app/services/sentimentService';
import { SubscriptionManagerModal } from "./components/SubscriptionManagerModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ListChecks, Settings2 } from 'lucide-react';
import { gttService, type GttPrediction } from '@/app/services/gttService';
import { Zap } from 'lucide-react';

// Prediction Integration
import { usePredictionPolling } from '@/hooks/usePredictionPolling';
import { useGttPolling } from '@/hooks/useGttPolling';
import { transformGttToChartPredictions } from '@/lib/gttTransformers';
import PredictionTimer from './components/PredictionTimer';
import PredictionControlPanel from './components/PredictionControlPanel';
import PredictionOverlay from './components/PredictionOverlay';
import PredictionAPIService from '@/lib/predictionService';
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    __latestCompanySentiment?: any;
  }
}

// Use LightWeightStockChart instead of Plotly
const LightWeightStockChart = dynamic(() => import('@/app/components/charts/LightWeightStockChart').then(mod => ({ default: mod.LightWeightStockChart })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-blue-500">Loading chart...</div>
    </div>
  )
});

const GttPredictionChart = dynamic(() => import('./components/charts/GttPredictionChart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-purple-500">Loading GTT Engine...</div>
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

const MarketDataPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTheme();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');

  // Analysis Panel Visibility
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(false);

  // Prediction Integration State
  const [showPredictions, setShowPredictions] = useState(true);
  const [predictionMode, setPredictionMode] = useState<'overlay' | 'comparison'>('overlay');
  const [gttChartType, setGttChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [isGttEnabled, setIsGttEnabled] = useState<boolean>(false);

  // Health check state for prediction services
  const [predictionServiceHealth, setPredictionServiceHealth] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [gttServiceHealth, setGttServiceHealth] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true);

  // Market Data State
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, MarketData[]>>({});
  const [ohlcData, setOhlcData] = useState<Record<string, OHLCData[]>>({});
  const [chartUpdates, setChartUpdates] = useState<Record<string, ChartUpdate[]>>({});

  const [socketStatus, setSocketStatus] = useState<string>('Disconnected');
  const [lastDataReceived, setLastDataReceived] = useState<Date | null>(null);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [dataCount, setDataCount] = useState<number>(0);
  const [updateFrequency, setUpdateFrequency] = useState<number>(0);
  const [tradingHours, setTradingHours] = useState<TradingHours>({
    start: '',
    end: '',
    current: '',
    isActive: false
  });

  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [backgroundDataPoints, setBackgroundDataPoints] = useState<number>(0);
  const [gradientMode, setGradientMode] = useState<'profit' | 'loss' | 'neutral'>('neutral');
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'predictions'>('live');
  const [marketOpen, setMarketOpen] = useState<boolean>(true);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [historicalDataStatus, setHistoricalDataStatus] = useState<string>('');
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
  
  // Track which symbols have been backfilled to avoid duplicate fetches
  const backfilledSymbolsRef = useRef<Set<string>>(new Set());
  
  // Date synchronization
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);
  
  // Show all companies filter state (lifted from CompanyList for useWatchlist integration)
  const [showAllCompanies, setShowAllCompanies] = useState<boolean>(false);

  // Fullscreen mode state for chart section
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

  // Shared X-Axis state for chart synchronization
  const [sharedXRange, setSharedXRange] = useState<[Date, Date] | undefined>(undefined);

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

  // Refs
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const frequencyIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const socketRef = useRef<any>(null);
  const isSubscribedRef = useRef<Set<string>>(new Set());
  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track cumulative volume per symbol for real-time delta calculation
  // Format: Map<symbol, Map<minuteTimestamp, cumulativeVolumeAtStartOfMinute>>
  const cumulativeVolumeRef = useRef<Map<string, Map<number, number>>>(new Map());

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
    pollInterval: 5 * 60 * 1000,
    totalDuration: 25 * 60 * 1000,
    enabled: showPredictions && isClient,
    autoStart: true,
    onUpdate: (data) => {
      console.log(`✅ [PREDICTION UPDATE] Predictions updated for ${selectedCompany}:`, data.count, 'predictions');
    },
    onError: (error) => {
      console.error('❌ Prediction error:', error);
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
    enabled: isGttEnabled && isClient && !!selectedSymbol,
    pollInterval: 60000
  });
  
  const gttChartData = useMemo(() => {
    if (!rawGttPredictions) return null;
    return transformGttToChartPredictions(rawGttPredictions);
  }, [rawGttPredictions]);

  const {
    score: desirabilityScore,
    classification: desirabilityClassification,
    loading: desirabilityLoading,
    error: desirabilityError,
    data: desirabilityData,
    refetch: refetchDesirability,
  } = useDesirability(selectedSymbol);

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

  const handleCompanyChange = useCallback((companyCode: string | null, exchange?: string, marker?: string) => {
    console.log(`🏢 [handleCompanyChange] Full arguments:`, { companyCode, exchange, marker });

    setSelectedCompany(companyCode);
    setSelectedExchange(exchange || null);

    if (companyCode && exchange) {
      const formattedSymbol = validateAndFormatSymbol(companyCode, exchange, marker);
      console.log(`✅ [handleCompanyChange] Formatted symbol: ${formattedSymbol}`);
      setSelectedSymbol(formattedSymbol);
    } else {
      setSelectedSymbol('');
    }
  }, [validateAndFormatSymbol]);

  const handleDateChange = useCallback((date: string) => {
    console.log(`Date changed to: ${date}`);
    setCurrentDate(date);
  }, []);

  // Subscription Handlers
  const handleSubscribeCompanies = useCallback(async (companyCodes: string[]) => {
    if (!companyCodes || companyCodes.length === 0) return;

    if (!socketRef.current || !socketRef.current.connected) {
      toast.error('Not connected to server. Please wait for connection.');
      return;
    }

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

      socketRef.current.emit('subscribe_companies', {
        symbols: fyersSymbols,
        companyCodes: companyCodes
      }, (response: any) => {
        setIsSubscribing(false);

        if (response && response.success) {
          console.log('✅ Subscription successful:', response);
          toast.success(`Successfully subscribed to ${response.count || fyersSymbols.length} companies`);

          fyersSymbols.forEach(s => isSubscribedRef.current.add(s));
          
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
    console.log('✅ Connected to server');
    setSocketStatus('Connected');
    setIsReconnecting(false);

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
            setActiveSymbols(response.active_symbols);
          }
          if (response.total_data_points) {
            setBackgroundDataPoints(response.total_data_points);
          }
        }
      });

      if (selectedSymbol && !isSubscribedRef.current.has(selectedSymbol)) {
        console.log('🔄 Re-subscribing to symbol after reconnection:', selectedSymbol);
        socketRef.current.emit('subscribe', { symbol: selectedSymbol }, (response: any) => {
          if (response && response.success) {
            isSubscribedRef.current.add(selectedSymbol);
            console.log(`✅ Successfully re-subscribed to ${selectedSymbol}`);
          }
        });
      }
    }
  }, [selectedSymbol]);

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

    updateCountRef.current++;
    setLastDataReceived(new Date());
    setDataCount(prev => prev + 1);

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
        const startOfMinuteVolume = symbolVolumeMap.get(minuteTs) || cumulativeVolume;
        const volumeDelta = Math.max(0, cumulativeVolume - startOfMinuteVolume);
        
        candleMap.set(minuteTs, {
          ...existingCandle,
          high: Math.max(existingCandle.high, price),
          low: Math.min(existingCandle.low, price),
          close: price,
          volume: volumeDelta
        });
      } else {
        // Create new candle for this minute
        // Store the cumulative volume at the START of this new minute
        // This is used to calculate delta for the entire minute
        symbolVolumeMap.set(minuteTs, cumulativeVolume);
        
        // Clean up old minute entries (keep only last 1000 minutes)
        const sortedMinutes = Array.from(symbolVolumeMap.keys()).sort((a, b) => a - b);
        while (sortedMinutes.length > 1000) {
          const oldMinute = sortedMinutes.shift();
          if (oldMinute) symbolVolumeMap.delete(oldMinute);
        }
        
        candleMap.set(minuteTs, {
          timestamp: minuteTs,
          open: price,
          high: price,
          low: price,
          close: price,
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
  }, []);

  const handleHistoricalData = useCallback((data: { symbol: string, data: MarketData[] }) => {
    if (!data || !data.symbol || !Array.isArray(data.data)) return;

    console.log(`📈 Received historical data for ${data.symbol}: ${data.data.length} points`);

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
      setMarketData(prev => ({
        ...prev,
        [data.symbol]: sortedData[sortedData.length - 1]
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
  }, []);

  const handleOhlcData = useCallback((data: { symbol: string, data: OHLCData[] }) => {
    if (!data || !data.symbol || !Array.isArray(data.data)) {
      console.warn(`📊 Invalid OHLC data received:`, data);
      return;
    }

    console.log(`📊 Received OHLC data for ${data.symbol}: ${data.data.length} candles`);
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
      
      // Add existing candles first (historical backfill)
      existingCandles.forEach(candle => {
        candleMap.set(candle.timestamp, candle);
      });
      
      // Add/update with new candles (real-time takes priority)
      data.data.forEach(candle => {
        candleMap.set(candle.timestamp, candle);
      });
      
      // Convert to sorted array
      const merged = Array.from(candleMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`📊 [handleOhlcData] Merged: ${existingCandles.length} existing + ${data.data.length} new = ${merged.length} total`);
      
      return {
        ...prev,
        [data.symbol]: merged
      };
    });
  }, []);

  const handleHeartbeat = useCallback((data: any) => {
    if (!data) return;

    setTradingHours(prev => ({
      ...prev,
      current: new Date().toISOString(),
      isActive: data.trading_active || false
    }));

    if (data.active_symbols && Array.isArray(data.active_symbols)) {
      setActiveSymbols(data.active_symbols);
    }
    if (typeof data.total_cached_points === 'number') {
      setBackgroundDataPoints(data.total_cached_points);
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
      setUpdateFrequency(frequency);
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

  // Health check for prediction services
  useEffect(() => {
    if (!isClient) return;

    const checkPredictionServicesHealth = async () => {
      setIsCheckingHealth(true);

      try {
        const predictionHealth = await PredictionAPIService.checkHealth({ timeout: 5000 });
        setPredictionServiceHealth(predictionHealth ? 'available' : 'unavailable');
        console.log('✅ [Health Check] Prediction service:', predictionHealth ? 'available' : 'unavailable');
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
  }, [isClient]);

  // Fetch subscription status from JSON files
  useEffect(() => {
    if (!isClient) return;

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
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;

    console.log('🚀 Initializing WebSocket connection...');

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
      if (selectedSymbol && socketRef.current) {
        console.log('🔄 Re-subscribing to symbol after reconnection:', selectedSymbol);
        isSubscribedRef.current.clear();
        socketRef.current.emit('subscribe', { symbol: selectedSymbol }, (response: any) => {
          if (response && response.success) {
            isSubscribedRef.current.add(selectedSymbol);
            console.log(`✅ Successfully re-subscribed to ${selectedSymbol} after reconnection`);
          }
        });
      }
    });

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
    };
  }, [isClient, selectedSymbol, handleConnect, handleDisconnect, handleError, handleSubscriptionError, handleMarketDataUpdate, handleChartUpdate, handleHistoricalData, handleOhlcData, handleHeartbeat]);

  // Fetch historical data on symbol change
  useEffect(() => {
    if (!isClient || !selectedSymbol || !socketRef.current) return;

    const socket = socketRef.current;

    if (isSubscribedRef.current.has(selectedSymbol)) {
      console.log(`Already subscribed to ${selectedSymbol}`);
      return;
    }

    console.log('🔄 Subscribing to symbol:', selectedSymbol);

    socket.emit('subscribe', { symbol: selectedSymbol }, (response: any) => {
      if (response && response.success) {
        isSubscribedRef.current.add(selectedSymbol);
        console.log(`✅ Successfully subscribed to ${selectedSymbol}`);
      }
    });

    /**
     * ROBUST HISTORICAL DATA BACKFILL
     * 
     * This function handles three scenarios:
     * 1. After market hours: Fetch ENTIRE day's data from external server (6969)
     * 2. Mid-day subscription: Broker only sends data from subscription time,
     *    so we backfill from 9:15 AM to subscription time from external server
     * 3. Market open with full data: No backfill needed
     */
    const fetchAndBackfillHistoricalData = async () => {
      // Check if we already backfilled this symbol (with date key)
      const backfillKey = `${selectedSymbol}_${effectiveDate || new Date().toISOString().split('T')[0]}`;
      if (backfilledSymbolsRef.current.has(backfillKey)) {
        console.log(`📡 [Backfill] Already backfilled ${backfillKey}, skipping`);
        return;
      }
      
      setIsLoadingHistorical(true);
      setHistoricalDataStatus('Checking data completeness...');

      try {
        const currentDate = effectiveDate || new Date().toISOString().split('T')[0];
        const marketStatus = isMarketOpen();
        const isAfterMarket = marketStatus.reason === 'after-market';
        
        console.log(`📡 [Backfill] Symbol: ${selectedSymbol}, Date: ${currentDate}, Market: ${marketStatus.isOpen ? 'OPEN' : marketStatus.reason}`);
        
        // Always fetch external data to fill any gaps
        // After market: need full day
        // During market: fill gaps from 9:15 AM to now
        setHistoricalDataStatus(`Fetching ${isAfterMarket ? 'full day' : 'historical'} data...`);
        
        const result = await fetchHistoricalData(selectedSymbol, currentDate);

        if (result.success && result.data.length > 0) {
          console.log(`✅ [Backfill] Fetched ${result.data.length} ticks, ${result.ohlc?.length || 0} candles from external server`);
          
          // Mark as backfilled
          backfilledSymbolsRef.current.add(backfillKey);
          
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
          setHistoricalDataStatus(isAfterMarket 
            ? 'After-market: No data available for this date' 
            : 'Using real-time data only');
        }
      } catch (error) {
        console.error(`❌ [Backfill] Error:`, error);
        setHistoricalDataStatus('Failed to load historical data');
      } finally {
        setIsLoadingHistorical(false);
        setTimeout(() => setHistoricalDataStatus(''), 5000);
      }
    };

    // Delay fetch slightly to allow WebSocket data to arrive first
    const fetchTimer = setTimeout(() => {
      fetchAndBackfillHistoricalData();
    }, 1500); // Increased delay to 1.5s to let real-time data arrive first

    return () => {
      clearTimeout(fetchTimer);

      if (isSubscribedRef.current.has(selectedSymbol)) {
        console.log('🛑 Unsubscribing from:', selectedSymbol);
        socket.emit('unsubscribe', { symbol: selectedSymbol });
        isSubscribedRef.current.delete(selectedSymbol);
      }
    };
  }, [selectedSymbol, isClient, effectiveDate]);

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

  // Connection Health Monitor
  useEffect(() => {
    if (!isClient || !socketRef.current || !selectedSymbol) return;

    const STALE_THRESHOLD = 60000;

    const healthCheckInterval = setInterval(() => {
      const socket = socketRef.current;
      if (!socket) return;

      const isConnected = isSocketConnected();
      const timeSinceLastData = lastDataReceived
        ? Date.now() - lastDataReceived.getTime()
        : null;

      if (isConnected && tradingHours.isActive && timeSinceLastData && timeSinceLastData > STALE_THRESHOLD) {
        console.warn('⚠️ Connection appears stale (no data for 60s), forcing reconnection...');
        isSubscribedRef.current.clear();
        socket.disconnect();
        setTimeout(() => {
          socket.connect();
        }, 1000);
      }
    }, 30000);

    return () => clearInterval(healthCheckInterval);
  }, [isClient, selectedSymbol, lastDataReceived, tradingHours.isActive]);

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
  
  const chartData = useMemo(() => {
    console.log(`📈 [chartData] symbolOhlc: ${symbolOhlc?.length || 0}, symbolHistory: ${symbolHistory?.length || 0}`);
    
    // ===== USE OHLC DATA DIRECTLY (this is the correct data for candlesticks) =====
    if (symbolOhlc && symbolOhlc.length > 0) {
      // Filter valid candles and sort by timestamp
      const validCandles = symbolOhlc
        .filter(candle => 
          candle.timestamp > 0 &&
          typeof candle.open === 'number' && !isNaN(candle.open) && candle.open > 0 &&
          typeof candle.high === 'number' && !isNaN(candle.high) && candle.high > 0 &&
          typeof candle.low === 'number' && !isNaN(candle.low) && candle.low > 0 &&
          typeof candle.close === 'number' && !isNaN(candle.close) && candle.close > 0
        )
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log(`📈 [chartData] Using ${validCandles.length} valid OHLC candles`);
      
      if (validCandles.length > 0) {
        console.log(`📈 First candle:`, validCandles[0]);
        console.log(`📈 Last candle:`, validCandles[validCandles.length - 1]);
      }

      return validCandles.map(candle => ({
        interval_start: new Date(candle.timestamp * 1000).toISOString(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: Math.max(0, candle.volume || 0),
      }));
    }
    
    // ===== FALLBACK: Create candles from historical tick data =====
    if (symbolHistory && symbolHistory.length > 0) {
      console.log(`📈 [chartData] Creating candles from historical tick data`);
      
      // Group ticks by minute and create proper OHLC candles
      const minuteCandles = new Map<number, { open: number, high: number, low: number, close: number, volume: number, firstTimestamp: number }>();
      
      const sortedHistory = [...symbolHistory]
        .filter(p => p.ltp > 0 && !isNaN(p.ltp))
        .sort((a, b) => a.timestamp - b.timestamp);
      
      // Track cumulative volume for delta calculation
      let prevCumulativeVolume = 0;
      
      sortedHistory.forEach((p, index) => {
        const minuteTs = Math.floor(p.timestamp / 60) * 60;
        const price = p.ltp;
        
        // Calculate volume delta
        const currentCumulativeVolume = p.volume || 0;
        let deltaVolume = 0;
        if (index > 0 && currentCumulativeVolume >= prevCumulativeVolume) {
          deltaVolume = currentCumulativeVolume - prevCumulativeVolume;
        }
        prevCumulativeVolume = currentCumulativeVolume;
        
        const existing = minuteCandles.get(minuteTs);
        
        if (!existing) {
          // First tick for this minute - create new candle
          minuteCandles.set(minuteTs, {
            open: price,
            high: price,
            low: price,
            close: price,
            volume: deltaVolume,
            firstTimestamp: p.timestamp,
          });
        } else {
          // Update existing candle with new tick
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price; // Last price becomes close
          existing.volume += deltaVolume;
        }
      });
      
      // Convert to array and sort
      const result = Array.from(minuteCandles.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([timestamp, candle]) => ({
          interval_start: new Date(timestamp * 1000).toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }));
      
      console.log(`📈 [chartData] Created ${result.length} minute candles from ${sortedHistory.length} ticks`);
      if (result.length > 0) {
        console.log(`📈 First candle:`, result[0]);
        console.log(`📈 Last candle:`, result[result.length - 1]);
      }
      
      return result;
    }

    return [];
  }, [symbolOhlc, symbolHistory]);

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
                  <BreadcrumbPage>Live Market Data</BreadcrumbPage>
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

  const pageTitle = selectedCompany ? `${selectedCompany} - Live Market` : "Live Market Data";

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

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <span className={`inline-block w-2 h-2 rounded-full ${socketStatus === 'Connected'
                ? 'bg-green-500 animate-pulse'
                : isReconnecting
                  ? 'bg-yellow-500 animate-pulse'
                  : socketStatus === 'Error' || subscriptionErrors
                    ? 'bg-orange-500'
                    : 'bg-red-500'
                }`}></span>
              <span className={`text-sm ${socketStatus === 'Connected'
                ? 'text-green-600 dark:text-green-400'
                : isReconnecting
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400'
                }`}>
                {socketStatus === 'Connected' ? 'Connected' :
                  socketStatus === 'Error' ? 'Connected' :
                    isReconnecting ? 'Reconnecting...' :
                      socketStatus.startsWith('Disconnected') ? 'Disconnected' : socketStatus}
                {isReconnecting && ' 🔄'}
              </span>
            </div>

            {/* Subscription Manager Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubscribeAll}
                disabled={isSubscribing || !companies.length}
                className="h-9"
              >
                {isSubscribing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
                ) : (
                  <ListChecks className="mr-2 h-4 w-4 text-green-500" />
                )}
                Subscribe All
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSubscriptionModalOpen(true)}
                disabled={isSubscribing}
                className="h-9 w-9"
                title="Manage Subscriptions"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Prediction Service Status */}
            {predictionServiceHealth === 'checking' || isCheckingHealth ? (
              <div className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                Checking...
              </div>
            ) : predictionServiceHealth === 'unavailable' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      disabled
                      className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-600 cursor-not-allowed flex items-center gap-1.5"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Prediction Unavailable
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-white">
                    <p className="text-xs">Prediction service is not responding. Please check if the server is running.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <button
                onClick={() => setShowPredictions(!showPredictions)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${showPredictions
                  ? 'bg-[#dbeafe] text-blue-600 hover:bg-[#cddcfe]'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                <Activity className="h-3.5 w-3.5" />
                {showPredictions ? 'Predictions ON' : 'Predictions OFF'}
              </button>
            )}

            {/* GTT Service Status */}
            {gttServiceHealth === 'checking' || isCheckingHealth ? (
              <div className="px-3 py-1 rounded text-sm font-medium bg-gray-200 text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                GTT...
              </div>
            ) : gttServiceHealth === 'unavailable' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      disabled
                      className="px-3 py-1 rounded text-sm font-medium bg-orange-100 text-orange-600 cursor-not-allowed flex items-center gap-1.5"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      GTT Unavailable
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-700 text-white">
                    <p className="text-xs">GTT prediction service is not responding. Please check if the GTT server is running.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <button
                onClick={() => setIsGttEnabled(!isGttEnabled)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${isGttEnabled
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                <Zap className="h-3.5 w-3.5" />
                {isGttEnabled ? 'GTT ON' : 'GTT OFF'}
              </button>
            )}

            <ModeToggle />
          </div>
        </header>

        {/* Market Closed Banner */}
        {!marketOpen && (
          <div className="border-b">
            <MarketClosedBanner />
          </div>
        )}

        {/* MAIN CONTENT ROW */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: CHART & ANALYSIS SPLIT */}
          <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">

            {/* Upper: Chart */}
            <div
              className="relative border-b flex flex-col transition-[flex-basis] duration-300 ease-in-out overflow-hidden"
              style={{ flex: isAnalysisVisible ? '0 0 55%' : '1 1 auto' }}
            >
              {selectedCompany && marketOpen ? (
                <div className="relative w-full h-full flex flex-col">
                  <LightWeightStockChart
                    companyId={selectedCompany}
                    data={chartData}
                    interval="1m"
                    loading={isLoadingHistorical}
                    height="100%"
                    className="w-full h-full"
                    theme={theme === 'light' ? 'light' : 'dark'}
                    defaultChartType="line"
                  />
                </div>
              ) : !selectedCompany ? (
                <div className="flex h-full items-center justify-center text-muted-foreground p-8 text-center flex-col gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Database size={32} />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Select a Company</h2>
                  <p className="max-w-md">
                    Select a company from the sidebar to view live market data and charts.
                  </p>
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center p-0">
                  <MarketClosedBanner className="w-full h-full flex items-center justify-center" />
                </div>
              )}
            </div>

            {/* Toggle Button Bar - Fixed Height */}
            {selectedCompany && (
              <div className="flex-none flex items-center justify-center border-b bg-muted/20 hover:bg-muted/40 transition-colors py-1 cursor-pointer z-10" onClick={() => setIsAnalysisVisible(!isAnalysisVisible)}>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 opacity-70 hover:opacity-100">
                  {isAnalysisVisible ? (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Hide Analysis
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      Show Analysis
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Lower: Analysis Panel (Collapsible) */}
            {selectedCompany && isAnalysisVisible && marketOpen && (
              <div className="flex-1 min-h-0 flex flex-col bg-background/50 overflow-hidden animate-in slide-in-from-bottom-5 duration-300 fade-in">
                <Tabs defaultValue="predictions" className="flex-1 flex flex-col min-h-0">
                  <div className="border-b px-4 bg-muted/20 shrink-0">
                    <TabsList className="h-9">
                      <TabsTrigger value="predictions" className="text-xs">AI Predictions & GTT</TabsTrigger>
                      <TabsTrigger value="charts" className="text-xs">LSTM-AE & SIPR</TabsTrigger>
                      <TabsTrigger value="livedata" className="text-xs">Live Data</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    <TabsContent value="predictions" className="h-full m-0">
                      <ScrollArea className="h-full w-full">
                        <div className="p-4">
                          {/* Horizontal Grid Layout */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {/* Prediction Controls */}
                            {showPredictions && (
                              <>
                                <Card className="col-span-1">
                                  <CardHeader>
                                    <CardTitle className="text-sm">Prediction Controls</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <PredictionControlPanel
                                      isPolling={isPolling}
                                      elapsedTime={elapsedTime}
                                      timeRemaining={timeRemaining}
                                      progressPercentage={progressPercentage}
                                      pollCount={pollCount}
                                      nextPollTime={nextPollTime}
                                      onStart={startPolling}
                                      onPause={pausePolling}
                                      onStop={stopPolling}
                                      onRefresh={handleManualRefresh}
                                      disabled={predictionLoading}
                                    />
                                  </CardContent>
                                </Card>

                                <Card className="col-span-1">
                                  <CardHeader>
                                    <CardTitle className="text-sm">Next Poll Timer</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <PredictionTimer
                                      timeUntilNextPoll={timeUntilNextPoll}
                                      nextPollTime={nextPollTime}
                                      isPolling={isPolling}
                                      onTimerEnd={handleTimerEnd}
                                    />
                                  </CardContent>
                                </Card>

                                {predictions && (
                                  <Card className="col-span-1 lg:col-span-2 xl:col-span-1">
                                    <CardHeader>
                                      <CardTitle className="text-sm">Prediction Data</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <PredictionOverlay
                                        predictions={predictions}
                                        company={selectedCompany || selectedSymbol}
                                        dataAge={predictionDataAge}
                                        isStale={isDataStale}
                                      />
                                    </CardContent>
                                  </Card>
                                )}
                              </>
                            )}

                            {/* GTT Status */}
                            {isGttEnabled && (
                              <Card className="col-span-1">
                                <CardHeader>
                                  <CardTitle className="text-sm flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-purple-500" />
                                    GTT Engine Status
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  {gttLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading GTT predictions...</div>
                                  ) : gttError ? (
                                    <div className="text-sm text-red-500">{gttError}</div>
                                  ) : gttChartData ? (
                                    <div className="text-sm text-green-500">GTT predictions loaded successfully</div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">No GTT data available</div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        </div>
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
                        <div className="p-4">
                          {!selectedCompany ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                              <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-700/50 rounded-full">
                                <Building2 className="w-10 h-10 text-zinc-500" />
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-zinc-300">No Company Selected</h3>
                                <p className="text-sm text-zinc-500 max-w-xs">
                                  Select a company from the sidebar to view live market data
                                </p>
                              </div>
                            </div>
                          ) : currentData ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                              {/* Price Display with OHLC and Trading Info */}
                              <Card className={`col-span-1 md:col-span-2 ${
                                overallSentiment === 'POSITIVE'
                                  ? 'bg-gradient-to-br from-green-500/5 to-transparent border-green-500/20'
                                  : overallSentiment === 'NEGATIVE'
                                  ? 'bg-gradient-to-br from-red-500/5 to-transparent border-red-500/20'
                                  : 'bg-gradient-to-br from-zinc-500/5 to-transparent'
                              }`}>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm flex items-center justify-between">
                                    <span>{selectedSymbol}</span>
                                    <div className="flex items-center gap-2">
                                      {/* Sentiment Badge */}
                                      {isSentimentFetching ? (
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400"></div>
                                          <span className="text-xs text-muted-foreground">Loading...</span>
                                        </div>
                                      ) : (
                                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                          overallSentiment === 'POSITIVE'
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                                            : overallSentiment === 'NEGATIVE'
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                                            : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/40'
                                        }`}>
                                          {overallSentiment === 'POSITIVE' ? 'Positive' : overallSentiment === 'NEGATIVE' ? 'Negative' : 'Neutral'}
                                        </div>
                                      )}
                                      <div className="text-xs text-green-400 animate-pulse">LIVE •</div>
                                    </div>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  {/* Current Price */}
                                  <div>
                                    <div className="text-2xl font-bold mb-1">₹{formatPrice(currentData.ltp)}</div>
                                    <div className={`text-sm ${getChangeClass(currentData.change)}`}>
                                      {formatChange(currentData.change, currentData.changePercent)}
                                    </div>
                                  </div>

                                  {/* OHLC Data */}
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-2">OHLC Data</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">Open</div>
                                        <div className="text-sm font-semibold">₹{formatPrice(currentData.open)}</div>
                                      </div>
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">Close</div>
                                        <div className="text-sm font-semibold">₹{formatPrice(currentData.close)}</div>
                                      </div>
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">High</div>
                                        <div className="text-sm font-semibold">₹{formatPrice(currentData.high)}</div>
                                      </div>
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">Low</div>
                                        <div className="text-sm font-semibold">₹{formatPrice(currentData.low)}</div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Trading Info */}
                                  <div>
                                    <div className="text-xs font-semibold text-muted-foreground mb-2">Trading Info</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">Volume</div>
                                        <div className="text-sm font-semibold">{currentData.volume?.toLocaleString() || '0'}</div>
                                      </div>
                                      <div className="bg-muted p-2 rounded">
                                        <div className="text-xs text-muted-foreground">Updated</div>
                                        <div className="text-sm font-semibold text-green-400">
                                          {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Desirability Panel */}
                              <Card className="col-span-1 md:col-span-2">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-sm">Desirability Score</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <DesirabilityPanel
                                    score={desirabilityScore}
                                    classification={desirabilityClassification}
                                    loading={desirabilityLoading}
                                    onFetch={handleFetchDesirabilityScore}
                                    data={desirabilityData}
                                  />
                                </CardContent>
                              </Card>

                              {/* Technical Indicators */}
                              {(currentData.sma_20 || currentData.ema_9 || currentData.rsi_14) && (
                                <Card className="col-span-1">
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-sm">Technical Indicators</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-3 gap-2">
                                      {currentData.sma_20 && (
                                        <div className="bg-muted p-2 rounded">
                                          <div className="text-xs text-orange-500">SMA 20</div>
                                          <div className="text-sm font-semibold">₹{formatPrice(currentData.sma_20)}</div>
                                        </div>
                                      )}
                                      {currentData.ema_9 && (
                                        <div className="bg-muted p-2 rounded">
                                          <div className="text-xs text-purple-500">EMA 9</div>
                                          <div className="text-sm font-semibold">₹{formatPrice(currentData.ema_9)}</div>
                                        </div>
                                      )}
                                      {currentData.rsi_14 && (
                                        <div className="bg-muted p-2 rounded">
                                          <div className="text-xs text-cyan-500">RSI 14</div>
                                          <div className="text-sm font-semibold">{currentData.rsi_14.toFixed(2)}</div>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                              <p className="text-zinc-400 text-sm">Connecting...</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>

          {/* RIGHT: SIDEBAR (Company List) */}
          <div className="w-72 border-l bg-background flex flex-col shrink-0 transition-all duration-300">
            <div className="flex-1 overflow-hidden">
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
              />
            </div>
          </div>

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

export default MarketDataPage;
