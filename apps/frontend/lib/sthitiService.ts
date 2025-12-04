/**
 * Sthiti Data Service
 * Handles fetching chart images and headlines from the Sthiti server
 * 
 * Uses Next.js rewrite proxy (/sthiti-data/*) to avoid CORS issues
 * Direct server URL is only used for image URLs (images work cross-origin)
 */

// Proxy URL for API calls (directory listings, JSON data)
const STHITI_PROXY_BASE = '/sthiti-data';
// Direct URL for static assets (images can load cross-origin)
const STHITI_DIRECT_BASE = 'http://100.93.172.21:6969/Sthiti';

export interface SthitiChartImage {
  url: string;
  filename: string;
  type: 'intraday' | 'interday' | 'premarket' | 'other';
}

export interface SthitiHeadline {
  text: string;
  sentiment: string;
  timestamp: string;
  source?: string;
}

/**
 * Scrapes chart directory and extracts PNG filenames
 * @param symbol - Stock symbol (e.g., 'APOLLO')
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of chart image URLs
 */
export async function fetchSthitiChartImages(
  symbol: string,
  date: string
): Promise<SthitiChartImage[]> {
  try {
    // Use proxy for directory listing (avoids CORS)
    const proxyUrl = `${STHITI_PROXY_BASE}/charts/${symbol}/${date}/`;
    // Use direct URL for image sources
    const directUrl = `${STHITI_DIRECT_BASE}/charts/${symbol}/${date}/`;
    
    console.log(`[Sthiti] Fetching directory listing: ${proxyUrl}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error(`[Sthiti] Directory not found: ${response.status}`);
      return [];
    }

    const html = await response.text();
    
    // Extract PNG filenames using regex
    // Pattern matches: href="20251106_103000_interday.png"
    const hrefPattern = /href="([^"]*?\.png)"/gi;
    const matches = Array.from(html.matchAll(hrefPattern));
    
    const chartImages: SthitiChartImage[] = [];
    
    for (const match of matches) {
      const filename = match[1];
      
      // Determine chart type
      let type: SthitiChartImage['type'] = 'other';
      if (filename.includes('intraday')) type = 'intraday';
      else if (filename.includes('interday')) type = 'interday';
      else if (filename.includes('premarket')) type = 'premarket';
      
      // Construct full URL using direct path (images work cross-origin)
      const fullUrl = `${directUrl}${filename}`;
      
      chartImages.push({
        url: fullUrl,
        filename,
        type
      });
      
      console.log(`[Sthiti] Found chart: ${filename} (${type})`);
    }
    
    // Sort by priority: intraday -> interday -> premarket -> other
    const typePriority = { intraday: 1, interday: 2, premarket: 3, other: 4 };
    chartImages.sort((a, b) => typePriority[a.type] - typePriority[b.type]);
    
    console.log(`[Sthiti] ✅ Found ${chartImages.length} chart images`);
    return chartImages;
    
  } catch (error) {
    console.error('[Sthiti] Error fetching chart images:', error);
    return [];
  }
}

/**
 * Fetches headlines from Sthiti server
 * @param symbol - Stock symbol (e.g., 'APOLLO')
 * @param date - Date in YYYY-MM-DD format
 * @returns Array of headlines
 */
export async function fetchSthitiHeadlines(
  symbol: string,
  date: string
): Promise<SthitiHeadline[]> {
  try {
    // Use proxy for JSON fetch (avoids CORS)
    let headlinesUrl = `${STHITI_PROXY_BASE}/headlines/${symbol}/${date}.json`;
    console.log(`[Sthiti] Fetching headlines: ${headlinesUrl}`);

    let response = await fetch(headlinesUrl);

    // If not found, try DD-MM-YYYY format
    if (!response.ok) {
      const [year, month, day] = date.split('-');
      const altDate = `${day}-${month}-${year}`;
      headlinesUrl = `${STHITI_PROXY_BASE}/headlines/${symbol}/${altDate}.json`;
      console.log(`[Sthiti] Retrying with alternate format: ${headlinesUrl}`);
      response = await fetch(headlinesUrl);
    }

    if (!response.ok) {
      console.error(`[Sthiti] Headlines not found: ${response.status}`);
      return [];
    }

    const rawData = await response.json();
    console.log(`[Sthiti] Raw headlines data:`, rawData);

    // Map raw data to expected format
    // Assuming the JSON structure has fields like: text, gpt4o_sentiment, timestamp
    const headlines: SthitiHeadline[] = Array.isArray(rawData) 
      ? rawData.map((item: Record<string, unknown>) => ({
          text: String(item.text || item.headline || item.title || ''),
          sentiment: String(item.gpt4o_sentiment || item.sentiment || 'neutral'),
          timestamp: String(item.timestamp || item.time || new Date().toISOString()),
          source: String(item.source || 'Sthiti')
        }))
      : [];

    console.log(`[Sthiti] ✅ Parsed ${headlines.length} headlines`);
    return headlines;

  } catch (error) {
    console.error('[Sthiti] Error fetching headlines:', error);
    return [];
  }
}

/**
 * Validates if a Sthiti image URL is accessible
 * @param imageUrl - Full image URL
 * @returns Promise<boolean>
 */
export async function validateSthitiImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
