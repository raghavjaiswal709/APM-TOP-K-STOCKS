'use client'
import * as React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectInterval } from "./controllers/SelectInterval";
import { SelectIndicators } from "./controllers/SelectIndicators";
import { CalendarForm } from "./controllers/CalendarForm";
import { WatchlistSelector } from "./controllers/WatchlistSelector";
import { ImageCarousel } from "./ImageCarousel";
import { BarChart3 } from "lucide-react";
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
  const [selectedCompany, setSelectedCompany] = React.useState<{
    companyCode: string;
    exchange: string;
  } | null>(null);
  const [isCarouselOpen, setIsCarouselOpen] = React.useState(false);
  const [watchlistSelectedDate, setWatchlistSelectedDate] = React.useState<string | null>(null);
  const handleDateRangeChange = React.useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    console.log('CardWithForm received date range change:', startDate, endDate);
    onDateRangeChange(startDate, endDate);
  }, [onDateRangeChange]);
  const handleCompanySelect = React.useCallback((companyCode: string | null, exchange?: string) => {
    console.log('CardWithForm received company change:', companyCode, 'on exchange:', exchange);
    if (companyCode && exchange) {
      setSelectedCompany({ companyCode, exchange });
    } else {
      setSelectedCompany(null);
    }
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

  const handleWatchlistDateChange = React.useCallback((date: string) => {
    console.log('🗓️ [CardWithForm] Watchlist date changed to:', date);
    setWatchlistSelectedDate(date);
  }, []);

  const handleOpenCarousel = React.useCallback(() => {
    console.log('🖼️ [CardWithForm] Opening carousel with date:', watchlistSelectedDate);
    if (selectedCompany) {
      setIsCarouselOpen(true);
    }
  }, [selectedCompany, watchlistSelectedDate]);
  return (
    <>
      <Card className="border-none w-full">
        <CardContent className="p-4 w-full">
          <div className="space-y-2">
            {}
            <div className="flex justify-end gap-2">
              <div className="p-3 border border-opacity-30 rounded-md flex-1 gap-4 h-24 flex items-center">
                <WatchlistSelector 
                  onCompanySelect={handleCompanySelect}  
                  onDateChange={handleWatchlistDateChange}
                />

                <div className=" flex items-center justify-center min-w-[120px] absolute right-[395px]">
                <Button
                  onClick={handleOpenCarousel}
                  disabled={!selectedCompany}
                  variant="outline"
                  className="flex items-center justify-center gap-2 h-20"
                >
                  {}
                  <span className="text-sm">View Graphs</span>
                </Button>
              </div>
                 {}
              
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Image Carousel Modal */}
      {selectedCompany && (
        <ImageCarousel
          isOpen={isCarouselOpen}
          onClose={() => setIsCarouselOpen(false)}
          companyCode={selectedCompany.companyCode}
          exchange={selectedCompany.exchange}
          selectedDate={watchlistSelectedDate || undefined}
        />
      )}
    </>
  );
}
export default CardWithForm;

