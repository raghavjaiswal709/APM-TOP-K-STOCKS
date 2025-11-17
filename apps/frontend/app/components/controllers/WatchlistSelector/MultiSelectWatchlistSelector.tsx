'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { MultiSelectScrollable } from "./MultiSelectScrollable";
import { MultiSelectFilterModal } from "./MultiSelectFilterModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, X, CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
  symbol?: string;
}

interface MultiSelectWatchlistSelectorProps {
  onCompaniesSelect?: (companies: Company[]) => void;
  onDateChange?: (date: string) => void;
  maxSelection?: number;
  selectedCompanies?: Company[];
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showDateSelector?: boolean;
  disabled?: boolean;
}

export const MultiSelectWatchlistSelector = React.memo(({ 
  onCompaniesSelect,
  onDateChange,
  maxSelection = 6,
  selectedCompanies = [],
  showExchangeFilter = true,
  showMarkerFilter = true,
  showDateSelector = true,
  disabled = false
}: MultiSelectWatchlistSelectorProps) => {
  
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
    setRefinedFilter
  } = useWatchlist();

  const [selectedExchange, setSelectedExchange] = React.useState<string>('');
  const [selectedMarker, setSelectedMarker] = React.useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState<{
    exchanges: string[];
    markers: string[];
    refined: boolean | null;
    showAllCompanies: boolean;
  }>({
    exchanges: [],
    markers: [],
    refined: null,
    showAllCompanies: false
  });

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[MultiSelectWatchlistSelector] Date selected: ${dateStr}`);
      
      // Important: Clear selections BEFORE setting the new date
      // This ensures no auto-selection happens
      if (onCompaniesSelect) {
        onCompaniesSelect([]);
      }
      
      // Reset filters
      setSelectedExchange('');
      setSelectedMarker('');
      
      // Set the new date (this will trigger data fetch for that date)
      setSelectedDate(dateStr);
      setIsDatePickerOpen(false);
      
      // Notify parent about date change
      if (onDateChange) {
        onDateChange(dateStr);
      }
    }
  }, [setSelectedDate, onDateChange, onCompaniesSelect]);

  const handleCompaniesSelect = React.useCallback((newSelectedCompanies: Company[]) => {
    console.log(`[MultiSelectWatchlistSelector] User selected companies:`, newSelectedCompanies);
    console.log(`[MultiSelectWatchlistSelector] Selection count: ${newSelectedCompanies.length}`);
    
    if (onCompaniesSelect) {
      onCompaniesSelect(newSelectedCompanies);
    }
  }, [onCompaniesSelect]);

  const handleShowAllChange = React.useCallback((checked: boolean) => {
    console.log(`[MultiSelectWatchlistSelector] Show all companies toggled: ${checked}`);
    setShowAllCompanies(checked);
    
    // Update active filters
    setActiveFilters(prev => ({
      ...prev,
      showAllCompanies: checked
    }));
    
    // Reset filters and selections when toggling
    setSelectedExchange('');
    setSelectedMarker('');
    if (onCompaniesSelect) {
      onCompaniesSelect([]);
    }
  }, [setShowAllCompanies, onCompaniesSelect]);

  const handleRemoveCompany = React.useCallback((companyToRemove: Company) => {
    const newSelection = selectedCompanies.filter(c => c.company_code !== companyToRemove.company_code);
    handleCompaniesSelect(newSelection);
  }, [selectedCompanies, handleCompaniesSelect]);

  const handleClearAll = React.useCallback(() => {
    handleCompaniesSelect([]);
  }, [handleCompaniesSelect]);

  const handleFiltersChange = React.useCallback((filters: typeof activeFilters) => {
    console.log(`[MultiSelectWatchlistSelector] Filters changed:`, filters);
    setActiveFilters(filters);
    
    // Update showAllCompanies state
    setShowAllCompanies(filters.showAllCompanies);
    
    // Update refined filter for API calls
    setRefinedFilter(filters.refined);
    
    // Apply exchange and marker filters
    if (filters.exchanges.length > 0) {
      setSelectedExchange(filters.exchanges[0]);
    } else {
      setSelectedExchange('');
    }
    
    if (filters.markers.length > 0) {
      setSelectedMarker(filters.markers[0]);
    } else {
      setSelectedMarker('');
    }
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

  const handleExchangeChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedExchange(e.target.value);
    setSelectedMarker('');
  }, []);

  const handleMarkerChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMarker(e.target.value);
  }, []);

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
    <Card className="flex gap-4 px-4 py-4">
      {/* Date Selection */}
      <div className="flex gap-4">
        {showDateSelector && (
          <div className="flex gap-5 items-center">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Select Date</label>

              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-start text-left font-normal"
                    disabled={disabled || showAllCompanies}
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
              <div className="flex flex-col gap-2">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <div>
                    {loading && `Loading data...`}
                    {!loading && exists && `${totalCompanies} companies`}
                    {!loading && !exists && !showAllCompanies && `No data available`}
                  </div>
                </div>
              </div>
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
              disabled={disabled}
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
      </div>

      {/* Selected Companies Tags */}
      {selectedCompanies.length > 0 && (
        <div className="space-y-2 max-w-96">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Selected ({selectedCompanies.length}/{maxSelection})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="h-6 px-2 text-xs"
              disabled={disabled}
            >
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCompanies.map((company) => (
              <Badge
                key={`${company.company_code}-${company.exchange}`}
                variant="default"
                className="flex items-center gap-1 pr-1"
              >
                <Building2 className="w-3 h-3" />
                <span>{company.company_code}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveCompany(company)}
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-destructive text-xs bg-destructive/10 px-2 py-1 rounded">
          {error}
        </div>
      )}
      
      {/* Multi-Select Company Dropdown */}
      <div className="flex items-center justify-center">
        <MultiSelectScrollable
          companies={filteredCompanies}
          loading={loading}
          exists={exists}
          onCompaniesSelect={handleCompaniesSelect}
          selectedCompanies={selectedCompanies}
          maxSelection={maxSelection}
          disabled={disabled}
        />
      </div>

      {/* Filter Modal */}
      <MultiSelectFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterOptions={{
          exchanges: availableExchanges,
          markers: availableMarkers
        }}
        activeFilters={activeFilters}
        onFiltersChange={handleFiltersChange}
        totalCompanies={companies.length}
        filteredCount={filteredCompanies.length}
      />
    </Card>
  );
});

MultiSelectWatchlistSelector.displayName = 'MultiSelectWatchlistSelector';
