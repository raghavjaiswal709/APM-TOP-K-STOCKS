// apps/frontend/hooks/useGttPolling.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { gttService, GttStockHistoryResponse } from '@/app/services/gttService';

export interface GttPollingConfig {
    symbol: string;
    pollInterval?: number;
    enabled?: boolean;
    onUpdate?: (data: GttStockHistoryResponse) => void;
    onError?: (error: string) => void;
}

export const useGttPolling = (config: GttPollingConfig) => {
    const {
        symbol,
        pollInterval = 60 * 1000, // 1 minute default
        enabled = true,
        onUpdate,
        onError,
    } = config;

    const [predictions, setPredictions] = useState<GttStockHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isPolling, setIsPolling] = useState(false);

    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const fetchPredictions = useCallback(async () => {
        if (!symbol) {
            console.warn('⚠️ [useGttPolling] No symbol provided');
            return;
        }

        // Extract company code from symbol (e.g., "NSE:BANDHANBNK-EQ" -> "BANDHANBNK")
        const companyCode = symbol.split(':')[1]?.split('-')[0];
        if (!companyCode) {
            console.error('❌ [useGttPolling] Invalid symbol format:', symbol);
            return;
        }

        try {
            setLoading(true);
            console.log(`📡 [useGttPolling] Fetching GTT predictions for ${companyCode}`);

            const data = await gttService.fetchPredictions(symbol);

            if (mountedRef.current) {
                setPredictions(data);
                setLastUpdated(new Date());
                setError(null);
                onUpdate?.(data);
                console.log(`✅ [useGttPolling] Received ${data.total_predictions} predictions`);
            }
        } catch (err: any) {
            if (mountedRef.current) {
                const errorMessage = err.message || 'Failed to fetch GTT predictions';
                setError(errorMessage);
                onError?.(errorMessage);
                console.error(`❌ [useGttPolling] Error:`, errorMessage);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [symbol, onUpdate, onError]);

    const startPolling = useCallback(() => {
        if (!enabled || !symbol) {
            console.warn('⚠️ [useGttPolling] Cannot start polling - disabled or no symbol');
            return;
        }

        console.log(`🚀 [useGttPolling] Starting polling for ${symbol} (interval: ${pollInterval}ms)`);
        setIsPolling(true);
        fetchPredictions(); // Initial fetch

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(() => {
            console.log(`🔄 [useGttPolling] Auto-refresh triggered`);
            fetchPredictions();
        }, pollInterval);
    }, [enabled, symbol, pollInterval, fetchPredictions]);

    const stopPolling = useCallback(() => {
        console.log('🛑 [useGttPolling] Stopping polling');
        setIsPolling(false);
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        if (enabled && symbol) {
            startPolling();
        } else {
            stopPolling();
        }

        return () => {
            mountedRef.current = false;
            stopPolling();
        };
    }, [enabled, symbol, startPolling, stopPolling]);

    return {
        predictions,
        loading,
        error,
        lastUpdated,
        isPolling,
        startPolling,
        stopPolling,
        refetch: fetchPredictions,
    };
};
