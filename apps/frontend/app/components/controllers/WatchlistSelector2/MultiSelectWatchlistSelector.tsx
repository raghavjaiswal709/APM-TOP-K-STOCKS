'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { MultiSelectScrollable } from "./MultiSelectScrollable";
import { FilterModal } from "./FilterModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, X, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  sentiments: string[];
}

interface MultiSelectWatchlistSelectorProps {
  onCompaniesSelect?: (companies: Company[]) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  maxSelection?: number;
  selectedCompanies?: Company[];
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showSentimentFilter?: boolean;
}

export const MultiSelectWatchlistSelector = React.memo(({ 
  onCompaniesSelect,
  selectedWatchlist: externalSelectedWatchlist,
  onWatchlistChange,
  maxSelection = 6,
  selectedCompanies = [],
  showExchangeFilter = true,
  showMarkerFilter = true,
  showSentimentFilter = true
}: MultiSelectWatchlistSelectorProps) => {
  const [currentWatchlist, setCurrentWatchlist] = React.useState(() => 
    externalSelectedWatchlist || 'A'
  );

  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilters>({
    exchanges: [],
    markers: [],
    sentiments: []
  });

  const {
    companies,
    loading,
    error,
    exists,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    getFilteredCompanies
  } = useWatchlist({ externalWatchlist: currentWatchlist });

  const availableSentiments = React.useMemo(() => {
    return ['positive', 'negative', 'neutral'];
  }, []);

  const handleWatchlistChange = React.useCallback((value: string) => {
    console.log(`[MultiSelectWatchlistSelector] Watchlist changed to: ${value}`);
    if (value === currentWatchlist) return;
    
    // Reset filters when watchlist changes
    setActiveFilters({
      exchanges: [],
      markers: [],
      sentiments: []
    });
    setCurrentWatchlist(value);
    
    if (onCompaniesSelect) {
      onCompaniesSelect([]);
    }
    if (onWatchlistChange) {
      onWatchlistChange(value);
    }
  }, [currentWatchlist, onWatchlistChange, onCompaniesSelect]);

  const handleCompaniesSelect = React.useCallback((newSelectedCompanies: Company[]) => {
    console.log('[MultiSelectWatchlistSelector] Selected companies:', newSelectedCompanies);
    if (onCompaniesSelect) {
      onCompaniesSelect(newSelectedCompanies);
    }
  }, [onCompaniesSelect]);

  const handleRemoveCompany = React.useCallback((companyToRemove: Company) => {
    const newSelection = selectedCompanies.filter(c => c.company_code !== companyToRemove.company_code);
    handleCompaniesSelect(newSelection);
  }, [selectedCompanies, handleCompaniesSelect]);

  const handleClearAll = React.useCallback(() => {
    handleCompaniesSelect([]);
  }, [handleCompaniesSelect]);

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
        activeFilters.markers.includes(company.marker)
      );
    }

    // Apply sentiment filter
    if (activeFilters.sentiments.length > 0) {
      filtered = filtered.filter(company => 
        activeFilters.sentiments.includes((company as any).sentiment || 'neutral')
      );
    }

    return filtered;
  }, [companies, activeFilters]);

  const handleFiltersChange = React.useCallback((filters: ActiveFilters) => {
    setActiveFilters(filters);
  }, []);

  const getActiveFilterCount = () => {
    return activeFilters.exchanges.length + activeFilters.markers.length + activeFilters.sentiments.length;
  };

  const filterOptions = React.useMemo(() => ({
    exchanges: availableExchanges,
    markers: availableMarkers,
    sentiments: availableSentiments
  }), [availableExchanges, availableMarkers, availableSentiments]);

  return (
    <Card className="flex gap-4 px-4 py-4">
      {/* Watchlist Selection */}
      <div className="flex gap-4">
        <div className="flex gap-5 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Watchlist</label>
            <RadioGroupDemo
              value={currentWatchlist} 
              onChange={handleWatchlistChange}
            />
            <div className="flex flex-col gap-2">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <div>
                  {loading && `Loading watchlist ${currentWatchlist}...`}
                  {!loading && exists && `${totalCompanies} companies (${currentWatchlist})`}
                  {!loading && !exists && `No data available for watchlist ${currentWatchlist}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Button */}
        {(showExchangeFilter || showMarkerFilter || showSentimentFilter) && availableExchanges.length > 0 && (
          <div className="flex flex-col gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFilterModalOpen(true)}
              className="flex items-center gap-2 h-8"
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
      <div>
        <MultiSelectScrollable
          companies={filteredCompanies}
          loading={loading}
          exists={exists}
          onCompaniesSelect={handleCompaniesSelect}
          selectedCompanies={selectedCompanies}
          maxSelection={maxSelection}
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
    </Card>
  );
});

MultiSelectWatchlistSelector.displayName = 'MultiSelectWatchlistSelector';
