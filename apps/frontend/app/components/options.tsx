'use client'
import * as React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { SelectInterval } from "./controllers/SelectInterval";
import { SelectIndicators } from "./controllers/SelectIndicators";
import { CalendarForm } from "./controllers/CalendarForm";
import { WatchlistSelector } from "./controllers/WatchlistSelector/WatchlistSelector";

interface CardWithFormProps {
  onCompanyChange: (companyId: string | null) => void;
  onDateChange: (date: Date | undefined) => void;
  onIntervalChange: (interval: string) => void;
  onIndicatorsChange: (indicators: string[]) => void;
}

export function CardWithForm({
  onCompanyChange,
  onDateChange,
  onIntervalChange,
  onIndicatorsChange,
}: CardWithFormProps) {
  return (
    <Card className="w-full border border-opacity-30 border-gray-300">
      <CardContent className="p-6">
        <div className="flex justify-between gap-4 ">
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <WatchlistSelector 
              onCompanySelect={onCompanyChange}
            />
          </div>
          
          {/* Interval Selector */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectInterval 
              onIntervalChange={onIntervalChange}
            />
          </div>
          
          {/* Indicators Selector */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <SelectIndicators 
              onIndicatorsChange={onIndicatorsChange}
            />
          </div>
          
          {/* Date Selector */}
          <div className="p-3 border border-opacity-30 border-gray-300 rounded-md flex-1 h-24 flex items-center justify-center">
            <CalendarForm 
              onDateChange={onDateChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
