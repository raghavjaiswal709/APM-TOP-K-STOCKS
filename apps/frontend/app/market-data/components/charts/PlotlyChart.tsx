'use client';
import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { 
  ChevronRight, 
  TrendingUp,
  BarChart3,
  LineChart,
  CandlestickChart,
  ArrowLeftRight,
  ShoppingCart,
  TrendingDown
} from "lucide-react";
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
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
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
interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  ohlcData?: OHLCPoint[];
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
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [mainMode, setMainMode] = useState<'none' | 'bidAsk' | 'buySell'>('none');
  const [secondaryView, setSecondaryView] = useState<'line' | 'spread' | 'std'>('line');
  const [showIndicators, setShowIndicators] = useState<{
    sma20: boolean;
    ema9: boolean;
    rsi: boolean;
    macd: boolean;
    bb: boolean;
    vwap: boolean;
    volume: boolean;
  }>({
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
    let buyPrice = 0;
    let sellPrice = 0;
    let basePrice = 0;
    if ('ltp' in dataPoint) {
      basePrice = dataPoint.ltp;
    } else if ('close' in dataPoint) {
      basePrice = dataPoint.close;
    }
    const { buyVolume, sellVolume } = calculateBuySellVolume(dataPoint);
    const totalVolume = buyVolume + sellVolume;
    if (totalVolume > 0) {
      const buyWeight = buyVolume / totalVolume;
      const sellWeight = sellVolume / totalVolume;
      const imbalance = (buyVolume - sellVolume) / totalVolume;
      const priceSpread = basePrice * 0.001;
      buyPrice = basePrice + (priceSpread * buyWeight) + (imbalance * priceSpread * 0.5);
      sellPrice = basePrice - (priceSpread * sellWeight) - (imbalance * priceSpread * 0.5);
    } else {
      buyPrice = basePrice;
      sellPrice = basePrice;
    }
    return { buyPrice, sellPrice };
  };
  const prepareLineChartData = () => {
    const allData = [...historicalData];
    if (data && data.ltp) {
      const lastPoint = historicalData.length > 0 ? 
        historicalData[historicalData.length - 1] : null;
      if (!lastPoint || lastPoint.timestamp !== data.timestamp) {
        allData.push(data);
      }
    }
    allData.sort((a, b) => a.timestamp - b.timestamp);
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
    const sma20 = allData.map(point => point.sma_20 || null);
    const ema9 = allData.map(point => point.ema_9 || null);
    const rsi = allData.map(point => point.rsi_14 || null);
    const buyVolumes = allData.map(point => calculateBuySellVolume(point).buyVolume);
    const sellVolumes = allData.map(point => calculateBuySellVolume(point).sellVolume);
    const buyPrices = allData.map((point, index) => calculateBuySellPrices(point, index).buyPrice);
    const sellPrices = allData.map((point, index) => calculateBuySellPrices(point, index).sellPrice);
    const buySellSpreads = allData.map((point, index) => {
      const { buyPrice, sellPrice } = calculateBuySellPrices(point, index);
      return buyPrice - sellPrice;
    });
    return { x, y, allData, sma20, ema9, rsi, bid, ask, spread, buyVolumes, sellVolumes, buyPrices, sellPrices, buySellSpreads };
  };
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
  const { bid, ask, x } = prepareLineChartData();
  const windowSize = 20;
  const bidStdDev = [];
  const askStdDev = [];
  for (let i = 0; i < bid.length; i++) {
    const startIndex = Math.max(0, i - windowSize + 1);
    const bidWindow = bid.slice(startIndex, i + 1).filter(b => b !== null && b !== undefined) as number[];
    const askWindow = ask.slice(startIndex, i + 1).filter(a => a !== null && a !== undefined) as number[];
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
    const data = prepareLineChartData();
    x = data.x;
    buyPrices = data.buyPrices;
    sellPrices = data.sellPrices;
  } else {
    const data = prepareCandlestickData();
    x = data.x;
    buyPrices = data.buyPrices;
    sellPrices = data.sellPrices;
  }
  const windowSize = 20;
  const buyStdDev = [];
  const sellStdDev = [];
  for (let i = 0; i < buyPrices.length; i++) {
    const startIndex = Math.max(0, i - windowSize + 1);
    const buyWindow = buyPrices.slice(startIndex, i + 1).filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
    const sellWindow = sellPrices.slice(startIndex, i + 1).filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
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
 const prepareCandlestickData = () => {
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
  const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);
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
};
const calculateYAxisRange = () => {
    const timeRange = getTimeRange();
    if (!timeRange) return undefined;
    const startTime = timeRange[0].getTime() / 1000;
    const endTime = timeRange[1].getTime() / 1000;
    if (chartType === 'line') {
      if (historicalData.length === 0) return undefined;
      const visibleData = historicalData.filter(
        point => point.timestamp >= startTime && point.timestamp <= endTime
      );
      if (visibleData.length === 0) return undefined;
      const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
      if (prices.length === 0) return undefined;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    } else {
      if (!ohlcData || ohlcData.length === 0) return undefined;
      const visibleCandles = ohlcData.filter(
        candle => candle.timestamp >= startTime && candle.timestamp <= endTime
      );
      if (visibleCandles.length === 0) return undefined;
      const validCandles = visibleCandles.filter(candle => 
        candle.high !== null && candle.high !== undefined &&
        candle.low !== null && candle.low !== undefined
      );
      if (validCandles.length === 0) return undefined;
      const highPrices = validCandles.map(candle => Number(candle.high));
      const lowPrices = validCandles.map(candle => Number(candle.low));
      const minPrice = Math.min(...lowPrices);
      const maxPrice = Math.max(...highPrices);
      const padding = (maxPrice - minPrice) * 0.05;
      return [minPrice - padding, maxPrice + padding];
    }
  };
  const calculateBidAskRange = () => {
    const { bid, ask } = prepareLineChartData();
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
      const { buyPrices: bp, sellPrices: sp } = prepareLineChartData();
      buyPrices = bp.filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
      sellPrices = sp.filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
    } else {
      const { buyPrices: bp, sellPrices: sp } = prepareCandlestickData();
      buyPrices = bp.filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
      sellPrices = sp.filter(p => p !== null && p !== undefined && !isNaN(p)) as number[];
    }
    if (buyPrices.length === 0 || sellPrices.length === 0) return undefined;
    const minPrice = Math.min(...sellPrices);
    const maxPrice = Math.max(...buyPrices);
    const padding = (maxPrice - minPrice) * 0.05;
    return [minPrice - padding, maxPrice + padding];
  };
  const calculateSpreadRange = () => {
    const { spread } = prepareLineChartData();
    const validSpreads = spread.filter(s => s !== null && s !== undefined) as number[];
    if (validSpreads.length === 0) return [0, 1];
    const minSpread = Math.min(...validSpreads);
    const maxSpread = Math.max(...validSpreads);
    const padding = Math.max((maxSpread - minSpread) * 0.1, 0.01);
    return [Math.max(0, minSpread - padding), maxSpread + padding];
  };
const calculateBuySellSpreadRange = () => {
    let buySellSpreads: number[] = [];
    if (chartType === 'line') {
      const { buySellSpreads: bss } = prepareLineChartData();
      buySellSpreads = bss.filter(s => s !== null && s !== undefined && !isNaN(s)) as number[];
    } else {
      const { buySellSpreads: bss } = prepareCandlestickData();
      buySellSpreads = bss.filter(s => s !== null && s !== undefined && !isNaN(s)) as number[];
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
      const { volume } = prepareCandlestickData();
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
      const { buyVolumes: bv, sellVolumes: sv } = prepareLineChartData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    } else {
      const { buyVolumes: bv, sellVolumes: sv } = prepareCandlestickData();
      buyVolumes = bv.filter(v => v !== null && v !== undefined) as number[];
      sellVolumes = sv.filter(v => v !== null && v !== undefined) as number[];
    }
    if (buyVolumes.length === 0 && sellVolumes.length === 0) return [0, 1000];
    const maxBuyVolume = buyVolumes.length > 0 ? Math.max(...buyVolumes) : 0;
    const maxSellVolume = sellVolumes.length > 0 ? Math.max(...sellVolumes) : 0;
    const maxVolume = Math.max(maxBuyVolume, maxSellVolume);
    return [0, maxVolume * 1.1];
  };
  const getTimeRange = () => {
    const dataToUse = chartType === 'line' ? historicalData : ohlcData;
    if (!dataToUse || dataToUse.length === 0) return undefined;
    const now = data?.timestamp 
      ? new Date(data.timestamp * 1000) 
      : new Date();
    let startTime = new Date(now);
    switch (selectedTimeframe) {
      case '1m':
        startTime.setMinutes(now.getMinutes() - 1);
        break;
      case '5m':
        startTime.setMinutes(now.getMinutes() - 5);
        break;
      case '10m':
        startTime.setMinutes(now.getMinutes() - 10);
        break;
      case '30m':
        startTime.setMinutes(now.getMinutes() - 30);
        break;
      case '1H':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6H':
        startTime.setHours(now.getHours() - 6);
        break;
      case '12H':
        startTime.setHours(now.getHours() - 12);
        break;
      case '1D':
      default:
        try {
          const tradingStart = new Date(tradingHours.start);
          return [tradingStart, now > new Date(tradingHours.end) ? new Date(tradingHours.end) : now];
        } catch (e) {
          startTime.setHours(now.getHours() - 24);
        }
    }
    return [startTime, now];
  };
  const getColorTheme = () => {
    return {
      bg: '#18181b',
      paper: '#18181b',
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
    const { y } = prepareLineChartData();
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
  setSelectedTimeframe(timeframe);
  setPreservedAxisRanges({});
  if (!chartRef.current) return;
  const plotDiv = document.getElementById('plotly-chart');
  if (!plotDiv) return;
  try {
    const newTimeRange = getTimeRange();
    const newYRange = calculateYAxisRange();
    Plotly.relayout(plotDiv, {
      'xaxis.range': newTimeRange,
      'xaxis.autorange': false,
      'yaxis.range': newYRange,
      'yaxis.autorange': newYRange ? false : true
    });
    const spreadDiv = document.getElementById('spread-chart');
    if (spreadDiv && mainMode === 'bidAsk' && secondaryView === 'spread') {
      Plotly.relayout(spreadDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateSpreadRange(),
        'yaxis.autorange': false
      });
    }
    const bidAskDiv = document.getElementById('bid-ask-chart');
    if (bidAskDiv && mainMode === 'bidAsk' && secondaryView === 'line') {
      Plotly.relayout(bidAskDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBidAskRange(),
        'yaxis.autorange': false
      });
    }
    const volumeDiv = document.getElementById('volume-chart');
    if (volumeDiv && showIndicators.volume) {
      Plotly.relayout(volumeDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateVolumeRange(),
        'yaxis.autorange': false
      });
    }
    const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
    if (buySellVolumeDiv && mainMode !== 'none' && secondaryView === 'std') {
      Plotly.relayout(buySellVolumeDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBuySellVolumeRange(),
        'yaxis.autorange': false
      });
    }
    const buySellLineDiv = document.getElementById('buy-sell-line-chart');
    if (buySellLineDiv && mainMode === 'buySell' && secondaryView === 'line') {
      Plotly.relayout(buySellLineDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBuySellRange(),
        'yaxis.autorange': false
      });
    }
    const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
    if (buySellSpreadDiv && mainMode === 'buySell' && secondaryView === 'spread') {
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
          if (plotDiv) {
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
  if (plotDiv && plotDiv.layout) {
    const currentLayout = plotDiv.layout;
    setPreservedAxisRanges({
      xaxis: currentLayout.xaxis?.range ? [
        new Date(currentLayout.xaxis.range[0]), 
        new Date(currentLayout.xaxis.range[1])
      ] : undefined,
      yaxis: currentLayout.yaxis?.range ? [
        currentLayout.yaxis.range[0], 
        currentLayout.yaxis.range[1]
      ] : undefined
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
  const handleRelayout = (eventData: any) => {
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
      if (minValue !== undefined && maxValue !== undefined) {
        const padding = (maxValue - minValue) * 0.05;
        const yRange = [minValue - padding, maxValue + padding];
        const plotDiv = document.getElementById('plotly-chart');
        if (plotDiv) {
          Plotly.relayout(plotDiv, {
            'yaxis.range': yRange,
            'yaxis.autorange': false
          });
        }
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          Plotly.relayout(bidAskDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          Plotly.relayout(spreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const volumeDiv = document.getElementById('volume-chart');
        if (volumeDiv) {
          Plotly.relayout(volumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          Plotly.relayout(buySellVolumeDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const buySellLineDiv = document.getElementById('buy-sell-line-chart');
        if (buySellLineDiv) {
          Plotly.relayout(buySellLineDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
        const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
        if (buySellSpreadDiv) {
          Plotly.relayout(buySellSpreadDiv, {
            'xaxis.range': [startDate, endDate],
            'xaxis.autorange': false
          });
        }
      }
    }
  };
  useEffect(() => {
    if (!chartRef.current) return;
    const plotDiv = document.getElementById('plotly-chart');
    if (!plotDiv) return;
    if (!initialized) {
      setInitialized(true);
      return;
    }
    try {
      if (chartType === 'line') {
        const { x, y } = prepareLineChartData();
        if (x.length === 0 || y.length === 0) return;
        Plotly.react(plotDiv, createPlotData(), createLayout());
      } else {
        const { x, open, high, low, close } = prepareCandlestickData();
        if (x.length === 0) return;
        Plotly.react(plotDiv, createPlotData(), createLayout());
      }
      if (mainMode === 'bidAsk' && secondaryView === 'line') {
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          const { x, bid, ask } = prepareLineChartData();
          Plotly.react(bidAskDiv, createBidAskData(), createBidAskLayout());
        }
      }
      if (mainMode === 'bidAsk' && secondaryView === 'spread') {
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          const { x, spread } = prepareLineChartData();
          Plotly.react(spreadDiv, createSpreadData(), createSpreadLayout());
        }
      }
      if (showIndicators.volume) {
        const volumeDiv = document.getElementById('volume-chart');
        if (volumeDiv) {
          Plotly.react(volumeDiv, createVolumeData(), createVolumeLayout());
        }
      }
      if (mainMode !== 'none' && secondaryView === 'std') {
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          Plotly.react(buySellVolumeDiv, createStdData(), createStdLayout());
        }
      }
      if (mainMode === 'buySell' && secondaryView === 'line') {
        const buySellLineDiv = document.getElementById('buy-sell-line-chart');
        if (buySellLineDiv) {
          Plotly.react(buySellLineDiv, createBuySellLineData(), createBuySellLineLayout());
        }
      }
      if (mainMode === 'buySell' && secondaryView === 'spread') {
        const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
        if (buySellSpreadDiv) {
          Plotly.react(buySellSpreadDiv, createBuySellSpreadData(), createBuySellSpreadLayout());
        }
      }
    } catch (err) {
      console.error('Error updating chart:', err);
    }
  }, [data, historicalData, ohlcData, initialized, selectedTimeframe, chartType, showIndicators, mainMode, secondaryView]);
const createPlotData = () => {
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
    const { x, open, high, low, close, volume, volumeStdDev, buyVolumes, sellVolumes } = prepareCandlestickData();
    if (x.length === 0) return plotData;
    const hoverText = x.map((date, i) => 
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
      const { close: candleClose, x: candleX } = prepareCandlestickData();
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
      const { close: candleClose, x: candleX } = prepareCandlestickData();
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
    const { x, spread } = prepareLineChartData();
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
      const { x, bid, ask } = prepareLineChartData();
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
        const data = prepareLineChartData();
        x = data.x;
        buyPrices = data.buyPrices;
        sellPrices = data.sellPrices;
      } else {
        const data = prepareCandlestickData();
        x = data.x;
        buyPrices = data.buyPrices;
        sellPrices = data.sellPrices;
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
      const data = prepareLineChartData();
      x = data.x;
      buySellSpreads = data.buySellSpreads;
    } else {
      const data = prepareCandlestickData();
      x = data.x;
      buySellSpreads = data.buySellSpreads;
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
  let volumeColors: string[] = [];
  if (chartType === 'line') {
    const data = prepareLineChartData();
    x = data.x;
    volumes = data.allData.map(point => point.volume || 0);
    for (let i = 0; i < data.allData.length; i++) {
      if (i === 0) {
        volumeColors.push(colors.upColor);
      } else {
        const currentPrice = data.allData[i].ltp;
        const prevPrice = data.allData[i - 1].ltp;
        volumeColors.push(currentPrice >= prevPrice ? colors.upColor : colors.downColor);
      }
    }
  } else {
    const data = prepareCandlestickData();
    x = data.x;
    volumes = data.volume;
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
      const data = prepareLineChartData();
      x = data.x;
      volumeStdDev = data.allData.map((point, index) => 
        calculateVolumeStandardDeviation(point, index)
      );
    } else {
      const data = prepareCandlestickData();
      x = data.x;
      volumeStdDev = data.volumeStdDev;
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
  const timeRange = preservedAxisRanges.xaxis ? 
    [preservedAxisRanges.xaxis[0], preservedAxisRanges.xaxis[1]] : 
    getTimeRange();
  const yRange = preservedAxisRanges.yaxis ? 
    [preservedAxisRanges.yaxis[0], preservedAxisRanges.yaxis[1]] : 
    calculateYAxisRange();
  let mainChartDomain = [0, 1];
  let volumeDomain = [0, 0.2];
 if (chartType === 'line') {
  if (showIndicators.rsi && showIndicators.macd) {
    mainChartDomain = [0.6, 1];           // Changed from [0.5, 1]
    volumeDomain = [0.25, 0.55];          // Changed from [0.3, 0.45] - increased height
  } else if (showIndicators.rsi || showIndicators.macd) {
    mainChartDomain = [0.45, 1];          // Changed from [0.35, 1]
    volumeDomain = [0.1, 0.4];            // Changed from [0.15, 0.3] - increased height
  } else {
    mainChartDomain = [0.35, 1];          // Changed from [0.2, 1]
    volumeDomain = [0, 0.3];              // Changed from [0, 0.15] - doubled the height
  }
}
 else {
    if (showIndicators.rsi && showIndicators.macd) {
      mainChartDomain = [0.5, 1];
    } else if (showIndicators.rsi || showIndicators.macd) {
      mainChartDomain = [0.3, 1];
    }
  }
  const layout: any = {
    autosize: true,
    margin: { l: 50, r: 50, t: 40, b: 40 },
    title: {
      text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
      font: { size: 16, color: colors.text },
    },
    xaxis: {
      title: 'Time',
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
      title: 'Price (₹)',
      range: yRange,
      autorange: yRange ? false : true,
      fixedrange: false,
      gridcolor: colors.grid,
      linecolor: colors.grid,
      tickfont: { color: colors.text },
      titlefont: { color: colors.text },
      side: 'left',
      domain: mainChartDomain,
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
      const { volumeStdDev: stdDev } = prepareCandlestickData();
      volumeStdDev = stdDev;
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
    { label: '12H', value: '12H' },
    { label: '1D', value: '1D' },
  ];
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between mb-2 space-x-2">
        {}
        <div className="flex space-x-1 bg-zinc-900 p-1 rounded-md border border-zinc-700">
          {timeframeButtons.map((button) => (
            <button
              key={button.value}
              className={`px-2 py-1 text-xs rounded ${
                selectedTimeframe === button.value
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
        {}
        <div className="flex space-x-1 bg-zinc-800 p-1 rounded-md border border-zinc-600">
          <button
            className={`p-1 rounded ${
              chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
            onClick={() => setChartType('line')}
            title="Line Chart (LTP)"
          >
            <LineChart className="h-5 w-5" />
          </button>
          <button
            className={`p-1 rounded ${
              chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
                        onClick={() => setChartType('candle')}
            title="Candlestick Chart (OHLC)"
          >
            <CandlestickChart className="h-5 w-5" />
          </button>
        </div>
        {}
        <div className="flex space-x-1 bg-slate-800 p-1 rounded-md border border-slate-600">
          <button
            className={`p-1 rounded ${
              showIndicators.sma20 ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => toggleIndicator('sma20')}
            title="SMA 20"
          >
            <span className="text-xs font-bold">SMA</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.ema9 ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => toggleIndicator('ema9')}
            title="EMA 9"
          >
            <span className="text-xs font-bold">EMA</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.rsi ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => toggleIndicator('rsi')}
            title="RSI"
          >
            <span className="text-xs font-bold">RSI</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.macd ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => toggleIndicator('macd')}
            title="MACD"
          >
            <span className="text-xs font-bold">MACD</span>
          </button>
          <button
            className={`p-1 rounded ${
              showIndicators.bb ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            onClick={() => toggleIndicator('bb')}
            title="Bollinger Bands"
          >
            <span className="text-xs font-bold">BB</span>
          </button>
          {chartType === 'candle' && (
            <button
              className={`p-1 rounded ${
                showIndicators.vwap ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => toggleIndicator('vwap')}
              title="VWAP"
            >
              <span className="text-xs font-bold">VWAP</span>
            </button>
          )}
        </div>
        {}
        <div className="flex space-x-1 bg-emerald-900 p-1 rounded-md border border-emerald-700">
          <button
            className={`p-1 rounded ${
              mainMode === 'bidAsk' ? 'bg-green-600 text-white' : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
            }`}
            onClick={() => toggleMainMode('bidAsk')}
            title="Bid/Ask Analysis"
          >
            <span className="text-xs font-bold">B/A</span>
          </button>
          <button
            className={`p-1 rounded ${
              mainMode === 'buySell' ? 'bg-emerald-600 text-white' : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
            }`}
            onClick={() => toggleMainMode('buySell')}
            title="Buy/Sell Analysis"
          >
            <span className="text-xs font-bold">B/S</span>
          </button>
          {}
          {mainMode !== 'none' && (
            <>
              <div className="w-px h-6 bg-emerald-600 mx-1"></div>
              <button
                className={`p-1 rounded ${
                  secondaryView === 'line' ? 'bg-blue-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                }`}
                onClick={() => toggleSecondaryView('line')}
                title="Line View"
              >
                <span className="text-xs font-bold">Line</span>
              </button>
              <button
                className={`p-1 rounded ${
                  secondaryView === 'spread' ? 'bg-purple-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                }`}
                onClick={() => toggleSecondaryView('spread')}
                title="Spread View"
              >
                <span className="text-xs font-bold">Spread</span>
              </button>
              <button
                className={`p-1 rounded ${
                  secondaryView === 'std' ? 'bg-orange-500 text-white' : 'bg-emerald-700 text-emerald-400 hover:bg-emerald-600'
                }`}
                onClick={() => toggleSecondaryView('std')}
                title="Standard Deviation View"
              >
                <span className="text-xs font-bold">STD</span>
              </button>
            </>
          )}
        </div>
        {}
        <div className="flex space-x-1 bg-amber-900 p-1 rounded-md border border-amber-700">
          <button
            className={`p-1 rounded ${
              showIndicators.volume ? 'bg-amber-600 text-white' : 'bg-amber-800 text-amber-300 hover:bg-amber-700'
            }`}
            onClick={() => toggleIndicator('volume')}
            title="Volume Chart"
          >
            {}
            VOL
          </button>
        </div>
        </div>
      </div>
      {}
      <div className="flex-1">
        <Plot
          ref={chartRef}
          divId="plotly-chart"
          data={createPlotData()}
          layout={createLayout()}
          config={{
            responsive: true,
            displayModeBar: false,
            scrollZoom: true,
            doubleClick: 'reset',
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          onRelayout={handleRelayout}
        />
      </div>
      {}
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
      {}
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
      {}
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
      {}
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
      {}
      {/* <div className="mt-2 flex items-center space-x-4 text-sm">
        <div className={`flex items-center space-x-2 ${
          tradingHours.isActive ? 'text-green-400' : 'text-red-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            tradingHours.isActive ? 'bg-green-400' : 'bg-red-400'
          }`}></div>
          <span>
            {tradingHours.isActive ? 'Market Open' : 'Market Closed'}
          </span>
        </div>
        <div className="text-zinc-400">
          Trading Hours: {tradingHours.start} - {tradingHours.end}
        </div>
        <div className="text-zinc-400">
          Current Time: {tradingHours.current}
        </div>
        {data && (
          <div className="flex items-center space-x-4">
            <div className="text-zinc-400">
              LTP: ₹{data.ltp?.toFixed(2) || 'N/A'}
            </div>
            {data.change !== undefined && (
              <div className={`flex items-center space-x-1 ${
                data.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.change >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>
                  {data.change >= 0 ? '+' : ''}{data.change.toFixed(2)} 
                  ({data.changePercent !== undefined ? 
                    `${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%` : 'N/A'})
                </span>
              </div>
            )}
            {data.volume !== undefined && (
              <div className="text-zinc-400">
                Vol: {data.volume.toLocaleString()}
              </div>
            )}
            {data.bid !== undefined && data.ask !== undefined && (
              <div className="text-zinc-400">
                Bid: ₹{data.bid.toFixed(2)} | Ask: ₹{data.ask.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div> */}
    </div>
  );
};
export default PlotlyChart;

