// ========================================================
// GTT LIVE TRADING SYSTEM - SERVICE LAYER (PORT 5113)
// ========================================================

export interface GttPrediction {
    timestamp: string;
    input_close: number;
    H1_pred: number;
    H2_pred: number;
    H3_pred: number;
    H4_pred: number;
    H5_pred: number;
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
    private readonly BACKEND_URL = process.env.NEXT_PUBLIC_GTT_API_URL || 'http://localhost:5000';

    /**
     * ✅ MAIN METHOD: Fetch predictions for a specific stock symbol from GTT Live Trading System
     * @param symbol Stock symbol (e.g., "RELIANCE", "TCS", "NSE:BANDHANBNK-EQ")
     */
    async fetchPredictions(symbol: string): Promise<GttStockHistoryResponse> {
        try {
            // Extract company code from full symbol format (NSE:RELIANCE-EQ -> RELIANCE)
            const companyCode = this.extractCompanyCode(symbol);

            if (!companyCode) {
                throw new Error('Invalid symbol format. Expected format: NSE:SYMBOL-EQ or just SYMBOL');
            }

            console.log(`[GTT Service] 📡 Fetching predictions for ${companyCode} via proxy`);

            const response = await fetch(`${this.BASE_URL}?symbol=${companyCode}`, {
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

            // ✅ VALIDATION: Ensure data structure is correct
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

    /**
     * ✅ DIRECT BACKEND CALL: Bypass Next.js proxy (for debugging)
     */
    async fetchPredictionsDirect(symbol: string): Promise<GttStockHistoryResponse> {
        try {
            const companyCode = this.extractCompanyCode(symbol);
            const url = `${this.BACKEND_URL}/gtt/stock/${companyCode}`;

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

    /**
     * ✅ Extract company code from full symbol format
     * NSE:RELIANCE-EQ -> RELIANCE
     * BSE:TCS-EQ -> TCS
     * BANDHANBNK -> BANDHANBNK
     */
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

    /**
     * ✅ Health check for GTT service
     */
    async healthCheck(): Promise<{ proxy: boolean; backend: boolean }> {
        const results = { proxy: false, backend: false };

        // Check Next.js proxy
        try {
            const proxyResponse = await fetch(`${this.BASE_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });
            results.proxy = proxyResponse.ok;
        } catch (error) {
            console.warn('[GTT Service] Proxy health check failed:', error);
        }

        // Check direct backend
        try {
            const backendResponse = await fetch(`${this.BACKEND_URL}/gtt/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });
            results.backend = backendResponse.ok;
        } catch (error) {
            console.warn('[GTT Service] Backend health check failed:', error);
        }

        console.log('[GTT Service] Health Check:', results);
        return results;
    }

    /**
     * ✅ Get service status and configuration
     */
    getConfig() {
        return {
            proxyUrl: this.BASE_URL,
            backendUrl: this.BACKEND_URL,
            environment: process.env.NODE_ENV,
        };
    }

    /**
     * ✅ Clear cache for a specific symbol (future implementation)
     */
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
