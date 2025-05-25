'use client'
import * as React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { SelectInterval } from "./controllers/SelectInterval";
import { SelectIndicators } from "./controllers/SelectIndicators";
import { CalendarForm } from "./controllers/CalendarForm";
import { WatchlistSelector } from "./controllers/WatchlistSelector";

interface CardWithFormProps {
  onCompanyChange: (companyId: string | null) => void;
  onDateChange: (date: Date | undefined) => void;
  onIntervalChange: (interval: string) => void;
  onIndicatorsChange: (indicators: string[]) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
}

export function CardWithForm({
  onCompanyChange,
  onDateChange,
  onIntervalChange,
  onIndicatorsChange,
  selectedWatchlist,
  onWatchlistChange,
}: CardWithFormProps) {
  
  // Memoize callbacks to prevent unnecessary re-renders
  const handleDateChange = React.useCallback((date: Date | undefined) => {
    console.log('Parent received date change:', date); // Debug log
    onDateChange(date);
  }, [onDateChange]);

  const handleCompanyChange = React.useCallback((companyId: string | null) => {
    console.log('Parent received company change:', companyId); // Debug log
    onCompanyChange(companyId);
  }, [onCompanyChange]);

  return (
    <Card className="w-full border border-opacity-30 ">
      <CardContent className="p-6">
        <div className="flex justify-between gap-4 ">
          <div className="p-3 border border-opacity-30  rounded-md flex-1 h-24 flex items-center justify-center">
            <WatchlistSelector 
              onCompanySelect={handleCompanyChange}
              selectedWatchlist={selectedWatchlist}
              onWatchlistChange={onWatchlistChange}
            />
          </div>
          
          {/* <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectInterval 
              onIntervalChange={onIntervalChange}
            />
          </div> */}
          
          <div className="p-3 border border-opacity-30  rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectIndicators 
              onIndicatorsChange={onIndicatorsChange}
            />
          </div>
          
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <CalendarForm 
              onDateChange={handleDateChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
