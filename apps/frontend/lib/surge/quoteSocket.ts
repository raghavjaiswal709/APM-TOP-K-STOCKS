'use client';

import { io, type Socket } from 'socket.io-client';

/**
 * Live prices for the Surge view, from this repo's Fyers live-market socket
 * service (`apps/backend/fyers_service_5010.py`).
 *
 * One socket per browser tab, shared by every watchlist on the page. The
 * service keeps subscriptions per socket and `subscribe_companies` REPLACES
 * that socket's set, so this module refcounts what each watchlist asks for
 * and always sends the union. Its subscriptions are its own: the Live Market
 * page's socket is a different client and is never touched.
 */

export interface SurgeQuote {
  ltp: number;
  changePercent: number;
  /** UNIX ms of the tick. */
  timestamp: number;
}

export type QuoteFeedStatus = 'idle' | 'connecting' | 'connected' | 'offline';

/**
 * Same resolution as `useLiveMarket`: the service on port 5010 of whatever
 * host served the page, unless `NEXT_PUBLIC_SURGE_QUOTE_SOCKET_URL` points
 * somewhere else.
 */
function socketUrl(): string {
  const override = process.env.NEXT_PUBLIC_SURGE_QUOTE_SOCKET_URL;
  if (override) return override;
  return `${window.location.protocol}//${window.location.hostname}:5010`;
}

/** Re-subscribe at most this often while watchlists churn their symbol sets. */
const SUBSCRIBE_DEBOUNCE_MS = 750;
/** Ticks are batched into one listener call per window, not one per tick. */
const NOTIFY_INTERVAL_MS = 500;
/** The service caps a socket at 500 companies. */
const MAX_CODES = 500;

type Listener = () => void;

let socket: Socket | null = null;
let status: QuoteFeedStatus = 'idle';
const quotes = new Map<string, SurgeQuote>();
let snapshot: Record<string, SurgeQuote> = {};
const demand = new Map<string, number>();
const listeners = new Set<Listener>();
let subscribeTimer: ReturnType<typeof setTimeout> | null = null;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let lastSent = '';

function codeOf(symbol: string): string {
  return symbol.replace(/^[A-Z]+:/i, '').replace(/-(EQ|BE|INDEX)$/i, '').toUpperCase();
}

function notify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    snapshot = Object.fromEntries(quotes);
    for (const listener of listeners) listener();
  }, NOTIFY_INTERVAL_MS);
}

function setStatus(next: QuoteFeedStatus) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}

function sendSubscription(force = false) {
  if (!socket?.connected) return;
  const codes = [...demand.keys()].sort().slice(0, MAX_CODES);
  const key = codes.join(',');
  if (!force && key === lastSent) return;
  lastSent = key;
  if (codes.length) socket.emit('subscribe_companies', { companyCodes: codes });
  else socket.emit('unsubscribe_all', {});
}

function scheduleSubscription() {
  if (subscribeTimer) clearTimeout(subscribeTimer);
  subscribeTimer = setTimeout(() => {
    subscribeTimer = null;
    sendSubscription();
  }, SUBSCRIBE_DEBOUNCE_MS);
}

function ensureSocket() {
  if (socket || typeof window === 'undefined') return;
  setStatus('connecting');
  socket = io(socketUrl(), {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2_000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
  });
  socket.on('connect', () => {
    setStatus('connected');
    // A reconnect is a new server-side client with no subscriptions.
    sendSubscription(true);
  });
  socket.on('disconnect', () => setStatus('offline'));
  socket.on('connect_error', () => setStatus('offline'));
  socket.on('marketData', (data: { symbol?: string; ltp?: number; changePercent?: number; timestamp?: number }) => {
    if (!data?.symbol || typeof data.ltp !== 'number' || !Number.isFinite(data.ltp) || data.ltp <= 0) return;
    quotes.set(codeOf(data.symbol), {
      ltp: data.ltp,
      changePercent: typeof data.changePercent === 'number' ? data.changePercent : 0,
      timestamp: data.timestamp ? (data.timestamp < 1e12 ? data.timestamp * 1000 : data.timestamp) : Date.now(),
    });
    notify();
  });
}

function teardownIfUnused() {
  if (listeners.size || demand.size || !socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  lastSent = '';
  setStatus('idle');
}

/** Ask for live prices on `codes`; returns the release function. */
export function requestQuotes(codes: string[]): () => void {
  const unique = [...new Set(codes.map(codeOf).filter(Boolean))];
  for (const code of unique) demand.set(code, (demand.get(code) ?? 0) + 1);
  ensureSocket();
  scheduleSubscription();
  return () => {
    for (const code of unique) {
      const next = (demand.get(code) ?? 1) - 1;
      if (next <= 0) demand.delete(code);
      else demand.set(code, next);
    }
    scheduleSubscription();
    setTimeout(teardownIfUnused, SUBSCRIBE_DEBOUNCE_MS * 2);
  };
}

export function subscribeQuoteStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    setTimeout(teardownIfUnused, SUBSCRIBE_DEBOUNCE_MS * 2);
  };
}

export function getQuoteSnapshot(): Record<string, SurgeQuote> {
  return snapshot;
}

export function getQuoteFeedStatus(): QuoteFeedStatus {
  return status;
}

const EMPTY: Record<string, SurgeQuote> = {};
export function getServerQuoteSnapshot(): Record<string, SurgeQuote> {
  return EMPTY;
}
