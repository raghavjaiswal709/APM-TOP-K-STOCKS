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
    BarChart3
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

import { FilterModal } from "./controllers/WatchlistSelector/FilterModal";
import { ImageCarousel } from "./ImageCarousel";

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
    onFetchChartData?: () => void; // Trigger fetch
    onFetchAllChartData?: () => void;

    // Filter Props
    availableExchanges?: string[];
    availableMarkers?: string[];
    totalCompanies?: number;

    // Filter/Sort State (managed by parent or local? WatchlistSelector managed it locally mostly, but parent held `companies` filtered by date)
    // Actually WatchlistSelector did client-side filtering for Exchange/Marker.
    // We can lift that state to this component or let parent handle it.
    // Let's implement client-side filtering here for Exchange/Marker to match previous behavior.
}

export function CompanyList({
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
    totalCompanies = 0
}: CompanyListProps) {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [activeFilters, setActiveFilters] = React.useState<{
        exchanges: string[];
        markers: string[];
        refined: boolean | null;
        showAllCompanies: boolean;
    }>({
        exchanges: [],
        markers: [],
        refined: null,
        showAllCompanies: false
    });

    const [isCarouselOpen, setIsCarouselOpen] = React.useState(false);

    // Calendar State for Chart Range (Local state for the popover inputs)
    const [chartStartDate, setChartStartDate] = React.useState<Date | undefined>(undefined);
    const [chartEndDate, setChartEndDate] = React.useState<Date | undefined>(undefined);
    // We need to keep this state to pass to onChartRangeChange only when user interactions happen?
    // Or update parent immediately? Usually update immediately or on "Apply".
    // Previous `CalendarForm` updated parent immediately on change. I'll do the same.

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

        // 2. Search Term
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
    }, [companies, searchTerm, activeFilters]);

    // Selected company object for ImageCarousel
    const selectedCompanyObj = React.useMemo(() =>
        companies.find(c => c.company_code === selectedCompanyCode),
        [companies, selectedCompanyCode]);


    const activeFilterCount = React.useMemo(() => {
        if (activeFilters.showAllCompanies) return 1;
        return activeFilters.exchanges.length + activeFilters.markers.length + (activeFilters.refined !== null ? 1 : 0);
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

            <div className="flex-1 overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                        {searchTerm ? 'No matches found' : 'No companies available'}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredCompanies.map((company, index) => {
                            const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                            const isSelected = selectedCompanyCode === company.company_code;

                            return (
                                <div
                                    key={uniqueKey}
                                    onClick={() => onSelect(company.company_code)}
                                    className={cn(
                                        "flex flex-col gap-1 p-3 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/50 relative",
                                        isSelected && "bg-accent border-l-4 border-l-primary pl-[8px]"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={cn("font-bold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                                                {company.company_code}
                                            </span>
                                            {company.exchange && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                                    {company.exchange}
                                                </span>
                                            )}
                                        </div>
                                        {company.N1_Pattern_count !== undefined && company.N1_Pattern_count > 0 && (
                                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                                <TrendingUp className="h-3 w-3" />
                                                {company.N1_Pattern_count}
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-xs text-muted-foreground truncate w-full">
                                        {company.name}
                                    </div>

                                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                                        {company.total_valid_days !== undefined && (
                                            <span>{company.total_valid_days}d</span>
                                        )}
                                        {company.median_daily_volume !== undefined && (
                                            <span>Vol: {(company.median_daily_volume / 1000).toFixed(0)}K</span>
                                        )}
                                    </div>
                                </div>
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
                onFiltersChange={setActiveFilters}
                totalCompanies={totalCompanies}
                filteredCount={filteredCompanies.length}
            />

            {selectedCompanyObj && (
                <ImageCarousel
                    isOpen={isCarouselOpen}
                    onClose={() => setIsCarouselOpen(false)}
                    companyCode={selectedCompanyObj.companyCode}
                    exchange={selectedCompanyObj.exchange}
                    selectedDate={selectedWatchlistDate || undefined}
                />
            )}
        </div>
    );
}
