import { useState, useEffect, useCallback } from 'react';

export interface ClusterDetails {
    time_above_open_pct: number;
    slope: number;
    final_position: number;
    max_drawdown: number;
    recovery_time_minutes: number | null;
    trend_strength: number;
    pattern_length: number;
}

export interface DesirabilityData {
    symbol: string;
    maxScore: number | null;
    classification: string | null;
    method: string;
    timestamp: string;
    rawScores?: Record<string, number>;
    clusterId?: string;
    details?: ClusterDetails;
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

        // Extract clean symbol (e.g., "NSE:HDFCBANK-EQ" -> "HDFCBANK")
        const cleanSymbol = symbol.includes(':') ? symbol.split(':')[1]?.split('-')[0] : symbol;
        console.log(`🔍 [useDesirability] Fetching for symbol: ${symbol} (Clean: ${cleanSymbol})`);

        try {
            const response = await fetch(
                `http://localhost:5000/desirability/scores/${cleanSymbol}`,
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
        score: data?.maxScore ?? null,
        classification: data?.classification ?? null,
        loading,
        error,
        data,
        refetch: fetchDesirability,
    };
}
