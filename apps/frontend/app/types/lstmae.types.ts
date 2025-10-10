// types/lstmae.types.ts
export interface LSTMAEVisualization {
  type: 'dominant_patterns' | 'intraday_patterns' | 'cluster_transitions' | 'cluster_timeline' 
        | 'anomalies' | 'seasonality' | 'transitions_alt';
  filename: string;
  title: string;
  description: string;
  dimensions: {
    width: number;
    height: number;
  };
  dpi: number;
}

export interface LSTMAEDashboardResponse {
  success: boolean;
  symbol: string;
  plotPaths: {
    dominantPatterns: string;
    clusterTimeline: string;
    intraday: string;
    clusterTransitions: string;
    anomalies?: string;
    seasonality?: string;
    transitionsAlt?: string;
  };
  dashboardPath: string;
  reportPath: string;
  nDominantPatterns: number;
  dominantPatterns: DominantPattern[];
  error?: string;
}

export interface DominantPattern {
  clusterId: number;
  patternType: string;
  strengthScore: number;
  description?: string;
}

export interface LSTMAEServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  cacheBackend: 'redis' | 'memory';
  redisAvailable: boolean;
  timestamp: string;
}

export interface LSTMAEConfig {
  apiBaseUrl: string;
  visualizationBasePath: string;
  cacheTTL: number;
  timeout: number;
  retryAttempts: number;
  fallbackEnabled: boolean;
  useEndpointMethod: boolean;
}

export interface LSTMAEImageStatus {
  url: string;
  loaded: boolean;
  error: boolean;
  timestamp: number;
}

export interface LSTMAEModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
  companyName?: string;
}

export interface LSTMAEDashboardProps {
  companyCode: string;
  isMaximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
  className?: string;
}

export type LSTMAELoadingState = 'idle' | 'loading' | 'success' | 'error' | 'cached';

export interface LSTMAEError {
  code: string;
  message: string;
  suggestion?: string;
  timestamp: string;
}

export interface PlotUrls {
  dominantPatterns: string;
  intraday: string;
  clusterTransitions: string;
  clusterTimeline: string;
  anomalies?: string;
  seasonality?: string;
  transitionsAlt?: string;
}
