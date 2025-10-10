// constants/lstmae.constants.ts
export const LSTMAE_CONSTANTS = {
  // API Configuration (from document - ports 8501-8506)
  API_PORTS: {
    EMBEDDING_LOADER: 8501,
    SIMILARITY_INDEX: 8502,
    CLUSTERING: 8503,
    PATTERN_DISCOVERY: 8504,
    INTRADAY_INTEGRATION: 8505,
    VISUALIZATION: 8506,
  },

  // File Paths (from document)
  PATHS: {
    BASE: '/nvme1/production/PatternPoolLSTMAE/pipeline2',
    VISUALIZATIONS: '/nvme1/production/PatternPoolLSTMAE/pipeline2/data/visualizations',
    CONFIG: '/nvme1/production/PatternPoolLSTMAE/pipeline2/config',
    LOGS: '/nvme1/production/PatternPoolLSTMAE/pipeline2/logs',
  },

  // Visualization Types (from document - section 3.1)
  VISUALIZATIONS: [
    {
      type: 'dominant_patterns',
      filename: 'dominant_patterns.png',
      title: 'Dominant Patterns Analysis',
      description: 'Pattern timeline, strength bar chart, and intraday profiles',
      dimensions: { width: 1200, height: 800 },
      dpi: 100,
    },
    {
      type: 'intraday_patterns',
      filename: 'intraday_patterns.png',
      title: 'Intraday Movement Patterns',
      description: 'Median price movement for each cluster',
      dimensions: { width: 1400, height: 1200 },
      dpi: 100,
    },
    {
      type: 'cluster_transitions',
      filename: 'cluster_transitions.png',
      title: 'Cluster Transitions Graph',
      description: 'Network graph showing transition probabilities',
      dimensions: { width: 1200, height: 800 },
      dpi: 100,
    },
    {
      type: 'cluster_timeline',
      filename: 'cluster_timeline.png',
      title: 'Cluster Timeline',
      description: 'Scatter plot of cluster assignments over time',
      dimensions: { width: 1200, height: 800 },
      dpi: 100,
    },
  ] as const,

  // Dashboard Configuration
  DASHBOARD: {
    FILENAME: 'interactive_dashboard.html',
    TITLE: 'Interactive Pattern Discovery Dashboard',
    WINDOW_FEATURES: 'width=1400,height=900,resizable=yes,scrollbars=yes,status=yes',
  },

 // constants/lstmae.constants.ts

PERFORMANCE: {
  CACHE_TTL_SECONDS: 3600,
  
  // ✅ INCREASED TIMEOUTS FOR SLOW NETWORK
  FIRST_REQUEST_TIMEOUT: 120000, // 2 minutes (was 30 seconds)
  CACHED_REQUEST_TIMEOUT: 30000,  // 30 seconds (was 5 seconds)
  
  RETRY_ATTEMPTS: 2, // Reduced from 3 to avoid long waits
  RETRY_DELAY: 2000, // 2 seconds between retries
  IMAGE_LOAD_TIMEOUT: 30000, // 30 seconds for images
},


  // API Endpoints (from document - section 4.6)
// constants/lstmae.constants.ts

ENDPOINTS: {
  HEALTH: '/health',
  DASHBOARD: '/dashboard', // Changed from /visualize/dashboard
  PLOT: (symbol: string, plotType: string) => `/${symbol}/plot/${plotType}`, // Changed
  REPORT: (symbol: string) => `/${symbol}/report`, // Changed
},


  // Error Codes (from document - section 7)
  ERROR_CODES: {
    EMBEDDING_NOT_FOUND: 'EmbeddingNotFoundError',
    REDIS_CONNECTION_FAILED: 'RedisConnectionError',
    INSUFFICIENT_DATA: 'InsufficientDataError',
    SERVICE_UNAVAILABLE: 'ServiceUnavailableError',
    TIMEOUT: 'TimeoutError',
    NETWORK_ERROR: 'NetworkError',
  },

  // UI Configuration
  UI: {
    GRID_LAYOUT: {
      COLS: 2,
      ROWS: 2,
      GAP: 16,
    },
    IMAGE_LOADING_SKELETON_COLOR: '#e5e7eb',
    ERROR_RETRY_BUTTON_TEXT: 'Retry Loading',
    INTERACTIVE_DASHBOARD_BUTTON_TEXT: 'Open Interactive Dashboard',
  },

  // Clustering Methods (from document)
  CLUSTERING_METHODS: ['spectral', 'kmeans', 'dbscan'] as const,
  DEFAULT_CLUSTERING_METHOD: 'spectral',

  // Minimum Data Requirements (from document)
  MIN_DAYS_REQUIRED: 100,
} as const;

export type VisualizationType = typeof LSTMAE_CONSTANTS.VISUALIZATIONS[number]['type'];
export type ClusteringMethod = typeof LSTMAE_CONSTANTS.CLUSTERING_METHODS[number];
