'use client';

import * as React from "react";
import {
    Check,
    Search,
    TrendingUp,
    Calendar as CalendarIcon,
    Filter,
    Images,
    X,
    BarChart3,
    Zap,
    Target,
    Star,
    RefreshCw,
    Sparkles,
    Brain,
    Activity,
    Building2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { FilterModal } from "./controllers/WatchlistSelector/FilterModal";
import { ImageCarousel } from "./ImageCarousel";
import { clusteringV2Service } from "@/app/services/clusteringService";
import type { ClusteringAnalysisResponse } from "@/types/clustering";

export interface Company {
    company_id?: number;
    company_code: string;
    name: string;
    exchange: string;
    refined?: boolean;
    marker?: string;
    total_valid_days?: number;
    avg_daily_high_low_range?: number;
    median_daily_volume?: number;
    pe_ratio?: number;
    N1_Pattern_count?: number;
}

// Desirability data for a company
export interface CompanyDesirabilityData {
    score: number;
    classification: string;
    reoccurrenceProbability: number;
}

// Sentiment type
export type SentimentType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

interface CompanyListProps {
    companies: Company[];
    selectedCompanyCode: string | null;
    onSelect: (companyCode: string) => void;
    loading?: boolean;

    // Date Props
    selectedWatchlistDate?: string | null;
    availableDates?: string[];
    onWatchlistDateChange?: (date: string) => void;

    // Chart Range Props
    onChartRangeChange?: (start: Date | undefined, end: Date | undefined) => void;
    onFetchChartData?: () => void;
    onFetchAllChartData?: () => void;

    // Filter Props
    availableExchanges?: string[];
    availableMarkers?: string[];
    totalCompanies?: number;
    
    // Show all companies filter (controlled by parent for useWatchlist integration)
    showAllCompanies?: boolean;
    onShowAllCompaniesChange?: (value: boolean) => void;

    // NEW: Desirability data map (company_code -> data)
    desirabilityMap?: Record<string, CompanyDesirabilityData>;

    // NEW: Sentiment map (company_code -> sentiment)
    sentimentMap?: Record<string, SentimentType>;

    // NEW: Selected company's detailed data (for display)
    selectedDesirability?: CompanyDesirabilityData | null;
    selectedSentiment?: SentimentType | null;
}

export const CompanyList = React.memo(function CompanyList({
    companies,
    selectedCompanyCode,
    onSelect,
    loading,
    selectedWatchlistDate,
    availableDates = [],
    onWatchlistDateChange,
    onChartRangeChange,
    onFetchChartData,
    onFetchAllChartData,
    availableExchanges = [],
    availableMarkers = [],
    totalCompanies = 0,
    showAllCompanies: externalShowAllCompanies = false,
    onShowAllCompaniesChange,
    desirabilityMap = {},
    sentimentMap = {},
}: CompanyListProps) {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [activeFilters, setActiveFilters] = React.useState<{
        exchanges: string[];
        markers: string[];
        refined: boolean | null;
        showAllCompanies: boolean;
        hasPrediction: boolean | null;
        hasGtt: boolean | null;
        sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null;
        desirability: 'high' | 'medium' | 'low' | null;
        hasUmapData: boolean | null;
        umapConfidence: 'high' | 'medium' | 'low' | null;
        umapNoise: 'low' | 'medium' | 'high' | null;
    }>({
        exchanges: [],
        markers: [],
        refined: null,
        showAllCompanies: externalShowAllCompanies,
        hasPrediction: null,
        hasGtt: null,
        sentiment: null,
        desirability: null,
        hasUmapData: null,
        umapConfidence: null,
        umapNoise: null,
    });
    
    // Sync external showAllCompanies prop with internal state
    React.useEffect(() => {
        setActiveFilters(prev => ({
            ...prev,
            showAllCompanies: externalShowAllCompanies
        }));
    }, [externalShowAllCompanies]);
    
    // Custom handler that propagates showAllCompanies changes to parent
    const handleFiltersChange = React.useCallback((newFilters: typeof activeFilters) => {
        setActiveFilters(newFilters);
        // Propagate showAllCompanies change to parent
        if (newFilters.showAllCompanies !== activeFilters.showAllCompanies) {
            onShowAllCompaniesChange?.(newFilters.showAllCompanies);
        }
    }, [activeFilters.showAllCompanies, onShowAllCompaniesChange]);

    const [isCarouselOpen, setIsCarouselOpen] = React.useState(false);

    // Prediction availability state
    const [regularPredictions, setRegularPredictions] = React.useState<Set<string>>(new Set());
    const [gttPredictions, setGttPredictions] = React.useState<Set<string>>(new Set());
    const [predictionsLoading, setPredictionsLoading] = React.useState(true);

    // Local state for batch-loaded desirability and sentiment
    const [localDesirabilityMap, setLocalDesirabilityMap] = React.useState<Record<string, CompanyDesirabilityData>>({});
    const [localSentimentMap, setLocalSentimentMap] = React.useState<Record<string, SentimentType>>({});
    const [batchDataLoading, setBatchDataLoading] = React.useState(false);
    const batchLoadedRef = React.useRef<Set<string>>(new Set());

    // UMAP Clustering data for filtering
    const [umapSymbolsSet, setUmapSymbolsSet] = React.useState<Set<string>>(new Set());
    const [umapAnalysisMap, setUmapAnalysisMap] = React.useState<Record<string, { confidence: number; noise: number; clusters: number }>>({});
    const [umapDataLoading, setUmapDataLoading] = React.useState(false);
    const umapLoadedRef = React.useRef(false);

    // Fetch prediction availability on mount
    React.useEffect(() => {
        const fetchPredictionAvailability = async () => {
            try {
                const response = await fetch('/api/predictions/availability');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Use todayOnly for brain icon - only show when predictions are for today
                        setRegularPredictions(new Set(data.regular?.todayOnly || []));
                        setGttPredictions(new Set(data.gtt?.available || []));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch prediction availability:', error);
            } finally {
                setPredictionsLoading(false);
            }
        };

        fetchPredictionAvailability();
        // Refresh every 5 minutes
        const interval = setInterval(fetchPredictionAvailability, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Batch fetch desirability and sentiment for ALL companies when companies list changes
    React.useEffect(() => {
        if (!companies || companies.length === 0) return;

        // Create a key for this batch of companies
        const companiesKey = companies.slice(0, 10).map(c => c.company_code).join(',');
        if (batchLoadedRef.current.has(companiesKey)) {
            console.log('📊 Batch data already loaded for this watchlist');
            return; // Already loaded for this set of companies
        }

        console.log(`📊 Starting batch fetch for ${companies.length} companies...`);

        const fetchBatchData = async () => {
            setBatchDataLoading(true);
            const symbols = companies.map(c => c.company_code);

            console.log(`📊 Fetching batch data for symbols:`, symbols.slice(0, 5), '...');

            try {
                // Fetch both in parallel
                const [desirabilityRes, sentimentRes] = await Promise.allSettled([
                    fetch('/api/batch/desirability', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbols })
                    }),
                    fetch('/api/batch/sentiment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbols })
                    })
                ]);

                console.log('📊 Batch fetch responses:', {
                    desirability: desirabilityRes.status,
                    sentiment: sentimentRes.status
                });

                // Process desirability results
                if (desirabilityRes.status === 'fulfilled' && desirabilityRes.value.ok) {
                    const data = await desirabilityRes.value.json();
                    console.log('📊 Desirability response:', data);
                    if (data.success && data.data) {
                        setLocalDesirabilityMap(data.data);
                        console.log(`✅ Loaded desirability for ${data.count || Object.keys(data.data).length} companies`);
                    }
                } else {
                    console.error('❌ Desirability fetch failed:', desirabilityRes);
                }

                // Process sentiment results
                if (sentimentRes.status === 'fulfilled' && sentimentRes.value.ok) {
                    const data = await sentimentRes.value.json();
                    console.log('📊 Sentiment response:', data);
                    if (data.success && data.data) {
                        setLocalSentimentMap(data.data);
                        console.log(`✅ Loaded sentiment for ${data.count || Object.keys(data.data).length} companies`);
                    }
                } else {
                    console.error('❌ Sentiment fetch failed:', sentimentRes);
                }

                batchLoadedRef.current.add(companiesKey);
            } catch (error) {
                console.error('❌ Failed to batch fetch company data:', error);
            } finally {
                setBatchDataLoading(false);
            }
        };

        // Delay slightly to ensure component is mounted
        const timer = setTimeout(fetchBatchData, 500);
        return () => clearTimeout(timer);
    }, [companies]);

    // Batch fetch UMAP clustering symbols + analysis for all companies
    React.useEffect(() => {
        if (!companies || companies.length === 0 || umapLoadedRef.current) return;

        const fetchUmapData = async () => {
            setUmapDataLoading(true);
            try {
                // Step 1: Get all symbols that have clustering data
                const symbolsResponse = await clusteringV2Service.getSymbols();
                const availableSymbols = new Set(symbolsResponse.symbols || []);
                setUmapSymbolsSet(availableSymbols);

                // Step 2: Find which companies have UMAP data
                const companySymbols = companies
                    .map(c => c.company_code)
                    .filter(code => availableSymbols.has(code));

                console.log(`🔬 UMAP: ${companySymbols.length} of ${companies.length} companies have clustering data`);

                // Step 3: Batch fetch analysis for matching companies (max 30 in parallel)
                const BATCH_SIZE = 15;
                const analysisResults: Record<string, { confidence: number; noise: number; clusters: number }> = {};

                for (let i = 0; i < companySymbols.length; i += BATCH_SIZE) {
                    const batch = companySymbols.slice(i, i + BATCH_SIZE);
                    const results = await Promise.allSettled(
                        batch.map(sym => clusteringV2Service.getAnalysis(sym, 7))
                    );

                    results.forEach((result, idx) => {
                        if (result.status === 'fulfilled' && result.value) {
                            const a = result.value;
                            analysisResults[batch[idx]] = {
                                confidence: a.confidence_consistency?.overall_confidence ?? 0,
                                noise: a.noise?.total_noise_fraction ?? 0,
                                clusters: a.active_clusters?.count ?? 0,
                            };
                        }
                    });
                }

                setUmapAnalysisMap(analysisResults);
                umapLoadedRef.current = true;
                console.log(`✅ UMAP: Loaded analysis for ${Object.keys(analysisResults).length} companies`);
            } catch (error) {
                console.error('❌ Failed to fetch UMAP data:', error);
            } finally {
                setUmapDataLoading(false);
            }
        };

        // Delay to not block initial render
        const timer = setTimeout(fetchUmapData, 1500);
        return () => clearTimeout(timer);
    }, [companies]);

    // ─── Sector map: fetch once on mount (static data, never changes per session) ─
    const [sectorMap, setSectorMap] = React.useState<Record<string, string>>({});
    const sectorLoadedRef = React.useRef(false);

    React.useEffect(() => {
        if (sectorLoadedRef.current) return;
        sectorLoadedRef.current = true;
        fetch('/api/watchlist/sectors', { cache: 'force-cache' })
            .then(r => r.ok ? r.json() : {})
            .then((data: Record<string, string>) => {
                setSectorMap(data);
            })
            .catch(() => { /* silently ignore — sector tag simply won't show */ });
    }, []);

    // Merge parent-provided maps with locally fetched maps
    const mergedDesirabilityMap = React.useMemo(() => ({
        ...localDesirabilityMap,
        ...desirabilityMap // Parent props take priority
    }), [localDesirabilityMap, desirabilityMap]);

    const mergedSentimentMap = React.useMemo(() => ({
        ...localSentimentMap,
        ...sentimentMap // Parent props take priority
    }), [localSentimentMap, sentimentMap]);

    // Calendar State for Chart Range
    const [chartStartDate, setChartStartDate] = React.useState<Date | undefined>(undefined);
    const [chartEndDate, setChartEndDate] = React.useState<Date | undefined>(undefined);

    const handleChartStartChange = (date: Date | undefined) => {
        setChartStartDate(date);
        if (date && chartEndDate && date > chartEndDate) {
            setChartEndDate(undefined);
            onChartRangeChange?.(date, undefined);
        } else {
            onChartRangeChange?.(date, chartEndDate);
        }
    };

    const handleChartEndChange = (date: Date | undefined) => {
        setChartEndDate(date);
        onChartRangeChange?.(chartStartDate, date);
    };

    // Helper: Get sentiment background color
    const getSentimentBgColor = (sentiment: SentimentType | undefined) => {
        switch (sentiment) {
            case 'BULLISH': return 'rgba(34, 197, 94, 0.08)'; // green tint
            case 'BEARISH': return 'rgba(239, 68, 68, 0.08)'; // red tint
            default: return 'transparent';
        }
    };

    // Helper: Get sentiment border color
    const getSentimentBorderColor = (sentiment: SentimentType | undefined) => {
        switch (sentiment) {
            case 'BULLISH': return 'rgba(34, 197, 94, 0.3)';
            case 'BEARISH': return 'rgba(239, 68, 68, 0.3)';
            default: return 'transparent';
        }
    };

    // Helper: Get desirability color
    const getDesirabilityColor = (score: number | undefined) => {
        if (!score) return { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: 'N/A' };
        if (score >= 0.7) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'High' };
        if (score >= 0.5) return { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Medium' };
        if (score >= 0.3) return { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Low' };
        return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Poor' };
    };

    // Helper: Check if symbol has prediction available
    const hasRegularPrediction = (symbol: string) => {
        const cleanSymbol = symbol.split('-')[0]; // Remove -NSE/-BSE
        return regularPredictions.has(cleanSymbol) || regularPredictions.has(symbol);
    };

    const hasGttPrediction = (symbol: string) => {
        const cleanSymbol = symbol.split('-')[0];
        return gttPredictions.has(cleanSymbol) || gttPredictions.has(symbol);
    };

    // Filter Logic
    const filteredCompanies = React.useMemo(() => {
        let result = companies;

        // 1. Client-Side Filters (Exchange/Marker/Refined) - Copied logic from WatchlistSelector
        if (!activeFilters.showAllCompanies) {
            if (activeFilters.exchanges.length > 0) {
                result = result.filter(c => activeFilters.exchanges.includes(c.exchange));
            }
            if (activeFilters.markers.length > 0) {
                result = result.filter(c => c.marker && activeFilters.markers.includes(c.marker));
            }
            if (activeFilters.refined !== null) {
                result = result.filter(c => {
                    const isRefined = c.refined === true;
                    return activeFilters.refined ? isRefined : !isRefined;
                });
            }
        }

        // 2. Prediction Filters (always active regardless of showAllCompanies)
        if (activeFilters.hasPrediction !== null) {
            result = result.filter(c => {
                const hasPred = hasRegularPrediction(c.company_code);
                return activeFilters.hasPrediction ? hasPred : !hasPred;
            });
        }

        if (activeFilters.hasGtt !== null) {
            result = result.filter(c => {
                const hasGtt = hasGttPrediction(c.company_code);
                return activeFilters.hasGtt ? hasGtt : !hasGtt;
            });
        }

        // 3. Sentiment Filter
        if (activeFilters.sentiment !== null) {
            result = result.filter(c => {
                const sentiment = mergedSentimentMap[c.company_code];
                return sentiment === activeFilters.sentiment;
            });
        }

        // 4. Desirability Filter
        if (activeFilters.desirability !== null) {
            result = result.filter(c => {
                const data = mergedDesirabilityMap[c.company_code];
                if (!data) return false;
                const score = data.score;
                switch (activeFilters.desirability) {
                    case 'high': return score >= 0.7;
                    case 'medium': return score >= 0.5 && score < 0.7;
                    case 'low': return score >= 0.3 && score < 0.5;
                    default: return true;
                }
            });
        }

        // 5. UMAP Clustering Filters
        if (activeFilters.hasUmapData !== null) {
            result = result.filter(c => {
                const hasData = umapSymbolsSet.has(c.company_code);
                return activeFilters.hasUmapData ? hasData : !hasData;
            });
        }
        if (activeFilters.umapConfidence !== null) {
            result = result.filter(c => {
                const umap = umapAnalysisMap[c.company_code];
                if (!umap) return false;
                const conf = umap.confidence;
                switch (activeFilters.umapConfidence) {
                    case 'high': return conf >= 0.7;
                    case 'medium': return conf >= 0.4 && conf < 0.7;
                    case 'low': return conf < 0.4;
                    default: return true;
                }
            });
        }
        if (activeFilters.umapNoise !== null) {
            result = result.filter(c => {
                const umap = umapAnalysisMap[c.company_code];
                if (!umap) return false;
                const noise = umap.noise;
                switch (activeFilters.umapNoise) {
                    case 'low': return noise < 0.15;
                    case 'medium': return noise >= 0.15 && noise < 0.35;
                    case 'high': return noise >= 0.35;
                    default: return true;
                }
            });
        }

        // 6. Search Term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter(company => {
                const marker = company.marker ?? "";
                return (
                    (company.company_code && company.company_code.toLowerCase().includes(searchLower)) ||
                    (company.name && company.name.toLowerCase().includes(searchLower)) ||
                    (company.exchange && company.exchange.toLowerCase().includes(searchLower)) ||
                    marker.toLowerCase().includes(searchLower)
                );
            });
        }
        return result;
    }, [companies, searchTerm, activeFilters, regularPredictions, gttPredictions, mergedSentimentMap, mergedDesirabilityMap, umapSymbolsSet, umapAnalysisMap]);

    // Selected company object for ImageCarousel
    const selectedCompanyObj = React.useMemo(() =>
        companies.find(c => c.company_code === selectedCompanyCode),
        [companies, selectedCompanyCode]);


    const activeFilterCount = React.useMemo(() => {
        let count = 0;
        if (activeFilters.showAllCompanies) count++;
        if (!activeFilters.showAllCompanies) {
            count += activeFilters.exchanges.length + activeFilters.markers.length + (activeFilters.refined !== null ? 1 : 0);
        }
        if (activeFilters.hasPrediction !== null) count++;
        if (activeFilters.hasGtt !== null) count++;
        if (activeFilters.sentiment !== null) count++;
        if (activeFilters.desirability !== null) count++;
        if (activeFilters.hasUmapData !== null) count++;
        if (activeFilters.umapConfidence !== null) count++;
        if (activeFilters.umapNoise !== null) count++;
        return count;
    }, [activeFilters]);

    // Convert available dates strings to Date objects for Calendar
    const availableDateObjects = React.useMemo(() =>
        availableDates.map(d => new Date(d)),
        [availableDates]
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground h-full border-l">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p className="text-sm">Loading watchlist...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-background border-l">
            {/* TOOLBAR HEADER */}
            <div className="p-2 border-b flex items-center justify-between gap-2 bg-muted/10">

                <div className="flex items-center gap-1">
                    {/* DATE & RANGE PICKER */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Date Settings">
                                <CalendarIcon size={16} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                            <div className="p-3 space-y-4">
                                {/* Watchlist Date */}
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                        <CalendarIcon size={14} className="text-primary" />
                                        Watchlist Date
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Select date to filter available companies</p>
                                    <div className="border rounded-md p-2 flex justify-center">
                                        <Calendar
                                            mode="single"
                                            selected={selectedWatchlistDate ? new Date(selectedWatchlistDate) : undefined}
                                            onSelect={(date) => date && onWatchlistDateChange?.(format(date, 'yyyy-MM-dd'))}
                                            disabled={(date) =>
                                                !availableDateObjects.some(d => d.toDateString() === date.toDateString())
                                            }
                                            initialFocus
                                        />
                                    </div>
                                </div>

                                <Separator />

                                {/* Chart Data Range */}
                                <div className="space-y-2">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                        <BarChart3 size={14} className="text-primary" />
                                        Chart Data Window
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Start</label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs px-2", !chartStartDate && "text-muted-foreground")}>
                                                        {chartStartDate ? format(chartStartDate, "MMM dd, yyyy") : "Pick start"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={chartStartDate} onSelect={handleChartStartChange} disabled={(d) => d > new Date()} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground">End</label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs px-2", !chartEndDate && "text-muted-foreground")}>
                                                        {chartEndDate ? format(chartEndDate, "MMM dd, yyyy") : "Pick end"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={chartEndDate} onSelect={handleChartEndChange} disabled={(d) => d > new Date() || (chartStartDate ? d < chartStartDate : false)} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={onFetchChartData} disabled={!selectedCompanyCode || !chartStartDate}>
                                            <Search className="mr-1 h-3 w-3" /> Fetch
                                        </Button>
                                        <Button size="sm" variant="secondary" className="flex-1 h-7 text-xs" onClick={onFetchAllChartData} disabled={!selectedCompanyCode}>
                                            Fetch All
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* FILTERS */}
                    <Button
                        variant={activeFilterCount > 0 ? "secondary" : "ghost"}
                        size="icon"
                        className="h-8 w-8 relative"
                        onClick={() => setIsFilterOpen(true)}
                        title="Filter Companies"
                    >
                        <Filter size={16} />
                        {activeFilterCount > 0 && (
                            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                        )}
                    </Button>

                    {/* IMAGES */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsCarouselOpen(true)}
                        disabled={!selectedCompanyCode}
                        title="View Graphs"
                    >
                        <Images size={16} />
                    </Button>

                    {/* Loading indicator for batch data */}
                    {batchDataLoading && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                        </div>
                    )}
                </div>

                {/* ACTIVE DATE DISPLAY (Small) */}
                <div className="text-xs text-muted-foreground font-medium border px-2 py-1 rounded bg-muted/50">
                    {selectedWatchlistDate ? format(new Date(selectedWatchlistDate), "MMM dd") : "All Dates"}
                </div>

            </div>

            <div className="p-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search symbol..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto" suppressHydrationWarning>
                {filteredCompanies.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        {searchTerm ? 'No matches found' : 'No companies available'}
                    </div>
                ) : (
                    <div className="flex flex-col" suppressHydrationWarning>
                        {filteredCompanies.map((company, index) => {
                            const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                            const isSelected = selectedCompanyCode === company.company_code;
                            
                            // Get desirability and sentiment data for this company (use merged maps)
                            const companyDesirability = mergedDesirabilityMap[company.company_code];
                            const companySentiment = mergedSentimentMap[company.company_code];
                            const desirabilityStyle = getDesirabilityColor(companyDesirability?.score);
                            const companySector = sectorMap[company.company_code] ?? null;

                            // Check prediction availability
                            const hasPrediction = hasRegularPrediction(company.company_code);
                            const hasGtt = hasGttPrediction(company.company_code);

                            return (
                                <TooltipProvider key={uniqueKey} delayDuration={300}>
                                    <div
                                        onClick={() => onSelect(company.company_code)}
                                        className={cn(
                                            "flex flex-col gap-1.5 p-2.5 cursor-pointer hover:bg-accent/50 transition-all duration-200 border-b border-border/50 relative",
                                            isSelected && "border-l-4 border-l-primary pl-[6px]"
                                        )}
                                        style={{
                                            backgroundColor: isSelected 
                                                ? undefined 
                                                : getSentimentBgColor(companySentiment),
                                            borderRightColor: getSentimentBorderColor(companySentiment),
                                            borderRightWidth: companySentiment && companySentiment !== 'NEUTRAL' ? '2px' : '0px'
                                        }}
                                    >
                                        {/* Row 1: Symbol + Exchange + Refined Badge */}
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                                                    {company.company_code}
                                                </span>
                                                {company.exchange && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                                        {company.exchange}
                                                    </span>
                                                )}
                                                {company.refined && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                            Refined List
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                            
                                            {/* Prediction Availability Badges */}
                                            <div className="flex items-center gap-1">
                                                {hasPrediction && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-blue-500/20">
                                                                <Brain className="h-2.5 w-2.5 text-blue-400" />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                            Regular Prediction Available
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {hasGtt && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-purple-500/20">
                                                                <Zap className="h-2.5 w-2.5 text-purple-400" />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                            GTT Prediction Available
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {company.N1_Pattern_count !== undefined && company.N1_Pattern_count > 0 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center gap-0.5 text-[10px] text-green-500 font-medium">
                                                                <TrendingUp className="h-2.5 w-2.5" />
                                                                {company.N1_Pattern_count}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                            N1 Pattern Count
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>

                                        {/* Row 2: Company Name (truncated) */}
                                        <div className="text-[11px] text-muted-foreground truncate w-full">
                                            {company.name}
                                        </div>

                                        {/* Row 3: Tags Row - Desirability + Recurrence + Sentiment */}
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                            {/* Desirability Score Badge */}
                                            {companyDesirability && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className={cn(
                                                            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
                                                            desirabilityStyle.bg, desirabilityStyle.text
                                                        )}>
                                                            <Target className="h-2.5 w-2.5" />
                                                            {(companyDesirability.score * 100).toFixed(0)}%
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-xs">
                                                        Desirability: {desirabilityStyle.label} ({companyDesirability.classification})
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            
                                            {/* Recurrence Probability Badge */}
                                            {companyDesirability?.reoccurrenceProbability !== undefined && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/20 text-cyan-400">
                                                            <RefreshCw className="h-2.5 w-2.5" />
                                                            {(companyDesirability.reoccurrenceProbability * 100).toFixed(0)}%
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-xs">
                                                        Recurrence Probability
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                            
                                            {/* Sentiment Badge */}
                                            {companySentiment && companySentiment !== 'NEUTRAL' && (
                                                <div className={cn(
                                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
                                                    companySentiment === 'BULLISH' 
                                                        ? "bg-green-500/20 text-green-400" 
                                                        : "bg-red-500/20 text-red-400"
                                                )}>
                                                    <Activity className="h-2.5 w-2.5" />
                                                    {companySentiment}
                                                </div>
                                            )}
                                            
                                            {/* Marker Badge */}
                                            {company.marker && (
                                                <div className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-500/20 text-zinc-400">
                                                    {company.marker}
                                                </div>
                                            )}

                                            {/* Sector Badge */}
                                            {companySector && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-500/15 text-violet-300">
                                                            <Building2 className="h-2.5 w-2.5" />
                                                            {companySector}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="text-xs">
                                                        Sector: {companySector}
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>

                                        {/* Row 4: Stats Row */}
                                        <div className="flex gap-2 text-[9px] text-muted-foreground/70 mt-0.5">
                                            {company.total_valid_days !== undefined && (
                                                <span>{company.total_valid_days}d</span>
                                            )}
                                            {company.median_daily_volume !== undefined && (
                                                <span>Vol: {(company.median_daily_volume / 1000).toFixed(0)}K</span>
                                            )}
                                            {company.avg_daily_high_low_range !== undefined && (
                                                <span>Range: {company.avg_daily_high_low_range.toFixed(1)}%</span>
                                            )}
                                        </div>
                                    </div>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* MODALS */}
            <FilterModal
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                filterOptions={{ exchanges: availableExchanges, markers: availableMarkers }}
                activeFilters={activeFilters}
                onFiltersChange={handleFiltersChange}
                totalCompanies={totalCompanies}
                filteredCount={filteredCompanies.length}
            />

            {selectedCompanyObj && (
                <ImageCarousel
                    isOpen={isCarouselOpen}
                    onClose={() => setIsCarouselOpen(false)}
                    companyCode={selectedCompanyObj.company_code}
                    exchange={selectedCompanyObj.exchange}
                    selectedDate={selectedWatchlistDate || undefined}
                />
            )}
        </div>
    );
});
