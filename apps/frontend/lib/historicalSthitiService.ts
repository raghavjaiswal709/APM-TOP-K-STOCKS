/**
 * Historical Sthiti Intelligence Data Service
 * Fetches data from /Sthiti/ directory via server IP
 * Completely isolated from production API calls
 */

const HISTORICAL_SERVER_BASE = 'http://localhost:6969';

export interface SthitiChartFile {
  filename: string;
  url: string;
  timestamp?: string;
  type?: string;
}

export interface SthitiClusterPhrase {
  headline_text: string;
  absa_sentiment: string;
}

export interface SthitiCluster {
  representative_phrases: string[];
  phrases: SthitiClusterPhrase[];
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

/**
 * Fetch available chart images for a symbol and date
 * Route: GET /Sthiti/charts/[SYMBOL]/[YYYY-MM-DD]/
 */
export async function fetchSthitiCharts(
  symbol: string,
  date: string // Expected format: YYYY-MM-DD
): Promise<SthitiChartFile[]> {
  try {
    const url = `${HISTORICAL_SERVER_BASE}/Sthiti/charts/${symbol}/${date}/`;
    console.log(`[Sthiti Charts] Fetching from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Sthiti Charts] No data found for ${symbol} on ${date}`);
      return [];
    }

    const data = await response.json();
    
    // Expecting array of filenames or objects
    if (Array.isArray(data)) {
      return data.map((item: string | { filename?: string; name?: string; url?: string; timestamp?: string; type?: string }): SthitiChartFile => {
        if (typeof item === 'string') {
          return {
            filename: item,
            url: `${HISTORICAL_SERVER_BASE}/Sthiti/charts/${symbol}/${date}/${item}`,
          };
        }
        return {
          filename: item.filename || item.name || 'unknown',
          url: item.url || `${HISTORICAL_SERVER_BASE}/Sthiti/charts/${symbol}/${date}/${item.filename || item.name}`,
          timestamp: item.timestamp,
          type: item.type,
        };
      });
    }

    return [];
  } catch (error) {
    console.error('[Sthiti Charts] Error fetching charts:', error);
    return [];
  }
}

/**
 * Fetch sentiment clusters for a symbol
 * Route: GET /Sthiti/clusters/[SYMBOL]/[SENTIMENT]/
 * Sentiments: neutral, positive, negative
 */
export async function fetchSthitiClusters(
  symbol: string,
  sentiment: 'positive' | 'negative' | 'neutral'
): Promise<SthitiCluster[]> {
  try {
    const url = `${HISTORICAL_SERVER_BASE}/Sthiti/clusters/${symbol}/${sentiment}/`;
    console.log(`[Sthiti Clusters] Fetching ${sentiment} clusters from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Sthiti Clusters] No ${sentiment} clusters found for ${symbol}`);
      return [];
    }

    const data = await response.json();
    
    // Data should be array of cluster objects
    if (Array.isArray(data)) {
      return data;
    }

    return [];
  } catch (error) {
    console.error(`[Sthiti Clusters] Error fetching ${sentiment} clusters:`, error);
    return [];
  }
}

/**
 * Fetch market headlines for a symbol and date
 * Route: GET /Sthiti/headlines/[SYMBOL]/[YYYY-MM-DD].json
 */
export async function fetchSthitiHeadlines(
  symbol: string,
  date: string // Expected format: YYYY-MM-DD
): Promise<SthitiHeadline[]> {
  try {
    const url = `${HISTORICAL_SERVER_BASE}/Sthiti/headlines/${symbol}/${date}.json`;
    console.log(`[Sthiti Headlines] Fetching from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Sthiti Headlines] No headlines found for ${symbol} on ${date}`);
      return [];
    }

    const data = await response.json();
    
    // Data should be array of headline objects
    if (Array.isArray(data)) {
      return data;
    }

    return [];
  } catch (error) {
    console.error('[Sthiti Headlines] Error fetching headlines:', error);
    return [];
  }
}

/**
 * Fetch AI predictions for a specific date and symbol
 * Route: GET /Sthiti/predictions/[YYYY-MM-DD].json
 * Then access data.predictions["[SYMBOL]"]
 */
export async function fetchSthitiPrediction(
  symbol: string,
  date: string // Expected format: YYYY-MM-DD
): Promise<SthitiPrediction | null> {
  try {
    const url = `${HISTORICAL_SERVER_BASE}/Sthiti/predictions/${date}.json`;
    console.log(`[Sthiti Predictions] Fetching from: ${url}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`[Sthiti Predictions] No predictions found for ${date}`);
      return null;
    }

    const data = await response.json();
    
    // Access specific company prediction
    if (data && data.predictions && data.predictions[symbol]) {
      return data.predictions[symbol];
    }

    console.warn(`[Sthiti Predictions] No prediction found for ${symbol} in ${date} data`);
    return null;
  } catch (error) {
    console.error('[Sthiti Predictions] Error fetching predictions:', error);
    return null;
  }
}

/**
 * Batch fetch all Sthiti data for a symbol and date
 */
export async function fetchAllSthitiData(symbol: string, date: string) {
  const [charts, positiveClusters, negativeClusters, neutralClusters, headlines, prediction] =
    await Promise.all([
      fetchSthitiCharts(symbol, date),
      fetchSthitiClusters(symbol, 'positive'),
      fetchSthitiClusters(symbol, 'negative'),
      fetchSthitiClusters(symbol, 'neutral'),
      fetchSthitiHeadlines(symbol, date),
      fetchSthitiPrediction(symbol, date),
    ]);

  return {
    charts,
    positiveClusters,
    negativeClusters,
    neutralClusters,
    headlines,
    prediction,
  };
}
