// apps/frontend/app/types/sipr.types.ts

export interface SiprPattern {
  pattern_id: number;
  cluster_label: number;
  segment_length: number;
  avg_segment_length: number;
  occurrence_count: number;
  percentage_of_total: number;
  shape_characteristics: {
    mean: number;
    std: number;
    min: number;
    max: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface SiprTop3Response {
  company_code: string;
  analysis_months: number;
  total_segments: number;
  unique_patterns: number;
  top_3_patterns: SiprPattern[];
  analysis_timestamp: string;
}

export interface SiprTimeSeriesPoint {
  timestamp: string;
  value: number;
  segment_id: number;
  cluster_label: number;
}

export interface SiprSegmentationResponse {
  company_code: string;
  analysis_months: number;
  time_series_data: SiprTimeSeriesPoint[];
  segment_boundaries: number[];
  cluster_assignments: number[];
  analysis_timestamp: string;
}

export interface SiprClusterData {
  cluster_id: number;
  size: number;
  centroid: number[];
  members: number[];
  characteristics: {
    avg_length: number;
    variance: number;
    dominant_trend: string;
  };
}

export interface SiprClusterResponse {
  company_code: string;
  analysis_months: number;
  n_clusters: number;
  clusters: SiprClusterData[];
  silhouette_score: number;
  analysis_timestamp: string;
}

export interface SiprCentroidShape {
  cluster_id: number;
  shape: number[];
  length: number;
  characteristics: {
    peak_value: number;
    trough_value: number;
    volatility: number;
    trend_direction: string;
  };
}

export interface SiprCentroidResponse {
  company_code: string;
  analysis_months: number;
  centroids: SiprCentroidShape[];
  analysis_timestamp: string;
}

export interface SiprPatternReport {
  company_code: string;
  analysis_period: {
    months: number;
    start_date: string;
    end_date: string;
  };
  summary: {
    total_segments: number;
    unique_patterns: number;
    avg_segment_length: number;
    most_common_pattern: number;
  };
  top_patterns: SiprPattern[];
  cluster_distribution: {
    [cluster_id: number]: number;
  };
  recommendations: string[];
  analysis_timestamp: string;
}

export interface SiprServiceHealth {
  message: string;
  version: string;
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface SiprConfig {
  apiBaseUrl: string;
  defaultMonths: number;
  timeout: number;
  cacheTTL: number;
}

export interface SiprDashboardProps {
  companyCode: string;
  months?: number;
  className?: string;
}

export type SiprLoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface SiprError {
  code: string;
  message: string;
  suggestion?: string;
  timestamp: string;
}
