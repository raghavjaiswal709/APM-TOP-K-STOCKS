// ========================================================
// GTT LIVE TRADING SYSTEM - SERVICE LAYER (PORT 5113)
// ========================================================

export interface GttPrediction {
    timestamp: string;   // ISO string from API
    input_close: number; // Current price
    H1_pred: number;     // +15 minutes
    H2_pred: number;     // +30 minutes
    H3_pred: number;     // +45 minutes
    H4_pred: number;     // +60 minutes
    H5_pred: number;     // +75 minutes
}

export interface GttStockHistoryResponse {
    success: boolean;
    symbol: string;
    predictions: GttPrediction[];
    count: number;
    timestamp: string;
    error?: string;
}

class GttService {
    private readonly BASE_URL = '/api/gtt-predictions';

    /**
     * Fetch predictions for a specific stock symbol from GTT Live Trading System
     * @param symbol Stock symbol (e.g., "RELIANCE", "TCS")
     */
    async fetchPredictions(symbol: string): Promise<GttStockHistoryResponse> {
        try {
            // Extract company code from full symbol format (NSE:RELIANCE-EQ -> RELIANCE)
            const companyCode = this.extractCompanyCode(symbol);

            console.log(`[GTT Service] Fetching predictions for ${companyCode} via proxy`);

            const response = await fetch(`${this.BASE_URL}?symbol=${companyCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Define raw response interface matching the actual API
            interface GttRawResponse {
                latest: any;
                predictions: GttPrediction[];
            }

            const rawData: GttRawResponse = await response.json();

            console.log(`[GTT Service] ✅ Received ${rawData.predictions?.length || 0} predictions for ${companyCode}`);

            // Transform raw data to expected response format
            return {
                success: true,
                symbol: companyCode,
                predictions: rawData.predictions || [],
                count: rawData.predictions?.length || 0,
                timestamp: rawData.latest?.timestamp || new Date().toISOString()
            };

        } catch (error: any) {
            console.error(`[GTT Service] ❌ Failed to fetch predictions:`, error);

            // Enhanced error handling as per GTT documentation
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - GTT service not responding');
            }

            if (error.message.includes('Failed to fetch')) {
                throw new Error(`GTT Service unreachable. Proxy at ${this.BASE_URL} failed.`);
            }

            throw error;
        }
    }

    /**
     * Extract company code from full symbol format
     * NSE:RELIANCE-EQ -> RELIANCE
     * BSE:TCS-EQ -> TCS
     */
    private extractCompanyCode(symbol: string): string {
        if (!symbol) return '';

        // Format: EXCHANGE:CODE-MARKER
        const parts = symbol.split(':');
        if (parts.length === 2) {
            const codePart = parts[1].split('-')[0];
            return codePart;
        }

        return symbol;
    }

    /**
     * Health check for GTT service
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.BASE_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }
    /**
     * Clear cache for a specific symbol (placeholder)
     */
    clearCache(symbol: string): void {
        console.log(`[GTT Service] Clearing cache for ${symbol}`);
    }
}

// Singleton export
export const gttService = new GttService();
