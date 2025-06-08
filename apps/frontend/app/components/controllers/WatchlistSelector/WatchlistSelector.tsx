'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null, exchange?: string) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
}

export function WatchlistSelector({ 
  onCompanySelect,
  selectedWatchlist: externalSelectedWatchlist,
  onWatchlistChange
}: WatchlistSelectorProps) {
  const {
    selectedWatchlist: internalSelectedWatchlist,
    setSelectedWatchlist: internalSetSelectedWatchlist,
    companies,
    loading,
    error,
    exists,
    availableExchanges,
  } = useWatchlist();
  
  const effectiveWatchlist = externalSelectedWatchlist || internalSelectedWatchlist;
  
  const handleWatchlistChange = (value: string) => {
    if (onWatchlistChange) {
      onWatchlistChange(value);
    } else {
      internalSetSelectedWatchlist(value);
    }
  };

  const handleCompanySelect = (companyCode: string | null, exchange?: string) => {
    console.log(`Selected company: ${companyCode} on exchange: ${exchange}`);
    if (onCompanySelect) {
      onCompanySelect(companyCode, exchange);
    }
  };

  return (
    <div className="flex gap-5 items-center">
      <div>
        <RadioGroupDemo
          value={effectiveWatchlist} 
          onChange={handleWatchlistChange}
        />
      </div>
      
      {error && (
        <div className="text-destructive text-xs bg-destructive/10 px-2 py-1 rounded">
          {error}
        </div>
      )}
      
      {availableExchanges.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Exchanges: {availableExchanges.join(', ')}
        </div>
      )}
      
      <div>
        <SelectScrollable
          companies={companies}
          loading={loading}
          exists={exists}
          onCompanySelect={handleCompanySelect}
        />
      </div>
    </div>
  );
}
