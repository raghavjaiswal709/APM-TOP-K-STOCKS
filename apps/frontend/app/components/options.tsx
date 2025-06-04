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
  onCompanyChange: (companyCode: string | null, exchange?: string) => void;
  onDateRangeChange: (startDate: Date | undefined, endDate: Date | undefined) => void;
  onFetchData: () => void;
  onIntervalChange: (interval: string) => void;
  onIndicatorsChange: (indicators: string[]) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  loading?: boolean;
}

export function CardWithForm({
  onCompanyChange,
  onDateRangeChange,
  onFetchData,
  onIntervalChange,
  onIndicatorsChange,
  selectedWatchlist,
  onWatchlistChange,
  loading = false,
}: CardWithFormProps) {
  
  const handleDateRangeChange = React.useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    console.log('CardWithForm received date range change:', startDate, endDate);
    onDateRangeChange(startDate, endDate);
  }, [onDateRangeChange]);

  const handleCompanySelect = React.useCallback((companyCode: string | null, exchange?: string) => {
    console.log('CardWithForm received company change:', companyCode, 'on exchange:', exchange);
    onCompanyChange(companyCode, exchange);
  }, [onCompanyChange]);

  const handleFetchData = React.useCallback(() => {
    console.log('CardWithForm received fetch data request');
    onFetchData();
  }, [onFetchData]);

  const handleIntervalChange = React.useCallback((interval: string) => {
    console.log('CardWithForm received interval change:', interval);
    onIntervalChange(interval);
  }, [onIntervalChange]);

  const handleIndicatorsChange = React.useCallback((indicators: string[]) => {
    console.log('CardWithForm received indicators change:', indicators);
    onIndicatorsChange(indicators);
  }, [onIndicatorsChange]);

  const handleWatchlistChange = React.useCallback((watchlist: string) => {
    console.log('CardWithForm received watchlist change:', watchlist);
    if (onWatchlistChange) {
      onWatchlistChange(watchlist);
    }
  }, [onWatchlistChange]);

  return (
    <Card className="border-none w-[600px]">
      <CardContent className="p-4 w-[600px]">
        <div className="space-y-2">
          {/* Company and Watchlist Selection */}
          <div className="flex justify-between gap-4">
            <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-center">
              <WatchlistSelector 
                onCompanySelect={handleCompanySelect}  
                selectedWatchlist={selectedWatchlist}
                onWatchlistChange={handleWatchlistChange} 
              />
            </div>

            {/* Uncomment if you want interval selection back */}
            {/* <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-center">
              <SelectInterval 
                onIntervalChange={handleIntervalChange}
              />
            </div> */}
             
            {/* <div className="p-3 border border-opacity-30 rounded-md flex-1 h-24 flex items-center justify-center">
              <SelectIndicators 
                onIndicatorsChange={handleIndicatorsChange}
              />
            </div> */}
          </div>
          
          {/* Uncomment if you want date range selection back */}
          {/* <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">📅 Date Range Selection</h3>
            <CalendarForm 
              onDateRangeChange={handleDateRangeChange}
              onFetchData={handleFetchData}
              loading={loading}
            />
          </div> */}
        </div>
      </CardContent>
    </Card>
  );
}

export default CardWithForm;
