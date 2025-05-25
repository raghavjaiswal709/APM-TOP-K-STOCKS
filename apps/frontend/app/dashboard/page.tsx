'use client'
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  const isMarketDataRoute = pathname?.includes('/market-data');
  
  // State for all selectors
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | undefined>(undefined);
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  
  const { companies, selectedWatchlist, setSelectedWatchlist, loading: watchlistLoading, error: watchlistError } = useWatchlist();
  
  // Use the enhanced stock data hook
  const { data: stockData, loading: stockLoading, error: stockError, fetchData, clearData } = useStockData({
    companyId: selectedCompany,
    interval: selectedInterval,
    indicators: selectedIndicators
  });

  const pageTitle = isMarketDataRoute ? "Market Data" : "Historical Data";

  // Handle date range changes
  const handleDateRangeChange = (startDate: Date | undefined, endDate: Date | undefined) => {
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
    // Clear existing data when dates change
    clearData();
  };

  // Handle manual data fetch
  const handleFetchData = () => {
    if (selectedCompany && selectedStartDate) {
      fetchData(selectedStartDate, selectedEndDate);
    }
  };

  // Clear data when company changes
  useEffect(() => {
    clearData();
  }, [selectedCompany, clearData]);

  // Fix for transparent dropdowns
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
          {isMarketDataRoute ? (
            <MarketDataPage />
          ) : (
            <>
              {/* Enhanced Control panel */}
              <Card className="w-full">
                <CardContent className="p-4">
                  <div className="space-y-4 flex">
                    {/* Company and Watchlist Selection */}
                    <CardWithForm 
                      onCompanyChange={setSelectedCompany}
                      onIntervalChange={setSelectedInterval}
                      onIndicatorsChange={setSelectedIndicators}
                      selectedWatchlist={selectedWatchlist}
                      onWatchlistChange={setSelectedWatchlist}
                    />
                    
                    {/* Date Range Selection with Fetch Button */}
                    <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-centerStart Date">
                      {/* <h3 className="text-sm font-medium mb-3">📅 Date Range Selection</h3> */}
                      <CalendarForm 
                        onDateRangeChange={handleDateRangeChange}
                        onFetchData={handleFetchData}
                        loading={stockLoading}
                      />
                    </div>
                    
                    {/* Status Display */}
                    {stockError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                        ❌ {stockError}
                      </div>
                    )}
                    
                    {/* {stockData.length > 0 && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">
                        ✅ Loaded {stockData.length} data points
                        {selectedEndDate ? 
                          ` from ${selectedStartDate?.toLocaleDateString()} to ${selectedEndDate.toLocaleDateString()}` :
                          ` for first 15 minutes of ${selectedStartDate?.toLocaleDateString()}`
                        }
                      </div>
                    )} */}
                  </div>
                </CardContent>
              </Card>
              
              {/* Enhanced Stock chart */}
              <div className="min-h-[500px] flex-1 rounded-xl bg-muted/50">
                <StockChart 
                  companyId={selectedCompany}
                  data={stockData}
                  startDate={selectedStartDate}
                  endDate={selectedEndDate}
                  interval={selectedInterval}
                  indicators={selectedIndicators}
                  loading={stockLoading}
                  error={stockError}
                />
              </div>
              
              {/* Watchlist Companies List */}
              <Card className="w-full border border-opacity-30 h-[400px] overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Watchlist {selectedWatchlist} Companies</h3>
                    <span className="text-sm text-muted-foreground">
                      {watchlistLoading ? 'Loading...' : `${companies.length} companies`}
                    </span>
                  </div>
                  
                  <div className="h-[340px] overflow-y-auto pr-2">
                    {watchlistError ? (
                      <div className="flex items-center justify-center h-full text-destructive">
                        {watchlistError}
                      </div>
                    ) : watchlistLoading ? (
                      <div className="grid grid-cols-1 gap-2 animate-pulse">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="h-8 bg-muted rounded"></div>
                        ))}
                      </div>
                    ) : companies.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No companies in this watchlist
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {companies.map((company) => (
                          <div 
                            key={company.company_code}
                            className={`p-2 rounded-md text-sm cursor-pointer transition-colors
                              ${selectedCompany === company.company_code 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-secondary hover:bg-secondary/80'}`}
                            onClick={() => setSelectedCompany(company.company_code)}
                          >
                            <div className="font-medium truncate">{company.tradingsymbol}</div>
                            <div className="text-xs opacity-80 truncate">{company.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
