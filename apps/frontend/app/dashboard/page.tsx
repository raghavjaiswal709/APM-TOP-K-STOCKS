'use client'
import { useState, useEffect, useCallback } from 'react';
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
  
  // **ENHANCED**: Use the enhanced stock data hook with fetchAllData capability
  const { 
    data: stockData, 
    loading: stockLoading, 
    error: stockError, 
    fetchData, 
    fetchAllData, 
    clearData 
  } = useStockData({
    companyId: selectedCompany,
    interval: selectedInterval,
    indicators: selectedIndicators
  });

  const pageTitle = isMarketDataRoute ? "Market Data" : "Historical Data";

  // **ENHANCED**: Handle date range changes with useCallback for performance
  const handleDateRangeChange = useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
    // Clear existing data when dates change
    clearData();
  }, [clearData]);

  // **ENHANCED**: Handle manual data fetch with date range
  const handleFetchData = useCallback(() => {
    if (selectedCompany && selectedStartDate) {
      console.log('Fetching data with date range:', selectedStartDate, selectedEndDate);
      fetchData(selectedStartDate, selectedEndDate);
    }
  }, [selectedCompany, selectedStartDate, selectedEndDate, fetchData]);

  // **NEW**: Handle fetch all data without date restrictions
  const handleFetchAllData = useCallback(() => {
    if (selectedCompany) {
      console.log('Fetching all available data for company:', selectedCompany);
      fetchAllData();
    }
  }, [selectedCompany, fetchAllData]);

  // Clear data when company changes
  useEffect(() => {
    clearData();
  }, [selectedCompany, clearData]);

  // **NEW**: Auto-fetch all data when company is selected (optional behavior)
  useEffect(() => {
    if (selectedCompany && !selectedStartDate) {
      // Automatically fetch all data when a company is selected and no date range is set
      console.log('Auto-fetching all data for newly selected company:', selectedCompany);
      handleFetchAllData();
    }
  }, [selectedCompany, selectedStartDate, handleFetchAllData]);

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
              {/* **ENHANCED**: Control panel with better layout and status */}
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
                    
                    {/* **ENHANCED**: Date Range Selection with Both Fetch Buttons */}
                    <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-center">
                      <CalendarForm 
                        onDateRangeChange={handleDateRangeChange}
                        onFetchData={handleFetchData}
                        onFetchAllData={handleFetchAllData}
                        loading={stockLoading}
                      />
                    </div>
                    
                    {/* **ENHANCED**: Status Display with better messaging */}
                    {stockError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                        ❌ {stockError}
                      </div>
                    )}
                    
                    {/* **NEW**: Enhanced status display */}
                    {stockData.length > 0 && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">
                        ✅ Loaded {stockData.length} data points
                        {selectedStartDate && selectedEndDate ? 
                          ` from ${selectedStartDate.toLocaleDateString()} to ${selectedEndDate.toLocaleDateString()}` :
                          selectedStartDate ? 
                            ` for first 15 minutes of ${selectedStartDate.toLocaleDateString()}` :
                            ` (all available data)`
                        }
                      </div>
                    )}

                    {/* **NEW**: Company selection status */}
                    {selectedCompany && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-md text-sm">
                        📊 Selected Company: {companies.find(c => c.company_code === selectedCompany)?.tradingsymbol || selectedCompany}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* **ENHANCED**: Stock chart with better props */}
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
              
              {/* **ENHANCED**: Watchlist Companies List with better interaction */}
              <Card className="w-full border border-opacity-30 h-[400px] overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Watchlist {selectedWatchlist} Companies</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {watchlistLoading ? 'Loading...' : `${companies.length} companies`}
                      </span>
                      {selectedCompany && (
                        <button
                          onClick={() => setSelectedCompany(null)}
                          className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
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
                                ? 'bg-primary text-primary-foreground shadow-md' 
                                : 'bg-secondary hover:bg-secondary/80'}`}
                            onClick={() => setSelectedCompany(company.company_code)}
                          >
                            <div className="font-medium truncate">{company.tradingsymbol}</div>
                            <div className="text-xs opacity-80 truncate">{company.name}</div>
                            {selectedCompany === company.company_code && (
                              <div className="text-xs mt-1 opacity-90">
                                {stockData.length > 0 ? `${stockData.length} data points loaded` : 'Click "Fetch All Data" to load'}
                              </div>
                            )}
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
