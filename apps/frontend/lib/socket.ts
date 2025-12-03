
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5 to 10
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

// 🔄 Reconnection callbacks registry
const reconnectionCallbacks: Set<() => void> = new Set();

/**
 * Register a callback to be executed when socket reconnects
 * This allows components to re-subscribe or re-initialize after reconnection
 */
export const onReconnect = (callback: () => void): (() => void) => {
  reconnectionCallbacks.add(callback);
  // Return unsubscribe function
  return () => reconnectionCallbacks.delete(callback);
};

/**
 * Get or create socket instance with professional reconnection handling
 */
export const getSocket = (): Socket => {
  if (!socket) {
    // ✅ STRICTLY ENFORCE PORT 5001 for Fyers Service
    // 
    const SOCKET_URL = `${process.env.NEXT_PUBLIC_FYERS_SOCKET_URL || 'http://100.93.172.21:5001'}`;
    console.log(`🔌 Connecting to WebSocket server at ${SOCKET_URL}`);
    
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: INITIAL_RECONNECT_DELAY,
      reconnectionDelayMax: MAX_RECONNECT_DELAY,
      timeout: 20000, // Increased from 10s to 20s
      transports: ['websocket', 'polling'],
      // Enable automatic reconnection on network issues
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log(`✅ Connected to WebSocket server with ID: ${socket?.id}`);
      reconnectAttempts = 0;
      
      // 🔄 Execute all reconnection callbacks
      console.log(`🔄 Executing ${reconnectionCallbacks.size} reconnection callbacks...`);
      reconnectionCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('❌ Error in reconnection callback:', error);
        }
      });
    });

    socket.on('connect_error', (error) => {
      reconnectAttempts++;
      const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
      console.error(`❌ Socket connection error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error.message);
      console.log(`⏳ Next retry in ${delay}ms...`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected from WebSocket server. Reason: ${reason}`);
      
      // Auto-reconnect for all reasons except manual disconnect
      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnected, attempting to reconnect...');
        socket?.connect();
      } else if (reason === 'io client disconnect') {
        console.log('ℹ️ Client disconnected manually');
      } else {
        console.log('🔄 Connection lost, automatic reconnection will attempt...');
      }
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected successfully after ${attemptNumber} attempts`);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}/${MAX_RECONNECT_ATTEMPTS}...`);
    });

    socket.on('reconnect_error', (error) => {
      console.error('❌ Reconnection error:', error.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect after maximum attempts');
      console.log('💡 Please refresh the page to reconnect');
    });

    socket.on('heartbeat', (data) => {
      console.log('💓 Heartbeat received:', data);
    });
  }
  
  return socket;
};

/**
 * Force reconnect the socket
 */
export const reconnectSocket = (): void => {
  if (socket) {
    console.log('🔄 Forcing socket reconnection...');
    socket.disconnect();
    socket.connect();
  }
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = (): boolean => {
  return socket?.connected || false;
};

/**
 * Disconnect and cleanup socket
 */
export const disconnectSocket = (): void => {
  if (socket) {
    console.log('🔌 Manually disconnecting socket');
    reconnectionCallbacks.clear();
    socket.disconnect();
    socket = null;
  }
};

