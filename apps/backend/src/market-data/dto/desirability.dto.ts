// DTOs for Market Desirability Scoring Feature
// Matches the external Pattern Desirability Service API responses

export enum ClassificationEnum {
    HIGHLY_DESIRABLE = 'highly_desirable',
    MODERATELY_DESIRABLE = 'moderately_desirable',
    ACCEPTABLE = 'acceptable',
    NOT_DESIRABLE = 'not_desirable',
}

/**
 * Response from external Pattern Desirability Service
 * GET /desirability/scores/{symbol}
 */
export interface ScoreResponseDto {
    symbol: string;
    method: string;
    scores: Record<string, number>; // Cluster ID -> Score mapping
    classifications: Record<string, ClassificationEnum>;
    timestamp: string;
}

/**
 * Internal DTO returned to frontend
 * Contains processed max score and classification
 */
export class DesirabilityResultDto {
    symbol: string;
    maxScore: number | null;
    classification: ClassificationEnum | null;
    method: string;
    timestamp: Date;
    rawScores?: Record<string, number>;
    clusterId?: string; // The cluster ID that has the max score
    details?: ClusterDetailsDto; // Added for detailed view
}

// ==========================================
// NEW DTOs for Full Integration
// ==========================================

export interface ClusterDetailsDto {
    time_above_open_pct: number;
    max_drawdown: number;
    final_gain_pct: number;
    recovery_ratio: number;
    momentum_score: number;
    // Legacy fields (may still be returned by some endpoints)
    slope?: number;
    final_position?: number;
    recovery_time_minutes?: number | null;
    trend_strength?: number;
    pattern_length?: number;
}

export interface ClusterMetricsDto {
    desirability_score: number;
    directional_bias: number;
    recovery_quality: number;
    upward_momentum: number;
    drawdown_penalty: number;
    classification: ClassificationEnum;
    details?: ClusterDetailsDto;
}

export interface RankedClusterDto {
    cluster_id: number;
    score: number;
}

export interface AnalyzeResponseDto {
    symbol: string;
    method: string;
    n_clusters_analyzed: number;
    clusters: Record<string, ClusterMetricsDto>;
    ranked_clusters: RankedClusterDto[];
    // Legacy fields (backward compatibility)
    desirable_clusters?: number[];
    scores?: Record<string, number>;
}

// Request body for POST /desirability/analyze/all
export interface AnalyzeAllRequestDto {
    symbol: string;
    method?: string;
    exchange?: string;
}

// Request body for POST /desirability/analyze/cluster
export interface AnalyzeClusterRequestDto {
    symbol: string;
    cluster_id: number;
    method?: string;
    exchange?: string;
}

export interface FilterRequestDto {
    symbol: string;
    cluster_ids: number[];
    method?: string;
    min_threshold?: number;
}

export interface FilterResponseDto {
    symbol: string;
    input_clusters: number[];
    filtered_clusters: number[];
    n_filtered: number;
    threshold_used: number;
    metrics: Record<string, {
        desirability_score: number;
        classification: ClassificationEnum;
    }>;
}

export interface GetDesirableRequestDto {
    symbol: string;
    method?: string;
    min_threshold?: number;
}

export interface DesirableClusterDetailDto extends ClusterMetricsDto {
    cluster_id: number;
}

export interface GetDesirableResponseDto {
    symbol: string;
    method: string;
    desirable_clusters: number[];
    n_desirable: number;
    threshold_used: number;
    details: DesirableClusterDetailDto[];
}

export interface MetricsResponseDto {
    symbol: string;
    cluster_id: number;
    metrics: ClusterMetricsDto;
    pattern_stats: {
        recurrence_rate: number;
        persistence_days: number;
        avg_movement: number;
    };
}

export interface ClassificationResponseDto {
    symbol: string;
    cluster_id: number;
    desirability_score: number;
    classification: ClassificationEnum;
    details: ClusterDetailsDto;
    metadata: {
        symbol: string;
        method: string;
        n_days: number;
        analysis_timestamp: string;
    };
}
