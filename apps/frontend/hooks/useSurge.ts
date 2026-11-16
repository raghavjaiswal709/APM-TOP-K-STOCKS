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
  meetsTargetFloor,
  sanitizeFilters,
  surgeTargetMove,
  todayIstKey,
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
 * The Surge watchlist shared by every watchlist in the app — a port of the
 * trading dashboard's WatchlistPanel (`watchlist-panel.tsx`).
 *
 * The Surge screener's ranked companies ARE the watchlist (`useWatchlist`
 * builds the list from the same snapshot). On top of that list this hook
 * adds the dashboard's view: pinned names, today's surges pulled to the top
 * by move since surge, surge filters, a minimum-target-move floor and the
 * user's own additions.
 *
 * Preferences (surging-on-top, filters, target floor, pins, additions) are
 * ONE set per browser, shared by every watchlist on every page and kept in
 * sync across components and tabs.
 */

// ── shared preferences ────────────────────────────────────────────────────

/**
 * "Surging on top" — on by default, as in the dashboard. A new key on
 * purpose: the old one stored the opt-in overlay toggle, whose "off" must
 * not carry over now that Surge is the watchlist itself.
 */
const VIEW_KEY = 'surge:watchlist-surging-on-top';
// OLD (Surge as an opt-in overlay on the watchlist_quant list, default off):
// const VIEW_KEY = 'surge:watchlist-view';
const FILTERS_KEY = 'surge:watchlist-filters';
const PINS_KEY = 'surge:watchlist-pins';
const MIN_TARGET_KEY = 'surge:watchlist-min-target-move';
const ADDITIONS_KEY = 'surge:watchlist-additions';

/** A symbol the user added by hand — the dashboard's "My additions". */
export interface ManualAddition {
  code: string;
  name: string;
  exchange: string;
  marker?: string;
}

interface SurgePrefs {
  surgingOnTop: boolean;
  filters: SurgeFilters;
  pins: string[];
  /** Fraction, 0.0295 = 2.95%; 0 means no floor. */
  minTargetMove: number;
  additions: ManualAddition[];
}

const DEFAULT_PREFS: SurgePrefs = {
  surgingOnTop: true,
  filters: DEFAULT_SURGE_FILTERS,
  pins: [],
  minTargetMove: 0,
  additions: [],
};

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

function parseAdditions(raw: string | null): ManualAddition[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: ManualAddition[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const value = entry as Partial<ManualAddition>;
      if (typeof value.code !== 'string') continue;
      const code = companyCodeOf(value.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      out.push({
        code,
        name: typeof value.name === 'string' && value.name ? value.name : code,
        exchange: typeof value.exchange === 'string' && value.exchange ? value.exchange : 'NSE',
        marker: typeof value.marker === 'string' ? value.marker : undefined,
      });
    }
    return out;
  } catch {
    return []; // Corrupt — no additions.
  }
}

function loadPrefs(): SurgePrefs {
  let filters = DEFAULT_SURGE_FILTERS;
  let pins: string[] = [];
  try {
    // The watchlist filters on target move, not surge score — a score floor
    // saved by the earlier overlay would otherwise keep hiding rows invisibly.
    filters = { ...sanitizeFilters(JSON.parse(readStorage(FILTERS_KEY) ?? 'null')), minScore: 0 };
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
  const storedFloor = Number(readStorage(MIN_TARGET_KEY));
  return {
    surgingOnTop: readStorage(VIEW_KEY) !== 'off',
    filters,
    pins,
    minTargetMove: Number.isFinite(storedFloor) && storedFloor > 0 ? Math.min(storedFloor, 1) : 0,
    additions: parseAdditions(readStorage(ADDITIONS_KEY)),
  };
}

const PREF_KEYS = new Set([VIEW_KEY, FILTERS_KEY, PINS_KEY, MIN_TARGET_KEY, ADDITIONS_KEY]);

function subscribePrefs(listener: () => void) {
  if (!prefsLoaded && typeof window !== 'undefined') {
    prefsLoaded = true;
    prefs = loadPrefs();
    // Another tab changed a preference.
    window.addEventListener('storage', (event) => {
      if (event.key && PREF_KEYS.has(event.key)) {
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
  if (patch.surgingOnTop !== undefined) writeStorage(VIEW_KEY, patch.surgingOnTop ? 'on' : 'off');
  if (patch.filters) writeStorage(FILTERS_KEY, JSON.stringify(patch.filters));
  if (patch.pins) writeStorage(PINS_KEY, JSON.stringify(patch.pins));
  if (patch.minTargetMove !== undefined) writeStorage(MIN_TARGET_KEY, String(patch.minTargetMove));
  if (patch.additions) writeStorage(ADDITIONS_KEY, JSON.stringify(patch.additions));
  for (const listener of prefListeners) listener();
}

export function useSurgePrefs() {
  const current = useSyncExternalStore(subscribePrefs, () => prefs, () => DEFAULT_PREFS);
  const setSurgingOnTop = useCallback((surgingOnTop: boolean) => setPrefs({ surgingOnTop }), []);
  const setFilters = useCallback((filters: SurgeFilters) => setPrefs({ filters: { ...filters, minScore: 0 } }), []);
  const setMinTargetMove = useCallback((next: number) => {
    setPrefs({ minTargetMove: Number.isFinite(next) ? Math.min(Math.max(next, 0), 1) : 0 });
  }, []);
  /** Reset clears the target floor too — it is one of the watchlist's filters. */
  const resetFilters = useCallback(() => setPrefs({ filters: DEFAULT_SURGE_FILTERS, minTargetMove: 0 }), []);
  const togglePin = useCallback((code: string) => {
    const key = companyCodeOf(code);
    setPrefs({ pins: prefs.pins.includes(key) ? prefs.pins.filter((p) => p !== key) : [...prefs.pins, key] });
  }, []);
  /** Returns false when the code is already one of the additions. */
  const addAddition = useCallback((addition: ManualAddition): boolean => {
    const code = companyCodeOf(addition.code);
    if (!code || prefs.additions.some((entry) => entry.code === code)) return false;
    setPrefs({ additions: [...prefs.additions, { ...addition, code }] });
    return true;
  }, []);
  const removeAddition = useCallback((code: string) => {
    const key = companyCodeOf(code);
    setPrefs({ additions: prefs.additions.filter((entry) => entry.code !== key) });
  }, []);
  return {
    ...current,
    setSurgingOnTop,
    setFilters,
    setMinTargetMove,
    resetFilters,
    togglePin,
    addAddition,
    removeAddition,
  };
}

export type SurgeFilterState = Pick<ReturnType<typeof useSurgePrefs>, 'filters' | 'setFilters' | 'resetFilters'>;

/**
 * The watchlist filter controls (`WatchlistFilterPopover`) from prefs alone —
 * for a toolbar that sits outside the list and has no full view.
 */
export function useWatchlistFilterControls(date?: string | null) {
  const prefs = useSurgePrefs();
  const { filters, setFilters, resetFilters, minTargetMove, setMinTargetMove, surgingOnTop, setSurgingOnTop } = prefs;
  const filterState = useMemo(() => ({ filters, setFilters, resetFilters }), [filters, setFilters, resetFilters]);
  return {
    filterState,
    targetFloorActive: minTargetMove > 0,
    minTargetMove,
    setMinTargetMove,
    surgingOnTop,
    setSurgingOnTop,
    live: isLiveDate(date),
  };
}

// ── data ──────────────────────────────────────────────────────────────────

/**
 * The dashboard's poller re-reads `/surges` every 30s and its watchlist
 * refreshes the screen every 60s; one combined request every 30s covers both.
 * A past date's screen is final, so it is never re-polled.
 */
const SNAPSHOT_REFRESH_MS = 30_000;

/** `true` when `date` is unset or today's IST day — the live screen. */
export function isLiveDate(date?: string | null): boolean {
  return !date || date === todayIstKey();
}

/**
 * The SWR key for a date's snapshot. Today (or no date) is the plain
 * `/api/surge` — the server's own "today" — so every watchlist on today's
 * screen shares one request.
 */
export function surgeSnapshotKey(date?: string | null): string {
  return isLiveDate(date) ? '/api/surge' : `/api/surge?date=${encodeURIComponent(date!)}`;
}

export async function surgeSnapshotFetcher(url: string): Promise<SurgeSnapshot> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = (await response.json().catch(() => null)) as SurgeSnapshot | { error?: string } | null;
  if (body && 'signals' in body) return body; // a 502 still carries both error fields
  throw new Error((body as { error?: string } | null)?.error ?? `HTTP ${response.status}`);
}

/** The Surge snapshot (screen + episodes) for `date`; nothing is fetched while `enabled` is false. */
export function useSurgeSnapshot(date?: string | null, enabled = true) {
  const live = isLiveDate(date);
  return useSWR<SurgeSnapshot>(enabled ? surgeSnapshotKey(date) : null, surgeSnapshotFetcher, {
    refreshInterval: live ? SNAPSHOT_REFRESH_MS : 0,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
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

// ── the master company list (for "Add symbol") ────────────────────────────

export interface MasterCompany {
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
}

let masterPromise: Promise<MasterCompany[]> | null = null;

function loadMasterCompanies(): Promise<MasterCompany[]> {
  if (!masterPromise) {
    masterPromise = fetch('/api/watchlist/all-companies', { headers: { Accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data: { companies?: MasterCompany[] }) =>
        (data.companies ?? []).filter((company) => company?.company_code && company.name),
      )
      .catch((error) => {
        masterPromise = null; // let the next open retry
        throw error;
      });
  }
  return masterPromise;
}

/** Every company in the master list, loaded once per page the first time `enabled` is true. */
export function useMasterCompanies(enabled: boolean) {
  const [companies, setCompanies] = useState<MasterCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || companies) return;
    let cancelled = false;
    loadMasterCompanies()
      .then((list) => !cancelled && setCompanies(list))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [enabled, companies]);
  return { companies, error, loading: enabled && !companies && !error };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

export interface SurgeWatchlistOptions {
  /**
   * The watchlist's date, `YYYY-MM-DD`. Unset or today = the live screen,
   * the only one with a "Surging today" block.
   */
  date?: string | null;
  /** The host list's own rows — they show a live price too. */
  rowCodes?: string[];
  /** Subscribe to live prices (e.g. only while a dropdown is open). Default true. */
  liveQuotes?: boolean;
}

export interface SurgeWatchlistView {
  /** "Surging on top" preference. */
  surgingOnTop: boolean;
  setSurgingOnTop: (next: boolean) => void;
  /** The watchlist shows today's live screen. */
  live: boolean;
  /** The "Surging today" block is shown: surging-on-top and a live screen. */
  showSurging: boolean;
  filterState: SurgeFilterState;
  /** A direction / type / tercile filter is set — these need a surge today. */
  filtersActive: boolean;
  minTargetMove: number;
  setMinTargetMove: (next: number) => void;
  targetFloorActive: boolean;
  snapshot: SurgeSnapshot | undefined;
  loading: boolean;
  fetchError: string | null;
  quotes: Record<string, SurgeQuote>;
  quoteStatus: QuoteFeedStatus;
  /** Every surge on the snapshot's day that passed the filters, grouped per company. */
  surgeByCode: Map<string, SurgeEntry>;
  screenedByCode: Map<string, ScreenedCompany>;
  /** Target move (fraction) from the screen, else from the company's latest surge. */
  targetOf: (code: string) => number | null;
  pins: string[];
  pinnedSet: Set<string>;
  togglePin: (code: string) => void;
  /** Pinned codes, search applied — a surge filter never hides a pin. */
  pinnedCodes: string[];
  additionSet: Set<string>;
  removeAddition: (code: string) => void;
  /** The surging block, best move since surge first; throttled and held on hover. */
  surgeOrder: string[];
  surgingSet: Set<string>;
  /** Surge filters + target floor, without the search (hosts search code and name). */
  passesFilters: (code: string) => boolean;
  /** Search plus `passesFilters`. */
  isVisible: (code: string) => boolean;
  hovering: boolean;
  /** Spread onto the scrolling list element. */
  listHandlers: {
    onPointerEnter: (event: React.PointerEvent) => void;
    onPointerLeave: () => void;
  };
}

/**
 * Everything a watchlist needs to render the dashboard's Surge view.
 *
 * `searchTerms` is the watchlist's search (`parseSearchTerms`).
 */
export function useSurgeWatchlist(searchTerms: string[], options: SurgeWatchlistOptions = {}): SurgeWatchlistView {
  const { date, rowCodes, liveQuotes = true } = options;
  const {
    surgingOnTop,
    setSurgingOnTop,
    filters,
    setFilters,
    resetFilters,
    minTargetMove,
    setMinTargetMove,
    pins,
    togglePin,
    additions,
    removeAddition,
  } = useSurgePrefs();
  const live = isLiveDate(date);
  const { data: snapshot, isLoading, error } = useSurgeSnapshot(date);
  const [hovering, setHovering] = useState(false);
  const showSurging = surgingOnTop && live;

  // Only the snapshot's own trading day counts.
  const tradingDate = snapshot?.date ?? istDayKey(Math.floor(Date.now() / 1000));
  const daySignals = useMemo(
    () => (snapshot?.signals ?? []).filter((signal) => istDayKey(signal.detectedAt) === tradingDate),
    [snapshot, tradingDate],
  );

  // Filters apply per surge, before grouping, so a row's latest surge and its
  // count are both ones that passed them.
  const surgeByCode = useMemo(() => {
    const map = new Map<string, SurgeEntry>();
    for (const signal of daySignals) {
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
  }, [daySignals, filters]);

  const screenedByCode = useMemo(
    () => new Map((snapshot?.screened ?? []).map((row) => [row.companyCode, row])),
    [snapshot],
  );

  const targetOf = useCallback(
    (code: string): number | null =>
      screenedByCode.get(code)?.targetMovePct ?? surgeTargetMove(surgeByCode.get(code)?.latest),
    [screenedByCode, surgeByCode],
  );

  // Quotes stay subscribed for every listed name, filtered out or not, so
  // changing a filter doesn't churn the feed's subscriptions.
  const rowKey = (rowCodes ?? []).join(',');
  const quoteCodes = useMemo(
    () => [
      ...new Set([
        ...daySignals.map((signal) => signal.companyCode),
        ...pins,
        ...additions.map((entry) => entry.code),
        ...(rowKey ? rowKey.split(',').map(companyCodeOf) : []),
      ]),
    ],
    [daySignals, pins, additions, rowKey],
  );
  const { quotes, status: quoteStatus } = useSurgeQuotes(quoteCodes, liveQuotes);

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
  const throttledSurgeOrder = useThrottledOrder(showSurging ? desiredSurgeOrder : []);

  const pinnedSet = useMemo(() => new Set(pins), [pins]);
  const additionSet = useMemo(() => new Set(additions.map((entry) => entry.code)), [additions]);
  // Pinned names lead the list in pin order. Only the search narrows them.
  const pinnedCodes = pins.filter((code) => matchesSymbolSearch(code, searchTerms));

  const passesTarget = (code: string) => meetsTargetFloor(targetOf(code), minTargetMove);

  const surgeOrder = useHeldOrder(
    showSurging
      ? throttledSurgeOrder.filter(
          (code) =>
            surgeByCode.has(code) &&
            !pinnedSet.has(code) &&
            matchesSymbolSearch(code, searchTerms) &&
            passesTarget(code),
        )
      : [],
    hovering,
  );
  const surgingSet = useMemo(() => new Set(surgeOrder), [surgeOrder]);

  const filtersActive = activeFilterCount(filters) > 0;
  const targetFloorActive = minTargetMove > 0;
  // Surge filters describe surges, so while one is set a name with no
  // matching surge that day is hidden outright. The target floor hides names
  // whose target move is below it, or unknown.
  const passesFilters = useCallback(
    (code: string) =>
      (!filtersActive || surgeByCode.has(code)) && meetsTargetFloor(targetOf(code), minTargetMove),
    [filtersActive, surgeByCode, targetOf, minTargetMove],
  );
  const isVisible = useCallback(
    (code: string) => matchesSymbolSearch(code, searchTerms) && passesFilters(code),
    [searchTerms, passesFilters],
  );

  return {
    surgingOnTop,
    setSurgingOnTop,
    live,
    showSurging,
    filterState: { filters, setFilters, resetFilters },
    filtersActive,
    minTargetMove,
    setMinTargetMove,
    targetFloorActive,
    snapshot,
    loading: isLoading && !snapshot,
    fetchError: error ? (error as Error).message : null,
    quotes,
    quoteStatus,
    surgeByCode,
    screenedByCode,
    targetOf,
    pins,
    pinnedSet,
    togglePin,
    pinnedCodes,
    additionSet,
    removeAddition,
    surgeOrder,
    surgingSet,
    passesFilters,
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
