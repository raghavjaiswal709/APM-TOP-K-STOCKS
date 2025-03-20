'use client'
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";

interface WatchlistSelectorProps {
  onCompanySelect?: (companyCode: string | null) => void;
}

export function WatchlistSelector({ onCompanySelect }: WatchlistSelectorProps) {
  const {
    selectedWatchlist,
    setSelectedWatchlist,
    companies,
    loading,
    error,
    exists,
  } = useWatchlist();

  // Debug the request flow
  React.useEffect(() => {
    console.log('Current watchlist:', selectedWatchlist);
    console.log('Companies loaded:', companies.length);
  }, [selectedWatchlist, companies]);

  return (
    <div className="flex gap-5 items-center">
      <div>
        <RadioGroupDemo
          value={selectedWatchlist} 
          onChange={setSelectedWatchlist}
        />
      </div>
      
      {error && (
        <div className="text-red-500">{error}</div>
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
