'use client'
import { useState, useEffect, useCallback } from 'react';
import { usePathname,useSearchParams  } from 'next/navigation';
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
import { Card, CardContent } from "@/components/ui/card";
import { ModeToggle } from "../components/toggleButton";
import { CardWithForm } from "../components/options";
import { StockChart } from "../components/charts/StockChart";
import { CalendarForm } from "../components/controllers/CalendarForm";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useStockData } from "@/hooks/useStockData";
import dynamic from 'next/dynamic';
const MarketDataPage = dynamic(() => import('../market-data/page'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[80vh]">
      <div className="animate-pulse text-blue-500">Loading market data...</div>
    </div>
  )
});
export default function Page() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMarketDataRoute = pathname?.includes('/market-data');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string | null>(null);
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>();
    const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false);
  const { 
    companies, 
    loading: watchlistLoading, 
    error: watchlistError,
    selectedWatchlist: currentWatchlist,
    setSelectedWatchlist: setWatchlist,
    exists: watchlistExists
  } = useWatchlist();
  const { 
    data: stockData, 
    loading: stockLoading, 
    error: stockError, 
    dataRange,
  loadDataForRange,
    fetchData, 
    fetchAllData, 
    clearData 
  } = useStockData({
    companyCode: selectedCompany,  
    exchange: selectedExchange,          
    interval: selectedInterval,
    indicators: selectedIndicators,
     enableIncrementalLoading: true
  });
  const pageTitle = isMarketDataRoute ? "Market Data" : "Historical Data";
  const handleCompanyChange = useCallback((companyCode: string | null, exchange?: string) => {
    console.log(`Selected: ${companyCode} (${exchange})`);
    setSelectedCompany(companyCode);
    setSelectedExchange(exchange || null);
    clearData();
  }, [clearData]);
  const handleDateRangeChange = useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
    clearData();
  }, [clearData]);
  const handleFetchData = useCallback(() => {
    if (selectedCompany && selectedStartDate) {
      console.log('Fetching data with date range:', selectedStartDate, selectedEndDate);
      fetchData(selectedStartDate, selectedEndDate);
    }
  }, [selectedCompany, selectedStartDate, selectedEndDate, fetchData]);
  const handleFetchAllData = useCallback(() => {
    if (selectedCompany) {
      console.log('Fetching all available data for company:', selectedCompany);
      fetchAllData();
    }
  }, [selectedCompany, fetchAllData]);
  const handleIntervalChange = useCallback((newInterval: string) => {
    console.log('Interval changed from', selectedInterval, 'to', newInterval);
    setSelectedInterval(newInterval);
  }, [selectedInterval]);
  const handleIndicatorsChange = useCallback((indicators: string[]) => {
    setSelectedIndicators(indicators);
  }, []);
  const handleRangeChange = async (startDate: Date, endDate: Date) => {
  try {
    const response = await fetch(`/api/companies/${selectedCompany}/ohlcv?` + new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interval: selectedInterval,
      exchange: 'NSE'
    }));
    const newData = await response.json();
  } catch (error) {
    console.error('Error fetching range data:', error);
  }
};
 useEffect(() => {
    if (urlParamsProcessed) return;
    const urlCompany = searchParams.get('company');
    const urlExchange = searchParams.get('exchange');
    const urlWatchlist = searchParams.get('watchlist');
    const urlInterval = searchParams.get('interval');
    const autoLoad = searchParams.get('autoLoad');
    if (urlCompany && urlExchange) {
      console.log('🔗 Processing URL parameters:', {
        company: urlCompany,
        exchange: urlExchange,
        watchlist: urlWatchlist,
        interval: urlInterval,
        autoLoad
      });
      if (urlWatchlist && urlWatchlist !== selectedWatchlist) {
        setSelectedWatchlist(urlWatchlist);
        setWatchlist(urlWatchlist);
      }
      if (urlInterval && urlInterval !== selectedInterval) {
        setSelectedInterval(urlInterval);
      }
      setTimeout(() => {
        setSelectedCompany(urlCompany);
        setSelectedExchange(urlExchange);
        if (autoLoad === 'true') {
          setIsAutoLoading(true);
          clearData();
          setTimeout(() => {
            handleFetchAllData();
            setIsAutoLoading(false);
          }, 500);
        }
      }, 100);
      setUrlParamsProcessed(true);
    } else {
      setUrlParamsProcessed(true);
    }
  }, [searchParams, selectedWatchlist, selectedInterval, setWatchlist, clearData, handleFetchAllData, urlParamsProcessed]);
  const handleWatchlistChange = useCallback((watchlist: string) => {
    setSelectedWatchlist(watchlist);
    setWatchlist(watchlist);
    setSelectedCompany(null); 
    clearData();
  }, [setWatchlist, clearData]);
  useEffect(() => {
    if (selectedCompany && !selectedStartDate) {
      console.log('Auto-fetching all data for newly selected company:', selectedCompany);
      handleFetchAllData();
    }
  }, [selectedCompany, selectedStartDate, handleFetchAllData]);
  useEffect(() => {
    if (selectedCompany && stockData.length > 0) {
      console.log('Interval changed, refetching data for company:', selectedCompany);
      if (!selectedStartDate) {
        handleFetchAllData();
      } else {
        handleFetchData();
      }
    }
  }, [selectedInterval, selectedCompany, stockData.length, selectedStartDate, handleFetchAllData, handleFetchData]);
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      :root {
        --popover: 0 0% 3.9%;
        --popover-foreground: 0 0% 98%;
      }
      .select-content {
        background-color: hsl(0 0% 3.9%) !important;
        color: hsl(0 0% 98%) !important;
        border: 1px solid hsl(0 0% 14.9%) !important;
      }
      [data-radix-select-viewport] {
        background-color: hsl(0 0% 3.9%) !important;
      }
      [data-radix-select-item] {
        color: hsl(0 0% 98%) !important;
      }
      [data-radix-select-item]:focus {
        background-color: hsl(0 0% 14.9%) !important;
      }
    `;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
    const isChartLoading = stockLoading || isAutoLoading;
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
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {}
          {isAutoLoading && (
            <Card className="w-full border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-blue-700">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  <span className="font-medium">Loading company data from URL parameters...</span>
                </div>
              </CardContent>
            </Card>
          )}
          {isMarketDataRoute ? (
            <MarketDataPage />
          ) : (
            <>
              <Card className="w-full">
                <CardContent className="p-4">
                  <div className="flex gap-4 items-center justify-between w-full">
                    <CardWithForm 
                      onCompanyChange={handleCompanyChange} 
                      onDateRangeChange={handleDateRangeChange}
                      onFetchData={handleFetchData}
                      onIntervalChange={handleIntervalChange}
                      onIndicatorsChange={handleIndicatorsChange}
                      selectedWatchlist={selectedWatchlist}
                      onWatchlistChange={handleWatchlistChange} 
                      loading={isChartLoading}
                    />
                    <div className="p-3 border border-opacity-30 rounded-md h-24 flex items-center justify-end w-fit mr-4">
                      <CalendarForm 
                        onDateRangeChange={handleDateRangeChange}
                        onFetchData={handleFetchData}
                        onFetchAllData={handleFetchAllData}
                        loading={isChartLoading}
                      />
                    </div>
                    {stockError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                        ❌ {stockError}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div className="min-h-[500px] flex-1 rounded-xl bg-muted/50">
                <StockChart 
                  companyId={selectedCompany}  
                  exchange={selectedExchange}  
                  data={stockData}
                  startDate={selectedStartDate}
                  endDate={selectedEndDate}
                  interval={selectedInterval}
                  onIntervalChange={handleIntervalChange}
                  indicators={selectedIndicators}
                  loading={isChartLoading}
                  error={stockError}
                  onRangeChange={handleRangeChange}
                />
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
