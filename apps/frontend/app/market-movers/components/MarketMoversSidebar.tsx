'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Search, CheckSquare, Square, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { useWatchlist } from '@/hooks/useWatchlist';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useFlipAnimation, useSurgeWatchlist } from '@/hooks/useSurge';
import { formatPrice, formatSignedPct, parseSearchTerms } from '@/lib/surge/filters';
import {
  AddSymbolButton,
  AdditionsHeader,
  PinButton,
  RankBadge,
  RemoveButton,
  SurgeStatusLine,
  SurgeToggleButton,
  TargetBadge,
  WatchlistFilterChips,
  WatchlistFilterPopover,
} from '@/app/components/surge/SurgeControls';
import { SurgeNoMatches, SurgeSections } from '@/app/components/surge/SurgeSections';

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  marker?: string;
  // NEW (Surge watchlist — see hooks/useWatchlist.ts)
  rank?: number;
  target_move_pct?: number | null;
  watchlist_source?: 'surge' | 'manual';
}

interface MarketMoversSidebarProps {
  /** Set of currently checked company codes — drives the tile grid */
  selectedCodes: Set<string>;
  /** Called immediately on each individual checkbox toggle */
  onSelectionChange: (codes: Set<string>) => void;
  /** Called when the refined companies list changes (to re-subscribe) */
  onCompaniesChange?: (companies: Company[]) => void;
}

const MarketMoversSidebar: React.FC<MarketMoversSidebarProps> = ({
  selectedCodes,
  onSelectionChange,
  onCompaniesChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Watchlist state — no refined filter (watchlist_quant has no refined column)
  // Use a sidebar-specific cacheKey so that pages that load all 2000+ companies
  // (e.g. cluster-overlay with showAllCompanies=true) never contaminate this cache.
  const {
    companies,
    loading,
    availableDates,
    selectedDate,
    setSelectedDate,
    // refinedFilter, // REMOVED: watchlist_quant has no refined column
    // setRefinedFilter, // REMOVED: watchlist_quant has no refined column
    showAllCompanies,
    setShowAllCompanies,
    availableExchanges,
  } = useWatchlist({ cacheKey: 'market-movers-sidebar-companies' });

  // Hydration guard
  useEffect(() => setMounted(true), []);

  // Notify parent when companies list changes
  const prevCodesRef = useRef<string>('');
  useEffect(() => {
    const codes = companies.map(c => c.company_code).sort().join(',');
    if (codes !== prevCodesRef.current) {
      prevCodesRef.current = codes;
      onCompaniesChange?.(companies);
    }
  }, [companies, onCompaniesChange]);

  // ── Surge watchlist view (pins, surging today, filters, target floor, additions) ──
  const searchTerms = useMemo(() => parseSearchTerms(search), [search]);
  const surgeRowCodes = useMemo(
    () => (companies.length <= 400 ? companies.map(c => c.company_code) : []),
    [companies]
  );
  const surge = useSurgeWatchlist(searchTerms, { date: showAllCompanies ? null : selectedDate, rowCodes: surgeRowCodes });
  const listRef = useRef<HTMLDivElement>(null);

  // Filtered list by search — comma/space separated, any one matching code or name
  // (as in the dashboard), so "RELIANCE, TCS" finds both.
  const filteredCompanies = useMemo(() => {
    if (!searchTerms.length) return companies;
    return companies.filter(c => {
      const code = c.company_code.toUpperCase();
      const name = c.name.toUpperCase();
      return searchTerms.some(term => code.includes(term) || name.includes(term));
    });
  }, [companies, searchTerms]);
  // OLD: single-term search
  // const filteredCompanies = useMemo(() => {
  //   if (!search.trim()) return companies;
  //   const q = search.toLowerCase();
  //   return companies.filter(
  //     c =>
  //       c.company_code.toLowerCase().includes(q) ||
  //       c.name.toLowerCase().includes(q)
  //   );
  // }, [companies, search]);

  // The list's own rows minus what the Pinned / Surging blocks already show,
  // with the surge filters and target floor applied; screened, then additions.
  const restCompanies = useMemo(
    () =>
      filteredCompanies.filter(c => {
        const code = c.company_code.toUpperCase();
        return !surge.surgingSet.has(code) && !surge.pinnedSet.has(code) && surge.passesFilters(code);
      }),
    [filteredCompanies, surge.surgingSet, surge.pinnedSet, surge.passesFilters]
  );
  const restScreened = useMemo(() => restCompanies.filter(c => c.watchlist_source !== 'manual'), [restCompanies]);
  const restManual = useMemo(() => restCompanies.filter(c => c.watchlist_source === 'manual'), [restCompanies]);
  const restRows = useMemo(() => [...restScreened, ...restManual], [restScreened, restManual]);

  // Everything on screen, for Select / Deselect all and the counts.
  const visibleCodes = useMemo(
    () => [...surge.pinnedCodes, ...surge.surgeOrder, ...restRows.map(c => c.company_code)],
    [surge.pinnedCodes, surge.surgeOrder, restRows]
  );

  useFlipAnimation(
    listRef,
    [...surge.pinnedCodes, '|', ...surge.surgeOrder, '|', ...restScreened.map(c => c.company_code), '|', ...restManual.map(c => c.company_code)].join(','),
    true
  );

  // Toggle a single company
  const handleToggle = useCallback(
    (code: string) => {
      const next = new Set(selectedCodes);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      onSelectionChange(next);
    },
    [selectedCodes, onSelectionChange]
  );

  // Select all visible companies (pinned + surging + the rest)
  const handleSelectAll = useCallback(() => {
    const next = new Set(selectedCodes);
    visibleCodes.forEach(code => next.add(code));
    onSelectionChange(next);
  }, [visibleCodes, selectedCodes, onSelectionChange]);

  // Deselect all visible companies
  const handleDeselectAll = useCallback(() => {
    const next = new Set(selectedCodes);
    visibleCodes.forEach(code => next.delete(code));
    onSelectionChange(next);
  }, [visibleCodes, selectedCodes, onSelectionChange]);

  const allVisibleSelected =
    visibleCodes.length > 0 &&
    visibleCodes.every(code => selectedCodes.has(code));

  const selectedVisibleCount = visibleCodes.filter(code =>
    selectedCodes.has(code)
  ).length;
  // OLD: Select/Deselect all and the counts used filteredCompanies (the search-filtered list).

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-xs gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-3 pt-3 pb-2 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Watchlist</span>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {selectedCodes.size} selected
            </Badge>
          </div>
        </div>

        {/* Filter toggles */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Refined toggle — COMMENTED OUT: watchlist_quant has no refined column */}
          {/* <button
            onClick={() => setRefinedFilter(refinedFilter === true ? null : true)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
              refinedFilter === true
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground'
            )}
          >
            Refined
          </button> */}

          {/* All companies toggle */}
          <button
            onClick={() => setShowAllCompanies(!showAllCompanies)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
              showAllCompanies
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground'
            )}
          >
            All
          </button>

          {/* Surge watchlist: surging on top, filters (surge + target floor), add symbol */}
          <SurgeToggleButton
            size="icon"
            className="h-6 w-6"
            enabled={surge.surgingOnTop}
            onChange={surge.setSurgingOnTop}
            count={surge.showSurging ? surge.surgeByCode.size : undefined}
          />
          <WatchlistFilterPopover view={surge} triggerClassName="h-6 w-6" />
          <AddSymbolButton className="h-6 w-6" />

          {/* Date picker */}
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <button className="text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors bg-transparent text-muted-foreground border-border hover:border-foreground flex items-center gap-1">
                <CalendarIcon className="h-2.5 w-2.5" />
                {selectedDate
                  ? format(new Date(selectedDate), 'dd MMM')
                  : 'Date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate ? new Date(selectedDate) : undefined}
                onSelect={date => {
                  if (date) {
                    setSelectedDate(format(date, 'yyyy-MM-dd'));
                  }
                  setIsDatePickerOpen(false);
                }}
                disabled={date =>
                  !availableDates.includes(format(date, 'yyyy-MM-dd'))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbols… (RELIANCE, TCS)"
            className="pl-6 h-7 text-xs"
          />
        </div>

        {/* Select / Deselect all */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={allVisibleSelected}
            className="h-6 text-[10px] px-2 flex-1"
          >
            <CheckSquare className="h-3 w-3 mr-1" />
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeselectAll}
            disabled={selectedVisibleCount === 0}
            className="h-6 text-[10px] px-2 flex-1"
          >
            <Square className="h-3 w-3 mr-1" />
            Deselect All
          </Button>
        </div>
      </div>

      <Separator />
      <WatchlistFilterChips view={surge} className="px-2 py-1.5 border-b" />
      <SurgeStatusLine view={surge} />

      {/* ── Company list ── */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Loading companies…</span>
          </div>
        ) : visibleCodes.length === 0 && (search || surge.filtersActive || surge.targetFloorActive) ? (
          <SurgeNoMatches view={surge} onClearSearch={() => setSearch('')} />
        ) : visibleCodes.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {search ? 'No companies match your search.' : 'No companies available.'}
          </div>
        ) : (
          <div className="py-1 relative" ref={listRef} {...surge.listHandlers}>
            <SurgeSections
              view={surge}
              activeCode={null}
              onSelect={handleToggle}
              nameByCode={new Map(companies.map(c => [c.company_code.toUpperCase(), c.name] as [string, string]))}
              isChecked={code => selectedCodes.has(code)}
              restLabel="Screened"
              restCount={restScreened.length}
            />
            {restRows.map((company, index) => {
              const isChecked = selectedCodes.has(company.company_code);
              const code = company.company_code.toUpperCase();
              const quote = surge.quotes[code];
              const isManual = company.watchlist_source === 'manual';
              return (
                <React.Fragment key={company.company_code}>
                {index === restScreened.length && restManual.length > 0 &&
                  (restScreened.length > 0 || surge.pinnedCodes.length > 0 || surge.surgeOrder.length > 0) && (
                  <AdditionsHeader count={restManual.length} />
                )}
                <div
                  role="button"
                  tabIndex={0}
                  data-flip-key={`row-${company.company_code}`}
                  onClick={() => handleToggle(company.company_code)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggle(company.company_code);
                    }
                  }}
                  className={cn(
                    'group w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/50 cursor-pointer',
                    isChecked && 'bg-primary/5'
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggle(company.company_code)}
                    onClick={e => e.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <RankBadge rank={company.rank} />
                      <span className="text-xs font-medium truncate leading-none">
                        {company.company_code}
                      </span>
                      <TargetBadge value={surge.targetOf(code) ?? company.target_move_pct ?? null} />
                      <PinButton pinned={surge.pinnedSet.has(code)} code={code} onToggle={() => surge.togglePin(code)} />
                      {isManual && <RemoveButton code={code} onRemove={() => surge.removeAddition(code)} />}
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                        {company.exchange}
                      </span>
                      {company.refined && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                          R
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5 leading-none">
                      {company.name}
                    </div>
                  </div>
                  {/* Live LTP + day change (Surge watchlist) */}
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-mono text-[11px] tabular-nums leading-none">
                      {quote ? formatPrice(quote.ltp) : '—'}
                    </span>
                    <span className={cn(
                      'font-mono text-[9px] tabular-nums leading-none',
                      !quote ? 'text-muted-foreground/50' : quote.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {quote ? formatSignedPct(quote.changePercent) : '—'}
                    </span>
                  </div>
                </div>
                </React.Fragment>
              );
            })}
            {/* OLD rows were <button> elements over filteredCompanies; they are <div role="button">
                now because the pin / remove controls inside a row are buttons themselves. */}
          </div>
        )}
      </ScrollArea>

      {/* ── Footer count ── */}
      <Separator />
      <div className="px-3 py-2 shrink-0 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {visibleCodes.length} companies
          {(search || surge.filtersActive || surge.targetFloorActive) && ` (filtered from ${companies.length})`}
        </span>
        <span>{selectedVisibleCount} visible</span>
      </div>
    </div>
  );
};

export default MarketMoversSidebar;
