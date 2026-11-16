'use client'
import * as React from "react"
import { Check, ChevronsUpDown, Building2, TrendingUp, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useFlipAnimation, useSurgeWatchlist } from "@/hooks/useSurge"
import { formatPrice, formatSignedPct, parseSearchTerms } from "@/lib/surge/filters"
import {
  AdditionsHeader,
  PinButton,
  RankBadge,
  RemoveButton,
  SurgeStatusLine,
  TargetBadge,
  WatchlistFilterChips,
} from "@/app/components/surge/SurgeControls"
// OLD (Surge as an opt-in overlay): SurgeFilterChips
import { SurgeNoMatches, SurgeSections } from "@/app/components/surge/SurgeSections"

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  pe_ratio?: number;
  N1_Pattern_count?: number;
  // NEW (Surge watchlist — see hooks/useWatchlist.ts)
  rank?: number;
  target_move_pct?: number | null;
  watchlist_source?: 'surge' | 'manual';
}

interface SelectScrollableProps {
  /** The watchlist's date — today's screen is the only one with a "Surging today" block. */
  date?: string | null;
  companies: MergedCompany[];
  loading: boolean;
  exists: boolean;
  onCompanySelect: (companyCode: string | null) => void;
}

export function SelectScrollable({
  date,
  companies,
  loading,
  exists,
  onCompanySelect
}: SelectScrollableProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [selectedCompany, setSelectedCompany] = React.useState<MergedCompany | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")
  // The Surge watchlist view (pins, surging today, filters, target floor,
  // additions) — shared by every watchlist. The Surge screen IS the list now,
  // so the view is always on. Live prices only while the dropdown is open.
  const surgeSearchTerms = React.useMemo(() => parseSearchTerms(searchTerm), [searchTerm])
  const surgeRowCodes = React.useMemo(
    () => (open && companies.length <= 400 ? companies.map(c => c.company_code) : []),
    [open, companies]
  )
  const surge = useSurgeWatchlist(surgeSearchTerms, { date, rowCodes: surgeRowCodes, liveQuotes: open })
  const surgeOn = true
  // OLD: const surge = useSurgeWatchlist(surgeSearchTerms)
  // OLD: const surgeOn = surge.enabled // opt-in overlay, toggled from the WatchlistSelector bar
  const surgeListRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false) // hydration fix

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Debug: Log when companies prop changes
  React.useEffect(() => {
    if (mounted) {
      console.log(`[SelectScrollable] Companies prop updated - count: ${companies.length}`);
    }
  }, [companies, mounted])

  // ✅ IMPROVED: Only reset when companies array becomes empty or drastically changes
  // This prevents unwanted resets when filters are applied
  React.useEffect(() => {
    if (!mounted) return

    // Only reset if companies is now empty or the selected company is no longer in the list
    if (companies.length === 0) {
      console.log(`[SelectScrollable] Companies list is empty, resetting selection`);
      setValue("")
      setSelectedCompany(null)
      setSearchTerm("")
      setOpen(false)
      onCompanySelect(null)
    } else if (
      selectedCompany &&
      !companies.find(c => c.company_code === selectedCompany.company_code) &&
      // A surging / pinned name picked from the Surge block can sit outside the list.
      !(surgeOn && (surge.surgeByCode.has(selectedCompany.company_code) || surge.pinnedSet.has(selectedCompany.company_code)))
    ) {
      console.log(`[SelectScrollable] Selected company not in filtered list, resetting selection`);
      setValue("")
      setSelectedCompany(null)
      setSearchTerm("")
      setOpen(false)
      onCompanySelect(null)
    }
  }, [companies, onCompanySelect, mounted, selectedCompany, surgeOn, surge.surgeByCode, surge.pinnedSet]);

  React.useEffect(() => {
    if (!mounted) return
    const handleClickOutside = () => {
      if (open) {
        setOpen(false)
        setSearchTerm("")
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open, mounted])

  const handleSelect = (company: MergedCompany) => {
    console.log(`[SelectScrollable] handleSelect called with company:`, company);
    if (value === company.company_code) {
      console.log(`[SelectScrollable] Deselecting company: ${company.company_code}`);
      setValue("")
      setSelectedCompany(null)
      onCompanySelect(null)
    } else {
      console.log(`[SelectScrollable] Selecting company: ${company.company_code}`);
      setValue(company.company_code)
      setSelectedCompany(company)
      onCompanySelect(company.company_code)
    }
    setOpen(false)
    setSearchTerm("")
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(!open)
    if (!open) {
      setSearchTerm("")
    }
  }

  const formatCompanyDisplay = (company: MergedCompany) => {
    return `${company.company_code} - ${company.name}`;
  }

  const formatCompanyDetails = (company: MergedCompany) => {
    const details = [];
    if (company.exchange) details.push(company.exchange);
    if (company.marker) details.push(company.marker);
    if (company.total_valid_days) details.push(`${company.total_valid_days} days`);
    return details.join(' • ');
  }

  const filteredCompanies = React.useMemo(() => {
    if (!searchTerm) return companies;
    if (surgeOn) {
      return companies.filter(company => {
        const code = company.company_code?.toUpperCase() ?? "";
        const name = company.name?.toUpperCase() ?? "";
        return surgeSearchTerms.some(term => code.includes(term) || name.includes(term));
      });
    }
    const searchLower = searchTerm.toLowerCase();
    return companies.filter(company => {
      const marker = company.marker ?? "";
      return (
        (company.company_code && company.company_code.toLowerCase().includes(searchLower)) ||
        (company.name && company.name.toLowerCase().includes(searchLower)) ||
        (company.exchange && company.exchange.toLowerCase().includes(searchLower)) ||
        marker.toLowerCase().includes(searchLower)
      );
    });
  }, [companies, searchTerm, surgeOn, surgeSearchTerms]);

  const restCompanies = React.useMemo(() => {
    if (!surgeOn) return filteredCompanies
    return filteredCompanies.filter(c => {
      const code = c.company_code?.toUpperCase()
      return !surge.surgingSet.has(code) && !surge.pinnedSet.has(code) && surge.passesFilters(code)
      // OLD: ... && (!surge.filtersActive || surge.surgeByCode.has(code))
    })
  }, [surgeOn, filteredCompanies, surge.surgingSet, surge.pinnedSet, surge.passesFilters])

  // The screened list, then "My additions" — as in the dashboard.
  const restScreened = React.useMemo(() => restCompanies.filter(c => c.watchlist_source !== 'manual'), [restCompanies])
  const restManual = React.useMemo(() => restCompanies.filter(c => c.watchlist_source === 'manual'), [restCompanies])
  const restRows = React.useMemo(() => [...restScreened, ...restManual], [restScreened, restManual])

  const companyNameByCode = React.useMemo(
    () => new Map(companies.map(c => [c.company_code?.toUpperCase(), c.name] as [string, string])),
    [companies]
  )

  const visibleCount = surgeOn
    ? surge.pinnedCodes.length + surge.surgeOrder.length + restCompanies.length
    : filteredCompanies.length

  useFlipAnimation(
    surgeListRef,
    surgeOn && open
      ? [...surge.pinnedCodes, '|', ...surge.surgeOrder, '|', ...restScreened.map(c => c.company_code), '|', ...restManual.map(c => c.company_code)].join(',')
      : '',
    surgeOn && open
  )

  const handleSurgeSelect = (code: string) => {
    const known = companies.find(c => c.company_code?.toUpperCase() === code)
    handleSelect(known ?? { company_code: code, name: companyNameByCode.get(code) ?? surge.screenedByCode.get(code)?.name ?? code, exchange: 'NSE', marker: 'EQ' })
  }

  if (!mounted) {
    return <div className="w-[350px] h-20 bg-muted animate-pulse rounded-md" />
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px] w-[350px]">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        Loading companies...
      </div>
    );
  }

  if (!exists || companies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px] w-[350px]">
        <Building2 className="h-4 w-4" />
        {!exists ? 'Watchlist not available' : 'No companies found'}
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-center w-full max-w-[350px]">
      <div className="relative w-full">
        <Button
          variant="outline"
          onClick={handleButtonClick}
          className="w-full justify-between h-20"
        >
          {selectedCompany ? (
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {formatCompanyDisplay(selectedCompany)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              Select company... ({companies.length} available)
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {open && (
          <div
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg max-h-[500px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {!surgeOn && filteredCompanies.length !== companies.length && (
                <div className="text-xs text-muted-foreground mt-1">
                  {`Showing ${filteredCompanies.length} of ${companies.length} companies`}
                </div>
              )}
            </div>
            {surgeOn && (
              <>
                <WatchlistFilterChips view={surge} className="px-2 py-1.5 border-b" />
                <SurgeStatusLine view={surge} />
              </>
            )}
            <div
              ref={surgeListRef}
              className={cn("overflow-y-auto relative", surgeOn ? "max-h-[360px]" : "max-h-[250px]")}
              {...(surgeOn ? surge.listHandlers : {})}
            >
              {surge.loading && visibleCount === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">Loading Surge watchlist…</div>
              ) : visibleCount === 0 && (searchTerm || surge.filtersActive || surge.targetFloorActive) ? (
                <SurgeNoMatches view={surge} onClearSearch={() => setSearchTerm("")} />
              ) : visibleCount === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {searchTerm ? 'No companies match your search' : 'No companies found'}
                </div>
              ) : (
                <>
                {surgeOn && (
                  <SurgeSections
                    view={surge}
                    activeCode={value ? value.toUpperCase() : null}
                    onSelect={handleSurgeSelect}
                    nameByCode={companyNameByCode}
                    restLabel="Screened"
                    restCount={restScreened.length}
                  />
                )}
                {restRows.map((company, index) => {
                  const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                  const isSelected = value === company.company_code;
                  const code = company.company_code?.toUpperCase();
                  const quote = surge.quotes[code];
                  const isManual = company.watchlist_source === 'manual';
                  return (
                    <React.Fragment key={uniqueKey}>
                    {index === restScreened.length && restManual.length > 0 &&
                      (restScreened.length > 0 || surge.pinnedCodes.length > 0 || surge.surgeOrder.length > 0) && (
                      <AdditionsHeader count={restManual.length} />
                    )}
                    <div
                      data-flip-key={surgeOn ? `row-${company.company_code}` : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(company);
                      }}
                      className={cn(
                        "group flex flex-col gap-1 p-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isSelected ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {company.company_code}
                          </span>
                          <RankBadge rank={company.rank} />
                          <TargetBadge value={surge.targetOf(code) ?? company.target_move_pct ?? null} />
                          <PinButton pinned={surge.pinnedSet.has(code)} code={code} onToggle={() => surge.togglePin(code)} />
                          {isManual && <RemoveButton code={code} onRemove={() => surge.removeAddition(code)} />}
                        </div>
                        {company.N1_Pattern_count !== undefined && company.N1_Pattern_count > 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
                            <TrendingUp className="h-3 w-3" />
                            {company.N1_Pattern_count}
                          </div>
                        )}
                        {/* Live LTP (Surge watchlist) */}
                        <span className="font-mono text-xs tabular-nums flex-shrink-0">
                          {quote ? formatPrice(quote.ltp) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 w-full">
                        <div className="text-sm text-muted-foreground truncate min-w-0 ml-6">
                          {company.name}
                        </div>
                        <span className={cn(
                          "font-mono text-[10px] tabular-nums flex-shrink-0",
                          !quote ? "text-muted-foreground/50" : quote.changePercent >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                          {quote ? formatSignedPct(quote.changePercent) : '—'}
                        </span>
                      </div>
                      {/* OLD name row:
                      <div className="text-sm text-muted-foreground truncate w-full ml-6">
                        {company.name}
                      </div> */}
                      <div className="text-xs text-muted-foreground ml-6">
                        {formatCompanyDetails(company)}
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="min-h-[96px] flex items-center">
        {selectedCompany && (
          <div className="p-3  top-0 left-0 bg-muted/50 rounded-md h-20 border border-border w-[250px] overflow-hidden">
            <div className="h-full flex flex-col justify-center ">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm truncate flex-1 mr-2">{selectedCompany.company_code}</h4>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">
                    {selectedCompany.exchange}
                  </span>
                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">
                    {selectedCompany.marker}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2 truncate">
                {selectedCompany.name}
              </p>
              {(selectedCompany.total_valid_days || selectedCompany.median_daily_volume || selectedCompany.pe_ratio) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {selectedCompany.total_valid_days && (
                    <div className="flex  items-center gap-2">
                      <span className="text-muted-foreground text-xs">Days:</span>
                      <span className="font-medium text-xs">{selectedCompany.total_valid_days}</span>
                    </div>
                  )}
                  {selectedCompany.median_daily_volume && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">Vol:</span>
                      <span className="font-medium text-xs">{(selectedCompany.median_daily_volume / 1000).toFixed(0)}K</span>
                    </div>
                  )}
                  {selectedCompany.pe_ratio && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">P/E:</span>
                      <span className="font-medium text-xs">{selectedCompany.pe_ratio.toFixed(1)}</span>
                    </div>
                  )}
                  {selectedCompany.N1_Pattern_count !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">N1:</span>
                      <span className="font-medium text-xs flex items-center gap-1">
                        {selectedCompany.N1_Pattern_count}
                        {selectedCompany.N1_Pattern_count > 0 && <TrendingUp className="h-3 w-3 text-green-600" />}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
