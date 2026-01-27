'use client';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    createChart,
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
    MouseEventParams
} from 'lightweight-charts';
import {
    Settings,
    Sun,
    Moon,
    Maximize2,
    Minimize2,
    RotateCcw,
    Activity,
    BarChart2,
    TrendingUp,
    Grid,
    ChevronDown
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

// --- Types ---

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

const CHART_TYPES = [
    { id: 'candlestick', name: 'Candles', icon: BarChart2 },
    { id: 'line', name: 'Line', icon: TrendingUp },
    { id: 'area', name: 'Area', icon: Activity },
    { id: 'heikenAshi', name: 'Heiken Ashi', icon: Grid },
];

export function LightWeightStockChart({
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
    defaultChartType = 'line',
    onThemeChange,
    onIntervalChange,
    onRangeChange,
    className
}: StockChartProps) {
    // State
    const [activeIndicators, setActiveIndicators] = useState<string[]>(indicators);
    const [chartType, setChartType] = useState(defaultChartType);
    const [selectedInterval, setSelectedInterval] = useState(interval);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [chartTheme, setChartTheme] = useState<'light' | 'dark'>(theme);

    // Sync theme prop with local state
    useEffect(() => {
        setChartTheme(theme);
    }, [theme]);

    // Analysis State
    const [showBidAsk, setShowBidAsk] = useState(false);
    const [bidAskMode, setBidAskMode] = useState<'Line' | 'Spread' | 'STD'>('Line');
    const [showBuySell, setShowBuySell] = useState(false);
    const [buySellMode, setBuySellMode] = useState<'Line' | 'Spread' | 'STD'>('Line');

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
        bg: chartTheme === 'dark' ? CHART_BG_DARK : CHART_BG_LIGHT,
        text: chartTheme === 'dark' ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT,
        grid: chartTheme === 'dark' ? GRID_COLOR_DARK : GRID_COLOR_LIGHT,
        up: '#26a69a',
        down: '#ef5350',
        wickUp: '#26a69a',
        wickDown: '#ef5350',
        transparent: 'rgba(0,0,0,0)',
        border: chartTheme === 'dark' ? '#2a2e39' : '#e0e3eb',
    }), [chartTheme]);

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
            width: container.clientWidth,
            height: container.clientHeight,
            timeScale: {
                timeVisible: true,
                borderColor: colors.grid,
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
            timeScale: {
                timeVisible: true,
                borderColor: initialColors.grid,
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
            },
            crosshair: {
                mode: CrosshairMode.Normal,
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

        const handleResize = () => {
            if (mainChartContainerRef.current && mainChartRef.current) {
                const width = mainChartContainerRef.current.clientWidth;
                const height = mainChartContainerRef.current.clientHeight;
                mainChartRef.current.applyOptions({ width, height });
            }
            if (rsiChartContainerRef.current && rsiChartRef.current) {
                rsiChartRef.current.applyOptions({ width: rsiChartContainerRef.current.clientWidth, height: rsiChartContainerRef.current.clientHeight });
            }
            if (macdChartContainerRef.current && macdChartRef.current) {
                macdChartRef.current.applyOptions({ width: macdChartContainerRef.current.clientWidth, height: macdChartContainerRef.current.clientHeight });
            }
            if (bidAskChartContainerRef.current && bidAskChartRef.current) {
                bidAskChartRef.current.applyOptions({ width: bidAskChartContainerRef.current.clientWidth, height: bidAskChartContainerRef.current.clientHeight });
            }
            if (buySellChartContainerRef.current && buySellChartRef.current) {
                buySellChartRef.current.applyOptions({ width: buySellChartContainerRef.current.clientWidth, height: buySellChartContainerRef.current.clientHeight });
            }
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        if (mainChartContainerRef.current) {
            resizeObserver.observe(mainChartContainerRef.current);
        }
        // Observe window as backup or for other containers if they resize independently
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            chart.remove();
            mainChartRef.current = null;
            mainSeriesRef.current = null;
            volumeSeriesRef.current = null;
            indicatorSeriesRefs.current.clear();
        };
    }, []);

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
        const hasRSI = activeIndicators.includes('rsi');
        const hasMACD = activeIndicators.includes('macd');

        // RSI Chart
        if (hasRSI && rsiChartContainerRef.current && !rsiChartRef.current) {
            const chart = createStandardChart(rsiChartContainerRef.current);
            rsiChartRef.current = chart;
            const rsiSeries = chart.addSeries(LineSeries, { color: '#7e57c2', lineWidth: 2, title: 'RSI 14' });
            (rsiSeries as any).createPriceLine({ price: 70, color: '#ef5350', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
            (rsiSeries as any).createPriceLine({ price: 30, color: '#26a69a', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' });
            indicatorSeriesRefs.current.set('rsi', rsiSeries);

            // Sync logic
            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, macdChartRef.current, bidAskChartRef.current, buySellChartRef.current]);
        } else if (!hasRSI && rsiChartRef.current) {
            rsiChartRef.current.remove();
            rsiChartRef.current = null;
            indicatorSeriesRefs.current.delete('rsi');
        }

        // MACD Chart
        if (hasMACD && macdChartContainerRef.current && !macdChartRef.current) {
            const chart = createStandardChart(macdChartContainerRef.current);
            macdChartRef.current = chart;
            const histogramSeries = chart.addSeries(HistogramSeries, { color: '#26a69a' });
            const macdSeries = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, title: 'MACD' });
            const signalSeries = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2, title: 'Signal' });
            indicatorSeriesRefs.current.set('macd_hist', histogramSeries);
            indicatorSeriesRefs.current.set('macd_line', macdSeries);
            indicatorSeriesRefs.current.set('macd_signal', signalSeries);

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, bidAskChartRef.current, buySellChartRef.current]);
        } else if (!hasMACD && macdChartRef.current) {
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

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, macdChartRef.current, buySellChartRef.current]);
        } else if (!showBidAsk && bidAskChartRef.current) {
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

            if (mainChartRef.current) syncCharts(mainChartRef.current, [chart]);
            syncCharts(chart, [mainChartRef.current, rsiChartRef.current, macdChartRef.current, bidAskChartRef.current]);
        } else if (!showBuySell && buySellChartRef.current) {
            buySellChartRef.current.remove();
            buySellChartRef.current = null;
            indicatorSeriesRefs.current.delete('buy_vol');
            indicatorSeriesRefs.current.delete('sell_vol');
            indicatorSeriesRefs.current.delete('buysell_spread');
            indicatorSeriesRefs.current.delete('buysell_std');
        }

    }, [activeIndicators, showBidAsk, showBuySell, colors, syncCharts]);

    // Data Updates
    useEffect(() => {
        if (!mainChartRef.current || !data) return;

        const processedData = processData(data);
        const mainChart = mainChartRef.current as any;

        // --- Main Chart Data ---
        if (mainSeriesRef.current) {
            try { mainChart.removeSeries(mainSeriesRef.current); } catch (e) { }
            mainSeriesRef.current = null;
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
            // Determine line color based on price movement (first vs last close)
            const firstClose = processedData[0]?.close || 0;
            const lastClose = processedData[processedData.length - 1]?.close || 0;
            const lineColor = lastClose >= firstClose ? colors.up : colors.down;
            
            series = mainChart.addSeries(LineSeries, { 
                color: lineColor,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
            });
            series.setData(processedData.map(d => ({ time: d.time, value: d.close })));
        } else if (chartType === 'area') {
            // Area chart with dynamic color
            const firstClose = processedData[0]?.close || 0;
            const lastClose = processedData[processedData.length - 1]?.close || 0;
            const isPositive = lastClose >= firstClose;
            
            series = mainChart.addSeries(AreaSeries, { 
                topColor: isPositive ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)',
                bottomColor: isPositive ? 'rgba(38, 166, 154, 0)' : 'rgba(239, 83, 80, 0)',
                lineColor: isPositive ? colors.up : colors.down,
                lineWidth: 2,
            });
            series.setData(processedData.map(d => ({ time: d.time, value: d.close })));
        } else if (chartType === 'heikenAshi') {
            series = mainChart.addSeries(CandlestickSeries, candlestickOptions);
            const haData = convertToHeikenAshi(data as any);
            const processedHa = processData(haData);
            // Format data for candlestick series
            const candleData = processedHa.map(d => ({
                time: d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            series.setData(candleData);
        } else {
            // Default candlestick chart
            series = mainChart.addSeries(CandlestickSeries, candlestickOptions);
            // Format data correctly for candlestick series
            const candleData = processedData.map(d => ({
                time: d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            console.log(`📊 [CandlestickChart] Setting ${candleData.length} candles. First:`, candleData[0], 'Last:', candleData[candleData.length - 1]);
            series.setData(candleData);
        }
        mainSeriesRef.current = series;

        // Volume histogram - overlay at bottom of chart with separate scale
        if (!volumeSeriesRef.current) {
            volumeSeriesRef.current = mainChart.addSeries(HistogramSeries, {
                priceFormat: { type: 'volume' },
                priceScaleId: 'volume_scale',
            });
            
            // Configure the volume scale to be at the bottom portion of the chart
            mainChart.priceScale('volume_scale').applyOptions({
                scaleMargins: { top: 0.55, bottom: 0 },
                visible: false, // Hide the volume scale labels
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
        
        volumeSeriesRef.current?.setData(volumeData);


        // --- Indicators ---
        const closePrices = data.map(d => d.close);

        if (activeIndicators.includes('ma')) {
            ['overlay_ma_20', 'overlay_ma_50'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
            [20, 50].forEach(period => {
                const ma = calculateSMA(closePrices, period);
                const series = mainChart.addSeries(LineSeries, { color: period === 20 ? 'yellow' : 'orange', lineWidth: 1, title: `MA ${period}` });
                const maData = processedData.map((d, i) => ({ time: d.time, value: ma[i] || NaN })).filter(d => !isNaN(d.value));
                series.setData(maData);
                indicatorSeriesRefs.current.set(`overlay_ma_${period}`, series);
            });
        }

        if (activeIndicators.includes('bollinger')) {
            ['overlay_bb_upper', 'overlay_bb_lower'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
            const bb = calculateBollinger(closePrices);
            const upper = mainChart.addSeries(LineSeries, { color: 'blue', lineWidth: 1, title: 'BB Upper' });
            const lower = mainChart.addSeries(LineSeries, { color: 'blue', lineWidth: 1, title: 'BB Lower' });

            upper.setData(processedData.map((d, i) => ({ time: d.time, value: bb.upper[i] || NaN })).filter(d => !isNaN(d.value)));
            lower.setData(processedData.map((d, i) => ({ time: d.time, value: bb.lower[i] || NaN })).filter(d => !isNaN(d.value)));

            indicatorSeriesRefs.current.set('overlay_bb_upper', upper);
            indicatorSeriesRefs.current.set('overlay_bb_lower', lower);
        } else {
            ['overlay_bb_upper', 'overlay_bb_lower'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { mainChart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });
        }

        if (activeIndicators.includes('rsi') && rsiChartRef.current && indicatorSeriesRefs.current.has('rsi')) {
            const rsiSeries = indicatorSeriesRefs.current.get('rsi');
            const rsiData = calculateRSI(closePrices);
            rsiSeries?.setData(processedData.map((d, i) => ({ time: d.time, value: rsiData[i] || NaN })).filter(d => !isNaN(d.value)));
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
        }

        // --- Bid/Ask Chart Logic ---
        if (showBidAsk && bidAskChartRef.current) {
            const chart = bidAskChartRef.current;
            ['bid_line', 'ask_line', 'bidask_spread', 'bidask_std'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { chart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });

            if (bidAskMode === 'Line') {
                const bidSeries = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'Bid' });
                const askSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Ask' });
                bidSeries.setData(processedData.map(d => ({ time: d.time, value: d.bid || d.close })));
                askSeries.setData(processedData.map(d => ({ time: d.time, value: d.ask || d.close })));
                indicatorSeriesRefs.current.set('bid_line', bidSeries);
                indicatorSeriesRefs.current.set('ask_line', askSeries);
            } else if (bidAskMode === 'Spread') {
                const spreadSeries = chart.addSeries(HistogramSeries, { color: '#3b82f6', title: 'Spread' });
                spreadSeries.setData(processedData.map(d => ({
                    time: d.time,
                    value: (d.ask && d.bid) ? d.ask - d.bid : 0
                })));
                indicatorSeriesRefs.current.set('bidask_spread', spreadSeries);
            } else if (bidAskMode === 'STD') {
                const stdSeries = chart.addSeries(LineSeries, { color: '#8b5cf6', title: 'Spread STD' });
                const spreads = processedData.map(d => (d.ask && d.bid) ? d.ask - d.bid : 0);
                const stdData = [];
                for (let i = 0; i < spreads.length; i++) {
                    const slice = spreads.slice(Math.max(0, i - 20), i + 1);
                    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                    const sqDiff = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
                    const std = Math.sqrt(sqDiff / slice.length);
                    stdData.push({ time: processedData[i].time, value: std });
                }
                stdSeries.setData(stdData);
                indicatorSeriesRefs.current.set('bidask_std', stdSeries);
            }
        }

        // --- Buy/Sell Chart Logic ---
        if (showBuySell && buySellChartRef.current) {
            const chart = buySellChartRef.current;
            ['buy_vol', 'sell_vol', 'buysell_spread', 'buysell_std'].forEach(k => {
                const s = indicatorSeriesRefs.current.get(k);
                if (s) { try { chart.removeSeries(s); } catch (e) { } indicatorSeriesRefs.current.delete(k); }
            });

            if (buySellMode === 'Line') {
                const buySeries = chart.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1, title: 'Buy Vol' });
                const sellSeries = chart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, title: 'Sell Vol' });
                buySeries.setData(processedData.map(d => ({ time: d.time, value: d.buyVolume || 0 })));
                sellSeries.setData(processedData.map(d => ({ time: d.time, value: d.sellVolume || 0 })));
                indicatorSeriesRefs.current.set('buy_vol', buySeries);
                indicatorSeriesRefs.current.set('sell_vol', sellSeries);
            } else if (buySellMode === 'Spread') {
                const spreadSeries = chart.addSeries(HistogramSeries, { title: 'Net Vol' });
                spreadSeries.setData(processedData.map(d => ({
                    time: d.time,
                    value: (d.buyVolume || 0) - (d.sellVolume || 0),
                    color: ((d.buyVolume || 0) - (d.sellVolume || 0)) >= 0 ? '#26a69a' : '#ef5350'
                })));
                indicatorSeriesRefs.current.set('buysell_spread', spreadSeries);
            } else if (buySellMode === 'STD') {
                const stdSeries = chart.addSeries(LineSeries, { color: '#f59e0b', title: 'Vol STD' });
                const vols = processedData.map(d => d.volume);
                const stdData = [];
                for (let i = 0; i < vols.length; i++) {
                    const slice = vols.slice(Math.max(0, i - 20), i + 1);
                    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                    const sqDiff = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0);
                    const std = Math.sqrt(sqDiff / slice.length);
                    stdData.push({ time: processedData[i].time, value: std });
                }
                stdSeries.setData(stdData);
                indicatorSeriesRefs.current.set('buysell_std', stdSeries);
            }
        }

    }, [data, chartType, activeIndicators, processData, colors, showBidAsk, bidAskMode, showBuySell, buySellMode]);

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

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Intervals */}
                <div className="flex bg-muted/20 rounded p-0.5 gap-0.5">
                    {TIME_INTERVALS.map(int => (
                        <button
                            key={int.id}
                            onClick={() => { setSelectedInterval(int.id); onIntervalChange?.(int.id); }}
                            className={`px-2 py-1 text-xs rounded transition-colors hover:bg-muted/50 ${selectedInterval === int.id ? 'bg-background shadow-sm text-primary font-medium' : 'text-muted-foreground'}`}
                        >
                            {int.name}
                        </button>
                    ))}
                </div>

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

                <div className="flex-1" />

                {/* Right Side Tools */}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    mainChartRef.current?.timeScale().fitContent();
                    rsiChartRef.current?.timeScale().fitContent();
                    macdChartRef.current?.timeScale().fitContent();
                    bidAskChartRef.current?.timeScale().fitContent();
                    buySellChartRef.current?.timeScale().fitContent();
                }} title="Reset View">
                    <RotateCcw size={14} />
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    const newTheme = chartTheme === 'dark' ? 'light' : 'dark';
                    setChartTheme(newTheme);
                    onThemeChange?.(newTheme);
                }} title="Toggle Theme">
                    {chartTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </Button>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </Button>
            </div>

            {/* Charts Layout */}
            <div className="flex-1 flex flex-col min-h-0 w-full relative">
                <div className="flex-1 relative w-full h-full min-h-0" ref={mainChartContainerRef}>
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
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
        </div>
    );
}
