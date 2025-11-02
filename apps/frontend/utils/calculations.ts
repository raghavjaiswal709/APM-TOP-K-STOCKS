// utils/calculations.ts
import { DataPoint, OHLCPoint } from '../types/chartTypes';

export const calculateBuySellVolume = (
  dataPoint: DataPoint | OHLCPoint,
  historicalData: DataPoint[]
) => {
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

export const calculateBuySellPrices = (
  dataPoint: DataPoint | OHLCPoint,
  index: number,
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  chartType: 'line' | 'candle'
) => {
  let currentPrice = 0;
  if ('ltp' in dataPoint) {
    currentPrice = dataPoint.ltp;
  } else if ('close' in dataPoint) {
    currentPrice = dataPoint.close;
  }

  const windowSize = 20;
  let prices: number[] = [];
  
  if (chartType === 'line') {
    const startIndex = Math.max(0, index - windowSize + 1);
    prices = historicalData.slice(startIndex, index + 1).map(p => p.ltp);
  } else {
    const startIndex = Math.max(0, index - windowSize + 1);
    prices = ohlcData.slice(startIndex, index + 1).map(c => c.close);
  }
  
  if (prices.length > 1) {
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
    const volatility = Math.sqrt(avgSquaredDiff);
    
    const spreadPercent = Math.min(Math.max(volatility / currentPrice, 0.001), 0.01);
    const halfSpread = currentPrice * spreadPercent / 2;
    
    return {
      buyPrice: currentPrice + halfSpread,
      sellPrice: currentPrice - halfSpread
    };
  }
  
  const defaultSpread = currentPrice * 0.001;
  return {
    buyPrice: currentPrice + defaultSpread,
    sellPrice: currentPrice - defaultSpread
  };
};

export const calculateStandardDeviation = (values: number[], usePopulation = false) => {
  if (values.length === 0) return 0;
  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  const sumOfSquaredDifferences = values.reduce((acc, val) => acc + (val - mean) ** 2, 0);
  return Math.sqrt(sumOfSquaredDifferences / (values.length - (usePopulation ? 0 : 1)));
};

export const calculateVolumeStandardDeviation = (
  dataPoint: DataPoint | OHLCPoint,
  index: number,
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  chartType: 'line' | 'candle'
) => {
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

export const calculateSMA = (prices: number[], period: number) => {
  if (prices.length < period) return [];
  const smaValues = [];
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
    smaValues.push(sum / period);
  }
  return smaValues;
};

export const calculateEMA = (prices: number[], period: number) => {
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

export const calculateRSI = (prices: number[], period: number) => {
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

export const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
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

export const calculateMACD = (prices: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number) => {
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

export const calculateVWAP = (close: number[], high: number[], low: number[], volume: number[]) => {
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
