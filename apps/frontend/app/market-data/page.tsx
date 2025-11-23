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
import { TrendingUp, TrendingDown, Minus, Wifi, Award, Clock, Building2, Database } from 'lucide-react';
import { MarketClosedBanner } from "@/app/components/MarketClosedBanner";
import { isMarketOpen } from "@/lib/marketHours";
import { fetchHistoricalData, detectDataGaps } from "@/lib/historicalDataFetcher";
import { useDesirability } from "@/hooks/useDesirability";
import { DesirabilityPanel } from "./components/DesirabilityPanel";

// Prediction Integration
import { usePredictionPolling } from '@/hooks/usePredictionPolling';
import PredictionTimer from './components/PredictionTimer';
import PredictionControlPanel from './components/PredictionControlPanel';
import PredictionOverlay from './components/PredictionOverlay';

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
  const [usefulnessScore, setUsefulnessScore] = useState<number | null>(null);
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'predictions'>('live');
  const [marketOpen, setMarketOpen] = useState<boolean>(true);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);
  const [historicalDataStatus, setHistoricalDataStatus] = useState<string>('');

  // Refs
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const frequencyIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const socketRef = useRef<any>(null);
  const isSubscribedRef = useRef<Set<string>>(new Set());

  const {
    companies,
    loading: watchlistLoading,
    error: watchlistError,
    selectedDate,
  } = useWatchlist();

  // ============ PREDICTION POLLING INTEGRATION ============
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
    updateTrigger, // ✅ CRITICAL: Get update trigger from hook
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

  const {
    score: desirabilityScore,
    classification: desirabilityClassification,
    loading: desirabilityLoading,
    error: desirabilityError,
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

  // ✅ OPTIMIZED: Use updateTrigger directly from hook (single source of truth)
  const predictionRevision = useMemo(() => {
    if (!predictions || predictions.count === 0) return 0;
    // Use updateTrigger as the revision counter
    return updateTrigger;
  }, [predictions, updateTrigger]);

  // ✅ OPTIMIZED: Stable callback using refs to avoid stale closures
  const handleTimerEnd = useCallback(async () => {
    console.log('⏰ [TIMER END] Timer reached 0 - triggering immediate refresh');

    try {
      const result = await refetchPredictions();
      console.log('✅ [TIMER END] Refresh completed:', result?.count || 0, 'predictions');
    } catch (error) {
      console.error('❌ [TIMER END] Refresh failed:', error);
    }
  }, [refetchPredictions]);

  // ✅ OPTIMIZED: Stable callback for manual refresh
  const handleManualRefresh = useCallback(async () => {
    console.log('🔄 [MANUAL REFRESH] Button clicked, fetching predictions...');

    try {
      const result = await refetchPredictions();
      console.log('✅ [MANUAL REFRESH] Predictions refreshed:', result?.count || 0, 'predictions');
    } catch (error) {
      console.error('❌ [MANUAL REFRESH] Refresh failed:', error);
    }
  }, [refetchPredictions]);

  // ============ UTILITY FUNCTIONS ============
  const validateAndFormatSymbol = useCallback((companyCode: string, exchange: string, marker?: string): string => {
    const cleanSymbol = companyCode.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (!cleanSymbol || cleanSymbol.length === 0) return '';

    const finalMarker = marker && marker.trim() ? marker.trim().toUpperCase() : 'EQ';

    console.log(`🔍 [validateAndFormatSymbol] Input: ${companyCode}, Exchange: ${exchange}, Marker: "${marker}"`);

    switch (exchange.toUpperCase()) {
      case 'NSE':
        return `NSE:${cleanSymbol}-${finalMarker}`;
      case 'BSE':
        return `BSE:${cleanSymbol}-${finalMarker}`;
      default:
        return `${exchange}:${cleanSymbol}-${finalMarker}`;
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
  }, []);

  const handleWatchlistChange = useCallback((watchlist: string) => {
    console.log(`Watchlist changed to: ${watchlist}`);
    setSelectedWatchlist(watchlist);
    setSelectedCompany(null);
    setSelectedSymbol('');
  }, []);

  const handleFetchUsefulnessScore = useCallback(() => {
    setUsefulnessScore(90);
  }, []);

  const getScoreEvaluation = useCallback((score: number) => {
    if (score >= 80) return { text: 'Great', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/40' };
    if (score >= 60) return { text: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/40' };
    if (score >= 40) return { text: 'Average', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40' };
    return { text: 'Poor', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/40' };
  }, []);

  // ============ EVENT HANDLERS ============
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
    setSocketStatus(`Error: ${error.message || 'Unknown'}`);
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

      // ✅ CRITICAL FIX: Use Map for efficient deduplication and merging
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

    setHistoricalData(prev => ({
      ...prev,
      [data.symbol]: sortedData
    }));

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

      setChartUpdates(prev => ({
        ...prev,
        [data.symbol]: chartData
      }));
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

  // ============ UTILITY FORMATTERS ============
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
          label: 'Negative Sentiment'
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

  // ============ EFFECTS ============
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

  useEffect(() => {
    if (!isClient) return;

    console.log('🚀 Initializing WebSocket connection...');

    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
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
      socket.off('marketDataUpdate', handleMarketDataUpdate);
      socket.off('chartUpdate', handleChartUpdate);
      socket.off('historicalData', handleHistoricalData);
      socket.off('ohlcData', handleOhlcData);
      socket.off('heartbeat', handleHeartbeat);
      unsubscribeReconnect();
    };
  }, [isClient, selectedSymbol, handleConnect, handleDisconnect, handleError, handleMarketDataUpdate, handleChartUpdate, handleHistoricalData, handleOhlcData, handleHeartbeat]);

  // ============ CRITICAL: Fetch historical data when symbol changes ============
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

        const result = await fetchHistoricalData(selectedSymbol, selectedDate || new Date().toISOString().split('T')[0]);

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
  }, [selectedSymbol, isClient, selectedDate]);

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

  // ============ MEMOIZED CALCULATIONS ============
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

  // ============ LOADING STATE ============
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

  // ============ MAIN RENDER ============
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
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${socketStatus.includes('Connected')
                        ? 'bg-green-500 animate-pulse'
                        : isReconnecting
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-red-500'
                        }`}></span>
                      <span className={`text-sm ${socketStatus.includes('Connected')
                        ? 'text-green-600 dark:text-green-400'
                        : isReconnecting
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                        }`}>
                        {socketStatus}
                        {isReconnecting && ' 🔄'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowPredictions(!showPredictions)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${showPredictions
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      {showPredictions ? '🔮 Predictions ON' : '🔮 Predictions OFF'}
                    </button>
                  </div>
                </div>

                <div className="p-3 border border-opacity-30 rounded-md h-24 flex items-center justify-between">
                  <div className="flex-1">
                    <WatchlistSelector
                      onCompanySelect={handleCompanyChange}
                      onDateChange={handleDateChange}
                      showExchangeFilter={true}
                      showMarkerFilter={true}
                    />
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
                  </div>
                  <div className="flex justify-end text-sm">
                    <div className="p-3 bg-zinc-800 rounded w-auto">
                      <div className="flex items-center space-x-2 mb-2">
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-green-400 font-medium">Subscribed Companies ({activeSymbols.length})</span>
                      </div>
                      <div className="max-h-20 overflow-y-auto">
                        {activeSymbols.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {activeSymbols.slice(0, 5).map(symbol => (
                              <span key={symbol} className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                                {symbol.split(':')[1]?.split('-')[0] || symbol}
                              </span>
                            ))}
                            {activeSymbols.length > 5 && (
                              <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
                                +{activeSymbols.length - 5} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-xs">No active symbols</span>
                        )}
                      </div>
                    </div>
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

          <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
            <div className="w-full p-4">
              <div className="flex gap-6 mb-6">
                {/* ============ MAIN CHART AREA ============ */}
                <div className="w-3/4">
                  <div className="bg-zinc-800 rounded-lg shadow-lg h-[800px]">
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
                <div className="w-1/4 bg-zinc-800 p-4 rounded-lg shadow-lg max-h-[800px] overflow-hidden flex flex-col">
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
                      className={`flex-1 py-2 px-4 rounded-md transition-all duration-200 font-medium ${activeTab === 'predictions'
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                        : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                        </svg>
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

                            {(() => {
                              if (sentimentLoading) {
                                return (
                                  <div className="mt-3 p-3 rounded-lg border-2 bg-zinc-900/50 border-zinc-800 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400"></div>
                                      <span className="text-sm font-medium text-zinc-500">
                                        Loading Sentiment...
                                      </span>
                                    </div>
                                  </div>
                                );
                              }

                              const sentiment = getSentimentIndicator(gradientMode);
                              return (
                                <div className={`mt-3 p-3 rounded-lg border-2 ${sentiment.background} backdrop-blur-sm`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${sentiment.text}`}>
                                      {sentiment.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="w-full">
                              {selectedSymbol ? (
                                <DesirabilityPanel
                                  score={desirabilityScore}
                                  classification={desirabilityClassification}
                                  loading={desirabilityLoading}
                                  onFetch={handleFetchDesirabilityScore}
                                />
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



                            <div className="mt-4">
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
                            </div>
                          </div>
                        )}

                        {/* AI PREDICTIONS TAB */}
                        {activeTab === 'predictions' && (
                          <div className="space-y-4">
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
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mb-4">
                                  <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                </div>
                                <p className="text-zinc-400 text-sm">Enable predictions to view AI forecasts</p>
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
                              <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 rounded-lg border border-purple-500/20">
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)]"></div>
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
                              </div>
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
                  selectedDate={selectedDate || undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MarketDataPage;