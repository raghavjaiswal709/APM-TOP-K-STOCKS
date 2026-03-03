// ============================================================================
// UMAP Clustering V2 API Types
// Server: 100.93.172.21:6968  |  All endpoints: /api/v2/clustering/*
// ============================================================================

// ─── Health ──────────────────────────────────────────────────────────────────
export interface ClusteringHealthResponse {
  status: string;
  pattern_dir: string;
  lineage_dir: string;
  db_pool_available: boolean;
}

// ─── Symbols ─────────────────────────────────────────────────────────────────
export interface ClusteringSymbolsResponse {
  count: number;
  symbols: string[];
}

// ─── Archetype Enum ──────────────────────────────────────────────────────────
export type PatternArchetype =
  | 'Trending_Bull'
  | 'Volatile_Bull'
  | 'Compressed_Bull'
  | 'Trending_Bear'
  | 'Volatile_Bear'
  | 'Compressed_Bear'
  | 'Whipsaw'
  | 'Indecision';

// ─── Full Analysis (/analysis) ───────────────────────────────────────────────
export interface ClusteringAnalysisResponse {
  symbol: string;
  analysis_window: number;
  total_days: number;
  confidence_consistency: {
    rolling_confidence: number;
    rolling_consistency_pct: number;
    overall_confidence: number;
    overall_consistency_pct: number;
  };
  noise: {
    rolling_noise_fraction: number;
    total_noise_fraction: number;
    total_noise_days: number;
  };
  quality_metrics: QualityMetrics;
  active_clusters: {
    count: number;
    clusters: ActiveClusterSummary[];
  };
  lineage_summary: {
    total_runs: number;
    n_canonical: number;
    n_retired: number;
  };
}

export interface QualityMetrics {
  silhouette_score: number;
  silhouette_reduced: number;
  trustworthiness: number;
  dbcv: number;
}

export interface ActiveClusterSummary {
  cluster_id: number;
  h_label: string;
  days_in_window: number;
  noise_fraction: number;
  avg_confidence: number;
  volatility_distribution: {
    low: number;
    normal: number;
    high: number;
  };
  trend_distribution: {
    down: number;
    sideways: number;
    up: number;
  };
  lineage: {
    stability_streak: number;
    avg_jaccard_30d: number;
    last_event: string;
  };
  archetype: PatternArchetype;
  win_rate: number;
  risk_adjusted_return: number;
  avg_return_pct: number;
  avg_volatility_pct: number;
  persistence: number;
  intra_pattern_similarity: number;
}

// ─── Confidence (/confidence) ────────────────────────────────────────────────
export interface ClusteringConfidenceResponse {
  symbol: string;
  window: number;
  rolling_confidence: number;
  rolling_consistency_pct: number;
  overall_confidence: number;
  overall_consistency_pct: number;
  avg_consecutive_same_label: number;
  stability_flag_distribution: Record<string, number>;
  total_days: number;
  confidence_timeseries: {
    dates: string[];
    confidence: number[];
    labels: string[];
    stability_flags: string[];
  };
}

// ─── Noise (/noise) ──────────────────────────────────────────────────────────
export interface PerPatternNoise {
  n_noise: number;
  n_core: number;
  noise_fraction: number;
}

export interface ClusteringNoiseResponse {
  symbol: string;
  total_noise_fraction: number;
  total_noise_days: number;
  total_days: number;
  rolling_noise_fraction: number;
  rolling_window: number;
  per_pattern_noise: Record<string, PerPatternNoise>;
  noise_density_timeseries: {
    dates: string[];
    density: number[];
  };
}

// ─── Active Clusters (/active-clusters) ──────────────────────────────────────
export interface ClusterCharacteristics {
  is_persistent: boolean;
  is_high_similarity: boolean;
  is_profitable: boolean;
  is_noise_cluster: boolean;
  n_noise_days: number;
  n_core_days: number;
  noise_fraction: number;
  n_wins: number;
  median_return: number;
  symbol_otc_std: number;
  symbol_range_median: number;
}

export interface ClusterProfile {
  h_label: string;
  pattern_archetype: PatternArchetype;
  n_days: number;
  avg_return: number;
  avg_volatility: number;
  persistence: number;
  intra_pattern_similarity: number;
  win_rate: number;
  risk_adjusted_return: number;
  intraday_range: number;
  return_std: number;
  recurrence_rate: number;
  percentage_overall: number;
  regime_id: number;
  global_cluster_id: number;
  characteristics: ClusterCharacteristics;
}

export interface ClusterRegistry {
  stability_streak: number;
  avg_jaccard_30d: number;
  last_event: string;
  split_count: number;
  merge_count: number;
}

export interface ActiveCluster {
  cluster_id: number;
  days_in_window: number;
  core_days: number;
  noise_days: number;
  noise_fraction: number;
  avg_confidence: number;
  profile: ClusterProfile;
  registry: ClusterRegistry;
}

export interface ActiveClustersResponse {
  symbol: string;
  window_days: number;
  n_active_clusters: number;
  clusters: ActiveCluster[];
}

// ─── Pattern Noise Distribution (/pattern-noise-distribution) ────────────────
export interface PatternNoiseEntry {
  pattern: string;
  total_days: number;
  core_days: number;
  noise_days: number;
  noise_fraction: number;
}

export interface PatternNoiseDistributionResponse {
  symbol: string;
  total_days: number;
  total_noise_days: number;
  overall_noise_fraction: number;
  patterns: PatternNoiseEntry[];
}

// ─── Pattern Risk Return (/pattern-risk-return) ──────────────────────────────
export interface PatternRiskReturn {
  pattern: string;
  archetype: PatternArchetype;
  avg_return_pct: number;
  avg_volatility_pct: number;
  risk_adjusted_return: number;
  win_rate: number;
  n_days: number;
  persistence: number;
  return_std: number;
  intraday_range: number;
}

export interface PatternRiskReturnResponse {
  symbol: string;
  patterns: PatternRiskReturn[];
}

// ─── Pattern Regime Distribution (/pattern-regime-distribution) ──────────────
export interface RegimeCounts {
  counts: Record<string, number>;
  percentages: Record<string, number>;
}

export interface PatternRegimeDistributionResponse {
  symbol: string;
  has_volatility_regime: boolean;
  has_trend_regime: boolean;
  volatility_labels: string[];
  trend_labels: string[];
  volatility_distribution: Record<string, RegimeCounts>;
  trend_distribution: Record<string, RegimeCounts>;
}

// ─── Pattern Confidence (/pattern-confidence) ────────────────────────────────
export interface PerClusterConfidence {
  cluster_id: number;
  avg_confidence: number;
  min_confidence: number;
  max_confidence: number;
  consistency_pct: number;
  n_days: number;
  intra_pattern_similarity: number;
}

export interface PatternConfidenceResponse {
  symbol: string;
  quality_metrics: QualityMetrics;
  overall_avg_confidence: number;
  overall_consistency_pct: number;
  per_cluster_confidence: PerClusterConfidence[];
}

// ─── Intraday Shapes (/intraday-shapes) ──────────────────────────────────────
export interface IntradayShapePattern {
  h_label: string;
  archetype: PatternArchetype;
  n_core: number;
  n_noise: number;
  n_total: number;
  n_minutes: number;
  median_shape: number[];
  p25_shape: number[];
  p75_shape: number[];
  median_return_from_open: number[];
  p25_return_from_open: number[];
  p75_return_from_open: number[];
  median_volume_profile: number[];
  core_shapes?: number[][];
  noise_shapes?: number[][];
}

export interface IntradayShapesResponse {
  symbol: string;
  exchange: string;
  patterns: Record<string, IntradayShapePattern>;
}

// ─── Pattern Profiles (/pattern-profiles) ────────────────────────────────────
export interface PatternProfilesResponse {
  symbol: string;
  n_patterns: number;
  profiles: ClusterProfile[];
}

// ─── Lineage Registry (/lineage-registry) ────────────────────────────────────
export interface LineageEntry {
  date: string;
  raw_label: number;
  jaccard: number;
}

export interface CanonicalCluster {
  created: string;
  current_run_label: number;
  lineage: LineageEntry[];
  stability_streak: number;
  avg_jaccard_30d: number;
  split_count: number;
  merge_count: number;
  last_event: string;
  born_from: string | null;
}

export interface RetiredCluster {
  retired_date: string;
  reason: string;
  absorbed_by: string | null;
}

export interface LineageRegistryResponse {
  symbol: string;
  canonical_clusters: Record<string, CanonicalCluster>;
  retired_clusters: Record<string, RetiredCluster>;
  events: LineageEvent[];
}

export interface LineageEvent {
  date: string;
  event_type: string;
  cluster: string;
  details: Record<string, any>;
}

// ─── Archetype Color/Style Map ───────────────────────────────────────────────
export const ARCHETYPE_COLORS: Record<PatternArchetype, string> = {
  Trending_Bull: '#22c55e',
  Volatile_Bull: '#4ade80',
  Compressed_Bull: '#86efac',
  Trending_Bear: '#ef4444',
  Volatile_Bear: '#f87171',
  Compressed_Bear: '#fca5a5',
  Whipsaw: '#f59e0b',
  Indecision: '#8b5cf6',
};

export const ARCHETYPE_ICONS: Record<PatternArchetype, string> = {
  Trending_Bull: '📈',
  Volatile_Bull: '⚡📈',
  Compressed_Bull: '🔋📈',
  Trending_Bear: '📉',
  Volatile_Bear: '⚡📉',
  Compressed_Bear: '🔋📉',
  Whipsaw: '🔀',
  Indecision: '❓',
};

// ─── Pattern Color Palette (for consistent chart colors) ─────────────────────
export const PATTERN_COLORS = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
];
