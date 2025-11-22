'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { ChevronRight, TrendingUp, BarChart3, LineChart, CandlestickChart, ArrowLeftRight, ShoppingCart, TrendingDown, Maximize2, X } from 'lucide-react';

// Add Plotly import for restyle operations
declare const Plotly: any;

// ============ CONFIGURATION CONSTANTS ============
// Time Range & Buffer Constants
const FUTURE_BUFFER_MS = 15 * 60 * 1000; // 15 minutes in milliseconds
const PREDICTION_EXTENSION_MS = 5 * 60 * 1000; // 5 minutes extension for predictions

// Y-Axis Padding Constants
const Y_AXIS_BASE_PADDING = 0.10; // 10% base padding
const Y_AXIS_TOP_MULTIPLIER = 1.2; // 20% extra padding at top for predictions

// Timeframe Duration Constants (in milliseconds)
const TIMEFRAME_DURATIONS = {
  '1m': 1 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '12H': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  'default': 60 * 60 * 1000, // 1 hour
} as const;

// Trading Day Constants (for 1D view)
const TRADING_DAY_START_HOUR = 9;
const TRADING_DAY_START_MINUTE = 15;
const TRADING_DAY_END_HOUR = 15;
const TRADING_DAY_END_MINUTE = 30;

// Technical Indicator Constants
const SMA_PERIOD = 20;
const EMA_PERIOD = 9;
const RSI_PERIOD = 14;
const VOLUME_STD_DEV_WINDOW = 20;

// Chart Display Constants
const CHART_HEIGHT = 600;
const SECONDARY_CHART_HEIGHT = 300;
const FONT_SIZE_TITLE = 14;
const FONT_SIZE_AXIS = 12;
const LINE_WIDTH = 2;
const CANDLESTICK_WIDTH = 0.8;

// ============ END CONSTANTS ============

interface DataPoint {
  ltp: number;
  timestamp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  sma20?: number;
  ema9?: number;
  rsi14?: number;
  bid?: number;
  ask?: number;
  buyVolume?: number;
  sellVolume?: number;
}

interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
}

// ✨ NEW: Ultra-fast chart update interface
interface ChartUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  changePercent: number;
}

// ✨ NEW: Prediction data interface
interface PredictionData {
  timestamp: string;
  close: number;
  predictedat: string;
}

interface CompanyPredictions {
  company: string;
  predictions: Record<string, PredictionData>;
  count: number;
  starttime?: string;
  endtime?: string;
}

interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
  chartUpdates: ChartUpdate[];        // ✨ NEW PROP
  updateFrequency?: number;           // ✨ NEW PROP
  predictions?: CompanyPredictions | null;  // ✨ NEW: Prediction data
  showPredictions?: boolean;          // ✨ NEW: Toggle predictions
  predictionRevision?: number;        // ✨ CRITICAL: Force re-render when predictions update
  desirabilityScore?: number | null;  // ✨ NEW: Desirability score for dynamic background
  tradingHours: {
    start: string;
    end: string;
    current: string;
    isActive: boolean;
  };
}

const PlotlyChart: React.FC<PlotlyChartProps> = ({
  symbol,
  data,
  historicalData,
  ohlcData = [],
  chartUpdates = [],          // ✨ NEW PROP
  updateFrequency = 0,        // ✨ NEW PROP
  predictions = null,         // ✨ NEW: Prediction data
  showPredictions = false,    // ✨ NEW: Toggle predictions
  predictionRevision = 0,     // ✨ CRITICAL: Force re-render counter
  desirabilityScore = null,   // ✨ NEW: Desirability score for dynamic background
  tradingHours,
}) => {
  const chartRef = useRef<any>(null);
  const spreadChartRef = useRef<any>(null);
  const bidAskChartRef = useRef<any>(null);
  const buySellVolumeChartRef = useRef<any>(null);
  const buySellLineChartRef = useRef<any>(null);
  const buySellSpreadChartRef = useRef<any>(null);
  const volumeChartRef = useRef<any>(null);

  const [initialized, setInitialized] = useState(false);
  // ✅ DEFAULT: Show 1 hour view
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1H');

  // const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');

  // ✅ NEW: Track user interactions for zoom/pan preservation
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [preservedRange, setPreservedRange] = useState<{
    xaxis?: [any, any];
    yaxis?: [any, any];
  }>({});

  // ✅ ENHANCED: Log prediction revision changes
  useEffect(() => {
    console.log(`🔄 [CHART] predictionRevision changed to ${predictionRevision}`);
  }, [predictionRevision]);

  // ✅ CRITICAL: Create stable prediction key to force re-renders when predictions change
  const predictionKey = useMemo(() => {
    if (!predictions || !predictions.predictions) return 'no-predictions';
    const count = predictions.count || 0;
    const keys = Object.keys(predictions.predictions);
    const firstKey = keys[0] || '';
    const lastKey = keys[keys.length - 1] || '';
    return `pred-${count}-${firstKey}-${lastKey}`;
  }, [predictions]);

  // ✅ Log prediction key changes
  useEffect(() => {
    console.log(`🔮 [CHART] predictionKey changed to ${predictionKey}`);
  }, [predictionKey]);

  // � Track prediction revision changes
  useEffect(() => {
    console.log(`🔄 [PREDICTION REVISION CHANGE] predictionRevision=${predictionRevision}, predictionKey=${predictionKey}`);
  }, [predictionRevision, predictionKey]);

  // �🔀 Separator Modal State
  const [isSeparatorModalOpen, setIsSeparatorModalOpen] = useState(false);

  const [mainMode, setMainMode] = useState<'none' | 'bidAsk' | 'buySell'>('none');
  const [secondaryView, setSecondaryView] = useState<'line' | 'spread' | 'std'>('line');
  const [showIndicators, setShowIndicators] = useState({
    sma20: false,
    ema9: false,
    rsi: false,
    macd: false,
    bb: false,
    vwap: false,
    volume: false,
  });

  const [preservedAxisRanges, setPreservedAxisRanges] = useState<{
    xaxis?: [Date, Date];
    yaxis?: [number, number];
  }>({});

  // ============ OPTIMIZED: Throttled chart updates ============
  const lastUpdateRef = useRef<number>(0);
  const updateThrottleMs = 500; // Update chart maximum once every 500ms

  // ============ YOUR EXISTING CALCULATION FUNCTIONS (Keep all as is) ============
  const calculateBuySellVolume = (dataPoint: DataPoint | OHLCPoint) => {
    let buyVolume = 0;
    let sellVolume = 0;
    const totalVolume = dataPoint.volume || 0;

    if ('buyVolume' in dataPoint && 'sellVolume' in dataPoint) {
      buyVolume = dataPoint.buyVolume || 0;
      sellVolume = dataPoint.sellVolume || 0;
    } else {
      let priceChange = 0;
      if ('open' in dataPoint && 'close' in dataPoint) {
        priceChange = (dataPoint.close - dataPoint.open) / dataPoint.open;
      } else if ('ltp' in dataPoint) {
        const currentIndex = historicalData.findIndex(p => p.timestamp === dataPoint.timestamp);
        if (currentIndex > 0) {
          const prevPrice = historicalData[currentIndex - 1].ltp;
          priceChange = (dataPoint.ltp - prevPrice) / prevPrice;
        }
      }

      const buyRatio = Math.max(0, Math.min(1, 0.5 + priceChange * 2));
      buyVolume = totalVolume * buyRatio;
      sellVolume = totalVolume * (1 - buyRatio);
    }

    return { buyVolume, sellVolume };
  };

  const calculateBuySellPrices = (dataPoint: DataPoint | OHLCPoint, index: number) => {
    let currentPrice = 0;
    if ('ltp' in dataPoint) {
      currentPrice = dataPoint.ltp;
    } else if ('close' in dataPoint) {
      currentPrice = dataPoint.close;
    }

    // Calculate spread based on volatility and volume
    const windowSize = 20;
    let prices: number[] = [];

    if (chartType === 'line') {
      const startIndex = Math.max(0, index - windowSize + 1);
      prices = historicalData.slice(startIndex, index + 1).map(p => p.ltp);
    } else {
      const startIndex = Math.max(0, index - windowSize + 1);
      prices = ohlcData.slice(startIndex, index + 1).map(c => c.close);
    }

    // Calculate volatility (standard deviation)
    if (prices.length > 1) {
      const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
      const avgSquaredDiff = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
      const volatility = Math.sqrt(avgSquaredDiff);

      // Spread based on volatility (typically 0.1% to 1% of price)
      const spreadPercent = Math.min(Math.max(volatility / currentPrice, 0.001), 0.01);
      const halfSpread = currentPrice * spreadPercent / 2;

      return {
        buyPrice: currentPrice + halfSpread,
        sellPrice: currentPrice - halfSpread
      };
    }

    // Fallback to simple 0.1% spread
    const defaultSpread = currentPrice * 0.001;
    return {
      buyPrice: currentPrice + defaultSpread,
      sellPrice: currentPrice - defaultSpread
    };
  };

  // ============ ENHANCED: prepareLineChartData with chartUpdates integration ============
  const prepareLineChartData = useMemo(() => {
    // ✅ DATA MERGE: Combine historical (pre-filtered by API) + live updates + current point
    const dataMap = new Map<number, DataPoint>();

    // ✅ CRITICAL FIX: NO FILTERING - API already returns TODAY's data only (9:15 AM onwards)
    // The old logic incorrectly calculated tradingStartTimestamp using local browser time,
    // causing valid intraday data to be filtered out.

    // 🔍 DEBUG: Log input data
    console.log(`🔍 [prepareLineChartData] Input:`, {
      historicalCount: historicalData.length,
      chartUpdatesCount: chartUpdates?.length || 0,
      hasCurrentData: !!data,
      firstHistorical: historicalData[0],
      lastHistorical: historicalData[historicalData.length - 1]
    });

    // ✅ Add ALL historical data (API guarantees TODAY only, no filtering needed)
    historicalData.forEach(point => {
      if (point.ltp > 0 && !isNaN(point.ltp) && point.timestamp > 0) {
        if (!dataMap.has(point.timestamp)) {
          dataMap.set(point.timestamp, point);
        }
      }
    });

    // ✨ ENHANCED: Merge chart updates for ultra-smooth line
    // Only add updates if timestamp is NEW (don't overwrite historical data)
    if (chartUpdates && chartUpdates.length > 0) {
      chartUpdates.forEach(update => {
        if (!dataMap.has(update.timestamp)) {
          dataMap.set(update.timestamp, {
            symbol: update.symbol,
            ltp: update.price,
            timestamp: update.timestamp,
            volume: update.volume,
            change: update.change,
            changePercent: update.changePercent
          } as DataPoint);
        }
      });
    }

    // Add current data point if not already in map (only if new)
    if (data && data.ltp && data.ltp > 0 && !isNaN(data.ltp)) {
      if (!dataMap.has(data.timestamp)) {
        dataMap.set(data.timestamp, data);
      }
    }

    // Convert to array and sort (this maintains ALL data from 9:15 AM onwards)
    const allData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    console.log(`📊 [prepareLineChartData] Output:`, {
      totalPoints: allData.length,
      firstPoint: allData[0] ? { timestamp: allData[0].timestamp, date: new Date(allData[0].timestamp * 1000), ltp: allData[0].ltp } : null,
      lastPoint: allData[allData.length - 1] ? { timestamp: allData[allData.length - 1].timestamp, date: new Date(allData[allData.length - 1].timestamp * 1000), ltp: allData[allData.length - 1].ltp } : null
    });

    const x = allData.map(point => new Date(point.timestamp * 1000));
    const y = allData.map(point => point.ltp);
    const bid = allData.map(point => point.bid || null);
    const ask = allData.map(point => point.ask || null);

    const spread = allData.map(point => {
      if (point.ask && point.bid) {
        return point.ask - point.bid;
      }
      return null;
    });

    const sma20 = allData.map(point => point.sma20 || null);
    const ema9 = allData.map(point => point.ema9 || null);
    const rsi = allData.map(point => point.rsi14 || null);

    const buyVolumes = allData.map(point => calculateBuySellVolume(point).buyVolume);
    const sellVolumes = allData.map(point => calculateBuySellVolume(point).sellVolume);

    // Calculate buy/sell prices (simplified calculation)
    const buyPrices = allData.map(point => point.ltp * 1.001); // Slightly above LTP
    const sellPrices = allData.map(point => point.ltp * 0.999); // Slightly below LTP

    const buySellSpreads = allData.map((point, index) => buyPrices[index] - sellPrices[index]);

    return {
      x,
      y,
      allData,
      sma20,
      ema9,
      rsi,
      bid,
      ask,
      spread,
      buyVolumes,
      sellVolumes,
      buyPrices,
      sellPrices,
      buySellSpreads
    };
  }, [historicalData, chartUpdates, data]); // ✅ CRITICAL: Only recalculate when data actually changes

  const calculateStandardDeviation = (values: number[], usePopulation = false) => {
    if (values.length === 0) return 0;
    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
    const sumOfSquaredDifferences = values.reduce((acc, val) => acc + (val - mean) ** 2, 0);
    return Math.sqrt(sumOfSquaredDifferences / (values.length - (usePopulation ? 0 : 1)));
  };

  const calculateVolumeStandardDeviation = (dataPoint: DataPoint | OHLCPoint, index: number) => {
    const windowSize = 20;
    let volumes: number[] = [];
    if (chartType === 'line') {
      const startIndex = Math.max(0, index - windowSize + 1);
      volumes = historicalData.slice(startIndex, index + 1)
        .map(point => point.volume || 0)
        .filter(vol => vol > 0);
    } else {
      const startIndex = Math.max(0, index - windowSize + 1);
      volumes = ohlcData.slice(startIndex, index + 1)
        .map(candle => candle.volume || 0)
        .filter(vol => vol > 0);
    }
    return volumes.length > 1 ? calculateStandardDeviation(volumes) : 0;
  };

  const calculateBidAskStandardDeviation = () => {
    const { bid, ask, x } = lineChartData;
    const windowSize = 20;
    const bidStdDev = [];
    const askStdDev = [];
    for (let i = 0; i < bid.length; i++) {
      const startIndex = Math.max(0, i - windowSize + 1);
      const bidWindow = bid.slice(startIndex, i + 1).filter((b: number | null) => b !== null && b !== undefined) as number[];
      const askWindow = ask.slice(startIndex, i + 1).filter((a: number | null) => a !== null && a !== undefined) as number[];
      bidStdDev.push(bidWindow.length > 1 ? calculateStandardDeviation(bidWindow) : 0);
      askStdDev.push(askWindow.length > 1 ? calculateStandardDeviation(askWindow) : 0);
    }
    return { x, bidStdDev, askStdDev };
  };

  const calculateBuySellStandardDeviation = () => {
    let x: Date[] = [];
    let buyPrices: number[] = [];
    let sellPrices: number[] = [];
    if (chartType === 'line') {
      x = lineChartData.x;
      buyPrices = lineChartData.buyPrices;
      sellPrices = lineChartData.sellPrices;
    } else {
      x = candlestickData.x;
      buyPrices = candlestickData.buyPrices;
      sellPrices = candlestickData.sellPrices;
    }
    const windowSize = 20;
    const buyStdDev = [];
    const sellStdDev = [];
    for (let i = 0; i < buyPrices.length; i++) {
      const startIndex = Math.max(0, i - windowSize + 1);
      const buyWindow = buyPrices.slice(startIndex, i + 1).filter((p: number) => p !== null && p !== undefined && !isNaN(p)) as number[];
      const sellWindow = sellPrices.slice(startIndex, i + 1).filter((p: number) => p !== null && p !== undefined && !isNaN(p)) as number[];
      buyStdDev.push(buyWindow.length > 1 ? calculateStandardDeviation(buyWindow) : 0);
      sellStdDev.push(sellWindow.length > 1 ? calculateStandardDeviation(sellWindow) : 0);
    }
    return { x, buyStdDev, sellStdDev };
  };

  const calculateSMA = (prices: number[], period: number) => {
    if (prices.length < period) return [];
    const smaValues = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      smaValues.push(sum / period);
    }
    return smaValues;
  };

  const calculateEMA = (prices: number[], period: number) => {
    if (prices.length < period) return [];
    const multiplier = 2 / (period + 1);
    const emaValues = [];
    const firstSMA = prices.slice(0, period).reduce((acc, val) => acc + val, 0) / period;
    emaValues.push(firstSMA);

    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] * multiplier) + (emaValues[emaValues.length - 1] * (1 - multiplier));
      emaValues.push(ema);
    }
    return emaValues;
  };

  const calculateRSI = (prices: number[], period: number) => {
    if (prices.length < period + 1) return [];
    const gains = [];
    const losses = [];
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsiValues = [];
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0) / period;
      if (avgLoss === 0) {
        rsiValues.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push(rsi);
      }
    }
    return rsiValues;
  };

  const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
    if (prices.length < period) return null;
    const smaValues = calculateSMA(prices, period);
    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = 0; i < smaValues.length; i++) {
      const startIndex = i + period - 1;
      const slice = prices.slice(startIndex - period + 1, startIndex + 1);
      const std = calculateStandardDeviation(slice);
      middle.push(smaValues[i]);
      upper.push(smaValues[i] + (std * stdDev));
      lower.push(smaValues[i] - (std * stdDev));
    }
    return { upper, middle, lower };
  };

  const calculateMACD = (prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
    if (prices.length < slowPeriod) return null;
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);
    if (fastEMA.length === 0 || slowEMA.length === 0) return null;

    const macdLine = [];
    const startIndex = slowPeriod - fastPeriod;
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + startIndex] - slowEMA[i]);
    }

    const signalLine = calculateEMA(macdLine, signalPeriod);
    const histogram = [];
    for (let i = signalPeriod - 1; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i - signalPeriod + 1]);
    }

    return { macdLine, signalLine, histogram };
  };

  const calculateVWAP = (close: number[], high: number[], low: number[], volume: number[]) => {
    const vwapValues = [];
    let cumulativePriceVolume = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < close.length; i++) {
      const typicalPrice = (high[i] + low[i] + close[i]) / 3;
      cumulativePriceVolume += typicalPrice * volume[i];
      cumulativeVolume += volume[i];
      vwapValues.push(cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typicalPrice);
    }
    return vwapValues;
  };

  const prepareCandlestickData = useMemo(() => {
    if (!ohlcData || ohlcData.length === 0) {
      return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [], buyPrices: [], sellPrices: [], buySellSpreads: [] };
    }

    const validOhlcData = ohlcData.filter(candle =>
      candle.open !== null && candle.open !== undefined &&
      candle.high !== null && candle.high !== undefined &&
      candle.low !== null && candle.low !== undefined &&
      candle.close !== null && candle.close !== undefined
    );

    if (validOhlcData.length === 0) {
      return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [], buyPrices: [], sellPrices: [], buySellSpreads: [] };
    }

    // ✅ FIX: Deduplicate by timestamp (prevents double rendering)
    const uniqueData = new Map<number, OHLCPoint>();
    validOhlcData.forEach(candle => {
      const existing = uniqueData.get(candle.timestamp);
      // Keep the latest candle if there are duplicates
      if (!existing || existing.timestamp <= candle.timestamp) {
        uniqueData.set(candle.timestamp, candle);
      }
    });

    const sortedData = Array.from(uniqueData.values()).sort((a, b) => a.timestamp - b.timestamp);
    const buyVolumes = sortedData.map(candle => calculateBuySellVolume(candle).buyVolume);
    const sellVolumes = sortedData.map(candle => calculateBuySellVolume(candle).sellVolume);
    const volumeStdDev = sortedData.map((candle, index) =>
      calculateVolumeStandardDeviation(candle, index)
    );
    const buyPrices = sortedData.map((candle, index) => calculateBuySellPrices(candle, index).buyPrice);
    const sellPrices = sortedData.map((candle, index) => calculateBuySellPrices(candle, index).sellPrice);
    const buySellSpreads = sortedData.map((candle, index) => {
      const { buyPrice, sellPrice } = calculateBuySellPrices(candle, index);
      return buyPrice - sellPrice;
    });

    const processedVolume = sortedData.map(candle => {
      const vol = candle.volume;
      if (vol === null || vol === undefined || isNaN(vol)) {
        return 0;
      }
      return Number(vol);
    });

    return {
      x: sortedData.map(candle => new Date(candle.timestamp * 1000)),
      open: sortedData.map(candle => Number(candle.open)),
      high: sortedData.map(candle => Number(candle.high)),
      low: sortedData.map(candle => Number(candle.low)),
      close: sortedData.map(candle => Number(candle.close)),
      volume: processedVolume,
      volumeStdDev: volumeStdDev,
      buyVolumes,
      sellVolumes,
      buyPrices,
      sellPrices,
      buySellSpreads
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ohlcData]); // ✅ Only recalculate when OHLC data changes (helper functions are stable)

  const calculateYAxisRange = (timeRange: [any, any] | undefined) => {
    if (!timeRange || !timeRange[0] || !timeRange[1]) return undefined;

    const startTime = new Date(timeRange[0]).getTime() / 1000;
    const endTime = new Date(timeRange[1]).getTime() / 1000;

    let allPrices: number[] = [];

    if (chartType === 'line') {
      if (historicalData.length === 0) return undefined;

      // ✅ Use ALL data points within the time range
      const validData = historicalData.filter(
        point => point.timestamp >= startTime && point.timestamp <= endTime
      );

      if (validData.length > 0) {
        const historicalPrices = validData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
        allPrices.push(...historicalPrices);
      }
    } else {
      if (!ohlcData || ohlcData.length === 0) return undefined;

      // ✅ Use ALL candles within the time range
      const validCandles = ohlcData.filter(
        candle => candle.timestamp >= startTime && candle.timestamp <= endTime
      );

      if (validCandles.length > 0) {
        const filteredCandles = validCandles.filter(candle =>
          candle.high !== null && candle.high !== undefined &&
          candle.low !== null && candle.low !== undefined
        );
        const highPrices = filteredCandles.map(candle => Number(candle.high));
        const lowPrices = filteredCandles.map(candle => Number(candle.low));
        allPrices.push(...highPrices, ...lowPrices);
      }
    }

    // ✅ CRITICAL: Include ALL predictions within the time range
    if (showPredictions && predictions && predictions.count > 0) {
      const predictionEntries = Object.entries(predictions.predictions);

      const predictionPrices = predictionEntries
        .map(([key, pred]) => {
          const predTime = new Date(pred.timestamp || key).getTime() / 1000;
          if (predTime >= startTime && predTime <= endTime) {
            return Number(pred.close);
          }
          return null;
        })
        .filter(p => p !== null && p !== undefined) as number[];

      if (predictionPrices.length > 0) {
        allPrices.push(...predictionPrices);
      }
    }

    if (allPrices.length === 0) return undefined;

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const range = maxPrice - minPrice;

    // ✅ Extra padding for future buffer zone (top and bottom)
    const padding = range * Y_AXIS_BASE_PADDING;

    const yMin = minPrice - padding;
    const yMax = maxPrice + padding * Y_AXIS_TOP_MULTIPLIER; // Extra padding at top for predictions

    return [yMin, yMax];
  };

  const calculateBidAskRange = () => {
    const { bid, ask } = lineChartData;
    const validBids = bid.filter(b => b !== null && b !== undefined) as number[];
    const validAsks = ask.filter(a => a !== null && a !== undefined) as number[];
    if (validBids.length === 0 || validAsks.length === 0) return undefined;
    const minBid = Math.min(...validBids);
    const maxAsk = Math.max(...validAsks);
    const padding = (maxAsk - minBid) * 0.05;
    return [minBid - padding, maxAsk + padding];
  };

  const calculateBuySellRange = () => {
    let buyPrices: number[] = [];
    let sellPrices: number[] = [];
    if (chartType === 'line') {
      const { buyPrices: bp, sellPrices: sp } = lineChartData;
      buyPrices = bp.filter((p: number | null) => p !== null && p !== undefined && !isNaN(p)) as number[];
      sellPrices = sp.filter((p: number | null) => p !== null && p !== undefined && !isNaN(p)) as number[];
    } else {
      const { buyPrices: bp, sellPrices: sp } = candlestickData;
      buyPrices = bp.filter((p: number | null) => p !== null && p !== undefined && !isNaN(p)) as number[];
      sellPrices = sp.filter((p: number | null) => p !== null && p !== undefined && !isNaN(p)) as number[];
    }
    if (buyPrices.length === 0 || sellPrices.length === 0) return undefined;
    const minPrice = Math.min(...sellPrices);
    const maxPrice = Math.max(...buyPrices);
    const padding = (maxPrice - minPrice) * 0.05;
    return [minPrice - padding, maxPrice + padding];
  };

  const calculateSpreadRange = () => {
    const { spread } = lineChartData;
    const validSpreads = spread.filter((s: number | null) => s !== null && s !== undefined) as number[];
    if (validSpreads.length === 0) return [0, 1];
    const minSpread = Math.min(...validSpreads);
    const maxSpread = Math.max(...validSpreads);
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };

  const calculateBuySellSpreadRange = () => {
    let buySellSpreads: number[] = [];
    if (chartType === 'line') {
      const { buySellSpreads: bss } = lineChartData;
      buySellSpreads = bss.filter((s: number) => s !== null && s !== undefined && !isNaN(s)) as number[];
    } else {
      const { buySellSpreads: bss } = candlestickData;
      buySellSpreads = bss.filter((s: number) => s !== null && s !== undefined && !isNaN(s)) as number[];
    }
    if (buySellSpreads.length === 0) return [0, 1];
    const minSpread = Math.min(...buySellSpreads);
    const maxSpread = Math.max(...buySellSpreads);
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };

  const calculateVolumeRange = () => {
    let volumes: number[] = [];
    if (chartType === 'line') {
      volumes = historicalData.map(point => point.volume || 0).filter(v => v > 0);
    } else {
      const { volume } = candlestickData;
      volumes = volume.filter(v => v > 0);
    }
    if (volumes.length === 0) return [0, 1000];
    const maxVolume = Math.max(...volumes);
    return [0, maxVolume * 1.1];
  };

  const calculateBuySellVolumeRange = () => {
    let buyVolumes: number[] = [];
    let sellVolumes: number[] = [];
    if (chartType === 'line') {
      const { buyVolumes: bv, sellVolumes: sv } = lineChartData;
      buyVolumes = bv.filter((v: number) => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter((v: number) => v !== null && v !== undefined) as number[];
    } else {
      const { buyVolumes: bv, sellVolumes: sv } = candlestickData;
      buyVolumes = bv.filter((v: number) => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter((v: number) => v !== null && v !== undefined) as number[];
    }
    if (buyVolumes.length === 0 && sellVolumes.length === 0) return [0, 1000];
    const maxBuyVolume = buyVolumes.length > 0 ? Math.max(...buyVolumes) : 0;
    const maxSellVolume = sellVolumes.length > 0 ? Math.max(...sellVolumes) : 0;
    const maxVolume = Math.max(maxBuyVolume, maxSellVolume);
    return [0, maxVolume * 1.1];
  };

  const getTimeRange = (): [Date, Date] | undefined => {
    // ✅ Use data as-is (already filtered by API to TODAY only)
    const dataToUse = chartType === 'line' ? historicalData : ohlcData;
    if (!dataToUse || dataToUse.length === 0) return undefined;

    // ✅ STEP 1: Find "now" (latest data timestamp or current time)
    const timestamps = dataToUse.map(d => d.timestamp);
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const now = new Date(maxTimestamp * 1000);
    const dataStartDate = new Date(minTimestamp * 1000);
    const currentTime = new Date();

    // ✅ CRITICAL: Log data date range for debugging
    console.log(`📊 [Chart Data Range] ${dataStartDate.toLocaleDateString()} ${dataStartDate.toLocaleTimeString()} → ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);

    let startTime: Date;
    let endTime: Date;

    // ✅ SPECIAL CASE: 1D = Trading Day (9:15 AM to 3:30 PM)
    if (selectedTimeframe === '1D' || selectedTimeframe === '1d') {
      // ✅ CRITICAL FIX: Always use TODAY's date, not historical data dates
      const today = new Date();

      // Trading start: 9:15 AM TODAY
      startTime = new Date(today);
      startTime.setHours(TRADING_DAY_START_HOUR, TRADING_DAY_START_MINUTE, 0, 0);

      // Trading end: 3:30 PM TODAY + 15 min buffer
      endTime = new Date(today);
      endTime.setHours(TRADING_DAY_END_HOUR, TRADING_DAY_END_MINUTE + 15, 0, 0);

      console.log('📅 [1D MODE] Trading Day Range (TODAY ONLY):', {
        today: today.toLocaleDateString(),
        startTime: startTime.toLocaleTimeString(),
        endTime: endTime.toLocaleTimeString(),
        duration: '6h 30min trading day'
      });

    } else {
      // ✅ STEP 2: Calculate start time based on selected timeframe
      // Format: [now - X, now + 15m] where X is the timeframe duration

      // Use constant lookup for known timeframes
      const duration = TIMEFRAME_DURATIONS[selectedTimeframe as keyof typeof TIMEFRAME_DURATIONS];

      if (duration) {
        // ✅ CRITICAL FIX: For 6H, 12H - use current time, NOT data timestamp
        // This ensures we ALWAYS show the full duration back from NOW
        if (selectedTimeframe === '6H' || selectedTimeframe === '12H') {
          startTime = new Date(currentTime.getTime() - duration);
          endTime = new Date(currentTime.getTime() + FUTURE_BUFFER_MS);

          console.log(`⏰ [${selectedTimeframe} MODE] Fixed Duration from Current Time:`, {
            currentTime: currentTime.toLocaleTimeString(),
            startTime: startTime.toLocaleTimeString(),
            endTime: endTime.toLocaleTimeString(),
            hoursBack: duration / (60 * 60 * 1000)
          });
        } else {
          // For shorter timeframes, use latest data point as "now"
          startTime = new Date(now.getTime() - duration);
          endTime = new Date(now.getTime() + FUTURE_BUFFER_MS);

          // ✅ CRITICAL: Ensure start time is not before earliest data
          const earliestDataTime = new Date(minTimestamp * 1000);
          if (startTime < earliestDataTime) {
            console.log(`⚠️ Adjusted start time from ${startTime.toLocaleTimeString()} to earliest data at ${earliestDataTime.toLocaleTimeString()}`);
            startTime = earliestDataTime;
          }
        }
      } else {
        // For "ALL" or unrecognized timeframes, use earliest data point
        startTime = new Date(minTimestamp * 1000);
        endTime = new Date(maxTimestamp * 1000 + FUTURE_BUFFER_MS);
      }
    }

    // ✅ STEP 3: Extend end time if predictions go beyond the buffer
    if (showPredictions && predictions && predictions.count > 0) {
      const predictionEntries = Object.entries(predictions.predictions);
      if (predictionEntries.length > 0) {
        const predictionTimes = predictionEntries.map(([key, pred]) =>
          new Date(pred.timestamp || key).getTime()
        );
        const maxPredTime = Math.max(...predictionTimes);

        // Only extend if predictions go beyond our current end time
        if (maxPredTime > endTime.getTime()) {
          endTime = new Date(maxPredTime + PREDICTION_EXTENSION_MS);
        }
      }
    }

    // ✅ STEP 4: For shorter timeframes (NOT 6H, 12H, 1D), limit to available data
    if (selectedTimeframe !== '6H' && selectedTimeframe !== '12H' &&
      selectedTimeframe !== '1D' && selectedTimeframe !== '1d') {
      const minDataTime = new Date(Math.min(...timestamps) * 1000);
      if (startTime < minDataTime) {
        startTime = minDataTime;
      }
    }

    console.log('⏱️ [TIMEFRAME] Time Range Calculated:', {
      selectedTimeframe,
      startTime: startTime.toLocaleTimeString(),
      endTime: endTime.toLocaleTimeString(),
      duration: `${((endTime.getTime() - startTime.getTime()) / 60000).toFixed(1)} minutes`,
      futureBuffer: `${((endTime.getTime() - now.getTime()) / 60000).toFixed(1)} minutes`
    });

    return [startTime, endTime];
  };

  // ✨ NEW: Helper function to calculate background colors based on desirability score
  const getDesirabilityBackgroundColors = (score: number | null): { bg: string; paper: string } => {
    // Default dark theme colors when no score is available
    if (score === null || score === undefined) {
      return {
        bg: '#18181b',
        paper: '#18181b',
      };
    }

    // Apply color tint based on desirability score thresholds
    if (score >= 0.70) {
      // Green tint for highly desirable (>= 70%)
      return {
        bg: 'rgba(34, 197, 94, 0.10)', // plot_bgcolor with subtle green tint
        paper: 'rgba(34, 197, 94, 0.05)', // paper_bgcolor with very subtle green tint
      };
    }

    if (score >= 0.50) {
      // Yellow tint for moderately desirable (50-69%)
      return {
        bg: 'rgba(234, 179, 8, 0.10)', // plot_bgcolor with subtle yellow tint
        paper: 'rgba(234, 179, 8, 0.05)', // paper_bgcolor with very subtle yellow tint
      };
    }

    if (score >= 0.30) {
      // Orange tint for acceptable (30-49%)
      return {
        bg: 'rgba(249, 115, 22, 0.10)', // plot_bgcolor with subtle orange tint
        paper: 'rgba(249, 115, 22, 0.05)', // paper_bgcolor with very subtle orange tint
      };
    }

    // Red tint for not desirable (< 30%)
    return {
      bg: 'rgba(239, 68, 68, 0.10)', // plot_bgcolor with subtle red tint
      paper: 'rgba(239, 68, 68, 0.05)', // paper_bgcolor with very subtle red tint
    };
  };

  // ✨ Gradient Logic - Top Left corner fading to transparent
  const getDesirabilityGradientClass = (score: number | null): string => {
    if (score === null || score === undefined) return ''; // Default no tint

    // Using radial-gradient starting at top left
    if (score >= 0.70) {
      // High Desirability: Green Tint
      return 'bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.15),_transparent_50%)]';
    }
    if (score >= 0.50) {
      // Moderate: Yellow Tint
      return 'bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.15),_transparent_50%)]';
    }
    if (score >= 0.30) {
      // Acceptable: Orange Tint
      return 'bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.15),_transparent_50%)]';
    }
    // Low: Red Tint
    return 'bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.15),_transparent_50%)]';
  };

  const getColorTheme = () => {
    // Get dynamic background colors based on desirability score
    const backgroundColors = getDesirabilityBackgroundColors(desirabilityScore);

    return {
      bg: 'rgba(0,0,0,0)',
      paper: 'rgba(0,0,0,0)',
      text: '#e4e4e7',
      grid: '#27272a',
      line: getLineColor(),
      upColor: '#22c55e',
      downColor: '#ef4444',
      button: {
        bg: '#27272a',
        bgActive: '#3b82f6',
        text: '#e4e4e7'
      },
      indicator: {
        sma20: '#f97316',
        ema9: '#8b5cf6',
        rsi: '#06b6d4',
        macd: '#3b82f6',
        bb: '#64748b',
        vwap: '#06b6d4',
        bid: '#22c55e',
        ask: '#ef4444',
        spread: '#3b82f6',
        buyVolume: '#22c55e',
        sellVolume: '#ef4444',
        buyPrice: '#10b981',
        sellPrice: '#f59e0b',
        buySellSpread: '#8b5cf6',
        volume: '#64748b',
        std: '#f97316'
      }
    };
  };

  const getLineColor = () => {
    const { y } = lineChartData;
    if (y.length < 2) return '#22d3ee';
    const lastPrice = y[y.length - 1];
    const prevPrice = y[y.length - 2];
    return lastPrice >= prevPrice ? '#22c55e' : '#ef4444';
  };

  const toggleMainMode = (mode: 'bidAsk' | 'buySell') => {
    if (mainMode === mode) {
      setMainMode('none');
    } else {
      setMainMode(mode);
      setSecondaryView('line');
    }
  };

  const toggleSecondaryView = (view: 'line' | 'spread' | 'std') => {
    setSecondaryView(view);
  };

  const handleTimeframeChange = (timeframe: string) => {
    // ✅ Reset user interaction tracking on manual timeframe change
    setUserHasInteracted(false);
    setPreservedRange({});

    setSelectedTimeframe(timeframe);
    setPreservedAxisRanges({});

    if (!chartRef.current) return;
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;

    try {
      const newTimeRange = getTimeRange();
      const newYRange = calculateYAxisRange(newTimeRange);

      if (typeof Plotly !== 'undefined' && Plotly.relayout) {
        Plotly.relayout(plotDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': newYRange,
          'yaxis.autorange': newYRange ? false : true
        });
      }

      const spreadDiv = document.getElementById('spread-chart');
      if (spreadDiv && mainMode === 'bidAsk' && secondaryView === 'spread' && typeof Plotly !== 'undefined') {
        Plotly.relayout(spreadDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateSpreadRange(),
          'yaxis.autorange': false
        });
      }

      const bidAskDiv = document.getElementById('bid-ask-chart');
      if (bidAskDiv && mainMode === 'bidAsk' && secondaryView === 'line' && typeof Plotly !== 'undefined') {
        Plotly.relayout(bidAskDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateBidAskRange(),
          'yaxis.autorange': false
        });
      }

      const volumeDiv = document.getElementById('volume-chart');
      if (volumeDiv && showIndicators.volume && typeof Plotly !== 'undefined') {
        Plotly.relayout(volumeDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateVolumeRange(),
          'yaxis.autorange': false
        });
      }

      const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
      if (buySellVolumeDiv && mainMode !== 'none' && secondaryView === 'std' && typeof Plotly !== 'undefined') {
        Plotly.relayout(buySellVolumeDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateBuySellVolumeRange(),
          'yaxis.autorange': false
        });
      }

      const buySellLineDiv = document.getElementById('buy-sell-line-chart');
      if (buySellLineDiv && mainMode === 'buySell' && secondaryView === 'line' && typeof Plotly !== 'undefined') {
        Plotly.relayout(buySellLineDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateBuySellRange(),
          'yaxis.autorange': false
        });
      }

      const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
      if (buySellSpreadDiv && mainMode === 'buySell' && secondaryView === 'spread' && typeof Plotly !== 'undefined') {
        Plotly.relayout(buySellSpreadDiv, {
          'xaxis.range': newTimeRange,
          'xaxis.autorange': false,
          'yaxis.range': calculateBuySellSpreadRange(),
          'yaxis.autorange': false
        });
      }
    } catch (err) {
      console.error('Error updating timeframe:', err);
      setTimeout(() => {
        try {
          if (chartRef.current) {
            const plotDiv = document.getElementById('plotly-chart');
            if (plotDiv && typeof Plotly !== 'undefined') {
              Plotly.react(plotDiv, createPlotData(), createLayout());
            }
          }
        } catch (fallbackErr) {
          console.error('Fallback chart update failed:', fallbackErr);
        }
      }, 100);
    }
  };

  const toggleChartType = () => {
    const plotDiv = document.getElementById('plotly-chart');
    if (plotDiv && (plotDiv as any).layout) {
      const currentLayout = (plotDiv as any).layout;
      setPreservedAxisRanges({
        xaxis: currentLayout.xaxis?.range ? [
          currentLayout.xaxis.range[0],
          currentLayout.xaxis.range[1]
        ] : undefined,
        yaxis: currentLayout.yaxis?.range ? [
          currentLayout.yaxis.range[0],
          currentLayout.yaxis.range[1]
        ] : undefined,
      });
    }
    setChartType(prev => prev === 'line' ? 'candle' : 'line');
  };

  const toggleIndicator = (indicator: 'sma20' | 'ema9' | 'rsi' | 'macd' | 'bb' | 'vwap' | 'volume') => {
    setShowIndicators(prev => ({
      ...prev,
      [indicator]: !prev[indicator]
    }));
  };

  // ✅ ENHANCED: Capture user interactions and preserve state
  const handleRelayout = (eventData: any) => {
    // ✅ Track user zoom/pan
    if (eventData['xaxis.range[0]'] || eventData['yaxis.range[0]']) {
      setUserHasInteracted(true);
      setPreservedRange({
        xaxis: eventData['xaxis.range[0]'] ?
          [eventData['xaxis.range[0]'], eventData['xaxis.range[1]']] : preservedRange.xaxis,
        yaxis: eventData['yaxis.range[0]'] ?
          [eventData['yaxis.range[0]'], eventData['yaxis.range[1]']] : preservedRange.yaxis,
      });
    }

    // ✅ CRITICAL: Auto-scale y-axis when x-axis range changes
    if (eventData['xaxis.range[0]'] && eventData['xaxis.range[1]']) {
      const startDate = new Date(eventData['xaxis.range[0]']);
      const endDate = new Date(eventData['xaxis.range[1]']);
      const startTime = startDate.getTime() / 1000;
      const endTime = endDate.getTime() / 1000;

      let minValue, maxValue;
      if (chartType === 'line') {
        const visibleData = historicalData.filter(
          point => point.timestamp >= startTime && point.timestamp <= endTime
        );
        if (visibleData.length > 0) {
          const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
          if (prices.length > 0) {
            minValue = Math.min(...prices);
            maxValue = Math.max(...prices);
          }
        }
      } else {
        const visibleData = ohlcData.filter(
          candle => candle.timestamp >= startTime && candle.timestamp <= endTime
        );
        if (visibleData.length > 0) {
          const validCandles = visibleData.filter(candle =>
            candle.high !== null && candle.high !== undefined &&
            candle.low !== null && candle.low !== undefined
          );
          if (validCandles.length > 0) {
            const highPrices = validCandles.map(candle => Number(candle.high));
            const lowPrices = validCandles.map(candle => Number(candle.low));
            minValue = Math.min(...lowPrices);
            maxValue = Math.max(...highPrices);
          }
        }
      }

      // ✅ CRITICAL: Apply autoscaling to y-axis based on visible data
      if (minValue !== undefined && maxValue !== undefined) {
        const padding = (maxValue - minValue) * 0.08;  // 8% padding
        const yRange = [minValue - padding, maxValue + padding];
        const plotDiv = document.getElementById('plotly-chart');
        if (plotDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(plotDiv, {
            'yaxis.range': yRange,
            'yaxis.autorange': false  // Use calculated range
          });
        }

        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(bidAskDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }

        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(spreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }

        const volumeDiv = document.getElementById('volume-chart');
        if (volumeDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(volumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }

        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(buySellVolumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }

        const buySellLineDiv = document.getElementById('buy-sell-line-chart');
        if (buySellLineDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(buySellLineDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }

        const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
        if (buySellSpreadDiv && typeof Plotly !== 'undefined') {
          Plotly.relayout(buySellSpreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
      }
    }
  };

  // ✅ OPTIMIZED: Data is now properly memoized via useMemo in the prepare functions
  const lineChartData = prepareLineChartData;
  const candlestickData = prepareCandlestickData;

  // ============ ENHANCED: Stable chart rendering with state preservation ============
  useEffect(() => {
    if (!chartRef.current || !initialized) {
      if (!initialized) setInitialized(true);
      return;
    }

    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;

    // ✅ THROTTLE: Prevent excessive re-renders during rapid updates
    const now = Date.now();
    if (now - lastUpdateRef.current < updateThrottleMs) {
      return;
    }
    lastUpdateRef.current = now;

    try {
      const layout = createLayout();

      if (chartType === 'line') {
        if (!lineChartData || lineChartData.x.length === 0) return;
        if (typeof Plotly !== 'undefined' && Plotly.react) {
          Plotly.react(plotDiv, createPlotData(), layout);
        }
      } else {
        if (!candlestickData || candlestickData.x.length === 0) return;
        if (typeof Plotly !== 'undefined' && Plotly.react) {
          Plotly.react(plotDiv, createPlotData(), layout);
        }
      }

      // Update secondary charts
      if (mainMode === 'bidAsk' && secondaryView === 'line') {
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv && typeof Plotly !== 'undefined') {
          Plotly.react(bidAskDiv, createBidAskData(), createBidAskLayout());
        }
      }

      if (mainMode === 'bidAsk' && secondaryView === 'spread') {
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv && typeof Plotly !== 'undefined') {
          Plotly.react(spreadDiv, createSpreadData(), createSpreadLayout());
        }
      }

      if (showIndicators.volume) {
        const volumeDiv = document.getElementById('volume-chart');
        if (volumeDiv && typeof Plotly !== 'undefined') {
          Plotly.react(volumeDiv, createVolumeData(), createVolumeLayout());
        }
      }

      if (mainMode !== 'none' && secondaryView === 'std') {
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv && typeof Plotly !== 'undefined') {
          Plotly.react(buySellVolumeDiv, createStdData(), createStdLayout());
        }
      }

      if (mainMode === 'buySell' && secondaryView === 'line') {
        const buySellLineDiv = document.getElementById('buy-sell-line-chart');
        if (buySellLineDiv && typeof Plotly !== 'undefined') {
          Plotly.react(buySellLineDiv, createBuySellLineData(), createBuySellLineLayout());
        }
      }

      if (mainMode === 'buySell' && secondaryView === 'spread') {
        const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
        if (buySellSpreadDiv && typeof Plotly !== 'undefined') {
          Plotly.react(buySellSpreadDiv, createBuySellSpreadData(), createBuySellSpreadLayout());
        }
      }
    } catch (err) {
      console.error('Error updating chart:', err);
    }
  }, [
    // ✅ OPTIMIZED: Only re-render when these critical values change
    predictionKey,
    showPredictions,
    initialized,
    selectedTimeframe,
    chartType,
    showIndicators,
    mainMode,
    secondaryView,
    lineChartData,
    candlestickData
  ]);

  // 🔀 CREATE ACTUAL DATA ONLY (No predictions for separator modal left side)
  const createActualDataOnly = () => {
    const colors = getColorTheme();
    let plotData: any[] = [];

    if (chartType === 'line') {
      if (historicalData && historicalData.length > 0) {
        const validData = historicalData.filter(point =>
          point.ltp !== null &&
          point.ltp !== undefined &&
          point.ltp > 0 &&
          !isNaN(point.ltp) &&
          point.timestamp !== null &&
          point.timestamp !== undefined
        );

        if (validData.length === 0) return plotData;

        const sortedData = [...validData].sort((a, b) => a.timestamp - b.timestamp);
        const timeValues = sortedData.map(point => new Date(point.timestamp * 1000));
        const priceValues = sortedData.map(point => Number(point.ltp));

        // Only actual LTP line - no predictions
        plotData.push({
          x: timeValues,
          y: priceValues,
          type: 'scatter',
          mode: 'lines',
          name: 'Actual LTP',
          line: {
            color: '#10B981',  // Green for actual
            width: 2,
            shape: 'linear'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Price: ₹%{y:.2f}<br>' +
            '<extra></extra>',
          showlegend: true
        });

        // Note: Volume chart removed from separator modal to prevent layout issues
        // and keep focus on price comparison
      }
    } else {
      // Candlestick chart for actual data
      const { x, open, high, low, close } = candlestickData;
      if (x.length > 0) {
        plotData.push({
          x,
          open,
          high,
          low,
          close,
          type: 'candlestick',
          name: 'Actual OHLC',
          increasing: { line: { color: colors.upColor } },
          decreasing: { line: { color: colors.downColor } },
          showlegend: true
        });
      }
    }

    return plotData;
  };

  // 🔮 CREATE PREDICTION DATA ONLY (for separator modal right side)
  const createPredictionDataOnly = () => {
    const plotData: any[] = [];

    if (!predictions || predictions.count === 0) {
      console.log('No predictions available for predictions-only view');
      return plotData;
    }

    const predictionEntries = Object.entries(predictions.predictions);
    if (predictionEntries.length === 0) {
      console.log('Predictions object is empty');
      return plotData;
    }

    // Sort predictions by timestamp
    const sortedPredictions = predictionEntries.sort((a, b) => {
      const timeA = new Date(a[1].timestamp || a[0]).getTime();
      const timeB = new Date(b[1].timestamp || b[0]).getTime();
      return timeA - timeB;
    });

    const predictionTimes = sortedPredictions.map(([key, pred]) =>
      new Date(pred.timestamp || key)
    );
    const predictionValues = sortedPredictions.map(([, pred]) => Number(pred.close));

    console.log('Predictions-only view:', {
      count: predictionTimes.length,
      timeRange: [predictionTimes[0], predictionTimes[predictionTimes.length - 1]],
      valueRange: [Math.min(...predictionValues), Math.max(...predictionValues)]
    });

    // Only prediction line - no actual data
    plotData.push({
      x: predictionTimes,
      y: predictionValues,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Predicted Price',
      line: {
        color: '#A855F7',  // Purple for predictions
        width: 3,
        shape: 'spline',    // Smooth curve for predictions
        dash: 'dot'
      },
      marker: {
        size: 10,
        color: '#A855F7',
        symbol: 'diamond',
        line: {
          color: '#7C3AED',
          width: 2
        }
      },
      connectgaps: true,
      hovertemplate: '<b>%{fullData.name}</b><br>' +
        'Time: %{x|%H:%M:%S}<br>' +
        'Predicted Price: ₹%{y:.2f}<br>' +
        '<extra></extra>',
      showlegend: true
    });

    return plotData;
  };

  const createPlotData = () => {
    const colors = getColorTheme();
    let plotData: any[] = [];

    console.log(`🎨 [createPlotData] Called with:`, {
      chartType,
      historicalDataLength: historicalData?.length || 0,
      hasData: !!data,
      symbol
    });

    if (chartType === 'line') {
      if (historicalData && historicalData.length > 0) {
        // ✅ Validate data (no filtering needed - API already returned TODAY only)
        const validData = historicalData.filter(point =>
          point.ltp !== null &&
          point.ltp !== undefined &&
          point.ltp > 0 &&
          !isNaN(point.ltp) &&
          point.timestamp !== null &&
          point.timestamp !== undefined
        );

        console.log(`✅ [createPlotData] Valid data:`, {
          total: historicalData.length,
          valid: validData.length,
          invalid: historicalData.length - validData.length
        });

        if (validData.length === 0) {
          console.error(`❌ [createPlotData] All data invalid! Sample point:`, historicalData[0]);
          return plotData;
        }

        const sortedData = [...validData].sort((a, b) => a.timestamp - b.timestamp);
        const timeValues = sortedData.map(point => new Date(point.timestamp * 1000));
        const priceValues = sortedData.map(point => Number(point.ltp));

        plotData.push({
          x: timeValues,
          y: priceValues,
          type: 'scatter',
          mode: 'lines',
          name: 'LTP',
          line: {
            color: colors.line || '#3B82F6',
            width: 2,
            shape: 'linear'
          },
          connectgaps: false,
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Price: ₹%{y:.2f}<br>' +
            '<extra></extra>',
          showlegend: true
        });

        // ✨ NEW: Add prediction line if available
        if (showPredictions && predictions && predictions.count > 0) {
          const predictionEntries = Object.entries(predictions.predictions);
          console.log('🔮 Adding prediction line to chart:', {
            showPredictions,
            predictionsCount: predictions.count,
            entriesLength: predictionEntries.length,
            firstEntry: predictionEntries[0],
            lastEntry: predictionEntries[predictionEntries.length - 1]
          });

          if (predictionEntries.length > 0) {
            // Sort predictions by timestamp (use key as timestamp if value.timestamp is not available)
            const sortedPredictions = predictionEntries.sort((a, b) => {
              const timeA = new Date(a[1].timestamp || a[0]).getTime();
              const timeB = new Date(b[1].timestamp || b[0]).getTime();
              return timeA - timeB;
            });

            const predictionTimes = sortedPredictions.map(([key, pred]) =>
              new Date(pred.timestamp || key)
            );
            const predictionValues = sortedPredictions.map(([, pred]) => Number(pred.close));

            console.log('🔮 Prediction trace data:', {
              firstTime: predictionTimes[0],
              lastTime: predictionTimes[predictionTimes.length - 1],
              firstValue: predictionValues[0],
              lastValue: predictionValues[predictionValues.length - 1],
              totalPoints: predictionTimes.length,
              timeRange: {
                start: predictionTimes[0]?.toLocaleString(),
                end: predictionTimes[predictionTimes.length - 1]?.toLocaleString()
              }
            });

            plotData.push({
              x: predictionTimes,
              y: predictionValues,
              type: 'scatter',
              mode: 'lines+markers',
              name: 'Prediction',
              line: {
                color: '#FF9800',  // Orangish yellow color for predictions
                width: 3,          // Thicker line for visibility
                dash: 'dash'       // Dashed line to distinguish from actual
              },
              marker: {
                size: 8,           // Larger markers for visibility
                color: '#FF9800',
                symbol: 'diamond',
                line: {
                  color: '#E65100',  // Darker orange for marker border
                  width: 2
                }
              },
              connectgaps: true,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'Predicted Price: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true,
              visible: true  // Ensure it's visible
            });

            console.log('✅ Prediction trace added to plotData, total traces:', plotData.length);
          }
        } else {
          console.log('⚠️ Predictions not added:', {
            showPredictions,
            hasPredictions: !!predictions,
            count: predictions?.count || 0
          });
        }

        const volumeValues = sortedData.map(point => point.volume || 0);
        const volumeColors = [];
        for (let i = 0; i < sortedData.length; i++) {
          if (i === 0) {
            volumeColors.push(colors.upColor);
          } else {
            const currentPrice = priceValues[i];
            const prevPrice = priceValues[i - 1];
            volumeColors.push(currentPrice >= prevPrice ? colors.upColor : colors.downColor);
          }
        }

        if (volumeValues.some(v => v > 0)) {
          plotData.push({
            x: timeValues,
            y: volumeValues,
            type: 'histogram',
            histfunc: 'sum',
            name: 'Volume',
            marker: {
              color: volumeColors,
              opacity: 0.9,
              line: {
                width: 0.5,
                color: 'rgba(255,255,255,0.1)'
              }
            },
            xbins: {
              size: 60000
            },
            yaxis: 'y3',
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Volume: %{y:,.0f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }

        if (showIndicators.sma20 && priceValues.length >= 20) {
          const sma20Values = calculateSMA(priceValues, 20);
          if (sma20Values && sma20Values.length > 0) {
            plotData.push({
              x: timeValues.slice(19),
              y: sma20Values,
              type: 'scatter',
              mode: 'lines',
              name: 'SMA 20',
              line: {
                color: colors.indicator?.sma20 || '#f59e0b',
                width: 1.5,
                dash: 'dot'
              },
              connectgaps: false,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'SMA20: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true
            });
          }
        }

        if (showIndicators.ema9 && priceValues.length >= 9) {
          const ema9Values = calculateEMA(priceValues, 9);
          if (ema9Values && ema9Values.length > 0) {
            plotData.push({
              x: timeValues,
              y: ema9Values,
              type: 'scatter',
              mode: 'lines',
              name: 'EMA 9',
              line: {
                color: colors.indicator?.ema9 || '#8b5cf6',
                width: 1.5,
                dash: 'dash'
              },
              connectgaps: false,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'EMA9: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true
            });
          }
        }

        if (showIndicators.bb && priceValues.length >= 20) {
          const bbData = calculateBollingerBands(priceValues, 20, 2);
          if (bbData && bbData.upper && bbData.middle && bbData.lower) {
            plotData.push({
              x: timeValues.slice(19),
              y: bbData.upper,
              type: 'scatter',
              mode: 'lines',
              name: 'BB Upper',
              line: {
                color: colors.indicator?.bb || '#64748b',
                width: 1,
                dash: 'dashdot'
              },
              connectgaps: false,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'Upper: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true
            });

            plotData.push({
              x: timeValues.slice(19),
              y: bbData.middle,
              type: 'scatter',
              mode: 'lines',
              name: 'BB Middle',
              line: {
                color: colors.indicator?.bb || '#64748b',
                width: 1
              },
              connectgaps: false,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'Middle: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true
            });

            plotData.push({
              x: timeValues.slice(19),
              y: bbData.lower,
              type: 'scatter',
              mode: 'lines',
              name: 'BB Lower',
              line: {
                color: colors.indicator?.bb || '#64748b',
                width: 1,
                dash: 'dashdot'
              },
              fill: 'tonexty',
              fillcolor: 'rgba(100, 116, 139, 0.1)',
              connectgaps: false,
              hovertemplate: '<b>%{fullData.name}</b><br>' +
                'Time: %{x|%H:%M:%S}<br>' +
                'Lower: ₹%{y:.2f}<br>' +
                '<extra></extra>',
              showlegend: true
            });
          }
        }
      }
    } else {
      const { x, open, high, low, close, volume } = candlestickData;
      if (x.length === 0) return plotData;

      const hoverText = x.map((date: Date, i: number) =>
        `${date.toLocaleDateString()} ${date.toLocaleTimeString()}<br>` +
        `Open: ${open[i]?.toFixed(2) || 'N/A'}<br>` +
        `High: ${high[i]?.toFixed(2) || 'N/A'}<br>` +
        `Low: ${low[i]?.toFixed(2) || 'N/A'}<br>` +
        `Close: ${close[i]?.toFixed(2) || 'N/A'}<br>` +
        `Volume: ${(volume[i] || 0).toLocaleString()}`
      );

      plotData.push({
        x: x,
        open: open,
        high: high,
        low: low,
        close: close,
        type: 'candlestick',
        name: 'OHLC',
        text: hoverText,
        hoverinfo: 'text',
        increasing: {
          line: { color: colors.upColor || '#10b981', width: 1 },
          fillcolor: colors.upColor || '#10b981'
        },
        decreasing: {
          line: { color: colors.downColor || '#ef4444', width: 1 },
          fillcolor: colors.downColor || '#ef4444'
        },
        showlegend: true
      });

      if (showIndicators.sma20 && close.length >= 20) {
        const sma20Values = calculateSMA(close, 20);
        if (sma20Values && sma20Values.length > 0) {
          plotData.push({
            x: x.slice(19),
            y: sma20Values,
            type: 'scatter',
            mode: 'lines',
            name: 'SMA 20',
            line: {
              color: colors.indicator?.sma20 || '#f59e0b',
              width: 2,
              dash: 'dot'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'SMA20: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }
      }

      if (showIndicators.ema9 && close.length >= 9) {
        const ema9Values = calculateEMA(close, 9);
        if (ema9Values && ema9Values.length > 0) {
          plotData.push({
            x: x,
            y: ema9Values,
            type: 'scatter',
            mode: 'lines',
            name: 'EMA 9',
            line: {
              color: colors.indicator?.ema9 || '#8b5cf6',
              width: 2,
              dash: 'dash'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'EMA9: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }
      }

      if (showIndicators.bb && close.length >= 20) {
        const bbData = calculateBollingerBands(close, 20, 2);
        if (bbData && bbData.upper && bbData.middle && bbData.lower) {
          plotData.push({
            x: x.slice(19),
            y: bbData.upper,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Upper',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1,
              dash: 'dashdot'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Upper: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });

          plotData.push({
            x: x.slice(19),
            y: bbData.middle,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Middle',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Middle: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });

          plotData.push({
            x: x.slice(19),
            y: bbData.lower,
            type: 'scatter',
            mode: 'lines',
            name: 'BB Lower',
            line: {
              color: colors.indicator?.bb || '#64748b',
              width: 1,
              dash: 'dashdot'
            },
            fill: 'tonexty',
            fillcolor: 'rgba(100, 116, 139, 0.1)',
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Lower: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }
      }

      if (showIndicators.vwap && close.length > 0 && volume && volume.length > 0) {
        const vwapValues = calculateVWAP(close, high, low, volume);
        if (vwapValues && vwapValues.length > 0) {
          plotData.push({
            x: x,
            y: vwapValues,
            type: 'scatter',
            mode: 'lines',
            name: 'VWAP',
            line: {
              color: colors.indicator?.vwap || '#06b6d4',
              width: 2,
              dash: 'solid'
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'VWAP: ₹%{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }
      }
    }

    if (showIndicators.rsi) {
      let priceData: number[] = [];
      let timeData: Date[] = [];

      if (chartType === 'line') {
        const validData = historicalData?.filter(point =>
          point.ltp !== null &&
          point.ltp !== undefined &&
          point.ltp > 0 &&
          !isNaN(point.ltp)
        ) || [];
        priceData = validData.map(point => Number(point.ltp));
        timeData = validData.slice(14).map(point => new Date(point.timestamp * 1000));
      } else {
        const { close: candleClose, x: candleX } = candlestickData;
        if (Array.isArray(candleClose)) {
          priceData = candleClose.filter(price =>
            price !== null && price !== undefined && !isNaN(price)
          );
          timeData = Array.isArray(candleX) ? candleX.slice(14) : [];
        }
      }

      if (priceData.length >= 15) {
        const rsiValues = calculateRSI(priceData, 14);
        if (rsiValues && rsiValues.length > 0 && timeData.length === rsiValues.length) {
          plotData.push({
            x: timeData,
            y: rsiValues,
            type: 'scatter',
            mode: 'lines',
            name: 'RSI',
            line: {
              color: colors.indicator?.rsi || '#ec4899',
              width: 2
            },
            yaxis: 'y2',
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'RSI: %{y:.2f}<br>' +
              '<extra></extra>',
            showlegend: true
          });

          plotData.push({
            x: timeData,
            y: Array(timeData.length).fill(70),
            type: 'scatter',
            mode: 'lines',
            name: 'Overbought (70)',
            line: {
              color: '#ef4444',
              width: 1,
              dash: 'dash'
            },
            yaxis: 'y2',
            showlegend: false,
            hoverinfo: 'skip'
          });

          plotData.push({
            x: timeData,
            y: Array(timeData.length).fill(30),
            type: 'scatter',
            mode: 'lines',
            name: 'Oversold (30)',
            line: {
              color: '#10b981',
              width: 1,
              dash: 'dash'
            },
            yaxis: 'y2',
            showlegend: false,
            hoverinfo: 'skip'
          });

          plotData.push({
            x: timeData,
            y: Array(timeData.length).fill(50),
            type: 'scatter',
            mode: 'lines',
            name: 'Midline (50)',
            line: {
              color: '#64748b',
              width: 1,
              dash: 'dot'
            },
            yaxis: 'y2',
            showlegend: false,
            hoverinfo: 'skip'
          });
        }
      }
    }

    if (showIndicators.macd) {
      let priceData: number[] = [];
      let timeDataMACD: Date[] = [];
      let timeDataSignal: Date[] = [];

      if (chartType === 'line') {
        const validData = historicalData?.filter(point =>
          point.ltp !== null &&
          point.ltp !== undefined &&
          point.ltp > 0 &&
          !isNaN(point.ltp)
        ) || [];
        priceData = validData.map(point => Number(point.ltp));
        timeDataMACD = validData.slice(25).map(point => new Date(point.timestamp * 1000));
        timeDataSignal = validData.slice(33).map(point => new Date(point.timestamp * 1000));
      } else {
        const { close: candleClose, x: candleX } = candlestickData;
        if (Array.isArray(candleClose)) {
          priceData = candleClose.filter(price =>
            price !== null && price !== undefined && !isNaN(price)
          );
          timeDataMACD = Array.isArray(candleX) ? candleX.slice(25) : [];
          timeDataSignal = Array.isArray(candleX) ? candleX.slice(33) : [];
        }
      }

      if (priceData.length >= 35) {
        const macdData = calculateMACD(priceData, 12, 26, 9);
        if (macdData && macdData.macdLine && macdData.signalLine && macdData.histogram &&
          timeDataMACD.length === macdData.macdLine.length &&
          timeDataSignal.length === macdData.signalLine.length) {
          plotData.push({
            x: timeDataMACD,
            y: macdData.macdLine,
            type: 'scatter',
            mode: 'lines',
            name: 'MACD',
            line: {
              color: colors.indicator?.macd || '#3b82f6',
              width: 2
            },
            yaxis: showIndicators.rsi ? 'y4' : 'y2',
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'MACD: %{y:.4f}<br>' +
              '<extra></extra>',
            showlegend: true
          });

          plotData.push({
            x: timeDataSignal,
            y: macdData.signalLine,
            type: 'scatter',
            mode: 'lines',
            name: 'Signal',
            line: {
              color: '#f59e0b',
              width: 1,
              dash: 'dash'
            },
            yaxis: showIndicators.rsi ? 'y4' : 'y2',
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Signal: %{y:.4f}<br>' +
              '<extra></extra>',
            showlegend: true
          });

          plotData.push({
            x: timeDataSignal,
            y: macdData.histogram,
            type: 'bar',
            name: 'MACD Histogram',
            marker: {
              color: macdData.histogram.map(val => val >= 0 ? '#10b981' : '#ef4444'),
              opacity: 0.7
            },
            yaxis: showIndicators.rsi ? 'y4' : 'y2',
            hovertemplate: '<b>%{fullData.name}</b><br>' +
              'Time: %{x|%H:%M:%S}<br>' +
              'Histogram: %{y:.4f}<br>' +
              '<extra></extra>',
            showlegend: true
          });
        }
      }
    }

    return plotData;
  };

  const createSpreadData = () => {
    const colors = getColorTheme();
    const { x, spread } = lineChartData;

    return [{
      x,
      y: spread,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      line: { color: colors.indicator.spread, width: 1.5 },
      name: 'Bid-Ask Spread',
      hoverinfo: 'y+name',
    }];
  };

  const createBidAskData = () => {
    const colors = getColorTheme();

    if (secondaryView === 'std') {
      const { x, bidStdDev, askStdDev } = calculateBidAskStandardDeviation();
      return [
        {
          x,
          y: bidStdDev,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.bid, width: 2 },
          name: 'Bid Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        },
        {
          x,
          y: askStdDev,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.ask, width: 2 },
          name: 'Ask Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        }
      ];
    } else {
      const { x, bid, ask } = lineChartData;
      return [
        {
          x,
          y: bid,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.bid, width: 2 },
          name: 'Bid Price',
          hoverinfo: 'y+name',
        },
        {
          x,
          y: ask,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.ask, width: 2 },
          name: 'Ask Price',
          hoverinfo: 'y+name',
        }
      ];
    }
  };

  const createBuySellLineData = () => {
    const colors = getColorTheme();

    if (secondaryView === 'std') {
      const { x, buyStdDev, sellStdDev } = calculateBuySellStandardDeviation();
      return [
        {
          x,
          y: buyStdDev,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.buyPrice, width: 2 },
          name: 'Buy Price Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        },
        {
          x,
          y: sellStdDev,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.sellPrice, width: 2 },
          name: 'Sell Price Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        }
      ];
    } else {
      let x: Date[] = [];
      let buyPrices: number[] = [];
      let sellPrices: number[] = [];

      if (chartType === 'line') {
        x = lineChartData.x;
        buyPrices = lineChartData.buyPrices;
        sellPrices = lineChartData.sellPrices;
      } else {
        x = candlestickData.x;
        buyPrices = candlestickData.buyPrices;
        sellPrices = candlestickData.sellPrices;
      }

      return [
        {
          x,
          y: buyPrices,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.buyPrice, width: 2 },
          name: 'Buy Price',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Price: ₹%{y:.2f}<br>' +
            '<extra></extra>',
        },
        {
          x,
          y: sellPrices,
          type: 'scatter',
          mode: 'lines',
          line: { color: colors.indicator.sellPrice, width: 2 },
          name: 'Sell Price',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Price: ₹%{y:.2f}<br>' +
            '<extra></extra>',
        }
      ];
    }
  };

  const createBuySellSpreadData = () => {
    const colors = getColorTheme();
    let x: Date[] = [];
    let buySellSpreads: number[] = [];

    if (chartType === 'line') {
      x = lineChartData.x;
      buySellSpreads = lineChartData.buySellSpreads;
    } else {
      x = candlestickData.x;
      buySellSpreads = candlestickData.buySellSpreads;
    }

    return [{
      x,
      y: buySellSpreads,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      line: { color: colors.indicator.buySellSpread, width: 1.5 },
      name: 'Buy-Sell Spread',
      hovertemplate: '<b>%{fullData.name}</b><br>' +
        'Time: %{x|%H:%M:%S}<br>' +
        'Spread: ₹%{y:.4f}<br>' +
        '<extra></extra>',
    }];
  };

  const createVolumeData = () => {
    const colors = getColorTheme();
    let x: Date[] = [];
    let volumes: number[] = [];
    const volumeColors: string[] = [];

    if (chartType === 'line') {
      x = lineChartData.x;
      volumes = lineChartData.allData.map((point: DataPoint) => point.volume || 0);

      for (let i = 0; i < lineChartData.allData.length; i++) {
        if (i === 0) {
          volumeColors.push(colors.upColor);
        } else {
          const currentPrice = lineChartData.allData[i].ltp;
          const prevPrice = lineChartData.allData[i - 1].ltp;
          volumeColors.push(currentPrice >= prevPrice ? colors.upColor : colors.downColor);
        }
      }
    } else {
      x = candlestickData.x;
      volumes = candlestickData.volume;

      for (let i = 0; i < data.close.length; i++) {
        volumeColors.push(data.close[i] >= data.open[i] ? colors.upColor : colors.downColor);
      }
    }

    return [{
      x,
      y: volumes,
      type: 'bar',
      name: 'Volume',
      marker: {
        color: volumeColors,
        opacity: 0.8
      },
      hovertemplate: '<b>%{fullData.name}</b><br>' +
        'Time: %{x|%H:%M:%S}<br>' +
        'Volume: %{y:,.0f}<br>' +
        '<extra></extra>',
    }];
  };

  const createStdData = () => {
    const colors = getColorTheme();

    if (mainMode === 'bidAsk') {
      const { x, bidStdDev, askStdDev } = calculateBidAskStandardDeviation();
      return [
        {
          x,
          y: bidStdDev,
          type: 'bar',
          name: 'Bid Volume Std Dev',
          marker: {
            color: colors.indicator.bid,
            opacity: 0.8
          },
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Bid Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        },
        {
          x,
          y: askStdDev,
          type: 'bar',
          name: 'Ask Volume Std Dev',
          marker: {
            color: colors.indicator.ask,
            opacity: 0.8
          },
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Ask Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        }
      ];
    } else if (mainMode === 'buySell') {
      const { x, buyStdDev, sellStdDev } = calculateBuySellStandardDeviation();
      return [
        {
          x,
          y: buyStdDev,
          type: 'bar',
          name: 'Buy Volume Std Dev',
          marker: {
            color: colors.indicator.buyPrice,
            opacity: 0.8
          },
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Buy Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        },
        {
          x,
          y: sellStdDev,
          type: 'bar',
          name: 'Sell Volume Std Dev',
          marker: {
            color: colors.indicator.sellPrice,
            opacity: 0.8
          },
          hovertemplate: '<b>%{fullData.name}</b><br>' +
            'Time: %{x|%H:%M:%S}<br>' +
            'Sell Std Dev: %{y:.4f}<br>' +
            '<extra></extra>',
        }
      ];
    } else {
      let x: Date[] = [];
      let volumeStdDev: number[] = [];

      if (chartType === 'line') {
        x = lineChartData.x;
        volumeStdDev = lineChartData.allData.map((point: DataPoint, index: number) =>
          calculateVolumeStandardDeviation(point, index)
        );
      } else {
        x = candlestickData.x;
        volumeStdDev = candlestickData.volumeStdDev;
      }

      return [{
        x,
        y: volumeStdDev,
        type: 'bar',
        name: 'Volume Std Dev',
        marker: {
          color: colors.indicator.std,
          opacity: 0.8
        },
        hovertemplate: '<b>%{fullData.name}</b><br>' +
          'Time: %{x|%H:%M:%S}<br>' +
          'Std Dev: %{y:.4f}<br>' +
          '<extra></extra>',
      }];
    }
  };

  const createLayout = () => {
    const colors = getColorTheme();

    // ✅ CRITICAL: Calculate y-range based on visible x-range
    const timeRange = preservedAxisRanges.xaxis ?
      [preservedAxisRanges.xaxis[0], preservedAxisRanges.xaxis[1]] :
      getTimeRange();

    // ✅ Always calculate y-range for visible data (autoscaling)
    const yRange = preservedAxisRanges.yaxis ?
      [preservedAxisRanges.yaxis[0], preservedAxisRanges.yaxis[1]] :
      calculateYAxisRange(timeRange);

    let mainChartDomain = [0, 1];
    let volumeDomain = [0, 0.2];

    if (chartType === 'line') {
      if (showIndicators.rsi && showIndicators.macd) {
        mainChartDomain = [0.6, 1];
        volumeDomain = [0.25, 0.55];
      } else if (showIndicators.rsi || showIndicators.macd) {
        mainChartDomain = [0.45, 1];
        volumeDomain = [0.1, 0.4];
      } else {
        mainChartDomain = [0.35, 1];
        volumeDomain = [0, 0.3];
      }
    } else {
      if (showIndicators.rsi && showIndicators.macd) {
        mainChartDomain = [0.5, 1];
      } else if (showIndicators.rsi || showIndicators.macd) {
        mainChartDomain = [0.3, 1];
      }
    }

    const layout: any = {
      autosize: true,
      // ✅ CRITICAL FIX: Use static uirevision to preserve user interactions
      // This prevents the chart from resetting zoom/pan on every data update
      uirevision: 'static',
      margin: { l: 50, r: 50, t: 40, b: 40 },
      title: {
        text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
        font: { size: 16, color: colors.text },
      },
      xaxis: {
        title: 'Time',
        type: 'date',
        // ✅ CRITICAL FIX: Only set range if user hasn't zoomed
        // This prevents the chart from auto-scrolling when user is exploring data
        ...(userHasInteracted && preservedRange.xaxis ? {
          range: preservedRange.xaxis,
          autorange: false
        } : {
          range: timeRange,
          autorange: false
        }),
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: {
          visible: true,  // ✅ Enable range slider for scrolling
          bgcolor: colors.bg,
          bordercolor: colors.grid,
          thickness: 0.05,  // Thin slider
        },
        fixedrange: false,  // ✅ Allow zooming on x-axis
      },
      yaxis: {
        title: 'Price (₹)',
        // ✅ CRITICAL FIX: Preserve user's Y-axis zoom if they've interacted
        ...(userHasInteracted && preservedRange.yaxis ? {
          range: preservedRange.yaxis,
          autorange: false
        } : {
          range: yRange,
          autorange: yRange ? false : true
        }),
        fixedrange: false,  // ✅ Allow user to zoom y-axis if needed
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        side: 'left',
        domain: mainChartDomain,
        zeroline: false,
        automargin: true,
        rangemode: 'normal',
      },
      dragmode: 'zoom', // ✅ Enable zoom mode for better data exploration
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };

    // ✅ CRITICAL: Add modebar configuration for better controls
    layout.modebar = {
      orientation: 'v',
      bgcolor: 'rgba(0,0,0,0.5)',
      color: colors.text,
      activecolor: '#3b82f6',
    };

    if (chartType === 'line') {
      layout.yaxis3 = {
        title: 'Volume',
        height: 180,
        titlefont: { color: colors.text },
        tickfont: { color: colors.text },
        domain: volumeDomain,
        showgrid: false,
        side: 'right'
      };
    }

    if (showIndicators.rsi) {
      layout.yaxis2 = {
        title: 'RSI',
        titlefont: { color: colors.text },
        tickfont: { color: colors.text },
        domain: showIndicators.macd ? [0.25, 0.45] : [0, 0.25],
        range: [0, 100],
        showgrid: false,
      };
    }

    if (showIndicators.macd) {
      layout.yaxis4 = {
        title: 'MACD',
        titlefont: { color: colors.text },
        tickfont: { color: colors.text },
        domain: [0, 0.2],
        showgrid: false,
      };
    }

    return layout;
  };

  const createSpreadLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const spreadRange = calculateSpreadRange();

    return {
      autosize: true,
      height: 150,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Spread',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Spread (₹)',
        range: spreadRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: false,
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createBidAskLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    let yRange, title;

    if (secondaryView === 'std') {
      const { bidStdDev, askStdDev } = calculateBidAskStandardDeviation();
      const allStdDev = [...bidStdDev, ...askStdDev].filter(v => v !== null && v !== undefined && !isNaN(v));
      const maxStdDev = allStdDev.length > 0 ? Math.max(...allStdDev) : 1;
      yRange = [0, maxStdDev * 1.1];
      title = 'Bid-Ask Standard Deviation';
    } else {
      yRange = calculateBidAskRange();
      title = 'Bid-Ask Prices';
    }

    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: title,
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: secondaryView === 'std' ? 'Std Deviation' : 'Price (₹)',
        range: yRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createBuySellLineLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    let yRange, title;

    if (secondaryView === 'std') {
      const { buyStdDev, sellStdDev } = calculateBuySellStandardDeviation();
      const allStdDev = [...buyStdDev, ...sellStdDev].filter(v => v !== null && v !== undefined && !isNaN(v));
      const maxStdDev = allStdDev.length > 0 ? Math.max(...allStdDev) : 1;
      yRange = [0, maxStdDev * 1.1];
      title = 'Buy-Sell Standard Deviation';
    } else {
      yRange = calculateBuySellRange();
      title = 'Buy-Sell Prices';
    }

    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: title,
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: secondaryView === 'std' ? 'Std Deviation' : 'Price (₹)',
        range: yRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createBuySellSpreadLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const buySellSpreadRange = calculateBuySellSpreadRange();

    return {
      autosize: true,
      height: 150,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Buy-Sell Spread',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Spread (₹)',
        range: buySellSpreadRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: false,
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createVolumeLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const volumeRange = calculateVolumeRange();

    return {
      autosize: true,
      height: 180,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Volume',
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Volume',
        range: volumeRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createStdLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    let yRange, title;

    if (mainMode === 'bidAsk') {
      const { bidStdDev, askStdDev } = calculateBidAskStandardDeviation();
      const allStdDev = [...bidStdDev, ...askStdDev].filter(v => v !== null && v !== undefined && !isNaN(v));
      const maxStdDev = allStdDev.length > 0 ? Math.max(...allStdDev) : 1;
      yRange = [0, maxStdDev * 1.1];
      title = 'Bid-Ask Volume Standard Deviation';
    } else if (mainMode === 'buySell') {
      const { buyStdDev, sellStdDev } = calculateBuySellStandardDeviation();
      const allStdDev = [...buyStdDev, ...sellStdDev].filter(v => v !== null && v !== undefined && !isNaN(v));
      const maxStdDev = allStdDev.length > 0 ? Math.max(...allStdDev) : 1;
      yRange = [0, maxStdDev * 1.1];
      title = 'Buy-Sell Volume Standard Deviation';
    } else {
      let volumeStdDev: number[] = [];
      if (chartType === 'line') {
        volumeStdDev = historicalData.map((point, index) =>
          calculateVolumeStandardDeviation(point, index)
        );
      } else {
        volumeStdDev = candlestickData.volumeStdDev;
      }
      const validStdDev = volumeStdDev.filter(v => v !== null && v !== undefined && !isNaN(v));
      const maxStdDev = validStdDev.length > 0 ? Math.max(...validStdDev) : 1;
      yRange = [0, maxStdDev * 1.1];
      title = 'Volume Standard Deviation';
    }

    return {
      autosize: true,
      height: 180,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: title,
        font: { size: 14, color: colors.text },
      },
      xaxis: {
        title: '',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
        rangeslider: { visible: false },
        fixedrange: false,
      },
      yaxis: {
        title: 'Std Deviation',
        range: yRange,
        autorange: false,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text },
        titlefont: { color: colors.text },
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.1,
        font: { color: colors.text },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const timeframeButtons = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1H' },
    { label: '6H', value: '6H' },
    { label: '1D', value: '1D' },
  ];
  const gradientClass = getDesirabilityGradientClass(desirabilityScore);
  return (
    <div className={`w-full h-full flex flex-col transition-all duration-500 ${gradientClass}`}>
      {/* Controls */}
      <div className="flex justify-between mb-2 space-x-2 z-10 px-2 pt-2">
        {/* Timeframe Buttons */}
        <div className="flex space-x-1 bg-zinc-900/80 p-1 rounded-md border border-zinc-700 backdrop-blur-sm">
          {timeframeButtons.map((button) => (
            <button
              key={button.value}
              className={`px-2 py-1 text-xs rounded ${selectedTimeframe === button.value
                ? `bg-blue-600 text-white`
                : `bg-zinc-800 text-zinc-300 hover:bg-zinc-700`
                }`}
              onClick={() => handleTimeframeChange(button.value)}
            >
              {button.label}
            </button>
          ))}
        </div>

        <div className="flex space-x-4">
          {/* 🔀 Separator Button - Opens Modal with Split View */}
          <div className="flex space-x-1 bg-gradient-to-r from-purple-900 to-indigo-900 p-1 rounded-md border border-purple-600">
            <button
              className="px-3 py-1 rounded bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 flex items-center space-x-2 transition-all"
              onClick={() => setIsSeparatorModalOpen(true)}
              title="Open Separate View - Compare Actual vs Predicted"
            >
              <Maximize2 className="h-4 w-4" />
              <span className="text-xs font-bold">Separate View</span>
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-md border border-zinc-600">
            <button
              className={`p-1 rounded ${chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              onClick={() => setChartType('line')}
              title="Line Chart (LTP)"
            >
              <LineChart className="h-5 w-5" />
            </button>
            <button
              className={`p-1 rounded ${chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              onClick={() => setChartType('candle')}
              title="Candlestick Chart (OHLC)"
            >
              <CandlestickChart className="h-5 w-5" />
            </button>
          </div>

          {/* Indicator Toggles */}
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-md border border-slate-600">
            <button
              className={`p-1 rounded ${showIndicators.sma20 ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              onClick={() => toggleIndicator('sma20')}
              title="SMA 20"
            >
              <span className="text-xs font-bold">SMA</span>
            </button>
            <button
              className={`p-1 rounded ${showIndicators.ema9 ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              onClick={() => toggleIndicator('ema9')}
              title="EMA 9"
            >
              <span className="text-xs font-bold">EMA</span>
            </button>
            <button
              className={`p-1 rounded ${showIndicators.rsi ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              onClick={() => toggleIndicator('rsi')}
              title="RSI"
            >
              <span className="text-xs font-bold">RSI</span>
            </button>
            <button
              className={`p-1 rounded ${showIndicators.macd ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              onClick={() => toggleIndicator('macd')}
              title="MACD"
            >
              <span className="text-xs font-bold">MACD</span>
            </button>
            <button
              className={`p-1 rounded ${showIndicators.bb ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              onClick={() => toggleIndicator('bb')}
              title="Bollinger Bands"
            >
              <span className="text-xs font-bold">BB</span>
            </button>
            {chartType === 'candle' && (
              <button
                className={`p-1 rounded ${showIndicators.vwap ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                onClick={() => toggleIndicator('vwap')}
                title="VWAP"
              >
                <span className="text-xs font-bold">VWAP</span>
              </button>
            )}
          </div>

          {/* Advanced Analysis Modes */}
          <div className="flex space-x-1 bg-emerald-900 p-1 rounded-md border border-emerald-700">
            <button
              className={`p-1 rounded ${mainMode === 'bidAsk' ? 'bg-green-600 text-white' : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
                }`}
              onClick={() => toggleMainMode('bidAsk')}
              title="Bid/Ask Analysis"
            >
              <span className="text-xs font-bold">B/A</span>
            </button>
            <button
              className={`p-1 rounded ${mainMode === 'buySell' ? 'bg-emerald-600 text-white' : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
                }`}
              onClick={() => toggleMainMode('buySell')}
              title="Buy/Sell Analysis"
            >
              <span className="text-xs font-bold">B/S</span>
            </button>

            {/* Secondary View Options */}
            {mainMode !== 'none' && (
              <>
                <div className="w-px h-6 bg-emerald-600 mx-1"></div>
                <button
                  className={`p-1 rounded ${secondaryView === 'line' ? 'bg-blue-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                    }`}
                  onClick={() => toggleSecondaryView('line')}
                  title="Line View"
                >
                  <span className="text-xs font-bold">Line</span>
                </button>
                <button
                  className={`p-1 rounded ${secondaryView === 'spread' ? 'bg-purple-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                    }`}
                  onClick={() => toggleSecondaryView('spread')}
                  title="Spread View"
                >
                  <span className="text-xs font-bold">Spread</span>
                </button>
                <button
                  className={`p-1 rounded ${secondaryView === 'std' ? 'bg-orange-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                    }`}
                  onClick={() => toggleSecondaryView('std')}
                  title="Standard Deviation View"
                >
                  <span className="text-xs font-bold">STD</span>
                </button>
              </>
            )}
          </div>

          {/* Volume Toggle */}
          <div className="flex space-x-1 bg-amber-900 p-1 rounded-md border border-amber-700">
            <button
              className={`p-1 rounded ${showIndicators.volume ? 'bg-amber-600 text-white' : 'bg-amber-800 text-amber-300 hover:bg-amber-700'
                }`}
              onClick={() => toggleIndicator('volume')}
              title="Volume Chart"
            >
              VOL
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="flex-1">
        <Plot
          ref={chartRef}
          divId="plotly-chart"
          data={createPlotData()}
          layout={createLayout()}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            modeBarButtonsToAdd: [],
            scrollZoom: true,
            doubleClick: 'reset+autosize',  // ✅ Reset and autoscale on double-click
            toImageButtonOptions: {
              format: 'png',
              filename: `${symbol}_chart_${new Date().toISOString().split('T')[0]}`,
              height: 1080,
              width: 1920,
              scale: 2
            }
          }}
          onRelayout={handleRelayout}  // ✅ CRITICAL: Handle zoom/pan for autoscaling
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Secondary Charts */}
      {mainMode === 'bidAsk' && secondaryView === 'line' && (
        <div className="mt-2">
          <Plot
            ref={bidAskChartRef}
            divId="bid-ask-chart"
            data={createBidAskData()}
            layout={createBidAskLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '200px' }}
          />
        </div>
      )}

      {mainMode === 'bidAsk' && secondaryView === 'spread' && (
        <div className="mt-2">
          <Plot
            ref={spreadChartRef}
            divId="spread-chart"
            data={createSpreadData()}
            layout={createSpreadLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '150px' }}
          />
        </div>
      )}

      {mainMode === 'buySell' && secondaryView === 'line' && (
        <div className="mt-2">
          <Plot
            ref={buySellLineChartRef}
            divId="buy-sell-line-chart"
            data={createBuySellLineData()}
            layout={createBuySellLineLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '200px' }}
          />
        </div>
      )}

      {mainMode === 'buySell' && secondaryView === 'spread' && (
        <div className="mt-2">
          <Plot
            ref={buySellSpreadChartRef}
            divId="buy-sell-spread-chart"
            data={createBuySellSpreadData()}
            layout={createBuySellSpreadLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '150px' }}
          />
        </div>
      )}

      {mainMode !== 'none' && secondaryView === 'std' && (
        <div className="mt-2">
          <Plot
            ref={buySellVolumeChartRef}
            divId="buy-sell-volume-chart"
            data={createStdData()}
            layout={createStdLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '180px' }}
          />
        </div>
      )}

      {showIndicators.volume && (
        <div className="mt-2">
          <Plot
            ref={volumeChartRef}
            divId="volume-chart"
            data={createVolumeData()}
            layout={createVolumeLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              scrollZoom: true,
              doubleClick: 'reset',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '180px' }}
          />
        </div>
      )}

      {/* 🔀 SEPARATOR MODAL - Side-by-Side View */}
      {isSeparatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-[98vw] h-[95vh] bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-900 to-indigo-900 border-b border-purple-700">
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <Maximize2 className="h-5 w-5" />
                <span>Separate View - Actual vs Predicted Comparison</span>
              </h2>
              <button
                onClick={() => setIsSeparatorModalOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Close Separate View"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Modal Content - Side by Side Charts */}
            <div className="grid grid-cols-2 gap-4 p-4 h-[calc(100%-4rem)] overflow-auto">
              {/* Left Side - Actual Live Chart */}
              <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                    <span>Actual Live Data</span>
                  </h3>
                  <p className="text-sm text-gray-400">Real-time market data from {symbol}</p>
                </div>

                <div className="flex-1 min-h-0">
                  {/* Render ONLY actual data - no predictions */}
                  {chartType === 'line' ? (
                    <Plot
                      data={createActualDataOnly()}
                      layout={createLayout()}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                        scrollZoom: true,
                        doubleClick: 'reset',
                        toImageButtonOptions: {
                          format: 'png',
                          filename: `${symbol}_actual_${new Date().toISOString().split('T')[0]}`,
                          height: 1080,
                          width: 1920,
                          scale: 2
                        }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <Plot
                      data={createActualDataOnly()}
                      layout={createLayout()}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                        scrollZoom: true,
                        doubleClick: 'reset',
                        toImageButtonOptions: {
                          format: 'png',
                          filename: `${symbol}_actual_${new Date().toISOString().split('T')[0]}`,
                          height: 1080,
                          width: 1920,
                          scale: 2
                        }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  )}
                </div>
              </div>

              {/* Right Side - Predicted Chart */}
              <div className="flex flex-col bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                <div className="mb-2">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <span className="inline-block w-3 h-3 bg-purple-500 rounded-full animate-pulse"></span>
                    <span>Predicted Data</span>
                  </h3>
                  <p className="text-sm text-gray-400">
                    {showPredictions && predictions && predictions.count > 0
                      ? `${predictions.count} predictions for ${predictions.company}`
                      : 'No predictions available'}
                  </p>
                </div>

                <div className="flex-1 min-h-0">
                  {showPredictions && predictions && predictions.count > 0 ? (
                    <Plot
                      data={createPredictionDataOnly()}
                      layout={createLayout()}
                      config={{
                        responsive: true,
                        displayModeBar: true,
                        displaylogo: false,
                        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                        scrollZoom: true,
                        doubleClick: 'reset',
                        toImageButtonOptions: {
                          format: 'png',
                          filename: `${symbol}_predictions_${new Date().toISOString().split('T')[0]}`,
                          height: 1080,
                          width: 1920,
                          scale: 2
                        }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mb-4">
                          <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <p className="text-gray-400 text-lg mb-2">No Predictions Available</p>
                        <p className="text-gray-500 text-sm">Enable predictions or wait for data to load</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Display */}
      <div className="mt-2 flex items-center space-x-4 text-sm">
        <div className={`flex items-center space-x-2 ${tradingHours.isActive ? 'text-green-400' : 'text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${tradingHours.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span>{tradingHours.isActive ? 'Market Open' : 'Market Closed'}</span>
        </div>
      </div>
    </div>
  );
};

export default PlotlyChart;
