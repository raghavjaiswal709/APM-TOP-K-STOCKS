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
    }> = [];  // ✅ Add request queue

    onModuleInit() {
        this.connectToPythonService();
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
                transports: ['websocket', 'polling'], // ✅ Fallback to polling if WebSocket fails
                forceNew: false,  // ✅ Reuse existing connection
            });

            this.socket.on('connect', () => {
                this.logger.log(`✅ Connected to Python Service`);
                this.reconnectAttempts = 0;
                this.isConnecting = false;

                // ✅ Process queued requests
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

                // ✅ Reject pending requests after max attempts
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
            // ✅ Input validation
            if (!symbols || symbols.length === 0) {
                reject(new Error('Symbols array is empty'));
                return;
            }

            // ✅ Check socket initialization
            if (!this.socket) {
                this.logger.error('Socket not initialized, attempting to connect...');
                this.pendingRequests.push({ symbols, resolve, reject });
                this.connectToPythonService();
                return;
            }

            // ✅ Handle disconnected state with queuing
            if (!this.socket.connected) {
                this.logger.warn('Socket not connected, queuing request...');
                this.pendingRequests.push({ symbols, resolve, reject });

                if (!this.isConnecting) {
                    this.socket.connect();
                }
                return;
            }

            // ✅ Socket is connected, proceed immediately
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
            // ✅ Emit with acknowledgement callback
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
}
