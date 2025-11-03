import { CompanyPredictions, PredictionData } from '@/hooks/usePredictions';

/**
 * Format time from YYYY-MM-DD HHMM to readable format
 */
export const formatPredictionTime = (timeStr: string): string => {
  try {
    // Handle format: YYYY-MM-DD HHMM
    const [date, time] = timeStr.split(' ');
    const [year, month, day] = date.split('-');
    const hours = time.substring(0, 2);
    const minutes = time.substring(2, 4);

    return `${day}/${month} ${hours}:${minutes}`;
  } catch {
    return timeStr;
  }
};

/**
 * Get time difference in minutes from predicted time
 */
export const getTimeDiffMinutes = (predictedat: string): number => {
  try {
    const predTime = new Date(predictedat).getTime();
    const now = Date.now();
    return Math.floor((now - predTime) / 60000);
  } catch {
    return -1;
  }
};

/**
 * Determine if prediction is fresh (within threshold)
 */
export const isFreshPrediction = (predictedat: string, thresholdMinutes = 10): boolean => {
  return getTimeDiffMinutes(predictedat) <= thresholdMinutes;
};

/**
 * Get color based on prediction freshness
 */
export const getPredictionFreshnessColor = (predictedat: string): string => {
  const ageMins = getTimeDiffMinutes(predictedat);

  if (ageMins <= 5) return '#10B981'; // Green - fresh
  if (ageMins <= 10) return '#F59E0B'; // Amber - stale
  return '#EF4444'; // Red - very stale
};

/**
 * Format price change
 */
export const formatPriceChange = (current: number, previous: number): string => {
  const change = current - previous;
  const changePercent = ((change / previous) * 100).toFixed(2);
  const symbol = change > 0 ? '+' : '';

  return `${symbol}₹${change.toFixed(2)} (${symbol}${changePercent}%)`;
};

/**
 * Aggregate predictions data for display
 */
export const aggregatePredictions = (predictions: CompanyPredictions) => {
  const predictionsArray = Object.entries(predictions.predictions).map(
    ([timestamp, data]) => ({
      timestamp,
      ...data,
    })
  );

  const prices = predictionsArray.map((p) => p.close);
  const highestPrice = Math.max(...prices);
  const lowestPrice = Math.min(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const latestPrice = predictionsArray[predictionsArray.length - 1]?.close || 0;
  const earliestPrice = predictionsArray[0]?.close || 0;
  const priceRange = highestPrice - lowestPrice;

  return {
    count: predictions.count,
    highestPrice,
    lowestPrice,
    avgPrice,
    latestPrice,
    earliestPrice,
    priceRange,
    priceChangeFromStart: latestPrice - earliestPrice,
    predictionsArray,
  };
};

/**
 * Get statistics for predictions
 */
export const getPredictionStats = (predictions: CompanyPredictions) => {
  const agg = aggregatePredictions(predictions);
  const ageMins = Object.values(predictions.predictions).map((p) =>
    getTimeDiffMinutes(p.predictedat)
  );

  return {
    total: agg.count,
    avgPrice: agg.avgPrice.toFixed(2),
    priceRange: agg.priceRange.toFixed(2),
    highPrice: agg.highestPrice.toFixed(2),
    lowPrice: agg.lowestPrice.toFixed(2),
    avgAgeMins: (ageMins.reduce((a, b) => a + b, 0) / ageMins.length).toFixed(1),
    maxAgeMins: Math.max(...ageMins),
    minAgeMins: Math.min(...ageMins),
  };
};

/**
 * Filter predictions by time range
 */
export const filterPredictionsByTime = (
  predictions: CompanyPredictions,
  startTime?: string,
  endTime?: string
): CompanyPredictions => {
  const filtered = { ...predictions };
  const filtered_predictions: Record<string, PredictionData> = {};

  Object.entries(predictions.predictions).forEach(([timestamp, data]) => {
    if (startTime && timestamp < startTime) return;
    if (endTime && timestamp > endTime) return;
    filtered_predictions[timestamp] = data;
  });

  filtered.predictions = filtered_predictions;
  filtered.count = Object.keys(filtered_predictions).length;

  return filtered;
};

/**
 * Calculate confidence level based on prediction age
 */
export const getConfidenceLevel = (predictedat: string): {
  level: 'high' | 'medium' | 'low';
  percentage: number;
  label: string;
} => {
  const ageMins = getTimeDiffMinutes(predictedat);

  if (ageMins <= 5) {
    return {
      level: 'high',
      percentage: 100 - ageMins * 5,
      label: 'High Confidence',
    };
  }

  if (ageMins <= 15) {
    return {
      level: 'medium',
      percentage: Math.max(50, 100 - ageMins * 3),
      label: 'Medium Confidence',
    };
  }

  return {
    level: 'low',
    percentage: Math.max(20, 100 - ageMins * 2),
    label: 'Low Confidence',
  };
};

/**
 * Convert predictions to market data format for merging with live data
 */
export const convertPredictionsToMarketData = (predictions: CompanyPredictions) => {
  return Object.entries(predictions.predictions).map(([timestamp, data]) => ({
    time: timestamp,
    close: data.close,
    type: 'prediction' as const,
    predictedat: data.predictedat,
    confidence: getConfidenceLevel(data.predictedat),
  }));
};

/**
 * Merge predicted and actual market data
 */
export const mergeMarketDataWithPredictions = (
  actualData: any[],
  predictions: CompanyPredictions
) => {
  const predictionMap = convertPredictionsToMarketData(predictions);
  const merged = [...actualData];

  predictionMap.forEach((pred) => {
    const exists = merged.findIndex((d) => d.time === pred.time);
    if (exists === -1) {
      merged.push(pred);
    } else {
      merged[exists] = { ...merged[exists], ...pred };
    }
  });

  return merged.sort((a, b) => a.time.localeCompare(b.time));
};

/**
 * Validate prediction data
 */
export const isValidPredictionData = (data: any): data is CompanyPredictions => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.company === 'string' &&
    typeof data.predictions === 'object' &&
    typeof data.count === 'number' &&
    data.count >= 0
  );
};

/**
 * Get next expected prediction time
 */
export const getNextPredictionTime = (lastPredictionTime: string): Date => {
  const lastTime = new Date(lastPredictionTime);
  const nextTime = new Date(lastTime.getTime() + 5 * 60 * 1000); // Add 5 minutes
  return nextTime;
};

/**
 * Format data age for display
 */
export const formatDataAge = (ageSeconds: number): string => {
  if (ageSeconds < 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMins = Math.floor(ageSeconds / 60);
  if (ageMins < 60) {
    return `${ageMins}m ago`;
  }

  const ageHours = Math.floor(ageMins / 60);
  return `${ageHours}h ago`;
};

/**
 * Check if we're in trading hours
 */
export const isTradingHours = (): boolean => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const dayOfWeek = istTime.getDay();

  // Trading hours: 9:15 AM to 3:30 PM, Monday to Friday
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Weekend

  const startTime = 9 * 60 + 15; // 9:15 AM
  const endTime = 15 * 60 + 30; // 3:30 PM
  const currentTime = hours * 60 + minutes;

  return currentTime >= startTime && currentTime <= endTime;
};

/**
 * Get trading day status
 */
export const getTradingStatus = (): {
  isTrading: boolean;
  status: 'pre-market' | 'trading' | 'post-market' | 'closed';
  nextOpenTime: Date;
} => {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const dayOfWeek = istTime.getDay();

  // Weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    const nextOpen = new Date(istTime);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 15, 0, 0);

    return {
      isTrading: false,
      status: 'closed',
      nextOpenTime: nextOpen,
    };
  }

  const currentTime = hours * 60 + minutes;
  const preMarketStart = 9 * 60; // 9:00 AM
  const tradingStart = 9 * 60 + 15; // 9:15 AM
  const tradingEnd = 15 * 60 + 30; // 3:30 PM

  if (currentTime < preMarketStart) {
    const nextOpen = new Date(istTime);
    nextOpen.setHours(9, 15, 0, 0);
    return {
      isTrading: false,
      status: 'pre-market',
      nextOpenTime: nextOpen,
    };
  }

  if (currentTime < tradingStart) {
    const nextOpen = new Date(istTime);
    nextOpen.setHours(9, 15, 0, 0);
    return {
      isTrading: false,
      status: 'pre-market',
      nextOpenTime: nextOpen,
    };
  }

  if (currentTime <= tradingEnd) {
    return {
      isTrading: true,
      status: 'trading',
      nextOpenTime: new Date(),
    };
  }

  const nextOpen = new Date(istTime);
  nextOpen.setDate(nextOpen.getDate() + (dayOfWeek === 5 ? 3 : 1)); // Friday to Monday
  nextOpen.setHours(9, 15, 0, 0);

  return {
    isTrading: false,
    status: 'post-market',
    nextOpenTime: nextOpen,
  };
};
