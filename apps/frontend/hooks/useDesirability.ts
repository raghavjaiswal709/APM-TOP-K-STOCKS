import { useState, useEffect, useCallback } from 'react';

export interface DesirabilityData {
    symbol: string;
    exchange: string;
    method: string;
    top_pattern: {
        cluster_id: number;
        strength_score: number;
        desirability_score: number;
        reoccurrence_probability?: number; // NEW: Reoccurrence probability from API
        classification: string;
        directional_bias: number;
        recovery_quality: number;
        upward_momentum: number;
        drawdown_penalty: number;
        recurrence_rate: number;
        persistence_days: number;
        avg_movement: number;
        volatility: number;
        details: any;
    };
    all_patterns_count: number;
    timestamp: string;
}

interface UseDesirabilityReturn {
    score: number | null;
    classification: string | null;
    loading: boolean;
    error: any;
    data: DesirabilityData | null;
    refetch: () => Promise<void>;
}

/**
 * Custom hook to fetch desirability score for a symbol
 * Re-fetches only when the symbol changes
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
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/desirability/top-pattern/${cleanSymbol}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result: DesirabilityData = await response.json();
            setData(result);
        } catch (err: any) {
            console.error('Error fetching desirability:', err);
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
        loading,
        error,
        data,
        refetch: fetchDesirability,
    };
}
