// apps/frontend/app/recommendations/page.tsx
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Database, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TimeMachineSelector } from "@/app/components/controllers/TimeMachineSelector/TimeMachineSelector";
import { parseFullHistoricalData, convertToOHLC } from '@/lib/historicalTimeMachine';
import { useTimeMachine } from '@/hooks/useTimeMachine';
import { HistoricalChartCarousel } from "./components/HistoricalChartCarousel";
import { HistoricalMarketNews } from "./components/HistoricalMarketNews";
import { 
  fetchSthitiClusters, 
  fetchSthitiPrediction,
  type SthitiCluster,
  type SthitiPrediction 
} from '@/lib/historicalSthitiService';

// Dynamic imports
const PlotlyChart = dynamic(() => import('../market-data/components/charts/PlotlyChart'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
      <div className="animate-pulse text-blue-500">Loading Time Machine...</div>
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
}

interface OHLCPoint {
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

const RecommendationListPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const [historicalDataPoints, setHistoricalDataPoints] = useState<MarketData[]>([]);
  const [ohlcDataPoints, setOHLCDataPoints] = useState<OHLCPoint[]>([]);
  const [loadingFullData, setLoadingFullData] = useState(false);
  
  // Sthiti Intelligence State
  const [sthitiPositiveClusters, setSthitiPositiveClusters] = useState<SthitiCluster[]>([]);
  const [sthitiNegativeClusters, setSthitiNegativeClusters] = useState<SthitiCluster[]>([]);
  const [sthitiNeutralClusters, setSthitiNeutralClusters] = useState<SthitiCluster[]>([]);
  const [sthitiPrediction, setSthitiPrediction] = useState<SthitiPrediction | null>(null);
  const [loadingSthitiClusters, setLoadingSthitiClusters] = useState(false);
  const [loadingSthitiPrediction, setLoadingSthitiPrediction] = useState(false);

  const {
    availableDates,
    selectedDate,
    availableCompanies,
    selectedCompany,
    priceData,
    loadingDates,
    loadingCompanies,
    loadingPriceData,
    setSelectedDate,
    setSelectedCompany,
  } = useTimeMachine();

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // ✅ CRITICAL: Fetch full historical data when company/date changes
  useEffect(() => {
    if (!selectedDate || !selectedCompany) {
      setHistoricalDataPoints([]);
      setOHLCDataPoints([]);
      return;
    }

    const loadChartData = async () => {
      setLoadingFullData(true);
      try {
        // Fetch ALL data points from the file
        const points = await parseFullHistoricalData(selectedCompany, selectedDate);
        
        // Convert to MarketData format
        const formattedPoints: MarketData[] = points.map(point => ({
          symbol: point.symbol,
          ltp: point.ltp,
          open: point.open_price,
          high: point.high_price,
          low: point.low_price,
          close: point.ltp,
          volume: point.vol_traded_today,
          bid: point.bid_price,
          ask: point.ask_price,
          timestamp: point.timestamp,
          change: point.ltp - point.prev_close_price,
          changePercent: ((point.ltp - point.prev_close_price) / point.prev_close_price) * 100,
        }));

        setHistoricalDataPoints(formattedPoints);

        // Convert to OHLC candles (5-minute intervals)
        const ohlcCandles = convertToOHLC(points, 5);
        setOHLCDataPoints(ohlcCandles);

        console.log(`✅ [Time Machine] Loaded ${formattedPoints.length} points, ${ohlcCandles.length} candles`);
      } catch (error) {
        console.error('❌ [Time Machine] Error loading chart data:', error);
        setHistoricalDataPoints([]);
        setOHLCDataPoints([]);
      } finally {
        setLoadingFullData(false);
      }
    };

    loadChartData();
  }, [selectedDate, selectedCompany]);

  // ✅ NEW: Fetch Sthiti Intelligence data when company/date changes
  useEffect(() => {
    if (!selectedDate || !selectedCompany) {
      setSthitiPositiveClusters([]);
      setSthitiNegativeClusters([]);
      setSthitiNeutralClusters([]);
      setSthitiPrediction(null);
      return;
    }

    const loadSthitiData = async () => {
      // Load clusters
      setLoadingSthitiClusters(true);
      try {
        const [positive, negative, neutral] = await Promise.all([
          fetchSthitiClusters(selectedCompany, 'positive'),
          fetchSthitiClusters(selectedCompany, 'negative'),
          fetchSthitiClusters(selectedCompany, 'neutral'),
        ]);
        setSthitiPositiveClusters(positive);
        setSthitiNegativeClusters(negative);
        setSthitiNeutralClusters(neutral);
        console.log(`✅ [Sthiti Clusters] Loaded: ${positive.length} positive, ${negative.length} negative, ${neutral.length} neutral`);
      } catch (error) {
        console.error('❌ [Sthiti Clusters] Error:', error);
      } finally {
        setLoadingSthitiClusters(false);
      }

      // Load prediction
      setLoadingSthitiPrediction(true);
      try {
        const prediction = await fetchSthitiPrediction(selectedCompany, selectedDate);
        setSthitiPrediction(prediction);
        console.log(`✅ [Sthiti Prediction] Loaded:`, prediction);
      } catch (error) {
        console.error('❌ [Sthiti Prediction] Error:', error);
      } finally {
        setLoadingSthitiPrediction(false);
      }
    };

    loadSthitiData();
  }, [selectedDate, selectedCompany]);

  // Convert price data to MarketData format (use last point from historical data)
  const currentData = useMemo<MarketData | null>(() => {
    if (historicalDataPoints.length > 0) {
      return historicalDataPoints[historicalDataPoints.length - 1];
    }
    if (!priceData) return null;

    return {
      symbol: priceData.symbol || selectedCompany || '',
      ltp: priceData.ltp,
      change: priceData.ltp - priceData.prev_close_price,
      changePercent: ((priceData.ltp - priceData.prev_close_price) / priceData.prev_close_price) * 100,
      open: priceData.open_price,
      high: priceData.high_price,
      low: priceData.low_price,
      close: priceData.ltp,
      volume: priceData.vol_traded_today,
      bid: priceData.bid_price,
      ask: priceData.ask_price,
      timestamp: priceData.timestamp,
    };
  }, [priceData, selectedCompany, historicalDataPoints]);

  // ✅ Create trading hours object for historical data
  const tradingHours = useMemo<TradingHours>(() => {
    if (!selectedDate) {
      return {
        start: '09:15',
        end: '15:30',
        current: new Date().toISOString(),
        isActive: false,
      };
    }

    return {
      start: '09:15',
      end: '15:30',
      current: selectedDate,
      isActive: false, // Always false for historical data
    };
  }, [selectedDate]);

  // Format helpers
  const formatPrice = (price?: number) => price?.toFixed(2) || '0.00';
  const formatChange = (change?: number, percent?: number) => {
    if ((!change && change !== 0) || (!percent && percent !== 0)) return '-';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };
  const getChangeClass = (change?: number) => {
    if (!change && change !== 0) return '';
    return change >= 0 ? 'text-green-500' : 'text-red-500';
  };

  // Overall sentiment calculation
  const overallSentiment = useMemo(() => {
    if (sthitiPrediction) {
      return sthitiPrediction.sentiment || 'NEUTRAL';
    }

    const positiveCount = sthitiPositiveClusters.length;
    const negativeCount = sthitiNegativeClusters.length;

    if (positiveCount > negativeCount) return 'POSITIVE';
    if (negativeCount > positiveCount) return 'NEGATIVE';
    return 'NEUTRAL';
  }, [sthitiPrediction, sthitiPositiveClusters, sthitiNegativeClusters]);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment.toUpperCase()) {
      case 'POSITIVE':
        return {
          background: 'bg-gradient-to-r from-green-500/10 to-green-900/10 border-green-500/40',
          text: 'text-green-400',
          label: 'Overall Sentiment: Positive',
        };
      case 'NEGATIVE':
        return {
          background: 'bg-gradient-to-r from-red-500/10 to-red-900/10 border-red-500/40',
          text: 'text-red-400',
          label: 'Overall Sentiment: Negative',
        };
      default:
        return {
          background: 'bg-gradient-to-r from-zinc-500/30 to-zinc-600/20 border-zinc-500/40',
          text: 'text-zinc-400',
          label: 'Overall Sentiment: Neutral',
        };
    }
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
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Loading Time Machine...</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="flex items-center justify-center h-[80vh]">
              <div className="text-xl animate-pulse">Initializing Time Machine...</div>
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
                  <BreadcrumbLink href="#">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>📅 Historical Data Time Machine</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* ✅ NEW: Beautiful UI using TimeMachineSelector with OLD data from port 6969 */}
          <Card className="w-full">
            <CardContent className="p-4">
              <TimeMachineSelector
                availableDates={availableDates}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                loadingDates={loadingDates}
                availableCompanies={availableCompanies}
                selectedCompany={selectedCompany}
                onCompanyChange={setSelectedCompany}
                loadingCompanies={loadingCompanies}
              />
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="min-h-screen bg-zinc-900 text-zinc-100 rounded-lg">
            <div className="w-full p-4">
              <div className="flex gap-6 mb-6">
                {/* ============ MAIN CHART AREA (75%) ============ */}
                <div className="w-3/4">
                  <div className="bg-zinc-800 rounded-lg shadow-lg h-[800px]">
                    {!selectedCompany ? (
                      <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <Database className="h-16 w-16 text-zinc-600 mb-4" />
                        <h3 className="text-xl font-semibold text-zinc-400">Select Date & Company</h3>
                        <p className="text-zinc-500 max-w-md text-center">
                          Choose a date and company from the dropdowns above to view historical market data
                        </p>
                      </div>
                    ) : loadingFullData ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                          <p className="text-zinc-400">Loading historical data for {selectedCompany}...</p>
                        </div>
                      </div>
                    ) : historicalDataPoints.length > 0 ? (
                      <div className="w-full h-full">
                        <PlotlyChart
                          symbol={`NSE:${selectedCompany}-EQ`}
                          data={currentData}
                          historicalData={historicalDataPoints}
                          ohlcData={ohlcDataPoints}
                          chartUpdates={[]}
                          tradingHours={tradingHours}
                          updateFrequency={0}
                          predictions={null}
                          showPredictions={false}
                          isGttEnabled={false}
                          gttExternalData={null}
                        />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center text-red-400">
                          <p>No data available for this selection</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ============ SIDEBAR (25%) ============ */}
                <div className="w-1/4 bg-zinc-800 p-4 rounded-lg shadow-lg max-h-[800px] overflow-y-auto">
                  {currentData ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">{selectedCompany}</h2>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                          Historical
                        </Badge>
                      </div>

                      <div className="text-3xl font-bold text-white">₹{formatPrice(currentData.ltp)}</div>
                      <div className={`text-lg ${getChangeClass(currentData.change)}`}>
                        {formatChange(currentData.change, currentData.changePercent)}
                      </div>

                      {/* Sentiment Display */}
                      {(() => {
                        const style = getSentimentStyle(overallSentiment);
                        return (
                          <div className={`mt-3 p-3 rounded-lg border-2 ${style.background} backdrop-blur-sm`}>
                            <span className={`text-sm font-medium ${style.text}`}>
                              {style.label}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Price Stats Grid */}
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">Open</div>
                          <div className="text-lg text-white">₹{formatPrice(currentData.open)}</div>
                        </div>
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">Close</div>
                          <div className="text-lg text-white">₹{formatPrice(currentData.close)}</div>
                        </div>
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">High</div>
                          <div className="text-lg text-green-400">₹{formatPrice(currentData.high)}</div>
                        </div>
                        <div className="bg-zinc-700 p-3 rounded">
                          <div className="text-xs text-zinc-400">Low</div>
                          <div className="text-lg text-red-400">₹{formatPrice(currentData.low)}</div>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-zinc-700 pt-4">
                        <div className="grid grid-cols-2 gap-y-2">
                          <div>
                            <div className="text-xs text-zinc-400">Volume</div>
                            <div className="text-white">{currentData.volume?.toLocaleString() || '0'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400">Updated</div>
                            <div className="text-blue-400">
                              {new Date(currentData.timestamp * 1000).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ============ STHITI INTELLIGENCE WIDGETS ============ */}
                      
                      {/* AI Prediction Widget */}
                      {loadingSthitiPrediction ? (
                        <div className="text-center text-zinc-400 text-sm mt-4">Loading predictions...</div>
                      ) : sthitiPrediction ? (
                        <Card className="bg-blue-500/5 border-blue-500/20 mt-4">
                          <CardContent className="p-3">
                            <h4 className="text-sm font-semibold text-blue-400 mb-2">🤖 AI Prediction</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-zinc-400">Sentiment:</span>
                                <span className={getSentimentStyle(sthitiPrediction.sentiment).text}>
                                  {sthitiPrediction.sentiment}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">Confidence:</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    sthitiPrediction.confidence === 'HIGH' 
                                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                      : sthitiPrediction.confidence === 'MEDIUM'
                                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                      : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                                  }`}
                                >
                                  {sthitiPrediction.confidence}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-zinc-400">Score:</span>
                                <span className="text-white">{sthitiPrediction.score?.toFixed?.(2) ?? sthitiPrediction.score}</span>
                              </div>
                              {sthitiPrediction.headlines_analyzed !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-zinc-400">Headlines:</span>
                                  <span className="text-white">{sthitiPrediction.headlines_analyzed}</span>
                                </div>
                              )}
                              <div className="mt-2 pt-2 border-t border-zinc-700">
                                <p className="text-xs text-zinc-400">{sthitiPrediction.reasoning}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null}

                      {/* Sentiment Clusters */}
                      {!loadingSthitiClusters && (sthitiPositiveClusters.length > 0 || sthitiNegativeClusters.length > 0 || sthitiNeutralClusters.length > 0) && (
                        <div className="space-y-2 mt-4">
                          <h4 className="text-sm font-semibold text-zinc-400">Market Sentiment</h4>
                          
                          {sthitiPositiveClusters.length > 0 && (
                            <Card className="bg-green-500/5 border-green-500/20">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="h-4 w-4 text-green-400" />
                                  <span className="text-green-400 font-medium">
                                    Positive ({sthitiPositiveClusters.length})
                                  </span>
                                </div>
                                <ScrollArea className="h-[100px]">
                                  {sthitiPositiveClusters.map((cluster, i) => (
                                    <div key={i} className="text-xs text-zinc-300 mb-1">
                                      • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                    </div>
                                  ))}
                                </ScrollArea>
                              </CardContent>
                            </Card>
                          )}

                          {sthitiNegativeClusters.length > 0 && (
                            <Card className="bg-red-500/5 border-red-500/20">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingDown className="h-4 w-4 text-red-400" />
                                  <span className="text-red-400 font-medium">
                                    Negative ({sthitiNegativeClusters.length})
                                  </span>
                                </div>
                                <ScrollArea className="h-[100px]">
                                  {sthitiNegativeClusters.map((cluster, i) => (
                                    <div key={i} className="text-xs text-zinc-300 mb-1">
                                      • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                    </div>
                                  ))}
                                </ScrollArea>
                              </CardContent>
                            </Card>
                          )}

                          {sthitiNeutralClusters.length > 0 && (
                            <Card className="bg-zinc-500/5 border-zinc-500/20">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-zinc-400 font-medium">
                                    Neutral ({sthitiNeutralClusters.length})
                                  </span>
                                </div>
                                <ScrollArea className="h-[80px]">
                                  {sthitiNeutralClusters.map((cluster, i) => (
                                    <div key={i} className="text-xs text-zinc-300 mb-1">
                                      • {cluster.representative_phrases?.[0] || 'No phrase available'}
                                    </div>
                                  ))}
                                </ScrollArea>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Market News Widget */}
                      <div className="mt-4">
                        <HistoricalMarketNews
                          symbol={selectedCompany}
                          date={selectedDate}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <Database className="h-12 w-12 text-zinc-600" />
                      <p className="text-zinc-500 text-sm">
                        Select a company to view historical data and analysis
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ============ HISTORICAL CHART CAROUSEL (BOTTOM) ============ */}
              {selectedCompany && selectedDate && (
                <div className="mb-8">
                  <HistoricalChartCarousel
                    companyCode={selectedCompany}
                    selectedDate={selectedDate}
                    overallSentiment={overallSentiment}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default RecommendationListPage;
