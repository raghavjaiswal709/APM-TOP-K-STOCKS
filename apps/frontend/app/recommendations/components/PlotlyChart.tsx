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

interface RawDataPoint {
  symbol: string;
  ltp: number;
  vol_traded_today: number;
  last_traded_time: number;
  bid_size: number;
  ask_size: number;
  bid_price: number;
  ask_price: number;
  low_price: number;
  high_price: number;
  open_price: number;
  prev_close_price: number;
  timestamp: number;
}

interface PlotlyChartProps {
  symbol: string;
  data: DataPoint | null;
  historicalData: DataPoint[];
  rawOhlcData?: RawDataPoint[]; 
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
  rawOhlcData = [],
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
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');

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

  const calculateStandardDeviation = (values: number[]): number => {
    try {
      const validValues = values.filter(value => 
        typeof value === 'number' && 
        !isNaN(value) && 
        isFinite(value) &&
        value !== null &&
        value !== undefined
      );
      
      if (validValues.length <= 1) return 0;
      
      const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
      
      const variance = validValues.reduce((sum, value) => {
        const diff = value - mean;
        return sum + (diff * diff);
      }, 0) / (validValues.length - 1); 
      
      const result = Math.sqrt(variance);
      return isNaN(result) || !isFinite(result) ? 0 : result;
    } catch (error) {
      console.error('Error calculating standard deviation:', error);
      return 0;
    }
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

const transformRawDataToOHLC = (rawData: RawDataPoint[]): OHLCPoint[] => {
  if (!rawData || rawData.length === 0) return [];
  
  return rawData.map(item => {
    const high = item.high_price > 0 ? item.high_price : item.ltp;
    const low = item.low_price > 0 ? item.low_price : item.ltp;
    const open = item.open_price > 0 ? item.open_price : item.ltp;
    
    // Debug volume mapping
    const volumeValue = item.vol_traded_today || 0;
    console.log('📊 Volume mapping:', { timestamp: item.timestamp, vol_traded_today: item.vol_traded_today, mapped_volume: volumeValue });
    
    return {
      timestamp: item.timestamp,
      open: open,
      high: Math.max(high, item.ltp, open),
      low: Math.min(low, item.ltp, open),
      close: item.ltp,
      volume: volumeValue,  // <- CONFIRMED CORRECT MAPPING
      buyVolume: 0,
      sellVolume: 0  
    };
  });
};


  const prepareCandlestickData = () => {
    let transformedOhlcData: OHLCPoint[] = [];
    
    if (rawOhlcData && rawOhlcData.length > 0) {
      transformedOhlcData = transformRawDataToOHLC(rawOhlcData);
    } else if (ohlcData && ohlcData.length > 0) {
      transformedOhlcData = ohlcData;
    }
    
    if (transformedOhlcData.length === 0) {
      console.log('❌ No OHLC data available');
      return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [], buyPrices: [], sellPrices: [], buySellSpreads: [] };
    }
    
    console.log('🔍 Raw OHLC data points:', transformedOhlcData.length);
    
    const validOhlcData = transformedOhlcData.filter(candle => {
      const isValid = candle.open > 0 && 
                     candle.high > 0 && 
                     candle.low > 0 && 
                     candle.close > 0 &&
                     !isNaN(candle.open) &&
                     !isNaN(candle.high) &&
                     !isNaN(candle.low) &&
                     !isNaN(candle.close) &&
                     candle.timestamp > 0 &&
                     candle.high >= candle.low &&
                     candle.high >= candle.open &&
                     candle.high >= candle.close &&
                     candle.low <= candle.open &&
                     candle.low <= candle.close;
      
      if (!isValid) {
        console.log('❌ Invalid candle filtered:', candle);
      }
      return isValid;
    });
    
    if (validOhlcData.length === 0) {
      console.log('❌ No valid OHLC data after filtering');
      return { x: [], open: [], high: [], low: [], close: [], volume: [], volumeStdDev: [], buyVolumes: [], sellVolumes: [], buyPrices: [], sellPrices: [], buySellSpreads: [] };
    }
    
    const aggregationInterval = 30;
    const minuteMap = new Map();
    
    const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);
    
    sortedData.forEach(candle => {
  const intervalKey = Math.floor(candle.timestamp / aggregationInterval) * aggregationInterval;
  const intervalDate = new Date(intervalKey * 1000);
  
  const key = `${intervalDate.getFullYear()}-${intervalDate.getMonth()}-${intervalDate.getDate()}-${intervalDate.getHours()}-${intervalDate.getMinutes()}-${Math.floor(intervalDate.getSeconds() / aggregationInterval)}`;
  
  // Ensure we're getting the volume correctly
  const volumeValue = candle.volume || 0;
  
  if (!minuteMap.has(key)) {
    minuteMap.set(key, {
      timestamp: intervalKey,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: volumeValue,  // <- FIXED
      buyVolume: candle.buyVolume || 0,
      sellVolume: candle.sellVolume || 0,
      count: 1
    });
  } else {
    const existing = minuteMap.get(key);
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume = Math.max(existing.volume, volumeValue); // <- CHANGED: Use max instead of sum for cumulative volume
    existing.buyVolume += (candle.buyVolume || 0);
    existing.sellVolume += (candle.sellVolume || 0);
    existing.count += 1;
  }
});

    
    const aggregatedData = Array.from(minuteMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('✅ Aggregated OHLC data points:', aggregatedData.length);

    
    
    const buyPrices = aggregatedData.map((candle, index) => calculateBuySellPrices(candle, index).buyPrice);
    const sellPrices = aggregatedData.map((candle, index) => calculateBuySellPrices(candle, index).sellPrice);
    const buySellSpreads = aggregatedData.map((candle, index) => {
      const { buyPrice, sellPrice } = calculateBuySellPrices(candle, index);
      return buyPrice - sellPrice;
    });
    
    const result = {
      x: aggregatedData.map(candle => new Date(candle.timestamp * 1000)),
      open: aggregatedData.map(candle => Number(candle.open)),
      high: aggregatedData.map(candle => Number(candle.high)),
      low: aggregatedData.map(candle => Number(candle.low)),
      close: aggregatedData.map(candle => Number(candle.close)),
      volume: aggregatedData.map(candle => Number(candle.volume || 0)),
      volumeStdDev: aggregatedData.map((candle, index) => calculateVolumeStandardDeviation(candle, index)),
      buyVolumes: aggregatedData.map(candle => calculateBuySellVolume(candle).buyVolume),
      sellVolumes: aggregatedData.map(candle => calculateBuySellVolume(candle).sellVolume),
      buyPrices,
      sellPrices,
      buySellSpreads
    };

    console.log('📊 Final candlestick data sample:', {
  points: result.x.length,
  firstCandle: result.x.length > 0 ? {
    time: result.x[0],
    open: result.open[0],
    high: result.high[0],
    low: result.low[0],
    close: result.close[0],
    volume: result.volume[0]  // <- ADD VOLUME TO DEBUG
  } : null,
  volumeStats: {
    totalVolume: result.volume.reduce((sum, v) => sum + v, 0),
    maxVolume: Math.max(...result.volume),
    nonZeroVolumes: result.volume.filter(v => v > 0).length
  }
});

    
    console.log('📊 Final candlestick data sample:', {
      points: result.x.length,
      firstCandle: result.x.length > 0 ? {
        time: result.x[0],
        open: result.open[0],
        high: result.high[0],
        low: result.low[0],
        close: result.close[0]
      } : null
    });
    
    return result;
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
    
    const currentTime = data?.timestamp 
      ? new Date(data.timestamp * 1000) 
      : new Date();
        
    const tradingDate = new Date(currentTime);
    
    const tradingStart = new Date(tradingDate);
    tradingStart.setHours(9, 15, 0, 0);
    
    const tradingEnd = new Date(tradingDate);
    tradingEnd.setHours(15, 30, 0, 0);
    
    if (data?.timestamp) {
      const dataDate = new Date(data.timestamp * 1000);
      tradingStart.setFullYear(dataDate.getFullYear(), dataDate.getMonth(), dataDate.getDate());
      tradingEnd.setFullYear(dataDate.getFullYear(), dataDate.getMonth(), dataDate.getDate());
    }
    
    let startTime = new Date(tradingStart);
    let endTime = new Date(Math.min(currentTime.getTime(), tradingEnd.getTime()));
    
    switch (selectedTimeframe) {
      case '1m':
        startTime = new Date(Math.max(endTime.getTime() - (1 * 60 * 1000), tradingStart.getTime()));
        break;
      case '5m':
        startTime = new Date(Math.max(endTime.getTime() - (5 * 60 * 1000), tradingStart.getTime()));
        break;
      case '10m':
        startTime = new Date(Math.max(endTime.getTime() - (10 * 60 * 1000), tradingStart.getTime()));
        break;
      case '30m':
        startTime = new Date(Math.max(endTime.getTime() - (30 * 60 * 1000), tradingStart.getTime()));
        break;
      case '1H':
        startTime = new Date(Math.max(endTime.getTime() - (60 * 60 * 1000), tradingStart.getTime()));
        break;
      case '6H':
        startTime = new Date(Math.max(endTime.getTime() - (6 * 60 * 60 * 1000), tradingStart.getTime()));
        break;
      case '12H':
        startTime = new Date(Math.max(endTime.getTime() - (12 * 60 * 60 * 1000), tradingStart.getTime()));
        break;
      case '1D':
      default:
        startTime = tradingStart;
        endTime = new Date(Math.min(currentTime.getTime(), tradingEnd.getTime()));
        break;
    }
    
    startTime = new Date(Math.max(startTime.getTime(), tradingStart.getTime()));
    endTime = new Date(Math.min(endTime.getTime(), tradingEnd.getTime()));
    
    return [startTime, endTime];
  };

  const isWithinTradingHours = (timestamp: number): boolean => {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    const currentMinutes = hours * 60 + minutes;
    
    return currentMinutes >= 555 && currentMinutes <= 930;
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

      // Use consistent volume data like separate volume chart
  const lineData = prepareLineChartData();
  const volumeValues = lineData.allData.map(point => point.volume || 0);
  
  if (volumeValues.some(v => v > 0)) {
    const volumeColors = [];
    
    for (let i = 0; i < lineData.allData.length; i++) {
      if (i === 0) {
        volumeColors.push(colors.upColor);
      } else {
        const currentPrice = lineData.allData[i].ltp;
        const prevPrice = lineData.allData[i - 1].ltp;
        volumeColors.push(currentPrice >= prevPrice ? colors.upColor : colors.downColor);
      }
    }

    plotData.push({
      x: lineData.x,  // Use consistent x-axis data
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
  const { x, open, high, low, close, volume } = prepareCandlestickData();
  
  // Create candlestick plot
  plotData.push({
    x: x,
    open: open,
    high: high,
    low: low,
    close: close,
    type: 'candlestick',
    name: 'Price',
    increasing: {
      fillcolor: colors.upColor,
      line: { color: colors.upColor, width: 1 }
    },
    decreasing: {
      fillcolor: colors.downColor,
      line: { color: colors.downColor, width: 1 }
    },
    hovertemplate: '<b>%{fullData.name}</b><br>' +
                  'Time: %{x|%H:%M:%S}<br>' +
                  'Open: ₹%{open:.2f}<br>' +
                  'High: ₹%{high:.2f}<br>' +
                  'Low: ₹%{low:.2f}<br>' +
                  'Close: ₹%{close:.2f}<br>' +
                  '<extra></extra>',
    showlegend: true,
    yaxis: 'y'
  });

  // Use consistent volume data like separate volume chart
  const lineData = prepareLineChartData();
  const volumeValues = lineData.allData.map(point => point.volume || 0);
  
  if (volumeValues.some(v => v > 0)) {
    console.log('🔍 Volume data check:', {
      volumeLength: volumeValues.length,
      hasNonZeroVolume: volumeValues.some(v => v > 0),
      maxVolume: Math.max(...volumeValues),
      minVolume: Math.min(...volumeValues)
    });

    const volumeColors = [];
    
    for (let i = 0; i < lineData.allData.length; i++) {
      if (i === 0) {
        volumeColors.push(colors.upColor);
      } else {
        const currentPrice = lineData.allData[i].ltp;
        const prevPrice = lineData.allData[i - 1].ltp;
        volumeColors.push(currentPrice >= prevPrice ? colors.upColor : colors.downColor);
      }
    }

    plotData.push({
      x: lineData.x,  // Use consistent x-axis data
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
      yaxis: 'y3',
      hovertemplate: '<b>%{fullData.name}</b><br>' +
                    'Time: %{x|%H:%M:%S}<br>' +
                    'Volume: %{y:,.0f}<br>' +
                    '<extra></extra>',
      showlegend: true
    });
  }
}


    if (showIndicators.rsi) {
      const priceData = chartType === 'line' 
        ? historicalData?.filter(point => 
            point.ltp !== null && 
            point.ltp !== undefined && 
            point.ltp > 0 && 
            !isNaN(point.ltp)
          ).map(point => Number(point.ltp)) || []
        : close.filter(price => price !== null && price !== undefined && !isNaN(price));

      if (priceData.length >= 14) {
        const rsiValues = calculateRSI(priceData, 14);
        const timeData = chartType === 'line'
          ? historicalData?.filter(point => 
              point.ltp !== null && 
              point.ltp !== undefined && 
              point.ltp > 0 && 
              !isNaN(point.ltp)
            ).slice(13).map(point => new Date(point.timestamp * 1000)) || []
          : x.slice(13);

        if (rsiValues && rsiValues.length > 0 && timeData.length > 0) {
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
      const priceData = chartType === 'line' 
        ? historicalData?.filter(point => 
            point.ltp !== null && 
            point.ltp !== undefined && 
            point.ltp > 0 && 
            !isNaN(point.ltp)
          ).map(point => Number(point.ltp)) || []
        : close.filter(price => price !== null && price !== undefined && !isNaN(price));

      if (priceData.length >= 26) {
        const macdData = calculateMACD(priceData, 12, 26, 9);
        const timeData = chartType === 'line'
          ? historicalData?.filter(point => 
              point.ltp !== null && 
              point.ltp !== undefined && 
              point.ltp > 0 && 
              !isNaN(point.ltp)
            ).slice(25).map(point => new Date(point.timestamp * 1000)) || []
          : x.slice(25);

        if (macdData && macdData.macdLine && macdData.signalLine && macdData.histogram && timeData.length > 0) {
          plotData.push({
            x: timeData,
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
            x: timeData,
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
            x: timeData,
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
    
    // Always use line chart data for separate volume chart to keep it consistent
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
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: colors.indicator.bid, width: 2 },
          marker: { size: 4 },
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
          mode: 'lines+markers',
          line: { color: colors.indicator.ask, width: 2 },
          marker: { size: 4 },
          name: 'Ask Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Std Dev: %{y:.4f}<br>' +
                        '<extra></extra>',
        }
      ];
    } else if (mainMode === 'buySell') {
      const { x, buyStdDev, sellStdDev } = calculateBuySellStandardDeviation();
      
      return [
        {
          x,
          y: buyStdDev,
          type: 'scatter',
          mode: 'lines+markers',
          line: { color: colors.indicator.buyPrice, width: 2 },
          marker: { size: 4 },
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
          mode: 'lines+markers',
          line: { color: colors.indicator.sellPrice, width: 2 },
          marker: { size: 4 },
          name: 'Sell Price Std Dev',
          hovertemplate: '<b>%{fullData.name}</b><br>' +
                        'Time: %{x|%H:%M:%S}<br>' +
                        'Std Dev: %{y:.4f}<br>' +
                        '<extra></extra>',
        }
      ];
    }
    
    return [];
  };

  const createLayout = () => {
    const colors = getColorTheme();
    
    const timeRange = preservedAxisRanges.xaxis ? 
      [preservedAxisRanges.xaxis[0], preservedAxisRanges.xaxis[1]] : 
      getTimeRange();
    const yRange = preservedAxisRanges.yaxis ? 
      [preservedAxisRanges.yaxis[0], preservedAxisRanges.yaxis[1]] : 
      calculateYAxisRange();

    let volumeDomain = [0, 0.25];
    let mainChartStart = 0.28;
    
    let mainChartDomain = [mainChartStart, 1]; 
    if (showIndicators.rsi && showIndicators.macd) {
      mainChartDomain = [0.52, 1];
      volumeDomain = [0, 0.22];
      mainChartStart = 0.25;
    } else if (showIndicators.rsi || showIndicators.macd) {
      mainChartDomain = [0.35, 1];
      volumeDomain = [0, 0.25];
      mainChartStart = 0.28;
    }

    const layout: any = {
      autosize: true,
      margin: { l: 60, r: 20, t: 40, b: 2 },
      title: {
        text: `${symbol} ${chartType === 'line' ? 'LTP' : 'OHLC'} Chart`,
        font: { size: 16, color: colors.text },
      },
      xaxis: {
        title: 'Time (Trading Hours: 9:15 AM - 3:30 PM)',
        type: 'date',
        range: timeRange,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: 10 },
        titlefont: { color: colors.text, size: 12 },
        rangeslider: { visible: false },
        fixedrange: false,
        tickformat: '%H:%M',
        dtick: 30 * 60 * 1000,
      },
      yaxis: {
        title: 'Price (₹)',
        range: yRange,
        autorange: yRange ? false : true,
        fixedrange: false,
        gridcolor: colors.grid,
        linecolor: colors.grid,
        tickfont: { color: colors.text, size: 10 },
        titlefont: { color: colors.text, size: 12 },
        side: 'left',
        domain: mainChartDomain,
      },
      yaxis3: {
        title: 'Volume',
        titlefont: { color: colors.text, size: 9 },
        tickfont: { color: colors.text, size: 8 },
        domain: volumeDomain,
        showgrid: true,
        gridcolor: colors.grid,
        zeroline: true,
        zerolinecolor: colors.grid,
        side: 'right',
        overlaying: false,
        showticklabels: true,
        tickformat: '.2s',
        fixedrange: false
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        orientation: 'h',
        y: 1.02,
        font: { color: colors.text, size: 10 },
        bgcolor: 'rgba(0,0,0,0)',
      },
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
    
    if (showIndicators.rsi) {
      layout.yaxis2 = {
        title: 'RSI',
        titlefont: { color: colors.text, size: 10 },
        tickfont: { color: colors.text, size: 10 },
        domain: showIndicators.macd ? [0.25, 0.42] : [mainChartStart, 0.25],
        range: [0, 100],
        showgrid: true,
        gridcolor: colors.grid,
      };
    }

    if (showIndicators.macd) {
      layout.yaxis4 = {
        title: 'MACD',
        titlefont: { color: colors.text, size: 10 },
        tickfont: { color: colors.text, size: 10 },
        domain: [mainChartStart, 0.22],
        showgrid: true,
        gridcolor: colors.grid,
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

  const createVolumeLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const volumeRange = calculateVolumeRange();
    
    return {
      autosize: true,
      height: 150,
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
      showlegend: false,
      plot_bgcolor: colors.bg,
      paper_bgcolor: colors.paper,
      font: { family: 'Arial, sans-serif', color: colors.text },
    };
  };

  const createStdLayout = () => {
    const colors = getColorTheme();
    const timeRange = getTimeRange();
    const buySellVolumeRange = calculateBuySellVolumeRange();
    
    return {
      autosize: true,
      height: 150,
      margin: { l: 50, r: 50, t: 30, b: 30 },
      title: {
        text: `${mainMode === 'bidAsk' ? 'Bid-Ask' : 'Buy-Sell'} Standard Deviation`,
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
        title: 'Standard Deviation',
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

  const formatPrice = (price: number | null): string => {
    if (price === null || price === undefined) return 'N/A';
    return `₹${price.toFixed(2)}`;
  };

  const formatChange = (change: number | null, changePercent: number | null): { text: string; color: string } => {
    if (change === null || change === undefined || changePercent === null || changePercent === undefined) {
      return { text: 'N/A', color: '#6b7280' };
    }
    
    const isPositive = change >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';
    const text = `${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
    
    return { text, color };
  };

  const getStatusColor = (isActive: boolean): string => {
    return isActive ? '#10b981' : '#ef4444';
  };

  const timeframes = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '10m', value: '10m' },
    { label: '30m', value: '30m' },
    { label: '1H', value: '1H' },
    { label: '6H', value: '6H' },
    { label: '12H', value: '12H' },
    { label: '1D', value: '1D' },
  ];

  const colors = getColorTheme();

  if (!data && (!historicalData || historicalData.length === 0)) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-zinc-400">No data available</div>
      </div>
    );
  }

  const changeInfo = formatChange(data?.change || null, data?.changePercent || null);

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between mb-2 space-x-2">
        
        <div className="flex space-x-1 bg-zinc-900 p-1 rounded-md border border-zinc-700">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              className={`px-2 py-1 text-xs rounded ${
                selectedTimeframe === tf.value
                  ? `bg-blue-600 text-white`
                  : `bg-zinc-800 text-zinc-300 hover:bg-zinc-700`
              }`}
              onClick={() => handleTimeframeChange(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        
        <div className="flex space-x-4">
          <div className="flex space-x-1 bg-zinc-800 p-1 rounded-md border border-zinc-600">
            <button
              className={`p-1 rounded ${
                chartType === 'line' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
              onClick={toggleChartType}
              title="Line Chart (LTP)"
            >
              <LineChart className="h-5 w-5" />
            </button>
            
            <button
              className={`p-1 rounded ${
                chartType === 'candle' ? 'bg-blue-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
              onClick={toggleChartType}
              title="Candlestick Chart (OHLC)"
            >
              <CandlestickChart className="h-5 w-5" />
            </button>
          </div>
          
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
            
            <button
              className={`p-1 rounded ${
                showIndicators.vwap ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => toggleIndicator('vwap')}
              title="VWAP"
            >
              <span className="text-xs font-bold">VWAP</span>
            </button>
          </div>
          
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
          
          <div className="flex space-x-1 bg-amber-900 p-1 rounded-md border border-amber-700">
            <button
              className={`p-1 rounded ${
                showIndicators.volume ? 'bg-amber-600 text-white' : 'bg-amber-800 text-amber-300 hover:bg-amber-700'
              }`}
              onClick={() => toggleIndicator('volume')}
              title="Volume Chart"
            >
              <span className="text-xs font-bold">VOL</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900 rounded-lg p-4">
          <Plot
            ref={chartRef}
            divId="plotly-chart"
            data={createPlotData()}
            layout={createLayout()}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
              modeBarButtonsToAdd: [],
              displaylogo: false,
              toImageButtonOptions: {
                format: 'png',
                filename: `${symbol}_chart`,
                height: 600,
                width: 1200,
                scale: 1
              }
            }}
            onRelayout={handleRelayout}
            style={{ width: '100%', height: '600px' }}
            useResizeHandler={true}
          />
        </div>

                {mainMode === 'bidAsk' && secondaryView === 'line' && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={bidAskChartRef}
              divId="bid-ask-chart"
              data={createBidAskData()}
              layout={createBidAskLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '200px' }}
              useResizeHandler={true}
            />
          </div>
        )}

        {mainMode === 'bidAsk' && secondaryView === 'spread' && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={spreadChartRef}
              divId="spread-chart"
              data={createSpreadData()}
              layout={createSpreadLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '150px' }}
              useResizeHandler={true}
            />
          </div>
        )}

        {mainMode === 'buySell' && secondaryView === 'line' && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={buySellLineChartRef}
              divId="buy-sell-line-chart"
              data={createBuySellLineData()}
              layout={createBuySellLineLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '200px' }}
              useResizeHandler={true}
            />
          </div>
        )}

        {mainMode === 'buySell' && secondaryView === 'spread' && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={buySellSpreadChartRef}
              divId="buy-sell-spread-chart"
              data={createBuySellSpreadData()}
              layout={createBuySellSpreadLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '150px' }}
              useResizeHandler={true}
            />
          </div>
        )}

        {mainMode !== 'none' && secondaryView === 'std' && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={buySellVolumeChartRef}
              divId="buy-sell-volume-chart"
              data={createStdData()}
              layout={createStdLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '150px' }}
              useResizeHandler={true}
            />
          </div>
        )}

        {showIndicators.volume && (
          <div className="bg-zinc-900 rounded-lg p-4">
            <Plot
              ref={volumeChartRef}
              divId="volume-chart"
              data={createVolumeData()}
              layout={createVolumeLayout()}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
                displaylogo: false,
              }}
              style={{ width: '100%', height: '150px' }}
              useResizeHandler={true}
            />
          </div>
        )}
      </div>

      {/* <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-zinc-400">Current Price</div>
            <div className="text-lg font-bold text-white">
              {formatPrice(data?.ltp || null)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Change</div>
            <div 
              className="text-lg font-bold"
              style={{ color: changeInfo.color }}
            >
              {changeInfo.text}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Bid / Ask</div>
            <div className="text-sm">
              <span className="text-green-400">{formatPrice(data?.bid || null)}</span>
              <span className="text-zinc-500 mx-2">/</span>
              <span className="text-red-400">{formatPrice(data?.ask || null)}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Trading Status</div>
            <div className="flex items-center space-x-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getStatusColor(tradingHours.isActive) }}
              ></div>
              <span className="text-sm text-zinc-300">
                {tradingHours.isActive ? 'Active' : 'Closed'}
              </span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Volume</div>
            <div className="text-white">
              {data?.volume ? data.volume.toLocaleString() : 'N/A'}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">High / Low</div>
            <div className="text-sm">
              <span className="text-green-400">{formatPrice(data?.high || null)}</span>
              <span className="text-zinc-500 mx-2">/</span>
              <span className="text-red-400">{formatPrice(data?.low || null)}</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Open</div>
            <div className="text-white">
              {formatPrice(data?.open || null)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-zinc-400">Trading Hours</div>
            <div className="text-xs text-zinc-300">
              {tradingHours.start} - {tradingHours.end}
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default PlotlyChart;

