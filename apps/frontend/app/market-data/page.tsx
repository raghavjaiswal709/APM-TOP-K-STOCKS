'use client';
import React, { useEffect, useState, useCallback } from 'react';
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
import { WatchlistSelector } from "../components/controllers/WatchlistSelector";
import { ImageCarousel } from "./components/ImageCarousel";
import { useWatchlist } from "@/hooks/useWatchlist";
import { ViewInDashboardButton } from "../components/ViewInDashboardButton";

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
  
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, MarketData[]>>({});
  const [ohlcData, setOhlcData] = useState<Record<string, OHLCData[]>>({});
  
  const [socketStatus, setSocketStatus] = useState<string>('Disconnected');
  const [lastDataReceived, setLastDataReceived] = useState<Date | null>(null);
  const [dataCount, setDataCount] = useState<number>(0);
  const [tradingHours, setTradingHours] = useState<TradingHours>({
    start: '',
    end: '',
    current: '',
    isActive: false
  });

  const { 
    companies, 
    loading: watchlistLoading, 
    error: watchlistError,
    selectedWatchlist: currentWatchlist,
    setSelectedWatchlist: setWatchlist,
    exists: watchlistExists
  } = useWatchlist();

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
    console.log(`[MarketData] Company selected: ${companyCode} (${exchange}, ${marker})`);
    
    setSelectedCompany(companyCode);
    setSelectedExchange(exchange || null);
    
    if (companyCode && exchange) {
      const formattedSymbol = validateAndFormatSymbol(companyCode, exchange, marker);
      console.log(`[MarketData] Formatted symbol: ${formattedSymbol}`);
      setSelectedSymbol(formattedSymbol);
    } else {
      setSelectedSymbol('');
    }
  }, [validateAndFormatSymbol]);

  const handleWatchlistChange = useCallback((watchlist: string) => {
    console.log(`[MarketData] Watchlist changed to: ${watchlist}`);
    setSelectedWatchlist(watchlist);
    setWatchlist(watchlist);
    setSelectedCompany(null);
    setSelectedSymbol('');
  }, [setWatchlist]);

  useEffect(() => {
    if (companies.length > 0 && !selectedCompany) {
      const firstCompany = companies[0];
      console.log(`[MarketData] Auto-selecting first company: ${firstCompany.company_code}`);
      handleCompanyChange(firstCompany.company_code, firstCompany.exchange, firstCompany.marker);
    }
  }, [companies, selectedCompany, handleCompanyChange]);

  useEffect(() => {
    setIsClient(true);
    console.log('Component mounted, isClient set to true');
  }, []);

  useEffect(() => {
    if (!isClient) return;

    console.log('Connecting to Python WebSocket server...');
    
    const socket = getSocket();

    socket.on('connect', () => {
      console.log('✅ Connected to Python WebSocket server');
      console.log('Socket ID:', socket.id);
      setSocketStatus('Connected');
      
      socket.emit('get_trading_status', {}, (response: any) => {
        console.log('Trading status:', response);
        setTradingHours({
          start: response.trading_start,
          end: response.trading_end,
          current: response.current_time,
          isActive: response.trading_active
        });
      });
      
      if (selectedSymbol && selectedSymbol.includes(':') && selectedSymbol.includes('-')) {
        console.log('Subscribing to validated symbol:', selectedSymbol);
        socket.emit('subscribe', { symbol: selectedSymbol });
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setSocketStatus(`Connection error: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Python WebSocket server. Reason:', reason);
      setSocketStatus(`Disconnected: ${reason}`);
    });

    socket.on('marketData', (data: MarketData) => {
      console.log('📊 Received market data:', data);
      setLastDataReceived(new Date());
      setDataCount(prev => prev + 1);
      
      if (data && data.symbol) {
        setMarketData(prev => ({
          ...prev,
          [data.symbol]: data
        }));
        
        setHistoricalData(prev => {
          const symbol = data.symbol;
          const existingHistory = prev[symbol] || [];
          
          const exists = existingHistory.some(item => item.timestamp === data.timestamp);
          if (exists) return prev;
          
          const newHistory = [...existingHistory, data];
          newHistory.sort((a, b) => a.timestamp - b.timestamp);
          
          return {
            ...prev,
            [symbol]: newHistory
          };
        });
      }
    });
    
    socket.on('historicalData', (data: { symbol: string, data: MarketData[] }) => {
      console.log('📈 Received historical data:', data);
      
      if (data && data.symbol && Array.isArray(data.data)) {
        const sortedData = [...data.data].sort((a, b) => a.timestamp - b.timestamp);
        
        setHistoricalData(prev => ({
          ...prev,
          [data.symbol]: sortedData
        }));
        
        console.log(`Processed ${sortedData.length} historical data points for ${data.symbol}`);
        
        if (marketData[data.symbol] && sortedData.length > 0) {
          const lastHistorical = sortedData[sortedData.length - 1];
          const current = marketData[data.symbol];
          
          if (lastHistorical.timestamp > current.timestamp) {
            setMarketData(prev => ({
              ...prev,
              [data.symbol]: lastHistorical
            }));
          }
        } else if (sortedData.length > 0) {
          setMarketData(prev => ({
            ...prev,
            [data.symbol]: sortedData[sortedData.length - 1]
          }));
        }
      }
    });

    socket.on('ohlcData', (data: { symbol: string, data: OHLCData[] }) => {
      console.log('📊 Received OHLC data:', data);
      
      if (data && data.symbol && Array.isArray(data.data)) {
        const sortedData = [...data.data].sort((a, b) => a.timestamp - b.timestamp);
        
        setOhlcData(prev => ({
          ...prev,
          [data.symbol]: sortedData
        }));
        
        console.log(`Processed ${sortedData.length} OHLC data points for ${data.symbol}`);
      }
    });
    
    socket.on('heartbeat', (data: any) => {
      setTradingHours(prev => ({
        ...prev,
        current: new Date().toISOString(),
        isActive: data.trading_active
      }));
    });

    const dataCheckInterval = setInterval(() => {
      const now = new Date();
      const lastReceived = lastDataReceived;
      
      if (!lastReceived || now.getTime() - lastReceived.getTime() > 10000) {
        console.warn('⚠️ No market data received in the last 10 seconds');
        
        if (socket.connected && selectedSymbol) {
          console.log('🔄 Attempting to resubscribe to:', selectedSymbol);
          socket.emit('subscribe', { symbol: selectedSymbol });
        }
      }
    }, 5000);

    return () => {
      console.log('Component unmounting, cleaning up socket connection');
      clearInterval(dataCheckInterval);
      
      Object.keys(marketData).forEach(symbol => {
        console.log('🔕 Unsubscribing from:', symbol);
        socket.emit('unsubscribe', { symbol });
      });
    };
  }, [isClient, lastDataReceived, selectedSymbol]);

  useEffect(() => {
    if (!isClient) return;
    
    console.log('🔄 Symbol changed to:', selectedSymbol);
    const socket = getSocket();
    
    if (!socket.connected) {
      console.log('Socket not connected, waiting for connection...');
      return;
    }

    Object.keys(marketData).forEach(symbol => {
      if (symbol !== selectedSymbol) {
        console.log('🔕 Unsubscribing from:', symbol);
        socket.emit('unsubscribe', { symbol });
      }
    });
    
    if (selectedSymbol) {
      socket.emit('subscribe', { symbol: selectedSymbol });
      console.log('🔔 Subscribed to:', selectedSymbol);
    }
  }, [selectedSymbol, isClient]);

  const formatPrice = (price?: number) => {
    return price?.toFixed(2) || '0.00';
  };

  const formatChange = (change?: number, percent?: number) => {
    if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const getChangeClass = (change?: number) => {
    if (!change && change !== 0) return '';
    return change >= 0 ? 'text-green-500' : 'text-red-500';
  };

  const currentData = marketData[selectedSymbol];
  const symbolHistory = historicalData[selectedSymbol] || [];
  const symbolOhlc = ohlcData[selectedSymbol] || [];

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
                      Building Your Application
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
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-end gap-2">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Building Your Application
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
                  <h3 className="text-lg font-medium">Market Data Watchlist</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      socketStatus.includes('Connected') ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    <span className="text-sm text-muted-foreground">{socketStatus}</span>
                  </div>
                </div>
                
                <div className="p-3 border border-opacity-30 rounded-md h-24 flex items-center">
                  <WatchlistSelector
                    onCompanySelect={handleCompanyChange}
                    selectedWatchlist={selectedWatchlist}
                    onWatchlistChange={handleWatchlistChange}
                    showExchangeFilter={true}
                    showMarkerFilter={true}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Selected:</span>
                    <div className="font-medium">
                      {selectedCompany ? `${selectedCompany} (${selectedExchange})` : 'None'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fyers Symbol:</span>
                    <div className="font-medium">{selectedSymbol || 'None'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market Status:</span>
                    <div className={`font-medium ${tradingHours.isActive ? 'text-green-500' : 'text-red-500'}`}>
                      {tradingHours.isActive ? 'Open' : 'Closed'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data Points:</span>
                    <div className="font-medium">{symbolHistory.length} historical / {dataCount} updates</div>
                  </div>
                </div>

                {selectedCompany && selectedExchange && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Ready to analyze {selectedCompany} historical data?
                    </div>
                    <ViewInDashboardButton
                      companyCode={selectedCompany}
                      exchange={selectedExchange}
                      watchlist={selectedWatchlist}
                      interval="1h"
                      variant="default"
                      size="md"
                    />
                  </div>
                )}

                {watchlistError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    ❌ {watchlistError}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
            <div className="container mx-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <div className="bg-zinc-800 p-4 rounded-lg shadow-lg h-[600px]">
                    {symbolHistory.length > 0 ? (
                      <PlotlyChart 
                        symbol={selectedSymbol} 
                        data={currentData} 
                        historicalData={symbolHistory}
                        ohlcData={symbolOhlc}
                        tradingHours={tradingHours}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-zinc-400">
                          {selectedSymbol ? `Loading historical data for ${selectedSymbol}...` : 'Select a company to view market data'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-zinc-800 p-4 rounded-lg shadow-lg">
                  {currentData ? (
                    <>
                      <h2 className="text-xl font-semibold mb-2 text-white">{selectedSymbol}</h2>
                      <div className="text-3xl font-bold mb-2 text-white">₹{formatPrice(currentData.ltp)}</div>
                      <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                        {formatChange(currentData.change, currentData.changePercent)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">Open</div>
                          <div className="text-lg">₹{formatPrice(currentData.open)}</div>
                        </div>
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">Prev Close</div>
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
                            <div className="text-xs text-zinc-400">Bid</div>
                            <div>₹{formatPrice(currentData.bid)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400">Ask</div>
                            <div>₹{formatPrice(currentData.ask)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400">Volume</div>
                            <div>{currentData.volume?.toLocaleString() || '0'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400">Last Updated</div>
                            <div>{new Date(currentData.timestamp * 1000).toLocaleTimeString()}</div>
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
                        {selectedSymbol ? 'Waiting for market data...' : 'Select a company to view data'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-8">
                <ImageCarousel
                  companyCode={selectedCompany || ''}
                  exchange={selectedExchange || ''}
                />
              </div>
              
              <div className="p-4 bg-zinc-800 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-white">Raw Market Data</h3>
                  <div className="text-xs text-zinc-400">
                    {symbolHistory.length > 0 && tradingHours.start && (
                      <>
                        Trading Hours: {new Date(tradingHours.start).toLocaleTimeString()} - {new Date(tradingHours.end).toLocaleTimeString()}
                      </>
                    )}
                  </div>
                </div>
                {currentData ? (
                  <pre className="text-xs overflow-auto max-h-60 bg-zinc-900 p-4 rounded text-zinc-300">
                    {JSON.stringify(currentData, null, 2)}
                  </pre>
                ) : (
                  <p className="text-zinc-400">No data received yet. Check console for connection details.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MarketDataPage;