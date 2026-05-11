
import { io, Socket } from 'socket.io-client';

// ─── Server priority ─────────────────────────────────────────────────────────
// 1. Primary  → remote server  http://100.93.172.21:5001
// 2. Fallback → local machine  http://localhost:5001
// ─────────────────────────────────────────────────────────────────────────────
const PRIMARY_URL  = 'http://100.93.172.21:5001';
const FALLBACK_URL = 'http://localhost:5001';

// Track which URL is actually in use (exported for display in UI)
let _activeSocketUrl: string = PRIMARY_URL;

export const getActiveSocketUrl = (): string => _activeSocketUrl;

/** Returns 'server' | 'localhost' label for the tooltip */
export const getSocketSourceLabel = (): 'server' | 'localhost' =>
  _activeSocketUrl === PRIMARY_URL ? 'server' : 'localhost';

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
 * Probe PRIMARY_URL with a short-lived socket.
 * Resolves true if it connects within 4 s, false otherwise.
 */
function probePrimary(): Promise<boolean> {
  return new Promise(resolve => {
    const probe = io(PRIMARY_URL, {
      ...SOCKET_OPTIONS,
      reconnection: false,
      timeout: 4000,
      autoConnect: true,
    });
    let settled = false;

    const done = (result: boolean) => {
      if (settled) return;
      settled = true;
      probe.removeAllListeners();
      probe.disconnect();
      resolve(result);
    };

    probe.once('connect',       () => done(true));
    probe.once('connect_error', () => done(false));

    // Safety-net timer (slightly longer than socket timeout)
    setTimeout(() => done(false), 5000);
  });
}

/**
 * Create the persistent socket, choosing PRIMARY_URL when reachable,
 * otherwise FALLBACK_URL.
 */
async function createSocket(): Promise<Socket> {
  const primaryAvailable = await probePrimary();
  _activeSocketUrl = primaryAvailable ? PRIMARY_URL : FALLBACK_URL;

  console.log(
    primaryAvailable
      ? `🌐 Primary server reachable — connecting to ${PRIMARY_URL}`
      : `⚠️ Primary server unreachable — falling back to ${FALLBACK_URL}`
  );

  notifySourceChange(getSocketSourceLabel());

  const s = io(_activeSocketUrl, SOCKET_OPTIONS);
  attachBaseListeners(s);
  return s;
}

// Lazily initialised — holds the promise so concurrent callers share one probe
let _socketPromise: Promise<Socket> | null = null;

/**
 * Async version: resolves once the socket has been created (after the probe).
 */
export const getSocketAsync = (): Promise<Socket> => {
  if (!_socketPromise) {
    _socketPromise = createSocket().then(s => {
      socket = s;
      return s;
    });
  }
  return _socketPromise;
};

/**
 * Synchronous accessor — returns the socket immediately.
 * On first call it kicks off an async probe in the background and returns a
 * temporary socket to PRIMARY_URL.  Once the probe finishes the caller's
 * event listeners will be migrated automatically.
 *
 * Prefer getSocketAsync() in React effects where you can await.
 */
export const getSocket = (): Socket => {
  if (socket) return socket;

  // Return a placeholder to PRIMARY_URL immediately so callers can attach
  // listeners right away.  We'll replace it once the probe settles.
  const placeholder = io(PRIMARY_URL, { ...SOCKET_OPTIONS, autoConnect: false });
  socket = placeholder;
  _activeSocketUrl = PRIMARY_URL;

  // Kick off the real probe; swap socket when done
  (async () => {
    const real = await getSocketAsync();
    if (real === placeholder) return; // already the same socket (primary worked)

    // Migrate: clone all listeners from placeholder → real socket
    const events = ['connect', 'disconnect', 'error', 'subscriptionError',
                    'fyersError', 'marketDataUpdate', 'chartUpdate',
                    'historicalData', 'ohlcData', 'ohlc', 'heartbeat',
                    'authStatus', 'fyersConnected', 'fyersDisconnected',
                    'subscriptionConfirm', 'afterMarketDataLoaded',
                    'reconnect', 'reconnect_attempt', 'reconnect_error',
                    'reconnect_failed'];

    for (const event of events) {
      // @ts-ignore – accessing internal listeners map
      const listeners = placeholder.listeners(event) as ((...args: any[]) => void)[];
      for (const fn of listeners) {
        real.on(event as any, fn);
      }
    }

    placeholder.removeAllListeners();
    placeholder.disconnect();
    socket = real;
  })();

  return socket;
};

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
    _socketPromise = null;
  }
};

