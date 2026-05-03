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

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  marker?: string;
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

  // Watchlist state — default to Refined
  const {
    companies,
    loading,
    availableDates,
    selectedDate,
    setSelectedDate,
    refinedFilter,
    setRefinedFilter,
    showAllCompanies,
    setShowAllCompanies,
    availableExchanges,
  } = useWatchlist({ refinedFilter: true });

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

  // Filtered list by search
  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies.filter(
      c =>
        c.company_code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [companies, search]);

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

  // Select all visible companies
  const handleSelectAll = useCallback(() => {
    const next = new Set(selectedCodes);
    filteredCompanies.forEach(c => next.add(c.company_code));
    onSelectionChange(next);
  }, [filteredCompanies, selectedCodes, onSelectionChange]);

  // Deselect all visible companies
  const handleDeselectAll = useCallback(() => {
    const next = new Set(selectedCodes);
    filteredCompanies.forEach(c => next.delete(c.company_code));
    onSelectionChange(next);
  }, [filteredCompanies, selectedCodes, onSelectionChange]);

  const allVisibleSelected =
    filteredCompanies.length > 0 &&
    filteredCompanies.every(c => selectedCodes.has(c.company_code));

  const selectedVisibleCount = filteredCompanies.filter(c =>
    selectedCodes.has(c.company_code)
  ).length;

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
          {/* Refined toggle */}
          <button
            onClick={() => setRefinedFilter(refinedFilter === true ? null : true)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors',
              refinedFilter === true
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground'
            )}
          >
            Refined
          </button>

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
            placeholder="Search companies…"
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

      {/* ── Company list ── */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Loading companies…</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {search ? 'No companies match your search.' : 'No companies available.'}
          </div>
        ) : (
          <div className="py-1">
            {filteredCompanies.map(company => {
              const isChecked = selectedCodes.has(company.company_code);
              return (
                <button
                  key={company.company_code}
                  onClick={() => handleToggle(company.company_code)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-muted/50',
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
                      <span className="text-xs font-medium truncate leading-none">
                        {company.company_code}
                      </span>
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
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* ── Footer count ── */}
      <Separator />
      <div className="px-3 py-2 shrink-0 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {filteredCompanies.length} companies
          {search && ` (filtered from ${companies.length})`}
        </span>
        <span>{selectedVisibleCount} visible</span>
      </div>
    </div>
  );
};

export default MarketMoversSidebar;
