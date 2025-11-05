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
import { FyersAuthStatus } from '../components/FyersAuthStatus';
import { useLiveMarket } from '../../hooks/useLiveMarket';
import { 
  Info, 
  Activity, 
  Users, 
  TrendingUp, 
  Shield, 
  AlertCircle,
  CheckCircle,
  XCircle 
} from 'lucide-react';

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
  symbol?: string;
}

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchAuthStatus = useCallback(async () => {
    try {
      setAuthLoading(true);
      const response = await fetch('/api/auth/fyers/status');
      const data = await response.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      setAuthStatus(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
    const interval = setInterval(fetchAuthStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchAuthStatus]);

  const handleCompaniesSelect = useCallback((companies: Company[]) => {
    console.log('🔍 Companies selected in LiveMarketPage:', companies);
    
    // Always update selected companies first
    setSelectedCompanies(companies);

    // Only proceed with subscription if we have valid auth AND companies
    if (companies.length === 0) {
      console.log('📡 No companies selected, unsubscribing from all');
      unsubscribeAll();
      return;
    }

    if (!authStatus?.authenticated || !authStatus?.token_valid) {
      console.warn('⚠️ Cannot subscribe: Fyers authentication required');
      return;
    }

    console.log('📡 Subscribing to companies:', companies);
    subscribeToCompanies(companies);
  }, [subscribeToCompanies, unsubscribeAll, authStatus?.authenticated, authStatus?.token_valid]);

  const handleDateChange = useCallback((date: string) => {
    console.log('📅 Date changed to:', date);
    console.log('📅 Clearing all selections and unsubscribing');
    
    // First unsubscribe from all current subscriptions
    unsubscribeAll();
    
    // Then clear the selected companies
    setSelectedCompanies([]);
    
    // Finally set the new date
    setSelectedDate(date);
  }, [unsubscribeAll]);

  const handleClearSelection = useCallback(() => {
    console.log('📡 Clearing all selections');
    setSelectedCompanies([]);
    unsubscribeAll();
  }, [unsubscribeAll]);

  const gridSelectedCompanies = React.useMemo(() => {
    return selectedCompanies.map(company => ({
      ...company,
      marker: company.marker || 'EQ',
      symbol: company.symbol || `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`
    }));
  }, [selectedCompanies]);

  useEffect(() => {
    console.log('🔍 LiveMarketPage State Update:', {
      selectedCompanies: selectedCompanies.length,
      liveMarketSelectedCompanies: liveMarketSelectedCompanies.length,
      marketDataKeys: Object.keys(marketData),
      isConnected,
      loading,
      error,
      authStatus: authStatus?.authenticated,
      selectedDate
    });
  }, [selectedCompanies, liveMarketSelectedCompanies, marketData, isConnected, loading, error, authStatus, selectedDate]);

  const getAuthStatusDisplay = () => {
    if (authLoading) {
      return { icon: Activity, color: 'text-blue-500', text: 'Checking...' };
    }
    if (!authStatus) {
      return { icon: XCircle, color: 'text-red-500', text: 'Unknown' };
    }
    if (authStatus.authenticated && authStatus.token_valid) {
      return { icon: CheckCircle, color: 'text-green-500', text: 'Active' };
    } else if (authStatus.authenticated) {
      return { icon: AlertCircle, color: 'text-yellow-500', text: 'Expired' };
    } else {
      return { icon: XCircle, color: 'text-red-500', text: 'Required' };
    }
  };

  const authDisplay = getAuthStatusDisplay();
  const AuthIcon = authDisplay.icon;

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
                    Real-Time Market Data
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
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Live Market Data Grid
                  </CardTitle>
                  {selectedDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Showing data for {new Date(selectedDate).toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-6">
                  {/* Auth Status */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <AuthIcon className={`w-4 h-4 ${authDisplay.color}`} />
                    <span className="text-sm font-medium">
                      Auth: {authDisplay.text}
                    </span>
                  </div>

                  {/* Connection Status */}
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">
                      {connectionStatus}
                    </span>
                  </div>

                  {/* Market Status */}
                  {marketStatus?.trading_active && (
                    <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      <Activity className="w-3 h-3 mr-1" />
                      Market Open
                    </Badge>
                  )}
                  {!marketStatus?.trading_active && !marketStatus?.is_market_day && (
                    <Badge variant="secondary">
                      Market Closed
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="flex justify-between items-center">
                    {/* Selection Stats */}
                    {selectedCompanies.length > 0 && (
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{selectedCompanies.length} companies selected</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="w-4 h-4" />
                            <span>{Object.keys(marketData).length} receiving data</span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleClearSelection}
                          disabled={loading}
                        >
                          {loading ? 'Clearing...' : 'Clear Selection'}
                        </Button>
                      </div>
                    )}
                  </div>

                  <MultiSelectWatchlistSelector
                    onCompaniesSelect={handleCompaniesSelect}
                    onDateChange={handleDateChange}
                    maxSelection={6}
                    selectedCompanies={selectedCompanies}
                    showExchangeFilter={true}
                    showMarkerFilter={true}
                    showDateSelector={true}
                    disabled={!authStatus?.authenticated || !authStatus?.token_valid}
                  />

                  {/* Auth Warning */}
                  {(!authStatus?.authenticated || !authStatus?.token_valid) && (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-3 py-2 rounded-md text-sm">
                      ⚠️ Authentication required to select companies and view live data
                    </div>
                  )}

                  {/* Loading Indicator */}
                  {loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Subscribing to market data...</span>
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm">
                      ❌ {error}
                    </div>
                  )}
                </div>

                {/* Sidebar - Auth Status */}
                <div className="lg:col-span-1">
                  <FyersAuthStatus />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Market Grid - When Companies Selected and Authenticated */}
          {selectedCompanies.length > 0 && authStatus?.authenticated && authStatus?.token_valid && (
            <LiveMarketGrid
              selectedCompanies={gridSelectedCompanies}
              marketData={marketData}
              connectionStatus={connectionStatus}
              loading={loading}
            />
          )}

          {/* Auth Required Message */}
          {selectedCompanies.length > 0 && (!authStatus?.authenticated || !authStatus?.token_valid) && (
            <Card className="w-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-yellow-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  You have selected {selectedCompanies.length} companies, but Fyers authentication is required to view live market data.
                </p>
                <div className="flex gap-3">
                  <FyersAuthStatus />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {selectedCompanies.length === 0 && (
            <Card className="w-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Companies Selected</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Select a date and choose 1-6 companies from your watchlist above to start monitoring their real-time market data in an interactive grid layout.
                  {!authStatus?.authenticated && " Note: Fyers authentication is required for live data."}
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
