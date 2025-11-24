import axios from 'axios';

const API_BASE_URL = '/api/sentiment';

export interface SentimentResponse {
    sentiment: string;
    confidence?: string;
    method?: string;
    stock_ticker?: string;
    date?: string;
}

export const sentimentService = {
    /**
     * Fetches the sentiment for a given stock ticker.
     * @param ticker The stock symbol (e.g., "NETWEB")
     * @returns The sentiment string (e.g., "POSITIVE", "NEGATIVE", "NEUTRAL") or "NEUTRAL" on failure.
     */
    fetchSentiment: async (ticker: string): Promise<string> => {
        if (!ticker) return 'NEUTRAL';

        // Extract the clean ticker if it's in format "NSE:NETWEB-EQ"
        const cleanTicker = ticker.split(':')[1]?.split('-')[0] || ticker;

        try {
            const response = await axios.get<SentimentResponse>(`${API_BASE_URL}/${cleanTicker}`);

            if (response.data && response.data.sentiment) {
                return response.data.sentiment.toUpperCase();
            }

            return 'NEUTRAL';
        } catch (error) {
            console.error(`Error fetching sentiment for ${cleanTicker}:`, error);
            return 'NEUTRAL';
        }
    }
};
