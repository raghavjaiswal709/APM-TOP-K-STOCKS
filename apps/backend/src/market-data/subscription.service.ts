import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

@Injectable()
export class SubscriptionService implements OnModuleInit, OnModuleDestroy {

    private readonly logger = new Logger(SubscriptionService.name);
    private socket: Socket;
    private readonly PYTHON_SERVICE_URL = 'http://localhost:5001';
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private isConnecting = false;
    private pendingRequests: Array<{
        symbols: string[];
        resolve: (value: any) => void;
        reject: (reason: any) => void;
    }> = [];

    // ✅ NEW: Track active subscriptions
    private activeSubscriptions: Set<string> = new Set();
    private lastSyncTime: number = 0;
    private readonly SYNC_INTERVAL = 30000; // Sync every 30 seconds

    onModuleInit() {
        this.connectToPythonService();
        this.startPeriodicSync();
    }

    onModuleDestroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    private connectToPythonService() {
        if (this.isConnecting) {
            this.logger.warn('Connection already in progress...');
            return;
        }

        this.isConnecting = true;

        try {
            this.socket = io(this.PYTHON_SERVICE_URL, {
                reconnection: true,
                reconnectionAttempts: this.MAX_RECONNECT_ATTEMPTS,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                transports: ['websocket', 'polling'],
                forceNew: false,
            });

            this.socket.on('connect', () => {
                this.logger.log(`✅ Connected to Python Service`);
                this.reconnectAttempts = 0;
                this.isConnecting = false;

                // Re-sync subscriptions after reconnect
                this.syncSubscriptionsWithPython();
                this.processPendingRequests();
            });

            this.socket.on('disconnect', (reason) => {
                this.logger.warn(`❌ Disconnected: ${reason}`);
                this.isConnecting = false;
            });

            this.socket.on('connect_error', (err) => {
                this.reconnectAttempts++;
                this.logger.error(`Connection error (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}): ${err.message}`);
                this.isConnecting = false;

                if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
                    this.rejectPendingRequests(new Error('Max reconnection attempts reached'));
                }
            });

            this.socket.on('error', (err) => {
                this.logger.error(`Socket error: ${err}`);
            });

        } catch (error) {
            this.logger.error(`Failed to initialize socket: ${error.message}`);
            this.isConnecting = false;
            this.rejectPendingRequests(error);
        }
    }

    // ✅ NEW: Periodic sync with Python service
    private startPeriodicSync() {
        setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.syncSubscriptionsWithPython();
            }
        }, this.SYNC_INTERVAL);
    }

    // ✅ NEW: Sync subscriptions with Python service
    private async syncSubscriptionsWithPython() {
        const now = Date.now();
        if (now - this.lastSyncTime < 5000) {
            return; // Prevent sync spam
        }

        this.lastSyncTime = now;

        try {
            this.socket.emit('get_active_subscriptions', {}, (response: any) => {
                if (response && response.success && Array.isArray(response.symbols)) {
                    this.activeSubscriptions = new Set(response.symbols);
                    this.logger.log(`✅ Synced ${this.activeSubscriptions.size} active subscriptions`);
                }
            });
        } catch (error) {
            this.logger.error(`Failed to sync subscriptions: ${error.message}`);
        }
    }

    private processPendingRequests() {
        this.logger.log(`Processing ${this.pendingRequests.length} pending requests`);

        while (this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            if (request) {
                this.performSubscription(request.symbols, request.resolve, request.reject);
            }
        }
    }

    private rejectPendingRequests(error: Error) {
        this.logger.error(`Rejecting ${this.pendingRequests.length} pending requests`);

        while (this.pendingRequests.length > 0) {
            const request = this.pendingRequests.shift();
            if (request) {
                request.reject(error);
            }
        }
    }

    async subscribeToSymbols(symbols: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!symbols || symbols.length === 0) {
                reject(new Error('Symbols array is empty'));
                return;
            }

            if (!this.socket) {
                this.logger.error('Socket not initialized, attempting to connect...');
                this.pendingRequests.push({ symbols, resolve, reject });
                this.connectToPythonService();
                return;
            }

            if (!this.socket.connected) {
                this.logger.warn('Socket not connected, queuing request...');
                this.pendingRequests.push({ symbols, resolve, reject });

                if (!this.isConnecting) {
                    this.socket.connect();
                }
                return;
            }

            this.performSubscription(symbols, resolve, reject);
        });
    }

    private performSubscription(
        symbols: string[],
        resolve: (value: any) => void,
        reject: (reason: any) => void
    ) {
        this.logger.log(`📤 Emitting subscribe_companies for ${symbols.length} symbols`);

        const timeout = setTimeout(() => {
            this.logger.error('⏱️ Subscription timed out after 60s');
            reject(new Error('Timeout waiting for subscription confirmation'));
        }, 60000);

        try {
            this.socket.emit(
                'subscribe_companies',
                { symbols },
                (response: any) => {
                    clearTimeout(timeout);

                    if (!response) {
                        this.logger.error('❌ No response from Python service');
                        reject(new Error('No response from Python service'));
                        return;
                    }

                    this.logger.log(`📨 Response: ${JSON.stringify(response).substring(0, 200)}`);

                    if (response.success) {
                        // Update local tracking
                        symbols.forEach(symbol => this.activeSubscriptions.add(symbol));
                        this.logger.log(`✅ Subscribed to ${response.count || symbols.length} symbols`);
                        resolve(response);
                    } else {
                        this.logger.error(`❌ Subscription failed: ${response.error}`);
                        reject(new Error(response.error || 'Subscription failed'));
                    }
                }
            );
        } catch (error) {
            clearTimeout(timeout);
            this.logger.error(`❌ Error emitting: ${error.message}`);
            reject(error);
        }
    }

    // ✅ NEW: Get current subscriptions
    async getCurrentSubscriptions(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.socket.connected) {
                // Return cached subscriptions if socket is down
                this.logger.warn('Socket not connected, returning cached subscriptions');
                resolve(Array.from(this.activeSubscriptions));
                return;
            }

            const timeout = setTimeout(() => {
                this.logger.warn('⏱️ Get subscriptions timed out, returning cached');
                resolve(Array.from(this.activeSubscriptions));
            }, 5000);

            try {
                this.socket.emit('get_active_subscriptions', {}, (response: any) => {
                    clearTimeout(timeout);

                    if (response && response.success && Array.isArray(response.symbols)) {
                        this.activeSubscriptions = new Set(response.symbols);
                        resolve(response.symbols);
                    } else {
                        resolve(Array.from(this.activeSubscriptions));
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                this.logger.error(`Error getting subscriptions: ${error.message}`);
                resolve(Array.from(this.activeSubscriptions));
            }
        });
    }
}
