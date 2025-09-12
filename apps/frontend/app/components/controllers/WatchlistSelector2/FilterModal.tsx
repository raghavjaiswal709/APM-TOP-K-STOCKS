// FilterModal.tsx
"use client"
import * as React from "react"
import { Filter, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface FilterOptions {
  exchanges: string[];
  markers: string[];
  sentiments: string[];
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  sentiments: string[];
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterOptions: FilterOptions;
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  totalCompanies: number;
  filteredCount: number;
}

export function FilterModal({
  isOpen,
  onClose,
  filterOptions,
  activeFilters,
  onFiltersChange,
  totalCompanies,
  filteredCount
}: FilterModalProps) {
  const [tempFilters, setTempFilters] = React.useState<ActiveFilters>(activeFilters);

  React.useEffect(() => {
    if (isOpen) {
      setTempFilters(activeFilters);
    }
  }, [isOpen, activeFilters]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleFilterToggle = (filterType: keyof ActiveFilters, value: string) => {
    setTempFilters(prev => {
      const currentValues = prev[filterType];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      
      return {
        ...prev,
        [filterType]: newValues
      };
    });
  };

  const handleApply = () => {
    onFiltersChange(tempFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = {
      exchanges: [],
      markers: [],
      sentiments: []
    };
    setTempFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
  };

  const handleCancel = () => {
    setTempFilters(activeFilters);
    onClose();
  };

  const getActiveFilterCount = () => {
    return tempFilters.exchanges.length + tempFilters.markers.length + tempFilters.sentiments.length;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
        <Card className="w-[480px] max-h-[600px] overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter Companies
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredCount} of {totalCompanies} companies
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6 max-h-[400px] overflow-y-auto">
            {/* Exchange Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Exchange</h4>
              <div className="grid grid-cols-2 gap-2">
                {filterOptions.exchanges.map(exchange => (
                  <div
                    key={exchange}
                    onClick={() => handleFilterToggle('exchanges', exchange)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.exchanges.includes(exchange) && "bg-accent border-primary"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 border rounded flex items-center justify-center",
                      tempFilters.exchanges.includes(exchange) && "bg-primary border-primary"
                    )}>
                      {tempFilters.exchanges.includes(exchange) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm">{exchange}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Marker Filter */}
            {filterOptions.markers.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Marker</h4>
                <div className="grid grid-cols-2 gap-2">
                  {filterOptions.markers.map(marker => (
                    <div
                      key={marker}
                      onClick={() => handleFilterToggle('markers', marker)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                        tempFilters.markers.includes(marker) && "bg-accent border-primary"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 border rounded flex items-center justify-center",
                        tempFilters.markers.includes(marker) && "bg-primary border-primary"
                      )}>
                        {tempFilters.markers.includes(marker) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-sm">{marker}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sentiment Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Sentiment</h4>
              <div className="grid grid-cols-2 gap-2">
                {filterOptions.sentiments.map(sentiment => (
                  <div
                    key={sentiment}
                    onClick={() => handleFilterToggle('sentiments', sentiment)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.sentiments.includes(sentiment) && "bg-accent border-primary"
                    )}
                  >
                    <div className={cn(
                      "h-4 w-4 border rounded flex items-center justify-center",
                      tempFilters.sentiments.includes(sentiment) && "bg-primary border-primary"
                    )}>
                      {tempFilters.sentiments.includes(sentiment) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="text-sm capitalize">{sentiment}</span>
                    <div className={cn(
                      "ml-auto w-2 h-2 rounded-full",
                      sentiment === 'positive' && "bg-green-500",
                      sentiment === 'negative' && "bg-red-500",
                      sentiment === 'neutral' && "bg-gray-500"
                    )} />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary">
                    {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} active
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear}>
                  Clear All
                </Button>
                <Button size="sm" onClick={handleApply}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
