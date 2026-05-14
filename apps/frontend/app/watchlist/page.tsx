'use client'
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { WatchlistSelector } from '@/app/components/controllers/WatchlistSelector';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePersistentState, useScrollRestoration } from '@/hooks/useStateRestoration';
import { usePageState, usePersistedWatchlistState } from '@/app/context/PageStateContext';
import { AppSidebar } from "@/app/components/app-sidebar";
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
import { ModeToggle } from "@/app/components/toggleButton";


interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
  // New watchlist_quant fields
  rank?: number;
  last_close?: number;
  median_daily_tv_10d?: number;
  atr_pct_10d?: number;
  iv_10d?: number;
  vol_rank_xs?: number;
  dist_from_high_20d?: number;
  vol_ratio_t1_vs_10d?: number;
  median_tradable_ratio_10d?: number;
  min_tradable_ratio_10d?: number;
  median_p25_window_tv_10d?: number;
  max_position_inr?: number;
  days_capital_data?: number;
  pe_ratio?: number;
}


export default function WatchlistPage() {
  const { updateWatchlistState } = usePageState();
  const persistedState = usePersistedWatchlistState();
  
  const [selectedCompany, setSelectedCompany] = usePersistentState<string | null>(
    'watchlist-selectedCompany',
    persistedState?.selectedCompany || null
  );
  const [selectedExchange, setSelectedExchange] = usePersistentState<string | undefined>(
    'watchlist-selectedExchange',
    persistedState?.selectedExchange || undefined
  );

  // Scroll restoration
  useScrollRestoration('watchlist-main-scroll');

  // Sync state to context
  useEffect(() => {
    updateWatchlistState({
      selectedCompany,
      selectedExchange,
      scrollPosition: window.scrollY,
    });
  }, [selectedCompany, selectedExchange, updateWatchlistState]);

  const {
    companies: rawCompanies,
    loading,
    error,
    exists,
    availableExchanges,
    availableMarkers,
    selectedDate,
    setSelectedDate,
    availableDates,
    totalCompanies,
    // setRefinedFilter, // REMOVED: not in watchlist_quant
    setShowAllCompanies,
  } = useWatchlist();


  // Memoize companies array to prevent SelectScrollable from resetting
  const companies = useMemo(() => {
    return rawCompanies || [];
  }, [rawCompanies]);


  // Memoize the company select handler to prevent unnecessary re-renders
  const handleCompanySelect = useCallback((companyCode: string | null, exchange?: string) => {
    console.log(`[WatchlistPage] Company selected: ${companyCode}, Exchange: ${exchange}`);
    setSelectedCompany(companyCode);
    setSelectedExchange(exchange);
  }, []);


  // Improved selectedCompanyData logic to handle duplicates across exchanges
  const selectedCompanyData = useMemo(() => {
    if (!selectedCompany) return null;
    
    // If we have both company code and exchange, find exact match
    if (selectedCompany && selectedExchange) {
      return companies.find(c => 
        c.company_code === selectedCompany && c.exchange === selectedExchange
      ) || null;
    }
    
    // If we only have company code, find the first match
    if (selectedCompany) {
      const matches = companies.filter(c => c.company_code === selectedCompany);
      return matches.length > 0 ? matches[0] : null;
    }
    
    return null;
  }, [selectedCompany, selectedExchange, companies]);


  const formatNumber = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-IN').format(value);
  };


  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  };


  const formatDecimal = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(4);
  };


  // Memoize the table click handler
  const handleTableRowClick = useCallback((companyCode: string, exchange: string) => {
    handleCompanySelect(companyCode, exchange);
  }, [handleCompanySelect]);


  // Memoize the button click handler
  const handleSelectButtonClick = useCallback((e: React.MouseEvent, companyCode: string, exchange: string) => {
    e.stopPropagation();
    handleCompanySelect(companyCode, exchange);
  }, [handleCompanySelect]);


  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Header Section */}
        <header className="flex h-16 shrink-0 items-center gap-2 w-full">
          <div className="flex items-center gap-2 px-4 w-full">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-between w-full">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">
                    Portfolio Management
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Watchlist Management</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>


        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="container mx-auto space-y-6">
            
            {/* Page Header */}
            <div className="flex flex-col space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Watchlist Management</h1>
              <p className="text-muted-foreground">
                Select and analyze companies from your daily watchlist
              </p>
            </div>


            {/* Watchlist Selector Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Select Date & Company</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      loading ? 'bg-yellow-500' : exists ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    <span className="text-sm text-muted-foreground">
                      {loading ? 'Loading...' : exists ? 'Connected' : 'No Data'}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WatchlistSelector
                  onCompanySelect={handleCompanySelect}
                  showDateSelector={true}
                  // Pass external state to sync with page's useWatchlist hook
                  externalSelectedDate={selectedDate}
                  externalSetSelectedDate={setSelectedDate}
                  externalAvailableDates={availableDates}
                  externalCompanies={companies}
                  externalLoading={loading}
                  externalError={error}
                  externalExists={exists}
                  externalAvailableExchanges={availableExchanges}
                  externalAvailableMarkers={availableMarkers}
                  externalTotalCompanies={totalCompanies}
                  // externalSetRefinedFilter removed — not in watchlist_quant
                  // externalSetRefinedFilter={setRefinedFilter}
                  externalSetShowAllCompanies={setShowAllCompanies}
                />
                
                {error && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-destructive text-sm font-medium">Error: {error}</p>
                  </div>
                )}
              </CardContent>
            </Card>


            {/* Watchlist Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Selected Date</p>
                      <p className="text-2xl font-bold">
                        {selectedDate ? new Date(selectedDate).toLocaleDateString('en-IN', { 
                          day: '2-digit', 
                          month: 'short' 
                        }) : 'Today'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {selectedDate ? new Date(selectedDate).getDate() : new Date().getDate()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Companies</p>
                      {loading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <p className="text-2xl font-bold">{companies.length}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Available Exchanges</p>
                      <p className="text-2xl font-bold">{availableExchanges.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>


              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <p className={`text-lg font-semibold ${
                        loading ? 'text-yellow-500' : exists ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {loading ? 'Loading' : exists ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {availableExchanges.slice(0, 3).map((exchange) => (
                        <Badge key={exchange} variant="outline" className="text-xs">
                          {exchange}
                        </Badge>
                      ))}
                      {availableExchanges.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{availableExchanges.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>


            {/* Selected Company Details */}
            {selectedCompanyData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>Company Details</span>
                    <Badge variant="secondary">{selectedCompanyData.exchange}</Badge>
                    {selectedCompanyData.marker && (
                      <Badge variant="outline">{selectedCompanyData.marker}</Badge>
                    )}
                    <Badge variant="outline" className="ml-auto">
                      {selectedCompanyData.company_code}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-b pb-2">
                        Basic Information
                      </h4>
                      <div className="grid gap-3">
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Company Code</p>
                          <p className="font-bold text-lg">{selectedCompanyData.company_code}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Company Name</p>
                          <p className="font-medium">{selectedCompanyData.name}</p>
                        </div>
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Exchange</p>
                          <Badge variant="outline" className="mt-1">{selectedCompanyData.exchange}</Badge>
                        </div>
                        {selectedCompanyData.marker && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Marker</p>
                            <Badge variant="secondary" className="mt-1">{selectedCompanyData.marker}</Badge>
                          </div>
                        )}
                        {selectedCompanyData.last_close != null && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Last Close Price</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">
                              {formatCurrency(selectedCompanyData.last_close)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.rank != null && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Watchlist Rank</p>
                            <p className="font-bold text-lg">#{selectedCompanyData.rank}</p>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Trading Metrics */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-b pb-2">
                        Trading Metrics
                      </h4>
                      <div className="grid gap-3">
                        {selectedCompanyData.atr_pct_10d != null && (
                          <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-600 dark:text-green-400 mb-1">ATR % (10d)</p>
                            <p className="font-bold text-lg text-green-700 dark:text-green-300">
                              {(selectedCompanyData.atr_pct_10d * 100).toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.median_daily_tv_10d != null && (
                          <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Median Daily TV (10d)</p>
                            <p className="font-bold text-lg text-purple-700 dark:text-purple-300">
                              {formatCurrency(selectedCompanyData.median_daily_tv_10d)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.vol_rank_xs != null && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Volume Rank XS</p>
                            <p className="font-bold text-xl text-blue-700 dark:text-blue-300">
                              {selectedCompanyData.vol_rank_xs.toFixed(4)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.vol_ratio_t1_vs_10d != null && (
                          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Vol Ratio T1 vs 10d</p>
                            <p className="font-bold text-lg text-orange-700 dark:text-orange-300">
                              {selectedCompanyData.vol_ratio_t1_vs_10d.toFixed(4)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.dist_from_high_20d != null && (
                          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Dist from 20d High</p>
                            <p className="font-bold text-lg text-yellow-700 dark:text-yellow-300">
                              {(selectedCompanyData.dist_from_high_20d * 100).toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.iv_10d != null && (
                          <div className="bg-teal-50 dark:bg-teal-950/20 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                            <p className="text-xs text-teal-600 dark:text-teal-400 mb-1">IV (10d)</p>
                            <p className="font-bold text-lg text-teal-700 dark:text-teal-300">
                              {selectedCompanyData.iv_10d.toFixed(4)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>


                    {/* Financial Analysis */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-b pb-2">
                        Financial Analysis
                      </h4>
                      <div className="grid gap-3">
                        {selectedCompanyData.pe_ratio != null && (
                          <div className="bg-cyan-50 dark:bg-cyan-950/20 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800">
                            <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">P/E Ratio</p>
                            <p className="font-bold text-xl text-cyan-700 dark:text-cyan-300">
                              {selectedCompanyData.pe_ratio.toFixed(2)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.max_position_inr != null && (
                          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Max Position (INR)</p>
                            <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300">
                              {formatCurrency(selectedCompanyData.max_position_inr)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.median_tradable_ratio_10d != null && (
                          <div className="bg-pink-50 dark:bg-pink-950/20 p-3 rounded-lg border border-pink-200 dark:border-pink-800">
                            <p className="text-xs text-pink-600 dark:text-pink-400 mb-1">Median Tradable Ratio (10d)</p>
                            <p className="font-bold text-lg text-pink-700 dark:text-pink-300">
                              {selectedCompanyData.median_tradable_ratio_10d.toFixed(4)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.min_tradable_ratio_10d != null && (
                          <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded-lg border border-rose-200 dark:border-rose-800">
                            <p className="text-xs text-rose-600 dark:text-rose-400 mb-1">Min Tradable Ratio (10d)</p>
                            <p className="font-bold text-lg text-rose-700 dark:text-rose-300">
                              {selectedCompanyData.min_tradable_ratio_10d.toFixed(4)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.days_capital_data != null && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Days Capital Data</p>
                            <p className="font-mono text-sm">{selectedCompanyData.days_capital_data}</p>
                          </div>
                        )}
                        {selectedCompanyData.company_id != null && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Company ID</p>
                            <p className="font-mono text-sm">{selectedCompanyData.company_id}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Companies Data Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Companies in Daily Watchlist</span>
                  <div className="flex items-center gap-2">
                    {loading && <Skeleton className="h-4 w-20" />}
                    {!loading && (
                      <Badge variant="secondary">
                        {exists ? `${companies.length} companies` : 'No data'}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {exists 
                    ? `Showing companies for ${selectedDate || 'today'} - Click on any company to view detailed information` 
                    : 'Watchlist data not found or unavailable'}
                </p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-3 border rounded-lg">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    ))}
                  </div>
                ) : !exists ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                      <span className="text-muted-foreground">📊</span>
                    </div>
                    <h3 className="font-semibold mb-2">No Watchlist Data</h3>
                    <p className="text-muted-foreground mb-4">
                      The selected date doesn't have any watchlist data.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try selecting a different date from the available dates.
                    </p>
                  </div>
                ) : companies.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                      <span className="text-muted-foreground">🏢</span>
                    </div>
                    <h3 className="font-semibold mb-2">No Companies Found</h3>
                    <p className="text-muted-foreground">
                      This watchlist exists but contains no companies.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2">
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Rank
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Company Code
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Company Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Exchange
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Last Close
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-sm text-muted-foreground">
                            ATR % (10d)
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Max Position
                          </th>
                          <th className="text-right py-3 px-4 font-semibold text-sm text-muted-foreground">
                            P/E Ratio
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map((company, index) => {
                          const isSelected = selectedCompany === company.company_code && 
                                           (selectedExchange === company.exchange || !selectedExchange);
                          
                          return (
                            <tr 
                              key={`${company.company_code}-${company.exchange}`}
                              className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                                isSelected ? 'bg-muted shadow-sm' : ''
                              } ${index % 2 === 0 ? 'bg-muted/20' : ''}`}
                              onClick={() => handleTableRowClick(company.company_code, company.exchange)}
                            >
                              <td className="py-3 px-4 text-center">
                                {company.rank != null ? (
                                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-sm font-mono">
                                    #{company.rank}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono font-semibold text-primary">
                                  {company.company_code}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-medium">{company.name}</span>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs">
                                  {company.exchange}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {company.last_close != null ? formatCurrency(company.last_close) : '—'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {company.atr_pct_10d != null ? (
                                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm">
                                    {(company.atr_pct_10d * 100).toFixed(2)}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                                  {company.max_position_inr != null ? formatCurrency(company.max_position_inr) : '—'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {company.pe_ratio != null ? (
                                  <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded text-sm">
                                    {company.pe_ratio.toFixed(2)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={(e) => handleSelectButtonClick(e, company.company_code, company.exchange)}
                                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                                    isSelected
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
