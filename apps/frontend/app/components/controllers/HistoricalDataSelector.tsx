'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Building2, Database, Clock, Loader2 } from 'lucide-react';

interface HistoricalDataSelectorProps {
  // Date Selection
  availableDates: string[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  loadingDates?: boolean;

  // Company Selection
  availableCompanies: string[];
  selectedCompany: string | null;
  onCompanyChange: (company: string | null) => void;
  loadingCompanies?: boolean;

  // Optional customization
  showBadges?: boolean;
  compact?: boolean;
}

export const HistoricalDataSelector: React.FC<HistoricalDataSelectorProps> = ({
  availableDates,
  selectedDate,
  onDateChange,
  loadingDates = false,
  availableCompanies,
  selectedCompany,
  onCompanyChange,
  loadingCompanies = false,
  showBadges = true,
  compact = false,
}) => {
  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get selected date info
  const selectedDateInfo = useMemo(() => {
    if (!selectedDate) return null;
    return {
      formatted: formatDateDisplay(selectedDate),
      companiesCount: availableCompanies.length,
    };
  }, [selectedDate, availableCompanies.length]);

  return (
    <Card className="w-full">
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Historical Data Selection
            </h3>
            {showBadges && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                <Database className="h-3 w-3 mr-1" />
                Time Machine Mode
              </Badge>
            )}
          </div>

          {/* Date & Company Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Select Recording Date
              </label>
              <Select
                value={selectedDate || ''}
                onValueChange={(value) => onDateChange(value || null)}
                disabled={loadingDates}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue>
                    {loadingDates ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading dates...</span>
                      </div>
                    ) : selectedDate ? (
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{formatDateDisplay(selectedDate)}</span>
                        {selectedDateInfo && (
                          <span className="text-xs text-muted-foreground">
                            {selectedDateInfo.companiesCount} companies available
                          </span>
                        )}
                      </div>
                    ) : (
                      'Select a date'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[300px]">
                    {availableDates.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No recorded dates available
                      </div>
                    ) : (
                      availableDates.map((date) => (
                        <SelectItem key={date} value={date}>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-400" />
                            {formatDateDisplay(date)}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>

            {/* Company Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Select Company
              </label>
              <Select
                value={selectedCompany || ''}
                onValueChange={(value) => onCompanyChange(value || null)}
                disabled={loadingCompanies || !selectedDate}
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue>
                    {loadingCompanies ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading companies...</span>
                      </div>
                    ) : selectedCompany ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{selectedCompany}</span>
                      </div>
                    ) : !selectedDate ? (
                      'Select a date first'
                    ) : (
                      'Select a company'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[300px]">
                    {availableCompanies.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        {selectedDate ? 'No companies found for this date' : 'Select a date to view companies'}
                      </div>
                    ) : (
                      availableCompanies.map((company) => (
                        <SelectItem key={company} value={company}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>{company}</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Info Footer */}
          {selectedDate && selectedDateInfo && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3" />
                  <span>
                    Viewing historical data from {selectedDateInfo.formatted}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  <span>{selectedDateInfo.companiesCount} companies recorded</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
