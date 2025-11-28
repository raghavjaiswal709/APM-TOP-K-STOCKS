import { useState, useEffect, useCallback, useRef } from 'react';
import { gttService, type GttStockHistoryResponse, type GttPrediction } from '@/app/services/gttService';

interface UseGttPredictionsOptions {
    symbol: string;
    enabled: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number; // milliseconds
}

interface UseGttPredictionsReturn {
    predictions: GttStockHistoryResponse | null;
    latestPrediction: GttPrediction | null;
    loading: boolean;
    error: string | null;
    isHealthy: boolean;
    refetch: () => Promise<void>;
    clearCache: () => void;
}

export function useGttPredictions({
    symbol,
    enabled,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000 // 5 minutes default
}: UseGttPredictionsOptions): UseGttPredictionsReturn {

    const [predictions, setPredictions] = useState<GttStockHistoryResponse | null>(null);
    const [latestPrediction, setLatestPrediction] = useState<GttPrediction | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isHealthy, setIsHealthy] = useState<boolean>(false);

    const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);

    // ============ FETCH PREDICTIONS ============
    const fetchPredictions = useCallback(async () => {
        if (!symbol || !enabled) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            console.log(`🔮 [useGttPredictions] Fetching for ${symbol}`);
            const data = await gttService.fetchPredictions(symbol);

            if (!isMountedRef.current) return;

            setPredictions(data);
            setLatestPrediction(data.predictions[data.predictions.length - 1] || null);
            setIsHealthy(true);

            console.log(`✅ [useGttPredictions] Loaded ${data.count} predictions for ${symbol}`);
        } catch (err: any) {
            if (!isMountedRef.current) return;

            const errorMessage = err.message || 'Failed to load GTT predictions';
            setError(errorMessage);
            setPredictions(null);
            setLatestPrediction(null);
            setIsHealthy(false);

            console.error(`❌ [useGttPredictions] Error:`, errorMessage);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [symbol, enabled]);

    // ============ HEALTH CHECK ============
    const checkHealth = useCallback(async () => {
        try {
            const healthy = await gttService.healthCheck();
            if (isMountedRef.current) {
                setIsHealthy(healthy);
            }
        } catch {
            if (isMountedRef.current) {
                setIsHealthy(false);
            }
        }
    }, []);

    // ============ CLEAR CACHE ============
    const clearCache = useCallback(() => {
        gttService.clearCache(symbol);
        setPredictions(null);
        setLatestPrediction(null);
    }, [symbol]);

    // ============ EFFECTS ============

    // Initial fetch + health check
    useEffect(() => {
        if (enabled && symbol) {
            checkHealth();
            fetchPredictions();
        } else {
            // Reset state when disabled
            setPredictions(null);
            setLatestPrediction(null);
            setError(null);
        }
    }, [symbol, enabled, fetchPredictions, checkHealth]);

    // Auto-refresh logic
    useEffect(() => {
        if (!enabled || !autoRefresh || !symbol) {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
            return;
        }

        console.log(`🔄 [useGttPredictions] Auto-refresh enabled (${refreshInterval}ms)`);

        refreshTimerRef.current = setInterval(() => {
            console.log(`🔄 [useGttPredictions] Auto-refreshing predictions`);
            fetchPredictions();
        }, refreshInterval);

        return () => {
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
                refreshTimerRef.current = null;
            }
        };
    }, [enabled, autoRefresh, refreshInterval, symbol, fetchPredictions]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (refreshTimerRef.current) {
                clearInterval(refreshTimerRef.current);
            }
        };
    }, []);

    return {
        predictions,
        latestPrediction,
        loading,
        error,
        isHealthy,
        refetch: fetchPredictions,
        clearCache
    };
}
