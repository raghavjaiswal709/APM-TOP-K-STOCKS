// apps/frontend/app/types/sipr.types.ts

export interface SiprAnalysisPeriod {
  start_date: string;  // Format: "YYYY-MM-DD"
  end_date: string;    // Format: "YYYY-MM-DD"
  months: string;
}

export interface SiprPatternInfo {
  pattern_id: number;           // 1-indexed pattern identifier
  frequency: number;            // Occurrences in analyzed period
  percentage: number;           // % of total segments (2 decimal places)
  avg_length: number;           // Average length in time steps
  std_length: number;           // Standard deviation of length
  min_length: number;           // Minimum observed length
  max_length: number;           // Maximum observed length
  avg_distance: number;         // Average DTW distance (4 decimal places)
  overall_frequency: number;    // Total occurrences in full dataset
  overall_percentage: number;   // % in full dataset (2 decimal places)
  avg_time_minutes: number;     // Average duration in minutes
  time_found_range: string | null;      // e.g., "08:00 - 18:00"
  most_prominent_range: string | null;  // e.g., "14:00 - 15:00"
  most_frequent_days?: string;          // ✅ NEW: Optional field from API v1.0.0
}

export interface SiprTop3Response {
  company_code: string;
  analysis_period: SiprAnalysisPeriod;
  top_patterns: SiprPatternInfo[];
  total_segments: number;
}

export interface SiprSegmentInfo {
  start_idx: number;
  end_idx: number;
  pattern_id: number;
  frequency: number;
  percentage: number;
  avg_length: number;
  start_time: string;          // Format: "YYYY-MM-DD HH:MM:SS"
  end_time: string;            // Format: "YYYY-MM-DD HH:MM:SS"
  avg_time_minutes: number;
}

export interface SiprSegmentationResponse {
  company_code: string;
  analysis_months: number;
  figure: any;  // Plotly figure JSON
  segments: SiprSegmentInfo[];
}

export interface SiprClusterResponse {
  company_code: string;
  analysis_months: number;
  figure: any;  // Plotly figure JSON
}

export interface SiprCentroidResponse {
  company_code: string;
  analysis_months: number;
  figure: any;  // Plotly figure JSON
}

export interface SiprPatternReport {
  company_code: string;
  analysis_period: SiprAnalysisPeriod;
  summary: {
    total_segments: number;
    unique_patterns: number;
    avg_segment_length: number;
    most_common_pattern: number;
  };
  top_patterns: Array<{
    pattern_id: number;
    cluster_label: number;
    occurrence_count: number;
    percentage_of_total: number;
    avg_length: number;
    avg_time_minutes: number;
    most_frequent_days: string[];  // ✅ NEW
  }>;
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
