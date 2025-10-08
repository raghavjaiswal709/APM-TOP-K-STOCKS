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

  // Performance Settings (from document - section 8)
  PERFORMANCE: {
    CACHE_TTL_SECONDS: 3600, // 1 hour as per document
    FIRST_REQUEST_TIMEOUT: 30000, // 30 seconds (10-20s expected)
    CACHED_REQUEST_TIMEOUT: 5000, // 5 seconds (< 1s expected)
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    IMAGE_LOAD_TIMEOUT: 15000,
  },

  // API Endpoints (from document - section 4.6)
  ENDPOINTS: {
    HEALTH: '/health',
    DASHBOARD: '/visualize/dashboard',
    PLOT: (symbol: string, plotType: string) => `/visualize/${symbol}/plot/${plotType}`,
    REPORT: (symbol: string) => `/visualize/${symbol}/report`,
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
