'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";
interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string, marker?: string) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  showExchangeFilter?: boolean;
  showMarkerFilter?: boolean;
}
export const WatchlistSelector = React.memo(({ 
  onCompanySelect,
  selectedWatchlist: externalSelectedWatchlist,
  onWatchlistChange,
  showExchangeFilter = true,
  showMarkerFilter = true
}: WatchlistSelectorProps) => {
  const [currentWatchlist, setCurrentWatchlist] = React.useState(() => 
    externalSelectedWatchlist || 'A'
  );
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
  const [selectedExchange, setSelectedExchange] = React.useState<string>('');
  const [selectedMarker, setSelectedMarker] = React.useState<string>('');
  const handleWatchlistChange = React.useCallback((value: string) => {
    console.log(`[WatchlistSelector] Watchlist changed to: ${value}`);
    if (value === currentWatchlist) {
      return;
    }
    setSelectedExchange('');
    setSelectedMarker('');
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
    const filters: any = {};
    if (selectedExchange) filters.exchange = selectedExchange;
    if (selectedMarker) filters.marker = selectedMarker;
    const filtered = getFilteredCompanies(filters);
    console.log(`[WatchlistSelector] Filtered companies: ${filtered.length} out of ${companies.length}`);
    return filtered;
  }, [companies, selectedExchange, selectedMarker, getFilteredCompanies]);
  const handleExchangeChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedExchange(e.target.value);
    setSelectedMarker('');
  }, []);
  const handleMarkerChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMarker(e.target.value);
  }, []);
  console.log(`[WatchlistSelector] Render - currentWatchlist: ${currentWatchlist}, selectedWatchlist: ${selectedWatchlist}, companies: ${companies.length}, loading: ${loading}`);
  return (
    <div className="flex gap-4">
      {}
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
  {/* {availableExchanges.length > 0 && (
    <div>
      Exchanges: {availableExchanges.join(', ')}
    </div>
  )} */}
</div>
        </div>
        </div>
        
        {/* Status Information */}
        
      </div>

      {/* Filters */}
      {/* Filters */}
{(showExchangeFilter || showMarkerFilter) && availableExchanges.length > 0 && (
  <div className="flex flex-col gap-2 justify-center">
    {/* Exchange Filter */}
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

    {/* Marker Filter */}
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

    {/* Filter Results Count - Only render when there's content */}
    {filteredCompanies.length !== companies.length && (
      <div className="text-xs text-muted-foreground">
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
    </div>
  );
});
WatchlistSelector.displayName = 'WatchlistSelector';

