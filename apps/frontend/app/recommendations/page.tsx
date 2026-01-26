'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { BarChart2, Database, PanelBottomOpen, PanelBottomClose, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Components
import { LightWeightStockChart as StockChart } from "../components/charts/LightWeightStockChart";
import { CompanyList } from "../components/CompanyList";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { HistoricalChartCarousel } from "./components/HistoricalChartCarousel";

// Hooks & Services
import { parseFullHistoricalData, convertToOHLC } from '@/lib/historicalTimeMachine';
import { useTimeMachine } from '@/hooks/useTimeMachine';
import {
  fetchSthitiClusters,
  fetchSthitiPrediction,
  type SthitiCluster,
  type SthitiPrediction
} from '@/lib/historicalSthitiService';
import { useWatchlist } from "@/hooks/useWatchlist";
import { useTheme } from "next-themes";

// Types
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
  bid?: number;
  ask?: number;
  buyVolume?: number;
  sellVolume?: number;
}

const RecommendationListPage: React.FC = () => {
  const [isClient, setIsClient] = useState(false);
  const { theme } = useTheme();
  // Analysis Visibility State
  const [isAnalysisVisible, setIsAnalysisVisible] = useState(false);

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

  // Use Time Machine Hook
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

  // Use Watchlist Hook for consistent company list in sidebar
  const {
    companies: watchlistCompanies,
    loading: watchlistLoading
  } = useWatchlist({ date: selectedDate || undefined });

  // Merge availableCompanies from TimeMachine (strings) with Watchlist (objects)
  // This ensures we always show the companies available in the file system for that date
  const companies = useMemo(() => {
    if (watchlistCompanies && watchlistCompanies.length > 0) {
      // Filter watchlist companies to only include those available in TimeMachine (if loaded)
      if (availableCompanies.length > 0) {
        return watchlistCompanies.filter((c: any) => availableCompanies.includes(c.company_code));
      }
      return watchlistCompanies;
    }
    // Fallback: Create minimal company objects from availableCompanies string array
    return availableCompanies.map(code => ({
      company_code: code,
      name: code, // Placeholder name
      exchange: 'NSE', // Default
      marker: '',
    }));
  }, [watchlistCompanies, availableCompanies]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handlers
  const handleCompanySelect = useCallback((companyCode: string) => {
    setSelectedCompany(companyCode);
  }, [setSelectedCompany]);

  const handleDateChange = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, [setSelectedDate, setSelectedCompany]);

  // Fetch Full Historical Data
  useEffect(() => {
    if (!selectedDate || !selectedCompany) {
      setHistoricalDataPoints([]);
      setOHLCDataPoints([]);
      return;
    }

    const loadChartData = async () => {
      setLoadingFullData(true);
      try {
        const points = await parseFullHistoricalData(selectedCompany, selectedDate);
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
        // User requested "tick by tick" feel. 1-minute candles provide good granularity while maintaining performance.
        // Raw ticks can be thousands per minute, unsuited for this chart type unless using LineSeries with unique seconds.
        // 1-minute is a safe, high-resolution default.
        const ohlcCandles = convertToOHLC(points, 1);
        setOHLCDataPoints(ohlcCandles);
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

  // Fetch Sthiti Data
  useEffect(() => {
    if (!selectedDate || !selectedCompany) {
      // Clear logic...
      return;
    }
    const loadSthitiData = async () => {
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
      } catch (e) { console.error(e); } finally { setLoadingSthitiClusters(false); }

      setLoadingSthitiPrediction(true);
      try {
        const prediction = await fetchSthitiPrediction(selectedCompany, selectedDate);
        setSthitiPrediction(prediction);
      } catch (e) { console.error(e); } finally { setLoadingSthitiPrediction(false); }
    };
    loadSthitiData();
  }, [selectedDate, selectedCompany]);



  // Convert for LightWeightStockChart
  const chartData = useMemo(() => {
    // Use OHLC data which is already bucketed and deduplicated (unique timestamps)
    // using historicalDataPoints includes raw ticks which causes "Assertion failed: data must be asc ordered" error due to duplicate timestamps
    return ohlcDataPoints.map(p => ({
      interval_start: new Date(p.timestamp * 1000).toISOString(),
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume,
      bid: p.bid,
      ask: p.ask,
      buyVolume: p.buyVolume,
      sellVolume: p.sellVolume
    }));
  }, [ohlcDataPoints]);

  const currentData = useMemo<MarketData | null>(() => {
    if (historicalDataPoints.length > 0) return historicalDataPoints[historicalDataPoints.length - 1];
    return null;
  }, [historicalDataPoints]);

  const overallSentiment = useMemo(() => {
    if (sthitiPrediction) return sthitiPrediction.sentiment || 'NEUTRAL';
    if (sthitiPositiveClusters.length > sthitiNegativeClusters.length) return 'POSITIVE';
    if (sthitiNegativeClusters.length > sthitiPositiveClusters.length) return 'NEGATIVE';
    return 'NEUTRAL';
  }, [sthitiPrediction, sthitiPositiveClusters, sthitiNegativeClusters]);

  const pageTitle = selectedCompany ? `${selectedCompany} Time Machine` : "Historical Data Time Machine";

  if (!isClient) return null;

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

          <div className="flex items-center gap-2">
            <ModeToggle />
          </div>
        </header>

        {/* MAIN CONTENT ROW */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: CHART & ANALYSIS SPLIT */}
          <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">

            {/* Upper: Chart */}
            <div
              className="relative border-b flex flex-col transition-[flex-basis] duration-300 ease-in-out overflow-hidden"
              style={{ flex: isAnalysisVisible ? '0 0 55%' : '1 1 auto' }}
            >
              {selectedCompany ? (
                <div className="relative w-full h-full flex flex-col">
                  {/* StockChart takes full height of this container */}
                  <StockChart
                    companyId={selectedCompany}
                    data={chartData}
                    interval="1m"
                    loading={loadingFullData}
                    height="100%"
                    className="w-full h-full"
                    theme={theme === 'light' ? 'light' : 'dark'}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground p-8 text-center flex-col gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Database size={32} />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Time Machine Mode</h2>
                  <p className="max-w-md">
                    Select a date and company from the sidebar to replay historical market data.
                  </p>
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

            {/* Lower: Analysis / Carousel (Collapsible) - Fills Helper */}
            {selectedCompany && isAnalysisVisible && (
              <div className="flex-1 min-h-0 flex flex-col bg-background/50 overflow-hidden animate-in slide-in-from-bottom-5 duration-300 fade-in">
                <Tabs defaultValue="analysis" className="flex-1 flex flex-col min-h-0">
                  <div className="border-b px-4 bg-muted/20 shrink-0">
                    <TabsList className="h-9">
                      <TabsTrigger value="analysis" className="text-xs">Sentiment & Prediction</TabsTrigger>
                      <TabsTrigger value="charts" className="text-xs">Historical Charts</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    <TabsContent value="analysis" className="h-full m-0 p-0">
                      <div className="h-full w-full">
                        <AnalysisPanel
                          selectedCompany={selectedCompany}
                          currentData={currentData}
                          overallSentiment={overallSentiment}
                          sthitiPrediction={sthitiPrediction}
                          loadingSthitiPrediction={loadingSthitiPrediction}
                          sthitiPositiveClusters={sthitiPositiveClusters}
                          sthitiNegativeClusters={sthitiNegativeClusters}
                          sthitiNeutralClusters={sthitiNeutralClusters}
                          loadingSthitiClusters={loadingSthitiClusters}
                          selectedDate={selectedDate}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent value="charts" className="h-full m-0 p-4 overflow-y-auto">
                      <HistoricalChartCarousel
                        companyCode={selectedCompany}
                        selectedDate={selectedDate || ''}
                        overallSentiment={overallSentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'}
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </div>
            )}
          </div>

          {/* RIGHT: SIDEBAR (COMPANY LIST) */}
          <div className="w-72 border-l bg-background flex flex-col shrink-0 transition-all duration-300">
            <div className="flex-1 overflow-hidden">
              <CompanyList
                companies={companies || []} // Use Watchlist hook companies
                selectedCompanyCode={selectedCompany}
                onSelect={handleCompanySelect}
                loading={watchlistLoading}

                // Date Integration
                selectedWatchlistDate={selectedDate}
                onWatchlistDateChange={handleDateChange}
                availableDates={availableDates}

              // Disable chart range picker since this is Time Machine (single date view)
              // Or maybe we treat "Range" as "Replay Window"? 
              // For now, let's hide range picker or ignore it
              />
            </div>
          </div>

        </div>

      </SidebarInset>
    </SidebarProvider>
  );
};

export default RecommendationListPage;
