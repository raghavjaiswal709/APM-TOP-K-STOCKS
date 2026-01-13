import { useState, useEffect, useCallback } from 'react';

// Combined API response structure from /visualize/predicted-analysis
interface TopClusterData {
    cluster_id: number;
    probability: number;  // This is the reoccurrence probability!
    desirability_score: number;
    classification: string;
    details: {
        time_above_open_pct?: number;
        slope?: number;
        final_position?: number;
        max_drawdown?: number;
        recovery_time_minutes?: number | null;
        trend_strength?: number;
        pattern_length?: number;
        net_change?: number;
        start_value?: number;
        end_value?: number;
        pattern_volatility?: number;
    };
}

interface CombinedApiResponse {
    symbol: string;
    prediction_date: string;
    day_of_week: string;
    top_clusters: TopClusterData[];
}

export interface DesirabilityData {
    symbol: string;
    exchange: string;
    method: string;
    prediction_date?: string;
    day_of_week?: string;
    top_pattern: {
        cluster_id: number;
        strength_score: number;
        desirability_score: number;
        reoccurrence_probability: number;  // From probability field
        classification: string;
        details: {
            time_above_open_pct?: number;
            slope?: number;
            final_position?: number;
            max_drawdown?: number;
            recovery_time_minutes?: number | null;
            trend_strength?: number;
            pattern_length?: number;
            net_change?: number;
            start_value?: number;
            end_value?: number;
            pattern_volatility?: number;
        };
    };
    all_clusters?: TopClusterData[];
    all_patterns_count: number;
    timestamp: string;
}

interface UseDesirabilityReturn {
    score: number | null;
    classification: string | null;
    reoccurrenceProbability: number | null;
    loading: boolean;
    error: any;
    data: DesirabilityData | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch desirability score and probability for a symbol
 * Uses the combined /visualize/predicted-analysis endpoint (port 8506)
 * which provides both desirability AND probability (reoccurrence)
 */
export function useDesirability(symbol: string): UseDesirabilityReturn {
    const [data, setData] = useState<DesirabilityData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<any>(null);

    const fetchDesirability = useCallback(async () => {
        // Don't fetch if no symbol is provided
        if (!symbol) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        const cleanSymbol = symbol.includes(':') ? symbol.split(':')[1]?.split('-')[0] : symbol;

        console.log(`🔍 [useDesirability] Fetching for symbol: ${symbol} (Clean: ${cleanSymbol})`);

        try {
            // Use the combined /visualize/predicted-analysis endpoint (port 8506)
            // This provides BOTH probability AND desirability in one call!
            const response = await fetch(
                `/api/proxy/visualize/predicted-analysis`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        symbol: cleanSymbol,
                        method: 'spectral',
                        exchange: 'NSE',
                        top_n: 5,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const apiResult: CombinedApiResponse = await response.json();
            
            console.log(`📊 [useDesirability] API Response:`, apiResult);

            // Get the top cluster (first in the array - already sorted by probability)
            const topClusters = apiResult.top_clusters || [];
            
            if (topClusters.length === 0) {
                throw new Error('No clusters found in response');
            }

            // Find the best cluster - the one with highest desirability that also has good probability
            // Sort by desirability_score to find the most desirable pattern
            const sortedByDesirability = [...topClusters].sort((a, b) => b.desirability_score - a.desirability_score);
            const topCluster = sortedByDesirability[0];

            // Transform to expected format
            const transformedData: DesirabilityData = {
                symbol: apiResult.symbol,
                exchange: 'NSE',
                method: 'spectral',
                prediction_date: apiResult.prediction_date,
                day_of_week: apiResult.day_of_week,
                top_pattern: {
                    cluster_id: topCluster.cluster_id,
                    strength_score: topCluster.desirability_score,
                    desirability_score: topCluster.desirability_score,
                    reoccurrence_probability: topCluster.probability,  // THIS IS THE PROBABILITY!
                    classification: topCluster.classification,
                    details: topCluster.details || {},
                },
                all_clusters: topClusters,
                all_patterns_count: topClusters.length,
                timestamp: new Date().toISOString(),
            };

            console.log(`✅ [useDesirability] Top pattern for ${cleanSymbol}:`);
            console.log(`   Score: ${topCluster.desirability_score.toFixed(2)}`);
            console.log(`   Probability: ${(topCluster.probability * 100).toFixed(1)}%`);
            console.log(`   Cluster: ${topCluster.cluster_id}`);
            console.log(`   Classification: ${topCluster.classification}`);
            
            setData(transformedData);
        } catch (err: any) {
            console.error('❌ [useDesirability] Error fetching desirability:', err);
            setError(err);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchDesirability();
    }, [fetchDesirability]);

    return {
        score: data?.top_pattern?.desirability_score ?? null,
        classification: data?.top_pattern?.classification ?? null,
        reoccurrenceProbability: data?.top_pattern?.reoccurrence_probability ?? null,
        loading,
        error,
        data,
        refetch: fetchDesirability,
    };
}
