// FilterModal.tsx
"use client"
import * as React from "react"
import { Filter, X, Check, Brain, Zap, TrendingUp, TrendingDown, Minus, Target, Fingerprint } from "lucide-react"
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
  hasPrediction: boolean | null; // null = all, true = with prediction, false = without
  hasGtt: boolean | null;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
  desirability: 'high' | 'medium' | 'low' | null;
  hasUmapData: boolean | null;
  umapConfidence: 'high' | 'medium' | 'low' | null;
  umapNoise: 'low' | 'medium' | 'high' | null;
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
      showAllCompanies: false,
      hasPrediction: null,
      hasGtt: null,
      sentiment: null,
      desirability: null,
      hasUmapData: null,
      umapConfidence: null,
      umapNoise: null,
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
    if (tempFilters.hasPrediction !== null) count++;
    if (tempFilters.hasGtt !== null) count++;
    if (tempFilters.sentiment !== null) count++;
    if (tempFilters.desirability !== null) count++;
    if (tempFilters.hasUmapData !== null) count++;
    if (tempFilters.umapConfidence !== null) count++;
    if (tempFilters.umapNoise !== null) count++;
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
        <Card className="w-[480px] max-h-[700px] overflow-hidden">
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
          
          <CardContent className="space-y-6 max-h-[500px] overflow-y-auto">
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
            </div>

            {/* Prediction Availability Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-orange-500" />
                Prediction Available
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasPrediction: null }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasPrediction === null && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasPrediction === null && "bg-primary border-primary"
                  )}>
                    {tempFilters.hasPrediction === null && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">All</span>
                </div>
                
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasPrediction: true }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasPrediction === true && "bg-orange-500/20 border-orange-500"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasPrediction === true && "bg-orange-500 border-orange-500"
                  )}>
                    {tempFilters.hasPrediction === true && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium">With 🧠</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasPrediction: false }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasPrediction === false && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasPrediction === false && "bg-primary border-primary"
                  )}>
                    {tempFilters.hasPrediction === false && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">Without</span>
                </div>
              </div>
            </div>

            {/* GTT Prediction Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                GTT Prediction
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasGtt: null }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasGtt === null && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasGtt === null && "bg-primary border-primary"
                  )}>
                    {tempFilters.hasGtt === null && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">All</span>
                </div>
                
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasGtt: true }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasGtt === true && "bg-purple-500/20 border-purple-500"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasGtt === true && "bg-purple-500 border-purple-500"
                  )}>
                    {tempFilters.hasGtt === true && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium">With ⚡</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, hasGtt: false }))}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.hasGtt === false && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.hasGtt === false && "bg-primary border-primary"
                  )}>
                    {tempFilters.hasGtt === false && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">Without</span>
                </div>
              </div>
            </div>

            {/* Sentiment Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Sentiment
              </h4>
              <div className="grid grid-cols-4 gap-2">
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, sentiment: null }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.sentiment === null && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.sentiment === null && "bg-primary border-primary"
                  )}>
                    {tempFilters.sentiment === null && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-xs font-medium">All</span>
                </div>
                
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, sentiment: 'BULLISH' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.sentiment === 'BULLISH' && "bg-green-500/20 border-green-500"
                  )}
                >
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs font-medium">Bullish</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, sentiment: 'BEARISH' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.sentiment === 'BEARISH' && "bg-red-500/20 border-red-500"
                  )}
                >
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs font-medium">Bearish</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, sentiment: 'NEUTRAL' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.sentiment === 'NEUTRAL' && "bg-gray-500/20 border-gray-500"
                  )}
                >
                  <Minus className="h-3 w-3 text-gray-500" />
                  <span className="text-xs font-medium">Neutral</span>
                </div>
              </div>
            </div>

            {/* Desirability Filter */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Desirability Score</h4>
              <div className="grid grid-cols-4 gap-2">
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, desirability: null }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.desirability === null && "bg-accent border-primary"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 border rounded flex items-center justify-center",
                    tempFilters.desirability === null && "bg-primary border-primary"
                  )}>
                    {tempFilters.desirability === null && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-xs font-medium">All</span>
                </div>
                
                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, desirability: 'high' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.desirability === 'high' && "bg-emerald-500/20 border-emerald-500"
                  )}
                >
                  <span className="text-xs font-medium text-emerald-500">High</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, desirability: 'medium' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.desirability === 'medium' && "bg-blue-500/20 border-blue-500"
                  )}
                >
                  <span className="text-xs font-medium text-blue-500">Medium</span>
                </div>

                <div
                  onClick={() => setTempFilters(prev => ({ ...prev, desirability: 'low' }))}
                  className={cn(
                    "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                    tempFilters.desirability === 'low' && "bg-amber-500/20 border-amber-500"
                  )}
                >
                  <span className="text-xs font-medium text-amber-500">Low</span>
                </div>
              </div>
            </div>

            {/* UMAP Clustering Filters */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-violet-500" />
                UMAP Clustering
              </h4>
              
              {/* Has UMAP Data */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Data Available</p>
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, hasUmapData: null }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.hasUmapData === null && "bg-accent border-primary"
                    )}
                  >
                    <div className={cn("h-4 w-4 border rounded flex items-center justify-center", tempFilters.hasUmapData === null && "bg-primary border-primary")}>
                      {tempFilters.hasUmapData === null && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-xs font-medium">All</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, hasUmapData: true }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.hasUmapData === true && "bg-violet-500/20 border-violet-500"
                    )}
                  >
                    <div className={cn("h-4 w-4 border rounded flex items-center justify-center", tempFilters.hasUmapData === true && "bg-violet-500 border-violet-500")}>
                      {tempFilters.hasUmapData === true && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-xs font-medium">With 🔬</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, hasUmapData: false }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.hasUmapData === false && "bg-accent border-primary"
                    )}
                  >
                    <div className={cn("h-4 w-4 border rounded flex items-center justify-center", tempFilters.hasUmapData === false && "bg-primary border-primary")}>
                      {tempFilters.hasUmapData === false && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-xs font-medium">Without</span>
                  </div>
                </div>
              </div>

              {/* UMAP Confidence */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Confidence Level</p>
                <div className="grid grid-cols-4 gap-2">
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapConfidence: null }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapConfidence === null && "bg-accent border-primary"
                    )}
                  >
                    <span className="text-xs font-medium">All</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapConfidence: 'high' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapConfidence === 'high' && "bg-emerald-500/20 border-emerald-500"
                    )}
                  >
                    <span className="text-xs font-medium text-emerald-500">High</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapConfidence: 'medium' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapConfidence === 'medium' && "bg-blue-500/20 border-blue-500"
                    )}
                  >
                    <span className="text-xs font-medium text-blue-500">Mid</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapConfidence: 'low' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapConfidence === 'low' && "bg-red-500/20 border-red-500"
                    )}
                  >
                    <span className="text-xs font-medium text-red-500">Low</span>
                  </div>
                </div>
              </div>

              {/* UMAP Noise Level */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Noise Level</p>
                <div className="grid grid-cols-4 gap-2">
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapNoise: null }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapNoise === null && "bg-accent border-primary"
                    )}
                  >
                    <span className="text-xs font-medium">All</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapNoise: 'low' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapNoise === 'low' && "bg-emerald-500/20 border-emerald-500"
                    )}
                  >
                    <span className="text-xs font-medium text-emerald-500">Low</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapNoise: 'medium' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapNoise === 'medium' && "bg-amber-500/20 border-amber-500"
                    )}
                  >
                    <span className="text-xs font-medium text-amber-500">Mid</span>
                  </div>
                  <div
                    onClick={() => setTempFilters(prev => ({ ...prev, umapNoise: 'high' }))}
                    className={cn(
                      "flex items-center justify-center gap-1 p-2 rounded border cursor-pointer transition-colors hover:bg-accent",
                      tempFilters.umapNoise === 'high' && "bg-red-500/20 border-red-500"
                    )}
                  >
                    <span className="text-xs font-medium text-red-500">High</span>
                  </div>
                </div>
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

