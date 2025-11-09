'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { SelectScrollable } from "./SelectScrollable";
import { FilterModal } from "./FilterModal";
import { Filter, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string, marker?: string) => void;
  onDateChange?: (date: string) => void;
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showDateSelector?: boolean;
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  refined: boolean | null;
}

export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  onDateChange,
  showExchangeFilter = true,
  showMarkerFilter = true,
  showDateSelector = true
}: WatchlistSelectorProps) => {
  
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [selectedCompanyCode, setSelectedCompanyCode] = React.useState<string | null>(null);
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilters>({
    exchanges: [],
    markers: [],
    refined: null
  });

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
    showAllCompanies,
    setShowAllCompanies,
    setRefinedFilter
  } = useWatchlist();

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[WatchlistSelector] Date selected: ${dateStr}`);
      setSelectedDate(dateStr);
      setIsDatePickerOpen(false);
      
      // Clear selected company when date changes
      setSelectedCompanyCode(null);
      
      // Reset filters when date changes
      setActiveFilters({
        exchanges: [],
        markers: [],
        refined: null
      });
      
      // Reset refined filter in hook
      setRefinedFilter(null);
      
      // Notify parent that company selection is cleared
      if (onCompanySelect) {
        onCompanySelect(null);
      }
      
      if (onDateChange) {
        onDateChange(dateStr);
      }
    }
  }, [setSelectedDate, onDateChange, onCompanySelect, setRefinedFilter]);

  const handleCompanySelect = React.useCallback((companyCode: string | null) => {
    console.log(`[WatchlistSelector] handleCompanySelect called with: ${companyCode}`);
    
    // Update local state to track selected company
    setSelectedCompanyCode(companyCode);
    
    if (!companyCode) {
      if (onCompanySelect) {
        onCompanySelect(null);
      }
      return;
    }
    const selectedCompany = companies.find(c => c.company_code === companyCode);
    console.log(`[WatchlistSelector] Selected company: ${companyCode}`, selectedCompany);
    if (onCompanySelect && selectedCompany) {
      onCompanySelect(companyCode, selectedCompany.exchange, selectedCompany.marker);
    }
  }, [companies, onCompanySelect]);

  const filteredCompanies = React.useMemo(() => {
    let filtered = companies;

    // Apply exchange filter
    if (activeFilters.exchanges.length > 0) {
      filtered = filtered.filter(company => 
        activeFilters.exchanges.includes(company.exchange)
      );
    }

    // Apply marker filter
    if (activeFilters.markers.length > 0) {
      filtered = filtered.filter(company => 
        company.marker && activeFilters.markers.includes(company.marker)
      );
    }

    console.log(`[WatchlistSelector] Filtered companies: ${filtered.length} out of ${companies.length}`);
    return filtered;
  }, [companies, activeFilters]);

  const handleFiltersChange = React.useCallback((filters: ActiveFilters) => {
    console.log(`[WatchlistSelector] Filters changed:`, filters);
    console.log(`[WatchlistSelector] Refined filter set to: ${filters.refined}`);
    setActiveFilters(filters);
    // Update refined filter in the hook to trigger API call
    setRefinedFilter(filters.refined);
  }, [setRefinedFilter]);

  const getActiveFilterCount = () => {
    return activeFilters.exchanges.length + activeFilters.markers.length + (activeFilters.refined !== null ? 1 : 0);
  };

  const filterOptions = React.useMemo(() => ({
    exchanges: availableExchanges,
    markers: availableMarkers
  }), [availableExchanges, availableMarkers]);

  const availableDateObjects = React.useMemo(() => 
    availableDates.map(d => new Date(d)),
    [availableDates]
  );

  console.log(`[WatchlistSelector] Render - selectedDate: ${selectedDate}, companies: ${companies.length}, loading: ${loading}`);

  return (
    <div className="flex gap-4 flex-wrap items-center">
      
      {/* Date Selector */}
      {showDateSelector && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Select Date</label>
          
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

      {/* Filter Button */}
      {(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
        <div className="flex flex-col gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-2 h-10"
          >
            <Filter className="h-4 w-4" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
          
          {filteredCompanies.length !== companies.length && (
            <div className="text-xs text-muted-foreground text-center">
              {`${filteredCompanies.length} of ${companies.length} shown`}
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
          key={`company-selector-${selectedDate}`}
          companies={filteredCompanies}
          loading={loading}
          exists={exists}
          onCompanySelect={handleCompanySelect}
        />
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterOptions={filterOptions}
        activeFilters={activeFilters}
        onFiltersChange={handleFiltersChange}
        totalCompanies={companies.length}
        filteredCount={filteredCompanies.length}
        showAllCompanies={showAllCompanies}
        onShowAllCompaniesChange={setShowAllCompanies}
      />
    </div>
  );
});

WatchlistSelector.displayName = 'WatchlistSelector';
