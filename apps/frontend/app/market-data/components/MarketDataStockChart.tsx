'use client';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    createChart,
    createSeriesMarkers,
    ColorType,
    CrosshairMode,
    LineStyle,
    IChartApi,
    ISeriesApi,
    Time,
    UTCTimestamp,
    CandlestickSeries,
    HistogramSeries,
    LineSeries,
    AreaSeries,
    BarSeries,
    MouseEventParams,
    ISeriesMarkersPluginApi
} from 'lightweight-charts';
import {
    Settings,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2,
    RotateCcw,
    Activity,
    BarChart2,
    TrendingUp,
    Grid,
    ChevronDown,
    Clock,
    AlertTriangle,
    Lock,
    Unlock
} from 'lucide-react';
import {
    calculateSMA,
    calculateEMA,
    calculateBollinger,
    calculateRSI,
    calculateMACD,
    convertToHeikenAshi,
    BollingerResult,
    MACDResult,
    StockDataPoint
} from '../../utils/chartHelper';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SeparateViewModal } from '@/app/components/charts/SeparateViewModal';
import { ALL_HORIZON_KEYS, HORIZON_LINE_CONFIG } from '@/lib/gttTransformers';
import { attachPriceAxisWheelZoom, removePriceAxisWheelZoom } from '@/utils/chartWheelHandler';

// --- Types ---
import type { IntradayShapePattern } from '@/types/clustering';
import { ARCHETYPE_COLORS } from '@/types/clustering';
import type { PatternCurvesData } from '@/hooks/usePatternOverlay';

// Prediction data interface - matches actual API response structure
// API returns: { "2026-02-03 09:15": { "close": 415.26, "predicted_at": "2026-02-03 09:15:00" } }
// The key IS the timestamp, not a property in the value
interface PredictionData {
    close: number;
    predicted_at?: string;  // When prediction was made
    // Legacy support for old format
    timestamp?: string;
    predictedat?: string;
}

interface CompanyPredictions {
    company?: string;
    predictions: Record<string, PredictionData>;
    count?: number;
    starttime?: string;
    endtime?: string;
}

interface TooltipData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    prediction?: number;  // Regular predicted close price at this time
    /** Per-horizon GTT values: keys like 'S1_H1_pred', 'input_close' */
    gttHorizons?: Record<string, number>;
    x: number;
    y: number;
    visible: boolean;
}

interface StockChartProps {
    companyId: string | null;
    data?: StockDataPoint[];
    startDate?: Date;
    endDate?: Date;
    interval?: string;
    indicators?: string[];
    loading?: boolean;
    error?: string | null;
    height?: number | string; // Allow string for 100%
    width?: number; // Kept for prop compatibility
    defaultChartType?: string;
    theme?: 'light' | 'dark';
    onThemeChange?: (theme: 'light' | 'dark') => void;
    onIntervalChange?: (interval: string) => void;
    onRangeChange?: (startDate: Date, endDate: Date) => Promise<void>;
    className?: string;
    predictions?: CompanyPredictions | null;
    showPredictions?: boolean;
    gttPredictions?: any | null;  // GttMultiSeriesData from gttTransformers
    showGttPredictions?: boolean;
    /** Per-horizon visibility: keys like 'S1_H1_pred', 'S2_H3_pred', 'input_close' */
    gttHorizonVisibility?: Record<string, boolean>;
    statusMessage?: string | null;  // Overlay message shown inside chart (e.g. "Historical server unavailable")
    /** True when incremental gap-fill is loading older data (shows left-edge spinner) */
    isLoadingMore?: boolean;
    /**
     * Unix timestamp (seconds) to scroll to after new historical data is loaded.
     * Pass the old dataRange.start (before fetchBefore) — chart scrolls to show that boundary.
     * Change this value each time more historical data is loaded.
     */
    scrollToDataBoundary?: number | null;
    /** Intraday shape pattern from UMAP clustering to overlay on the chart */
    intradayShapePattern?: IntradayShapePattern | null;
    /** Whether to show the intraday shape overlay */
    showIntradayOverlay?: boolean;
    /** Today's open price — used to scale the normalized intraday shape to actual prices */
    todayOpenPrice?: number;
    /** PatternPool Overlay API curves data — centroid + bands for all ranked patterns */
    patternCurves?: PatternCurvesData | null;
    /** Whether to show the PatternPool overlay on the chart */
    showPatternOverlay?: boolean;
    /** Show cluster lines for patterns ranked #1–#3 */
    showTop3PatternLines?: boolean;
    /** Show cluster lines for patterns ranked #4 and beyond */
    showBeyondTop3PatternLines?: boolean;
    /** Lock the X-axis to 09:15–15:30 IST and disable horizontal scroll/pan */
    lockToMarketHours?: boolean;
    /** Y-axis scale mode for pattern overlay: 'shared' (aligns curves on the main price scale) or 'independent' (auto-scaled separately to fit chart area) */
    patternScaleMode?: 'shared' | 'independent';
    /**
     * Trading date (YYYY-MM-DD IST) to pin the market-hours lock to.
     * Pass this when viewing historical data so the X-axis stays locked
     * to the correct trading day instead of defaulting to today.
     * Falls back to patternCurves.date, then today's IST date.
     */
    lockedDate?: string | null;
    /** Show or hide the volume histogram at the bottom of the chart */
    showVolume?: boolean;
    /** Extra controls rendered inline in the chart toolbar, right after the auto-scale lock button */
    toolbarSlot?: React.ReactNode;
    onIndicatorsChange?: (indicators: string[]) => void;
    onChartTypeChange?: (type: string) => void;
    hideIntervals?: boolean;
    hideDuration?: boolean;
}

// --- Constants ---

const CHART_BG_DARK = '#000000';
const CHART_BG_LIGHT = '#ffffff';
const TEXT_COLOR_DARK = '#d1d5db';
const TEXT_COLOR_LIGHT = '#333333';
const GRID_COLOR_DARK = 'rgba(42, 46, 57, 0.5)';
const GRID_COLOR_LIGHT = '#f0f3fa';

const AVAILABLE_INDICATORS = [
    { id: 'ma', name: 'Moving Average', periods: [20, 50, 200] },
    { id: 'ema', name: 'Exponential MA', periods: [9, 21] },
    { id: 'bollinger', name: 'Bollinger Bands' },
    { id: 'rsi', name: 'RSI' },
    { id: 'macd', name: 'MACD' },
];

const TIME_INTERVALS = [
    { id: '1m', name: '1m' },
    { id: '5m', name: '5m' },
    { id: '15m', name: '15m' },
    { id: '30m', name: '30m' },
    { id: '1h', name: '1H' },
    { id: '1d', name: '1D' },
];

const DURATION_OPTIONS = [
    { id: '5m', name: '5 min', seconds: 5 * 60 },
    { id: '15m', name: '15 min', seconds: 15 * 60 },
    { id: '30m', name: '30 min', seconds: 30 * 60 },
    { id: '1h', name: '1 hour', seconds: 60 * 60 },
    { id: '2h', name: '2 hours', seconds: 2 * 60 * 60 },
    { id: '4h', name: '4 hours', seconds: 4 * 60 * 60 },
    { id: 'full', name: 'Full Day', seconds: 6 * 60 * 60 + 15 * 60 },
];

const CHART_TYPES = [
    { id: 'candlestick', name: 'Candles', icon: BarChart2 },
    { id: 'line', name: 'Line', icon: TrendingUp },
    { id: 'area', name: 'Area', icon: Activity },
    { id: 'heikenAshi', name: 'Heiken Ashi', icon: Grid },
];

export function MarketDataStockChart({
    companyId,
    data = [],
    startDate,
    endDate,
    interval = '1m',
    indicators = [],
    loading = false,
    error = null,
    height = '100%',
    theme = 'dark',
    defaultChartType = 'candlestick',
    onThemeChange,
    onIntervalChange,
    onRangeChange,
    className,
    predictions = null,
    showPredictions = false,
    gttPredictions = null,
    showGttPredictions = false,
    gttHorizonVisibility = {},
    statusMessage = null,
    isLoadingMore = false,
    scrollToDataBoundary = null,
    intradayShapePattern = null,
    showIntradayOverlay = false,
    todayOpenPrice = 0,
    patternCurves = null,
    showPatternOverlay = false,
    showTop3PatternLines = true,
    showBeyondTop3PatternLines = false,
    lockToMarketHours = false,
    lockedDate = null,
    patternScaleMode = 'shared',
    showVolume = true,
    toolbarSlot,
    onIndicatorsChange,
    onChartTypeChange,
    hideIntervals = false,
    hideDuration = false,
}: StockChartProps) {
    // State
    const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
    const [chartType, setChartType] = useState(defaultChartType);
    const [selectedInterval, setSelectedInterval] = useState(interval);
    const [selectedDuration, setSelectedDuration] = useState('full');
    const [isFullscreen, setIsFullscreen] = useState(false);
    // GTT labels visibility — toggles lastValueVisible on all GTT series
    const [showGttLabels, setShowGttLabels] = useState(true);

    // Separate View Modal State
    const [isSeparatorModalOpen, setIsSeparatorModalOpen] = useState(false);

    // Sync interval prop with local state when parent changes it
    useEffect(() => {
        setSelectedInterval(interval);
    }, [interval]);

    useEffect(() => {
        onIndicatorsChange?.(activeIndicators);
    }, [activeIndicators, onIndicatorsChange]);

    useEffect(() => {
        onChartTypeChange?.(chartType);
    }, [chartType, onChartTypeChange]);


    // Analysis State
    const [showBidAsk, setShowBidAsk] = useState(false);
    const [bidAskMode, setBidAskMode] = useState<'Line' | 'Spread' | 'STD'>('Line');
    const [showBuySell, setShowBuySell] = useState(false);

    const [buySellMode, setBuySellMode] = useState<'Line' | 'Spread' | 'STD'>('Line');

    // Auto-scale lock: when locked (true) = chart auto-adjusts vertical axis
    // When unlocked (false) = user has full manual control of the vertical price scale
    // Default: true (locked) — chart auto-fits vertical scale by default
    const [autoScaleLocked, setAutoScaleLocked] = useState(true);
    // Incremented once after the chart DOM element is created so the lock effect
    // can re-fire with a valid mainChartRef (it fires before chart creation on mount).
    const [chartReadyVersion, setChartReadyVersion] = useState(0);

    // Tooltip State
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

    // Refs for Chart Instances
    const mainChartContainerRef = useRef<HTMLDivElement>(null);
    const rsiChartContainerRef = useRef<HTMLDivElement>(null);
    const macdChartContainerRef = useRef<HTMLDivElement>(null);
    const bidAskChartContainerRef = useRef<HTMLDivElement>(null);
    const buySellChartContainerRef = useRef<HTMLDivElement>(null);

    const mainChartRef = useRef<IChartApi | null>(null);
    const rsiChartRef = useRef<IChartApi | null>(null);
    const macdChartRef = useRef<IChartApi | null>(null);
    const bidAskChartRef = useRef<IChartApi | null>(null);
    const buySellChartRef = useRef<IChartApi | null>(null);

    const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    // Indicator Series Refs need to be tracked to remove/update
    const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<any>>>(new Map());
    // Original titles for GTT series — used to restore when eye icon is toggled back on
    const gttSeriesTitlesRef = useRef<Map<string, string>>(new Map());
    
    // Prediction markers plugin ref (LightweightCharts v5.x uses createSeriesMarkers)
    const predictionMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
    // GTT Prediction markers plugin ref
    const gttPredictionMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

    // Intraday shape overlay series refs (median + p25 + p75)
    const intradayMedianSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const intradayP25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const intradayP75SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Market-hours anchor series: invisible LineSeries with whitespace data at open+close
    // Ensures the time axis covers the full 09:15–15:30 IST window even when there are
    // no pattern overlay curves to provide bars for the "future" portion of the day.
    const marketHoursAnchorSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // PatternPool Overlay series refs: 3 centroids + 3 band-uppers + 3 band-lowers + live curve + current-slot line
    const patternCentroidSeriesRefs = useRef<Array<ISeriesApi<'Line'> | null>>([]);
    const patternCentroidLabelsRef = useRef<Array<string>>([]);
    const patternBandUpperRefs = useRef<Array<ISeriesApi<'Line'> | null>>([]);
    const patternBandLowerRefs = useRef<Array<ISeriesApi<'Line'> | null>>([]);
    // Refs to read current toggle values inside render effects without adding them as dependencies
    const showTop3LinesRef = useRef(showTop3PatternLines);
    const showBeyondTop3LinesRef = useRef(showBeyondTop3PatternLines);
    showTop3LinesRef.current = showTop3PatternLines;
    showBeyondTop3LinesRef.current = showBeyondTop3PatternLines;
    const patternLiveCurveRef = useRef<ISeriesApi<'Line'> | null>(null);
    const patternCurrentSlotRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Track previous companyId for detecting company switches in the data effect
    const prevCompanyIdRef = useRef<string | null>(null);

    // Track previous lockedDate to detect date-navigation switches in the data effect
    const prevLockedDateRef = useRef<string | null>(null);
    
    // Track previous chartType to detect chart type changes (need series recreation) vs data-only changes (reuse series)
    const prevChartTypeRef = useRef<string | null>(null);
    
    // Track previous interval to detect interval changes (need series recreation + re-fit)
    const prevIntervalRef = useRef<string | null>(null);
    
    // Track previous data length to detect meaningful data changes vs same-data re-renders
    const prevDataLengthRef = useRef<number>(0);
    // Track the last candle's time for incremental series.update() optimisation
    const prevLastCandleTimeRef = useRef<number | null>(null);
    
    // Track whether this is the first data load (or after company change) to avoid resetting user's zoom/pan on live updates
    const needsInitialFitRef = useRef<boolean>(true);

    // Toggle lastValueVisible AND title on all GTT series + cluster centroid series whenever showGttLabels changes.
    // In lightweight-charts v5, the colored title badge on the right axis is a SEPARATE
    // visual from the price number — both must be cleared to fully hide the labels.
    useEffect(() => {
        // GTT series
        indicatorSeriesRefs.current.forEach((series, key) => {
            if (key.startsWith('gtt_')) {
                const originalTitle = gttSeriesTitlesRef.current.get(key) ?? '';
                series.applyOptions({
                    lastValueVisible: showGttLabels,
                    title: showGttLabels ? originalTitle : '',
                });
            }
        });
        // Cluster overlay centroid series
        patternCentroidSeriesRefs.current.forEach((series, idx) => {
            if (!series) return;
            const originalLabel = patternCentroidLabelsRef.current[idx] ?? '';
            series.applyOptions({
                lastValueVisible: showGttLabels,
                title: showGttLabels ? originalLabel : '',
            });
        });
    }, [showGttLabels]);

    // Toggle visibility of pattern lines without full series teardown.
    // showTop3PatternLines    → centroid lines (the bright main pattern lines)
    // showBeyondTop3PatternLines → confidence band lines (faint upper/lower bounds)
    // Uses applyOptions({ visible }) so the chart layout and scale stay unchanged.
    useEffect(() => {
        patternCentroidSeriesRefs.current.forEach(series => {
            if (!series) return;
            try { series.applyOptions({ visible: showTop3PatternLines }); } catch (_) {}
        });
        patternBandUpperRefs.current.forEach(series => {
            if (!series) return;
            try { series.applyOptions({ visible: showBeyondTop3PatternLines }); } catch (_) {}
        });
        patternBandLowerRefs.current.forEach(series => {
            if (!series) return;
            try { series.applyOptions({ visible: showBeyondTop3PatternLines }); } catch (_) {}
        });
    }, [showTop3PatternLines, showBeyondTop3PatternLines]);

    // Seconds per candle for each interval — used for auto-scroll after fetchBefore
    const INTERVAL_SECONDS: Record<string, number> = {
        '1m': 60, '5m': 300, '10m': 600, '15m': 900,
        '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400,
    };

    // When new historical data is loaded (fetchBefore), scroll chart to show boundary
    useEffect(() => {
        if (!scrollToDataBoundary || !mainChartRef.current) return;
        const intervalSec = INTERVAL_SECONDS[selectedInterval] || 60;
        // Show 20 candles of new data + 40 candles of existing data around the join point
        try {
            (mainChartRef.current as any).timeScale().setVisibleRange({
                from: (scrollToDataBoundary - 20 * intervalSec) as any,
                to: (scrollToDataBoundary + 40 * intervalSec) as any,
            });
        } catch (e) {
            try { (mainChartRef.current as any).timeScale().fitContent(); } catch (_) { }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scrollToDataBoundary]);

    // ─── Intraday Shape Overlay Effect ───────────────────────────────────────
    // Renders median / P25 / P75 lines on the main chart scaled to today's open.
    useEffect(() => {
        const chart = mainChartRef.current;

        // Helper: remove existing overlay series
        const clearOverlay = () => {
            if (intradayMedianSeriesRef.current && chart) {
                try { chart.removeSeries(intradayMedianSeriesRef.current); } catch (_) {}
                intradayMedianSeriesRef.current = null;
            }
            if (intradayP25SeriesRef.current && chart) {
                try { chart.removeSeries(intradayP25SeriesRef.current); } catch (_) {}
                intradayP25SeriesRef.current = null;
            }
            if (intradayP75SeriesRef.current && chart) {
                try { chart.removeSeries(intradayP75SeriesRef.current); } catch (_) {}
                intradayP75SeriesRef.current = null;
            }
        };

        if (!showIntradayOverlay || !intradayShapePattern || !chart || todayOpenPrice <= 0) {
            clearOverlay();
            return;
        }

        clearOverlay();

        // Build today's UTC timestamps for each minute (market: 9:15–15:29 IST)
        // IST = UTC+5:30  →  9:15 IST = 3:45 UTC
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const [y, mo, d] = todayIST.split('-').map(Number);
        const todayMidnightUTC = Date.UTC(y, mo - 1, d) / 1000; // seconds
        const marketOpenUTC = todayMidnightUTC + 3 * 3600 + 45 * 60; // 03:45 UTC

        // Convert a normalized return (% from open) or shape value to actual price
        const hasReturnData = !!(intradayShapePattern.median_return_from_open?.length);

        const toPrice = (shapeVal: number, idx: number): number => {
            if (hasReturnData) {
                // median_return_from_open is % return from open
                return todayOpenPrice * (1 + shapeVal / 100);
            }
            // median_shape is normalized — treat as relative to 1.0 (open = 1.0)
            // Scale by open price; shape values near 1 → near open price
            return todayOpenPrice * shapeVal;
        };

        const nMin = intradayShapePattern.n_minutes || 374;
        const archetypeColor = ARCHETYPE_COLORS[intradayShapePattern.archetype] || '#8b5cf6';

        // Build series data arrays
        const medianData = (hasReturnData
            ? intradayShapePattern.median_return_from_open!
            : intradayShapePattern.median_shape
        ).slice(0, nMin).map((v, i) => ({
            time: (marketOpenUTC + i * 60) as any,
            value: toPrice(v, i),
        }));

        const p25Src = hasReturnData ? intradayShapePattern.p25_return_from_open : intradayShapePattern.p25_shape;
        const p75Src = hasReturnData ? intradayShapePattern.p75_return_from_open : intradayShapePattern.p75_shape;

        const p25Data = p25Src?.slice(0, nMin).map((v, i) => ({
            time: (marketOpenUTC + i * 60) as any,
            value: toPrice(v, i),
        })) ?? [];

        const p75Data = p75Src?.slice(0, nMin).map((v, i) => ({
            time: (marketOpenUTC + i * 60) as any,
            value: toPrice(v, i),
        })) ?? [];

        // Create and add series
        try {
            if (p25Data.length) {
                const s = chart.addSeries(LineSeries, {
                    color: archetypeColor + '50',
                    lineWidth: 1,
                    lineStyle: 2, // dashed
                    lastValueVisible: false,
                    priceLineVisible: false,
                    title: '',
                });
                s.setData(p25Data);
                intradayP25SeriesRef.current = s;
            }

            if (p75Data.length) {
                const s = chart.addSeries(LineSeries, {
                    color: archetypeColor + '50',
                    lineWidth: 1,
                    lineStyle: 2,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    title: '',
                });
                s.setData(p75Data);
                intradayP75SeriesRef.current = s;
            }

            if (medianData.length) {
                const s = chart.addSeries(LineSeries, {
                    color: archetypeColor,
                    lineWidth: 2,
                    lastValueVisible: true,
                    priceLineVisible: false,
                    title: `${intradayShapePattern.h_label} Shape`,
                });
                s.setData(medianData);
                intradayMedianSeriesRef.current = s;
            }
        } catch (err) {
            console.warn('[IntradayOverlay] Failed to add series:', err);
        }

        return () => { clearOverlay(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showIntradayOverlay, intradayShapePattern, todayOpenPrice]);

    // ─── PatternPool Overlay Effect ──────────────────────────────────────────
    // Renders all pattern centroid lines + confidence bands + live curve
    // on a fixed 09:15–15:30 IST X-axis for the cluster-overlay page.
    useEffect(() => {
        const chart = mainChartRef.current;

        // Colour palettes: top-3 coloured by confidence (green=highest, yellow=mid, red=lowest), #4+ muted grays
        const RANK_COLORS  = ['#22c55e', '#f59e0b', '#ef5350']; // green, yellow, red
        const EXTRA_COLORS = ['#64748b', '#94a3b8', '#6b7280', '#9ca3af', '#475569', '#a8b4be'];

        const clearPatternOverlay = () => {
            [...patternCentroidSeriesRefs.current].forEach(s => {
                if (s && chart) { try { chart.removeSeries(s); } catch (_) {} }
            });
            patternCentroidSeriesRefs.current = [];
            patternCentroidLabelsRef.current = [];
            [...patternBandUpperRefs.current].forEach(s => {
                if (s && chart) { try { chart.removeSeries(s); } catch (_) {} }
            });
            patternBandUpperRefs.current = [];
            [...patternBandLowerRefs.current].forEach(s => {
                if (s && chart) { try { chart.removeSeries(s); } catch (_) {} }
            });
            patternBandLowerRefs.current = [];
            if (patternLiveCurveRef.current && chart) {
                try { chart.removeSeries(patternLiveCurveRef.current); } catch (_) {}
                patternLiveCurveRef.current = null;
            }
            if (patternCurrentSlotRef.current && chart) {
                try { chart.removeSeries(patternCurrentSlotRef.current); } catch (_) {}
                patternCurrentSlotRef.current = null;
            }
        };

        if (!showPatternOverlay || !patternCurves || !chart) {
            clearPatternOverlay();
            return;
        }

        clearPatternOverlay();

        const { time_axis, patterns, live_curve } = patternCurves;
        if (!time_axis || !patterns || patterns.length === 0) return;

        // Build UTC timestamps from IST slot-end times (e.g. "09:30" → UTC seconds)
        // The date comes from patternCurves.date (YYYY-MM-DD in IST)
        const dateStr = patternCurves.date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "2026-05-07"
        const [yr, mo, dy] = dateStr.split('-').map(Number);

        // Convert IST "HH:MM" → UTC timestamp (seconds)
        const istSlotToUTC = (timeStr: string): number => {
            const [h, m] = timeStr.split(':').map(Number);
            // IST = UTC+5:30; so UTC = IST - 5:30
            const istMinutes = h * 60 + m;
            const utcMinutes = istMinutes - 5 * 60 - 30;
            const baseUTC = Date.UTC(yr, mo - 1, dy) / 1000;
            return baseUTC + utcMinutes * 60;
        };

        const timeAxisUTC = time_axis.map(istSlotToUTC);

        // ── 1-minute interpolation helper ──────────────────────────────────
        // WHY THIS EXISTS: lightweight-charts x-axis distributes space by BAR
        // COUNT (logical indices), NOT by real time. The overlay API returns
        // only 25 sparse data points at 15-minute intervals. If we plot those
        // directly, the future region (13:00–15:30) only gets ~10 bar-width
        // pixels while the past has 225 1-minute candle slots → severe
        // right-side compression. Fix: resample every overlay series to
        // 1-minute resolution so the full market day has uniform bar density.
        const baseUTC = Date.UTC(yr, mo - 1, dy) / 1000;
        const mktOpenUTC  = baseUTC + (9 * 60 + 15 - 330) * 60;  // 09:15 IST
        const mktCloseUTC = baseUTC + (15 * 60 + 30 - 330) * 60; // 15:30 IST
        const totalMktMin = Math.round((mktCloseUTC - mktOpenUTC) / 60); // 375

        /** Linearly interpolate sparse (time, value) pairs to 1-minute UTC.
         *  @param sparse   sorted array of {time (UTC sec), value}
         *  @param maxTime  if set, stop at this UTC timestamp (inclusive) */
        const interpToMin = (
            sparse: Array<{ time: number; value: number }>,
            maxTime?: number,
        ): Array<{ time: number; value: number }> => {
            if (sparse.length === 0) return [];
            const result: Array<{ time: number; value: number }> = [];
            for (let i = 0; i <= totalMktMin; i++) {
                const t = mktOpenUTC + i * 60;
                if (maxTime !== undefined && t > maxTime + 1) break;
                let value: number;
                if (t <= sparse[0].time) {
                    value = sparse[0].value;
                } else if (t >= sparse[sparse.length - 1].time) {
                    value = sparse[sparse.length - 1].value;
                } else {
                    const idx = sparse.findIndex(p => p.time > t);
                    const p0 = sparse[idx - 1];
                    const p1 = sparse[idx];
                    const frac = (t - p0.time) / (p1.time - p0.time);
                    value = p0.value + frac * (p1.value - p0.value);
                }
                result.push({ time: t, value });
            }
            return result;
        };

        // ── Shared overlay scale configuration ───────────────────────────
        // All pattern overlay series share 'pattern-overlay' priceScaleId so
        // they auto-scale to their own value range and visually fill the chart
        // area, independent of the main candlestick price axis.
        const OVERLAY_SCALE_ID = 'pattern-overlay';

        const configureOverlayScale = () => {
            try {
                chart.priceScale(OVERLAY_SCALE_ID).applyOptions({
                    scaleMargins: { top: 0.05, bottom: 0.05 },
                    visible: false, // hide the right-axis numbers for the overlay
                    autoScale: true,
                });
            } catch (_) {}
        };

        const isPriceScaled = patterns.some(pat => pat.centroid_price !== undefined && pat.centroid_price !== null);
        const targetScaleId = (patternScaleMode === 'shared' && isPriceScaled) ? 'right' : OVERLAY_SCALE_ID;

        try {
            // --- Plot ALL ranked patterns (#1–#last) ---
            // centroid lines  → controlled by showTop3PatternLines (#1-3 toggle)
            // band lines      → controlled by showBeyondTop3PatternLines (Bands toggle)
            patterns.forEach((pat, idx) => {
                const isTop3 = idx < 3;
                const color = isTop3
                    ? (RANK_COLORS[idx] || '#8b5cf6')
                    : (EXTRA_COLORS[idx - 3] || '#64748b');
                // Centroid and band lines have separate initial visibility
                const centroidVisible = showTop3LinesRef.current;
                const bandsVisible    = showBeyondTop3LinesRef.current;
                const { centroid_price, band_upper_price, band_lower_price, cluster, meta } = pat;
                // Support both v2 price-scaled fields and legacy normalised fields as fallback
                const centroid   = centroid_price   ?? pat.centroid;
                const band_upper = band_upper_price ?? pat.band_upper;
                const band_lower = band_lower_price ?? pat.band_lower;

                // Band lower (faint dashed — least-visible, controlled by Bands toggle)
                if (band_lower && band_lower.length === timeAxisUTC.length) {
                    const s = chart.addSeries(LineSeries, {
                        color: color + '40',
                        lineWidth: 1,
                        lineStyle: LineStyle.Dashed,
                        lastValueVisible: false,
                        priceLineVisible: false,
                        priceScaleId: targetScaleId,
                        title: '',
                        visible: bandsVisible,
                    });
                    const sparseLower = band_lower.map((v, i) => ({ time: timeAxisUTC[i], value: v }));
                    s.setData(interpToMin(sparseLower).map(p => ({ time: p.time as any, value: p.value })));
                    patternBandLowerRefs.current[idx] = s;
                }

                // Band upper (faint dashed — least-visible, controlled by Bands toggle)
                if (band_upper && band_upper.length === timeAxisUTC.length) {
                    const s = chart.addSeries(LineSeries, {
                        color: color + '40',
                        lineWidth: 1,
                        lineStyle: LineStyle.Dashed,
                        lastValueVisible: false,
                        priceLineVisible: false,
                        priceScaleId: targetScaleId,
                        title: '',
                        visible: bandsVisible,
                    });
                    const sparseUpper = band_upper.map((v, i) => ({ time: timeAxisUTC[i], value: v }));
                    s.setData(interpToMin(sparseUpper).map(p => ({ time: p.time as any, value: p.value })));
                    patternBandUpperRefs.current[idx] = s;
                }

                // Centroid line (bright dashed, with label — controlled by #1-3 toggle)
                if (centroid && centroid.length === timeAxisUTC.length) {
                    const wr = meta?.win_rate != null ? `wr=${(meta.win_rate * 100).toFixed(0)}%` : '';
                    const ret = meta?.avg_return != null ? `ret=${meta.avg_return >= 0 ? '+' : ''}${(meta.avg_return * 100).toFixed(2)}%` : '';
                    const label = `#${idx + 1} ${cluster} ${wr}${wr && ret ? ' ' : ''}${ret}`;
                    patternCentroidLabelsRef.current[idx] = label;
                    const s = chart.addSeries(LineSeries, {
                        color,
                        lineWidth: idx === 0 ? 2 : 1,
                        lineStyle: LineStyle.Dashed,
                        lastValueVisible: showGttLabels,
                        priceLineVisible: false,
                        priceScaleId: targetScaleId,
                        title: showGttLabels ? label : '',
                        visible: centroidVisible,
                    });
                    const sparseCentroid = centroid.map((v, i) => ({ time: timeAxisUTC[i], value: v }));
                    s.setData(interpToMin(sparseCentroid).map(p => ({ time: p.time as any, value: p.value })));
                    patternCentroidSeriesRefs.current[idx] = s;
                }
            });

            // Configure scale after series are added
            if (targetScaleId === OVERLAY_SCALE_ID) {
                configureOverlayScale();
            }

        } catch (err) {
            console.warn('[PatternOverlay] Failed to add series:', err);
        }

        return () => { clearPatternOverlay(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPatternOverlay, patternCurves, chartReadyVersion, patternScaleMode]);

    // ─── Market-hours UTC range helper ───────────────────────────────────────
    // Returns { open, close } as UTC seconds for 09:15–15:30 IST on the given
    // YYYY-MM-DD date (or today's IST date when dateStr is null/undefined).
    const getMarketUTCRange = (dateStr?: string | null) => {
        const d = dateStr ?? new Date().toLocaleDateString('sv', { timeZone: 'Asia/Kolkata' });
        const [yr, mo, dy] = d.split('-').map(Number);
        const base = Date.UTC(yr, mo - 1, dy) / 1000;
        return {
            open:  base + (9 * 60 + 15 - 330) * 60,   // 09:15 IST → 03:45 UTC
            close: base + (15 * 60 + 30 - 330) * 60,  // 15:30 IST → 10:00 UTC
        };
    };

    // ─── Lock X-axis to market hours (09:15–15:30 IST) ───────────────────────
    // Fires as soon as lockToMarketHours=true and re-fires when patternCurves.date
    // or lockedDate changes (replay mode). Does NOT require patternCurves to be loaded.
    useEffect(() => {
        const chart = mainChartRef.current;
        if (!chart || !lockToMarketHours) return;

        const { open, close } = getMarketUTCRange(lockedDate ?? patternCurves?.date);

        // Ensure an invisible anchor series exists with whitespace data at market
        // open + close. This pre-allocates time slots for the full market day so that
        // setVisibleRange(open→close) works even when candle data only covers part of
        // the day (e.g. live trading mid-session, or no pattern overlay curves).
        try {
            if (!marketHoursAnchorSeriesRef.current) {
                marketHoursAnchorSeriesRef.current = chart.addSeries(LineSeries, {
                    color: 'transparent',
                    lineWidth: 0 as any,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    crosshairMarkerVisible: false,
                });
            }
            // Generate one whitespace slot per minute for the full market day.
            // Whitespace data = { time } with NO value → creates a bar slot without drawing.
            const totalMktMin = Math.round((close - open) / 60); // 375 min (09:15 → 15:30)
            const anchorData: Array<{ time: UTCTimestamp }> = [];
            for (let i = 0; i <= totalMktMin; i++) {
                anchorData.push({ time: (open + i * 60) as UTCTimestamp });
            }
            marketHoursAnchorSeriesRef.current.setData(anchorData as any);
        } catch (_) {}

        try {
            const ts = (chart as any).timeScale();
            ts.setVisibleRange({ from: open as any, to: (close + 30 * 60) as any });
            // Disable horizontal scroll / scale so the window stays pinned
            chart.applyOptions({
                handleScroll: {
                    horzTouchDrag: false,
                    mouseWheel: false,
                    pressedMouseMove: false,
                    vertTouchDrag: true,
                },
                handleScale: {
                    mouseWheel: false,
                    pinch: false,
                    axisPressedMouseMove: { time: false, price: true },
                    axisDoubleClickReset: { time: false, price: true },
                },
            });
        } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lockToMarketHours, lockedDate, patternCurves?.date, chartReadyVersion]);

    // Toggle volume histogram visibility without recreating the series
    useEffect(() => {
        if (!volumeSeriesRef.current) return;
        volumeSeriesRef.current.applyOptions({ visible: showVolume });
    }, [showVolume]);

    // Data processing helper with validation
    const processData = useCallback((rawData: StockDataPoint[]) => {
        return rawData
            .map(d => {
                // Validate OHLC values are finite and positive
                const open = Number(d.open);
                const high = Number(d.high);
                const low = Number(d.low);
                const close = Number(d.close);
                const volume = Number(d.volume || 0);

                // Skip invalid data points
                if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close) ||
                    open <= 0 || high <= 0 || low <= 0 || close <= 0) {
                    return null;
                }

                // Validate OHLC relationships (high >= low, etc.)
                const validHigh = Math.max(open, high, low, close);
                const validLow = Math.min(open, high, low, close);

                return {
                    ...d,
                    open,
                    high: validHigh,
                    low: validLow,
                    close,
                    volume: Math.max(0, volume),
                    time: (new Date(d.interval_start).getTime() / 1000) as UTCTimestamp,
                };
            })
            .filter((d): d is NonNullable<typeof d> => d !== null)
            .sort((a, b) => (a.time as number) - (b.time as number));
    }, []);

    // Theme Colors
    const colors = useMemo(() => ({
        bg: theme === 'dark' ? CHART_BG_DARK : CHART_BG_LIGHT,
        text: theme === 'dark' ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT,
        grid: theme === 'dark' ? GRID_COLOR_DARK : GRID_COLOR_LIGHT,
        up: '#26a69a',
        down: '#ef5350',
        wickUp: '#26a69a',
        wickDown: '#ef5350',
        transparent: 'rgba(0,0,0,0)',
        border: theme === 'dark' ? '#2a2e39' : '#e0e3eb',
    }), [theme]);

    // Zoom Mode Handler - Apply visible range based on selected interval
    const applyDurationZoom = useCallback((durationId: string) => {
        if (!mainChartRef.current || !data || data.length === 0) return;
        
        const processedData = processData(data);
        if (processedData.length === 0) return;
        
        const latestDataTime = processedData[processedData.length - 1].time as number;
        const earliestDataTime = processedData[0].time as number;
        
        // Find the duration option
        const durationOption = DURATION_OPTIONS.find(d => d.id === durationId);
        if (!durationOption) {
            // Default: fit content to show everything
            mainChartRef.current.timeScale().fitContent();
            return;
        }
        
        const durationSeconds = durationOption.seconds;
        
        // Calculate start time for visible range
        let startTime = latestDataTime - durationSeconds;
        
        // Don't go before earliest data
        if (startTime < earliestDataTime) {
            startTime = earliestDataTime;
        }
        
        // Add small buffer at the end for predictions
        const endTime = latestDataTime + (5 * 60); // 5 min buffer
        
        try {
            mainChartRef.current.timeScale().setVisibleRange({
                from: startTime as UTCTimestamp,
                to: endTime as UTCTimestamp
            });
            
            // Sync other charts if they exist
            [rsiChartRef.current, macdChartRef.current, bidAskChartRef.current, buySellChartRef.current]
                .forEach(chart => {
                    if (chart) {
                        chart.timeScale().setVisibleRange({
                            from: startTime as UTCTimestamp,
                            to: endTime as UTCTimestamp
                        });
                    }
                });
                
            console.log(`🔍 [DURATION] Applied ${durationId} view: showing last ${durationSeconds / 60} minutes`);
        } catch (e) {
            console.warn('[DURATION] Failed to set visible range:', e);
        }
    }, [data, processData]);

    // Sync Handler
    const syncCharts = useCallback((source: IChartApi, others: (IChartApi | null)[]) => {
        if (!source) return;
        const handler = (param: any) => {
            const timeScale = source.timeScale();
            const range = timeScale.getVisibleLogicalRange();
            if (range) {
                others.forEach(chart => {
                    if (chart) {
                        chart.timeScale().setVisibleLogicalRange(range);
                    }
                });
            }
        };
        source.timeScale().subscribeVisibleLogicalRangeChange(handler);
    }, []);

    // Helper to create chart with standard options
    const createStandardChart = (container: HTMLElement) => {
        return createChart(container, {
            layout: { background: { type: ColorType.Solid, color: colors.bg }, textColor: colors.text },
            grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
            autoSize: true,
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: { time: true, price: true },  // ✅ drag on either axis scales it
                mouseWheel: true,
                pinch: true,
            },
            kineticScroll: {
                touch: true,
                mouse: true,
            },
            timeScale: {
                timeVisible: true,
                borderColor: colors.grid,
                rightOffset: 5,
                minBarSpacing: 1,
                tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
                    const date = new Date(time * 1000);
                    if (tickMarkType < 3) {
                        return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: tickMarkType === 0 ? 'numeric' : undefined });
                    }
                    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
                }
            },
            localization: {
                locale: 'en-IN',
                dateFormat: 'dd MMM \'yy',
                timeFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
                }
            }
        });
    };

    // Initialize Main Chart (Mount Only)
    useEffect(() => {
        if (!mainChartContainerRef.current) return;

        const initialColors = {
            bg: CHART_BG_DARK,
            text: TEXT_COLOR_DARK,
            grid: GRID_COLOR_DARK,
        };

        const chart = createChart(mainChartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: initialColors.bg },
                textColor: initialColors.text,
            },
            grid: {
                vertLines: { color: initialColors.grid },
                horzLines: { color: initialColors.grid },
            },
            width: mainChartContainerRef.current.clientWidth,
            height: mainChartContainerRef.current.clientHeight,
            // ✅ Smooth scrolling & zooming — enable kinetic scroll for inertial feel
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true,
            },
            handleScale: {
                axisPressedMouseMove: {
                    time: true,   // ✅ Drag on time axis zooms horizontally
                    price: true,   // ✅ Drag on price axis zooms vertically
                },
                mouseWheel: true,
                pinch: true,
            },
            kineticScroll: {
                touch: true,
                mouse: true,
            },
            timeScale: {
                timeVisible: true,
                borderColor: initialColors.grid,
                rightOffset: 5,
                minBarSpacing: 1,
                tickMarkFormatter: (time: number, tickMarkType: number, locale: string) => {
                    const date = new Date(time * 1000);
                    if (tickMarkType < 3) {
                        return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: tickMarkType === 0 ? 'numeric' : undefined });
                    }
                    return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
                }
            },
            rightPriceScale: {
                borderColor: initialColors.grid,
                autoScale: autoScaleLocked,
                alignLabels: true,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    labelVisible: false,
                },
                horzLine: {
                    labelVisible: false,
                    visible: false,
                },
            },
            localization: {
                locale: 'en-IN',
                dateFormat: 'dd MMM \'yy',
                timeFormatter: (time: number) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    });
                }
            }
        });

        mainChartRef.current = chart;

        // Pin the time axis to market hours immediately so the very first frame
        // shows 09:15–15:30 IST instead of the default empty/fit view.
        if (lockToMarketHours) {
            const { open, close } = getMarketUTCRange(lockedDate ?? undefined);
            try {
                (chart as any).timeScale().setVisibleRange({
                    from: open as any,
                    to: (close + 30 * 60) as any,
                });
            } catch (_) {}
        }
        // Signal the lock effect to re-fire now that the chart exists.
        setChartReadyVersion(v => v + 1);

        // ✅ Attach price-axis wheel zoom (scroll on price axis = vertical zoom)
        const removePriceWheelZoom = attachPriceAxisWheelZoom(
            mainChartContainerRef.current,
            mainChartRef as { current: IChartApi | null }
        );

        // ✅ Debounced resize handler — only resizes the main chart.
        // Sub-charts use autoSize:true so they self-manage their dimensions.
        let resizeRafId: number | null = null;
        const handleResize = () => {
            if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
            resizeRafId = requestAnimationFrame(() => {
                if (mainChartContainerRef.current && mainChartRef.current) {
                    const width = mainChartContainerRef.current.clientWidth;
                    const height = mainChartContainerRef.current.clientHeight;
                    mainChartRef.current.applyOptions({ width, height });
                }
                resizeRafId = null;
            });
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        if (mainChartContainerRef.current) {
            resizeObserver.observe(mainChartContainerRef.current);
        }
        // Observe window as backup or for other containers if they resize independently
        window.addEventListener('resize', handleResize);

        return () => {
            if (resizeRafId !== null) cancelAnimationFrame(resizeRafId);
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            removePriceWheelZoom(); // ✅ Clean up price-axis wheel zoom
            chart.remove();
            mainChartRef.current = null;
            mainSeriesRef.current = null;
            volumeSeriesRef.current = null;
            marketHoursAnchorSeriesRef.current = null;
            indicatorSeriesRefs.current.clear();
            if (rsiChartRef.current) { try { rsiChartRef.current.remove(); } catch (_) {} rsiChartRef.current = null; }
            if (macdChartRef.current) { try { macdChartRef.current.remove(); } catch (_) {} macdChartRef.current = null; }
            if (bidAskChartRef.current) { try { bidAskChartRef.current.remove(); } catch (_) {} bidAskChartRef.current = null; }
            if (buySellChartRef.current) { try { buySellChartRef.current.remove(); } catch (_) {} buySellChartRef.current = null; }
        };
    }, []);

    // Subscribe to Crosshair Move — RAF-throttled for smooth performance
    useEffect(() => {
        if (!mainChartRef.current) return;

        let crosshairRafId: number | null = null;

        const handleCrosshairMove = (param: MouseEventParams) => {
            // Cancel any pending RAF to avoid stacking
            if (crosshairRafId !== null) cancelAnimationFrame(crosshairRafId);

            crosshairRafId = requestAnimationFrame(() => {
                crosshairRafId = null;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > (mainChartContainerRef.current?.clientWidth || 0) ||
                param.point.y < 0 ||
                param.point.y > (mainChartContainerRef.current?.clientHeight || 0)
            ) {
                setTooltipData(null);
                return;
            }

            const seriesData = param.seriesData;
            if (!seriesData) return;

            // Get main series data (OHLC or Line)
            let open = 0, high = 0, low = 0, close = 0;
            if (mainSeriesRef.current) {
                const data = seriesData.get(mainSeriesRef.current);
                if (data) {
                    if ('open' in data) {
                        // Candlestick data
                        const candle = data as any;
                        open = candle.open;
                        high = candle.high;
                        low = candle.low;
                        close = candle.close;
                    } else if ('value' in data) {
                        // Line/Area data - approximate OHLC logic or just show value
                        const val = (data as any).value;
                        open = val;
                        high = val;
                        low = val;
                        close = val;
                    }
                }
            }

            // Get volume data
            let volume = undefined;
            if (volumeSeriesRef.current) {
                const volData = seriesData.get(volumeSeriesRef.current);
                if (volData) {
                    volume = (volData as any).value;
                }
            }

            // Get prediction data (regular)
            let prediction = undefined;
            const predictionSeries = indicatorSeriesRefs.current.get('prediction_line');
            if (predictionSeries) {
                const predData = seriesData.get(predictionSeries);
                if (predData && 'value' in predData) {
                    prediction = (predData as any).value;
                }
            }

            // Get GTT per-horizon prediction data
            const gttHorizons: Record<string, number> = {};
            // Check all 10 horizons + input_close
            [...ALL_HORIZON_KEYS, 'input_close'].forEach(key => {
                const seriesKey = key === 'input_close' ? 'gtt_input_close_line' : `gtt_${key}`;
                const gttSeries = indicatorSeriesRefs.current.get(seriesKey);
                if (gttSeries) {
                    const gttData = seriesData.get(gttSeries);
                    if (gttData && 'value' in gttData) {
                        gttHorizons[key] = (gttData as any).value;
                    }
                }
            });

            // Format Data
            const timeStr = typeof param.time === 'number'
                ? new Date(param.time * 1000).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', year: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                })
                : '';

            setTooltipData({
                time: timeStr,
                open,
                high,
                low,
                close,
                volume,
                prediction,
                gttHorizons: Object.keys(gttHorizons).length > 0 ? gttHorizons : undefined,
                x: param.point.x,
                y: param.point.y,
                visible: true
            });
            }); // close requestAnimationFrame
        };

        mainChartRef.current.subscribeCrosshairMove(handleCrosshairMove);

        return () => {
            if (crosshairRafId !== null) cancelAnimationFrame(crosshairRafId);
            if (mainChartRef.current) {
                try {
                    mainChartRef.current.unsubscribeCrosshairMove(handleCrosshairMove);
                } catch (e) {
                    // ignore cleanup errors on unmount
                }
            }
        };
    }, [mainSeriesRef.current, volumeSeriesRef.current]); // Re-bind if series changes

    // onRangeChange Subscription
    useEffect(() => {
        if (!mainChartRef.current || !onRangeChange) return;
        const chart = mainChartRef.current;
        const handleTimeRangeChange = (newVisibleTimeRange: any) => {
            if (newVisibleTimeRange && newVisibleTimeRange.from && newVisibleTimeRange.to) {
                const from = newVisibleTimeRange.from * 1000;
                const to = newVisibleTimeRange.to * 1000;
                onRangeChange(new Date(from), new Date(to));
            }
        };
        chart.timeScale().subscribeVisibleTimeRangeChange(handleTimeRangeChange);
        return () => {
            chart.timeScale().unsubscribeVisibleTimeRangeChange(handleTimeRangeChange);
        };
    }, [onRangeChange]);


    // Sub-Chart Initialization with Sync
    useEffect(() => {
        const hasMACD = activeIndicators.includes('macd');

        // MACD Chart
        if (hasMACD && macdChartContainerRef.current && !macdChartRef.current) {
            const chart = createStandardChart(macdChartContainerRef.current);
            macdChartRef.current = chart;
            attachPriceAxisWheelZoom(macdChartContainerRef.current, macdChartRef as { current: IChartApi | null });
            const histogramSeries = chart.addSeries(HistogramSeries, { color: '#26a69a' });
            const macdSeries = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: 'MACD' });
            const signalSeries = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, title: 'Signal' });
            indicatorSeriesRefs.current.set('macd_hist', histogramSeries);
            indicatorSeriesRefs.current.set('macd_line', macdSeries);
            indicatorSeriesRefs.current.set('macd_signal', signalSeries);

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, bidAskChartRef.current, buySellChartRef.current]);
        } else if (!hasMACD && macdChartRef.current) {
            removePriceAxisWheelZoom(macdChartContainerRef.current);
            macdChartRef.current.remove();
            macdChartRef.current = null;
            indicatorSeriesRefs.current.delete('macd_hist');
            indicatorSeriesRefs.current.delete('macd_line');
            indicatorSeriesRefs.current.delete('macd_signal');
        }

        // Bid/Ask Chart
        if (showBidAsk && bidAskChartContainerRef.current && !bidAskChartRef.current) {
            const chart = createStandardChart(bidAskChartContainerRef.current);
            bidAskChartRef.current = chart;
            attachPriceAxisWheelZoom(bidAskChartContainerRef.current, bidAskChartRef as { current: IChartApi | null });

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, macdChartRef.current, buySellChartRef.current]);
        } else if (!showBidAsk && bidAskChartRef.current) {
            removePriceAxisWheelZoom(bidAskChartContainerRef.current);
            bidAskChartRef.current.remove();
            bidAskChartRef.current = null;
            indicatorSeriesRefs.current.delete('bid_line');
            indicatorSeriesRefs.current.delete('ask_line');
            indicatorSeriesRefs.current.delete('bidask_spread');
            indicatorSeriesRefs.current.delete('bidask_std');
        }

        // Buy/Sell Chart
        if (showBuySell && buySellChartContainerRef.current && !buySellChartRef.current) {
            const chart = createStandardChart(buySellChartContainerRef.current);
            buySellChartRef.current = chart;
            attachPriceAxisWheelZoom(buySellChartContainerRef.current, buySellChartRef as { current: IChartApi | null });

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, macdChartRef.current, bidAskChartRef.current]);
        } else if (!showBuySell && buySellChartRef.current) {
            removePriceAxisWheelZoom(buySellChartContainerRef.current);
            buySellChartRef.current.remove();
            buySellChartRef.current = null;
            indicatorSeriesRefs.current.delete('buy_vol');
            indicatorSeriesRefs.current.delete('sell_vol');
            indicatorSeriesRefs.current.delete('buysell_spread');
            indicatorSeriesRefs.current.delete('buysell_std');
        }

    }, [activeIndicators, showBidAsk, showBuySell, colors, syncCharts]);

    // RSI Chart — keep creation, teardown, and data application in one effect so
    // company switches cannot leave an empty sub-chart between effect passes.
    useEffect(() => {
        if (!mainChartRef.current) return;

        const hasRSI = activeIndicators.includes('rsi');

        if (!hasRSI) {
            if (rsiChartRef.current) {
                removePriceAxisWheelZoom(rsiChartContainerRef.current);
                try { rsiChartRef.current.remove(); } catch (_) {}
                rsiChartRef.current = null;
                indicatorSeriesRefs.current.delete('rsi');
            }
            return;
        }

        if (!rsiChartRef.current && rsiChartContainerRef.current) {
            const chart = createStandardChart(rsiChartContainerRef.current);
            rsiChartRef.current = chart;
            attachPriceAxisWheelZoom(rsiChartContainerRef.current, rsiChartRef as { current: IChartApi | null });
            const rsiSeries = chart.addSeries(LineSeries, { color: '#7e57c2', lineWidth: 2, title: 'RSI 14' });
            try {
                (rsiSeries as any).createPriceLine({ price: 70, color: '#ef5350', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
                (rsiSeries as any).createPriceLine({ price: 30, color: '#26a69a', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
            } catch (_) {}
            indicatorSeriesRefs.current.set('rsi', rsiSeries);

            if (mainChartRef.current) {
                syncCharts(mainChartRef.current, [chart]);
                try {
                    const currentRange = mainChartRef.current.timeScale().getVisibleLogicalRange();
                    if (currentRange) chart.timeScale().setVisibleLogicalRange(currentRange);
                } catch (_) {}
            }
            syncCharts(chart, [mainChartRef.current, macdChartRef.current, bidAskChartRef.current, buySellChartRef.current]);
        }

        if (!data || data.length === 0) return;
        if (!rsiChartRef.current || !indicatorSeriesRefs.current.has('rsi')) return;

        const processedForRsi = processData(data);
        if (processedForRsi.length === 0) return;

        const rsiSeries = indicatorSeriesRefs.current.get('rsi');
        const rsiClosePrices = processedForRsi.map(d => d.close);
        const rsiData = calculateRSI(rsiClosePrices);
        const points = processedForRsi
            .map((d, i) => ({ time: d.time, value: rsiData[i] ?? NaN }))
            .filter(d => !isNaN(d.value));

        rsiSeries?.setData(points);

        try {
            const logicalRange = mainChartRef.current.timeScale().getVisibleLogicalRange();
            if (logicalRange) {
                rsiChartRef.current.timeScale().setVisibleLogicalRange(logicalRange);
            } else {
                rsiChartRef.current.timeScale().fitContent();
            }
        } catch (_) {}
    }, [activeIndicators, data, processData, syncCharts]);

    // Data Updates
    useEffect(() => {
        if (!mainChartRef.current) return;

        const mainChart = mainChartRef.current as any;
        const companyChanged = prevCompanyIdRef.current !== companyId;
        const chartTypeChanged = prevChartTypeRef.current !== null && prevChartTypeRef.current !== chartType;
        const intervalChanged = prevIntervalRef.current !== null && prevIntervalRef.current !== selectedInterval;
        prevCompanyIdRef.current = companyId;
        prevChartTypeRef.current = chartType;
        prevIntervalRef.current = selectedInterval;

        // Determine if we need to fully recreate series or can just update data in-place
        const needsSeriesRecreation = companyChanged || chartTypeChanged || intervalChanged || !mainSeriesRef.current;

        // When company or interval changes, we need a clean slate
        if (companyChanged || intervalChanged) {
            const reason = companyChanged ? `company changed to ${companyId}` : `interval changed to ${selectedInterval}`;
            console.log(`🔄 [DATA UPDATE] ${reason} — clearing all series`);
            needsInitialFitRef.current = true; // Force fit on next data load
            prevDataLengthRef.current = 0;
            prevLastCandleTimeRef.current = null;
            // Reset auto-scale to locked (true) on interval change for fresh data
            if (intervalChanged && !companyChanged) {
                setAutoScaleLocked(true);
            }
            // Remove main series
            if (mainSeriesRef.current) {
                try { mainChart.removeSeries(mainSeriesRef.current); } catch (e) { }
                mainSeriesRef.current = null;
            }
            // Remove volume series so it's recreated with correct data
            if (volumeSeriesRef.current) {
                try { mainChart.removeSeries(volumeSeriesRef.current); } catch (e) { }
                volumeSeriesRef.current = null;
            }
            // Remove prediction markers
            if (predictionMarkersRef.current) {
                try { predictionMarkersRef.current.detach(); } catch (e) { }
                predictionMarkersRef.current = null;
            }
            // Remove GTT prediction markers
            if (gttPredictionMarkersRef.current) {
                try { gttPredictionMarkersRef.current.detach(); } catch (e) { }
                gttPredictionMarkersRef.current = null;
            }
            // Remove overlay indicator series that live on the main chart
            const keysToRemove = ['overlay_ma_20', 'overlay_ma_50', 'overlay_ema_9', 'overlay_ema_21', 'overlay_bb_upper', 'overlay_bb_lower', 'prediction_line', 'gtt_input_close_line'];
            // Also remove all per-horizon GTT series
            ALL_HORIZON_KEYS.forEach(hk => keysToRemove.push(`gtt_${hk}`));
            keysToRemove.forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) {
                    try { mainChart.removeSeries(s); } catch (e) { }
                    indicatorSeriesRefs.current.delete(k);
                }
            });
        } else if (chartTypeChanged) {
            // Chart type changed but same company — remove series but keep predictions/indicators
            console.log(`🔄 [DATA UPDATE] Chart type changed to ${chartType} — recreating main & volume series`);
            if (mainSeriesRef.current) {
                try { mainChart.removeSeries(mainSeriesRef.current); } catch (e) { }
                mainSeriesRef.current = null;
            }
            if (volumeSeriesRef.current) {
                try { mainChart.removeSeries(volumeSeriesRef.current); } catch (e) { }
                volumeSeriesRef.current = null;
            }
        }

        // If no data, bail but leave chart clean
        if (!data || data.length === 0) {
            console.log(`📊 [DATA UPDATE] No data for ${companyId}`);
            return;
        }

        const processedData = processData(data);

        // isIncrementalUpdate: set inside the DATA-ONLY branch after prepareMainSeriesData() is
        // declared; used by the volume-series update below which runs after the main-series block.
        let isIncrementalUpdate = false;

        // --- Main Chart Data ---
        // OPTIMIZATION: When only data changed (background loading / incremental merge),
        // reuse the existing series and just call setData(). This prevents the chart from
        // flickering, jumping, or resetting the user's zoom/pan position.
        // Only recreate the series when the company or chart type has actually changed.

        // Helper: prepare data for the current chart type
        const prepareMainSeriesData = () => {
            if (chartType === 'line' || chartType === 'area') {
                return processedData.map(d => ({ time: d.time, value: d.close }));
            } else if (chartType === 'heikenAshi') {
                const haData = convertToHeikenAshi(data as any);
                const processedHa = processData(haData);
                return processedHa.map(d => ({
                    time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
                }));
            } else {
                // candlestick (default)
                return processedData.map(d => ({
                    time: d.time, open: d.open, high: d.high, low: d.low, close: d.close,
                }));
            }
        };

        if (needsSeriesRecreation) {
            // Full series creation — only on company change, chart type change, or first load
            if (mainSeriesRef.current) {
                try { mainChart.removeSeries(mainSeriesRef.current); } catch (e) { }
                mainSeriesRef.current = null;
            }

            // Save visible range before recreation so we can restore it (for chart type changes)
            let savedVisibleRange: { from: number; to: number } | null = null;
            if (!companyChanged && !needsInitialFitRef.current) {
                try {
                    const vr = mainChart.timeScale().getVisibleRange();
                    if (vr) savedVisibleRange = { from: vr.from as number, to: vr.to as number };
                } catch (e) { }
            }

            let series: ISeriesApi<any>;
            const candlestickOptions = {
                upColor: colors.up,
                downColor: colors.down,
                borderUpColor: colors.up,
                borderDownColor: colors.down,
                wickUpColor: colors.up,
                wickDownColor: colors.down,
            };

            if (chartType === 'line') {
                const firstClose = processedData[0]?.close || 0;
                const lastClose = processedData[processedData.length - 1]?.close || 0;
                const lineColor = lastClose >= firstClose ? colors.up : colors.down;
                series = mainChart.addSeries(LineSeries, {
                    color: lineColor,
                    lineWidth: 2,
                    crosshairMarkerVisible: true,
                    crosshairMarkerRadius: 4,
                });
            } else if (chartType === 'area') {
                const firstClose = processedData[0]?.close || 0;
                const lastClose = processedData[processedData.length - 1]?.close || 0;
                const isPositive = lastClose >= firstClose;
                series = mainChart.addSeries(AreaSeries, {
                    topColor: isPositive ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
                    bottomColor: isPositive ? 'rgba(38, 166, 154, 0)' : 'rgba(239, 83, 80, 0)',
                    lineColor: isPositive ? colors.up : colors.down,
                    lineWidth: 2,
                });
            } else if (chartType === 'heikenAshi') {
                series = mainChart.addSeries(CandlestickSeries, candlestickOptions);
            } else {
                series = mainChart.addSeries(CandlestickSeries, candlestickOptions);
            }

            const createdData = prepareMainSeriesData();
            series.setData(createdData);
            mainSeriesRef.current = series;
            // Track for incremental updates on subsequent ticks
            prevDataLengthRef.current = createdData.length;
            prevLastCandleTimeRef.current = createdData.length > 0 ? (createdData[createdData.length - 1].time as number) : null;

            console.log(`📊 [DATA UPDATE] Created new ${chartType} series with ${processedData.length} data points`);

            // Restore visible range if this was a chart type change (not a company change or initial load)
            if (savedVisibleRange && !needsInitialFitRef.current) {
                try {
                    mainChart.timeScale().setVisibleRange({
                        from: savedVisibleRange.from as UTCTimestamp,
                        to: savedVisibleRange.to as UTCTimestamp,
                    });
                    console.log(`📊 [DATA UPDATE] Restored visible range after chart type change`);
                } catch (e) { }
            }
        } else {
            // DATA-ONLY UPDATE: Reuse existing series.
            // INCREMENTAL OPTIMISATION: If only the last candle changed (live tick updating
            // high/low/close within the current minute), call series.update() which is O(1).
            // Only fall back to setData() when new candles are added or on first load.
            const newData = prepareMainSeriesData();

            isIncrementalUpdate = (
                newData.length > 0 &&
                newData.length === prevDataLengthRef.current &&
                newData[newData.length - 1].time === prevLastCandleTimeRef.current
            );

            if (isIncrementalUpdate) {
                // Same number of candles, same last-candle timestamp → in-progress candle update
                mainSeriesRef.current!.update(newData[newData.length - 1]);
            } else {
                // New candle added, initial load, or interval/data-structure change → full replace
                mainSeriesRef.current!.setData(newData);
            }

            // Track for next call
            prevDataLengthRef.current = newData.length;
            prevLastCandleTimeRef.current = newData.length > 0 ? (newData[newData.length - 1].time as number) : null;

            // Update line/area color dynamically based on price movement
            if (chartType === 'line') {
                const firstClose = processedData[0]?.close || 0;
                const lastClose = processedData[processedData.length - 1]?.close || 0;
                const lineColor = lastClose >= firstClose ? colors.up : colors.down;
                mainSeriesRef.current!.applyOptions({ color: lineColor });
            } else if (chartType === 'area') {
                const firstClose = processedData[0]?.close || 0;
                const lastClose = processedData[processedData.length - 1]?.close || 0;
                const isPositive = lastClose >= firstClose;
                mainSeriesRef.current!.applyOptions({
                    topColor: isPositive ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
                    bottomColor: isPositive ? 'rgba(38, 166, 154, 0)' : 'rgba(239, 83, 80, 0)',
                    lineColor: isPositive ? colors.up : colors.down,
                });
            }

        }

        // Volume histogram — reuse existing series if possible, same as main series
        if (needsSeriesRecreation || !volumeSeriesRef.current) {
            if (volumeSeriesRef.current) {
                try { mainChart.removeSeries(volumeSeriesRef.current); } catch (e) { }
                volumeSeriesRef.current = null;
            }
            volumeSeriesRef.current = mainChart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume_scale',
                visible: showVolume,
            });
            mainChart.priceScale('volume_scale').applyOptions({
                scaleMargins: { top: 0.55, bottom: 0 },
                visible: false,
            });
        }

        // Validate and filter volume data to prevent display issues
        const volumeData = processedData
            .map(d => {
                // Ensure volume is a valid, finite number
                const volume = Number(d.volume);
                if (!isFinite(volume) || volume < 0 || isNaN(volume)) {
                    return null;
                }

                return {
                    time: d.time,
                    value: volume,
                    color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
                };
            })
            .filter((v): v is NonNullable<typeof v> => v !== null);

        // Volume: same incremental strategy as main series
        if (volumeSeriesRef.current) {
            if (isIncrementalUpdate && volumeData.length > 0) {
                volumeSeriesRef.current.update(volumeData[volumeData.length - 1]);
            } else {
                volumeSeriesRef.current.setData(volumeData);
            }
        }


        // --- Indicators (optimized: reuse existing series when possible) ---
        const closePrices = processedData.map(d => d.close);

        if (activeIndicators.includes('ma')) {
            [20, 50].forEach(period => {
                const key = `overlay_ma_${period}`;
                const ma = calculateSMA(closePrices, period);
                const maData = processedData.map((d, i) => ({ time: d.time, value: ma[i] || NaN })).filter(d => !isNaN(d.value));
                const existing = indicatorSeriesRefs.current.get(key);
                if (existing && !needsSeriesRecreation) {
                    // Reuse: just update data
                    existing.setData(maData);
                } else {
                    // Create new series
                    if (existing) { try { mainChart.removeSeries(existing); } catch (e) { } indicatorSeriesRefs.current.delete(key); }
                    const series = mainChart.addSeries(LineSeries, { color: period === 20 ? 'yellow' : 'orange', lineWidth: 1, title: `MA ${period}` });
                    series.setData(maData);
                    indicatorSeriesRefs.current.set(key, series);
                }
            });
        } else {
            ['overlay_ma_20', 'overlay_ma_50'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
        }

        if (activeIndicators.includes('ema')) {
            const emaConfigs: Array<{ period: number; color: string }> = [
                { period: 9,  color: '#818cf8' }, // indigo
                { period: 21, color: '#fb923c' }, // orange
            ];
            emaConfigs.forEach(({ period, color }) => {
                const key = `overlay_ema_${period}`;
                const ema = calculateEMA(closePrices, period);
                const emaData = processedData
                    .map((d, i) => ({ time: d.time, value: ema[i] ?? NaN }))
                    .filter(d => !isNaN(d.value));
                const existing = indicatorSeriesRefs.current.get(key);
                if (existing && !needsSeriesRecreation) {
                    existing.setData(emaData);
                } else {
                    if (existing) { try { mainChart.removeSeries(existing); } catch (e) { } indicatorSeriesRefs.current.delete(key); }
                    const series = mainChart.addSeries(LineSeries, { color, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: `EMA ${period}` });
                    series.setData(emaData);
                    indicatorSeriesRefs.current.set(key, series);
                }
            });
        } else {
            ['overlay_ema_9', 'overlay_ema_21'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
        }

        if (activeIndicators.includes('bollinger')) {
            const bb = calculateBollinger(closePrices);
            const upperData = processedData.map((d, i) => ({ time: d.time, value: bb.upper[i] || NaN })).filter(d => !isNaN(d.value));
            const lowerData = processedData.map((d, i) => ({ time: d.time, value: bb.lower[i] || NaN })).filter(d => !isNaN(d.value));

            const existingUpper = indicatorSeriesRefs.current.get('overlay_bb_upper');
            const existingLower = indicatorSeriesRefs.current.get('overlay_bb_lower');

            if (existingUpper && existingLower && !needsSeriesRecreation) {
                // Reuse: just update data
                existingUpper.setData(upperData);
                existingLower.setData(lowerData);
            } else {
                // Create new series
                if (existingUpper) { try { mainChart.removeSeries(existingUpper); } catch (e) { } indicatorSeriesRefs.current.delete('overlay_bb_upper'); }
                if (existingLower) { try { mainChart.removeSeries(existingLower); } catch (e) { } indicatorSeriesRefs.current.delete('overlay_bb_lower'); }
                const upper = mainChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: 'BB Upper' });
                const lower = mainChart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: 'BB Lower' });
                upper.setData(upperData);
                lower.setData(lowerData);
                indicatorSeriesRefs.current.set('overlay_bb_upper', upper);
                indicatorSeriesRefs.current.set('overlay_bb_lower', lower);
            }
        } else {
            ['overlay_bb_upper', 'overlay_bb_lower'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
        }

        if (activeIndicators.includes('macd') && macdChartRef.current) {
            const macdRes = calculateMACD(closePrices);
            const hist = indicatorSeriesRefs.current.get('macd_hist');
            const line = indicatorSeriesRefs.current.get('macd_line');
            const signal = indicatorSeriesRefs.current.get('macd_signal');

            hist?.setData(processedData.map((d, i) => ({
                time: d.time,
                value: macdRes.histogram[i] || NaN,
                color: (macdRes.histogram[i] || 0) >= 0 ? '#26a69a' : '#ef5350'
            })).filter(d => !isNaN(d.value)));
            line?.setData(processedData.map((d, i) => ({ time: d.time, value: macdRes.macdLine[i] || NaN })).filter(d => !isNaN(d.value)));
            signal?.setData(processedData.map((d, i) => ({ time: d.time, value: macdRes.signalLine[i] || NaN })).filter(d => !isNaN(d.value)));
            if (needsSeriesRecreation && macdChartRef.current) {
                try {
                    const logicalRange = mainChartRef.current.timeScale().getVisibleLogicalRange();
                    if (logicalRange) {
                        macdChartRef.current.timeScale().setVisibleLogicalRange(logicalRange);
                    } else {
                        macdChartRef.current.timeScale().fitContent();
                    }
                } catch (_) {}
            }
        }

        // --- Bid/Ask Chart Logic (optimized: reuse series on data-only updates) ---
        if (showBidAsk && bidAskChartRef.current) {
            const chart = bidAskChartRef.current;
            // Helper: check if existing series match current mode
            const bidAskSeriesExist = (mode: string) => {
                if (mode === 'Line') return indicatorSeriesRefs.current.has('bid_line') && indicatorSeriesRefs.current.has('ask_line');
                if (mode === 'Spread') return indicatorSeriesRefs.current.has('bidask_spread');
                if (mode === 'STD') return indicatorSeriesRefs.current.has('bidask_std');
                return false;
            };
            const canReuseBidAsk = !needsSeriesRecreation && bidAskSeriesExist(bidAskMode);

            if (!canReuseBidAsk) {
                // Clean up old series first
                ['bid_line', 'ask_line', 'bidask_spread', 'bidask_std'].forEach(k => {
                    const s = indicatorSeriesRefs.current.get(k);
                    if (s) { try { chart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
                });
            }

            if (bidAskMode === 'Line') {
                if (canReuseBidAsk) {
                    indicatorSeriesRefs.current.get('bid_line')?.setData(processedData.map(d => ({ time: d.time, value: d.bid || d.close })));
                    indicatorSeriesRefs.current.get('ask_line')?.setData(processedData.map(d => ({ time: d.time, value: d.ask || d.close })));
                } else {
                    const bidSeries = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'Bid' });
                    const askSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Ask' });
                    bidSeries.setData(processedData.map(d => ({ time: d.time, value: d.bid || d.close })));
                    askSeries.setData(processedData.map(d => ({ time: d.time, value: d.ask || d.close })));
                    indicatorSeriesRefs.current.set('bid_line', bidSeries);
                    indicatorSeriesRefs.current.set('ask_line', askSeries);
                }
            } else if (bidAskMode === 'Spread') {
                const spreadData = processedData.map(d => ({ time: d.time, value: (d.ask && d.bid) ? d.ask - d.bid : 0 }));
                if (canReuseBidAsk) {
                    indicatorSeriesRefs.current.get('bidask_spread')?.setData(spreadData);
                } else {
                    const spreadSeries = chart.addSeries(HistogramSeries, { color: '#3b82f6', title: 'Spread' });
                    spreadSeries.setData(spreadData);
                    indicatorSeriesRefs.current.set('bidask_spread', spreadSeries);
                }
            } else if (bidAskMode === 'STD') {
                const spreads = processedData.map(d => (d.ask && d.bid) ? d.ask - d.bid : 0);
                const stdData = [];
                for (let i = 0; i < spreads.length; i++) {
                    const slice = spreads.slice(Math.max(0, i - 20), i + 1);
                    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                    const sqDiff = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
                    const std = Math.sqrt(sqDiff / slice.length);
                    stdData.push({ time: processedData[i].time, value: std });
                }
                if (canReuseBidAsk) {
                    indicatorSeriesRefs.current.get('bidask_std')?.setData(stdData);
                } else {
                    const stdSeries = chart.addSeries(LineSeries, { color: '#8b5cf6', title: 'Spread STD' });
                    stdSeries.setData(stdData);
                    indicatorSeriesRefs.current.set('bidask_std', stdSeries);
                }
            }
        }

        // --- Buy/Sell Chart Logic (optimized: reuse series on data-only updates) ---
        if (showBuySell && buySellChartRef.current) {
            const chart = buySellChartRef.current;
            const buySellSeriesExist = (mode: string) => {
                if (mode === 'Line') return indicatorSeriesRefs.current.has('buy_vol') && indicatorSeriesRefs.current.has('sell_vol');
                if (mode === 'Spread') return indicatorSeriesRefs.current.has('buysell_spread');
                if (mode === 'STD') return indicatorSeriesRefs.current.has('buysell_std');
                return false;
            };
            const canReuseBuySell = !needsSeriesRecreation && buySellSeriesExist(buySellMode);

            if (!canReuseBuySell) {
                ['buy_vol', 'sell_vol', 'buysell_spread', 'buysell_std'].forEach(k => {
                    const s = indicatorSeriesRefs.current.get(k);
                    if (s) { try { chart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
                });
            }

            if (buySellMode === 'Line') {
                const buyData = processedData.map(d => ({ time: d.time, value: d.buyVolume || 0 }));
                const sellData = processedData.map(d => ({ time: d.time, value: d.sellVolume || 0 }));
                if (canReuseBuySell) {
                    indicatorSeriesRefs.current.get('buy_vol')?.setData(buyData);
                    indicatorSeriesRefs.current.get('sell_vol')?.setData(sellData);
                } else {
                    const buySeries = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'Buy Vol' });
                    const sellSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Sell Vol' });
                    buySeries.setData(buyData);
                    sellSeries.setData(sellData);
                    indicatorSeriesRefs.current.set('buy_vol', buySeries);
                    indicatorSeriesRefs.current.set('sell_vol', sellSeries);
                }
            } else if (buySellMode === 'Spread') {
                const spreadData = processedData.map(d => ({
                    time: d.time,
                    value: (d.buyVolume || 0) - (d.sellVolume || 0),
                    color: ((d.buyVolume || 0) - (d.sellVolume || 0)) >= 0 ? '#26a69a' : '#ef5350'
                }));
                if (canReuseBuySell) {
                    indicatorSeriesRefs.current.get('buysell_spread')?.setData(spreadData);
                } else {
                    const spreadSeries = chart.addSeries(HistogramSeries, { title: 'Net Vol' });
                    spreadSeries.setData(spreadData);
                    indicatorSeriesRefs.current.set('buysell_spread', spreadSeries);
                }
            } else if (buySellMode === 'STD') {
                const vols = processedData.map(d => d.volume);
                const stdData = [];
                for (let i = 0; i < vols.length; i++) {
                    const slice = vols.slice(Math.max(0, i - 20), i + 1);
                    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                    const sqDiff = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
                    const std = Math.sqrt(sqDiff / slice.length);
                    stdData.push({ time: processedData[i].time, value: std });
                }
                if (canReuseBuySell) {
                    indicatorSeriesRefs.current.get('buysell_std')?.setData(stdData);
                } else {
                    const stdSeries = chart.addSeries(LineSeries, { color: '#f59e0b', title: 'Vol STD' });
                    stdSeries.setData(stdData);
                    indicatorSeriesRefs.current.set('buysell_std', stdSeries);
                }
            }
        }

        // ✅ CRITICAL: Only fit/zoom on FIRST data load, company change, or date navigation.
        // On subsequent live updates, preserve the user's manual zoom/pan.
        const lockedDateForRange = lockedDate ?? null;
        const lockedDateChanged = lockToMarketHours && lockedDateForRange !== prevLockedDateRef.current;
        if (processedData.length > 0 && mainChartRef.current && (needsInitialFitRef.current || lockedDateChanged)) {
            if (lockToMarketHours) {
                // ─ Market-hours lock: NEVER call fitContent — always pin 09:15–15:30 IST ─
                // Also re-applies whenever the date changes (date navigation) so that
                // incoming candles for the new date never override the locked range.
                const { open, close } = getMarketUTCRange(lockedDate ?? patternCurves?.date);
                try {
                    mainChartRef.current.timeScale().setVisibleRange({
                        from: open as any,
                        to: (close + 30 * 60) as any,
                    });
                } catch (_) {}
                prevLockedDateRef.current = lockedDateForRange;
            } else if (selectedDuration === 'full') {
                mainChartRef.current.timeScale().fitContent();
            } else {
                // Apply duration zoom inline (avoid circular dep with applyDurationZoom)
                const durationOption = DURATION_OPTIONS.find(d => d.id === selectedDuration);
                if (durationOption) {
                    const latestTime = processedData[processedData.length - 1].time as number;
                    const earliestTime = processedData[0].time as number;
                    let startTime = latestTime - durationOption.seconds;
                    if (startTime < earliestTime) startTime = earliestTime;
                    try {
                        mainChartRef.current.timeScale().setVisibleRange({
                            from: startTime as UTCTimestamp,
                            to: (latestTime + 300) as UTCTimestamp, // 5 min buffer
                        });
                    } catch (e) {
                        mainChartRef.current.timeScale().fitContent();
                    }
                } else {
                    mainChartRef.current.timeScale().fitContent();
                }
            }
            needsInitialFitRef.current = false; // Don't reset user's view on subsequent live ticks
        }

        // Re-apply autoScale setting after any data update to prevent behavioral reversal
        // This ensures the lock icon always matches the actual chart behavior
        mainChart.applyOptions({
            rightPriceScale: {
                autoScale: autoScaleLocked,
            },
        });

        // Track data length for future optimization comparisons
        prevDataLengthRef.current = processedData.length;

    }, [data, companyId, chartType, selectedInterval, activeIndicators, processData, colors, showBidAsk, bidAskMode, showBuySell, buySellMode, selectedDuration, autoScaleLocked]);

    // --- Prediction Lines ---
    useEffect(() => {
        if (!mainChartRef.current) {
            console.log('⚠️ [PREDICTIONS] No main chart ref');
            return;
        }

        if (!showPredictions) {
            console.log('⚠️ [PREDICTIONS] showPredictions is false');
            // Remove existing prediction series
            indicatorSeriesRefs.current.forEach((series, key) => {
                if (key.startsWith('prediction_')) {
                    try { mainChartRef.current?.removeSeries(series); } catch (e) { }
                    indicatorSeriesRefs.current.delete(key);
                }
            });
            return;
        }

        if (!predictions) {
            console.log('⚠️ [PREDICTIONS] No predictions data');
            // Remove existing prediction series
            indicatorSeriesRefs.current.forEach((series, key) => {
                if (key.startsWith('prediction_')) {
                    try { mainChartRef.current?.removeSeries(series); } catch (e) { }
                    indicatorSeriesRefs.current.delete(key);
                }
            });
            return;
        }

        console.log('🔍 [PREDICTIONS] Received predictions:', {
            count: predictions.count,
            company: predictions.company,
            hasData: !!predictions.predictions,
            predictionsKeys: predictions.predictions ? Object.keys(predictions.predictions).length : 0
        });

        const mainChart = mainChartRef.current;

        // Remove old prediction series
        indicatorSeriesRefs.current.forEach((series, key) => {
            if (key.startsWith('prediction_')) {
                try { mainChart.removeSeries(series); } catch (e) { }
                indicatorSeriesRefs.current.delete(key);
            }
        });

        // Process predictions data
        if (predictions && predictions.predictions && (predictions.count || 0) > 0) {
            try {
                const predictionEntries = Object.entries(predictions.predictions as Record<string, PredictionData>);
                console.log(`📊 [PREDICTIONS] Processing ${predictionEntries.length} prediction entries`);

                // Get today's date in IST timezone (YYYY-MM-DD format)
                // This matches the prediction server's date format which uses IST
                const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
                console.log(`📅 [PREDICTIONS] Today's date (IST): ${todayIST}`);

                // Filter predictions for today
                const todayPredictions = predictionEntries
                    .filter(([dateStr]) => {
                        const matches = dateStr.startsWith(todayIST);
                        if (!matches) {
                            console.log(`⏭️ [PREDICTIONS] Skipping ${dateStr} (not today IST: ${todayIST})`);
                        }
                        return matches;
                    })
                    .map(([dateStr, pred]) => {
                        // The dateStr IS the timestamp (format: "2026-02-03 09:15") in IST
                        // Parse it as IST by appending the timezone
                        const normalizedDateStr = dateStr.includes(':') && dateStr.split(':').length === 2
                            ? `${dateStr}:00` // Add seconds if only HH:MM
                            : dateStr;
                        // Convert to ISO format and append IST offset (+05:30)
                        const isoWithTz = normalizedDateStr.replace(' ', 'T') + '+05:30';
                        const parsedDate = new Date(isoWithTz);
                        const time = (parsedDate.getTime() / 1000) as UTCTimestamp;
                        console.log(`📍 [PREDICTIONS] Point: ${dateStr} -> IST parsed: ${parsedDate.toISOString()} -> time: ${time}, value: ${pred.close}`);
                        return {
                            time,
                            value: pred.close
                        };
                    })
                    .filter(p => {
                        const validTime = !isNaN(p.time as number) && isFinite(p.time as number);
                        const validValue = !isNaN(p.value) && isFinite(p.value);
                        if (!validTime) {
                            console.warn(`⚠️ [PREDICTIONS] Invalid time: ${p.time}`);
                        }
                        if (!validValue) {
                            console.warn(`⚠️ [PREDICTIONS] Invalid value: ${p.value}`);
                        }
                        return validTime && validValue;
                    })
                    .sort((a, b) => (a.time as number) - (b.time as number));

                console.log(`✨ [PREDICTIONS] Filtered to ${todayPredictions.length} today's predictions`);

                if (todayPredictions.length > 0) {
                    // Create prediction line series with orange color
                    const predictionSeries = mainChart.addSeries(LineSeries, {
                        color: '#ff9800', // Orange color
                        lineWidth: 2,
                        lineStyle: LineStyle.Solid,
                        crosshairMarkerVisible: true,
                        lastValueVisible: true,
                        priceLineVisible: false,
                        title: 'AI Prediction'
                    });

                    predictionSeries.setData(todayPredictions);
                    
                    // Clean up previous markers plugin if exists
                    if (predictionMarkersRef.current) {
                        try {
                            predictionMarkersRef.current.detach();
                        } catch (e) {
                            // Ignore cleanup errors
                        }
                        predictionMarkersRef.current = null;
                    }
                    
                    // Add diamond markers on each prediction point using createSeriesMarkers (v5.x API)
                    const markers = todayPredictions.map((p) => ({
                        time: p.time,
                        position: 'inBar' as const,
                        color: '#ff9800',
                        shape: 'circle' as const, // LightweightCharts uses 'circle', 'square', 'arrowUp', 'arrowDown'
                        size: 1, // Size for markers (1 = normal, 2 = larger)
                    }));
                    
                    // Use createSeriesMarkers plugin (LightweightCharts v5.x)
                    const markersPlugin = createSeriesMarkers(predictionSeries, markers);
                    predictionMarkersRef.current = markersPlugin;
                    
                    indicatorSeriesRefs.current.set('prediction_line', predictionSeries);

                    console.log(`✅ [PREDICTIONS] Added ${todayPredictions.length} prediction points with markers to chart`);
                    console.log(`📊 [PREDICTIONS] First point: ${new Date((todayPredictions[0].time as number) * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                    console.log(`📊 [PREDICTIONS] Last point: ${new Date((todayPredictions[todayPredictions.length - 1].time as number) * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
                    
                    // NOTE: Do NOT call fitContent() here — it would reset the user's
                    // current zoom/pan position every time predictions are added/updated.
                    // The chart should stay static and under user control.
                    console.log(`📏 [PREDICTIONS] Predictions added without disrupting user's chart view`);
                } else {
                    console.warn('⚠️ [PREDICTIONS] No predictions available for today after filtering');
                }
            } catch (error) {
                console.error('❌ [PREDICTIONS] Error adding predictions to chart:', error);
            }
        } else {
            console.warn('⚠️ [PREDICTIONS] No valid prediction data to display');
        }
    }, [predictions, showPredictions]);

    // --- GTT Prediction Lines: 10 individual horizons + input_close (12 toggleable series) ---
    useEffect(() => {
        if (!mainChartRef.current) {
            return;
        }

        const mainChart = mainChartRef.current;

        // Helper to clean up ALL GTT series (10 horizons + input_close)
        const cleanupGttSeries = () => {
            ALL_HORIZON_KEYS.forEach(hk => {
                const series = indicatorSeriesRefs.current.get(`gtt_${hk}`);
                if (series) {
                    try { mainChart.removeSeries(series); } catch (e) { }
                    indicatorSeriesRefs.current.delete(`gtt_${hk}`);
                }
            });
            const icSeries = indicatorSeriesRefs.current.get('gtt_input_close_line');
            if (icSeries) {
                try { mainChart.removeSeries(icSeries); } catch (e) { }
                indicatorSeriesRefs.current.delete('gtt_input_close_line');
            }
            if (gttPredictionMarkersRef.current) {
                try { gttPredictionMarkersRef.current.detach(); } catch (e) { }
                gttPredictionMarkersRef.current = null;
            }
        };

        if (!showGttPredictions) {
            cleanupGttSeries();
            return;
        }

        if (!gttPredictions) {
            cleanupGttSeries();
            return;
        }

        console.log('🔍 [GTT PREDICTIONS] Received GTT per-horizon data:', {
            horizonCounts: gttPredictions.horizonCounts,
            inputCloseCount: gttPredictions.inputCloseCount,
            company: gttPredictions.company,
        });

        // Remove old GTT series before re-adding
        cleanupGttSeries();

        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        // Helper: convert prediction Record into sorted time-series points for today
        const toChartPoints = (record: Record<string, { close: number }>) => {
            return Object.entries(record)
                .filter(([dateStr]) => dateStr.startsWith(todayIST))
                .map(([dateStr, pred]) => {
                    const normalizedDateStr = dateStr.includes(':') && dateStr.split(':').length === 2
                        ? `${dateStr}:00`
                        : dateStr;
                    const isoWithTz = normalizedDateStr.replace(' ', 'T') + '+05:30';
                    const parsedDate = new Date(isoWithTz);
                    const time = (parsedDate.getTime() / 1000) as UTCTimestamp;
                    return { time, value: pred.close };
                })
                .filter(p => !isNaN(p.time as number) && isFinite(p.time as number) && !isNaN(p.value) && isFinite(p.value))
                .sort((a, b) => (a.time as number) - (b.time as number));
        };

        // Map style strings to LineStyle enum
        const styleMap: Record<string, number> = {
            'solid': LineStyle.Solid,
            'dashed': LineStyle.Dashed,
            'dotted': LineStyle.Dotted,
        };

        try {
            let anySeriesAdded = false;

            // Add each of the 10 horizon lines
            for (const hk of ALL_HORIZON_KEYS) {
                const isVisible = gttHorizonVisibility[hk] !== false; // default true
                const horizonData = gttPredictions.horizonLines?.[hk];
                if (!isVisible || !horizonData) continue;

                const points = toChartPoints(horizonData);
                if (points.length === 0) continue;

                const cfg = HORIZON_LINE_CONFIG[hk];
                if (!cfg) continue;

                const seriesKey = `gtt_${hk}`;
                // Store original title so we can restore it when eye icon is toggled back on
                gttSeriesTitlesRef.current.set(seriesKey, cfg.label);
                const lineSeries = mainChart.addSeries(LineSeries, {
                    color: cfg.color,
                    lineWidth: 1,
                    lineStyle: styleMap[cfg.style] ?? LineStyle.Solid,
                    crosshairMarkerVisible: false,
                    lastValueVisible: showGttLabels,
                    priceLineVisible: false,
                    title: showGttLabels ? cfg.label : '',
                });
                lineSeries.setData(points);
                indicatorSeriesRefs.current.set(seriesKey, lineSeries);
                anySeriesAdded = true;
            }

            // input_close line — green dotted
            if (gttHorizonVisibility['input_close'] !== false && gttPredictions.inputClosePredictions) {
                const icPoints = toChartPoints(gttPredictions.inputClosePredictions);
                if (icPoints.length > 0) {
                    const icKey = 'gtt_input_close_line';
                    gttSeriesTitlesRef.current.set(icKey, 'In.Close');
                    const icSeries = mainChart.addSeries(LineSeries, {
                        color: 'rgba(100, 116, 139, 0.60)',
                        lineWidth: 1,
                        lineStyle: LineStyle.Dotted,
                        crosshairMarkerVisible: false,
                        lastValueVisible: showGttLabels,
                        priceLineVisible: false,
                        title: showGttLabels ? 'In.Close' : '',
                    });
                    icSeries.setData(icPoints);
                    indicatorSeriesRefs.current.set(icKey, icSeries);
                    anySeriesAdded = true;
                }
            }

            // NOTE: Do NOT call fitContent() when GTT series are added — it would
            // reset the user's current zoom/pan. The chart should stay static.

            console.log(`✅ [GTT PREDICTIONS] Added ${[...indicatorSeriesRefs.current.keys()].filter(k => k.startsWith('gtt_')).length} GTT series to chart`);
        } catch (error) {
            console.error('❌ [GTT PREDICTIONS] Error adding GTT predictions to chart:', error);
        }
    }, [gttPredictions, showGttPredictions, gttHorizonVisibility]);

    // Apply Options
    useEffect(() => {
        const opts = {
            layout: { background: { type: ColorType.Solid, color: colors.bg }, textColor: colors.text },
            grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
        };
        mainChartRef.current?.applyOptions(opts);
        rsiChartRef.current?.applyOptions(opts);
        macdChartRef.current?.applyOptions(opts);
        bidAskChartRef.current?.applyOptions(opts);
        buySellChartRef.current?.applyOptions(opts);
    }, [colors]);

    // Apply autoScale toggle to the main chart's price scale
    useEffect(() => {
        if (mainChartRef.current) {
            mainChartRef.current.applyOptions({
                rightPriceScale: {
                    autoScale: autoScaleLocked,
                },
            });
        }
    }, [autoScaleLocked]);

    return (
        <div
            className={`${isFullscreen ? 'fixed inset-0 z-50' : 'relative'} flex flex-col ${className || ''}`}
            style={{
                height: isFullscreen ? '100vh' : height,
                backgroundColor: colors.bg,
                color: colors.text
            }}
        >
            {/* TOP TOOLBAR */}
            <div className="flex items-center px-2 py-1 gap-2 border-b" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
                {/* Symbol/Title */}
                <div className="font-bold text-lg mr-2 flex items-center gap-1">
                    {companyId || 'SYMBOL'}
                    <span className="text-xs font-normal opacity-50 px-1 border rounded">{interval}</span>
                </div>

                {!hideIntervals && (
                    <>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        {/* Intervals - Controls candle aggregation */}
                        <div className="flex bg-muted/20 rounded p-0.5 gap-0.5">
                            {TIME_INTERVALS.map(int => (
                                <button
                                    key={int.id}
                                    onClick={() => { 
                                        setSelectedInterval(int.id); 
                                        needsInitialFitRef.current = true; // Re-fit when interval changes
                                        setAutoScaleLocked(true); // Reset lock to auto-scale for new interval data
                                        onIntervalChange?.(int.id); 
                                    }}
                                    className={`px-2 py-1 text-xs rounded transition-colors hover:bg-muted/50 ${selectedInterval === int.id ? 'bg-background shadow-sm text-primary font-medium' : 'text-muted-foreground'}`}
                                >
                                    {int.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {!hideDuration && (
                    <>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        {/* Duration - Controls visible time range */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                                    <Clock size={14} />
                                    <span className="text-xs">{DURATION_OPTIONS.find(d => d.id === selectedDuration)?.name || 'Duration'}</span>
                                    <ChevronDown size={12} className="opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-1">
                                {DURATION_OPTIONS.map(dur => (
                                    <button
                                        key={dur.id}
                                        onClick={() => {
                                            setSelectedDuration(dur.id);
                                            needsInitialFitRef.current = true; // Re-fit when user explicitly changes duration
                                            if (dur.id === 'full') {
                                                mainChartRef.current?.timeScale().fitContent();
                                                rsiChartRef.current?.timeScale().fitContent();
                                                macdChartRef.current?.timeScale().fitContent();
                                                bidAskChartRef.current?.timeScale().fitContent();
                                                buySellChartRef.current?.timeScale().fitContent();
                                            } else {
                                                applyDurationZoom(dur.id);
                                            }
                                        }}
                                        className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent ${selectedDuration === dur.id ? 'bg-accent/50 text-accent-foreground font-medium' : ''}`}
                                    >
                                        {dur.name}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </>
                )}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Chart Type */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                            {CHART_TYPES.find(t => t.id === chartType)?.icon && React.createElement(CHART_TYPES.find(t => t.id === chartType)!.icon, { size: 16 })}
                            <ChevronDown size={12} className="opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1">
                        {CHART_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id)}
                                className={`flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent ${chartType === type.id ? 'bg-accent/50 text-accent-foreground' : ''}`}
                            >
                                <type.icon size={16} />
                                {type.name}
                            </button>
                        ))}
                    </PopoverContent>
                </Popover>

                {/* Indicators */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2">
                            <Activity size={16} />
                            <span className="text-xs">Indicators</span>
                            <ChevronDown size={12} className="opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2">
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">Active Indicators</div>
                            {AVAILABLE_INDICATORS.map(ind => (
                                <label key={ind.id} className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={activeIndicators.includes(ind.id)}
                                        onChange={() => {
                                            setActiveIndicators(prev => prev.includes(ind.id) ? prev.filter(x => x !== ind.id) : [...prev, ind.id]);
                                        }}
                                        className="rounded border-muted-foreground/30 text-primary focus:ring-primary/20"
                                    />
                                    <span className={`text-sm ${activeIndicators.includes(ind.id) ? 'font-medium' : ''}`}>{ind.name}</span>
                                </label>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* B/A Analysis Types */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={showBidAsk ? "secondary" : "ghost"} size="sm" className="h-8 gap-1 px-2 border border-transparent hover:border-border">
                            <span className="text-xs font-semibold">B/A</span>
                            <ChevronDown size={12} className="opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Bid/Ask Analysis</span>
                                <input
                                    type="checkbox"
                                    checked={showBidAsk}
                                    onChange={() => setShowBidAsk(!showBidAsk)}
                                    className="scale-125 accent-primary"
                                />
                            </div>
                            {showBidAsk && (
                                <div className="grid grid-cols-1 gap-1">
                                    {['Line', 'Spread', 'STD'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setBidAskMode(mode as any)}
                                            className={`flex items-center px-2 py-1.5 text-xs rounded-sm transition-colors ${bidAskMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* B/S Analysis Types */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant={showBuySell ? "secondary" : "ghost"} size="sm" className="h-8 gap-1 px-2 border border-transparent hover:border-border">
                            <span className="text-xs font-semibold">B/S</span>
                            <ChevronDown size={12} className="opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Buy/Sell Analysis</span>
                                <input
                                    type="checkbox"
                                    checked={showBuySell}
                                    onChange={() => setShowBuySell(!showBuySell)}
                                    className="scale-125 accent-primary"
                                />
                            </div>
                            {showBuySell && (
                                <div className="grid grid-cols-1 gap-1">
                                    {['Line', 'Spread', 'STD'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setBuySellMode(mode as any)}
                                            className={`flex items-center px-2 py-1.5 text-xs rounded-sm transition-colors ${buySellMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Auto-Scale Lock Toggle */}
                <Button
                    variant={autoScaleLocked ? "secondary" : "ghost"}
                    size="sm"
                    className={`h-8 w-8 p-0 border transition-colors ${
                        autoScaleLocked
                            ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                            : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                    onClick={() => setAutoScaleLocked(prev => !prev)}
                    title={autoScaleLocked ? 'Auto-scale ON — click to unlock for manual vertical control' : 'Auto-scale OFF — click to lock for auto vertical fitting'}
                >
                    {autoScaleLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </Button>

                {/* Toolbar slot — extra controls injected by the parent (e.g. Pattern Overlay controls) */}
                {toolbarSlot && (
                    <div className="relative flex items-center">
                        {toolbarSlot}
                    </div>
                )}

                <div className="flex-1" />

                {/* Right Side Tools */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    needsInitialFitRef.current = true; // Allow re-fit on reset
                    setAutoScaleLocked(true); // Reset lock to auto-scale
                    if (mainChartRef.current) {
                        mainChartRef.current.priceScale('right').applyOptions({ autoScale: true });
                        try {
                            mainChartRef.current.priceScale('pattern-overlay').applyOptions({ autoScale: true });
                        } catch (_) {}
                        try {
                            mainChartRef.current.priceScale('volume_scale').applyOptions({ autoScale: true });
                        } catch (_) {}
                    }
                    if (lockToMarketHours && mainChartRef.current) {
                        const { open, close } = getMarketUTCRange(lockedDate ?? patternCurves?.date);
                        try {
                            mainChartRef.current.timeScale().setVisibleRange({
                                from: open as any,
                                to: (close + 30 * 60) as any,
                            });
                        } catch (_) {
                            mainChartRef.current.timeScale().fitContent();
                        }
                    } else {
                        mainChartRef.current?.timeScale().fitContent();
                    }
                    rsiChartRef.current?.timeScale().fitContent();
                    macdChartRef.current?.timeScale().fitContent();
                    bidAskChartRef.current?.timeScale().fitContent();
                    buySellChartRef.current?.timeScale().fitContent();
                }} title="Reset View">
                    <RotateCcw size={14} />
                </Button>

                {/* Separate View Button - Hidden when modal is already open */}
                {!isSeparatorModalOpen && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 border-border/60 text-muted-foreground hover:bg-muted/50 hover:border-border hover:text-foreground transition-all duration-200 font-medium"
                    onClick={() => setIsSeparatorModalOpen(true)}
                    title="Open Separate View - Comparative Analysis"
                >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Separate View
                </Button>
                )}

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </Button>
            </div>

            {/* Charts Layout */}
            <div className="flex-1 flex flex-col min-h-0 w-full relative">
                <div className="flex-1 relative w-full h-full min-h-0" ref={mainChartContainerRef}>
                    {/* GTT Labels Eye Toggle — floating overlay inside chart, top-right */}
                    <div className="absolute top-2 right-14 z-10">
                        <Button
                            variant={showGttLabels ? "secondary" : "ghost"}
                            size="sm"
                            className={`h-7 w-7 p-0 border transition-colors shadow-sm backdrop-blur-sm ${
                                showGttLabels
                                    ? 'border-border/60 bg-muted/40 text-foreground hover:bg-muted/60'
                                    : 'border-border/40 bg-background/60 text-muted-foreground hover:border-border hover:text-foreground'
                            }`}
                            onClick={() => setShowGttLabels(prev => !prev)}
                            title={showGttLabels ? 'Hide GTT & cluster labels' : 'Show GTT & cluster labels'}
                        >
                            {showGttLabels ? <Eye size={13} /> : <EyeOff size={13} />}
                        </Button>
                    </div>
                    {/* Loading status badge - minimal, non-intrusive */}
                    {loading && (
                        <div className="absolute top-3 left-3 z-20 pointer-events-none">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md backdrop-blur-sm"
                                style={{
                                    backgroundColor: theme === 'dark' ? 'rgba(39, 39, 42, 0.9)' : 'rgba(244, 244, 245, 0.9)',
                                    border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.5)' : '1px solid rgba(228, 228, 231, 0.8)'
                                }}>
                                <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ backgroundColor: theme === 'dark' ? '#71717a' : '#a1a1aa', animationDelay: '0ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ backgroundColor: theme === 'dark' ? '#71717a' : '#a1a1aa', animationDelay: '150ms' }} />
                                    <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                                        style={{ backgroundColor: theme === 'dark' ? '#71717a' : '#a1a1aa', animationDelay: '300ms' }} />
                                </div>
                                <span className="text-xs" style={{ color: theme === 'dark' ? '#a1a1aa' : '#71717a' }}>
                                    Loading historical data
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ★ Left-edge loading spinner — shown when scrolling into area with no data */}
                    {isLoadingMore && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                            <div className="flex flex-col items-center gap-2 px-3 py-3 rounded-lg backdrop-blur-md shadow-lg"
                                style={{
                                    backgroundColor: theme === 'dark' ? 'rgba(20, 20, 25, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                                    border: theme === 'dark' ? '1px solid rgba(63, 63, 70, 0.6)' : '1px solid rgba(228, 228, 231, 0.8)'
                                }}>
                                <div className="relative w-6 h-6">
                                    <div className="w-6 h-6 rounded-full border-2 animate-spin"
                                        style={{
                                            borderColor: theme === 'dark' ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.15)',
                                            borderTopColor: theme === 'dark' ? '#a78bfa' : '#7c3aed',
                                        }} />
                                </div>
                                <span className="text-[10px] font-medium whitespace-nowrap"
                                    style={{ color: theme === 'dark' ? '#a1a1aa' : '#71717a' }}>
                                    Loading…
                                </span>
                            </div>
                        </div>
                    )}

                    {/* ✅ Status message overlay — inside chart, below toolbar, never shifts layout */}
                    {statusMessage && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/85 text-white text-xs font-medium backdrop-blur-sm shadow-sm">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                <span>{statusMessage}</span>
                            </div>
                        </div>
                    )}
                </div>

                {activeIndicators.includes('rsi') && (
                    <div className="h-[20%] w-full border-t relative min-h-[100px]" style={{ borderColor: colors.border }} ref={rsiChartContainerRef}></div>
                )}
                {activeIndicators.includes('macd') && (
                    <div className="h-[20%] w-full border-t relative min-h-[100px]" style={{ borderColor: colors.border }} ref={macdChartContainerRef}></div>
                )}
                {showBidAsk && (
                    <div className="h-[20%] w-full border-t relative min-h-[100px]" style={{ borderColor: colors.border }} ref={bidAskChartContainerRef}></div>
                )}
                {showBuySell && (
                    <div className="h-[20%] w-full border-t relative min-h-[100px]" style={{ borderColor: colors.border }} ref={buySellChartContainerRef}></div>
                )}
            </div>

            {/* HOVER TOOLTIP */}
            {tooltipData && tooltipData.visible && (
                <div
                    className="absolute pointer-events-none z-50 rounded-lg border shadow-xl backdrop-blur-md"
                    style={{
                        left: 12,
                        top: 50,
                        backgroundColor: theme === 'dark' ? 'rgba(20, 20, 25, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                        borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        padding: '8px 12px',
                        minWidth: '200px'
                    }}
                >
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-gray-500/20">
                        <span className="text-xs font-semibold opacity-70">
                            {tooltipData.time}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {/* OPEN */}
                        <div className="flex justify-between">
                            <span className="opacity-60">Open</span>
                            <span className={`font-mono font-medium ${tooltipData.close >= tooltipData.open ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {tooltipData.open.toFixed(2)}
                            </span>
                        </div>

                        {/* HIGH */}
                        <div className="flex justify-between">
                            <span className="opacity-60">High</span>
                            <span className="font-mono font-medium">
                                {tooltipData.high.toFixed(2)}
                            </span>
                        </div>

                        {/* LOW */}
                        <div className="flex justify-between">
                            <span className="opacity-60">Low</span>
                            <span className="font-mono font-medium">
                                {tooltipData.low.toFixed(2)}
                            </span>
                        </div>

                        {/* CLOSE */}
                        <div className="flex justify-between">
                            <span className="opacity-60">Close</span>
                            <span className={`font-mono font-medium ${tooltipData.close >= tooltipData.open ? 'text-green-500' : 'text-red-500'
                                }`}>
                                {tooltipData.close.toFixed(2)}
                            </span>
                        </div>

                        {/* VOLUME */}
                        {tooltipData.volume !== undefined && (
                            <div className="col-span-2 flex justify-between mt-1 pt-1 border-t border-gray-500/20">
                                <span className="opacity-60">Vol</span>
                                <span className="font-mono font-medium text-blue-400">
                                    {tooltipData.volume.toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* AI PREDICTION (Regular) */}
                        {tooltipData.prediction !== undefined && (
                            <div className="col-span-2 flex justify-between mt-1 pt-1 border-t border-orange-500/30">
                                <span className="opacity-60 flex items-center gap-1">
                                    <span className="text-orange-500">◆</span> AI Prediction
                                </span>
                                <span className="font-mono font-medium text-orange-500">
                                    {tooltipData.prediction.toFixed(2)}
                                </span>
                            </div>
                        )}

                        {/* GTT HORIZON PREDICTIONS */}
                        {tooltipData.gttHorizons && Object.keys(tooltipData.gttHorizons).length > 0 && (
                            <>
                                {Object.entries(tooltipData.gttHorizons).map(([key, value], idx) => {
                                    const cfg = key === 'input_close'
                                        ? { label: 'In.Close', color: '#64748b', style: 'dotted' as const }
                                        : HORIZON_LINE_CONFIG[key];
                                    if (!cfg) return null;
                                    const shape = key === 'input_close' ? '·' : cfg.style === 'dashed' ? '╌' : '—';
                                    return (
                                        <div key={key} className={`col-span-2 flex justify-between ${idx === 0 ? 'mt-1 pt-1 border-t border-white/10' : 'mt-0.5'}`}>
                                            <span className="opacity-60 flex items-center gap-1">
                                                <span style={{ color: cfg.color }}>{shape}</span> {cfg.label}
                                            </span>
                                            <span className="font-mono font-medium" style={{ color: cfg.color }}>
                                                {value.toFixed(2)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Separate View Modal - Reusable Component */}
            <SeparateViewModal
                isOpen={isSeparatorModalOpen}
                onClose={() => setIsSeparatorModalOpen(false)}
                symbol={companyId || 'Unknown'}
                chartType={chartType as any}
                predictions={predictions}
                LiveChartComponent={MarketDataStockChart}
                liveChartProps={{
                    companyId,
                    data,
                    interval,
                    loading,
                    height: '100%',
                    theme: theme,
                    defaultChartType: chartType,
                }}
            />
        </div>
    );
}
