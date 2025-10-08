// config/lstmae.config.ts
import { LSTMAE_CONSTANTS } from '.././constants/lstmae.constants';
import type { LSTMAEConfig } from '.././types/lstmae.types';

/**
 * LSTMAE Pipeline 2 Configuration
 * Based on Pipeline 2 Integration Guide v1.0
 * Last Updated: October 2025
 */
export const lstmaeConfig: LSTMAEConfig = {
  // Visualization Engine API (Port 8506 from document)
  apiBaseUrl: `http://localhost:${LSTMAE_CONSTANTS.API_PORTS.VISUALIZATION}`,

  // Base path for visualizations (from document section 3.2)
  visualizationBasePath: LSTMAE_CONSTANTS.PATHS.VISUALIZATIONS,

  // Cache TTL - 1 hour as per document section 6.3
  cacheTTL: LSTMAE_CONSTANTS.PERFORMANCE.CACHE_TTL_SECONDS,

  // Timeout for API calls
  timeout: LSTMAE_CONSTANTS.PERFORMANCE.FIRST_REQUEST_TIMEOUT,

  // Retry configuration for resilience
  retryAttempts: LSTMAE_CONSTANTS.PERFORMANCE.RETRY_ATTEMPTS,

  // Enable fallback to direct file access if API fails
  fallbackEnabled: true,
};

/**
 * Get visualization file path for a symbol
 * @param symbol - Stock symbol (e.g., "RELIANCE")
 * @param filename - Visualization filename
 * @returns Full file path
 */
export const getVisualizationPath = (symbol: string, filename: string): string => {
  return `${lstmaeConfig.visualizationBasePath}/${symbol}/${filename}`;
};

/**
 * Get API endpoint URL
 * @param endpoint - Endpoint path
 * @returns Full URL
 */
export const getApiUrl = (endpoint: string): string => {
  return `${lstmaeConfig.apiBaseUrl}${endpoint}`;
};

/**
 * Validate symbol format
 * @param symbol - Stock symbol
 * @returns Boolean indicating if symbol is valid
 */
export const isValidSymbol = (symbol: string): boolean => {
  return /^[A-Z0-9]+$/.test(symbol);
};
