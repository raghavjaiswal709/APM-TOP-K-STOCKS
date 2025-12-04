/**
 * Historical Sthiti Intelligence Data Service
 * Fetches data from /Sthiti/ directory via server IP
 * Completely isolated from production API calls
 * 
 * Uses Next.js rewrite proxy (/sthiti-data/*) to avoid CORS issues
 * Direct server URL is only used for image URLs (images work cross-origin)
 */

// Proxy URL for API calls (directory listings, JSON data)
const STHITI_PROXY_BASE = '/sthiti-data';
// Direct URL for static assets (images can load cross-origin)
const STHITI_DIRECT_BASE = 'http://100.93.172.21:6969/Sthiti';

export interface SthitiChartFile {
  filename: string;
  url: string;
  timestamp?: string;
  type?: 'intraday' | 'interday' | 'premarket' | 'other';
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
  id?: string;
  text: string;
  timestamp: string;
  source: string;
  gpt4o_sentiment: string;
}

export interface SthitiPrediction {
  sentiment: string;
  confidence: string;
  reasoning: string;
  score: number;
  stock_ticker?: string;
  headlines_analyzed?: number;
}

/**
 * Parse HTML directory listing to extract file names
 * The server returns HTML like: <a href="filename.png">filename.png</a>
 */
function parseDirectoryListing(html: string): string[] {
  const hrefPattern = /href="([^"]+)"/gi;
  const matches = Array.from(html.matchAll(hrefPattern));
  return matches
    .map((match) => match[1])
    .filter((href) => !href.startsWith('?') && !href.startsWith('/') && href !== '../');
}

/**
 * Fetch available chart images for a symbol and date
 * Route: GET /Sthiti/charts/[SYMBOL]/[YYYY-MM-DD]/
 * Note: Server returns HTML directory listing, not JSON
 */
export async function fetchSthitiCharts(
  symbol: string,
  date: string // Expected format: YYYY-MM-DD
): Promise<SthitiChartFile[]> {
  try {
    // Use proxy for directory listing (avoids CORS)
    const proxyUrl = `${STHITI_PROXY_BASE}/charts/${symbol}/${date}/`;
    // Use direct URL for image sources (images work cross-origin)
    const directUrl = `${STHITI_DIRECT_BASE}/charts/${symbol}/${date}/`;
    
    console.log(`[Sthiti Charts] Fetching from: ${proxyUrl}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) {
      console.warn(`[Sthiti Charts] No data found for ${symbol} on ${date}`);
      return [];
    }

    const html = await response.text();
    
    // Parse HTML directory listing to extract PNG filenames
    const hrefPattern = /href="([^"]*?\.png)"/gi;
    const matches = Array.from(html.matchAll(hrefPattern));
    
    const chartFiles: SthitiChartFile[] = [];
    
    for (const match of matches) {
      const filename = match[1];
      
      // Determine chart type from filename
      let type: SthitiChartFile['type'] = 'other';
      if (filename.toLowerCase().includes('intraday')) type = 'intraday';
      else if (filename.toLowerCase().includes('interday')) type = 'interday';
      else if (filename.toLowerCase().includes('premarket')) type = 'premarket';
      
      chartFiles.push({
        filename,
        // Use direct URL for images (works cross-origin)
        url: `${directUrl}${filename}`,
        type,
      });
      
      console.log(`[Sthiti Charts] Found: ${filename} (${type})`);
    }
    
    // Sort by priority: intraday -> interday -> premarket -> other
    const typePriority = { intraday: 1, interday: 2, premarket: 3, other: 4 };
    chartFiles.sort((a, b) => typePriority[a.type || 'other'] - typePriority[b.type || 'other']);
    
    console.log(`[Sthiti Charts] ✅ Found ${chartFiles.length} chart images`);
    return chartFiles;
  } catch (error) {
    console.error('[Sthiti Charts] Error fetching charts:', error);
    return [];
  }
}

/**
 * Fetch sentiment clusters for a symbol
 * Route: GET /Sthiti/clusters/[SYMBOL]/[SENTIMENT]/
 * Sentiments: neutral, positive, negative
 * Note: Server returns HTML directory listing with cluster_*.json files
 */
export async function fetchSthitiClusters(
  symbol: string,
  sentiment: 'positive' | 'negative' | 'neutral'
): Promise<SthitiCluster[]> {
  try {
    // Use proxy for directory listing
    const proxyDirUrl = `${STHITI_PROXY_BASE}/clusters/${symbol}/${sentiment}/`;
    console.log(`[Sthiti Clusters] Fetching ${sentiment} clusters from: ${proxyDirUrl}`);

    // First, fetch the directory listing
    const dirResponse = await fetch(proxyDirUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    });
    
    if (!dirResponse.ok) {
      console.warn(`[Sthiti Clusters] No ${sentiment} clusters directory found for ${symbol}`);
      return [];
    }

    const html = await dirResponse.text();
    
    // Parse HTML to find cluster JSON files
    const hrefPattern = /href="(cluster_[^"]*\.json)"/gi;
    const matches = Array.from(html.matchAll(hrefPattern));
    
    if (matches.length === 0) {
      console.warn(`[Sthiti Clusters] No cluster files found for ${symbol}/${sentiment}`);
      return [];
    }
    
    console.log(`[Sthiti Clusters] Found ${matches.length} cluster files`);
    
    // Fetch each cluster JSON file via proxy
    const clusters: SthitiCluster[] = [];
    
    for (const match of matches) {
      const filename = match[1];
      const clusterUrl = `${proxyDirUrl}${filename}`;
      
      try {
        const clusterResponse = await fetch(clusterUrl);
        if (clusterResponse.ok) {
          const clusterData = await clusterResponse.json();
          clusters.push(clusterData);
          console.log(`[Sthiti Clusters] Loaded: ${filename}`);
        }
      } catch (err) {
        console.warn(`[Sthiti Clusters] Failed to load ${filename}:`, err);
      }
    }
    
    console.log(`[Sthiti Clusters] ✅ Loaded ${clusters.length} ${sentiment} clusters`);
    return clusters;
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
    // Use proxy to fetch JSON (avoids CORS)
    const url = `${STHITI_PROXY_BASE}/headlines/${symbol}/${date}.json`;
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
    // Use proxy to fetch JSON (avoids CORS)
    const url = `${STHITI_PROXY_BASE}/predictions/${date}.json`;
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
