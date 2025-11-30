import { useState, useCallback, useEffect, useRef } from 'react';

export interface ClusterPatternData {
    timestamp: number;
    normClose: number;
    priceClose: number;
    normOpen: number;
    normHigh: number;
    normLow: number;
    priceOpen: number;
    priceHigh: number;
    priceLow: number;
    volume: number;
}

export interface ClusterInfo {
    clusterId: number;
    strengthScore: number;
    desirabilityScore: number;
    reoccurrenceProbability: number;
    nDays: number;
    dateRange: {
        start: string;
        end: string;
    };
}

export interface ClusterPatternResponse {
    symbol: string;
    clusterInfo: ClusterInfo;
    patternData: ClusterPatternData[];
    loading: boolean;
    error: string | null;
}

interface UseClusterPatternOptions {
    symbol: string;
    exchange?: string;
    method?: 'spectral' | 'kmeans' | 'hierarchical';
    enabled?: boolean;
}

export const useClusterPattern = (options: UseClusterPatternOptions): ClusterPatternResponse => {
    const { symbol, exchange = 'NSE', method = 'spectral', enabled = true } = options;

    const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
    const [patternData, setPatternData] = useState<ClusterPatternData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const extractCompanyCode = useCallback((fullSymbol: string): string => {
        const parts = fullSymbol.split(':');
        if (parts.length > 1) {
            return parts[1].split('-')[0];
        }
        return fullSymbol;
    }, []);

    const fetchClusterPattern = useCallback(async () => {
        if (!enabled || !symbol) return;

        const companyCode = extractCompanyCode(symbol);
        if (!companyCode) {
            setError('Invalid symbol format');
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setLoading(true);
        setError(null);

        try {
            console.log(`🔍 [CLUSTER] Step 1: Fetching cluster ID for ${companyCode}...`);
            const desirabilityUrl = `/api/proxy/desirability/top-pattern/${companyCode}?exchange=${exchange}&method=${method}`;

            const desirabilityRes = await fetch(desirabilityUrl, {
                signal: abortControllerRef.current.signal,
            });

            if (!desirabilityRes.ok) {
                if (desirabilityRes.status === 404) {
                    throw new Error(`No cluster pattern found for ${companyCode}`);
                }
                throw new Error(`Desirability API error: ${desirabilityRes.statusText}`);
            }

            const desirabilityData = await desirabilityRes.json();
            const topPattern = desirabilityData.top_pattern;

            if (!topPattern || typeof topPattern.cluster_id !== 'number') {
                throw new Error('Invalid response from desirability service');
            }

            const clusterId = topPattern.cluster_id;
            console.log(`✅ [CLUSTER] Step 1 Complete: Cluster ID = ${clusterId}`);

            console.log(`📊 [CLUSTER] Step 2: Fetching intraday data for cluster ${clusterId}...`);
            const intradayUrl = `/api/proxy/intraday/${companyCode}/cluster/${clusterId}?method=${method}`;

            const intradayRes = await fetch(intradayUrl, {
                signal: abortControllerRef.current.signal,
            });

            if (!intradayRes.ok) {
                if (intradayRes.status === 404) {
                    throw new Error(`No intraday data found for cluster ${clusterId}`);
                }
                throw new Error(`Intraday API error: ${intradayRes.statusText}`);
            }

            const intradayData = await intradayRes.json();
            console.log(`✅ [CLUSTER] Step 2 Complete: Received ${intradayData.aggregate_pattern?.length || 0} data points`);

            const transformedPattern: ClusterPatternData[] = (intradayData.aggregate_pattern || []).map(
                (point: any) => ({
                    timestamp: point.minutes_from_open,
                    normClose: point.norm_close_median,
                    priceClose: point.price_close_median,
                    normOpen: point.norm_open_median,
                    normHigh: point.norm_high_median,
                    normLow: point.norm_low_median,
                    priceOpen: point.price_open_median,
                    priceHigh: point.price_high_median,
                    priceLow: point.price_low_median,
                    volume: point.norm_volume_median || 0,
                })
            );

            const info: ClusterInfo = {
                clusterId,
                strengthScore: topPattern.strength_score || 0,
                desirabilityScore: topPattern.desirability_score || 0,
                reoccurrenceProbability: topPattern.reoccurrence_probability || 0,
                nDays: intradayData.n_days || 0,
                dateRange: intradayData.date_range || { start: '', end: '' },
            };

            setClusterInfo(info);
            setPatternData(transformedPattern);
            setLoading(false);

            console.log(`🎉 [CLUSTER] Successfully loaded cluster pattern for ${companyCode}`);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('🛑 [CLUSTER] Request aborted');
                return;
            }

            console.error('❌ [CLUSTER] Error:', err);
            setError(err.message || 'Failed to fetch cluster pattern');
            setLoading(false);
        }
    }, [enabled, symbol, exchange, method, extractCompanyCode]);

    useEffect(() => {
        if (!enabled || !symbol) return;

        fetchClusterPattern();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [enabled, symbol, exchange, method, fetchClusterPattern]);

    return {
        symbol,
        clusterInfo: clusterInfo!,
        patternData,
        loading,
        error,
    };
};
