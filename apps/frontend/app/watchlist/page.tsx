'use client'
import React, { useState, useMemo, useCallback } from 'react';
import { WatchlistSelector } from '@/app/components/controllers/WatchlistSelector';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  company_code: string;
  name: string;
  exchange: string;
  total_valid_days?: number;
  avg_daily_high_low?: number;
  median_daily_volume?: number;
  avg_trading_ratio?: number;
  N1_Pattern_count?: number;
  avg_daily_high_low_range?: number;
  avg_daily_volume?: number;
  avg_trading_capital?: number;
  instrument_token?: string;
  tradingsymbol?: string;
}

export default function WatchlistPage() {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string | undefined>(undefined);
  const [selectedWatchlist, setSelectedWatchlist] = useState<string>('A');

  const {
    companies: rawCompanies,
    loading,
    error,
    exists,
    availableExchanges,
  } = useWatchlist({ externalWatchlist: selectedWatchlist });

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

  const handleWatchlistChange = useCallback((watchlist: string) => {
    console.log(`[WatchlistPage] Watchlist changed to: ${watchlist}`);
    setSelectedWatchlist(watchlist);
    setSelectedCompany(null); // Reset company selection when watchlist changes
    setSelectedExchange(undefined);
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
    // (this handles cases where SelectScrollable only passes company code)
    if (selectedCompany) {
      const matches = companies.filter(c => c.company_code === selectedCompany);
      
      // If multiple matches across exchanges, prefer the first one
      // or you could add logic to prefer a specific exchange
      return matches.length > 0 ? matches[0] : null;
    }
    
    return null;
  }, [selectedCompany, selectedExchange, companies]);

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-IN').format(value);
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatDecimal = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
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
                Select and analyze companies from your watchlists
              </p>
            </div>

            {/* Watchlist Selector Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Select Watchlist & Company</span>
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
                  selectedWatchlist={selectedWatchlist}
                  onWatchlistChange={handleWatchlistChange}
                  onCompanySelect={handleCompanySelect}
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
                      <p className="text-sm font-medium text-muted-foreground">Selected Watchlist</p>
                      <p className="text-2xl font-bold">Watchlist {selectedWatchlist}</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {selectedWatchlist}
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
                        {selectedCompanyData.tradingsymbol && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Trading Symbol</p>
                            <p className="font-medium font-mono">{selectedCompanyData.tradingsymbol}</p>
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Total Valid Days</p>
                          <p className="font-bold text-xl text-blue-700 dark:text-blue-300">
                            {formatNumber(selectedCompanyData.total_valid_days)}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-xs text-green-600 dark:text-green-400 mb-1">Avg Daily High-Low</p>
                          <p className="font-bold text-lg text-green-700 dark:text-green-300">
                            {formatCurrency(selectedCompanyData.avg_daily_high_low)}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                          <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Median Daily Volume</p>
                          <p className="font-bold text-lg text-purple-700 dark:text-purple-300">
                            {formatNumber(selectedCompanyData.median_daily_volume)}
                          </p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                          <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Avg Trading Ratio</p>
                          <p className="font-bold text-lg text-orange-700 dark:text-orange-300">
                            {formatDecimal(selectedCompanyData.avg_trading_ratio)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pattern Analysis */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide border-b pb-2">
                        Pattern Analysis
                      </h4>
                      <div className="grid gap-3">
                        <div className="bg-cyan-50 dark:bg-cyan-950/20 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800">
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">N1 Pattern Count</p>
                          <p className="font-bold text-xl text-cyan-700 dark:text-cyan-300">
                            {formatNumber(selectedCompanyData.N1_Pattern_count)}
                          </p>
                        </div>
                        {selectedCompanyData.avg_daily_high_low_range && (
                          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Avg High-Low Range</p>
                            <p className="font-bold text-lg text-indigo-700 dark:text-indigo-300">
                              {parseFloat(selectedCompanyData.avg_daily_high_low_range).toFixed(2) + ' %'}

                            </p>
                          </div>
                        )}
                        {selectedCompanyData.avg_trading_capital && (
                          <div className="bg-pink-50 dark:bg-pink-950/20 p-3 rounded-lg border border-pink-200 dark:border-pink-800">
                            <p className="text-xs text-pink-600 dark:text-pink-400 mb-1">Avg Trading Capital</p>
                            <p className="font-bold text-lg text-pink-700 dark:text-pink-300">
                              {formatCurrency(selectedCompanyData.avg_trading_capital)}
                            </p>
                          </div>
                        )}
                        {selectedCompanyData.instrument_token && (
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <p className="text-xs text-muted-foreground mb-1">Instrument Token</p>
                            <p className="font-mono text-sm break-all">{selectedCompanyData.instrument_token}</p>
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
                  <span>Companies in Watchlist {selectedWatchlist}</span>
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
                  {exists ? 'Click on any company to view detailed information' : 'Watchlist data not found or unavailable'}
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
                      The selected watchlist doesn't exist or contains no data.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try selecting a different watchlist or check your data source.
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
                            Company Code
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Company Name
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Exchange
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Valid Days
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Avg High-Low
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-sm text-muted-foreground">
                            Pattern Count
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
                              <td className="py-3 px-4 text-center">
                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm">
                                  {formatNumber(company.total_valid_days)}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  {formatCurrency(company.avg_daily_high_low)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded text-sm">
                                  {formatNumber(company.N1_Pattern_count)}
                                </span>
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
