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
}

interface ActiveFilters {
  exchanges: string[];
  markers: string[];
  refined: boolean | null;
  showAllCompanies: boolean;
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

  const handleFilterToggle = (filterType: 'exchanges' | 'markers', value: string) => {
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

  const handleRefinedToggle = (value: boolean | null) => {
    setTempFilters(prev => ({
      ...prev,
      refined: value
    }));
  };

  const handleApply = () => {
    onFiltersChange(tempFilters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters: ActiveFilters = {
      exchanges: [],
      markers: [],
      refined: null,
      showAllCompanies: false
    };
    setTempFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
  };

  const handleCancel = () => {
    setTempFilters(activeFilters);
    onClose();
  };

  const handleShowAllToggle = () => {
    setTempFilters(prev => ({
      ...prev,
      showAllCompanies: !prev.showAllCompanies
    }));
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (!tempFilters.showAllCompanies) {
      count = tempFilters.exchanges.length + tempFilters.markers.length + (tempFilters.refined !== null ? 1 : 0);
    }
    if (tempFilters.showAllCompanies) count++;
    return count;
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
            {/* Show All Companies Toggle */}
            <div className="space-y-3 pb-3 border-b">
              <div 
                onClick={handleShowAllToggle}
                className={cn(
                  "flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                  tempFilters.showAllCompanies && "bg-accent border-primary"
                )}
              >
                <div className={cn(
                  "h-5 w-5 border-2 rounded flex items-center justify-center flex-shrink-0",
                  tempFilters.showAllCompanies && "bg-primary border-primary"
                )}>
                  {tempFilters.showAllCompanies && (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Show all companies</span>
                  <span className="text-xs text-muted-foreground">Display all companies regardless of date selection</span>
                </div>
              </div>
            </div>

            {/* NSE Exchange Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">NSE Exchange</h4>
              <div className="grid grid-cols-2 gap-2">
                {filterOptions.exchanges.map(exchange => (
                  <div
                    key={exchange}
                    onClick={() => !tempFilters.showAllCompanies && handleFilterToggle('exchanges', exchange)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.exchanges.includes(exchange) && "bg-accent border-primary",
                      tempFilters.showAllCompanies && "opacity-50 cursor-not-allowed"
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
                      onClick={() => !tempFilters.showAllCompanies && handleFilterToggle('markers', marker)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                        tempFilters.markers.includes(marker) && "bg-accent border-primary",
                        tempFilters.showAllCompanies && "opacity-50 cursor-not-allowed"
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

            {/* Quality Filter (Refined) */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Quality Selector</h4>
              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => !tempFilters.showAllCompanies && handleRefinedToggle(null)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.refined === null && "bg-accent border-primary",
                    tempFilters.showAllCompanies && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.refined === null && "bg-primary border-primary"
                  )}>
                    {tempFilters.refined === null && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">All</span>
                </div>
                
                <div
                  onClick={() => !tempFilters.showAllCompanies && handleRefinedToggle(true)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.refined === true && "bg-accent border-primary",
                    tempFilters.showAllCompanies && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.refined === true && "bg-primary border-primary"
                  )}>
                    {tempFilters.refined === true && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">Refined</span>
                </div>

                <div
                  onClick={() => !tempFilters.showAllCompanies && handleRefinedToggle(false)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.refined === false && "bg-accent border-primary",
                    tempFilters.showAllCompanies && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.refined === false && "bg-primary border-primary"
                  )}>
                    {tempFilters.refined === false && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">Non-Refined</span>
                </div>
              </div>
              {/* <div className="text-xs text-muted-foreground px-1">
                Refined stocks are premium quality selections based on advanced analysis
              </div> */}
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

