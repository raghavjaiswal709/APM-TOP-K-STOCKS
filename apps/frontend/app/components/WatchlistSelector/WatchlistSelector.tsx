'use client'
// src/components/WatchlistSelector/WatchlistSelector.tsx
import * as React from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { RadioGroupDemo } from "./RadioGroup";
import { SelectScrollable } from "./SelectScrollable";

export function WatchlistSelector() {
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
    <div className=" flex gap-5 items-center">
      <div>
        {/* <h3 className="text-lg font-medium">Watchlist</h3> */}
        <RadioGroupDemo
          value={selectedWatchlist} 
          onChange={setSelectedWatchlist}
        />
      </div>
      
      {error && (
        <div className="text-red-500">{error}</div>
      )}
      
      <div>
        {/* <h3 className="text-lg font-medium">Company</h3> */}
        <SelectScrollable
          companies={companies}
          loading={loading}
          exists={exists}
        />
      </div>
    </div>
  );
}
