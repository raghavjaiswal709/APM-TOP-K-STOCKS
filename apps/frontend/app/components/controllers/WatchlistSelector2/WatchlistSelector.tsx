'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";
import { FilterModal } from "./FilterModal";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string, marker?: string) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
  showSentimentFilter?: boolean;
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  sentiments: string[];
}

export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  selectedWatchlist: externalSelectedWatchlist,
  onWatchlistChange,
  showExchangeFilter = true,
  showMarkerFilter = true,
  showSentimentFilter = true
}: WatchlistSelectorProps) => {
  const [currentWatchlist, setCurrentWatchlist] = React.useState(() => 
    externalSelectedWatchlist || 'A'
  );
  
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);
  const [activeFilters, setActiveFilters] = React.useState<ActiveFilters>({
    exchanges: [],
    markers: [],
    sentiments: []
  });

  const prevExternalWatchlist = React.useRef(externalSelectedWatchlist);

  React.useEffect(() => {
    if (externalSelectedWatchlist && 
        externalSelectedWatchlist !== prevExternalWatchlist.current && 
        externalSelectedWatchlist !== currentWatchlist) {
      console.log(`[WatchlistSelector] External watchlist changed to: ${externalSelectedWatchlist}`);
      prevExternalWatchlist.current = externalSelectedWatchlist;
      setCurrentWatchlist(externalSelectedWatchlist);
    }
  }, [externalSelectedWatchlist, currentWatchlist]);

  const {
    selectedWatchlist,
    setSelectedWatchlist,
    companies,
    loading,
    error,
    exists,
    availableExchanges,
    availableMarkers,
    totalCompanies,
    getFilteredCompanies
  } = useWatchlist({ externalWatchlist: currentWatchlist });

  // Get available sentiments (you might need to modify this based on your data)
  const availableSentiments = React.useMemo(() => {
    return ['positive', 'negative', 'neutral'];
  }, []);

  const handleWatchlistChange = React.useCallback((value: string) => {
    console.log(`[WatchlistSelector] Watchlist changed to: ${value}`);
    if (value === currentWatchlist) {
      return;
    }
    // Reset filters when watchlist changes
    setActiveFilters({
      exchanges: [],
      markers: [],
      sentiments: []
    });
    setCurrentWatchlist(value);
    if (onWatchlistChange) {
      onWatchlistChange(value);
    }
  }, [currentWatchlist, onWatchlistChange]);

  const handleCompanySelect = React.useCallback((companyCode: string | null) => {
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
        activeFilters.markers.includes(company.marker)
      );
    }

    // Apply sentiment filter (assuming sentiment is a property of company)
    if (activeFilters.sentiments.length > 0) {
      filtered = filtered.filter(company => 
        activeFilters.sentiments.includes((company as any).sentiment || 'neutral')
      );
    }

    console.log(`[WatchlistSelector] Filtered companies: ${filtered.length} out of ${companies.length}`);
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

  console.log(`[WatchlistSelector] Render - currentWatchlist: ${currentWatchlist}, selectedWatchlist: ${selectedWatchlist}, companies: ${companies.length}, loading: ${loading}`);

  return (
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
