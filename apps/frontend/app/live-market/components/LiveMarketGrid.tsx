'use client';
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GridChart from './GridChart';
import { TrendingUp, TrendingDown, Activity, Wifi, WifiOff } from 'lucide-react';
import { ViewInDashboardButton } from "../../components/ViewInDashboardButton"; 

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}

interface MarketData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: number;
}

interface LiveMarketGridProps {
  selectedCompanies: Company[];
  marketData: Record<string, MarketData>;
  connectionStatus: string;
  loading?: boolean;
}

const LiveMarketGrid: React.FC<LiveMarketGridProps> = ({
  selectedCompanies,
  marketData,
  connectionStatus,
  loading = false
}) => {
  const gridLayout = useMemo(() => {
    const count = selectedCompanies.length;
    
    switch (count) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 lg:grid-cols-2';
      case 3:
        return 'grid-cols-1 lg:grid-cols-3';
      case 4:
        return 'grid-cols-1 md:grid-cols-2';
      case 5:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 6:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-1';
    }
  }, [selectedCompanies.length]);

  const formatPrice = (price?: number) => {
    return price ? `₹${price.toFixed(2)}` : '₹0.00';
  };

  const formatChange = (change?: number, percent?: number) => {
    if (change === undefined || percent === undefined) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  };

  const getChangeColor = (change?: number) => {
    if (change === undefined) return 'text-muted-foreground';
    return change >= 0 ? 'text-[#2ca499]' : 'text-[#ee5351]';
  };

  const getChangeIcon = (change?: number) => {
    if (change === undefined) return <Activity className="w-4 h-4" />;
    return change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Grid Status */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Market Grid</h2>
        <div className="flex items-center gap-2 text-sm">
          {connectionStatus === 'Connected' ? (
            <>
              <Wifi className="w-4 h-4 text-[#2ca499]" />
              <span className="text-[#2ca499]">Live Data</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-[#ee5351]" />
              <span className="text-[#ee5351]">Disconnected</span>
            </>
          )}
        </div>
      </div>

      {/* Companies Grid */}
      <div className={`grid ${gridLayout} gap-4`}>
        {selectedCompanies.map((company) => {
          const data = marketData[company.symbol];
          const hasData = !!data;
          
          return (
            <Card key={company.company_code} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{company.company_code}</CardTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {company.name}
                    </p>
                  </div>
                  <Badge variant={hasData ? "default" : "secondary"} className="text-xs">
                    {company.exchange}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Price Information */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {formatPrice(data?.ltp)}
                    </span>
                    <div className={`flex items-center gap-1 text-sm ${getChangeColor(data?.change)}`}>
                      {getChangeIcon(data?.change)}
                      <span className=" text-xl font-bold">
                        {formatChange(data?.change, data?.changePercent)}
                      </span>
                    </div>
                  </div>

                   <div className="flex justify-end">
    <ViewInDashboardButton
      companyCode={company.company_code}
      exchange={company.exchange}
      watchlist="A"
      interval="15m"
      variant="card"
      size="sm"
      className="ml-auto"
    />
  </div>
                  
                  {/* OHLC Data */}
                  {hasData && (
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="text-center">
                        <div className="text-muted-foreground">Open</div>
                        <div className="font-medium">{formatPrice(data.open)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">High</div>
                        <div className="font-medium text-[#2ca499]">{formatPrice(data.high)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Low</div>
                        <div className="font-medium text-[#ee5351]">{formatPrice(data.low)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground">Volume</div>
                        <div className="font-medium">{data.volume?.toLocaleString() || '0'}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart */}
                <div className="h-96 bg-muted/20 rounded border">
                  {hasData ? (
                    <GridChart
                      symbol={company.symbol}
                      data={data}
                      company={company}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {loading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          <span className="text-sm">Loading data...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <WifiOff className="w-8 h-8" />
                          <span className="text-sm">No data</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Last Updated */}
                {hasData && (
                  <div className="text-xs text-muted-foreground text-center">
                    Last updated: {new Date(data.timestamp * 1000).toLocaleTimeString()}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default LiveMarketGrid;
