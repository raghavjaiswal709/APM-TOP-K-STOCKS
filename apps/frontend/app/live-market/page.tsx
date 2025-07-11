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
// import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LiveMarketGrid from './components/LiveMarketGrid';
import CompanySelector from './components/CompanySelector';
import { useLiveMarket } from '../../hooks/useLiveMarket';
import { Info, Activity, Users, TrendingUp } from 'lucide-react';

const LiveMarketPage: React.FC = () => {
  const {
    availableCompanies,
    selectedCompanies,
    marketData,
    marketStatus,
    connectionStatus,
    error,
    loading,
    subscribeToCompanies,
    unsubscribeAll,
    isConnected
  } = useLiveMarket();

  const [selectedCompanyCodes, setSelectedCompanyCodes] = useState<string[]>([]);

  const handleCompanySelection = useCallback((companyCodes: string[]) => {
    setSelectedCompanyCodes(companyCodes);
    if (companyCodes.length > 0) {
      subscribeToCompanies(companyCodes);
    } else {
      unsubscribeAll();
    }
  }, [subscribeToCompanies, unsubscribeAll]);

  const handleClearSelection = useCallback(() => {
    setSelectedCompanyCodes([]);
    unsubscribeAll();
  }, [unsubscribeAll]);

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
                    Monitor real-time market data for up to 6 companies simultaneously
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  {marketStatus?.is_trading_hours && (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Activity className="w-3 h-3 mr-1" />
                      Market Open
                    </Badge>
                  )}
                  {!marketStatus?.is_trading_hours && !marketStatus?.is_weekend && (
                    <Badge variant="secondary">
                      Market Closed
                    </Badge>
                  )}
                  {marketStatus?.is_weekend && (
                    <Badge variant="outline">
                      Weekend
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Connection Status Alert */}
              {/* {error && (
                <Alert className="mb-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {error}
                  </AlertDescription>
                </Alert>
              )} */}

              {/* Company Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Select Companies (1-6)</h3>
                  {selectedCompanyCodes.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearSelection}
                    >
                      Clear Selection
                    </Button>
                  )}
                </div>
                
                <CompanySelector
                  availableCompanies={availableCompanies}
                  selectedCompanies={selectedCompanyCodes}
                  onSelectionChange={handleCompanySelection}
                  maxSelection={6}
                  loading={loading}
                />

                {/* Selection Summary */}
                {selectedCompanyCodes.length > 0 && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              </div>
            </CardContent>
          </Card>

          {/* Live Market Grid */}
          {/* {selectedCompanyCodes.length > 0 && (
            <LiveMarketGrid
              selectedCompanies={selectedCompanies}
              marketData={marketData}
              connectionStatus={connectionStatus}
              loading={loading}
            />
          )} */}

          {/* No Selection State */}
          {selectedCompanyCodes.length === 0 && (
            <Card className="w-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Companies Selected</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Select 1-6 companies from watchlist A above to start monitoring their real-time market data in an interactive grid layout.
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
