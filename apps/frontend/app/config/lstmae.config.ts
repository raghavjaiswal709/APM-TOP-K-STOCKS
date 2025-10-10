// config/lstmae.config.ts
import { LSTMAE_CONSTANTS } from '.././constants/lstmae.constants';
import type { LSTMAEConfig } from '.././types/lstmae.types';



export const lstmaeConfig: LSTMAEConfig = {
  // ✅ USE YOUR NESTJS BACKEND INSTEAD OF DIRECT CONNECTION
  apiBaseUrl: '/api/lstmae', // This goes through your NestJS backend
  
  visualizationBasePath: LSTMAE_CONSTANTS.PATHS.VISUALIZATIONS,
  cacheTTL: LSTMAE_CONSTANTS.PERFORMANCE.CACHE_TTL_SECONDS,
  timeout: 120000,
  retryAttempts: 2,
  fallbackEnabled: true,
  
  // ✅ ENABLE API ENDPOINT METHOD - Now it works through your backend
  useEndpointMethod: true,
};
// config/lstmae.config.ts

export const getVisualizationPath = (symbol: string, filename: string): string => {
  // When called with: getVisualizationPath('ABCAPITAL', 'ABCAPITAL_interactive_dashboard.html')
  // Returns: /api/lstmae/ABCAPITAL/plot/ABCAPITAL_interactive_dashboard.html
  return `/api/lstmae/${symbol}/plot/${filename}`;
};

export const getApiUrl = (endpoint: string): string => {
  return `${lstmaeConfig.apiBaseUrl}${endpoint}`;
};

export const isValidSymbol = (symbol: string): boolean => {
  return /^[A-Z0-9]+$/.test(symbol);
};
