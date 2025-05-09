'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null) => void;
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
  } = useWatchlist();
  
  // Use either external or internal state
  const effectiveWatchlist = externalSelectedWatchlist || internalSelectedWatchlist;
  
  // Handle watchlist change
  const handleWatchlistChange = (value: string) => {
    if (onWatchlistChange) {
      onWatchlistChange(value);
    } else {
      internalSetSelectedWatchlist(value);
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
        <div className="text-red-500 text-xs">{error}</div>
      )}
      
      <div>
        <SelectScrollable
          companies={companies}
          loading={loading}
          exists={exists}
          onCompanySelect={onCompanySelect}
        />
      </div>
    </div>
  );
}
