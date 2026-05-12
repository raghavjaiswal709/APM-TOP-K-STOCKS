
import { io, Socket } from 'socket.io-client';

// ─── Socket URL ───────────────────────────────────────────────────────────────
// Derived at RUNTIME from window.location.hostname so the socket always
// connects back to the same host the page was loaded from.
//   http://localhost:3000       → ws://localhost:5001       (local dev)
//   http://100.93.172.21:3000  → ws://100.93.172.21:5001   (server access)
// This avoids baked-in IPs in the JS bundle and works without any env var.
// Set NEXT_PUBLIC_FYERS_SOCKET_URL only when the socket runs on a DIFFERENT
// host than the frontend (rare, cross-host deployments).
// ─────────────────────────────────────────────────────────────────────────────
const SOCKET_URL = (() => {
  // Client-side: always resolve to the host the page was served from.
  // This runs in the browser at request time, so it correctly picks up
  // localhost, Tailscale IP, or any other hostname without any build-time
  // configuration.
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }
  // SSR fallback (sockets aren't used server-side, but satisfy module init).
  return process.env.NEXT_PUBLIC_FYERS_SOCKET_URL || 'http://localhost:5001';
})();

// Track which URL is in use (exported for display in UI)
let _activeSocketUrl: string = SOCKET_URL;

export const getActiveSocketUrl = (): string => _activeSocketUrl;

/** Returns 'server' | 'localhost' label for the tooltip */
export const getSocketSourceLabel = (): 'server' | 'localhost' =>
  (_activeSocketUrl.includes('localhost') || _activeSocketUrl.includes('127.0.0.1'))
    ? 'localhost'
    : 'server';

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 10000;

// Reconnection callbacks
const reconnectionCallbacks: Set<() => void> = new Set();

export const onReconnect = (callback: () => void): (() => void) => {
  reconnectionCallbacks.add(callback);
  return () => reconnectionCallbacks.delete(callback);
};

// ─── Source-change callbacks ─────────────────────────────────────────────────
// Notified whenever the active URL (primary ↔ fallback) changes, so the UI
// can update its tooltip without needing to poll.
const sourceChangeCallbacks: Set<(label: 'server' | 'localhost') => void> = new Set();

export const onSocketSourceChange = (
  callback: (label: 'server' | 'localhost') => void
): (() => void) => {
  sourceChangeCallbacks.add(callback);
  return () => sourceChangeCallbacks.delete(callback);
};

function notifySourceChange(label: 'server' | 'localhost') {
  sourceChangeCallbacks.forEach(cb => {
    try { cb(label); } catch { /* ignore */ }
  });
}

// ─── Core socket factory ─────────────────────────────────────────────────────

function attachBaseListeners(s: Socket) {
  s.on('connect', () => {
    console.log(`✅ Connected to ${_activeSocketUrl} (ID: ${s.id})`);
    reconnectAttempts = 0;
    reconnectionCallbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error('❌ reconnect callback error:', e); }
    });
  });

  s.on('connect_error', (error) => {
    reconnectAttempts++;
    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    console.error(`❌ Socket error (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}):`, error.message, `— retry in ${delay}ms`);
  });

  s.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected from ${_activeSocketUrl}. Reason: ${reason}`);
    if (reason === 'io server disconnect') s.connect();
  });

  s.on('error', (error) => {
    const msg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.warn(`⚠️ Socket error (will auto-reconnect): ${msg || 'unknown'}`);
  });

  s.on('reconnect',         n   => console.log(`✅ Reconnected after ${n} attempts`));
  s.on('reconnect_attempt', n   => console.log(`🔄 Reconnect attempt ${n}/${MAX_RECONNECT_ATTEMPTS}...`));
  s.on('reconnect_error',   err => console.error('❌ Reconnect error:', err.message));
  s.on('reconnect_failed',  ()  => console.error('❌ Max reconnect attempts reached — please refresh'));
  s.on('heartbeat',         d   => console.log('💓 Heartbeat:', d));
}

const SOCKET_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay: INITIAL_RECONNECT_DELAY,
  reconnectionDelayMax: MAX_RECONNECT_DELAY,
  timeout: 20000,
  transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
  autoConnect: true,
};

/**
 * Synchronous accessor — returns the singleton socket, creating it on first call.
 * The URL is read from NEXT_PUBLIC_FYERS_SOCKET_URL (set in docker-compose.yml).
 */
export const getSocket = (): Socket => {
  if (socket) return socket;

  _activeSocketUrl = SOCKET_URL;
  notifySourceChange(getSocketSourceLabel());

  console.log(`🔌 Connecting socket to ${SOCKET_URL}`);
  socket = io(SOCKET_URL, SOCKET_OPTIONS);
  attachBaseListeners(socket);
  return socket;
};

/**
 * Async version — resolves immediately with the singleton socket.
 * Kept for backward compatibility with callers that use await.
 */
export const getSocketAsync = (): Promise<Socket> => Promise.resolve(getSocket());

export const isSocketConnected = (): boolean => socket?.connected || false;

export const reconnectSocket = (): void => {
  if (socket) {
    console.log('🔄 Forcing socket reconnection...');
    socket.disconnect();
    socket.connect();
  }
};

export const disconnectSocket = (): void => {
  if (socket) {
    console.log('🔌 Manually disconnecting socket');
    reconnectionCallbacks.clear();
    sourceChangeCallbacks.clear();
    socket.disconnect();
    socket = null;
  }
};

