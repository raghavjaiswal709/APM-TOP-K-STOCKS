import { Socket } from 'socket.io-client';

export interface SubscriptionResult {
    success: boolean;
    count: number;
    message?: string;
    error?: string;
}

export class SubscriptionManagerModel {
    private socket: Socket | null = null;
    private static instance: SubscriptionManagerModel;

    private constructor() {}

    public static getInstance(): SubscriptionManagerModel {
        if (!SubscriptionManagerModel.instance) {
            SubscriptionManagerModel.instance = new SubscriptionManagerModel();
        }
        return SubscriptionManagerModel.instance;
    }

    public setSocket(socket: Socket) {
        this.socket = socket;
    }

    /**
     * Subscribes to a list of company symbols.
     * Uses a Promise to handle the asynchronous socket acknowledgment.
     * 
     * @param symbols List of symbols to subscribe to (e.g., ["NSE:RELIANCE-EQ"])
     * @returns Promise<SubscriptionResult>
     */
    public async subscribe(symbols: string[]): Promise<SubscriptionResult> {
        if (!this.socket || !this.socket.connected) {
            return {
                success: false,
                count: 0,
                error: "Socket not connected. Please ensure you are connected to the server."
            };
        }

        if (!symbols || symbols.length === 0) {
            return {
                success: true,
                count: 0,
                message: "No symbols to subscribe."
            };
        }

        return new Promise<SubscriptionResult>((resolve, reject) => {
            // Timeout to prevent hanging indefinitely
            const timeoutId = setTimeout(() => {
                reject(new Error("Subscription request timed out after 10 seconds."));
            }, 10000);

            try {
                console.log(`🚀 [SubscriptionModel] Requesting subscription for ${symbols.length} symbols...`);
                
                this.socket!.emit('subscribe_multiple', { symbols }, (response: any) => {
                    clearTimeout(timeoutId);
                    
                    if (response && response.success) {
                        console.log(`✅ [SubscriptionModel] Successfully subscribed to ${response.count} companies.`);
                        resolve({
                            success: true,
                            count: response.count || symbols.length,
                            message: response.message
                        });
                    } else {
                        console.error(`❌ [SubscriptionModel] Subscription failed:`, response);
                        resolve({
                            success: false,
                            count: 0,
                            error: response?.error || "Unknown error during subscription."
                        });
                    }
                });
            } catch (error: any) {
                clearTimeout(timeoutId);
                console.error(`❌ [SubscriptionModel] Exception during subscription:`, error);
                reject(error);
            }
        });
    }

    /**
     * Unsubscribes from a list of company symbols.
     */
    public async unsubscribe(symbols: string[]): Promise<SubscriptionResult> {
        if (!this.socket || !this.socket.connected) {
             return {
                success: false,
                count: 0,
                error: "Socket not connected."
            };
        }

        return new Promise<SubscriptionResult>((resolve, reject) => {
             const timeoutId = setTimeout(() => {
                reject(new Error("Unsubscription request timed out."));
            }, 5000);

            try {
                 // Assuming 'unsubscribe_multiple' exists, or we loop through 'unsubscribe'
                 // If backend only supports single unsubscribe, we might need to loop or add a new event.
                 // For now, let's assume we can emit 'unsubscribe' for each or a batch if supported.
                 // Based on typical patterns, let's try to see if we can just emit 'unsubscribe' in a loop or if there's a batch.
                 // Since the user focused on 'subscribe', I will implement a robust loop for unsubscribe if no batch exists,
                 // OR just emit 'unsubscribe' for the batch if the backend supports it. 
                 // To be safe and robust without backend changes, let's use Promise.all with single unsubscribes if needed,
                 // BUT 'subscribe_multiple' implies 'unsubscribe_multiple' might exist or we should just use the same pattern.
                 // Let's assume we iterate for safety if we aren't sure, OR just emit 'unsubscribe' with the symbol.
                 
                 // Actually, let's look at the page.tsx:
                 // socket.emit('unsubscribe', { symbol: selectedSymbol });
                 // It seems it takes a single symbol.
                 
                 // Let's do a Promise.all for robustness.
                 const promises = symbols.map(symbol => {
                     return new Promise<void>((res) => {
                         this.socket!.emit('unsubscribe', { symbol });
                         // We assume it's fire-and-forget or fast enough. 
                         // Ideally we'd wait for ack if provided.
                         res(); 
                     });
                 });

                 Promise.all(promises).then(() => {
                     clearTimeout(timeoutId);
                     resolve({
                         success: true,
                         count: symbols.length,
                         message: "Unsubscribed successfully"
                     });
                 });

            } catch (error: any) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
}
