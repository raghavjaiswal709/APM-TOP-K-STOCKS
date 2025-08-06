'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { MultiSelectScrollable } from "./MultiSelectScrollable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
}
interface MultiSelectWatchlistSelectorProps {
  onCompaniesSelect?: (companies: Company[]) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  maxSelection?: number;
  selectedCompanies?: Company[];
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
}
export const MultiSelectWatchlistSelector = React.memo(({ 
  onCompaniesSelect,
  selectedWatchlist: externalSelectedWatchlist,
  onWatchlistChange,
  maxSelection = 6,
  selectedCompanies = [],
  showExchangeFilter = true,
  showMarkerFilter = true
}: MultiSelectWatchlistSelectorProps) => {
  const [currentWatchlist, setCurrentWatchlist] = React.useState(() => 
    externalSelectedWatchlist || 'A'
  );
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
  const [selectedExchange, setSelectedExchange] = React.useState<string>('');
  const [selectedMarker, setSelectedMarker] = React.useState<string>('');
  const handleWatchlistChange = React.useCallback((value: string) => {
    console.log(`[MultiSelectWatchlistSelector] Watchlist changed to: ${value}`);
    if (value === currentWatchlist) return;
    setSelectedExchange('');
    setSelectedMarker('');
    setCurrentWatchlist(value);
    if (onCompaniesSelect) {
      onCompaniesSelect([]);
    }
    if (onWatchlistChange) {
      onWatchlistChange(value);
    }
  }, [currentWatchlist, onWatchlistChange, onCompaniesSelect]);
  const handleCompaniesSelect = React.useCallback((newSelectedCompanies: Company[]) => {
    console.log(`[MultiSelectWatchlistSelector] Selected companies:`, newSelectedCompanies);
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
  return (
    <Card className=" flex gap-4 px-4 py-4 ">
      {/* Watchlist Selection */}
      <div className="flex gap-4 ">
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

        {/* Filters */}
        {(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
          <div className="flex flex-col gap-2 justify-center">
            {showExchangeFilter && (
              <div className="flex flex-col">
                <select
                  value={selectedExchange}
                  onChange={handleExchangeChange}
                  className="px-2 py-1 text-xs border rounded m-0"
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
    </Card>
  );
});
MultiSelectWatchlistSelector.displayName = 'MultiSelectWatchlistSelector';

