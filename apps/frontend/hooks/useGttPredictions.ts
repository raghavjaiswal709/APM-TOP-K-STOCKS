import { useState, useEffect, useCallback, useRef } from 'react';

export interface GttPrediction {
    prediction_time: string;
    input_close: number;
    H1_pred: number;
    H2_pred: number;
    H3_pred: number;
    H4_pred: number;
    H5_pred: number;
    timestamp: string;
}

export interface GttStockResponse {
    symbol: string;
    total_predictions: number;
    predictions: GttPrediction[];
    latest: GttPrediction;
}

interface UseGttPredictionsResult {
    predictions: GttStockResponse | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export const useGttPredictions = (symbol: string, isEnabled: boolean): UseGttPredictionsResult => {
    const [predictions, setPredictions] = useState<GttStockResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchPredictions = useCallback(async () => {
        if (!symbol) return;

        // Don't set loading to true on background polls to avoid UI flickering
        // Only set it on initial fetch if data is missing
        if (!predictions) {
            setLoading(true);
        }

        try {
            // Use the NestJS proxy endpoint
            // Assuming the backend is running on port 5000 and proxied via Next.js or directly accessible
            // Since this is a client-side hook, we should use the Next.js API route or the backend URL directly.
            // Based on context, the backend is on port 5000. 
            // We'll try to use a relative path if Next.js rewrites are set up, or the full URL.
            // Given the user instructions "Backend: Create a NestJS proxy module... Frontend: Poll the backend /gtt/stock/:symbol",
            // I will assume the frontend can hit the backend directly or via proxy.
            // I'll use the environment variable if available, or default to localhost:5000 for dev.

            const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const cleanSymbol = symbol.replace('NSE:', '').replace('-EQ', ''); // Adjust symbol format if needed by GTT

            // The user's backend service expects "NSE:RELIANCE-EQ" or similar? 
            // The GttService calls `${this.GTT_ENGINE_URL}/api/predictions/stock/${symbol}`.
            // The GTT engine likely expects the full symbol or a specific format.
            // I'll pass the symbol as is for now, assuming the backend or GTT handles it.

            const response = await fetch(`${backendUrl}/gtt/stock/${encodeURIComponent(symbol)}`);

            if (!response.ok) {
                throw new Error(`Error fetching predictions: ${response.statusText}`);
            }

            const data: GttStockResponse = await response.json();
            setPredictions(data);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch GTT predictions:', err);
            setError(err.message || 'Failed to fetch predictions');
        } finally {
            setLoading(false);
        }
    }, [symbol, predictions]);

    useEffect(() => {
        if (!isEnabled || !symbol) {
            setPredictions(null);
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        // Initial fetch
        fetchPredictions();

        // Start polling every 45 seconds
        pollIntervalRef.current = setInterval(fetchPredictions, 45000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [isEnabled, symbol, fetchPredictions]);

    return { predictions, loading, error, refetch: fetchPredictions };
};
