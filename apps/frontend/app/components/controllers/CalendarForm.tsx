'use client'
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, Search, BarChart3 } from "lucide-react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useEffect, useCallback } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const FormSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

interface CalendarFormProps {
  onDateRangeChange?: (startDate: Date | undefined, endDate: Date | undefined) => void;
  onFetchData?: () => void;
  onFetchAllData?: () => void; 
  loading?: boolean;
}

export function CalendarForm({ 
  onDateRangeChange, 
  onFetchData, 
  onFetchAllData, // **NEW**
  loading = false 
}: CalendarFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      startDate: undefined,
      endDate: undefined,
    },
  });

  const memoizedOnDateRangeChange = useCallback(onDateRangeChange, [onDateRangeChange]);

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (memoizedOnDateRangeChange) {
        console.log('Date range changed:', value.startDate, value.endDate);
        memoizedOnDateRangeChange(value.startDate, value.endDate);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, memoizedOnDateRangeChange]);

  const handleStartDateSelect = useCallback((date: Date | undefined) => {
    form.setValue('startDate', date, { 
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true 
    });
    
    const currentEndDate = form.getValues('endDate');
    if (date && currentEndDate && date > currentEndDate) {
      form.setValue('endDate', undefined);
    }
  }, [form]);

  const handleEndDateSelect = useCallback((date: Date | undefined) => {
    form.setValue('endDate', date, { 
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true 
    });
  }, [form]);

  const handleFetchClick = () => {
    if (onFetchData) {
      onFetchData();
    }
  };

  const handleFetchAllClick = () => {
    if (onFetchAllData) {
      onFetchAllData();
    }
  };

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  return (
    <Form {...form}>
      <div className="flex items-center
     gap-4">
        {/* Start Date */}
        <div className=" flex flex-col gap-2" >
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col ">
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[200px] pl-3 text-left font-normal justify-start",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick start date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-md" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={handleStartDateSelect}
                    disabled={(date) =>
                      date > new Date() || date < new Date("2020-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />

        {/* End Date */}
        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[200px] pl-3 text-left font-normal justify-start",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pick end date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border border-border shadow-md" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={handleEndDateSelect}
                    disabled={(date) =>
                      date > new Date() || 
                      date < new Date("2020-01-01") ||
                      (startDate && date < startDate)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </FormItem>
          )}
        />
        </div>
          <div className="flex flex-col gap-2">
        {/* Fetch Data Button - Only enabled when start date is selected */}
        <Button 
          onClick={handleFetchClick}
          disabled={loading || !startDate}
          className="px-6 py-1.4 bg-white hover:bg-white/50 text-black font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Fetching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Fetch Data
            </>
          )}
        </Button>

        {/* **NEW**: Fetch All Data Button - Always enabled when company is selected */}
        <Button 
          onClick={handleFetchAllClick}
          disabled={loading}
          variant="secondary"
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Loading...
            </>
          ) : (
            <>
              <BarChart3 className="h-4 w-4 mr-2" />
              Fetch All Data
            </>
          )}
        </Button>
     
     </div>
      </div>
    </Form>
  );
}
