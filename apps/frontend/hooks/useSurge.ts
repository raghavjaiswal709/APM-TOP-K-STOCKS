'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import {
  DEFAULT_SURGE_FILTERS,
  activeFilterCount,
  companyCodeOf,
  istDayKey,
  matchesFilters,
  matchesSymbolSearch,
  sanitizeFilters,
  type SurgeFilters,
} from '@/lib/surge/filters';
import type { ScreenedCompany, SurgeSignal, SurgeSnapshot } from '@/lib/surge/types';
import {
  getQuoteFeedStatus,
  getQuoteSnapshot,
  getServerQuoteSnapshot,
  requestQuotes,
  subscribeQuoteStore,
  type QuoteFeedStatus,
  type SurgeQuote,
} from '@/lib/surge/quoteSocket';

/*
 * The Surge view shared by every watchlist — a port of the trading
 * dashboard's WatchlistPanel surge logic (`watchlist-panel.tsx`).
 *
 * Preferences (the toggle, filters and pins) are ONE set per browser, shared
 * by every watchlist on every page and kept in sync across components and
 * tabs. The toggle defaults to off, so a watchlist behaves exactly as before
 * until someone turns Surge on.
 */

// ── shared preferences ────────────────────────────────────────────────────

const VIEW_KEY = 'surge:watchlist-view';
const FILTERS_KEY = 'surge:watchlist-filters';
const PINS_KEY = 'surge:watchlist-pins';

interface SurgePrefs {
  enabled: boolean;
  filters: SurgeFilters;
  pins: string[];
}

const DEFAULT_PREFS: SurgePrefs = { enabled: false, filters: DEFAULT_SURGE_FILTERS, pins: [] };

let prefs: SurgePrefs = DEFAULT_PREFS;
let prefsLoaded = false;
const prefListeners = new Set<() => void>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // Storage unavailable — defaults hold.
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the choice still holds until reload.
  }
}

function loadPrefs(): SurgePrefs {
  let filters = DEFAULT_SURGE_FILTERS;
  let pins: string[] = [];
  try {
    filters = sanitizeFilters(JSON.parse(readStorage(FILTERS_KEY) ?? 'null'));
  } catch {
    // Corrupt — fall back to "any".
  }
  try {
    const parsed: unknown = JSON.parse(readStorage(PINS_KEY) ?? '[]');
    if (Array.isArray(parsed)) {
      pins = [...new Set(parsed.filter((entry): entry is string => typeof entry === 'string').map(companyCodeOf))];
    }
  } catch {
    // Corrupt — no pins.
  }
  return { enabled: readStorage(VIEW_KEY) === 'on', filters, pins };
}

function subscribePrefs(listener: () => void) {
  if (!prefsLoaded && typeof window !== 'undefined') {
    prefsLoaded = true;
    prefs = loadPrefs();
    // Another tab changed a preference.
    window.addEventListener('storage', (event) => {
      if (event.key === VIEW_KEY || event.key === FILTERS_KEY || event.key === PINS_KEY) {
        prefs = loadPrefs();
        for (const l of prefListeners) l();
      }
    });
  }
  prefListeners.add(listener);
  // Prefs were loaded after the first (default) render — catch up.
  queueMicrotask(listener);
  return () => prefListeners.delete(listener);
}

function setPrefs(patch: Partial<SurgePrefs>) {
  prefs = { ...prefs, ...patch };
  if (patch.enabled !== undefined) writeStorage(VIEW_KEY, patch.enabled ? 'on' : 'off');
  if (patch.filters) writeStorage(FILTERS_KEY, JSON.stringify(patch.filters));
  if (patch.pins) writeStorage(PINS_KEY, JSON.stringify(patch.pins));
  for (const listener of prefListeners) listener();
}

export function useSurgePrefs() {
  const current = useSyncExternalStore(subscribePrefs, () => prefs, () => DEFAULT_PREFS);
  const setEnabled = useCallback((enabled: boolean) => setPrefs({ enabled }), []);
  const setFilters = useCallback((filters: SurgeFilters) => setPrefs({ filters }), []);
  const resetFilters = useCallback(() => setPrefs({ filters: DEFAULT_SURGE_FILTERS }), []);
  const togglePin = useCallback((code: string) => {
    const key = companyCodeOf(code);
    setPrefs({ pins: prefs.pins.includes(key) ? prefs.pins.filter((p) => p !== key) : [...prefs.pins, key] });
  }, []);
  return { ...current, setEnabled, setFilters, resetFilters, togglePin };
}

export type SurgeFilterState = Pick<ReturnType<typeof useSurgePrefs>, 'filters' | 'setFilters' | 'resetFilters'>;

// ── data ──────────────────────────────────────────────────────────────────

/**
 * The dashboard's poller re-reads `/surges` every 30s and its watchlist
 * refreshes the screen every 60s; one combined request every 30s covers both.
 */
const SNAPSHOT_REFRESH_MS = 30_000;

async function snapshotFetcher(url: string): Promise<SurgeSnapshot> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = (await response.json().catch(() => null)) as SurgeSnapshot | { error?: string } | null;
  if (body && 'signals' in body) return body; // a 502 still carries both error fields
  throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${response.status}`);
}

/** Nothing is fetched while `enabled` is false. */
export function useSurgeSnapshot(enabled: boolean) {
  return useSWR<SurgeSnapshot>(enabled ? '/api/surge' : null, snapshotFetcher, {
    refreshInterval: SNAPSHOT_REFRESH_MS,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

/** Live prices for `codes` while `enabled`, keyed by company code. */
export function useSurgeQuotes(codes: string[], enabled: boolean): {
  quotes: Record<string, SurgeQuote>;
  status: QuoteFeedStatus;
} {
  const key = enabled ? [...new Set(codes)].sort().join(',') : '';
  useEffect(() => {
    if (!key) return;
    return requestQuotes(key.split(','));
  }, [key]);
  const quotes = useSyncExternalStore(subscribeQuoteStore, getQuoteSnapshot, getServerQuoteSnapshot);
  const status = useSyncExternalStore(subscribeQuoteStore, getQuoteFeedStatus, () => 'idle' as QuoteFeedStatus);
  return { quotes, status };
}

// ── ordering ──────────────────────────────────────────────────────────────

/**
 * Live quotes tick several times a second; re-sorting on every tick would
 * make two close names swap back and forth and move rows out from under the
 * cursor mid-click. The order is re-committed at most this often.
 */
const REORDER_INTERVAL_MS = 2_000;
const SLIDE_DURATION_MS = 450;

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * A copy of `desired` that only catches up every REORDER_INTERVAL_MS. A
 * change in membership (a brand-new surge, or a name dropping off) is
 * committed immediately.
 */
export function useThrottledOrder(desired: string[]): string[] {
  const [committed, setCommitted] = useState<string[]>(desired);
  const lastCommitRef = useRef(0);
  const desiredKey = desired.join(',');

  useEffect(() => {
    if (sameOrder(desired, committed)) return;
    const membershipChanged =
      desired.length !== committed.length || desired.some((key) => !committed.includes(key));
    const wait = membershipChanged ? 0 : Math.max(0, lastCommitRef.current + REORDER_INTERVAL_MS - Date.now());
    const timer = setTimeout(() => {
      lastCommitRef.current = Date.now();
      setCommitted(desired);
    }, wait);
    return () => clearTimeout(timer);
    // `desiredKey` stands in for `desired`, whose identity changes every render.
  }, [desiredKey, committed]);

  return committed;
}

/**
 * While `hold` is true (the pointer is over the list) rows keep the order
 * they had when it arrived, so the row under the cursor is the row that gets
 * clicked. Rows that went away still drop out; new ones join at the end.
 */
export function useHeldOrder(current: string[], hold: boolean): string[] {
  const heldRef = useRef<string[]>(current);
  if (!hold) {
    heldRef.current = current;
  } else {
    const present = new Set(current);
    const kept = heldRef.current.filter((code) => present.has(code));
    const keptSet = new Set(kept);
    const added = current.filter((code) => !keptSet.has(code));
    if (added.length || kept.length !== heldRef.current.length) heldRef.current = [...kept, ...added];
  }
  return heldRef.current;
}

/**
 * FLIP slide for re-ordered rows: each `[data-flip-key]` child is measured
 * after commit, translated back to where it was, and animated to its new
 * spot. Surging rows (`data-flip-rank`) that climbed flash green, ones that
 * fell flash red.
 */
export function useFlipAnimation(containerRef: React.RefObject<HTMLElement | null>, layoutKey: string, enabled: boolean) {
  const positionsRef = useRef(new Map<string, number>());
  const ranksRef = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      positionsRef.current = new Map();
      ranksRef.current = new Map();
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFirstLayout = positionsRef.current.size === 0;
    const nextPositions = new Map<string, number>();
    const nextRanks = new Map<string, number>();

    for (const element of container.querySelectorAll<HTMLElement>('[data-flip-key]')) {
      const key = element.dataset.flipKey!;
      const top = element.offsetTop;
      nextPositions.set(key, top);

      const rankAttr = element.dataset.flipRank;
      const rank = rankAttr === undefined ? undefined : Number(rankAttr);
      if (rank !== undefined) nextRanks.set(key, rank);

      if (isFirstLayout || reduceMotion) continue;

      const previousTop = positionsRef.current.get(key);
      if (previousTop !== undefined && previousTop !== top) {
        element.animate(
          [{ transform: `translateY(${previousTop - top}px)` }, { transform: 'translateY(0)' }],
          { duration: SLIDE_DURATION_MS, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      }

      const previousRank = ranksRef.current.get(key);
      if (rank !== undefined && previousRank !== undefined && previousRank !== rank) {
        const flash = rank < previousRank ? 'surge-flash-up' : 'surge-flash-down';
        element.classList.remove('surge-flash-up', 'surge-flash-down');
        void element.offsetWidth; // restart the animation
        element.classList.add(flash);
      }
    }

    positionsRef.current = nextPositions;
    ranksRef.current = nextRanks;
  }, [containerRef, layoutKey, enabled]);
}

// ── the composed view ─────────────────────────────────────────────────────

export interface SurgeEntry {
  /** The most recent surge for this company today — the one the row describes. */
  latest: SurgeSignal;
  /** How many distinct surges fired on this company today. */
  count: number;
}

/** % move from the surge's reference price to the live price. */
export function moveSinceSurge(entry: SurgeEntry, quote: SurgeQuote | undefined): number | null {
  const reference = entry.latest.price;
  if (!quote || !Number.isFinite(quote.ltp) || !(reference > 0)) return null;
  return ((quote.ltp - reference) / reference) * 100;
}

export interface SurgeWatchlistView {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  filterState: SurgeFilterState;
  filtersActive: boolean;
  snapshot: SurgeSnapshot | undefined;
  loading: boolean;
  fetchError: string | null;
  quotes: Record<string, SurgeQuote>;
  quoteStatus: QuoteFeedStatus;
  /** Every surge today that passed the filters, grouped per company. */
  surgeByCode: Map<string, SurgeEntry>;
  targetByCode: Map<string, number | null>;
  screenedByCode: Map<string, ScreenedCompany>;
  pins: string[];
  pinnedSet: Set<string>;
  togglePin: (code: string) => void;
  /** Pinned codes, search applied — a surge filter never hides a pin. */
  pinnedCodes: string[];
  /** The surging block, best move since surge first; throttled and held on hover. */
  surgeOrder: string[];
  surgingSet: Set<string>;
  /** Search plus "while a surge filter is set, only names that surged". */
  isVisible: (code: string) => boolean;
  hovering: boolean;
  /** Spread onto the scrolling list element. */
  listHandlers: {
    onPointerEnter: (event: React.PointerEvent) => void;
    onPointerLeave: () => void;
  };
}

/**
 * Everything a watchlist needs to render its Surge view.
 *
 * `searchTerms` is the watchlist's search (`parseSearchTerms`). Quotes are requested only for surging and pinned
 * names — the ones that show a price.
 */
export function useSurgeWatchlist(searchTerms: string[]): SurgeWatchlistView {
  const { enabled, setEnabled, filters, setFilters, resetFilters, pins, togglePin } = useSurgePrefs();
  const { data: snapshot, isLoading, error } = useSurgeSnapshot(enabled);
  const [hovering, setHovering] = useState(false);

  // Only the snapshot's own trading day counts.
  const tradingDate = snapshot?.date ?? istDayKey(Math.floor(Date.now() / 1000));
  const todaySignals = useMemo(
    () => (snapshot?.signals ?? []).filter((signal) => istDayKey(signal.detectedAt) === tradingDate),
    [snapshot, tradingDate],
  );

  // Filters apply per surge, before grouping, so a row's latest surge and its
  // count are both ones that passed them.
  const surgeByCode = useMemo(() => {
    const map = new Map<string, SurgeEntry>();
    for (const signal of todaySignals) {
      if (!matchesFilters(signal, filters)) continue;
      const existing = map.get(signal.companyCode);
      if (!existing) map.set(signal.companyCode, { latest: signal, count: 1 });
      else
        map.set(signal.companyCode, {
          latest: signal.detectedAt >= existing.latest.detectedAt ? signal : existing.latest,
          count: existing.count + 1,
        });
    }
    return map;
  }, [todaySignals, filters]);

  const screenedByCode = useMemo(
    () => new Map((snapshot?.screened ?? []).map((row) => [row.companyCode, row])),
    [snapshot],
  );
  const targetByCode = useMemo(
    () => new Map((snapshot?.screened ?? []).map((row) => [row.companyCode, row.targetMovePct])),
    [snapshot],
  );

  // Quotes stay subscribed for every surging name, filtered out or not, so
  // changing a filter doesn't churn the feed's subscriptions.
  const quoteCodes = useMemo(
    () => [...new Set([...todaySignals.map((signal) => signal.companyCode), ...pins])],
    [todaySignals, pins],
  );
  const { quotes, status: quoteStatus } = useSurgeQuotes(quoteCodes, enabled);

  // Best move since its surge first. Names without a live quote yet can't be
  // ranked, so they trail the ranked ones, newest surge first.
  const desiredSurgeOrder = [...surgeByCode.entries()]
    .map(([code, entry]) => ({ code, entry, move: moveSinceSurge(entry, quotes[code]) }))
    .sort((a, b) => {
      if (a.move !== null && b.move !== null) return b.move - a.move;
      if (a.move !== null) return -1;
      if (b.move !== null) return 1;
      return b.entry.latest.detectedAt - a.entry.latest.detectedAt;
    })
    .map((row) => row.code);
  const throttledSurgeOrder = useThrottledOrder(enabled ? desiredSurgeOrder : []);

  const pinnedSet = useMemo(() => new Set(pins), [pins]);
  const pinnedCodes = pins.filter((code) => matchesSymbolSearch(code, searchTerms));

  const surgeOrder = useHeldOrder(
    enabled
      ? throttledSurgeOrder.filter(
          (code) => surgeByCode.has(code) && !pinnedSet.has(code) && matchesSymbolSearch(code, searchTerms),
        )
      : [],
    hovering,
  );
  const surgingSet = useMemo(() => new Set(surgeOrder), [surgeOrder]);

  const filtersActive = activeFilterCount(filters) > 0;
  const isVisible = useCallback(
    (code: string) => matchesSymbolSearch(code, searchTerms) && (!filtersActive || surgeByCode.has(code)),
    [searchTerms, filtersActive, surgeByCode],
  );

  return {
    enabled,
    setEnabled,
    filterState: { filters, setFilters, resetFilters },
    filtersActive,
    snapshot,
    loading: enabled && isLoading && !snapshot,
    fetchError: error ? (error as Error).message : null,
    quotes,
    quoteStatus,
    surgeByCode,
    targetByCode,
    screenedByCode,
    pins,
    pinnedSet,
    togglePin,
    pinnedCodes,
    surgeOrder,
    surgingSet,
    isVisible,
    hovering,
    listHandlers: {
      onPointerEnter: (event) => {
        // Touch has no hover; holding there would freeze the list until the next tap elsewhere.
        if (event.pointerType === 'mouse') setHovering(true);
      },
      onPointerLeave: () => setHovering(false),
    },
  };
}
