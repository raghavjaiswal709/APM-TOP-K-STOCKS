// utils/dataPreparation.ts
import { DataPoint, OHLCPoint, ChartUpdate } from '../types/chartTypes';
import { calculateBuySellVolume, calculateBuySellPrices, calculateVolumeStandardDeviation } from './calculations';

export const prepareLineChartData = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[]
) => {
  const allData = [...historicalData];

  if (chartUpdates && chartUpdates.length > 0) {
    const latestHistoricalTime = historicalData.length > 0 ? 
      historicalData[historicalData.length - 1].timestamp : 0;

    const recentUpdates = chartUpdates
      .filter(update => update.timestamp > latestHistoricalTime)
      .map(update => ({
        ltp: update.price,
        timestamp: update.timestamp,
        volume: update.volume,
        change: update.change,
        changePercent: update.changePercent
      } as DataPoint));

    allData.push(...recentUpdates);
  } else if (data && data.ltp) {
    const lastPoint = historicalData.length > 0 ? historicalData[historicalData.length - 1] : null;
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

  const sma20 = allData.map(point => point.sma20 || null);
  const ema9 = allData.map(point => point.ema9 || null);
  const rsi = allData.map(point => point.rsi14 || null);

  const buyVolumes = allData.map(point => point.buyVolume || 0);
  const sellVolumes = allData.map(point => point.sellVolume || 0);

  const buyPrices = allData.map(point => point.ltp * 1.001);
  const sellPrices = allData.map(point => point.ltp * 0.999);

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
};

export const prepareCandlestickData = (ohlcData: OHLCPoint[]) => {
  if (!ohlcData || ohlcData.length === 0) {
    return { 
      x: [], open: [], high: [], low: [], close: [], volume: [], 
      volumeStdDev: [], buyVolumes: [], sellVolumes: [], 
      buyPrices: [], sellPrices: [], buySellSpreads: [] 
    };
  }

  const validOhlcData = ohlcData.filter(candle => 
    candle.open !== null && candle.open !== undefined &&
    candle.high !== null && candle.high !== undefined &&
    candle.low !== null && candle.low !== undefined &&
    candle.close !== null && candle.close !== undefined
  );

  if (validOhlcData.length === 0) {
    return { 
      x: [], open: [], high: [], low: [], close: [], volume: [], 
      volumeStdDev: [], buyVolumes: [], sellVolumes: [], 
      buyPrices: [], sellPrices: [], buySellSpreads: [] 
    };
  }

  const sortedData = [...validOhlcData].sort((a, b) => a.timestamp - b.timestamp);
  
  const buyVolumes = sortedData.map(candle => candle.buyVolume || 0);
  const sellVolumes = sortedData.map(candle => candle.sellVolume || 0);
  
  const buyPrices = sortedData.map(candle => candle.close * 1.001);
  const sellPrices = sortedData.map(candle => candle.close * 0.999);
  const buySellSpreads = sortedData.map((candle, index) => buyPrices[index] - sellPrices[index]);

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
    volumeStdDev: [],
    buyVolumes,
    sellVolumes,
    buyPrices,
    sellPrices,
    buySellSpreads
  };
};

export const getTimeRange = (
  selectedTimeframe: string,
  data: DataPoint | null,
  tradingHours: { start: string; end: string; isActive: boolean },
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[]
): [Date, Date] => {
  const now = data?.timestamp ? new Date(data.timestamp * 1000) : new Date();
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
        const tradingEnd = new Date(tradingHours.end);
        return [tradingStart, now > tradingEnd ? tradingEnd : now];
      } catch (e) {
        startTime.setHours(now.getHours() - 24);
      }
  }
  return [startTime, now];
};

// Additional helper functions
export const calculateYAxisRange = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  timeRange: [Date, Date]
): [number, number] | null => {
  const [startTime, endTime] = timeRange;
  const startTimestamp = startTime.getTime() / 1000;
  const endTimestamp = endTime.getTime() / 1000;

  if (chartType === 'line' && historicalData.length > 0) {
    const visibleData = historicalData.filter(
      point => point.timestamp >= startTimestamp && point.timestamp <= endTimestamp
    );
    
    if (visibleData.length === 0) return null;
    
    const prices = visibleData.map(point => point.ltp).filter(p => p !== null && p !== undefined);
    if (prices.length === 0) return null;
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const padding = (maxPrice - minPrice) * 0.05;
    
    return [minPrice - padding, maxPrice + padding];
  } else if (chartType === 'candle' && ohlcData.length > 0) {
    const visibleData = ohlcData.filter(
      candle => candle.timestamp >= startTimestamp && candle.timestamp <= endTimestamp
    );
    
    if (visibleData.length === 0) return null;
    
    const highPrices = visibleData.map(candle => candle.high).filter(p => p !== null && p !== undefined);
    const lowPrices = visibleData.map(candle => candle.low).filter(p => p !== null && p !== undefined);
    
    if (highPrices.length === 0 || lowPrices.length === 0) return null;
    
    const minPrice = Math.min(...lowPrices);
    const maxPrice = Math.max(...highPrices);
    const padding = (maxPrice - minPrice) * 0.05;
    
    return [minPrice - padding, maxPrice + padding];
  }
  
  return null;
};

export const getColorTheme = (
  historicalData?: DataPoint[],
  data?: DataPoint | null,
  chartUpdates?: ChartUpdate[]
) => {
  return {
    bg: '#18181b',
    paper: '#27272a',
    text: '#f4f4f5',
    grid: '#3f3f46',
    line: '#3b82f6',
    upColor: '#10b981',
    downColor: '#ef4444',
    button: {
      bg: '#3f3f46',
      bgActive: '#3b82f6',
      text: '#f4f4f5'
    },
    indicator: {
      sma20: '#f59e0b',
      ema9: '#8b5cf6',
      rsi: '#ec4899',
      macd: '#3b82f6',
      bb: '#64748b',
      vwap: '#06b6d4',
      bid: '#10b981',
      ask: '#ef4444',
      spread: '#f59e0b',
      buyVolume: '#10b981',
      sellVolume: '#ef4444',
      buyPrice: '#10b981',
      sellPrice: '#ef4444',
      buySellSpread: '#8b5cf6',
      volume: '#64748b',
      std: '#f59e0b'
    }
  };
};

export const getLineColor = (data: DataPoint | null) => {
  if (!data || !data.change) return '#3b82f6';
  return data.change >= 0 ? '#10b981' : '#ef4444';
};

// Add more helper functions as needed for ranges
export const calculateBidAskRange = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[]
): [number, number] | null => {
  // Implementation
  return null;
};

export const calculateSpreadRange = (
  historicalData: DataPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[]
): [number, number] | null => {
  // Implementation
  return null;
};

export const calculateVolumeRange = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[]
): [number, number] | null => {
  // Implementation
  return null;
};

export const calculateBuySellRange = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[]
): [number, number] | null => {
  // Implementation
  return null;
};

export const calculateBuySellVolumeRange = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[]
): [number, number] | null => {
  // Implementation
  return null;
};

export const calculateBuySellSpreadRange = (
  chartType: 'line' | 'candle',
  historicalData: DataPoint[],
  ohlcData: OHLCPoint[],
  data: DataPoint | null,
  chartUpdates: ChartUpdate[]
): [number, number] | null => {
  // Implementation
  return null;
};
