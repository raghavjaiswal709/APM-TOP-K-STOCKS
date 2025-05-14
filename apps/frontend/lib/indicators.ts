// utils/indicators.ts

// Calculate Exponential Moving Average (EMA)
export const calculateEMA = (data: number[], period: number): (number | null)[] => {
  const k = 2 / (period + 1);
  const emaData: (number | null)[] = [];
  
  // Initialize EMA with SMA for the first period
  let ema = data.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
  
  // Fill initial values with null
  for (let i = 0; i < period - 1; i++) {
    emaData.push(null);
  }
  
  // Add first EMA value
  emaData.push(ema);
  
  // Calculate EMA for the rest of the data
  for (let i = period; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
    emaData.push(ema);
  }
  
  return emaData;
};

// Calculate Relative Strength Index (RSI)
export const calculateRSI = (data: number[], period: number): (number | null)[] => {
  const rsiData: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  // Fill initial values with null
  for (let i = 0; i < period; i++) {
    rsiData.push(null);
  }
  
  // Calculate first average gain and loss
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
  
  // Calculate RSI for the first period
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
  let rsi = 100 - (100 / (1 + rs));
  rsiData.push(rsi);
  
  // Calculate RSI for the rest of the data
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
    
    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss);
    rsi = 100 - (100 / (1 + rs));
    rsiData.push(rsi);
  }
  
  return rsiData;
};

// Calculate Moving Average Convergence Divergence (MACD)
export const calculateMACD = (data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  // Calculate EMAs
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  // Calculate MACD line
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i]! - slowEMA[i]!);
    }
  }
  
  // Calculate signal line (EMA of MACD line)
  const validMacdValues = macdLine.filter(val => val !== null) as number[];
  const signalLine = calculateEMA(validMacdValues, signalPeriod);
  
  // Pad signal line with nulls to match original data length
  const paddedSignalLine: (number | null)[] = Array(data.length - validMacdValues.length).fill(null).concat(signalLine);
  
  // Calculate histogram (MACD line - signal line)
  const histogram: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null || paddedSignalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i]! - paddedSignalLine[i]!);
    }
  }
  
  return {
    macdLine,
    signalLine: paddedSignalLine,
    histogram
  };
};
