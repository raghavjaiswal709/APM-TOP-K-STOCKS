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
}
