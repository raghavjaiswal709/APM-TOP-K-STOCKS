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
  const [initialized, setInitialized] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1D');
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  
  // New state structure for the main/secondary button system
  const [mainMode, setMainMode] = useState<'none' | 'bidAsk' | 'buySell'>('none');
  const [secondaryView, setSecondaryView] = useState<'line' | 'spread'>('line');
  
  const [showIndicators, setShowIndicators] = useState<{
    sma20: boolean;
    ema9: boolean;
    rsi: boolean;
    macd: boolean;
    bb: boolean;
    vwap: boolean;
    buySellVolume: boolean;
  }>({
    sma20: false,
    ema9: false,
    rsi: false,
    macd: false,
    bb: false,
    vwap: false,
    buySellVolume: false
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
      // Calculate based on price movement
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
    
    // Calculate VWAP-like buy/sell prices based on volume distribution
    const { buyVolume, sellVolume } = calculateBuySellVolume(dataPoint);
    const totalVolume = buyVolume + sellVolume;
    
    if (totalVolume > 0) {
      const buyWeight = buyVolume / totalVolume;
      const sellWeight = sellVolume / totalVolume;
      
      // Estimate price impact based on volume imbalance
      const imbalance = (buyVolume - sellVolume) / totalVolume;
      const priceSpread = basePrice * 0.001; // 0.1% spread assumption
      
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
    
    // Calculate buy-sell prices and spreads
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
  const windowSize = 20; // 20-period rolling standard deviation
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
  
  // First EMA value is SMA
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
  
  // Calculate buy-sell prices and spreads for candlestick data
  const buyPrices = sortedData.map((candle, index) => calculateBuySellPrices(candle, index).buyPrice);
  const sellPrices = sortedData.map((candle, index) => calculateBuySellPrices(candle, index).sellPrice);
  const buySellSpreads = sortedData.map((candle, index) => {
    const { buyPrice, sellPrice } = calculateBuySellPrices(candle, index);
    return buyPrice - sellPrice;
  });
  
  // Ensure volume is properly converted to numbers
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
        buySellSpread: '#8b5cf6'
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

  // New toggle functions for the main/secondary button system
  const toggleMainMode = (mode: 'bidAsk' | 'buySell') => {
    if (mainMode === mode) {
      setMainMode('none');
    } else {
      setMainMode(mode);
      setSecondaryView('line'); // Default to line when switching modes
    }
  };

  const toggleSecondaryView = (view: 'line' | 'spread') => {
    setSecondaryView(view);
  };
  
  const handleTimeframeChange = (timeframe: string) => {
  setSelectedTimeframe(timeframe);
  
  // Clear preserved ranges when manually changing timeframe
  setPreservedAxisRanges({});
  
  if (!chartRef.current) return;
  
  const plotDiv = document.getElementById('plotly-chart');
  if (!plotDiv) return;
  
  try {
    // Get fresh time and y ranges for the new timeframe
    const newTimeRange = getTimeRange();
    const newYRange = calculateYAxisRange();
    
    // Update main chart with new ranges
    Plotly.relayout(plotDiv, {
      'xaxis.range': newTimeRange,
      'xaxis.autorange': false,
      'yaxis.range': newYRange,
      'yaxis.autorange': newYRange ? false : true
    });
    
    // Update spread chart if visible
    const spreadDiv = document.getElementById('spread-chart');
    if (spreadDiv && mainMode === 'bidAsk' && secondaryView === 'spread') {
      Plotly.relayout(spreadDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateSpreadRange(),
        'yaxis.autorange': false
      });
    }
    
    // Update bid-ask chart if visible
    const bidAskDiv = document.getElementById('bid-ask-chart');
    if (bidAskDiv && mainMode === 'bidAsk' && secondaryView === 'line') {
      Plotly.relayout(bidAskDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBidAskRange(),
        'yaxis.autorange': false
      });
    }
    
    // Update buy-sell volume chart if visible
    const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
    if (buySellVolumeDiv && showIndicators.buySellVolume) {
      Plotly.relayout(buySellVolumeDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBuySellVolumeRange(),
        'yaxis.autorange': false
      });
    }

    // Update buy-sell line chart if visible
    const buySellLineDiv = document.getElementById('buy-sell-line-chart');
    if (buySellLineDiv && mainMode === 'buySell' && secondaryView === 'line') {
      Plotly.relayout(buySellLineDiv, {
        'xaxis.range': newTimeRange,
        'xaxis.autorange': false,
        'yaxis.range': calculateBuySellRange(),
        'yaxis.autorange': false
      });
    }

// Update buy-sell spread chart if visible
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
    
    // Fallback: Force complete chart re-render if relayout fails
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

const toggleIndicator = (indicator: 'sma20' | 'ema9' | 'rsi' | 'macd' | 'bb' | 'vwap' | 'buySellVolume') => {
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
        
        // @ts-ignore - Plotly is available globally
        Plotly.react(plotDiv, createPlotData(), createLayout());
      } else {
        const { x, open, high, low, close } = prepareCandlestickData();
        if (x.length === 0) return;
        
        // @ts-ignore - Plotly is available globally
        Plotly.react(plotDiv, createPlotData(), createLayout());
      }
      
      if (mainMode === 'bidAsk' && secondaryView === 'line') {
        const bidAskDiv = document.getElementById('bid-ask-chart');
        if (bidAskDiv) {
          const { x, bid, ask } = prepareLineChartData();
          
          // @ts-ignore - Plotly is available globally
          Plotly.react(bidAskDiv, createBidAskData(), createBidAskLayout());
        }
      }
      
      if (mainMode === 'bidAsk' && secondaryView === 'spread') {
        const spreadDiv = document.getElementById('spread-chart');
        if (spreadDiv) {
          const { x, spread } = prepareLineChartData();
          
          // @ts-ignore - Plotly is available globally
          Plotly.react(spreadDiv, createSpreadData(), createSpreadLayout());
        }
      }
      
      if (showIndicators.buySellVolume) {
        const buySellVolumeDiv = document.getElementById('buy-sell-volume-chart');
        if (buySellVolumeDiv) {
          // @ts-ignore - Plotly is available globally
          Plotly.react(buySellVolumeDiv, createBuySellVolumeData(), createBuySellVolumeLayout());
        }
      }

      if (mainMode === 'buySell' && secondaryView === 'line') {
        const buySellLineDiv = document.getElementById('buy-sell-line-chart');
        if (buySellLineDiv) {
          // @ts-ignore - Plotly is available globally
          Plotly.react(buySellLineDiv, createBuySellLineData(), createBuySellLineLayout());
        }
      }

if (mainMode === 'buySell' && secondaryView === 'spread') {
        const buySellSpreadDiv = document.getElementById('buy-sell-spread-chart');
        if (buySellSpreadDiv) {
          // @ts-ignore - Plotly is available globally
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
    // Line chart implementation with integrated volume bars
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

      // Main LTP line chart
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

      // Volume bars integrated into LTP chart
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
      size: 60000 // Adjust based on your time interval (60000ms = 1 minute)
    },
    yaxis: 'y3',
    hovertemplate: '<b>%{fullData.name}</b><br>' +
                  'Time: %{x|%H:%M:%S}<br>' +
                  'Volume: %{y:,.0f}<br>' +
                  '<extra></extra>',
    showlegend: true
  });
}

// SMA 20 for line chart
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

      // EMA 9 for line chart
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

      // Bollinger Bands for line chart
      if (showIndicators.bb && priceValues.length >= 20) {
        const bbData = calculateBollingerBands(priceValues, 20, 2);
        if (bbData && bbData.upper && bbData.middle && bbData.lower) {
          // Upper band
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

          // Middle band
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

          // Lower band
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
    // Candlestick chart implementation
    const { x, open, high, low, close, volume, volumeStdDev, buyVolumes, sellVolumes } = prepareCandlestickData();
    
    if (x.length === 0) return plotData;

    // Main candlestick chart
// Create hover text array
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

// SMA 20 for candlestick chart
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

    // EMA 9 for candlestick chart
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

    // Bollinger Bands for candlestick chart
    if (showIndicators.bb && close.length >= 20) {
      const bbData = calculateBollingerBands(close, 20, 2);
      if (bbData && bbData.upper && bbData.middle && bbData.lower) {
        // Upper band
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

// Middle band
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

        // Lower band with fill
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

    // VWAP for candlestick chart
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

  // RSI indicator (common for both chart types) - FIXED ARRAY VALIDATION
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
      // Ensure close is an array and filter valid prices
      if (Array.isArray(candleClose)) {
        priceData = candleClose.filter(price => 
          price !== null && price !== undefined && !isNaN(price)
        );
        timeData = Array.isArray(candleX) ? candleX.slice(14) : [];
      }
    }

    if (priceData.length >= 15) { // Need at least period + 1 for RSI
      const rsiValues = calculateRSI(priceData, 14);
      
      if (rsiValues && rsiValues.length > 0 && timeData.length === rsiValues.length) {
        // Main RSI line
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

        // RSI overbought line (70)
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

        // RSI oversold line (30)
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

        // RSI middle line (50)
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

  // MACD indicator (common for both chart types) - FIXED ARRAY VALIDATION
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
      // Ensure close is an array and filter valid prices
      if (Array.isArray(candleClose)) {
        priceData = candleClose.filter(price => 
          price !== null && price !== undefined && !isNaN(price)
        );
        timeDataMACD = Array.isArray(candleX) ? candleX.slice(25) : [];
        timeDataSignal = Array.isArray(candleX) ? candleX.slice(33) : [];
      }
    }

if (priceData.length >= 35) { // Need at least 26 + 9 for MACD signal
      const macdData = calculateMACD(priceData, 12, 26, 9);

      if (macdData && macdData.macdLine && macdData.signalLine && macdData.histogram && 
          timeDataMACD.length === macdData.macdLine.length && 
          timeDataSignal.length === macdData.signalLine.length) {
        
        // MACD line
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

        // Signal line
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

        // MACD histogram
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
  };

  const createBuySellLineData = () => {
    const colors = getColorTheme();
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

 const createBuySellVolumeData = () => {
  const colors = getColorTheme();
  let x: Date[] = [];
  let volumeStdDev: number[] = [];
  
  if (chartType === 'line') {
    const data = prepareLineChartData();
    x = data.x;
    // Calculate volume standard deviation for line chart
    volumeStdDev = data.allData.map((point, index) => 
      calculateVolumeStandardDeviation(point, index)
    );
  } else {
    const data = prepareCandlestickData();
    x = data.x;
    volumeStdDev = data.volumeStdDev;
  }
  
  return [
    {
      x,
      y: volumeStdDev,
      type: 'bar',
      name: 'Volume Std Dev',
      marker: { 
        color: volumeStdDev.map((val, i) => {
          if (chartType === 'candle') {
            const { close, open } = prepareCandlestickData();
            if (close[i] && open[i]) {
              return close[i] >= open[i] ? colors.upColor : colors.downColor;
            }
          } else {
            // For line chart, use a gradient based on std dev value
            const maxStdDev = Math.max(...volumeStdDev);
            const intensity = val / maxStdDev;
            return `rgba(59, 130, 246, ${0.3 + intensity * 0.7})`;
          }
          return colors.grid;
        }),
        opacity: 0.8 
      },
      hovertemplate: '<b>%{fullData.name}</b><br>' +
                    'Time: %{x|%H:%M:%S}<br>' +
                    'Std Dev: %{y:.4f}<br>' +
                    '<extra></extra>',
    }
  ];
};

const createLayout = () => {
  const colors = getColorTheme();
  
  // Use preserved ranges if available, otherwise calculate new ones
  const timeRange = preservedAxisRanges.xaxis ? 
    [preservedAxisRanges.xaxis[0], preservedAxisRanges.xaxis[1]] : 
    getTimeRange();
  const yRange = preservedAxisRanges.yaxis ? 
    [preservedAxisRanges.yaxis[0], preservedAxisRanges.yaxis[1]] : 
    calculateYAxisRange();
  
  // Determine main chart domain based on active indicators and chart type
  let mainChartDomain = [0, 1];
  let volumeDomain = [0, 0.2]; // Default volume domain for LTP chart
  
 if (chartType === 'line') {
  // For line chart, always show volume at bottom
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
    // For candlestick chart, volume is not shown by default
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
  
  
  // Add volume y-axis for line chart
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
  
  // Add RSI y-axis if needed
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
  
  // Add MACD y-axis if needed
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
    const bidAskRange = calculateBidAskRange();
    
    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Bid-Ask Prices',
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
        title: 'Price (₹)',
        range: bidAskRange,
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
    const buySellRange = calculateBuySellRange();
    
    return {
      autosize: true,
      height: 200,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: 'Buy-Sell Prices',
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
        title: 'Price (₹)',
        range: buySellRange,
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

const createBuySellVolumeLayout = () => {
  const colors = getColorTheme();
  const timeRange = getTimeRange();
  
  // Calculate volume std dev range
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
  const volumeRange = [0, maxStdDev * 1.1];
  
  return {
    autosize: true,
    height: 180,
    margin: { l: 50, r: 50, t: 30, b: 30 },
    title: {
      text: 'Volume Standard Deviation',
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
      <div className="flex justify-between mb-2">
        <div className="flex space-x-1">
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
        
        <div className="flex space-x-2">
          <button
            className={`p-1 rounded ${
              chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('line')}
            title="Line Chart (LTP)"
          >
            <LineChart className="h-5 w-5" />
          </button>
          
          <button
            className={`p-1 rounded ${
              chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => setChartType('candle')}
            title="Candlestick Chart (OHLC)"
          >
            <CandlestickChart className="h-5 w-5" />
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.sma20 ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('sma20')}
            title="SMA 20"
          >
            <span className="text-xs font-bold">SMA</span>
          </button>
          
                      <button
            className={`p-1 rounded ${
              showIndicators.ema9 ? 'bg-purple-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('ema9')}
            title="EMA 9"
          >
            <span className="text-xs font-bold">EMA</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.rsi ? 'bg-pink-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('rsi')}
            title="RSI"
          >
            <span className="text-xs font-bold">RSI</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.macd ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('macd')}
            title="MACD"
          >
            <span className="text-xs font-bold">MACD</span>
          </button>
          
          <button
            className={`p-1 rounded ${
              showIndicators.bb ? 'bg-slate-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('bb')}
            title="Bollinger Bands"
          >
            <span className="text-xs font-bold">BB</span>
          </button>
          
          {chartType === 'candle' && (
            <button
              className={`p-1 rounded ${
                showIndicators.vwap ? 'bg-cyan-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
              onClick={() => toggleIndicator('vwap')}
              title="VWAP"
            >
              <span className="text-xs font-bold">VWAP</span>
            </button>
          )}
          
          {/* New Main Toggle Buttons */}
          <button
            className={`p-1 rounded ${
              mainMode === 'bidAsk' ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleMainMode('bidAsk')}
            title="Bid/Ask Analysis"
          >
            B/A
          </button>
          
          <button
            className={`p-1 rounded ${
              mainMode === 'buySell' ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleMainMode('buySell')}
            title="Buy/Sell Analysis"
          >
            B/S
          </button>
          
          {/* Secondary View Toggle Buttons - only show when a main mode is active */}
          {mainMode !== 'none' && (
            <>
              <button
                className={`p-1 rounded ${
                  secondaryView === 'line' ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
                onClick={() => toggleSecondaryView('line')}
                title="Line View"
              >
                <span className="text-xs font-bold">Line</span>
              </button>
              
              <button
                className={`p-1 rounded ${
                  secondaryView === 'spread' ? 'bg-purple-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
                onClick={() => toggleSecondaryView('spread')}
                title="Spread View"
              >
                <span className="text-xs font-bold">Spread</span>
              </button>
            </>
          )}
          
          <button
            className={`p-1 rounded ${
              showIndicators.buySellVolume ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
            onClick={() => toggleIndicator('buySellVolume')}
            title="Buy-Sell Volume Analysis"
          >
            STD
          </button>
        </div>
      </div>
      
      <div className="flex-1">
        <Plot
          ref={chartRef}
          divId="plotly-chart"
          data={createPlotData()}
          layout={createLayout()}
          config={{
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d', 'autoScale2d'],
            displaylogo: false,
          }}
          onRelayout={handleRelayout}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      
      {/* Bid/Ask Line Chart */}
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
              displaylogo: false,
            }}
            style={{ width: '100%', height: '200px' }}
          />
        </div>
      )}
      
      {/* Bid/Ask Spread Chart */}
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
              displaylogo: false,
            }}
            style={{ width: '100%', height: '150px' }}
          />
        </div>
      )}

      {/* Buy/Sell Line Chart */}
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
              displaylogo: false,
            }}
            style={{ width: '100%', height: '200px' }}
          />
        </div>
      )}

      {/* Buy/Sell Spread Chart */}
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
              displaylogo: false,
            }}
            style={{ width: '100%', height: '150px' }}
          />
        </div>
      )}
      
      {/* Buy/Sell Volume Chart (independent) */}
      {showIndicators.buySellVolume && (
        <div className="mt-2">
          <Plot
            ref={buySellVolumeChartRef}
            divId="buy-sell-volume-chart"
            data={createBuySellVolumeData()}
            layout={createBuySellVolumeLayout()}
            config={{
              responsive: true,
              displayModeBar: false,
              displaylogo: false,
            }}
            style={{ width: '100%', height: '180px' }}
          />
        </div>
      )}
      
      <div className="text-xs text-zinc-400 mt-2 flex justify-between">
        <span>
          Trading Hours: {tradingHours.start} - {tradingHours.end}
          {tradingHours.isActive && (
            <span className="ml-2 text-green-400">● LIVE</span>
          )}
        </span>
        <span>
          Last Updated: {data?.timestamp ? new Date(data.timestamp * 1000).toLocaleTimeString() : 'N/A'}
        </span>
      </div>
    </div>
  );
};

export default PlotlyChart;
