'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { SelectScrollable } from "./SelectScrollable";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string, marker?: string) => void;
  onDateChange?: (date: string) => void;
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showDateSelector?: boolean;
}

export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  onDateChange,
  showExchangeFilter = true,
  showMarkerFilter = true,
  showDateSelector = true
}: WatchlistSelectorProps) => {
  
  const {
    selectedDate,
    setSelectedDate,
    availableDates,
    companies,
    loading,
    error,
    exists,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    getFilteredCompanies,
    showAllCompanies,
    setShowAllCompanies,
    refinedFilter,
    setRefinedFilter
  } = useWatchlist();

  const [selectedExchange, setSelectedExchange] = React.useState<string>('');
  const [selectedMarker, setSelectedMarker] = React.useState<string>('');
  const [selectedRefined, setSelectedRefined] = React.useState<string>('all');
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[WatchlistSelector] Date selected: ${dateStr}`);
      setSelectedDate(dateStr);
      setIsDatePickerOpen(false);
      if (onDateChange) onDateChange(dateStr);
    }
  }, [setSelectedDate, onDateChange]);

  const handleCompanySelect = React.useCallback((companyCode: string | null) => {
    if (!companyCode) {
      if (onCompanySelect) onCompanySelect(null);
      return;
    }

    const selectedCompany = companies.find(c => c.company_code === companyCode);
    if (onCompanySelect && selectedCompany) {
      onCompanySelect(companyCode, selectedCompany.exchange, selectedCompany.marker);
    }
  }, [companies, onCompanySelect]);

  const handleShowAllChange = React.useCallback((checked: boolean) => {
    console.log(`[WatchlistSelector] Show all companies toggled: ${checked}`);
    setShowAllCompanies(checked);
    
    // Reset filters when toggling
    setSelectedExchange('');
    setSelectedMarker('');
    setSelectedRefined('all');
    setRefinedFilter(null);
  }, [setShowAllCompanies, setRefinedFilter]);

  const handleRefinedChange = React.useCallback((value: string) => {
    setSelectedRefined(value);
    if (value === 'all') {
      setRefinedFilter(null);
    } else if (value === 'refined') {
      setRefinedFilter(true);
    } else if (value === 'non-refined') {
      setRefinedFilter(false);
    }
  }, [setRefinedFilter]);

  const filteredCompanies = React.useMemo(() => {
    const filters: { exchange?: string; marker?: string; minValidDays?: number } = {};
    if (selectedExchange) filters.exchange = selectedExchange;
    if (selectedMarker) filters.marker = selectedMarker;
    return getFilteredCompanies(filters);
  }, [selectedExchange, selectedMarker, getFilteredCompanies]);

  const availableDateObjects = React.useMemo(() => 
    availableDates.map(d => new Date(d)),
    [availableDates]
  );

  return (
    <div className="flex gap-4 flex-wrap items-center">
      
      {/* Date Selector */}
      {showDateSelector && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Select Date</label>
          
          {/* Show All Companies Checkbox */}
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="show-all-companies"
              checked={showAllCompanies}
              onCheckedChange={handleShowAllChange}
            />
            <label
              htmlFor="show-all-companies"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Show all companies
            </label>
          </div>

          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[200px] justify-start text-left font-normal"
                disabled={showAllCompanies}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate && !showAllCompanies ? format(new Date(selectedDate), "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate ? new Date(selectedDate) : undefined}
                onSelect={handleDateSelect}
                disabled={(date) => 
                  !availableDateObjects.some(d => 
                    d.toDateString() === date.toDateString()
                  ) || date > new Date()
                }
                initialFocus
              />
              {availableDates.length > 0 && (
                <div className="p-3 border-t text-xs text-muted-foreground">
                  {availableDates.length} dates available
                </div>
              )}
            </PopoverContent>
          </Popover>
          <div className="text-xs text-muted-foreground">
            {loading && `Loading...`}
            {!loading && exists && `${totalCompanies} companies`}
            {!loading && !exists && !showAllCompanies && `No data`}
          </div>
        </div>
      )}

      {/* Filters */}
      {(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
        <div className="flex flex-col gap-2 justify-center">
          {showExchangeFilter && (
            <select
              value={selectedExchange}
              onChange={(e) => setSelectedExchange(e.target.value)}
              className="py-[30px] px-4 text-sm text-muted-foreground border rounded-md bg-background"
            >
              <option value="">All Exchanges</option>
              {availableExchanges.map(exchange => (
                <option key={exchange} value={exchange}>{exchange}</option>
              ))}
            </select>
          )}

          {showMarkerFilter && availableMarkers.length > 0 && (
            <select
              value={selectedMarker}
              onChange={(e) => setSelectedMarker(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-background"
            >
              <option value="">All Markers</option>
              {availableMarkers.map(marker => (
                <option key={marker} value={marker}>{marker}</option>
              ))}
            </select>
          )}

          {/* Refined Filter */}
          <select
            value={selectedRefined}
            onChange={(e) => handleRefinedChange(e.target.value)}
            className="px-3 py-2 text-sm border rounded-md bg-background"
            disabled={showAllCompanies}
          >
            <option value="all">All Quality</option>
            <option value="refined">Refined Only ({companies.filter(c => c.refined === true).length})</option>
            <option value="non-refined">Non-Refined Only ({companies.filter(c => c.refined === false || !c.refined).length})</option>
          </select>

          {filteredCompanies.length !== companies.length && (
            <div className="text-xs text-muted-foreground">
              {filteredCompanies.length} of {companies.length} shown
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-destructive text-xs bg-destructive/10 px-2 py-1 rounded">
          {error}
        </div>
      )}
      
      {/* Company Selection */}
      <div>
        <SelectScrollable
          companies={filteredCompanies}
          loading={loading}
          exists={exists}
          onCompanySelect={handleCompanySelect}
        />
      </div>
    </div>
  );
});

WatchlistSelector.displayName = 'WatchlistSelector';
