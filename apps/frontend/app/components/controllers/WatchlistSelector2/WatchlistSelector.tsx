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
  showSentimentFilter?: boolean;
  showDateSelector?: boolean;
  onFilteredDataChange?: (companies: any[]) => void;
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  sentiments: string[];
  refined: boolean | null;
  showAllCompanies: boolean;
}

export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  onDateChange,
  onFilteredDataChange,
  showExchangeFilter = true,
  showMarkerFilter = true,
  showSentimentFilter = true,
  showDateSelector = true
}: WatchlistSelectorProps) => {
  
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [selectedCompanyCode, setSelectedCompanyCode] = React.useState<string | null>(null);
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilters>({
    exchanges: [],
    markers: [],
    sentiments: [],
    refined: null,
    showAllCompanies: false
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
    getFilteredCompanies,
    refinedFilter,
    setRefinedFilter,
    showAllCompanies,
    setShowAllCompanies
  } = useWatchlist();

  // Get available sentiments (you might need to modify this based on your data)
  const availableSentiments = React.useMemo(() => {
    return ['positive', 'negative', 'neutral'];
  }, []);

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[WatchlistSelector] Date selected: ${dateStr}`);
      setSelectedDate(dateStr);
      setIsDatePickerOpen(false);
      
      // ✅ Clear selected company when date changes
      setSelectedCompanyCode(null);
      
      // Reset filters when date changes
      setActiveFilters({
        exchanges: [],
        markers: [],
        sentiments: [],
        refined: null,
        showAllCompanies: false
      });
      
      // Reset refined filter in hook
      setRefinedFilter(null);
      
      // ✅ Notify parent that company selection is cleared
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
    
    // ✅ Update local state to track selected company
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

    // Apply sentiment filter (assuming sentiment is a property of company)
    if (activeFilters.sentiments.length > 0) {
      filtered = filtered.filter(company => {
        const sentiment = (company as { sentiment?: string }).sentiment || 'neutral';
        return activeFilters.sentiments.includes(sentiment);
      });
    }

    console.log(`[WatchlistSelector] Filtered companies: ${filtered.length} out of ${companies.length}`);
    return filtered;
  }, [companies, activeFilters]);

   React.useEffect(() => {
    if (onFilteredDataChange) {
      onFilteredDataChange(filteredCompanies);
    }
  }, [filteredCompanies, onFilteredDataChange]);

  const handleFiltersChange = React.useCallback((filters: ActiveFilters) => {
    console.log(`[WatchlistSelector] Filters changed:`, filters);
    setActiveFilters(filters);
    
    // Update showAllCompanies state
    setShowAllCompanies(filters.showAllCompanies);
    
    // Update refined filter in the hook to trigger API call
    setRefinedFilter(filters.refined);
  }, [setRefinedFilter, setShowAllCompanies]);

  const getActiveFilterCount = () => {
    if (activeFilters.showAllCompanies) return 1;
    return activeFilters.exchanges.length + activeFilters.markers.length + activeFilters.sentiments.length + (activeFilters.refined !== null ? 1 : 0);
  };

  const filterOptions = React.useMemo(() => ({
    exchanges: availableExchanges,
    markers: availableMarkers,
    sentiments: availableSentiments
  }), [availableExchanges, availableMarkers, availableSentiments]);

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
      {(showExchangeFilter || showMarkerFilter || showSentimentFilter) && availableExchanges.length > 0 && (
        <div className="flex flex-col gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-2 h-20"
          >
            <Filter className="h-4 w-4" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                {getActiveFilterCount()}
              </Badge>
            )}
          </Button>
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
          key={`company-selector-${selectedDate}`} // ✅ Force re-render when date changes
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
      />
    </div>
  );
});

WatchlistSelector.displayName = 'WatchlistSelector';
