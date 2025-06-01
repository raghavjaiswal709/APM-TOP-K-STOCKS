
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export const getSocket = (): Socket => {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5001';
    console.log(`Connecting to WebSocket server at ${SOCKET_URL}`);
    
    socket = io(SOCKET_URL, {
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: 1000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
      console.log(`Connected to WebSocket server with ID: ${socket?.id}`);
      reconnectAttempts = 0;
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      reconnectAttempts++;
    });
    
    socket.on('disconnect', (reason) => {
      console.log(`Disconnected from WebSocket server. Reason: ${reason}`);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    socket.on('heartbeat', (data) => {
      console.log('Heartbeat received:', data);
    });
  }
  
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    console.log('Manually disconnecting socket');
    socket.disconnect();
    socket = null;
  }
};
