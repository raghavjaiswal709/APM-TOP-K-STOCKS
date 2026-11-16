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
    CheckSquare,
    Square,
    LayoutGrid,
    ExternalLink,
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
import { useFlipAnimation, useSurgeWatchlist } from "@/hooks/useSurge";
import { formatPrice, formatSignedPct, parseSearchTerms } from "@/lib/surge/filters";
import {
    AddSymbolButton,
    AdditionsHeader,
    PinButton,
    RankBadge,
    RemoveButton,
    SurgeStatusLine,
    SurgeToggleButton,
    TargetBadge,
    WatchlistFilterChips,
    WatchlistFilterPopover,
} from "./surge/SurgeControls";
// OLD (Surge as an opt-in overlay): SurgeFilterChips, SurgeFilterPopover, SurgeViewSwitch
import { SurgeNoMatches, SurgeSections } from "./surge/SurgeSections";

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
    // NEW (Surge watchlist — see hooks/useWatchlist.ts)
    /** Surge screener rank. */
    rank?: number;
    target_move_pct?: number | null;
    watchlist_source?: 'surge' | 'manual';
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

    // Multi-select mode
    multiSelectMode?: boolean;
    onMultiAction?: (action: 'multi-chart' | 'new-tabs' | 'historical' | 'subscribe', codes: string[]) => void;
    /** When true: multi-select is always active (no toggle), action panel shows Subscribe/Clear */
    subscribeMode?: boolean;
    /** When true: adds a Subscribe button to the non-subscribeMode multi-action panel */
    showSubscribeButton?: boolean;
    /**
     * Pre-select these codes the FIRST TIME this prop is non-empty.
     * Used in live-market to show URL-subscribed companies as checked on load.
     */
    initialSelectedCodes?: string[];
    /** Set of company codes that have cluster (PatternPool) data available */
    clusterSymbols?: Set<string>;
    hideDateSelector?: boolean;
}

/** Small curve SVG icon indicating PatternPool cluster data is available */
const CurveIcon = () => (
    <svg width="13" height="9" viewBox="0 0 13 9" fill="none" aria-hidden="true">
        <path d="M1 7.5 C2.5 7.5, 3.5 1.5, 6.5 1.5 C9.5 1.5, 10.5 5.5, 12 5.5"
            stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
);

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
    multiSelectMode = false,
    onMultiAction,
    subscribeMode = false,
    showSubscribeButton = false,
    initialSelectedCodes,
    clusterSymbols,
    hideDateSelector = false,
}: CompanyListProps) {
    const [searchTerm, setSearchTerm] = React.useState("");
    // The Surge watchlist view (pins, surging today, filters, target floor,
    // additions) — shared across every watchlist. The Surge screen IS the
    // list now, so the view is always on; "Surging on top" is its toggle.
    const surgeSearchTerms = React.useMemo(() => parseSearchTerms(searchTerm), [searchTerm]);
    // Live prices for the list's own rows too, as in the dashboard — skipped
    // for the 2000+ name "all companies" list.
    const surgeRowCodes = React.useMemo(
        () => (companies.length <= 400 ? companies.map(c => c.company_code) : []),
        [companies]
    );
    const surge = useSurgeWatchlist(surgeSearchTerms, { date: selectedWatchlistDate, rowCodes: surgeRowCodes });
    const surgeOn = true;
    // OLD: const surgeOn = surge.enabled; // opt-in overlay, off by default
    const surgeListRef = React.useRef<HTMLDivElement>(null);
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

    // Multi-select state — always active when subscribeMode is on
    const [isMultiSelectActive, setIsMultiSelectActive] = React.useState(subscribeMode);
    const [multiSelectedCodes, setMultiSelectedCodes] = React.useState<Set<string>>(new Set());

    const toggleMultiSelect = React.useCallback((code: string) => {
        setMultiSelectedCodes(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    }, []);

    const handleMultiAction = React.useCallback((action: 'multi-chart' | 'new-tabs' | 'historical' | 'subscribe') => {
        if (multiSelectedCodes.size === 0) return;
        onMultiAction?.(action, Array.from(multiSelectedCodes));
    }, [multiSelectedCodes, onMultiAction]);

    // Pre-select provided codes ONCE — used to show URL-companies as checked on live-market load
    const hasInitializedSelectionRef = React.useRef(false);
    React.useEffect(() => {
        if (hasInitializedSelectionRef.current) return;
        if (!initialSelectedCodes?.length) return;
        hasInitializedSelectionRef.current = true;
        setMultiSelectedCodes(new Set(initialSelectedCodes));
    }, [initialSelectedCodes]);

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
                // Downgrade to a single warn — the UMAP sidebar enrichment is
                // strictly optional and a backend outage shouldn't escalate to
                // a red console.error / Next.js error overlay every render.
                const status = (error as any)?.status;
                const detail = (error as any)?.message ?? String(error);
                console.warn(`⚠️ UMAP sidebar enrichment unavailable (${status ?? 'network'}): ${detail}`);
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

        // GTT disabled: GTT prediction filter commented out
        /*
        if (activeFilters.hasGtt !== null) {
            result = result.filter(c => {
                const hasGtt = hasGttPrediction(c.company_code);
                return activeFilters.hasGtt ? hasGtt : !hasGtt;
            });
        }
        */

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
        if (searchTerm && surgeOn) {
            // Surge view: comma/space separated names, any one matching (as in
            // the trading dashboard), so "RELIANCE, TCS" finds both.
            result = result.filter(company => {
                const code = company.company_code?.toUpperCase() ?? "";
                const name = company.name?.toUpperCase() ?? "";
                return surgeSearchTerms.some(term => code.includes(term) || name.includes(term));
            });
        } else if (searchTerm) {
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
    }, [companies, searchTerm, surgeOn, surgeSearchTerms, activeFilters, regularPredictions, gttPredictions, mergedSentimentMap, mergedDesirabilityMap, umapSymbolsSet, umapAnalysisMap]);

    // Surge on: the watchlist's own rows minus what the Pinned / Surging
    // blocks already show; with a surge filter set, only names that surged.
    const restCompanies = React.useMemo(() => {
        if (!surgeOn) return filteredCompanies;
        return filteredCompanies.filter(c => {
            const code = c.company_code?.toUpperCase();
            return !surge.surgingSet.has(code) && !surge.pinnedSet.has(code) && surge.passesFilters(code);
            // OLD: ... && (!surge.filtersActive || surge.surgeByCode.has(code));
        });
    }, [surgeOn, filteredCompanies, surge.surgingSet, surge.pinnedSet, surge.passesFilters]);

    // The screened list, then "My additions" — as in the dashboard.
    const restScreened = React.useMemo(() => restCompanies.filter(c => c.watchlist_source !== 'manual'), [restCompanies]);
    const restManual = React.useMemo(() => restCompanies.filter(c => c.watchlist_source === 'manual'), [restCompanies]);
    const restRows = React.useMemo(() => [...restScreened, ...restManual], [restScreened, restManual]);

    const companyNameByCode = React.useMemo(
        () => new Map(companies.map(c => [c.company_code?.toUpperCase(), c.name] as [string, string])),
        [companies]
    );

    const surgeVisibleCount = surgeOn
        ? surge.pinnedCodes.length + surge.surgeOrder.length + restCompanies.length
        : filteredCompanies.length;

    useFlipAnimation(
        surgeListRef,
        surgeOn
            ? [...surge.pinnedCodes, '|', ...surge.surgeOrder, '|', ...restScreened.map(c => c.company_code), '|', ...restManual.map(c => c.company_code)].join(',')
            : '',
        surgeOn
    );

    const handleSurgeRowSelect = React.useCallback((code: string) => {
        if (isMultiSelectActive) toggleMultiSelect(code);
        else onSelect(code);
    }, [isMultiSelectActive, onSelect, toggleMultiSelect]);

    // Everything on screen: pinned, surging, then the rest.
    const visibleCodes = React.useMemo(
        () => [...surge.pinnedCodes, ...surge.surgeOrder, ...restRows.map(c => c.company_code)],
        [surge.pinnedCodes, surge.surgeOrder, restRows]
    );

    const selectAllFiltered = React.useCallback(() => {
        setMultiSelectedCodes(new Set(visibleCodes));
        // OLD: setMultiSelectedCodes(new Set(filteredCompanies.map(c => c.company_code)));
    }, [visibleCodes]);

    const deselectAll = React.useCallback(() => {
        setMultiSelectedCodes(new Set());
    }, []);

    const allFilteredSelected = React.useMemo(() =>
        visibleCodes.length > 0 && visibleCodes.every(code => multiSelectedCodes.has(code)),
        [visibleCodes, multiSelectedCodes]
    );

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
        // if (activeFilters.hasGtt !== null) count++; // GTT disabled
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
                    {!hideDateSelector && (
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
                    )}

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

                    {/* SURGE WATCHLIST: surging on top, filters (surge + target floor), add symbol */}
                    <SurgeToggleButton
                        size="icon"
                        enabled={surge.surgingOnTop}
                        onChange={surge.setSurgingOnTop}
                        count={surge.showSurging ? surge.surgeByCode.size : undefined}
                    />
                    <WatchlistFilterPopover view={surge} triggerClassName="border-0" />
                    <AddSymbolButton />
                    {/* OLD (opt-in overlay):
                    <SurgeToggleButton size="icon" enabled={surgeOn} onChange={surge.setEnabled} count={surge.surgeByCode.size} />
                    {surgeOn && (
                        <SurgeFilterPopover state={surge.filterState} title="Filter surges in this watchlist" triggerClassName="border-0">
                            <SurgeViewSwitch enabled={surgeOn} onChange={surge.setEnabled} />
                        </SurgeFilterPopover>
                    )} */}

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

                    {/* Multi-select toggle — shown when multiSelectMode is on but NOT in subscribeMode (always active) */}
                    {multiSelectMode && !subscribeMode && (
                        <Button
                            variant={isMultiSelectActive ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                                setIsMultiSelectActive(prev => !prev);
                                setMultiSelectedCodes(new Set());
                            }}
                            title={isMultiSelectActive ? "Exit multi-select" : "Select multiple companies"}
                        >
                            {isMultiSelectActive ? <CheckSquare size={16} /> : <Square size={16} />}
                        </Button>
                    )}

                    {/* Select All / Deselect All — shown when multi-select is active */}
                    {(isMultiSelectActive || subscribeMode) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-[10px] font-medium"
                            onClick={allFilteredSelected ? deselectAll : selectAllFiltered}
                            title={allFilteredSelected ? "Deselect all" : `Select all ${visibleCodes.length} companies`}
                        >
                            {allFilteredSelected ? (
                                <><CheckSquare size={12} className="mr-1" />Deselect All</>
                            ) : (
                                <><Square size={12} className="mr-1" />Select All ({visibleCodes.length})</>
                            )}
                        </Button>
                    )}

                    {/* Loading indicator for batch data */}
                    {batchDataLoading && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                        </div>
                    )}
                </div>

                {/* ACTIVE DATE DISPLAY (Small) */}
                {!hideDateSelector && (
                <div className="text-xs text-muted-foreground font-medium border px-2 py-1 rounded bg-muted/50">
                    {selectedWatchlistDate ? format(new Date(selectedWatchlistDate), "MMM dd") : "All Dates"}
                </div>
                )}

            </div>

            <div className="p-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={surgeOn ? "Search symbols… (RELIANCE, TCS)" : "Search symbol..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                    />
                </div>
            </div>

            <WatchlistFilterChips view={surge} className="px-2 py-1.5 border-b" />
            <SurgeStatusLine view={surge} />

            <div
                ref={surgeListRef}
                className="flex-1 overflow-y-auto relative"
                suppressHydrationWarning
                {...(surgeOn ? surge.listHandlers : {})}
            >
                {surge.loading && surgeVisibleCount === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Loading Surge watchlist…</div>
                ) : surgeVisibleCount === 0 && (searchTerm || surge.filtersActive || surge.targetFloorActive) ? (
                    <SurgeNoMatches view={surge} onClearSearch={() => setSearchTerm("")} />
                ) : surgeVisibleCount === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        {searchTerm ? 'No matches found' : 'No companies available'}
                    </div>
                ) : (
                    /* One TooltipProvider wraps the whole list — previously every row mounted
                       its own provider, which is hundreds of redundant providers on large
                       watchlists. The per-row Tooltips share this single provider. */
                    <TooltipProvider delayDuration={300}>
                    <div className="flex flex-col" suppressHydrationWarning>
                        {surgeOn && (
                            <SurgeSections
                                view={surge}
                                activeCode={isMultiSelectActive ? null : selectedCompanyCode?.toUpperCase() ?? null}
                                onSelect={handleSurgeRowSelect}
                                nameByCode={companyNameByCode}
                                isChecked={isMultiSelectActive ? (code) => multiSelectedCodes.has(code) : undefined}
                                restLabel="Screened"
                                restCount={restScreened.length}
                            />
                        )}
                        {restRows.map((company, index) => {
                            const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                            const isSelected = selectedCompanyCode === company.company_code;
                            
                            // Get desirability and sentiment data for this company (use merged maps)
                            const companyDesirability = mergedDesirabilityMap[company.company_code];
                            const companySentiment = mergedSentimentMap[company.company_code];
                            const desirabilityStyle = getDesirabilityColor(companyDesirability?.score);
                            const companySector = sectorMap[company.company_code] ?? null;

                            // Check prediction availability
                            const hasPrediction = hasRegularPrediction(company.company_code);
                            // const hasGtt = hasGttPrediction(company.company_code); // GTT disabled

                            const isMultiChecked = multiSelectedCodes.has(company.company_code);
                            const companyCodeKey = company.company_code?.toUpperCase();
                            const isManual = company.watchlist_source === 'manual';
                            const quote = surge.quotes[companyCodeKey];

                            return (
                                <React.Fragment key={uniqueKey}>
                                    {index === restScreened.length && restManual.length > 0 &&
                                        (restScreened.length > 0 || surge.pinnedCodes.length > 0 || surge.surgeOrder.length > 0) && (
                                        <AdditionsHeader count={restManual.length} />
                                    )}
                                    <div
                                        data-flip-key={surgeOn ? `row-${company.company_code}` : undefined}
                                        onClick={() => {
                                            if (isMultiSelectActive) {
                                                toggleMultiSelect(company.company_code);
                                            } else {
                                                onSelect(company.company_code);
                                            }
                                        }}
                                        className={cn(
                                            "group flex flex-col gap-1.5 p-2.5 cursor-pointer hover:bg-accent/50 transition-all duration-200 border-b border-border/50 relative",
                                            isSelected && !isMultiSelectActive && "border-l-4 border-l-primary pl-[6px]",
                                            isMultiSelectActive && "pl-8",
                                            isMultiSelectActive && isMultiChecked && "bg-primary/5"
                                        )}
                                        style={{
                                            backgroundColor: isSelected && !isMultiSelectActive
                                                ? undefined
                                                : getSentimentBgColor(companySentiment),
                                            borderRightColor: getSentimentBorderColor(companySentiment),
                                            borderRightWidth: companySentiment && companySentiment !== 'NEUTRAL' ? '2px' : '0px'
                                        }}
                                    >
                                        {/* Multi-select checkbox overlay */}
                                        {isMultiSelectActive && (
                                            <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                                                onClick={(e) => { e.stopPropagation(); toggleMultiSelect(company.company_code); }}
                                            >
                                                <div className={cn(
                                                    "w-3.5 h-3.5 rounded border-2 flex items-center justify-center",
                                                    isMultiChecked ? "bg-primary border-primary" : "border-muted-foreground/50 bg-background"
                                                )}>
                                                    {isMultiChecked && <Check className="h-2 w-2 text-primary-foreground" />}
                                                </div>
                                            </div>
                                        )}

                                        {/* Row 1: Symbol + Exchange + Refined Badge */}
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <RankBadge rank={company.rank} />
                                                <span className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                                                    {company.company_code}
                                                </span>
                                                <TargetBadge value={surge.targetOf(companyCodeKey) ?? company.target_move_pct ?? null} />
                                                <PinButton
                                                    pinned={surge.pinnedSet.has(companyCodeKey)}
                                                    code={companyCodeKey}
                                                    onToggle={() => surge.togglePin(companyCodeKey)}
                                                />
                                                {isManual && (
                                                    <RemoveButton code={companyCodeKey} onRemove={() => surge.removeAddition(companyCodeKey)} />
                                                )}
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
                                                {/* GTT disabled — GTT badge commented out
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
                                                */}
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
                                                {clusterSymbols?.has(company.company_code) && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="flex items-center justify-center w-4 h-4 rounded bg-violet-500/20">
                                                                <CurveIcon />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">
                                                            Cluster Pattern Available
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {/* Live LTP (Surge watchlist) */}
                                                <span className="font-mono text-xs tabular-nums ml-1">
                                                    {quote ? formatPrice(quote.ltp) : '—'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Row 2: Company Name (truncated) + live day change */}
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <div className="text-[11px] text-muted-foreground truncate min-w-0">
                                                {company.name}
                                            </div>
                                            <span className={cn(
                                                "font-mono text-[10px] tabular-nums shrink-0",
                                                !quote ? "text-muted-foreground/50" : quote.changePercent >= 0 ? "text-green-500" : "text-red-500"
                                            )}>
                                                {quote ? formatSignedPct(quote.changePercent) : '—'}
                                            </span>
                                        </div>
                                        {/* OLD Row 2:
                                        <div className="text-[11px] text-muted-foreground truncate w-full">
                                            {company.name}
                                        </div> */}

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
                                </React.Fragment>
                            );
                        })}
                    </div>
                    </TooltipProvider>
                )}
            </div>

            {/* MULTI-SELECT ACTION PANEL */}
            {isMultiSelectActive && multiSelectedCodes.size > 0 && (
                <div className="border-t bg-muted/20 p-2 flex flex-col gap-1.5 shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            {multiSelectedCodes.size} selected
                        </span>
                        <button
                            onClick={() => setMultiSelectedCodes(new Set())}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear
                        </button>
                    </div>

                    {subscribeMode ? (
                        /* Subscribe mode: shown in live-market sidebar */
                        <>
                            <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs w-full"
                                onClick={() => handleMultiAction('subscribe')}
                            >
                                <Check className="h-3 w-3 mr-1.5" />
                                Subscribe ({multiSelectedCodes.size})
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs w-full"
                                onClick={() => setMultiSelectedCodes(new Set())}
                            >
                                <X className="h-3 w-3 mr-1.5" />
                                Clear Selection
                            </Button>
                        </>
                    ) : (
                        /* Multi-action mode: shown in cluster-overlay / market-data sidebar */
                        <>
                            {showSubscribeButton && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 text-xs w-full"
                                    onClick={() => handleMultiAction('subscribe')}
                                >
                                    <Check className="h-3 w-3 mr-1.5" />
                                    Subscribe ({multiSelectedCodes.size})
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant={showSubscribeButton ? "outline" : "default"}
                                className="h-7 text-xs w-full"
                                onClick={() => handleMultiAction('multi-chart')}
                            >
                                <LayoutGrid className="h-3 w-3 mr-1.5" />
                                Multi Chart
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs w-full"
                                onClick={() => handleMultiAction('new-tabs')}
                            >
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                Open in New Tabs
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs w-full"
                                onClick={() => handleMultiAction('historical')}
                            >
                                <BarChart3 className="h-3 w-3 mr-1.5" />
                                Historical Data
                            </Button>
                        </>
                    )}
                </div>
            )}

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
