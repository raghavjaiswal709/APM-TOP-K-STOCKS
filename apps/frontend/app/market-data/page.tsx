'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getSocket, onReconnect, isSocketConnected } from '@/lib/socket';
import dynamic from 'next/dynamic';
import { AppSidebar } from "@/app/components/app-sidebar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Add to existing imports at the top
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
import { Card, CardContent } from "@/components/ui/card";
import { WatchlistSelector } from "@/app/components/controllers/WatchlistSelector2/WatchlistSelector";
import { ImageCarousel } from "./components/ImageCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { TrendingUp, TrendingDown, Minus, Wifi, Award, Clock, Building2, Database, AlertCircle, WifiOff, Activity } from 'lucide-react';
import { MarketClosedBanner } from "@/app/components/MarketClosedBanner";
import { isMarketOpen } from "@/lib/marketHours";
import { fetchHistoricalData, detectDataGaps } from "@/lib/historicalDataFetcher";
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

declare global {
  interface Window {
    __latestCompanySentiment?: any;
  }
}

const PlotlyChart = dynamic(() => import('./components/charts/PlotlyChart'), {
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

const MarketDataPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');

  // Prediction Integration State
  const [showPredictions, setShowPredictions] = useState(true);
  const [predictionMode, setPredictionMode] = useState<'overlay' | 'comparison'>('overlay');
  // onst[isGttEnabled, setIsGttEnabled] = useState<boolean>(false);
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
  // const [usefulnessScore, setUsefulnessScore] = useState<number | null>(null);
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'predictions'>('live');
  const [marketOpen, setMarketOpen] = useState<boolean>(true);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [historicalDataStatus, setHistoricalDataStatus] = useState<string>('');
  const [overallSentiment, setOverallSentiment] = useState<string>('NEUTRAL');
  const [isSentimentFetching, setIsSentimentFetching] = useState<boolean>(false);
  // Subscription Management State
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  // Subscription error state for failed symbols
  const [subscriptionErrors, setSubscriptionErrors] = useState<{
    code: number;
    message: string;
    invalidSymbols: string[];
    timestamp: number;
  } | null>(null);
  const [failedSymbols, setFailedSymbols] = useState<string[]>([]);
  const [stoppedSymbols, setStoppedSymbols] = useState<string[]>([]);
  const [permanentlyStoppedSymbols, setPermanentlyStoppedSymbols] = useState<string[]>([]);
  // Lifted state for date synchronization
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const [filteredCompanies, setFilteredCompanies] = useState<any[]>([]);

  // Shared X-Axis state for chart synchronization
  const [sharedXRange, setSharedXRange] = useState<[Date, Date] | undefined>(undefined);

  // Fullscreen mode state for chart section
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

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
    selectedDate: hookSelectedDate, // Rename to avoid confusion
    availableDates,
  } = useWatchlist({ date: currentDate || undefined });


  // Date Synchronization Logic

  // Determine the effective date (either user-selected or hook-default)
  const effectiveDate = currentDate || hookSelectedDate;
  // Calculate the latest available date from the dataset
  const latestAvailableDate = useMemo(() => {
    if (!availableDates || availableDates.length === 0) return null;
    return [...availableDates].sort().reverse()[0];
  }, [availableDates]);
  // Determine if the currently selected date is the latest one
  const isLatestDate = useMemo(() => {
    if (!effectiveDate || !latestAvailableDate) return true;
    return effectiveDate === latestAvailableDate;
  }, [effectiveDate, latestAvailableDate]);
  // NOTE: Auto-close effect removed so user can view past data in modal

  // Refs
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const frequencyIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const socketRef = useRef<any>(null);
  const isSubscribedRef = useRef<Set<string>>(new Set());




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
    updateTrigger, // Get update trigger from hook
    elapsedTime,
    timeRemaining,
    pollCount,
    progressPercentage,
    nextPollTime,
    timeUntilNextPoll,
  } = usePredictionPolling({
    company: selectedCompany || selectedSymbol.split(':')[1]?.split('-')[0] || '',
    pollInterval: 5 * 60 * 1000, // 5 minutes
    totalDuration: 25 * 60 * 1000, // 25 minutes
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
    pollInterval: 60000 // 1 minute
  });
  // Transform GTT data for the chart
  const gttChartData = useMemo(() => {
    if (!rawGttPredictions) return null;
    return transformGttToChartPredictions(rawGttPredictions);
  }, [rawGttPredictions]);
  const {
    score: desirabilityScore,
    classification: desirabilityClassification,
    loading: desirabilityLoading,
    error: desirabilityError,
    data: desirabilityData, // <--- Add this line
    refetch: refetchDesirability,
  } = useDesirability(selectedSymbol);

  // Alias for the button
  const isLoadingDesirability = desirabilityLoading;

  // Manual fetch handler
  const handleFetchDesirabilityScore = useCallback(() => {
    refetchDesirability();
  }, [refetchDesirability]);

  // Helper for description text
  const desirabilityDescription = useMemo(() => {
    if (!desirabilityScore) return 'N/A';
    if (desirabilityScore >= 0.7) return 'Highly Desirable';
    if (desirabilityScore >= 0.5) return 'Moderately Desirable';
    if (desirabilityScore >= 0.3) return 'Acceptable';
    return 'Not Desirable';
  }, [desirabilityScore]);

  // Use updateTrigger directly from hook
  const predictionRevision = useMemo(() => {
    if (!predictions || predictions.count === 0) return 0;
    // Use updateTrigger as the revision counter
    return updateTrigger;
  }, [predictions, updateTrigger]);

  // Stable callback using refs
  const handleTimerEnd = useCallback(async () => {
    console.log('⏰ [TIMER END] Timer reached 0 - triggering immediate refresh');

    try {
      const result = await refetchPredictions();
      console.log('✅ [TIMER END] Refresh completed:', result?.count || 0, 'predictions');
    } catch (error) {
      console.error('❌ [TIMER END] Refresh failed:', error);
    }
  }, [refetchPredictions]);

  // Stable callback for manual refresh
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
    // Preserve valid special chars (e.g., '&' in M&MFIN, '-' in BAJAJ-AUTO) while stripping whitespace
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
  // const getScoreEvaluation = useCallback((score: number) => {
  //   if (score >= 80) return { text: 'Great', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/40' };
  //   if (score >= 60) return { text: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/40' };
  //   if (score >= 40) return { text: 'Average', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40' };
  //   return { text: 'Poor', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/40' };
  const handleDateChange = useCallback((date: string) => {
    console.log(`Date changed to: ${date}`);
    setCurrentDate(date);
  }, []);


  // Subscription Handlers

  const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ FIXED: Use WebSocket directly to Python Fyers service (port 5001) instead of HTTP API
  // This sends subscription requests directly to fyers_new_5001.py which handles unlimited companies
  const handleSubscribeCompanies = useCallback(async (companyCodes: string[]) => {
    if (!companyCodes || companyCodes.length === 0) return;

    if (!socketRef.current || !socketRef.current.connected) {
      toast.error('Not connected to server. Please wait for connection.');
      return;
    }

    setIsSubscribing(true);
    try {
      console.log(`📤 Sending subscription request for ${companyCodes.length} companies via WebSocket to port 5001`);

      // ✅ Convert company codes to Fyers format symbols (NSE:CODE-EQ)
      // ✅ Filter out STOPPED/invalid companies
      const fyersSymbols = companyCodes
        .map(code => {
          // Find the company in our list to get exchange and marker
          const company = companies?.find((c: any) => c.company_code === code);
          const exchange = company?.exchange || 'NSE';
          const marker = company?.marker || 'EQ';
          
          // Skip STOPPED or invalid markers
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

      // ✅ Use socket.emit to send directly to Python fyers_new_5001.py service
      socketRef.current.emit('subscribe_companies', {
        symbols: fyersSymbols,
        companyCodes: companyCodes
      }, (response: any) => {
        setIsSubscribing(false);

        if (response && response.success) {
          console.log('✅ Subscription successful:', response);
          toast.success(`Successfully subscribed to ${response.count || fyersSymbols.length} companies`);

          // Update subscribed set
          fyersSymbols.forEach(s => isSubscribedRef.current.add(s));
          
          // Determine which symbols were successfully subscribed
          const failedSymbols = response.failed || response.invalid_symbols || [];
          const successfulSymbols = fyersSymbols.filter((s: string) => !failedSymbols.includes(s));
          
          // Report successful subscriptions to backend
          if (successfulSymbols.length > 0) {
            console.log('💾 Saving successful subscriptions:', successfulSymbols.length);
            fetch('/api/admin/subscribed-companies', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbols: successfulSymbols }),
            }).catch(err => console.error('Failed to save successful subscriptions:', err));
          }
          
          // Check if there were any failed symbols in the response
          if (response.failed && response.failed.length > 0) {
            console.log('⚠️ Some symbols failed:', response.failed);
            // Report failed symbols to backend
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
          
          // Check for invalid_symbols in error response
          const invalidSymbols = response?.invalid_symbols || response?.invalidSymbols || [];
          if (invalidSymbols.length > 0) {
            console.log('🚫 Invalid symbols detected:', invalidSymbols);
            // Report to backend
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

      // Fallback timeout in case callback doesn't fire
      setTimeout(() => {
        setIsSubscribing(false);
      }, 30000);

    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      toast.error(error.message || 'Failed to update subscriptions');
      setIsSubscribing(false);
    }
  }, [companies]); // ✅ Removed isSubscribing to avoid stale closure issues

  // Remove date restriction from Subscribe All
  const handleSubscribeAll = useCallback(() => {
    if (isSubscribing) {
      toast.warning("Subscription already in progress");
      return;
    }

    if (!companies || companies.length === 0) {
      toast.error("No companies available");
      return;
    }

    // ✅ Clear any pending subscription
    if (subscriptionTimeoutRef.current) {
      clearTimeout(subscriptionTimeoutRef.current);
    }

    const targetList = filteredCompanies.length > 0 ? filteredCompanies : companies;

    // ✅ FIXED: Send company_code (not formatted symbols) to backend
    const companyCodes = targetList.map((c: any) => c.company_code).filter(Boolean);

    handleSubscribeCompanies(companyCodes);
  }, [companies, handleSubscribeCompanies, isSubscribing, filteredCompanies]); // ✅ Removed validateAndFormatSymbol dependency

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

    // Check if this is a subscription error
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
      // Don't set socketStatus for subscription errors - they're handled separately
      console.error('🚫 Subscription error detected:', error);

      // Parse invalid_symbols from message if it's a string
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
      // Only set socketStatus for non-subscription errors
      setSocketStatus('Error');
    }
  }, []);

  // Dedicated handler for Fyers subscription errors
  const handleSubscriptionError = useCallback((error: any) => {
    console.error('🚫 Fyers subscription error:', error);

    // Parse the error - handle both direct object and string formats
    let errorData = error;
    let errorMessage = '';

    if (typeof error === 'string') {
      errorMessage = error;
      try {
        // Try to parse if it's JSON
        errorData = JSON.parse(error);
      } catch {
        errorData = { message: error };
      }
    } else if (error && typeof error === 'object') {
      errorMessage = error.message || JSON.stringify(error);
    }

    // Extract invalid_symbols from various formats
    let invalidSymbols: string[] = [];

    // Try to get from direct property
    if (Array.isArray(errorData.invalid_symbols)) {
      invalidSymbols = errorData.invalid_symbols;
    } else if (Array.isArray(errorData.invalidSymbols)) {
      invalidSymbols = errorData.invalidSymbols;
    }

    // If still empty, try to parse from message string
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
      // Report to backend
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

  // Clear subscription errors
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

      // Use Map for efficient deduplication and merging
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
  }, []);

  const handleHistoricalData = useCallback((data: { symbol: string, data: MarketData[] }) => {
    if (!data || !data.symbol || !Array.isArray(data.data)) return;

    console.log(`📈 Received historical data for ${data.symbol}: ${data.data.length} points`);

    const sortedData = [...data.data].sort((a, b) => a.timestamp - b.timestamp);

    // Merge socket historical data with existing data
    // This preserves the earlier historical data fetched from external API
    setHistoricalData(prev => {
      const existingData = prev[data.symbol] || [];
      const dataMap = new Map<number, MarketData>();

      // Add existing data first (preserves external API data)
      existingData.forEach(point => {
        dataMap.set(point.timestamp, point);
      });

      // Add new socket data (updates/adds new points)
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

      // Also merge chartUpdates instead of replacing
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
    if (!data || !data.symbol || !Array.isArray(data.data)) return;

    console.log(`📊 Received OHLC data for ${data.symbol}: ${data.data.length} candles`);
    const sortedData = [...data.data].sort((a, b) => a.timestamp - b.timestamp);

    setOhlcData(prev => ({
      ...prev,
      [data.symbol]: sortedData
    }));
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

  const getSentimentIndicator = useCallback((mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return {
          background: 'bg-gradient-to-r from-green-500/10 to-green-900/10 border-green-500/40',
          text: 'text-green-400',
          icon: TrendingUp,
          label: 'Positive Sentiment'
        };
      case 'loss':
        return {
          background: 'bg-gradient-to-r from-red-500/10 to-red-900/10 border-red-500/40',
          text: 'text-red-400',
          icon: TrendingDown,
          label: 'Overall Setinemt : Negative'
        };
      case 'neutral':
      default:
        return {
          background: 'bg-gradient-to-r from-zinc-500/30 to-zinc-600/20 border-zinc-500/40',
          text: 'text-zinc-400',
          icon: Minus,
          label: 'Neutral Sentiment'
        };
    }
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

      // Check regular prediction service health
      try {
        const predictionHealth = await PredictionAPIService.checkHealth({ timeout: 5000 });
        setPredictionServiceHealth(predictionHealth ? 'available' : 'unavailable');
        console.log('✅ [Health Check] Prediction service:', predictionHealth ? 'available' : 'unavailable');
      } catch (error) {
        console.warn('❌ [Health Check] Prediction service unavailable:', error);
        setPredictionServiceHealth('unavailable');
      }

      // Check GTT service health
      try {
        const gttHealth = await gttService.healthCheck();
        // GTT is available if either proxy or backend is responding
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

    // Re-check health every 2 minutes
    const healthCheckInterval = setInterval(checkPredictionServicesHealth, 120000);

    return () => clearInterval(healthCheckInterval);
  }, [isClient]);

  // Fetch subscription status from JSON files (all categories)
  useEffect(() => {
    if (!isClient) return;

    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/admin/subscription-status');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            // Update the subscription category states from JSON files
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

    // Refresh every 30 seconds
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
    socket.on('subscriptionError', handleSubscriptionError); // ✅ NEW: Listen for subscription errors
    socket.on('fyersError', handleSubscriptionError); // ✅ Also listen for Fyers-specific errors
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
      socket.off('subscriptionError', handleSubscriptionError); // ✅ NEW: Cleanup subscription error listener
      socket.off('fyersError', handleSubscriptionError); // ✅ Cleanup Fyers error listener
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

    // ✅ NEW: Fetch historical data from external server on symbol change
    const fetchAndBackfillHistoricalData = async () => {
      setIsLoadingHistorical(true);
      setHistoricalDataStatus('Fetching historical data...');

      try {
        console.log(`📡 Fetching historical data for ${selectedSymbol}...`);

        const result = await fetchHistoricalData(selectedSymbol, effectiveDate || new Date().toISOString().split('T')[0]);

        if (result.success && result.data.length > 0) {
          console.log(`✅ Fetched ${result.data.length} historical points from external server`);
          setHistoricalDataStatus(`Loaded ${result.data.length} historical data points`);

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

          // ✅ CRITICAL FIX: Use Map for efficient deduplication during merge
          setHistoricalData(prev => {
            const existingData = prev[selectedSymbol] || [];
            const dataMap = new Map<number, MarketData>();

            existingData.forEach(point => {
              dataMap.set(point.timestamp, point);
            });

            externalData.forEach(point => {
              dataMap.set(point.timestamp, point);
            });

            const mergedData = Array.from(dataMap.values())
              .sort((a, b) => a.timestamp - b.timestamp);

            const gapCheck = detectDataGaps(mergedData);
            if (gapCheck.hasGaps) {
              console.warn(`⚠️ Data still has ${gapCheck.missingRanges.length} gaps`);
              setHistoricalDataStatus(`Loaded ${mergedData.length} points (${gapCheck.missingRanges.length} gaps detected)`);
            } else {
              setHistoricalDataStatus(`Complete data: ${mergedData.length} points`);
            }

            return {
              ...prev,
              [selectedSymbol]: mergedData
            };
          });

          if (externalData.length > 0) {
            const latestData = externalData[externalData.length - 1];
            setMarketData(prev => ({
              ...prev,
              [selectedSymbol]: latestData
            }));
          }
        } else {
          console.warn(`⚠️ No historical data available: ${result.error || 'Unknown error'}`);
          setHistoricalDataStatus('No historical data available');
        }
      } catch (error) {
        console.error(`❌ Error fetching historical data:`, error);
        setHistoricalDataStatus('Failed to load historical data');
      } finally {
        setIsLoadingHistorical(false);
        setTimeout(() => setHistoricalDataStatus(''), 5000);
      }
    };

    const fetchTimer = setTimeout(() => {
      fetchAndBackfillHistoricalData();
    }, 1000);

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

        // Optional: Sync gradient mode if you want the whole UI to react
        // if (sentiment === 'POSITIVE') setGradientMode('profit');
        // else if (sentiment === 'NEGATIVE') setGradientMode('loss');
        // else setGradientMode('neutral');

      } catch (error) {
        console.error('Failed to fetch sentiment:', error);
        setOverallSentiment('NEUTRAL');
      } finally {
        setIsSentimentFetching(false);
      }
    };
    fetchSentiment();
  }, [selectedSymbol]);

  // ✨ DEBUG: Log prediction data
  useEffect(() => {
    console.log('🔮 Prediction State Changed:', {
      showPredictions,
      hasPredictions: !!predictions,
      predictionsCount: predictions?.count || 0
    });
  }, [predictions, showPredictions]);

  // 🔍 Connection Health Monitor
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

  // Loading state
  if (!isClient) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 w-full">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb className="flex items-center justify-end gap-2">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Market Data</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
                <ModeToggle />
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="container mx-auto p-4 bg-zinc-900 text-white flex items-center justify-center h-[80vh]">
              <div className="text-xl animate-pulse">Loading market data...</div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Main render
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 w-full">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-between w-full">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Live Market Data</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Card className="w-full">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Live Market</h3>

                  <div className="flex items-center space-x-4">
                    {isLoadingHistorical && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-blue-400">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                        <span>Loading historical data...</span>
                      </div>
                    )}
                    {historicalDataStatus && !isLoadingHistorical && (
                      <div className="mt-2 text-xs text-green-400">
                        ✅ {historicalDataStatus}
                      </div>
                    )}
                    <div>

                      {/* ✅ NEW: Subscription Error Indicator with Tooltip */}
                      {(subscriptionErrors || failedSymbols.length > 0) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="p-2 bg-red-950/50 rounded cursor-default">
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="max-w-sm bg-zinc-900 border-red-800 text-white p-3"
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-red-400 font-medium">
                                  <AlertCircle className="h-4 w-4" />
                                  <span>Subscription Error</span>
                                </div>
                                {subscriptionErrors && (
                                  <p className="text-xs text-zinc-400">
                                    Code: {subscriptionErrors.code} - {subscriptionErrors.message}
                                  </p>
                                )}
                                {failedSymbols.length > 0 && (
                                  <div className="text-xs text-zinc-300">
                                    <span className="text-red-400">{failedSymbols.length}</span> symbol(s) failed to subscribe
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-end gap-2 ml-4 border-l pl-4 h-12">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSubscribeAll}
                          disabled={isSubscribing || !companies.length} // ✅ Removed !isLatestDate
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
                        {/* Only show simple status, not full error message */}
                        {socketStatus === 'Connected' ? 'Connected' :
                          socketStatus === 'Error' ? 'Connected' :
                            isReconnecting ? 'Reconnecting...' :
                              socketStatus.startsWith('Disconnected') ? 'Disconnected' : socketStatus}
                        {isReconnecting && ' 🔄'}
                      </span>
                    </div>
                    {/* <button
                      onClick={() => setIsGttEnabled(!isGttEnabled)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${isGttEnabled
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      {isGttEnabled ? '⚡ GTT View ON' : '⚡ GTT View OFF'}
                    </button> */}

                    {/* Regular Prediction Service Status Button */}
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

                    {/* GTT Service Status Button */}
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
                  </div>
                </div>

                <div className="p-3 border border-opacity-30 rounded-md h-24 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 justify-between mr-4">
                      <WatchlistSelector
                        onCompanySelect={handleCompanyChange}
                        onDateChange={handleDateChange}
                        onFilteredDataChange={setFilteredCompanies} // <--- Pass the setter
                        showExchangeFilter={true}
                        showMarkerFilter={true}
                      />


                    </div>

                  </div>
                  <div className="flex items-center justify-end gap-3 text-sm">


                    {/* ✅ ENHANCED: Hover Card for Subscribed Companies */}
                    <HoverCard openDelay={200} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div className="p-3 bg-zinc-800 rounded w-auto cursor-pointer hover:bg-zinc-700 transition-colors">
                          <div className="flex items-center space-x-2 mb-2">
                            <Wifi className="h-4 w-4 text-green-500" />
                            <span className="text-green-400 font-medium">
                              Subscribed Companies ({activeSymbols.length})
                            </span>
                          </div>
                          <div className="max-h-20 overflow-y-auto">
                            {activeSymbols.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {activeSymbols.slice(0, 5).map(symbol => (
                                  <span
                                    key={symbol}
                                    className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded"
                                  >
                                    {symbol.split(':')[1]?.split('-')[0] || symbol}
                                  </span>
                                ))}
                                {activeSymbols.length > 5 && (
                                  <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded animate-pulse">
                                    +{activeSymbols.length - 5} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-500 text-xs">No active symbols</span>
                            )}
                          </div>
                        </div>
                      </HoverCardTrigger>

                      <HoverCardContent
                        className="w-[700px] p-0 bg-zinc-900 border-zinc-700"
                        side="left"
                        align="start"
                      >
                        {/* ✅ 4-Panel Grid: Subscribed | Failed | Stopped | Permanently Stopped */}
                        <div className="grid grid-cols-2 gap-0">
                          {/* Panel 1: Subscribed Companies (Green) */}
                          <div className="p-3 border-r border-b border-zinc-700">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <Wifi className="h-3.5 w-3.5 text-green-500" />
                                <h3 className="font-semibold text-green-400 text-xs">
                                  Subscribed
                                </h3>
                              </div>
                              <span className="text-[10px] bg-green-900/50 text-green-300 px-1.5 py-0.5 rounded">
                                {activeSymbols.length}
                              </span>
                            </div>
                            <ScrollArea className="h-[180px] pr-1">
                              <div className="space-y-1">
                                {activeSymbols.length > 0 ? (
                                  activeSymbols.map((symbol, index) => {
                                    const companyCode = symbol.split(':')[1]?.split('-')[0] || symbol;
                                    const exchange = symbol.split(':')[0] || '';
                                    return (
                                      <div key={symbol} className="flex items-center gap-1.5 p-1.5 rounded bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors">
                                        <span className="text-[9px] font-bold text-green-400 w-4">{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-medium text-white truncate">{companyCode}</div>
                                          <div className="text-[8px] text-zinc-500">{exchange}</div>
                                        </div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-6 text-zinc-500">
                                    <Wifi className="h-5 w-5 mx-auto mb-1 opacity-30" />
                                    <p className="text-[10px]">No active subscriptions</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Panel 2: Failed Subscriptions (Red) */}
                          <div className="p-3 border-b border-zinc-700">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <WifiOff className="h-3.5 w-3.5 text-red-500" />
                                <h3 className="font-semibold text-red-400 text-xs">
                                  Failed
                                </h3>
                              </div>
                              <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">
                                {failedSymbols.length}
                              </span>
                            </div>
                            <ScrollArea className="h-[180px] pr-1">
                              <div className="space-y-1">
                                {failedSymbols.length > 0 ? (
                                  failedSymbols.map((symbol, index) => {
                                    const cleanSymbol = symbol.replace('-STOPPED', '').replace(/'/g, '');
                                    const parts = cleanSymbol.split(':');
                                    const exchange = parts[0] || '';
                                    const companyCode = parts[1]?.split('-')[0] || cleanSymbol;
                                    return (
                                      <div key={symbol} className="flex items-center gap-1.5 p-1.5 rounded bg-red-950/30 hover:bg-red-950/50 transition-colors">
                                        <span className="text-[9px] font-bold text-red-400 w-4">{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-medium text-red-200 truncate">{companyCode}</div>
                                          <div className="text-[8px] text-red-400/70">{exchange}</div>
                                        </div>
                                        <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-6 text-zinc-500">
                                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-green-900/20 flex items-center justify-center">
                                      <Wifi className="h-2.5 w-2.5 text-green-500" />
                                    </div>
                                    <p className="text-[10px] text-green-400">All symbols OK</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Panel 3: Stopped Today (Yellow/Orange) - Resets Daily */}
                          <div className="p-3 border-r border-zinc-700">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                                <h3 className="font-semibold text-yellow-400 text-xs">
                                  Stopped Today
                                </h3>
                              </div>
                              <span className="text-[10px] bg-yellow-900/50 text-yellow-300 px-1.5 py-0.5 rounded">
                                {stoppedSymbols.length}
                              </span>
                            </div>
                            <ScrollArea className="h-[180px] pr-1">
                              <div className="space-y-1">
                                {stoppedSymbols.length > 0 ? (
                                  stoppedSymbols.map((symbol, index) => {
                                    const cleanSymbol = symbol.replace('-STOPPED', '').replace(/'/g, '');
                                    const parts = cleanSymbol.split(':');
                                    const exchange = parts[0] || '';
                                    const companyCode = parts[1]?.split('-')[0] || cleanSymbol;
                                    return (
                                      <div key={symbol} className="flex items-center gap-1.5 p-1.5 rounded bg-yellow-950/30 hover:bg-yellow-950/50 transition-colors group">
                                        <span className="text-[9px] font-bold text-yellow-400 w-4">{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-medium text-yellow-200 truncate">{companyCode}</div>
                                          <div className="text-[8px] text-yellow-400/70">{exchange} • Resets daily</div>
                                        </div>
                                        <button
                                          onClick={async () => {
                                            try {
                                              await fetch('/api/admin/permanently-stopped', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ symbols: [symbol] })
                                              });
                                              fetchSubscriptionStatus();
                                            } catch (err) { console.error('Failed to add to permanent:', err); }
                                          }}
                                          className="opacity-0 group-hover:opacity-100 text-[8px] text-purple-400 hover:text-purple-300 transition-all"
                                          title="Move to Permanent"
                                        >
                                          →Perm
                                        </button>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-6 text-zinc-500">
                                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-green-900/20 flex items-center justify-center">
                                      <Wifi className="h-2.5 w-2.5 text-green-500" />
                                    </div>
                                    <p className="text-[10px] text-green-400">No stopped symbols</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>

                          {/* Panel 4: Permanently Stopped (Purple) - Never Resets */}
                          <div className="p-3">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <svg className="h-3.5 w-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                <h3 className="font-semibold text-purple-400 text-xs">
                                  Permanently Blocked
                                </h3>
                              </div>
                              <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
                                {permanentlyStoppedSymbols.length}
                              </span>
                            </div>
                            <ScrollArea className="h-[180px] pr-1">
                              <div className="space-y-1">
                                {permanentlyStoppedSymbols.length > 0 ? (
                                  permanentlyStoppedSymbols.map((symbol, index) => {
                                    const cleanSymbol = symbol.replace('-STOPPED', '').replace(/'/g, '');
                                    const parts = cleanSymbol.split(':');
                                    const exchange = parts[0] || '';
                                    const companyCode = parts[1]?.split('-')[0] || cleanSymbol;
                                    return (
                                      <div key={symbol} className="flex items-center gap-1.5 p-1.5 rounded bg-purple-950/30 hover:bg-purple-950/50 transition-colors group">
                                        <span className="text-[9px] font-bold text-purple-400 w-4">{index + 1}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-[10px] font-medium text-purple-200 truncate">{companyCode}</div>
                                          <div className="text-[8px] text-purple-400/70">{exchange} • Permanent</div>
                                        </div>
                                        <button
                                          onClick={async () => {
                                            try {
                                              await fetch('/api/admin/permanently-stopped', {
                                                method: 'DELETE',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ symbol })
                                              });
                                              fetchSubscriptionStatus();
                                            } catch (err) { console.error('Failed to remove from permanent:', err); }
                                          }}
                                          className="opacity-0 group-hover:opacity-100 text-[8px] text-green-400 hover:text-green-300 transition-all"
                                          title="Unblock Symbol"
                                        >
                                          Unblock
                                        </button>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-center py-6 text-zinc-500">
                                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-green-900/20 flex items-center justify-center">
                                      <Wifi className="h-2.5 w-2.5 text-green-500" />
                                    </div>
                                    <p className="text-[10px] text-green-400">No blocked symbols</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </div>
                        </div>

                        {/* Error Details */}
                        {subscriptionErrors && (
                          <div className="px-3 py-2 border-t border-zinc-800 bg-red-950/20">
                            <div className="text-[10px] text-red-400/80 space-y-0.5">
                              <div>Error Code: {subscriptionErrors.code}</div>
                              <div className="truncate">{subscriptionErrors.message}</div>
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/50">
                          <div className="flex items-center justify-between text-[10px] text-zinc-500">
                            <span>Last updated: {new Date().toLocaleTimeString()}</span>
                            <div className="flex items-center gap-3">
                              {failedSymbols.length > 0 && (
                                <button
                                  onClick={clearSubscriptionErrors}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                >
                                  Clear Failed
                                </button>
                              )}
                              <button
                                onClick={() => fetchSubscriptionStatus()}
                                className="text-green-400 hover:text-green-300 transition-colors"
                              >
                                Refresh
                              </button>
                              <button
                                onClick={() => setIsSubscriptionModalOpen(true)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                Manage →
                              </button>
                            </div>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>

                  </div>
                </div>

                {watchlistError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    ❌ {watchlistError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className={`${isChartFullscreen ? 'fixed inset-0 z-50 bg-zinc-900 overflow-auto' : 'min-h-screen bg-zinc-900'} text-zinc-100 rounded-lg transition-all duration-300`}>
            <div className={`w-full ${isChartFullscreen ? 'min-h-full' : ''} p-4`}>
              <div className={`flex gap-6 ${isChartFullscreen ? 'min-h-[calc(100vh-2rem)]' : 'mb-6'}`}>
                {/* ============ MAIN CHART AREA ============ */}
                <div className={`${isChartFullscreen ? 'w-3/4 min-h-[calc(100vh-2rem)]' : 'w-3/4'}`}>
                  <div className={`bg-zinc-800 rounded-lg shadow-lg ${isChartFullscreen ? 'h-[calc(100vh-2rem)]' : 'h-[800px]'}`}>
                    {!marketOpen ? (
                      <div className="h-full w-full flex items-center justify-center p-0">
                        <div className="h-full w-full flex items-center justify-center">
                          <MarketClosedBanner className="w-full h-full flex items-center justify-center" />
                        </div>
                      </div>
                    ) : !selectedSymbol ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <div className="text-center space-y-2">
                          <Database className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-zinc-400">No Company Selected</h3>
                          <p className="text-zinc-500 max-w-md">
                            Select a date and click on a company from the list above to view live market data and charts
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                            <span>Step 1: Choose a date</span>
                          </div>
                          <span>→</span>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                            <span>Step 2: Click a company</span>
                          </div>
                        </div>
                      </div>
                    ) : symbolHistory.length > 0 || symbolChartUpdates.length > 0 ? (
                      <div className="w-full h-full">
                        <PlotlyChart
                          symbol={selectedSymbol}
                          data={currentData}
                          historicalData={symbolHistory}
                          ohlcData={symbolOhlc}
                          chartUpdates={symbolChartUpdates}
                          tradingHours={tradingHours}
                          updateFrequency={updateFrequency}
                          predictions={predictions}
                          showPredictions={showPredictions}
                          predictionRevision={predictionRevision}
                          desirabilityScore={desirabilityScore}
                          gttExternalData={gttChartData}
                          isGttEnabled={isGttEnabled}
                          onGttToggle={setIsGttEnabled}
                          gttLoading={gttLoading}
                          gttError={gttError}
                          forcedXRange={sharedXRange}
                          onXRangeChange={handleXRangeChange}
                          isFullscreen={isChartFullscreen}
                          onFullscreenToggle={() => setIsChartFullscreen(!isChartFullscreen)}
                        />

                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                          <p className="text-zinc-400">Loading data for {selectedSymbol}...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ============ SIDE PANEL: CURRENT DATA + PREDICTIONS ============ */}
                <div className={`w-1/4 bg-zinc-800 p-4 rounded-lg shadow-lg ${isChartFullscreen ? 'h-[calc(100vh-2rem)] overflow-y-auto' : 'max-h-[800px] overflow-hidden'} flex flex-col`}>
                  {/* Tab Switcher */}
                  <div className="flex gap-2 mb-4 bg-zinc-900 p-1 rounded-lg">
                    <button
                      onClick={() => setActiveTab('live')}
                      className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 font-medium ${activeTab === 'live'
                        ? 'bg-zinc-700 text-white shadow-lg'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Live Data
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab('predictions')}
                      className={`flex-1 py-2 px-4 rounded-md transition-all duration-300 font-medium ${activeTab === 'predictions'
                        ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-400/50 text-blue-400 shadow-lg shadow-blue-500/20'
                        : 'text-zinc-400 hover:text-blue-400 hover:bg-blue-400/5'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Activity className={`w-4 h-4 ${activeTab === 'predictions' ? 'text-blue-400' : ''}`} />
                        Predictions
                      </div>
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {!marketOpen ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-500/10 rounded-full border-2 border-orange-500/30">
                          <Clock className="w-10 h-10 text-orange-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-orange-400">Market is Closed</h3>
                          <p className="text-sm text-zinc-400 max-w-xs">
                            Live market data and real-time updates are not available outside trading hours.
                          </p>
                          <p className="text-xs text-zinc-500 mt-2">
                            Trading Hours: 9:15 AM - 3:30 PM IST
                          </p>
                        </div>
                      </div>
                    ) : !selectedSymbol ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-700/50 rounded-full">
                          <Building2 className="w-10 h-10 text-zinc-500" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-zinc-300">No Company Selected</h3>
                          <p className="text-sm text-zinc-500 max-w-xs">
                            Click on a company from the dropdown above to view live market data and AI predictions
                          </p>
                        </div>
                      </div>
                    ) : currentData ? (
                      <>
                        {/* LIVE DATA TAB */}
                        {activeTab === 'live' && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h2 className="text-xl font-semibold text-white">{selectedSymbol}</h2>
                              <div className="text-xs text-green-400 animate-pulse">
                                LIVE •
                              </div>
                            </div>

                            <div className="text-3xl font-bold mb-2 text-white">₹{formatPrice(currentData.ltp)}</div>
                            <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                              {formatChange(currentData.change, currentData.changePercent)}
                            </div>

                            {/* ✅ NEW: Dynamic Sentiment Display */}
                            {(() => {
                              if (isSentimentFetching) {
                                return (
                                  <div className="mt-3 p-3 rounded-lg border-2 bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400"></div>
                                      <span className="text-sm font-medium text-zinc-500">
                                        Fetching Sentiment...
                                      </span>
                                    </div>
                                  </div>
                                );
                              }
                              // Map API sentiment to UI styles
                              let sentimentStyle = {
                                background: 'bg-gradient-to-r from-zinc-500/30 to-zinc-600/20 border-zinc-500/40',
                                text: 'text-zinc-400',
                                label: 'Overall Sentinemt : Neutral'
                              };
                              if (overallSentiment === 'POSITIVE') {
                                sentimentStyle = {
                                  background: 'bg-gradient-to-r from-green-500/10 to-green-900/10 border-green-500/40',
                                  text: 'text-green-400',
                                  label: 'Overall Sentinemt : Positive'
                                };
                              } else if (overallSentiment === 'NEGATIVE') {
                                sentimentStyle = {
                                  background: 'bg-gradient-to-r from-red-500/10 to-red-900/10 border-red-500/40',
                                  text: 'text-red-400',
                                  label: 'Overall Sentinemt : Negative'
                                };
                              }
                              return (
                                <div className={`mt-3 p-3 rounded-lg border-2 ${sentimentStyle.background} backdrop-blur-sm`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${sentimentStyle.text}`}>
                                      {sentimentStyle.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="w-full">
                              {selectedSymbol ? (
                                <div className="mt-4">
                                  <DesirabilityPanel
                                    score={desirabilityScore}
                                    classification={desirabilityClassification}
                                    loading={desirabilityLoading}
                                    onFetch={handleFetchDesirabilityScore}
                                    data={desirabilityData}
                                  />
                                </div>
                              ) : (
                                <div className="bg-zinc-800 p-4 rounded-lg shadow-lg h-full flex flex-col items-center justify-center">
                                  <Building2 className="h-12 w-12 text-zinc-600 mb-4" />
                                  <p className="text-zinc-500 text-sm text-center">
                                    Select a symbol to view market desirability score
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-6">
                              <div className="bg-zinc-700 p-3 rounded">
                                <div className="text-xs text-zinc-400">Open</div>
                                <div className="text-lg">₹{formatPrice(currentData.open)}</div>
                              </div>
                              <div className="bg-zinc-700 p-3 rounded">
                                <div className="text-xs text-zinc-400">Close</div>
                                <div className="text-lg">₹{formatPrice(currentData.close)}</div>
                              </div>
                              <div className="bg-zinc-700 p-3 rounded">
                                <div className="text-xs text-zinc-400">High</div>
                                <div className="text-lg">₹{formatPrice(currentData.high)}</div>
                              </div>
                              <div className="bg-zinc-700 p-3 rounded">
                                <div className="text-xs text-zinc-400">Low</div>
                                <div className="text-lg">₹{formatPrice(currentData.low)}</div>
                              </div>
                            </div>

                            <div className="mt-6 border-t border-zinc-700 pt-4">
                              <div className="grid grid-cols-2 gap-y-2">
                                <div>
                                  <div className="text-xs text-zinc-400">Volume</div>
                                  <div>{currentData.volume?.toLocaleString() || '0'}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-zinc-400">Updated</div>
                                  <div className="text-green-400">
                                    {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {(currentData.sma_20 || currentData.ema_9 || currentData.rsi_14) && (
                              <div className="mt-6 border-t border-zinc-700 pt-4">
                                <h3 className="text-sm font-medium mb-2 text-zinc-300">Technical Indicators</h3>
                                <div className="grid grid-cols-3 gap-2">
                                  {currentData.sma_20 && (
                                    <div className="bg-zinc-700 p-2 rounded">
                                      <div className="text-xs text-orange-500">SMA 20</div>
                                      <div className="text-sm">₹{formatPrice(currentData.sma_20)}</div>
                                    </div>
                                  )}
                                  {currentData.ema_9 && (
                                    <div className="bg-zinc-700 p-2 rounded">
                                      <div className="text-xs text-purple-500">EMA 9</div>
                                      <div className="text-sm">₹{formatPrice(currentData.ema_9)}</div>
                                    </div>
                                  )}
                                  {currentData.rsi_14 && (
                                    <div className="bg-zinc-700 p-2 rounded">
                                      <div className="text-xs text-cyan-500">RSI 14</div>
                                      <div className="text-sm">{currentData.rsi_14.toFixed(2)}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}



                            {/* <div className="mt-4">
                              {usefulnessScore === null ? (
                                <button
                                  onClick={handleFetchUsefulnessScore}
                                  className="w-full p-3 rounded-lg border-2 bg-gradient-to-r from-zinc-500/30 to-zinc-600/20 border-zinc-500/40 backdrop-blur-sm hover:from-zinc-500/40 hover:to-zinc-600/30 transition-all duration-200"
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <Award className="h-4 w-4 text-zinc-400" />
                                    <span className="text-sm font-medium text-zinc-400">
                                      Fetch Score
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <div
                                  className="relative"
                                  onMouseEnter={() => setShowScoreTooltip(true)}
                                  onMouseLeave={() => setShowScoreTooltip(false)}
                                >
                                  {(() => {
                                    const scoreEval = getScoreEvaluation(usefulnessScore);
                                    return (
                                      <div className={`p-3 rounded-lg border-2 bg-gradient-to-r ${scoreEval.bgColor} ${scoreEval.borderColor} backdrop-blur-sm cursor-pointer`}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Award className={`h-5 w-5 ${scoreEval.color}`} />
                                            <div>
                                              <div className="text-xs text-zinc-400">Score</div>
                                              <div className={`text-2xl font-bold ${scoreEval.color}`}>
                                                {usefulnessScore}
                                              </div>
                                            </div>
                                          </div>
                                          <div className={`text-lg font-semibold ${scoreEval.color}`}>
                                            {scoreEval.text}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div> */}
                          </div>
                        )}

                        {/* AI PREDICTIONS TAB */}
                        {activeTab === 'predictions' && (
                          <div className="space-y-4 p-3 rounded-lg bg-gradient-to-br from-blue-500/5 via-transparent to-blue-600/5 border border-blue-400/20">
                            {/* PREDICTION OVERLAY */}
                            {showPredictions && predictions ? (
                              <PredictionOverlay
                                predictions={predictions}
                                company={selectedCompany || selectedSymbol}
                                dataAge={predictionDataAge}
                                isStale={isDataStale}
                              />
                            ) : (
                              <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-full mb-4 border border-blue-400/30 shadow-lg shadow-blue-500/10">
                                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <p className="text-blue-400/70 text-sm">Enable predictions to view AI forecasts</p>
                              </div>
                            )}

                            {/* PREDICTION TIMER - Circular countdown to next update */}
                            {showPredictions && (
                              <PredictionTimer
                                timeUntilNextPoll={timeUntilNextPoll}
                                nextPollTime={nextPollTime}
                                isPolling={isPolling}
                                onTimerEnd={handleTimerEnd}
                              />
                            )}

                            {/* PREDICTION CONTROL PANEL */}
                            {showPredictions && (
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
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <p className="text-zinc-400 text-sm">Connecting...</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <ImageCarousel
                  companyCode={selectedCompany || ''}
                  exchange={selectedExchange || ''}
                  gradientMode={gradientMode}
                  onGradientModeChange={setGradientMode}
                  onSentimentLoadingChange={setSentimentLoading}
                  selectedDate={effectiveDate || undefined} // Use effectiveDate
                />
              </div>
            </div>
          </div>
          <SubscriptionManagerModal
            isOpen={isSubscriptionModalOpen}
            onClose={() => setIsSubscriptionModalOpen(false)}
            availableCompanies={companies}
            filteredCompanies={filteredCompanies}
            currentSubscriptions={Array.from(isSubscribedRef.current)}
            onConfirm={handleSubscribeCompanies}
            currentDate={effectiveDate}  // ✅ Pass current date
            isLatestDate={isLatestDate}  // ✅ Pass latest date flag
          />
        </div>
      </SidebarInset>
    </SidebarProvider >
  );
};

export default MarketDataPage;