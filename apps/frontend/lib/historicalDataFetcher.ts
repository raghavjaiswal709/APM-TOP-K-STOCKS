/**
 * Historical Data Fetcher
 * Fetches missing historical data from external server to ensure complete day view
 */

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

interface FetchResult {
  success: boolean;
  data: HistoricalDataPoint[];
  error?: string;
  source: 'external' | 'none';
}

/**
 * Fetches historical data from external server for a given symbol
 * Uses Next.js API proxy to bypass CORS restrictions
 */
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
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    const result: FetchResult = await response.json();
    
    if (result.success) {
      console.log(`✅ Fetched ${result.data.length} historical data points for ${symbol} via API proxy`);
      
      // ✅ CRITICAL: Validate actual data date range
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
 * Formats date for external server API
 * Input: 2025-01-08 or Date object
 * Output: 01-08-2025
 * @deprecated - Now handled by API proxy route
 */
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
