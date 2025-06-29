'use client';
import React, { useEffect, useState, useCallback } from 'react';
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
import { DateSelector } from "../components/controllers/DateSelector";
import { RecordedCompanySelector } from "../components/controllers/RecordedCompanySelector";
import { useRecordedData } from "@/hooks/useRecordedData";

const PlotlyChart = dynamic(() => import('./components/PlotlyChart'), { 
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

const RecommendationsPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  
  const {
    availableDates,
    availableCompanies,
    selectedDate,
    selectedCompany,
    recordedData,
    loading,
    error,
    setSelectedDate,
    setSelectedCompany,
    loadCompanyData
  } = useRecordedData();

  const [currentData, setCurrentData] = useState<MarketData | null>(null);
  const [historicalData, setHistoricalData] = useState<MarketData[]>([]);
  const [ohlcData, setOhlcData] = useState<OHLCData[]>([]);

  const [tradingHours] = useState<TradingHours>({
    start: selectedDate ? `${selectedDate}T09:15:00.000Z` : new Date().toISOString(),
    end: selectedDate ? `${selectedDate}T15:30:00.000Z` : new Date().toISOString(),
    current: new Date().toISOString(),
    isActive: false 
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCompanySelect = useCallback(async (symbol: string | null) => {
    setSelectedCompany(symbol);
    if (symbol) {
      await loadCompanyData(symbol);
    } else {
      setCurrentData(null);
      setHistoricalData([]);
      setOhlcData([]);
    }
  }, [setSelectedCompany, loadCompanyData]);


useEffect(() => {
  if (recordedData.length > 0) {
    console.log('🔍 Processing recorded data:', recordedData.length, 'points');
    
    const latest = recordedData[recordedData.length - 1];
    setCurrentData(latest);
    
    setHistoricalData(recordedData);
    
    const ohlc: OHLCData[] = recordedData.map((point, index) => {
      const open = point.open || point.ltp;
      const close = point.close || point.ltp;
      let high = point.high || 0;
      let low = point.low || 0;
      
      if (high <= 0 || low <= 0 || high < low) {
        const prices = [open, close, point.ltp].filter(p => p > 0);
        if (prices.length > 0) {
          high = high <= 0 ? Math.max(...prices) : high;
          low = low <= 0 ? Math.min(...prices) : low;
        }
      }
      
      const finalHigh = Math.max(high, open, close, point.ltp);
      const finalLow = Math.min(low, open, close, point.ltp);
      
      const ohlcPoint = {
        timestamp: point.timestamp,
        open: open,
        high: finalHigh,
        low: finalLow,
        close: close,
        volume: point.volume || 0
      };
      
      return ohlcPoint;
    });
    
    console.log('✅ OHLC Data created:', ohlc.length, 'points');
    console.log('📊 Sample OHLC:', ohlc[0]);
    setOhlcData(ohlc);
  } else {
    setCurrentData(null);
    setHistoricalData([]);
    setOhlcData([]);
  }
}, [recordedData]);


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
  const calculateAverage = (data: MarketData[]) => {
  if (!data || data.length === 0) return 0;
  const sum = data.reduce((acc, item) => acc + item.ltp, 0);
  return sum / data.length;
};

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
                    <BreadcrumbPage>Recorded Market Data</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
                <ModeToggle />
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="container mx-auto p-4 bg-zinc-900 text-white flex items-center justify-center h-[80vh]">
              <div className="text-xl animate-pulse">Loading recorded data interface...</div>
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
                  <BreadcrumbPage>Recorded Market Data</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <DateSelector
            availableDates={availableDates}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            loading={loading}
          />

          {selectedDate && (
            <RecordedCompanySelector
              availableCompanies={availableCompanies}
              selectedCompany={selectedCompany}
              onCompanySelect={handleCompanySelect}
              loading={loading}
            />
          )}

          {/* Error Display */}
          {error && (
            <Card className="w-full border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="text-red-700 text-sm">
                  ❌ {error}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Market Data Display */}
          <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
            <div className="container mx-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                <div className="lg:col-span-3">
                  <div className="bg-zinc-800 p-4 rounded-lg shadow-lg min-h-[400px] h-auto">
                    {historicalData.length > 0 && selectedCompany ? (
                      <PlotlyChart 
  symbol={selectedCompany} 
  data={currentData} 
  historicalData={historicalData}
  rawOhlcData={recordedData} 
  ohlcData={ohlcData}
  tradingHours={tradingHours}
/>

                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-zinc-400">
                          {!selectedDate 
                            ? 'Select a recording date to view available data' 
                            : !selectedCompany 
                            ? 'Select a company to view recorded market data'
                            : 'Loading recorded data...'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Market Data Panel */}
                <div className="bg-zinc-800 p-4 rounded-lg shadow-lg">
                  {currentData ? (
                    <>
                      <h2 className="text-xl font-semibold mb-2 text-white">{selectedCompany}</h2>
                      <div className="text-xs text-zinc-400 mb-2">
                        📊 Recorded Data - {selectedDate}
                      </div>
                      <div className="text-3xl font-bold mb-2 text-white">₹{formatPrice(currentData.ltp)}</div>
                       <div className="text-lg text-blue-400">
      Avg: ₹{formatPrice(calculateAverage(historicalData))}
    </div>
    
    {/* Add data points count for reference */}
    <div className="text-sm text-zinc-400 mt-1">
      Based on {historicalData.length} data points
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
                            <div className="text-xs text-zinc-400">Data Points</div>
                            <div>{historicalData.length}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Technical Indicators */}
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
                      
                      {/* Recording Info */}
                      <div className="mt-6 border-t border-zinc-700 pt-4">
                        <h3 className="text-sm font-medium mb-2 text-zinc-300">Recording Info</h3>
                        <div className="text-xs text-zinc-400 space-y-1">
                          <div>📅 Date: {selectedDate}</div>
                          <div>🏢 Company: {availableCompanies.find(c => c.symbol === selectedCompany)?.company}</div>
                          <div>📈 Exchange: {availableCompanies.find(c => c.symbol === selectedCompany)?.exchange}</div>
                          <div>💾 Source: Recorded Data</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-zinc-400">
                        {!selectedDate 
                          ? 'Select a recording date first' 
                          : !selectedCompany 
                          ? 'Select a company to view data'
                          : 'Loading recorded data...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Debug section */}
              {currentData && (
                <div className="mt-8 p-4 bg-zinc-800 rounded-lg shadow-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-white">Recorded Market Data</h3>
                    <div className="text-xs text-zinc-400">
                      Data from: {selectedDate} | Points: {historicalData.length}
                    </div>
                  </div>
                  <pre className="text-xs overflow-auto max-h-60 bg-zinc-900 p-4 rounded text-zinc-300">
                    {JSON.stringify(currentData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default RecommendationsPage;
