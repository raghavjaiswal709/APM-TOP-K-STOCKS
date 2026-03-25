'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { CompanyList } from "@/app/components/CompanyList";
import { useWatchlist } from "@/hooks/useWatchlist";

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
  symbol?: string;
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

interface LiveMarketSidebarProps {
  subscribedCompanies: Company[];
  marketData: Record<string, MarketData>;
  onSubscribe: (codes: string[]) => void;
  onClear: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const LiveMarketSidebar: React.FC<LiveMarketSidebarProps> = ({
  subscribedCompanies,
  marketData,
  onSubscribe,
  onClear,
  loading = false,
  disabled = false,
}) => {
  // Hydration guard: render placeholder on server, real content after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Own watchlist for the company picker — same data source as market-data page
  const {
    companies,
    loading: watchlistLoading,
    availableDates,
    selectedDate,
    setSelectedDate,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    showAllCompanies,
    setShowAllCompanies,
  } = useWatchlist();

  const subscribedCodes = useMemo(
    () => new Set(subscribedCompanies.map(c => c.company_code)),
    [subscribedCompanies]
  );

  // Stable array of subscribed codes — passed as initialSelectedCodes to pre-check them
  const subscribedCodeArray = useMemo(
    () => subscribedCompanies.map(c => c.company_code),
    // Only recompute when the SET of codes changes (not reference equality)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribedCompanies.map(c => c.company_code).join(',')]
  );

  // Called from CompanyList's multi-select action panel (subscribeMode='subscribe')
  const handleMultiAction = React.useCallback(
    (action: 'multi-chart' | 'new-tabs' | 'historical' | 'subscribe', codes: string[]) => {
      if (action === 'subscribe' && !disabled) {
        onSubscribe(codes);
      }
    },
    [onSubscribe, disabled]
  );

  /* ── Helpers ── */
  const formatPrice = (price?: number) => (price !== undefined ? `₹${price.toFixed(2)}` : '--');

  const formatChangePercent = (change?: number, percent?: number) => {
    if (change === undefined || percent === undefined) return '--';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  /* ── Render ── */
  if (!mounted) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground text-xs gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <Tabs defaultValue="companies" className="flex flex-col h-full">
      <TabsList className="rounded-none h-9 w-full bg-muted/30 shrink-0 border-b grid grid-cols-2">
        <TabsTrigger value="companies" className="text-xs h-7 data-[state=active]:bg-background">
          Companies
        </TabsTrigger>
        <TabsTrigger value="details" className="text-xs h-7 data-[state=active]:bg-background flex items-center gap-1">
          Details
          {subscribedCompanies.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1 min-w-[16px]">
              {subscribedCompanies.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Companies Tab: full CompanyList with all filters ── */}
      <TabsContent value="companies" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
        {disabled && (
          <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs border-b shrink-0 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>Fyers authentication required to subscribe</span>
          </div>
        )}
        {/* Subscribed companies quick strip */}
        {subscribedCompanies.length > 0 && (
          <div className="px-2 py-1.5 border-b bg-emerald-500/5 flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
              Live ({subscribedCompanies.length}):
            </span>
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {subscribedCompanies.map(c => (
                <span
                  key={c.company_code}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium"
                >
                  {c.company_code}
                </span>
              ))}
            </div>
            <button
              onClick={onClear}
              className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
              title="Unsubscribe all"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Full CompanyList — subscribeMode always has multi-select active */}
        <div className="flex-1 overflow-hidden">
          <CompanyList
            companies={companies || []}
            selectedCompanyCode={null}
            onSelect={() => { /* no single-select in live-market */ }}
            loading={watchlistLoading || loading}
            selectedWatchlistDate={selectedDate}
            availableDates={availableDates}
            onWatchlistDateChange={setSelectedDate}
            availableExchanges={availableExchanges}
            availableMarkers={availableMarkers}
            totalCompanies={totalCompanies}
            showAllCompanies={showAllCompanies}
            onShowAllCompaniesChange={setShowAllCompanies}
            multiSelectMode={true}
            subscribeMode={true}
            onMultiAction={handleMultiAction}
            initialSelectedCodes={subscribedCodeArray}
          />
        </div>
      </TabsContent>

      {/* ── Details Tab: OHLC table for subscribed companies ── */}
      <TabsContent value="details" className="flex-1 flex flex-col overflow-hidden mt-0 data-[state=inactive]:hidden">
        <ScrollArea className="flex-1">
          {subscribedCompanies.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground leading-relaxed">
              No companies subscribed yet.
              <br />
              Go to the Companies tab to select &amp; subscribe.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border/50">
              {subscribedCompanies.map((company) => {
                const sym =
                  company.symbol ||
                  `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
                const data = marketData[sym];
                const isPositive = (data?.change ?? 0) >= 0;

                return (
                  <div key={company.company_code} className="p-2.5">
                    {/* Header row: symbol + LTP */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">{company.company_code}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                            {company.exchange}
                          </span>
                          {/* Live indicator */}
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {company.name}
                        </div>
                      </div>
                      {data?.ltp !== undefined ? (
                        <div className="text-right shrink-0 ml-2">
                          <div className="font-bold text-sm">₹{data.ltp.toFixed(2)}</div>
                          <div
                            className={cn(
                              'text-[10px] font-medium',
                              isPositive ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {formatChangePercent(data.change, data.changePercent)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground shrink-0">—</div>
                      )}
                    </div>

                    {/* OHLC grid */}
                    {data ? (
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <div>
                          <div className="text-muted-foreground">Open</div>
                          <div className="font-medium">{formatPrice(data.open)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">High</div>
                          <div className="font-medium text-emerald-500">{formatPrice(data.high)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Low</div>
                          <div className="font-medium text-red-500">{formatPrice(data.low)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Vol</div>
                          <div className="font-medium">
                            {data.volume !== undefined
                              ? data.volume >= 1_000_000
                                ? `${(data.volume / 1_000_000).toFixed(1)}M`
                                : `${(data.volume / 1_000).toFixed(0)}K`
                              : '--'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">Waiting for data…</div>
                    )}

                    {/* Last update time */}
                    {data?.timestamp && (
                      <div className="text-[9px] text-muted-foreground/60 mt-1 text-right">
                        {new Date(data.timestamp * 1000).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Unsubscribe All button */}
        {subscribedCompanies.length > 0 && (
          <div className="p-2 border-t shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs w-full"
              onClick={onClear}
            >
              <X className="h-3 w-3 mr-1.5" />
              Unsubscribe All
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default LiveMarketSidebar;
