
// Types for data
export interface StockDataPoint {
    interval_start: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    // Analysis Fields
    bid?: number;
    ask?: number;
    buyVolume?: number;
    sellVolume?: number;
}

// Types for indicator results
export interface BollingerResult {
    middle: (number | null)[];
    upper: (number | null)[];
    lower: (number | null)[];
}

export interface MACDResult {
    macdLine: (number | null)[];
    signalLine: (number | null)[];
    histogram: (number | null)[];
}

export function calculateSMA(prices: number[], period: number): (number | null)[] {
    const result = new Array(prices.length).fill(null);
    for (let i = 0; i < prices.length; i++) {
        const startIdx = Math.max(0, i - period + 1);
        const windowLength = i - startIdx + 1;
        let sum = 0;
        for (let j = startIdx; j <= i; j++) {
            sum += prices[j];
        }
        result[i] = sum / windowLength;
    }
    return result;
}

export function calculateEMA(prices: number[], period: number): (number | null)[] {
    const k = 2 / (period + 1);
    const result = new Array(prices.length).fill(null);

    if (prices.length > 0) {
        // Start with simple average of first `period` points (or all available)
        const warmupLength = Math.min(period, prices.length);
        let sum = 0;
        for (let i = 0; i < warmupLength; i++) {
            sum += prices[i];
        }
        result[0] = sum / warmupLength; // Initial SMA

        // Apply EMA formula
        for (let i = 1; i < prices.length; i++) {
            const prev = result[i - 1];
            if (prev !== null) {
                result[i] = prices[i] * k + prev * (1 - k);
            } else {
                result[i] = prices[i]; // Fallback if prev is null (shouldn't happen with this logic)
            }
        }
    }
    return result;
}

export function calculateBollinger(prices: number[], period: number = 20, stdDevMultiplier: number = 2): BollingerResult {
    const ma = calculateSMA(prices, period);
    const upperBand = new Array(prices.length).fill(null);
    const lowerBand = new Array(prices.length).fill(null);

    for (let i = 0; i < prices.length; i++) {
        if (ma[i] === null) continue;

        const startIdx = Math.max(0, i - period + 1);
        const windowLength = i - startIdx + 1;
        let sumSquares = 0;

        for (let j = startIdx; j <= i; j++) {
            const diff = prices[j] - (ma[i] as number);
            sumSquares += diff * diff;
        }

        const stdDev = Math.sqrt(sumSquares / windowLength);
        upperBand[i] = (ma[i] as number) + (stdDev * stdDevMultiplier);
        lowerBand[i] = (ma[i] as number) - (stdDev * stdDevMultiplier);
    }

    return { middle: ma, upper: upperBand, lower: lowerBand };
}

export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
    const result = new Array(prices.length).fill(null);

    if (prices.length >= 2) {
        const changes: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        const startIdx = Math.min(period, changes.length);

        for (let i = startIdx; i < prices.length; i++) {
            const changeIdx = i - 1;
            const windowStart = Math.max(0, changeIdx - period + 1);

            const windowChanges = changes.slice(windowStart, changeIdx + 1);
            const gains = windowChanges.filter(c => c > 0).reduce((a, b) => a + b, 0);
            const losses = windowChanges.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0);

            const windowLength = (changeIdx - windowStart + 1);
            const avgGain = gains / windowLength;
            const avgLoss = losses / windowLength;

            if (avgLoss === 0) {
                result[i] = avgGain === 0 ? 50 : 100;
            } else {
                const rs = avgGain / avgLoss;
                result[i] = 100 - (100 / (1 + rs));
            }
        }
    }
    return result;
}

export function calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): MACDResult {
    // Calculate Fast and Slow EMAs
    const fastEMA = calculateEMA(prices, fastPeriod);
    const slowEMA = calculateEMA(prices, slowPeriod);

    const macdLine = fastEMA.map((fast, i) => {
        if (fast === null || slowEMA[i] === null) return null;
        return fast - slowEMA[i];
    });

    // Calculate Signal Line (EMA of MACD Line)
    // Filter nulls first, then calculate, then align back
    const validMacdIndices: number[] = [];
    const validMacdValues: number[] = [];

    macdLine.forEach((val, i) => {
        if (val !== null) {
            validMacdIndices.push(i);
            validMacdValues.push(val);
        }
    });

    const signalValues = validMacdValues.length > 0 ? calculateEMA(validMacdValues, signalPeriod) : [];

    // Reconstruct signal line with nulls where MACD was null or signal not ready
    const signalLine = new Array(macdLine.length).fill(null);
    validMacdIndices.forEach((originalIndex, i) => {
        if (i < signalValues.length) {
            signalLine[originalIndex] = signalValues[i];
        }
    });

    // Histogram = MACD - Signal
    const histogram = macdLine.map((macd, i) => {
        if (macd === null || signalLine[i] === null) return null;
        return macd - signalLine[i];
    });

    return { macdLine, signalLine, histogram };
}

export function convertToHeikenAshi(data: StockDataPoint[]) {
    if (!data || data.length === 0) return [];
    const haData: any[] = [];
    let prevHA: any = null;

    for (let i = 0; i < data.length; i++) {
        const current = data[i];
        const currentHigh = current.high;
        const currentLow = current.low;
        const currentOpen = current.open;
        const currentClose = current.close;

        let haOpen: number;
        // HA Close = (Open + High + Low + Close) / 4
        const haClose = (currentOpen + currentHigh + currentLow + currentClose) / 4;

        if (prevHA === null) {
            // HA Open for first bar is average of open/close
            haOpen = (currentOpen + currentClose) / 2;
        } else {
            // HA Open = (Prev HA Open + Prev HA Close) / 2
            haOpen = (prevHA.ha_open + prevHA.ha_close) / 2;
        }

        // HA High = Max(High, HA Open, HA Close)
        const haHigh = Math.max(currentHigh, haOpen, haClose);
        // HA Low = Min(Low, HA Open, HA Close)
        const haLow = Math.min(currentLow, haOpen, haClose);

        const haCandle = {
            ...current,
            open: haOpen,
            high: haHigh,
            low: haLow,
            close: haClose,
            ha_open: haOpen,
            ha_close: haClose, // Store for next iteration
        };

        haData.push(haCandle);
        prevHA = haCandle;
    }
    return haData;
}
