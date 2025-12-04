'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { SelectScrollable } from "./SelectScrollable";
import { FilterModal } from "./FilterModal";
import { CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string, marker?: string) => void;
  onDateChange?: (date: string) => void;
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showDateSelector?: boolean;
  // NEW: Allow parent to control date state for synchronized updates
  externalSelectedDate?: string | null;
  externalSetSelectedDate?: (date: string) => void;
  externalAvailableDates?: string[];
  externalCompanies?: Array<{ company_code: string; name: string; exchange: string; marker?: string; refined?: boolean }>;
  externalLoading?: boolean;
  externalError?: string | null;
  externalExists?: boolean;
  externalAvailableExchanges?: string[];
  externalAvailableMarkers?: string[];
  externalTotalCompanies?: number;
}

export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  onDateChange,
  showExchangeFilter = true,
  showMarkerFilter = true,
  showDateSelector = true,
  // External state props (when parent controls state)
  externalSelectedDate,
  externalSetSelectedDate,
  externalAvailableDates,
  externalCompanies,
  externalLoading,
  externalError,
  externalExists,
  externalAvailableExchanges,
  externalAvailableMarkers,
  externalTotalCompanies,
}: WatchlistSelectorProps) => {
  
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState({
    exchanges: [] as string[],
    markers: [] as string[],
    refined: null as boolean | null,
    showAllCompanies: false
  });

  // Use internal hook only when external state is not provided
  const internalHook = useWatchlist();
  
  // Determine whether to use external or internal state
  const isExternallyControlled = externalSelectedDate !== undefined || externalSetSelectedDate !== undefined;
  
  // Use external values when provided, otherwise fall back to internal hook
  const selectedDate = isExternallyControlled ? externalSelectedDate : internalHook.selectedDate;
  const setSelectedDate = isExternallyControlled && externalSetSelectedDate ? externalSetSelectedDate : internalHook.setSelectedDate;
  const availableDates = externalAvailableDates ?? internalHook.availableDates;
  const companies = externalCompanies ?? internalHook.companies;
  const loading = externalLoading ?? internalHook.loading;
  const error = externalError ?? internalHook.error;
  const exists = externalExists ?? internalHook.exists;
  const availableExchanges = externalAvailableExchanges ?? internalHook.availableExchanges;
  const availableMarkers = externalAvailableMarkers ?? internalHook.availableMarkers;
  const totalCompanies = externalTotalCompanies ?? internalHook.totalCompanies;
  const showAllCompanies = internalHook.showAllCompanies;
  const setShowAllCompanies = internalHook.setShowAllCompanies;
  const setRefinedFilter = internalHook.setRefinedFilter;

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[WatchlistSelector] Date selected: ${dateStr}, isExternallyControlled: ${isExternallyControlled}`);
      setSelectedDate(dateStr);
      setIsDatePickerOpen(false);
      if (onDateChange) onDateChange(dateStr);
    }
  }, [setSelectedDate, onDateChange, isExternallyControlled]);

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

  const handleFiltersChange = React.useCallback((filters: typeof activeFilters) => {
    console.log(`[WatchlistSelector] Filters changed:`, filters);
    setActiveFilters(filters);
    
    // Update showAllCompanies state
    setShowAllCompanies(filters.showAllCompanies);
    
    // Update refined filter for API calls
    setRefinedFilter(filters.refined);
  }, [setShowAllCompanies, setRefinedFilter]);

  const filteredCompanies = React.useMemo(() => {
    let filtered = [...companies];
    
    // Apply exchange filter
    if (activeFilters.exchanges.length > 0) {
      filtered = filtered.filter(c => activeFilters.exchanges.includes(c.exchange));
    }
    
    // Apply marker filter
    if (activeFilters.markers.length > 0) {
      filtered = filtered.filter(c => c.marker && activeFilters.markers.includes(c.marker));
    }
    
    return filtered;
  }, [companies, activeFilters]);

  const getActiveFilterCount = React.useCallback(() => {
    if (activeFilters.showAllCompanies) return 1;
    return activeFilters.exchanges.length + 
           activeFilters.markers.length + 
           (activeFilters.refined !== null ? 1 : 0);
  }, [activeFilters]);

  const availableDateObjects = React.useMemo(() => 
    availableDates.map(d => new Date(d)),
    [availableDates]
  );

  return (
    <div className="flex gap-4 flex-wrap items-center">
      
      {/* Date Selector */}
      {showDateSelector && (
        <div className="flex flex-col gap-1">
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-[200px] h-20 justify-start text-left font-normal"
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
        </div>
      )}

      {/* Filter Button */}
      {(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFilterModalOpen(true)}
            className="relative min-w-[120px] h-20"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge 
                variant="secondary" 
                className="ml-2 px-1.5 py-0.5 text-xs"
              >
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
        </div>
      )}

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterOptions={{
          exchanges: availableExchanges,
          markers: availableMarkers
        }}
        activeFilters={activeFilters}
        onFiltersChange={handleFiltersChange}
        totalCompanies={totalCompanies}
        filteredCount={filteredCompanies.length}
      />

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
