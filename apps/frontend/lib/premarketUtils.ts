// Utility functions for Pre-Market API integration

/**
 * Converts ISO timestamp to filename format (YYYYMMDD_HHMMSS)
 * @param isoTimestamp - ISO format: "2025-11-17T10:30:00"
 * @returns Formatted string: "20251117_103000"
 */
export function formatTimestampForFilename(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Constructs the full image URL for intraday chart
 * @param baseUrl - Base URL of the API
 * @param stockCode - Stock ticker symbol
 * @param analysisDate - Date of analysis (YYYY-MM-DD)
 * @param headlineTimestamp - Headline timestamp in ISO format
 * @returns Full image URL
 */
export function constructIntradayImageUrl(
  baseUrl: string,
  stockCode: string,
  analysisDate: string,
  headlineTimestamp: string
): string {
  const formattedTimestamp = formatTimestampForFilename(headlineTimestamp);
  return `${baseUrl}/api/premarket/charts/${stockCode}/${analysisDate}/${formattedTimestamp}_intraday.png`;
}

/**
 * Constructs the full image URL for interday chart
 * @param baseUrl - Base URL of the API
 * @param stockCode - Stock ticker symbol
 * @param analysisDate - Date of analysis (YYYY-MM-DD)
 * @param headlineTimestamp - Headline timestamp in ISO format
 * @returns Full image URL
 */
export function constructInterdayImageUrl(
  baseUrl: string,
  stockCode: string,
  analysisDate: string,
  headlineTimestamp: string
): string {
  const formattedTimestamp = formatTimestampForFilename(headlineTimestamp);
  return `${baseUrl}/api/premarket/charts/${stockCode}/${analysisDate}/${formattedTimestamp}_interday.png`;
}

/**
 * Gets today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats timestamp for display (relative time)
 * @param isoTimestamp - ISO format timestamp
 * @returns Human-readable relative time
 */
export function formatRelativeTime(isoTimestamp: string): string {
  const now = new Date();
  const newsTime = new Date(isoTimestamp);
  const diffInHours = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
}

/**
 * Formats timestamp for display (full date)
 * @param isoTimestamp - ISO format timestamp
 * @returns Formatted date string
 */
export function formatFullDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formats timestamp for display (time only)
 * @param isoTimestamp - ISO format timestamp
 * @returns Formatted time string
 */
export function formatTimeOnly(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
