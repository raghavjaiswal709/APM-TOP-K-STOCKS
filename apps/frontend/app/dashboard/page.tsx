'use client';
import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Loader2, Database, ChevronDown } from "lucide-react";
import { usePersistentState, useScrollRestoration } from '@/hooks/useStateRestoration';
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
import { DashboardStockChart as StockChart } from "./components/DashboardStockChart";
import { CompanyList } from "../components/CompanyList";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockData } from "@/hooks/useStockData";
import { useSearchParams } from 'next/navigation';
import MarketDataPage from "../market-data/page";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);

  // Scroll restoration for dashboard
  useScrollRestoration('dashboard-scroll');

  // State for Chart - using persistent state (independent from market-data page)
  const [selectedCompany, setSelectedCompany] = usePersistentState<string | null>(
    'dashboard-selectedCompany',
    null
  );
  const [selectedExchange, setSelectedExchange] = usePersistentState<string>(
    'dashboard-selectedExchange',
    ""
  );
  const [selectedMarker, setSelectedMarker] = useState("");
  const [selectedInterval, setSelectedInterval] = usePersistentState<string>(
    'dashboard-selectedInterval',
    "1h"
  );
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [selectedWatchlist, setSelectedWatchlist] = usePersistentState<string>(
    'dashboard-selectedWatchlist',
    ""
  );
  const [showAllCompanies, setShowAllCompanies] = usePersistentState<boolean>(
    'dashboard-showAllCompanies',
    false
  );

  const {
    companies,
    loading: watchlistLoading,
    error: watchlistError,
    selectedDate: watchlistDate,
    setSelectedDate: setWatchlistDate,
    availableDates,
    availableExchanges,
    availableMarkers,
    totalCompanies
  } = useWatchlist({
    showAllCompanies,
  }) as any;

  const {
    data: stockData,
    loading: stockLoading,
    error: stockError,
    isLoadingMore,
    dataRange,
    fetchData: fetchStockData,
    clearData,
    restoreFromDayCache
  } = useStockData({
    companyCode: selectedCompany,
    exchange: selectedExchange,
    interval: selectedInterval,
    indicators: selectedIndicators
  });

  // URL Param Logic
  useEffect(() => {
    if (urlParamsProcessed) return;
    const urlCompany = searchParams.get('company');
    if (urlCompany) {
      setIsAutoLoading(true);
      setSelectedCompany(urlCompany);
      const urlExchange = searchParams.get('exchange');
      if (urlExchange) setSelectedExchange(urlExchange);
      const urlMarker = searchParams.get('marker');
      if (urlMarker) setSelectedMarker(urlMarker);

      setUrlParamsProcessed(true);
    } else {
      setUrlParamsProcessed(true);
    }
  }, [searchParams, urlParamsProcessed]);

  // Trigger Fetch on Company Change — use day-cache for instant restore, then fetch fresh
  useEffect(() => {
    if (selectedCompany) {
      setAtDataStart(false);
      setScrollToDataBoundary(null);
      // 1. Reset local hook state (does NOT wipe the module-level day-cache)
      clearData();

      // 2. Try to instantly restore from the day-cache (same company+exchange+interval, same IST day)
      const cacheEntry = restoreFromDayCache();

      if (cacheEntry) {
        // ★ Cache HIT — data is already showing on chart instantly.
        // Now fetch fresh data and APPEND any new points that arrived since the cache was stored.
        setIsAutoLoading(false); // no loading spinner — user already sees data
        fetchStockData(undefined, undefined, { fetchAllData: true, appendToCache: true });
      } else {
        // ★ Cache MISS — full loading spinner, fetch everything
        setIsAutoLoading(true);
        fetchStockData(undefined, undefined, { fetchAllData: true })
          .finally(() => setIsAutoLoading(false));
      }
    } else {
      clearData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, selectedExchange]);

  // Refetch on Interval Change — interval change means different aggregation, must fetch fresh
  useEffect(() => {
    if (selectedCompany) {
      setAtDataStart(false);
      clearData();

      // Try day-cache for the new interval
      const cacheEntry = restoreFromDayCache();

      if (cacheEntry) {
        setIsAutoLoading(false);
        fetchStockData(selectedStartDate, selectedEndDate, { fetchAllData: !selectedStartDate, appendToCache: true });
      } else {
        setIsAutoLoading(true);
        fetchStockData(selectedStartDate, selectedEndDate, { fetchAllData: !selectedStartDate })
          .finally(() => setIsAutoLoading(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInterval]); // Only interval trigger

  const handleCompanySelect = useCallback((companyCode: string) => {
    const company = companies.find((c: any) => c.company_code === companyCode);
    setSelectedCompany(companyCode);
    if (company) {
      setSelectedExchange(company.exchange);
      setSelectedMarker(company.marker);
    }
  }, [companies]);

  const handleIntervalChange = useCallback((interval: string) => {
    setSelectedInterval(interval);
  }, []);

  // Show "fetch more" panel when user scrolls to the left edge of loaded data
  const [atDataStart, setAtDataStart] = useState(false);
  // After fetchBefore completes, this tells the chart to scroll to show the new-data boundary
  const [scrollToDataBoundary, setScrollToDataBoundary] = useState<number | null>(null);

  // Interval → milliseconds mapping for manual fetch calculation
  const INTERVAL_MS: Record<string, number> = {
    '1m': 60_000, '5m': 300_000, '15m': 900_000,
    '30m': 1_800_000, '1h': 3_600_000, '1d': 86_400_000,
  };

  // Called by chart on every visible range change.
  // Instead of auto-loading, we just detect if the user is at the left edge.
  const handleRangeChange = useCallback(async (startDate: Date, _endDate: Date) => {
    if (!selectedCompany || !dataRange.start) return;
    // Show panel when visible start is at or within 2 candles of the earliest loaded data
    const bufferMs = (INTERVAL_MS[selectedInterval] || 60_000) * 2;
    setAtDataStart(startDate.getTime() <= dataRange.start.getTime() + bufferMs);
  }, [selectedCompany, dataRange.start, selectedInterval]);

  // Manually fetch N more candles going backwards from the earliest loaded point
  const handleFetchMoreCandles = useCallback(async (count: number) => {
    if (!selectedCompany || !dataRange.start) return;
    setAtDataStart(false);
    // Capture old boundary in unix seconds so chart can scroll to the join point after load
    const oldBoundarySec = Math.floor(dataRange.start.getTime() / 1000);
    try {
      const result = await fetchStockData(undefined, dataRange.start, { fetchBefore: true, limit: count, merge: true });
      if (result && result.length > 0) {
        // New data arrived — tell chart to scroll to the old data boundary so user sees new candles
        setScrollToDataBoundary(oldBoundarySec);
      }
    } catch (err) {
      console.error('Error fetching more candles:', err);
    }
  }, [selectedCompany, dataRange.start, fetchStockData]);

  // Handlers for Toolbar
  const handleChartRangeChange = useCallback((start: Date | undefined, end: Date | undefined) => {
    setSelectedStartDate(start);
    setSelectedEndDate(end);
  }, []);

  const handleFetchChartData = useCallback(() => {
    if (selectedCompany && selectedStartDate) {
      fetchStockData(selectedStartDate, selectedEndDate, { merge: false });
    }
  }, [selectedCompany, selectedStartDate, selectedEndDate, fetchStockData]);

  const handleFetchAllChartData = useCallback(() => {
    if (selectedCompany) {
      fetchStockData(undefined, undefined, { fetchAllData: true });
      setSelectedStartDate(undefined);
      setSelectedEndDate(undefined);
    }
  }, [selectedCompany, fetchStockData]);

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

  const pageTitle = selectedCompany ? `${selectedCompany} Dashboard` : "Market Dashboard";

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
                <BreadcrumbLink href="#">Home</BreadcrumbLink>
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

          {/* LEFT: CHART AREA */}
          <div className="flex-1 flex flex-col min-w-0 bg-secondary/5 relative">

            {/* ── Fetch More Candles panel — appears at left when user scrolls to data start ── */}
            {atDataStart && selectedCompany && !stockLoading && !isAutoLoading && !isLoadingMore && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 w-52 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-3 pt-3 pb-2 border-b border-border/60">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Historical Data
                    </span>
                  </div>
                  <div className="text-xs text-foreground">
                    <span className="font-semibold tabular-nums">{(stockData?.length ?? 0).toLocaleString()}</span>
                    <span className="text-muted-foreground"> candles loaded</span>
                  </div>
                </div>

                {/* Fetch buttons */}
                <div className="p-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground font-medium px-1 pb-0.5">Load more ←</p>
                  {([500, 2000, 5000, 7000, 10000] as const).map(count => (
                    <button
                      key={count}
                      onClick={() => handleFetchMoreCandles(count)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium border border-border/70 bg-muted/30 hover:bg-muted/60 hover:border-border transition-colors text-foreground"
                    >
                      <span>+ {count.toLocaleString()} candles</span>
                      <ChevronDown className="h-3 w-3 rotate-90 text-muted-foreground" />
                    </button>
                  ))}
                </div>

                {/* Dismiss */}
                <div className="px-2 pb-2">
                  <button
                    onClick={() => setAtDataStart(false)}
                    className="w-full text-[10px] text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Loading indicator while manual fetch runs */}
            {isLoadingMore && selectedCompany && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2.5 rounded-xl border border-border bg-background shadow-xl px-4 py-3 text-xs text-foreground">
                <div className="h-4 w-4 rounded-full border-2 border-muted border-t-blue-500 animate-spin shrink-0" />
                Fetching candles…
              </div>
            )}

            {selectedCompany ? (
              /* Show a full loading screen while initial data is being fetched.
                 Only render the chart once we actually have data to display. */
              (stockLoading || isAutoLoading) && (!stockData || stockData.length === 0) ? (
                <div className="flex h-full items-center justify-center flex-col gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-muted animate-spin"
                      style={{ borderTopColor: 'hsl(var(--primary))' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{selectedCompany}</p>
                    <p className="text-xs text-muted-foreground mt-1">Fetching historical data…</p>
                  </div>
                </div>
              ) : (
                <StockChart
                  companyId={selectedCompany}
                  data={stockData}
                  interval={selectedInterval}
                  onIntervalChange={handleIntervalChange}
                  indicators={selectedIndicators}
                  loading={stockLoading}
                  isLoadingMore={isLoadingMore}
                  height="100%"
                  className="w-full h-full"
                  onRangeChange={handleRangeChange}
                  scrollToDataBoundary={scrollToDataBoundary}
                />
              )
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground p-8 text-center flex-col gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <BarChart2 size={32} />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Select a Company</h2>
                <p className="max-w-md">
                  Use the sidebar to filter and select companies. Apply date ranges or view graphs using the toolbar.
                </p>
              </div>
            )}
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
                  selectedWatchlistDate={watchlistDate}
                  onWatchlistDateChange={setWatchlistDate}
                  availableDates={availableDates}
                  onChartRangeChange={handleChartRangeChange}
                  onFetchChartData={handleFetchChartData}
                  onFetchAllChartData={handleFetchAllChartData}
                  availableExchanges={availableExchanges}
                  availableMarkers={availableMarkers}
                  totalCompanies={totalCompanies}
                  showAllCompanies={showAllCompanies}
                  onShowAllCompaniesChange={setShowAllCompanies}
                />
              </div>
              {/* Footer Info */}
              {selectedCompany && !stockLoading && stockData?.length > 0 && (
                <div className="p-3 border-t border-l bg-muted/20 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Points:</span>
                    <span className="font-medium">{stockData.length}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Range:</span>
                    <span className="font-medium">
                      {selectedStartDate ? 'Custom' : 'All Data'}
                    </span>
                  </div>
                </div>
              )}
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
}
