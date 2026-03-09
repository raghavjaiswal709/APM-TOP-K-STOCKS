// Historical Data Fetcher - Fetches missing data for complete day view

export interface HistoricalDataPoint {
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

export interface OHLCCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface FetchResult {
  success: boolean;
  data: HistoricalDataPoint[];
  ohlc?: OHLCCandle[];
  error?: string;
  source: 'external' | 'none';
  metadata?: {
    totalPoints: number;
    candleCount: number;
    timeRange?: { start: string; end: string };
  };
}

// Fetch historical data via API proxy (bypasses CORS)
export async function fetchHistoricalData(
  symbol: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<FetchResult> {
  try {
    // Use Next.js API proxy instead of direct fetch (bypasses CORS)
    const apiUrl = `/api/historical-data?symbol=${encodeURIComponent(symbol)}&date=${date}`;
    
    console.log(`📡 Fetching historical data via API proxy for ${symbol} on ${date}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // ✅ Client-side timeout: abort if API proxy takes too long (e.g. external server unreachable)
      signal: AbortSignal.timeout(12000), // 12 seconds max
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    const result: FetchResult = await response.json();
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Fetched ${result.data.length} historical data points for ${symbol} via API proxy`);
      
      // ✅ CONVERT TICK DATA TO OHLC CANDLES
      const ohlcCandles = convertTicksToOHLC(result.data);
      result.ohlc = ohlcCandles;
      result.metadata = {
        totalPoints: result.data.length,
        candleCount: ohlcCandles.length,
        timeRange: result.data.length > 0 ? {
          start: new Date(result.data[0].timestamp * 1000).toISOString(),
          end: new Date(result.data[result.data.length - 1].timestamp * 1000).toISOString()
        } : undefined
      };
      
      console.log(`✅ Converted to ${ohlcCandles.length} OHLC candles`);
      
      // Validate data date range
      if (result.data.length > 0) {
        const timestamps = result.data.map(d => d.timestamp);
        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);
        
        const minDate = new Date(minTimestamp * 1000);
        const maxDate = new Date(maxTimestamp * 1000);
        const expectedDate = new Date(date);
        
        console.log(`📅 Data date range: ${minDate.toLocaleDateString()} ${minDate.toLocaleTimeString()} → ${maxDate.toLocaleDateString()} ${maxDate.toLocaleTimeString()}`);
        
        // Check if data is from expected date
        if (minDate.toDateString() !== expectedDate.toDateString()) {
          console.warn(`⚠️ DATE MISMATCH: Expected ${expectedDate.toDateString()}, but data is from ${minDate.toDateString()}`);
          console.warn(`   This is OK - we'll filter to show only today's data in the chart.`);
        }
      }
    } else {
      console.error(`❌ API proxy returned error: ${result.error}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Failed to fetch historical data for ${symbol}:`, error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      source: 'none'
    };
  }
}

/**
 * Convert tick data to OHLC candles (1-minute resolution)
 * Properly handles cumulative volume by calculating delta
 */
export function convertTicksToOHLC(ticks: HistoricalDataPoint[]): OHLCCandle[] {
  if (!ticks || ticks.length === 0) return [];
  
  // Sort by timestamp first
  const sortedTicks = [...ticks].sort((a, b) => a.timestamp - b.timestamp);
  
  // Group by minute
  const candleMap = new Map<number, {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    startVolume: number;
    firstTimestamp: number;
  }>();
  
  let prevCumulativeVolume = 0;
  
  sortedTicks.forEach((tick, index) => {
    const minuteTs = Math.floor(tick.timestamp / 60) * 60;
    const price = tick.ltp;
    const cumulativeVolume = tick.vol_traded_today || 0;
    
    // Calculate volume delta
    let volumeDelta = 0;
    if (index > 0 && cumulativeVolume >= prevCumulativeVolume) {
      volumeDelta = cumulativeVolume - prevCumulativeVolume;
    } else if (index === 0) {
      // First tick - use as is or 0
      volumeDelta = 0;
    }
    prevCumulativeVolume = cumulativeVolume;
    
    const existing = candleMap.get(minuteTs);
    
    if (!existing) {
      candleMap.set(minuteTs, {
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volumeDelta,
        startVolume: cumulativeVolume,
        firstTimestamp: tick.timestamp
      });
    } else {
      existing.high = Math.max(existing.high, price);
      existing.low = Math.min(existing.low, price);
      existing.close = price;
      existing.volume += volumeDelta;
    }
  });
  
  // Convert to sorted array
  return Array.from(candleMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, candle]) => ({
      timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: Math.max(0, candle.volume)
    }));
}

// @deprecated - Now handled by API proxy route
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDateForServer(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Merges external historical data with local data
 * Ensures no duplicates and maintains chronological order
 */
export function mergeHistoricalData<T extends { timestamp: number }>(
  localData: T[],
  externalData: T[]
): T[] {
  // Create a map with timestamp as key to eliminate duplicates
  const dataMap = new Map<number, T>();
  
  // Add local data first (it takes priority if same timestamp)
  localData.forEach(point => {
    dataMap.set(point.timestamp, point);
  });
  
  // Add external data (won't overwrite if timestamp exists)
  externalData.forEach(point => {
    if (!dataMap.has(point.timestamp)) {
      dataMap.set(point.timestamp, point);
    }
  });
  
  // Convert to array and sort by timestamp
  return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Merges OHLC candles from external server with real-time candles
 * External data fills gaps from market open (9:15 AM) to subscription time
 * Real-time data takes priority for overlapping timestamps
 */
export function mergeOHLCData(
  realtimeCandles: OHLCCandle[],
  externalCandles: OHLCCandle[]
): OHLCCandle[] {
  const candleMap = new Map<number, OHLCCandle>();
  
  // Add external candles first (will be overwritten by real-time if same timestamp)
  externalCandles.forEach(candle => {
    candleMap.set(candle.timestamp, candle);
  });
  
  // Add real-time candles (these take priority)
  realtimeCandles.forEach(candle => {
    candleMap.set(candle.timestamp, candle);
  });
  
  // Convert to sorted array
  const merged = Array.from(candleMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);
  
  console.log(`🔄 Merged OHLC: ${externalCandles.length} external + ${realtimeCandles.length} realtime = ${merged.length} total candles`);
  
  return merged;
}

/**
 * Get trading day boundaries in IST
 */
export function getTradingDayBoundaries(date: Date = new Date()): {
  marketOpen: Date;
  marketClose: Date;
  marketOpenTimestamp: number;
  marketCloseTimestamp: number;
} {
  // Create date in IST timezone
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  
  const marketOpen = new Date(date);
  marketOpen.setHours(9, 15, 0, 0);
  
  const marketClose = new Date(date);
  marketClose.setHours(15, 30, 0, 0);
  
  return {
    marketOpen,
    marketClose,
    marketOpenTimestamp: Math.floor(marketOpen.getTime() / 1000),
    marketCloseTimestamp: Math.floor(marketClose.getTime() / 1000)
  };
}

/**
 * Check if we need to fetch external data to fill gaps
 * Returns true if:
 * 1. We're after market hours (need full day data)
 * 2. We subscribed mid-day (need data from 9:15 AM to subscription time)
 */
export function needsExternalDataBackfill(
  existingCandles: OHLCCandle[],
  currentTime: Date = new Date()
): { needsBackfill: boolean; reason: string; gapStart?: number; gapEnd?: number } {
  const { marketOpenTimestamp, marketCloseTimestamp } = getTradingDayBoundaries(currentTime);
  const now = Math.floor(currentTime.getTime() / 1000);
  
  // After market hours - always need full day data
  if (now > marketCloseTimestamp) {
    return {
      needsBackfill: true,
      reason: 'after-market',
      gapStart: marketOpenTimestamp,
      gapEnd: marketCloseTimestamp
    };
  }
  
  // No candles at all - need full backfill from market open
  if (!existingCandles || existingCandles.length === 0) {
    return {
      needsBackfill: true,
      reason: 'no-data',
      gapStart: marketOpenTimestamp,
      gapEnd: now
    };
  }
  
  // Check if we have data from market open
  const sortedCandles = [...existingCandles].sort((a, b) => a.timestamp - b.timestamp);
  const firstCandleTimestamp = sortedCandles[0].timestamp;
  
  // If first candle is more than 5 minutes after market open, we have a gap
  const GAP_THRESHOLD = 5 * 60; // 5 minutes
  if (firstCandleTimestamp > marketOpenTimestamp + GAP_THRESHOLD) {
    return {
      needsBackfill: true,
      reason: 'mid-day-subscription',
      gapStart: marketOpenTimestamp,
      gapEnd: firstCandleTimestamp
    };
  }
  
  return { needsBackfill: false, reason: 'complete' };
}

/**
 * Checks if data is complete for the trading day
 * Returns missing time ranges if data has gaps
 */
export function detectDataGaps(
  data: { timestamp: number }[],
  tradingStartHour: number = 9,
  tradingStartMinute: number = 15
): { hasGaps: boolean; missingRanges: Array<{ start: number; end: number }> } {
  if (data.length === 0) {
    return { hasGaps: true, missingRanges: [] };
  }

  // Sort by timestamp
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  
  // Get today's trading start time (9:15 AM)
  const now = new Date();
  const tradingStart = new Date(now);
  tradingStart.setHours(tradingStartHour, tradingStartMinute, 0, 0);
  const tradingStartTimestamp = Math.floor(tradingStart.getTime() / 1000);
  
  // Check if we have data from trading start
  const firstDataTimestamp = sortedData[0].timestamp;
  
  if (firstDataTimestamp > tradingStartTimestamp + 300) { // 5 minutes grace period
    console.warn(`⚠️ Data gap detected: Missing data from ${new Date(tradingStartTimestamp * 1000).toLocaleTimeString()} to ${new Date(firstDataTimestamp * 1000).toLocaleTimeString()}`);
    return { 
      hasGaps: true, 
      missingRanges: [{ start: tradingStartTimestamp, end: firstDataTimestamp }] 
    };
  }
  
  // Check for gaps in the middle (more than 5 minutes between data points)
  const missingRanges: Array<{ start: number; end: number }> = [];
  const MAX_GAP_SECONDS = 300; // 5 minutes
  
  for (let i = 1; i < sortedData.length; i++) {
    const prevTimestamp = sortedData[i - 1].timestamp;
    const currentDataTimestamp = sortedData[i].timestamp;
    const gap = currentDataTimestamp - prevTimestamp;
    
    if (gap > MAX_GAP_SECONDS) {
      missingRanges.push({ start: prevTimestamp, end: currentDataTimestamp });
      console.warn(`⚠️ Data gap detected: ${gap} seconds between ${new Date(prevTimestamp * 1000).toLocaleTimeString()} and ${new Date(currentDataTimestamp * 1000).toLocaleTimeString()}`);
    }
  }
  
  return {
    hasGaps: missingRanges.length > 0 || firstDataTimestamp > tradingStartTimestamp + 300,
    missingRanges
  };
}

/**
 * Get current market status - whether market is open, before market, or after market
 */
export function getMarketStatus(): {
  isOpen: boolean;
  isBeforeMarket: boolean;
  isAfterMarket: boolean;
  marketOpenTimestamp: number;
  marketCloseTimestamp: number;
  currentTimestamp: number;
} {
  const now = new Date();
  const { marketOpenTimestamp, marketCloseTimestamp } = getTradingDayBoundaries(now);
  const currentTimestamp = Math.floor(now.getTime() / 1000);
  
  const isBeforeMarket = currentTimestamp < marketOpenTimestamp;
  const isAfterMarket = currentTimestamp > marketCloseTimestamp;
  const isOpen = !isBeforeMarket && !isAfterMarket;
  
  return {
    isOpen,
    isBeforeMarket,
    isAfterMarket,
    marketOpenTimestamp,
    marketCloseTimestamp,
    currentTimestamp
  };
}

/**
 * Fetch historical data and return it pre-converted to OHLC candles
 * This is a convenience wrapper that handles the full flow
 */
export async function fetchHistoricalDataAsOHLC(
  symbol: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<{
  success: boolean;
  candles: OHLCCandle[];
  rawData: HistoricalDataPoint[];
  error?: string;
  metadata?: {
    totalPoints: number;
    candleCount: number;
    timeRange?: { start: string; end: string };
  };
}> {
  const result = await fetchHistoricalData(symbol, date);
  
  if (!result.success || result.data.length === 0) {
    return {
      success: false,
      candles: [],
      rawData: [],
      error: result.error || 'No data returned'
    };
  }
  
  // The fetchHistoricalData already converts to OHLC, so we can use that
  const candles = result.ohlc || convertTicksToOHLC(result.data);
  
  return {
    success: true,
    candles,
    rawData: result.data,
    metadata: result.metadata
  };
}
