'use client';
import React, { useState, useEffect, useCallback } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LiveMarketGrid from './components/LiveMarketGrid';
import { MultiSelectWatchlistSelector } from '../components/controllers/WatchlistSelector/MultiSelectWatchlistSelector';
import { useLiveMarket } from '../../hooks/useLiveMarket';
import { Info, Activity, Users, TrendingUp } from 'lucide-react';

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}

const LiveMarketPage: React.FC = () => {
  const {
    availableCompanies,
    selectedCompanies: liveMarketSelectedCompanies,
    marketData,
    marketStatus,
    connectionStatus,
    error,
    loading,
    subscribeToCompanies,
    unsubscribeAll,
    isConnected
  } = useLiveMarket();

  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [selectedWatchlist, setSelectedWatchlist] = useState('A');

  // FIXED: Proper company selection handler
  const handleCompaniesSelect = useCallback((companies: Company[]) => {
    console.log('🔍 Companies selected in LiveMarketPage:', companies);
    setSelectedCompanies(companies);
    
    // FIXED: Pass Company objects directly to subscribeToCompanies
    if (companies.length > 0) {
      console.log('📡 Subscribing to companies:', companies);
      subscribeToCompanies(companies);
    } else {
      console.log('📡 No companies selected, unsubscribing from all');
      unsubscribeAll();
    }
  }, [subscribeToCompanies, unsubscribeAll]);

  const handleWatchlistChange = useCallback((watchlist: string) => {
    console.log('Watchlist changed to:', watchlist);
    setSelectedWatchlist(watchlist);
    // Clear selections when watchlist changes
    setSelectedCompanies([]);
    unsubscribeAll();
  }, [unsubscribeAll]);

  const handleClearSelection = useCallback(() => {
    console.log('📡 Clearing all selections');
    setSelectedCompanies([]);
    unsubscribeAll();
  }, [unsubscribeAll]);

  // FIXED: Convert selected companies to the format expected by LiveMarketGrid
  const gridSelectedCompanies = React.useMemo(() => {
    return selectedCompanies.map(company => ({
      ...company,
      // Ensure symbol is properly formatted
      symbol: company.symbol || `${company.exchange}:${company.company_code}-${company.marker}`
    }));
  }, [selectedCompanies]);

  // FIXED: Debug logging for state changes
  useEffect(() => {
    console.log('🔍 LiveMarketPage State Update:', {
      selectedCompanies: selectedCompanies.length,
      liveMarketSelectedCompanies: liveMarketSelectedCompanies.length,
      marketDataKeys: Object.keys(marketData),
      isConnected,
      loading,
      error
    });
  }, [selectedCompanies, liveMarketSelectedCompanies, marketData, isConnected, loading, error]);

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
                  <BreadcrumbPage>Live Market Grid</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Header Card */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Live Market Data Grid
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Monitor real-time market data for up to 6 companies from your watchlists
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">
                      {connectionStatus}
                    </span>
                  </div>
                  {marketStatus?.trading_active && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Activity className="w-3 h-3 mr-1" />
                      Market Open
                    </Badge>
                  )}
                  {!marketStatus?.trading_active && !marketStatus?.is_market_day && (
                    <Badge variant="secondary">
                      Market Closed
                    </Badge>
                  )}
                  {!marketStatus?.is_market_day && (
                    <Badge variant="outline">
                      Weekend
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Company Selection using WatchlistSelector */}
              <div className="space-y-4 flex  justify-between items-center ">
                {/* <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Select Companies from Watchlist (1-6)</h3>
                  
                </div> */}
                
                <MultiSelectWatchlistSelector
                  onCompaniesSelect={handleCompaniesSelect}
                  selectedWatchlist={selectedWatchlist}
                  onWatchlistChange={handleWatchlistChange}
                  maxSelection={6}
                  selectedCompanies={selectedCompanies}
                  showExchangeFilter={true}
                  showMarkerFilter={true}
                />

                {/* {selectedCompanies.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearSelection}
                      disabled={loading}
                    >
                      {loading ? 'Clearing...' : 'Clear Selection'}
                    </Button>
                  )} */}

                {/* Selection Summary */}
                {selectedCompanies.length > 0 && (
                  <div className="flex flex-col items-end gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{selectedCompanies.length} companies selected</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className="w-4 h-4" />
                      <span>{Object.keys(marketData).length} receiving data</span>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span>Subscribing to market data...</span>
                  </div>
                )}

                {/* Error Display */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    ❌ {error}
                  </div>
                )}

                {/* Debug Info (Development only) */}
                {/* {process.env.NODE_ENV === 'development' && (
                  <div className="bg-gray-50 border border-gray-200 text-gray-700 px-3 py-2 rounded-md text-xs">
                    <strong>Debug:</strong> Selected: {selectedCompanies.length}, 
                    Connected: {isConnected ? 'Yes' : 'No'}, 
                    Market Data: {Object.keys(marketData).length} symbols
                  </div>
                )} */}
              </div>
            </CardContent>
          </Card>

          {/* Live Market Grid */}
          {selectedCompanies.length > 0 && (
            <LiveMarketGrid
              selectedCompanies={gridSelectedCompanies}
              marketData={marketData}
              connectionStatus={connectionStatus}
              loading={loading}
            />
          )} 

          {/* No Selection State */}
          {selectedCompanies.length === 0 && (
            <Card className="w-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Companies Selected</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Select 1-6 companies from your watchlist above to start monitoring their real-time market data in an interactive grid layout.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default LiveMarketPage;
