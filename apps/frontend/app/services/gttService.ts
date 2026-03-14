// GTT Live Trading Service (Port 5113)

export interface GttPrediction {
    timestamp: string;
    input_close: number;
    S1_H1_pred: number;
    S1_H2_pred: number;
    S1_H3_pred: number;
    S1_H4_pred: number;
    S1_H5_pred: number;
    S2_H1_pred: number;
    S2_H2_pred: number;
    S2_H3_pred: number;
    S2_H4_pred: number;
    S2_H5_pred: number;
    askbid_available?: boolean;
    prediction_time: string;
}

export interface GttLatestPrediction extends GttPrediction {
    // Latest prediction includes all fields from GttPrediction
}

export interface GttStockHistoryResponse {
    latest: GttLatestPrediction;
    predictions: GttPrediction[];
    symbol: string;
    total_predictions: number;
}

class GttService {
    private readonly BASE_URL = '/api/gtt-predictions';
    private readonly BACKEND_URL = process.env.NEXT_PUBLIC_GTT_API_URL || 'http://localhost:5002';

    // Fetch predictions for symbol
    async fetchPredictions(symbol: string): Promise<GttStockHistoryResponse> {
        try {
            // Extract company code from full symbol format (NSE:RELIANCE-EQ -> RELIANCE)
            const companyCode = this.extractCompanyCode(symbol);

            if (!companyCode) {
                throw new Error('Invalid symbol format. Expected format: NSE:SYMBOL-EQ or just SYMBOL');
            }

            console.log(`[GTT Service] 📡 Fetching predictions for ${companyCode} via proxy`);

            // Encode company code for URL safety
            const response = await fetch(`${this.BASE_URL}?symbol=${encodeURIComponent(companyCode)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(15000), // 15 second timeout
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    error: `HTTP ${response.status}: ${response.statusText}`
                }));
                throw new Error(errorData.error || `Failed to fetch GTT predictions (${response.status})`);
            }

            const data: GttStockHistoryResponse = await response.json();

            // Validation
            if (!data.latest || !data.predictions || !Array.isArray(data.predictions)) {
                throw new Error('Invalid response format from GTT service');
            }

            console.log(`[GTT Service] ✅ Received ${data.total_predictions || data.predictions.length} predictions for ${companyCode}`);
            console.log(`[GTT Service] 📊 Latest prediction time: ${data.latest.prediction_time}`);

            return data;

        } catch (error: any) {
            console.error(`[GTT Service] ❌ Failed to fetch predictions:`, error);

            // Enhanced error handling
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                throw new Error('Request timeout - GTT service not responding');
            }

            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error(`GTT Service unreachable. Check if backend is running on ${this.BACKEND_URL}`);
            }

            throw error;
        }
    }

    // Direct backend call (bypass proxy)
    async fetchPredictionsDirect(symbol: string): Promise<GttStockHistoryResponse> {
        try {
            const companyCode = this.extractCompanyCode(symbol);
            // Encode company code for URL safety
            const url = `${this.BACKEND_URL}/gtt/stock/${encodeURIComponent(companyCode)}`;

            console.log(`[GTT Service] 📡 Direct fetch from ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`[GTT Service] ✅ Direct fetch successful:`, data);

            return data;

        } catch (error: any) {
            console.error(`[GTT Service] ❌ Direct fetch failed:`, error);
            throw error;
        }
    }

    // Extract company code from symbol
    private extractCompanyCode(symbol: string): string {
        if (!symbol) {
            console.warn('[GTT Service] ⚠️ Empty symbol provided');
            return '';
        }

        // Remove whitespace
        symbol = symbol.trim();

        // Format: EXCHANGE:CODE-MARKER (e.g., NSE:BANDHANBNK-EQ)
        if (symbol.includes(':')) {
            const parts = symbol.split(':');
            if (parts.length === 2) {
                const codePart = parts[1].split('-')[0];
                console.log(`[GTT Service] 🔄 Extracted ${codePart} from ${symbol}`);
                return codePart;
            }
        }

        // Already in simple format (e.g., BANDHANBNK)
        console.log(`[GTT Service] ✓ Using symbol as-is: ${symbol}`);
        return symbol.split('-')[0]; // Remove marker if exists (BANDHANBNK-EQ -> BANDHANBNK)
    }

    // Health check — probes actual working endpoints instead of non-existent /health
    async healthCheck(): Promise<{ proxy: boolean; backend: boolean }> {
        const results = { proxy: false, backend: false };

        // Check Next.js proxy by fetching a known stock (lightweight check)
        try {
            const proxyResponse = await fetch(`${this.BASE_URL}?symbol=SBIN`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (proxyResponse.ok) {
                const data = await proxyResponse.json();
                // Verify it's actually GTT data (has predictions array)
                results.proxy = !!(data && data.predictions && Array.isArray(data.predictions));
            }
        } catch (error) {
            console.warn('[GTT Service] Proxy health check failed:', error);
        }

        // Check direct backend via /gtt/latest (always available when GTT engine is running)
        if (!results.proxy) {
            try {
                const backendResponse = await fetch(`${this.BACKEND_URL}/gtt/latest`, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000),
                });
                if (backendResponse.ok) {
                    const data = await backendResponse.json();
                    results.backend = !!(data && typeof data === 'object');
                }
            } catch (error) {
                console.warn('[GTT Service] Backend health check failed:', error);
            }
        }

        console.log('[GTT Service] Health Check:', results);
        return results;
    }

    // Get service config
    getConfig() {
        return {
            proxyUrl: this.BASE_URL,
            backendUrl: this.BACKEND_URL,
            environment: process.env.NODE_ENV,
        };
    }

    // Clear cache
    clearCache(symbol: string): void {
        console.log(`[GTT Service] 🗑️ Clearing cache for ${symbol}`);
        // TODO: Implement cache clearing logic if needed
    }
}

// Singleton export
export const gttService = new GttService();

// Debug export for console testing
if (typeof window !== 'undefined') {
    (window as any).__gttService = gttService;
    console.log('💡 GTT Service available at window.__gttService for debugging');
}
