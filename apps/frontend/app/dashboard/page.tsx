'use client';
import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { BarChart2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
import { LightWeightStockChart as StockChart } from "../components/charts/LightWeightStockChart";
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
  }) as any;

  const {
    data: stockData,
    loading: stockLoading,
    error: stockError,
    fetchData: fetchStockData,
    loadDataForRange,
    clearData
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

  // Trigger Fetch on Company Change (Default All Data) - but only if no data exists
  useEffect(() => {
    if (selectedCompany) {
      // Only fetch if we don't already have data (prevents reload on page return)
      if (!stockData || stockData.length === 0) {
        fetchStockData(undefined, undefined, { fetchAllData: true })
          .then(() => setIsAutoLoading(false));
      } else {
        setIsAutoLoading(false);
      }
    } else {
      clearData();
    }
  }, [selectedCompany, selectedExchange]);

  // Refetch on Interval Change
  useEffect(() => {
    if (selectedCompany) {
      fetchStockData(selectedStartDate, selectedEndDate, { fetchAllData: !selectedStartDate });
    }
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

  const handleRangeChange = useCallback(async (startDate: Date, endDate: Date) => {
    if (!selectedCompany) return;
    try {
      await loadDataForRange(startDate, endDate);
    } catch (error) {
      console.error('Error fetching range data:', error);
    }
  }, [selectedCompany, loadDataForRange]);

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
            {selectedCompany ? (
              <StockChart
                companyId={selectedCompany}
                data={stockData}
                interval={selectedInterval}
                onIntervalChange={handleIntervalChange}
                indicators={selectedIndicators}
                loading={stockLoading || isAutoLoading}
                height="100%"
                className="w-full h-full"
                onRangeChange={handleRangeChange}
              />
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
