// apps/frontend/lib/historicalTimeMachine.ts

console.log('🔄 historicalTimeMachine.ts loaded at:', new Date().toISOString());

// ✅ Dynamic base URL generator
const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/api/time-machine`;
    }
    return '/api/time-machine';
};

console.log('✅ getBaseUrl function initialized');

// ============ TYPES ============
export interface HistoricalLiveData {
    symbol: string;
    ltp: number;
    open_price: number;
    high_price: number;
    low_price: number;
    prev_close_price: number;
    vol_traded_today: number;
    bid_price: number;
    ask_price: number;
    timestamp: number;
}

export interface SthitiClusterData {
    cluster_id: string;
    representative_phrases: string[];
    phrases: Array<{
        headline_text: string;
        absa_sentiment: string;
    }>;
}

export interface SthitiHeadline {
    text: string;
    timestamp: string;
    source: string;
    gpt4o_sentiment: string;
}

export interface SthitiPrediction {
    sentiment: string;
    confidence: number;
    reasoning: string;
    score: number;
}

// ============ UTILITY FUNCTIONS ============

function parseDirectoryListing(html: string): string[] {
    const items: string[] = [];
    const regex = /href="([^"]+)"/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const item = match[1];
        if (item !== '../' && item !== '/' && !item.startsWith('http')) {
            const cleaned = item.replace(/^\/|\/$/g, '');
            if (cleaned) items.push(cleaned);
        }
    }

    return items;
}

function convertLDFormatToISO(ldDate: string): string {
    const match = ldDate.match(/LD_(\d{2})-(\d{2})-(\d{4})/);
    if (!match) return '';
    const [_, day, month, year] = match;
    return `${year}-${month}-${day}`;
}

function convertISOToLDFormat(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `LD_${day}-${month}-${year}`;
}

function parseMessyJSON(rawText: string): HistoricalLiveData | null {
    const lines = rawText.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        try {
            const obj = JSON.parse(lines[i]);
            if (obj.ltp !== undefined) {
                return {
                    symbol: obj.symbol || '',
                    ltp: obj.ltp || 0,
                    open_price: obj.open_price || obj.ltp,
                    high_price: obj.high_price || obj.ltp,
                    low_price: obj.low_price || obj.ltp,
                    prev_close_price: obj.prev_close_price || obj.ltp,
                    vol_traded_today: obj.vol_traded_today || 0,
                    bid_price: obj.bid_price || 0,
                    ask_price: obj.ask_price || 0,
                    timestamp: obj.timestamp || Date.now() / 1000,
                };
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

// ============ API FUNCTIONS ============

export async function fetchAvailableDates(): Promise<string[]> {
    try {
        const baseUrl = getBaseUrl();
        const fullUrl = `${baseUrl}/Live`;

        console.log('🔍 [fetchAvailableDates] Base URL:', baseUrl);
        console.log('🔍 [fetchAvailableDates] Full URL:', fullUrl);

        const response = await fetch(fullUrl, {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('📡 [fetchAvailableDates] Response:', response.status, response.url);

        if (!response.ok) {
            throw new Error(`Failed to fetch dates: ${response.status}`);
        }

        const html = await response.text();
        console.log('📄 [fetchAvailableDates] HTML length:', html.length);

        const items = parseDirectoryListing(html);
        const dates = items
            .filter(item => item.startsWith('LD_'))
            .map(convertLDFormatToISO)
            .filter(Boolean)
            .sort();

        console.log(`✅ [fetchAvailableDates] Found ${dates.length} dates`);
        return dates;
    } catch (error) {
        console.error('❌ [fetchAvailableDates] Error:', error);
        return [];
    }
}

export async function fetchCompaniesForDate(isoDate: string): Promise<string[]> {
    try {
        const baseUrl = getBaseUrl();
        const ldFormat = convertISOToLDFormat(isoDate);
        const fullUrl = `${baseUrl}/Live/${ldFormat}`;

        console.log('🔍 [fetchCompaniesForDate] URL:', fullUrl);

        const response = await fetch(fullUrl, { 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) throw new Error('Failed to fetch companies');

        const html = await response.text();
        const items = parseDirectoryListing(html);
        const symbols = items
            .filter(item => item.endsWith('-NSE.json'))
            .map(item => item.replace('-NSE.json', ''))
            .sort();

        console.log(`✅ [fetchCompaniesForDate] Found ${symbols.length} companies`);
        return symbols;
    } catch (error) {
        console.error('❌ [fetchCompaniesForDate] Error:', error);
        return [];
    }
}

export async function fetchLivePriceData(
    isoDate: string,
    symbol: string
): Promise<HistoricalLiveData | null> {
    try {
        const baseUrl = getBaseUrl();
        const ldFormat = convertISOToLDFormat(isoDate);
        const fullUrl = `${baseUrl}/Live/${ldFormat}/${symbol}-NSE.json`;

        console.log('🔍 [fetchLivePriceData] URL:', fullUrl);

        const response = await fetch(fullUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to fetch price data');

        const rawText = await response.text();
        const data = parseMessyJSON(rawText);
        if (!data) throw new Error('Failed to parse JSON');

        console.log(`✅ [fetchLivePriceData] Fetched data for ${symbol}`);
        return data;
    } catch (error) {
        console.error('❌ [fetchLivePriceData] Error:', error);
        return null;
    }
}

export async function fetchSthitiCharts(
    symbol: string,
    isoDate: string
): Promise<string[]> {
    try {
        const baseUrl = getBaseUrl();
        const fullUrl = `${baseUrl}/Sthiti/charts/${symbol}/${isoDate}`;

        const response = await fetch(fullUrl, { 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) return [];

        const html = await response.text();
        const items = parseDirectoryListing(html);
        const charts = items
            .filter(item => item.endsWith('.png'))
            .map(item => `${baseUrl}/Sthiti/charts/${symbol}/${isoDate}/${item}`);

        console.log(`✅ [fetchSthitiCharts] Found ${charts.length} charts`);
        return charts;
    } catch (error) {
        console.error('❌ [fetchSthitiCharts] Error:', error);
        return [];
    }
}

export async function fetchSthitiClusters(
    symbol: string,
    sentiment: 'positive' | 'negative' | 'neutral'
): Promise<SthitiClusterData[]> {
    try {
        const baseUrl = getBaseUrl();
        const fullUrl = `${baseUrl}/Sthiti/clusters/${symbol}/${sentiment}`;

        const response = await fetch(fullUrl, { 
            cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) return [];

        const html = await response.text();
        const items = parseDirectoryListing(html);
        const clusters: SthitiClusterData[] = [];

        for (const item of items.filter(i => i.endsWith('.json'))) {
            try {
                const clusterUrl = `${baseUrl}/Sthiti/clusters/${symbol}/${sentiment}/${item}`;
                const clusterResponse = await fetch(clusterUrl, { cache: 'no-cache' });
                const clusterData = await clusterResponse.json();
                clusters.push({
                    cluster_id: item.replace('.json', ''),
                    representative_phrases: clusterData.representative_phrases || [],
                    phrases: clusterData.phrases || [],
                });
            } catch (e) {
                console.error(`Failed to parse cluster ${item}:`, e);
            }
        }

        console.log(`✅ [fetchSthitiClusters] Found ${clusters.length} ${sentiment} clusters`);
        return clusters;
    } catch (error) {
        console.error('❌ [fetchSthitiClusters] Error:', error);
        return [];
    }
}

export async function fetchSthitiHeadlines(
    symbol: string,
    isoDate: string
): Promise<SthitiHeadline[]> {
    try {
        const baseUrl = getBaseUrl();
        const fullUrl = `${baseUrl}/Sthiti/headlines/${symbol}/${isoDate}.json`;

        const response = await fetch(fullUrl, { cache: 'no-cache' });
        if (!response.ok) return [];

        const headlines = await response.json();
        if (!Array.isArray(headlines)) return [];

        console.log(`✅ [fetchSthitiHeadlines] Found ${headlines.length} headlines`);
        return headlines as SthitiHeadline[];
    } catch (error) {
        console.error('❌ [fetchSthitiHeadlines] Error:', error);
        return [];
    }
}

export async function fetchSthitiPredictions(
    isoDate: string
): Promise<Record<string, SthitiPrediction> | null> {
    try {
        const baseUrl = getBaseUrl();
        const fullUrl = `${baseUrl}/Sthiti/predictions/${isoDate}.json`;

        const response = await fetch(fullUrl, { cache: 'no-cache' });
        if (!response.ok) return null;

        const data = await response.json();
        if (!data.predictions) return null;

        console.log(`✅ [fetchSthitiPredictions] Fetched predictions for ${isoDate}`);
        return data.predictions;
    } catch (error) {
        console.error('❌ [fetchSthitiPredictions] Error:', error);
        return null;
    }
}

// ============ NEW: Full Historical Data Parser ============
export async function parseFullHistoricalData(
    symbol: string,
    isoDate: string
): Promise<HistoricalLiveData[]> {
    try {
        const baseUrl = getBaseUrl();
        const ldFormat = convertISOToLDFormat(isoDate);
        const fullUrl = `${baseUrl}/Live/${ldFormat}/${symbol}-NSE.json`;

        console.log('🔍 [parseFullHistoricalData] Fetching ALL data from:', fullUrl);

        const response = await fetch(fullUrl, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to fetch full historical data');

        const rawText = await response.text();
        const lines = rawText.trim().split('\n');
        const dataPoints: HistoricalLiveData[] = [];

        // Parse ALL lines (not just last one)
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                if (obj.ltp !== undefined && obj.ltp > 0) {
                    dataPoints.push({
                        symbol: obj.symbol || symbol,
                        ltp: obj.ltp || 0,
                        open_price: obj.open_price || obj.ltp,
                        high_price: obj.high_price || obj.ltp,
                        low_price: obj.low_price || obj.ltp,
                        prev_close_price: obj.prev_close_price || obj.ltp,
                        vol_traded_today: obj.vol_traded_today || 0,
                        bid_price: obj.bid_price || 0,
                        ask_price: obj.ask_price || 0,
                        timestamp: obj.timestamp || Date.now() / 1000,
                    });
                }
            } catch (e) {
                // Skip invalid lines
                continue;
            }
        }

        // Sort by timestamp
        const sortedData = dataPoints.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`✅ [parseFullHistoricalData] Parsed ${sortedData.length} data points from ${lines.length} lines`);
        return sortedData;
    } catch (error) {
        console.error('❌ [parseFullHistoricalData] Error:', error);
        return [];
    }
}

// ============ NEW: Convert to OHLC Candles ============
export function convertToOHLC(
    dataPoints: HistoricalLiveData[],
    intervalMinutes: number = 5
): Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}> {
    if (dataPoints.length === 0) return [];

    const intervalMs = intervalMinutes * 60 * 1000;
    const candles = new Map<number, {
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        firstTimestamp: number;
        lastTimestamp: number;
    }>();

    // Group data points into intervals
    dataPoints.forEach(point => {
        const bucketTime = Math.floor(point.timestamp * 1000 / intervalMs) * intervalMs;
        const existing = candles.get(bucketTime);

        if (!existing) {
            candles.set(bucketTime, {
                open: point.ltp,
                high: point.ltp,
                low: point.ltp,
                close: point.ltp,
                volume: point.vol_traded_today,
                firstTimestamp: point.timestamp,
                lastTimestamp: point.timestamp,
            });
        } else {
            existing.high = Math.max(existing.high, point.ltp);
            existing.low = Math.min(existing.low, point.ltp);
            existing.close = point.ltp;
            existing.volume = point.vol_traded_today; // Use latest volume
            existing.lastTimestamp = point.timestamp;
        }
    });

    // Convert to array and sort
    const result = Array.from(candles.entries())
        .map(([bucketTime, candle]) => ({
            timestamp: Math.floor(bucketTime / 1000), // Convert back to seconds
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`✅ [convertToOHLC] Created ${result.length} candles from ${dataPoints.length} points`);
    return result;
}
