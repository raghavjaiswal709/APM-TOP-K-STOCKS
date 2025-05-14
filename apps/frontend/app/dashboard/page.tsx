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
import { useWatchlist } from "@/hooks/useWatchlist";

// Import the MarketDataPage dynamically to avoid SSR issues
import dynamic from 'next/dynamic';
const MarketDataPage = dynamic(() => import('../market-data/page'), { ssr: false });

export default function Page() {
const pathname = usePathname();
const isMarketDataRoute = pathname?.includes('/market-data');

  
  // State for all selectors
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedInterval, setSelectedInterval] = useState('10m');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  
  // Get watchlist data for the companies list
  const { companies, selectedWatchlist, setSelectedWatchlist, loading, error } = useWatchlist();

  // Set page title based on route
  const pageTitle = isMarketDataRoute ? "Market Data" : "Stock Chart";

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
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {isMarketDataRoute ? (
            // Render Market Data Page
            <MarketDataPage />
          ) : (
            // Render Dashboard Content
            <>
              {/* Control panel with selectors */}
              <CardWithForm 
                onCompanyChange={setSelectedCompany}
                onDateChange={setSelectedDate}
                onIntervalChange={setSelectedInterval}
                onIndicatorsChange={setSelectedIndicators}
                selectedWatchlist={selectedWatchlist}
                onWatchlistChange={setSelectedWatchlist}
              />
              
              {/* Stock chart */}
              <div className="min-h-[500px] flex-1 rounded-xl bg-muted/50">
                <StockChart 
                  companyId={selectedCompany}
                  startDate={selectedDate}
                  endDate={undefined}
                  interval={selectedInterval}
                  indicators={selectedIndicators}
                />
              </div>
              
              {/* Watchlist Companies List */}
              <Card className="w-full border border-opacity-30 border-gray-300 h-[400px] overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">Watchlist {selectedWatchlist} Companies</h3>
                    <span className="text-sm text-muted-foreground">
                      {loading ? 'Loading...' : `${companies.length} companies`}
                    </span>
                  </div>
                  
                  <div className="h-[440px] overflow-y-auto pr-2">
                    {error ? (
                      <div className="flex items-center justify-center h-full text-destructive">
                        {error}
                      </div>
                    ) : loading ? (
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
