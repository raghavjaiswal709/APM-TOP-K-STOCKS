// ============ COMPLETELY FIXED: Market Data Component - No Hook Errors ============
'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import dynamic from 'next/dynamic';
import { AppSidebar } from "../components/app-sidebar";
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
import { ModeToggle } from "../components/toggleButton";
import { Card, CardContent } from "@/components/ui/card";
import { WatchlistSelector } from "../components/controllers/WatchlistSelector2/WatchlistSelector";
import { ImageCarousel } from "./components/ImageCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { ViewInDashboardButton } from "../components/ViewInDashboardButton";
import { TrendingUp, TrendingDown, Minus, Database, Wifi } from 'lucide-react';

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

  // State management
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, MarketData[]>>({});
  const [ohlcData, setOhlcData] = useState<Record<string, OHLCData[]>>({});
  const [chartUpdates, setChartUpdates] = useState<Record<string, ChartUpdate[]>>({});

  const [socketStatus, setSocketStatus] = useState<string>('Disconnected');
  const [lastDataReceived, setLastDataReceived] = useState<Date | null>(null);
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

  // Refs
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const frequencyIntervalRef = useRef<NodeJS.Timeout>();
  const socketRef = useRef<any>(null);
  const isSubscribedRef = useRef<Set<string>>(new Set());

  const { 
    companies, 
    loading: watchlistLoading, 
    error: watchlistError,
    selectedWatchlist: currentWatchlist,
    setSelectedWatchlist: setWatchlist,
  } = useWatchlist();

  // ============ FIXED: All stable functions defined at component level ============
  const validateAndFormatSymbol = useCallback((companyCode: string, exchange: string, marker: string = 'EQ'): string => {
    const cleanSymbol = companyCode.replace(/[^A-Z0-9]/g, '').toUpperCase();

    if (!cleanSymbol || cleanSymbol.length === 0) {
      return '';
    }

    switch (exchange.toUpperCase()) {
      case 'NSE':
        return `NSE:${cleanSymbol}-${marker}`;
      case 'BSE':
        return `BSE:${cleanSymbol}-${marker}`;
      default:
        return `${exchange}:${cleanSymbol}-${marker}`;
    }
  }, []);

  const handleCompanyChange = useCallback((companyCode: string | null, exchange?: string, marker?: string) => {
    console.log(`Company selected: ${companyCode} (${exchange}, ${marker})`);

    setSelectedCompany(companyCode);
    setSelectedExchange(exchange || null);

    if (companyCode && exchange) {
      const formattedSymbol = validateAndFormatSymbol(companyCode, exchange, marker);
      console.log(`Formatted symbol: ${formattedSymbol}`);
      setSelectedSymbol(formattedSymbol);
    } else {
      setSelectedSymbol('');
    }
  }, [validateAndFormatSymbol]);

  const handleWatchlistChange = useCallback((watchlist: string) => {
    console.log(`Watchlist changed to: ${watchlist}`);
    setSelectedWatchlist(watchlist);
    setWatchlist(watchlist);
    setSelectedCompany(null);
    setSelectedSymbol('');
  }, [setWatchlist]);

  // ============ FIXED: Event handlers defined at component level ============
  const handleConnect = useCallback(() => {
    console.log('✅ Connected to server');
    setSocketStatus('Connected');

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
    }
  }, []);

  const handleDisconnect = useCallback((reason: string) => {
    console.log('❌ Disconnected:', reason);
    setSocketStatus(`Disconnected: ${reason}`);
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

      const exists = existingHistory.some(item => item.timestamp === data.timestamp);
      if (exists) return prev;

      const newHistory = [...existingHistory, data].slice(-10000);
      newHistory.sort((a, b) => a.timestamp - b.timestamp);

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

  // Utility functions
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

  // ============ FIXED: Update frequency calculation ============
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

  // ============ FIXED: Auto-select first company ============
  useEffect(() => {
    if (companies.length > 0 && !selectedCompany) {
      const firstCompany = companies[0];
      console.log(`Auto-selecting first company: ${firstCompany.company_code}`);
      handleCompanyChange(firstCompany.company_code, firstCompany.exchange, firstCompany.marker);
    }
  }, [companies.length, selectedCompany, handleCompanyChange]);

  // ============ FIXED: Client initialization ============
  useEffect(() => {
    setIsClient(true);
    console.log('Component mounted');
  }, []);

  // ============ FIXED: WebSocket connection ============
  useEffect(() => {
    if (!isClient) return;

    console.log('🚀 Initializing WebSocket connection...');

    const socket = getSocket();
    socketRef.current = socket;

    // Register event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('marketDataUpdate', handleMarketDataUpdate);
    socket.on('chartUpdate', handleChartUpdate);
    socket.on('historicalData', handleHistoricalData);
    socket.on('ohlcData', handleOhlcData);
    socket.on('heartbeat', handleHeartbeat);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socket.off('marketDataUpdate', handleMarketDataUpdate);
      socket.off('chartUpdate', handleChartUpdate);
      socket.off('historicalData', handleHistoricalData);
      socket.off('ohlcData', handleOhlcData);
      socket.off('heartbeat', handleHeartbeat);
    };
  }, [isClient, handleConnect, handleDisconnect, handleError, handleMarketDataUpdate, handleChartUpdate, handleHistoricalData, handleOhlcData, handleHeartbeat]);

  // ============ FIXED: Symbol subscription management ============
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

    return () => {
      if (isSubscribedRef.current.has(selectedSymbol)) {
        console.log('🛑 Unsubscribing from:', selectedSymbol);
        socket.emit('unsubscribe', { symbol: selectedSymbol });
        isSubscribedRef.current.delete(selectedSymbol);
      }
    };
  }, [selectedSymbol, isClient]);

  // Memoized data calculations
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

  const totalCachedSymbols = useMemo(() => Object.keys(marketData).length, [marketData]);
  const totalHistoricalPoints = useMemo(() => 
    Object.values(historicalData).reduce((sum, data) => sum + data.length, 0), 
    [historicalData]
  );

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
                    <BreadcrumbLink href="#">
                      Home
                    </BreadcrumbLink>
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
                  <BreadcrumbLink href="#">
                    Home
                  </BreadcrumbLink>
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
                  <h3 className="text-lg font-medium">Live Market Data</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        socketStatus.includes('Connected') ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></span>
                      <span className="text-sm text-muted-foreground">{socketStatus}</span>
                    </div>
                    {/* <div className="text-sm text-muted-foreground">
                      Updates: {updateFrequency}/sec
                    </div> */}
                    {/* <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-blue-400">
                        {backgroundDataPoints} pts
                      </span>
                    </div> */}
                  </div>
                </div>

                <div className="p-3 border border-opacity-30 rounded-md h-24 flex items-center justify-between">
                  <WatchlistSelector
                    onCompanySelect={handleCompanyChange}
                    selectedWatchlist={selectedWatchlist}
                    onWatchlistChange={handleWatchlistChange}
                    showExchangeFilter={true}
                    showMarkerFilter={true}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-zinc-800 rounded">
                    <div className="flex items-center space-x-2 mb-2">
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-green-400 font-medium">Active Background ({activeSymbols.length})</span>
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

                  <div className="p-3 bg-zinc-800 rounded">
                    <div className="flex items-center space-x-2 mb-2">
                      <Database className="h-4 w-4 text-blue-500" />
                      <span className="text-blue-400 font-medium">Cached Data ({Object.keys(historicalData).length})</span>
                    </div>
                    <div className="max-h-20 overflow-y-auto">
                      {Object.keys(historicalData).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(historicalData).slice(0, 5).map(symbol => (
                            <span key={symbol} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                              {symbol.split(':')[1]?.split('-')[0] || symbol}
                            </span>
                          ))}
                          {Object.keys(historicalData).length > 5 && (
                            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                              +{Object.keys(historicalData).length - 5} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">No cached data</span>
                      )}
                    </div>
                  </div>
                </div>
                </div>

                {/* <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Selected:</span>
                    <div className="font-medium">
                      {selectedCompany ? `${selectedCompany} (${selectedExchange})` : 'None'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Symbol:</span>
                    <div className="font-medium">{selectedSymbol || 'None'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market:</span>
                    <div className={`font-medium ${tradingHours.isActive ? 'text-green-500' : 'text-red-500'}`}>
                      {tradingHours.isActive ? 'Open' : 'Closed'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data:</span>
                    <div className="font-medium">{symbolHistory.length}h / {symbolChartUpdates.length}c</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updates:</span>
                    <div className="font-medium text-green-400">{dataCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cached:</span>
                    <div className="font-medium text-purple-400">{totalCachedSymbols}</div>
                  </div>
                </div> */}

                {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-zinc-800 rounded">
                    <div className="flex items-center space-x-2 mb-2">
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span className="text-green-400 font-medium">Active Background ({activeSymbols.length})</span>
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

                  <div className="p-3 bg-zinc-800 rounded">
                    <div className="flex items-center space-x-2 mb-2">
                      <Database className="h-4 w-4 text-blue-500" />
                      <span className="text-blue-400 font-medium">Cached Data ({Object.keys(historicalData).length})</span>
                    </div>
                    <div className="max-h-20 overflow-y-auto">
                      {Object.keys(historicalData).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(historicalData).slice(0, 5).map(symbol => (
                            <span key={symbol} className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                              {symbol.split(':')[1]?.split('-')[0] || symbol}
                            </span>
                          ))}
                          {Object.keys(historicalData).length > 5 && (
                            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
                              +{Object.keys(historicalData).length - 5} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-xs">No cached data</span>
                      )}
                    </div>
                  </div>
                </div> */}

                {watchlistError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    ❌ {watchlistError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
            <div className="container w-full p-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <div className="bg-zinc-800 p-4 rounded-lg shadow-lg h-[600px]">
                    {symbolHistory.length > 0 || symbolChartUpdates.length > 0 ? (
                      <PlotlyChart 
                        symbol={selectedSymbol} 
                        data={currentData} 
                        historicalData={symbolHistory}
                        ohlcData={symbolOhlc}
                        chartUpdates={symbolChartUpdates}
                        tradingHours={tradingHours}
                        updateFrequency={updateFrequency}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-zinc-400">
                          {selectedSymbol ? `Loading data for ${selectedSymbol}...` : 'Select a company'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-800 p-4 w-full rounded-lg shadow-lg">
                  {currentData ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold text-white">{selectedSymbol}</h2>
                        <div className="text-xs text-green-400 animate-pulse">
                          LIVE • 
                          {/* {updateFrequency} ups/sec */}
                        </div>
                      </div>
                      <div className="text-3xl font-bold mb-2 text-white">₹{formatPrice(currentData.ltp)}</div>
                      <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                        {formatChange(currentData.change, currentData.changePercent)}
                      </div>

                      {(() => {
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

                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-zinc-400">
                        {selectedSymbol ? 'Connecting...' : 'Select a company'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-8">
                <ImageCarousel
                  companyCode={selectedCompany || ''}
                  exchange={selectedExchange || ''}
                  gradientMode={gradientMode}
                  onGradientModeChange={setGradientMode}
                />
              </div>

              {/* <div className="p-4 bg-zinc-800 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-white">Market Data Stream</h3>
                  <div className="text-xs text-zinc-400">
                    {symbolHistory.length > 0 && tradingHours.start && (
                      <>
                        Trading: {new Date(tradingHours.start).toLocaleTimeString()} - {new Date(tradingHours.end).toLocaleTimeString()}
                        <span className="ml-2 text-green-400">• {updateFrequency} ups/sec</span>
                        <span className="ml-2 text-blue-400">• {backgroundDataPoints} bg pts</span>
                        <span className="ml-2 text-purple-400">• {totalCachedSymbols} cached</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-2">Current Data</h4>
                    {currentData ? (
                      <pre className="text-xs overflow-auto max-h-40 bg-zinc-900 p-2 rounded text-zinc-300">
                        {JSON.stringify({
                          symbol: currentData.symbol,
                          ltp: currentData.ltp,
                          change: currentData.change,
                          changePercent: currentData.changePercent,
                          volume: currentData.volume,
                          timestamp: new Date(currentData.timestamp * 1000).toLocaleTimeString()
                        }, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-zinc-400 text-xs">No current data</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-zinc-300 mb-2">System Stats</h4>
                    <div className="text-xs bg-zinc-900 p-2 rounded text-zinc-300">
                      <div>Total Symbols: {totalCachedSymbols}</div>
                      <div>Total Historical: {totalHistoricalPoints}</div>
                      <div>Background Points: {backgroundDataPoints}</div>
                      <div>Active Symbols: {activeSymbols.length}</div>
                      <div>Update Frequency: {updateFrequency}/sec</div>
                      <div className="text-green-400 mt-2">✅ Fixed Version</div>
                    </div>
                  </div>
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MarketDataPage;
