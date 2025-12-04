'use client'
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface TimeMachineDatePickerProps {
  availableDates: string[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  loading?: boolean;
}

export const TimeMachineDatePicker: React.FC<TimeMachineDatePickerProps> = ({
  availableDates,
  selectedDate,
  onDateChange,
  loading = false
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const availableDateObjects = React.useMemo(() => 
    availableDates.map(d => new Date(d)),
    [availableDates]
  );

  const handleDateSelect = React.useCallback((date: Date | undefined) => {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[TimeMachineDatePicker] Date selected: ${dateStr}`);
      onDateChange(dateStr);
      setIsOpen(false);
    }
  }, [onDateChange]);

  return (
    <div className="flex flex-col gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[200px] h-20 justify-start text-left font-normal"
            disabled={loading}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? format(new Date(selectedDate), "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ? new Date(selectedDate) : undefined}
            onSelect={handleDateSelect}
            disabled={(date) => 
              !availableDateObjects.some(d => 
                d.toDateString() === date.toDateString()
              ) || date > new Date()
            }
            initialFocus
          />
          {availableDates.length > 0 && (
            <div className="p-3 border-t text-xs text-muted-foreground">
              {availableDates.length} dates available
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
