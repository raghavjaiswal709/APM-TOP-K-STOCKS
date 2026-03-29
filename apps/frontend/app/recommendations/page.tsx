'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { usePersistentState, useScrollRestoration } from '@/hooks/useStateRestoration';
import { usePageState, usePersistedRecommendationsState } from '@/app/context/PageStateContext';
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
import { BarChart2, Database, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, BarChart3, Cpu, Network, Clock } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Components
import { TimeMachineStockChart as StockChart } from "./components/TimeMachineStockChart";
import { CompanyList } from "../components/CompanyList";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { HistoricalChartCarousel } from "./components/HistoricalChartCarousel";
import { ClosedPriceDashboard } from "./components/ClosedPriceDashboard";

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
  const { updateRecommendationsState } = usePageState();
  const persistedState = usePersistedRecommendationsState();

  // Analysis Visibility State
  const [isAnalysisVisible, setIsAnalysisVisible] = usePersistentState<boolean>(
    'recommendations-isAnalysisVisible',
    persistedState?.isAnalysisVisible || false
  );

  // Drag-to-resize state
  const [analysisHeight, setAnalysisHeight] = useState<number>(45); // percentage
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag handlers for resizable analysis panel
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newHeight = ((containerRect.bottom - e.clientY) / containerRect.height) * 100;
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
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
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

  // Scroll restoration
  useScrollRestoration('recommendations-main-scroll');

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

  // Sync state to context
  useEffect(() => {
    updateRecommendationsState({
      isAnalysisVisible,
      selectedCompany,
      selectedDate,
      scrollPosition: window.scrollY,
    });
  }, [isAnalysisVisible, selectedCompany, selectedDate, updateRecommendationsState]);

  // Show all companies filter state
  const [showAllCompanies, setShowAllCompanies] = usePersistentState<boolean>(
    'recommendations-showAllCompanies',
    false
  );

  // Use Watchlist Hook for consistent company list in sidebar
  const {
    companies: watchlistCompanies,
    loading: watchlistLoading
  } = useWatchlist({ date: selectedDate || undefined, showAllCompanies });

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
        <div className="flex flex-1 min-h-0 overflow-hidden" ref={mainRowRef}>

          {/* LEFT: CHART & ANALYSIS SPLIT */}
          <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden" ref={containerRef}>

            {/* Upper: Chart */}
            <div
              className="relative border-b flex flex-col overflow-hidden"
              style={{
                flex: isAnalysisVisible ? `0 0 ${100 - analysisHeight}%` : '1 1 auto',
                transition: isDragging ? 'none' : 'flex-basis 300ms ease-in-out'
              }}
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

            {/* Bottom Analysis Panel — same 4-tab structure as market-data, adapted for Time Machine */}
            <Tabs defaultValue="closedprice" className="flex flex-col min-h-0" style={{ flex: isAnalysisVisible ? `0 0 ${analysisHeight}%` : '0 0 auto' }}>
              {/* Toggle Button with TabsList — ALWAYS VISIBLE */}
              <div className="flex-none bg-background z-20 border-t sticky bottom-0">
                {isAnalysisVisible ? (
                  <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/30">
                    {/* Tabs on the left */}
                    <TabsList className="h-7 bg-muted/50 p-0.5">
                      <TabsTrigger value="closedprice" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Clock className="h-3 w-3 mr-1" />Closed Price
                      </TabsTrigger>
                      <TabsTrigger value="predictions" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Cpu className="h-3 w-3 mr-1" />AI Predictions &amp; GTT
                      </TabsTrigger>
                      <TabsTrigger value="metrices" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <BarChart3 className="h-3 w-3 mr-1" />Metrices
                      </TabsTrigger>
                      <TabsTrigger value="umap" className="text-xs h-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                        <Network className="h-3 w-3 mr-1" />UMAP Clustering
                      </TabsTrigger>
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

              {/* Tab Contents — only rendered when panel is visible and a company is selected */}
              {isAnalysisVisible && selectedCompany && (
                <div className="flex-1 min-h-0 flex flex-col bg-background/50 overflow-hidden">
                  <div className="flex-1 overflow-hidden relative">

                    {/* TAB 1: Closed Price — historical snapshot of the selected session */}
                    <TabsContent value="closedprice" className="h-full m-0">
                      <ScrollArea className="h-full w-full">
                        <ClosedPriceDashboard
                          company={selectedCompany}
                          selectedDate={selectedDate}
                          currentData={currentData}
                          overallSentiment={overallSentiment}
                          totalDataPoints={historicalDataPoints.length}
                        />
                      </ScrollArea>
                    </TabsContent>

                    {/* TAB 2: AI Predictions & GTT — not available in Time Machine */}
                    <TabsContent value="predictions" className="h-full m-0">
                      <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                        <div className="text-center space-y-3 max-w-sm">
                          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                            <Cpu className="h-8 w-8 opacity-30" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">Not Available in Time Machine</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            AI Predictions &amp; GTT require a live market connection. This feature is unavailable for historical replay sessions.
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* TAB 3: Metrices — not available in Time Machine */}
                    <TabsContent value="metrices" className="h-full m-0">
                      <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                        <div className="text-center space-y-3 max-w-sm">
                          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                            <BarChart3 className="h-8 w-8 opacity-30" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">Not Available in Time Machine</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Live metric images are generated from real-time feeds and are unavailable for historical sessions.
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    {/* TAB 4: UMAP Clustering — not available in Time Machine */}
                    <TabsContent value="umap" className="h-full m-0">
                      <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                        <div className="text-center space-y-3 max-w-sm">
                          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
                            <Network className="h-8 w-8 opacity-30" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground">Not Available in Time Machine</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            UMAP Clustering analysis runs against live market data. Historical clustering is not supported in this mode.
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                  </div>
                </div>
              )}
            </Tabs>
          </div>

          {/* RIGHT: SIDEBAR (COMPANY LIST) - Draggable & Collapsible */}
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
                  onSelect={handleCompanySelect}
                  loading={watchlistLoading}
                  selectedWatchlistDate={selectedDate}
                  onWatchlistDateChange={handleDateChange}
                  availableDates={availableDates}
                  showAllCompanies={showAllCompanies}
                  onShowAllCompaniesChange={setShowAllCompanies}
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

      </SidebarInset>
    </SidebarProvider>
  );
};

export default RecommendationListPage;
