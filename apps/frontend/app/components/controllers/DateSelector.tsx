'use client';
import React from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, Database } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

interface AvailableDate {
  date: string;
  displayDate: string;
  companiesCount: number;
}

interface DateSelectorProps {
  availableDates: AvailableDate[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  loading?: boolean;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  availableDates,
  selectedDate,
  onDateSelect,
  loading = false
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      console.log('✅ Selected date (local):', dateStr); 
      onDateSelect(dateStr);
      setIsOpen(false);
    }
  };

  const getSelectedDateInfo = () => {
    if (!selectedDate) return null;
    return availableDates.find(d => d.date === selectedDate);
  };

  const createDateFromString = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); 
  };

  const selectedDateInfo = getSelectedDateInfo();
  const availableDateObjects = availableDates.map(d => createDateFromString(d.date));

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Database className="h-5 w-5" />
              Select Recording Date
            </h3>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                Loading...
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[280px] pl-3 text-left font-normal justify-start"
                >
                  {selectedDate ? (
                    selectedDateInfo ? (
                      <>
                        {/* ✅ FIXED: Use createDateFromString for display */}
                        {format(createDateFromString(selectedDate), "PPP")}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {selectedDateInfo.companiesCount} companies
                        </span>
                      </>
                    ) : (
                      format(createDateFromString(selectedDate), "PPP")
                    )
                  ) : (
                    <span className="text-muted-foreground">Select a recording date</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                  <h4 className="font-medium text-sm text-muted-foreground">Available Recording Dates</h4>
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate ? createDateFromString(selectedDate) : undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) => 
                    !availableDateObjects.some(availableDate => 
                      availableDate.toDateString() === date.toDateString()
                    ) || date > new Date()
                  }
                  initialFocus
                />
                {availableDates.length > 0 && (
                  <div className="p-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      {availableDates.length} recording dates available
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateSelect(null)}
              >
                Clear
              </Button>
            )}
          </div>

          {selectedDateInfo && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Date:</span>
                <div className="font-medium">{selectedDateInfo.displayDate}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Companies:</span>
                <div className="font-medium">{selectedDateInfo.companiesCount}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Source:</span>
                <div className="font-medium">Recorded Data</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
