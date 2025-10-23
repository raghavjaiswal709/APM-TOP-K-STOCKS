// apps/frontend/app/config/sipr.config.ts
import type { SiprConfig } from '../types/sipr.types';

export const siprConfig: SiprConfig = {
  apiBaseUrl: '/api/sipr',
  defaultMonths: 3,
  timeout: 300000, // 5 minutes
  cacheTTL: 600, // 10 minutes
};

export const getApiUrl = (endpoint: string): string => {
  return `${siprConfig.apiBaseUrl}${endpoint}`;
};

export const isValidCompanyCode = (code: string): boolean => {
  return /^[A-Z0-9_]+$/.test(code);
};

export const SIPR_CONSTANTS = {
  MIN_MONTHS: 1,
  MAX_MONTHS: 12,
  DEFAULT_MONTHS: 3,
  
  ENDPOINTS: {
    HEALTH: '/health',
    COMPANIES: '/companies',
    TOP3: (code: string) => `/${code}/top3`,
    TOP3_HTML: (code: string) => `/${code}/top3-html`,
    SEGMENTATION: (code: string) => `/${code}/segmentation`,
    SEGMENTATION_HTML: (code: string) => `/${code}/segmentation-html`,
    CLUSTER: (code: string) => `/${code}/cluster`,
    CLUSTER_HTML: (code: string) => `/${code}/cluster-html`,
    CENTROIDS: (code: string) => `/${code}/centroids`,
    CENTROIDS_HTML: (code: string) => `/${code}/centroids-html`,
    REPORT: (code: string) => `/${code}/report`,
  },
  
  ERROR_CODES: {
    TIMEOUT: 'SIPR_TIMEOUT',
    NOT_FOUND: 'SIPR_NOT_FOUND',
    NETWORK_ERROR: 'SIPR_NETWORK_ERROR',
    INVALID_RESPONSE: 'SIPR_INVALID_RESPONSE',
  },
  
  // ✅ NEW: Day of week constants
  WEEKDAYS: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ],
  
  TRADING_DAYS: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday'
  ],
};
