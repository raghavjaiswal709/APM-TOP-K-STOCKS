'use client'
import React, { useState } from 'react';
import { WatchlistSelector } from '@/app/components/controllers/WatchlistSelector';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
    companies,
    loading,
    error,
    exists,
    availableExchanges,
  } = useWatchlist();

  const handleCompanySelect = (companyCode: string | null, exchange?: string) => {
    setSelectedCompany(companyCode);
    setSelectedExchange(exchange);
  };

  const handleWatchlistChange = (watchlist: string) => {
    setSelectedWatchlist(watchlist);
    setSelectedCompany(null); // Reset company selection when watchlist changes
    setSelectedExchange(undefined);
  };

  const selectedCompanyData = selectedCompany 
    ? companies.find(c => c.company_code === selectedCompany)
    : null;

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Watchlist Management</h1>
        <p className="text-muted-foreground">
          Select and analyze companies from your watchlists
        </p>
      </div>

      {/* Watchlist Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Watchlist & Company</CardTitle>
        </CardHeader>
        <CardContent>
          <WatchlistSelector
            selectedWatchlist={selectedWatchlist}
            onWatchlistChange={handleWatchlistChange}
            onCompanySelect={handleCompanySelect}
          />
          
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Watchlist Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                <p className="text-sm font-medium text-muted-foreground">Exchanges</p>
                <p className="text-2xl font-bold">{availableExchanges.length}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {availableExchanges.map((exchange) => (
                  <Badge key={exchange} variant="outline" className="text-xs">
                    {exchange}
                  </Badge>
                ))}
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
              Selected Company Details
              <Badge variant="secondary">{selectedCompanyData.exchange}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Basic Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Company Code</p>
                    <p className="font-medium">{selectedCompanyData.company_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company Name</p>
                    <p className="font-medium">{selectedCompanyData.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Exchange</p>
                    <Badge variant="outline">{selectedCompanyData.exchange}</Badge>
                  </div>
                  {selectedCompanyData.tradingsymbol && (
                    <div>
                      <p className="text-sm text-muted-foreground">Trading Symbol</p>
                      <p className="font-medium">{selectedCompanyData.tradingsymbol}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Trading Metrics */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Trading Metrics
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Valid Days</p>
                    <p className="font-medium">{formatNumber(selectedCompanyData.total_valid_days)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Daily High-Low</p>
                    <p className="font-medium">{formatCurrency(selectedCompanyData.avg_daily_high_low)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Median Daily Volume</p>
                    <p className="font-medium">{formatNumber(selectedCompanyData.median_daily_volume)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Trading Ratio</p>
                    <p className="font-medium">{selectedCompanyData.avg_trading_ratio?.toFixed(4) || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Pattern Analysis */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Pattern Analysis
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">N1 Pattern Count</p>
                    <p className="font-medium">{formatNumber(selectedCompanyData.N1_Pattern_count)}</p>
                  </div>
                  {selectedCompanyData.avg_daily_high_low_range && (
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Daily High-Low Range</p>
                      <p className="font-medium">{formatCurrency(selectedCompanyData.avg_daily_high_low_range)}</p>
                    </div>
                  )}
                  {selectedCompanyData.avg_trading_capital && (
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Trading Capital</p>
                      <p className="font-medium">{formatCurrency(selectedCompanyData.avg_trading_capital)}</p>
                    </div>
                  )}
                  {selectedCompanyData.instrument_token && (
                    <div>
                      <p className="text-sm text-muted-foreground">Instrument Token</p>
                      <p className="font-medium text-xs">{selectedCompanyData.instrument_token}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Companies List */}
      <Card>
        <CardHeader>
          <CardTitle>Companies in Watchlist {selectedWatchlist}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {exists ? `${companies.length} companies found` : 'Watchlist not found'}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : !exists ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No watchlist data found</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No companies found in this watchlist</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Company Code
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Company Name
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Exchange
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Valid Days
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Avg High-Low
                    </th>
                    <th className="text-left py-2 px-4 font-medium text-sm text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr 
                      key={company.company_code} 
                      className={`border-b hover:bg-muted/50 cursor-pointer ${
                        selectedCompany === company.company_code ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleCompanySelect(company.company_code, company.exchange)}
                    >
                      <td className="py-3 px-4 font-medium">{company.company_code}</td>
                      <td className="py-3 px-4">{company.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {company.exchange}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{formatNumber(company.total_valid_days)}</td>
                      <td className="py-3 px-4">{formatCurrency(company.avg_daily_high_low)}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompanySelect(company.company_code, company.exchange);
                          }}
                          className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90"
                        >
                          {selectedCompany === company.company_code ? 'Selected' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
