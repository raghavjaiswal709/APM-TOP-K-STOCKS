'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { MultiSelectScrollable } from "./MultiSelectScrollable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, X, CalendarIcon } from "lucide-react";
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
    setShowAllCompanies
  } = useWatchlist();

  const [selectedExchange, setSelectedExchange] = React.useState<string>('');
  const [selectedMarker, setSelectedMarker] = React.useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

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

  const filteredCompanies = React.useMemo(() => {
    const filters: any = {};
    if (selectedExchange) filters.exchange = selectedExchange;
    if (selectedMarker) filters.marker = selectedMarker;
    return getFilteredCompanies(filters);
  }, [companies, selectedExchange, selectedMarker, getFilteredCompanies]);

  const handleExchangeChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedExchange(e.target.value);
    setSelectedMarker('');
  }, []);

  const handleMarkerChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMarker(e.target.value);
  }, []);

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
              
              {/* Show All Companies Checkbox */}
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="show-all-companies-multi"
                  checked={showAllCompanies}
                  onCheckedChange={handleShowAllChange}
                  disabled={disabled}
                />
                <label
                  htmlFor="show-all-companies-multi"
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

        {/* Filters */}
        {(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
          <div className="flex flex-col gap-2 justify-center">
            {showExchangeFilter && (
              <div className="flex flex-col">
                <select
                  value={selectedExchange}
                  onChange={handleExchangeChange}
                  className="px-2 py-1 text-xs border rounded m-0"
                  disabled={disabled}
                >
                  <option value="">All Exchanges</option>
                  {availableExchanges.map(exchange => (
                    <option key={exchange} value={exchange}>
                      {exchange}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {showMarkerFilter && availableMarkers.length > 0 && (
              <div className="flex flex-col">
                <select
                  value={selectedMarker}
                  onChange={handleMarkerChange}
                  className="px-2 py-1 text-xs border rounded m-0"
                  disabled={disabled}
                >
                  <option value="">All Markers</option>
                  {availableMarkers.map(marker => (
                    <option key={marker} value={marker}>
                      {marker}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {filteredCompanies.length !== companies.length && (
              <div className="text-xs text-muted-foreground">
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
    </Card>
  );
});

MultiSelectWatchlistSelector.displayName = 'MultiSelectWatchlistSelector';
