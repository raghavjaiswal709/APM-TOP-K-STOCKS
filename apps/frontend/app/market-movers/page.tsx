// @ts-nocheck
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppSidebar } from '../components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ModeToggle } from '../components/toggleButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useLiveMarket } from '@/hooks/useLiveMarket';
import MarketMoversSidebar from './components/MarketMoversSidebar';

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  refined?: boolean;
  marker?: string;
}

interface MarketData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: number;
}

type TileColor = 'blue' | 'green' | 'yellow' | 'red' | 'grey';

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */

/** Resolve market data for a company from the data store. */
function resolveMarketData(
  store: Record<string, MarketData>,
  company: Company
): MarketData | undefined {
  // Try Fyers format: NSE:CODE-EQ
  const fyers = `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
  if (store[fyers]) return store[fyers];
  // Fallback: bare company code
  if (store[company.company_code]) return store[company.company_code];
  return undefined;
}

/** Extract company_code from a Fyers symbol (e.g. "NSE:ADANIGREEN-EQ" → "ADANIGREEN") */
function codeFromSymbol(symbol: string): string | null {
  const parts = symbol.split(':');
  if (parts.length !== 2) return null;
  return parts[1].split('-')[0] || null;
}

/** IST minutes since midnight for the current moment */
function getISTMinutes(): number {
  const now = new Date();
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % (24 * 60);
}

/** True if current IST wall-clock time is past 10:30 AM (end of blue-detection window) */
function isAfter1030AMIST(): boolean {
  return getISTMinutes() > 10 * 60 + 30;
}

const LOCKED_COLORS_API = '/api/market-movers/locked-colors';
/** Only blue is frozen after 10:30 AM. Green, yellow, red are always live. */
const FROZEN_COLORS = new Set<TileColor>(['blue']);

/* ─────────────────────────────────────────────────────────────────────────────
   Port 6969 opening price helpers
───────────────────────────────────────────────────────────────────────────── */

/** Today's date in IST as the port-6969 folder format, e.g. "LD_08-05-2026" */
function getTodayLDFormat(): string {
  const now = new Date(Date.now() + 330 * 60 * 1000); // shift UTC → IST
  const d = String(now.getUTCDate()).padStart(2, '0');
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const y = now.getUTCFullYear();
  return `LD_${d}-${m}-${y}`;
}

/** Parse `open_price` from a port-6969 NDJSON file (first valid JSON line wins). */
function parseOpenPrice6969(rawText: string): number | null {
  const lines = rawText.trim().split('\n');
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.open_price === 'number' && obj.open_price > 0) return obj.open_price;
    } catch { continue; }
  }
  return null;
}

/** Fetch today's opening price for a single company from port 6969 via the time-machine proxy. */
async function fetchOpenPrice6969(companyCode: string): Promise<number | null> {
  try {
    const url = `/api/time-machine/Live/${getTodayLDFormat()}/${companyCode}-NSE.json`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return parseOpenPrice6969(await res.text());
  } catch {
    return null;
  }
}

/**
 * Compute tile color from today's open vs current LTP.
 *   Blue   = LTP ≥ 2% above open  (only this is frozen after 10:30 AM)
 *   Green  = LTP 1% to <2% above open  (always live)
 *   Yellow = LTP 0% to <1% above open  (always live)
 *   Red    = LTP below open             (always live)
 *   Grey   = no live data or open price unavailable
 *
 * `externalOpen` is the open_price from port 6969; used when WebSocket `open` is absent/zero.
 */
function computeColorFromOpen(data: MarketData, externalOpen?: number): TileColor {
  const open = (data.open && data.open > 0) ? data.open : (externalOpen ?? 0);
  if (!open || data.ltp == null) return 'grey';
  const pct = ((data.ltp - open) / open) * 100;
  if (pct >= 2) return 'blue';
  if (pct >= 1) return 'green';
  if (pct >= 0) return 'yellow';
  return 'red';
}

/**
 * Effective tile color for a company.
 *   Blue after 10:30 AM  → frozen (locked during 9:15–10:30 AM window).
 *   Green / Yellow / Red → always live, update in real-time.
 *   Before 10:30 AM      → fully live for all colors.
 *   No data              → grey.
 */
function getTileColor(
  companyCode: string,
  data: MarketData | undefined,
  frozenAfter1030AM: boolean,
  lockedColors: Map<string, TileColor>,
  externalOpen?: number
): TileColor {
  if (frozenAfter1030AM) {
    const locked = lockedColors.get(companyCode);
    // Only honour the lock if it is blue (the only freezable color).
    if (locked && FROZEN_COLORS.has(locked)) return locked;
  }
  if (!data) return 'grey';
  return computeColorFromOpen(data, externalOpen);
}

/** % change from today's open for sorting (returns 0 when open not available) */
function pctFromOpen(data: MarketData | undefined, externalOpen?: number): number {
  if (!data || data.ltp == null) return 0;
  const open = (data.open && data.open > 0) ? data.open : (externalOpen ?? 0);
  if (!open) return 0;
  return ((data.ltp - open) / open) * 100;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Tile color styles
───────────────────────────────────────────────────────────────────────────── */
const CIRCLE_CLASS: Record<TileColor, string> = {
  blue:   'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
  green:  'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  yellow: 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
  red:    'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  grey:   'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.3)]',
};

const CHANGE_TEXT_CLASS: Record<TileColor, string> = {
  blue:   'text-blue-500 dark:text-blue-400',
  green:  'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-yellow-500 dark:text-yellow-400',
  red:    'text-red-500 dark:text-red-400',
  grey:   'text-slate-400 dark:text-slate-500',
};

const TILE_BORDER_CLASS: Record<TileColor, string> = {
  blue:   'border-blue-500/30 hover:border-blue-500/60',
  green:  'border-emerald-500/20 hover:border-emerald-500/50',
  yellow: 'border-yellow-400/20 hover:border-yellow-400/50',
  red:    'border-red-500/20 hover:border-red-500/50',
  grey:   'border-slate-400/15 hover:border-slate-400/35',
};

/* ─────────────────────────────────────────────────────────────────────────────
   Tile Component
───────────────────────────────────────────────────────────────────────────── */
interface TileProps {
  company: Company;
  data: MarketData | undefined;
  color: TileColor;
}

const CompanyTile: React.FC<TileProps> = ({ company, data, color }) => {
  const change = data?.change ?? 0;
  const changePercent = data?.changePercent ?? 0;
  const ltp = data?.ltp;
  const hasData = !!data;

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-5 py-4 rounded-2xl border-2 bg-card transition-colors cursor-default select-none w-full',
        TILE_BORDER_CLASS[color]
      )}
    >
      {/* ① Color indicator circle */}
      <div
        className={cn(
          'w-4 h-4 rounded-full shrink-0 transition-colors',
          CIRCLE_CLASS[color]
        )}
      />

      {/* ③ Company name + price */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base leading-tight truncate tracking-wide">
          {company.company_code}
        </div>
        {hasData && ltp !== undefined && (
          <div className="text-sm text-muted-foreground tabular-nums leading-none mt-1">
            ₹{ltp.toFixed(2)}
          </div>
        )}
      </div>

      {/* ② Price change + percentage */}
      {hasData ? (
        <div
          className={cn(
            'text-sm font-bold tabular-nums shrink-0 text-right leading-tight',
            CHANGE_TEXT_CLASS[color]
          )}
        >
          <div className="flex items-center gap-1 justify-end">
            {change === 0 ? (
              <Minus className="h-3.5 w-3.5" />
            ) : change > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>{change >= 0 ? '+' : ''}{change.toFixed(2)}</span>
          </div>
          <div className="text-xs font-semibold opacity-80 mt-0.5">
            ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </div>
        </div>
      ) : (
        <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Legend Row
───────────────────────────────────────────────────────────────────────────── */
const LegendRow: React.FC = () => (
  <div className="flex items-center gap-4 px-1 text-[10px] text-muted-foreground">
    {(
      [
        { color: 'blue',   label: '≥2% above open by 10:30 AM (frozen)' },
        { color: 'green',  label: '1–2% above open (live)' },
        { color: 'yellow', label: '0–1% above open (live)' },
        { color: 'red',    label: 'Below open (live)' },
        { color: 'grey',   label: 'No data / pre-market' },
      ] as { color: TileColor; label: string }[]
    ).map(({ color, label }) => (
      <div key={color} className="flex items-center gap-1.5">
        <div className={cn('w-2 h-2 rounded-full shrink-0', CIRCLE_CLASS[color])} />
        <span>{label}</span>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────────────────────── */
const MarketMoversPage: React.FC = () => {
  /* ── Live market WebSocket ── */
  const {
    marketData,
    connectionStatus,
    isConnected,
    loading: wsLoading,
    subscribeByCompanyCodes,
    unsubscribeAll,
    error: wsError,
  } = useLiveMarket();

  /* ── Selected companies from sidebar checkboxes ── */
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  /* ── All companies in the current sidebar filter ── */
  const [allSidebarCompanies, setAllSidebarCompanies] = useState<Company[]>([]);

  /* ── Track which companies we subscribed to (to avoid re-subscribing) ── */
  const subscribedCodesRef = useRef<string>('');
  const hasAutoSelectedRef = useRef(false);

  /* ── Opening prices from port 6969 (keyed by company_code) ── */
  const openingPricesRef = useRef<Record<string, number>>({});
  const fetchedCodesRef = useRef<Set<string>>(new Set());
  const [openingPrices, setOpeningPrices] = useState<Record<string, number>>({});

  /* ── Locked colors: built live during 9:15–10:30 AM, only blue frozen after ── */
  const lockedColorsRef = useRef<Map<string, TileColor>>(new Map());
  const [lockedColors, setLockedColors] = useState<Map<string, TileColor>>(new Map());
  const [frozenAfter1030AM, setFrozenAfter1030AM] = useState<boolean>(() => isAfter1030AMIST());

  /* ── Load persisted locked colors from backend on mount ── */
  useEffect(() => {
    fetch(LOCKED_COLORS_API)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, TileColor>) => {
        const map = new Map<string, TileColor>(
          Object.entries(data).filter(([, v]) => FROZEN_COLORS.has(v as TileColor))
        );
        lockedColorsRef.current = map;
        setLockedColors(new Map(map));
      })
      .catch(() => { /* backend unreachable — silent */ });
    setFrozenAfter1030AM(isAfter1030AMIST());
  }, []);

  /* ── Fetch opening prices from port 6969 for all sidebar companies ── */
  useEffect(() => {
    if (allSidebarCompanies.length === 0) return;

    const codesToFetch = allSidebarCompanies
      .map(c => c.company_code)
      .filter(code => !fetchedCodesRef.current.has(code));

    if (codesToFetch.length === 0) return;

    // Mark as fetched immediately to avoid duplicate requests
    codesToFetch.forEach(code => fetchedCodesRef.current.add(code));

    const run = async () => {
      const BATCH = 15;
      for (let i = 0; i < codesToFetch.length; i += BATCH) {
        const batch = codesToFetch.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(code => fetchOpenPrice6969(code).then(price => ({ code, price })))
        );
        let updated = false;
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value.price !== null) {
            openingPricesRef.current[r.value.code] = r.value.price;
            updated = true;
          }
        });
        if (updated) setOpeningPrices({ ...openingPricesRef.current });
      }
    };

    run();
  }, [allSidebarCompanies]);

  /* ── Build/update locked blue companies on each market tick (9:15–10:30 AM window) ── */
  useEffect(() => {
    // Once frozen and already populated, nothing left to update.
    if (frozenAfter1030AM && lockedColorsRef.current.size > 0) return;

    let changed = false;
    Object.values(marketData).forEach((data: MarketData) => {
      const code = codeFromSymbol(data.symbol) ?? data.symbol;
      const externalOpen = openingPricesRef.current[code];
      const color = computeColorFromOpen(data, externalOpen);
      // Only lock blue (the sole freezable color).
      if (!FROZEN_COLORS.has(color)) return;
      if (lockedColorsRef.current.get(code) !== color) {
        lockedColorsRef.current.set(code, color);
        changed = true;
      }
    });

    const nowPast1030 = isAfter1030AMIST();
    if (changed || nowPast1030) {
      const snapshot = new Map(lockedColorsRef.current);
      // Persist to backend (fire-and-forget)
      fetch(LOCKED_COLORS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(snapshot)),
      }).catch(() => { /* silent */ });
      setLockedColors(snapshot);
    }
    if (nowPast1030 && !frozenAfter1030AM) {
      setFrozenAfter1030AM(true);
    }
  }, [marketData, frozenAfter1030AM]);

  /* ── Right sidebar width/collapse ── */
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const isDraggingRef = useRef(false);

  /* ── When sidebar companies load, auto-select all + subscribe ── */
  const handleCompaniesChange = useCallback(
    (companies: Company[]) => {
      setAllSidebarCompanies(companies);

      // Auto-select all on first load
      if (!hasAutoSelectedRef.current && companies.length > 0) {
        hasAutoSelectedRef.current = true;
        setSelectedCodes(new Set(companies.map(c => c.company_code)));
      }
    },
    []
  );

  /* ── Subscribe to all sidebar companies whenever connection + companies are ready ── */
  useEffect(() => {
    if (!isConnected || allSidebarCompanies.length === 0) return;
    const codeKey = allSidebarCompanies
      .map(c => c.company_code)
      .sort()
      .join(',');
    if (codeKey === subscribedCodesRef.current) return;
    subscribedCodesRef.current = codeKey;
    subscribeByCompanyCodes(allSidebarCompanies.map(c => c.company_code));
  }, [isConnected, allSidebarCompanies, subscribeByCompanyCodes]);

  /* ── Compute sorted tile list ── */
  const sortedCompanies = useMemo(() => {
    const visible = allSidebarCompanies.filter(c =>
      selectedCodes.has(c.company_code)
    );

    return [...visible].sort((a, b) => {
      const dataA = resolveMarketData(marketData, a);
      const dataB = resolveMarketData(marketData, b);
      // Sort by % change from today's open, descending (highest performer at top)
      const pA = pctFromOpen(dataA, openingPrices[a.company_code]);
      const pB = pctFromOpen(dataB, openingPrices[b.company_code]);
      if (pB !== pA) return pB - pA;
      // Tiebreaker: alphabetical
      return a.company_code.localeCompare(b.company_code);
    });
  }, [allSidebarCompanies, selectedCodes, marketData, openingPrices]);

  /* ── Sidebar drag resize ── */
  const handleSidebarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startX - ev.clientX;
        setSidebarWidth(Math.max(220, Math.min(480, startWidth + delta)));
      };
      const onUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [sidebarWidth]
  );

  /* ── Connection status display ── */
  const getConnectionDisplay = () => {
    if (connectionStatus === 'Connected') {
      return { icon: CheckCircle, color: 'text-emerald-500', dot: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]', label: 'Live' };
    }
    if (connectionStatus === 'Reconnecting') {
      return { icon: Activity, color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse', label: 'Reconnecting' };
    }
    if (connectionStatus === 'Connecting') {
      return { icon: Activity, color: 'text-blue-500', dot: 'bg-blue-500 animate-pulse', label: 'Connecting' };
    }
    return { icon: XCircle, color: 'text-red-500', dot: 'bg-red-500', label: 'Disconnected' };
  };
  const connDisplay = getConnectionDisplay();
  const ConnIcon = connDisplay.icon;

  /* ── Stats ── */
  const stats = useMemo(() => {
    const counts: Record<TileColor, number> = { blue: 0, green: 0, yellow: 0, red: 0, grey: 0 };
    sortedCompanies.forEach(c => {
      const d = resolveMarketData(marketData, c);
      counts[getTileColor(c.company_code, d, frozenAfter1030AM, lockedColors, openingPrices[c.company_code])]++;
    });
    return counts;
  }, [sortedCompanies, marketData, frozenAfter1030AM, lockedColors, openingPrices]);

  /* ─────────────────────────────── RENDER ────────────────────────────────── */
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden flex flex-col h-screen">

        {/* ── HEADER ── */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Market Movers</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Stats badges */}
          <div className="hidden sm:flex items-center gap-1.5">
            {stats.blue > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-500/50 text-blue-500 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {stats.blue}
              </Badge>
            )}
            {stats.green > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald-500/50 text-emerald-500 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {stats.green}
              </Badge>
            )}
            {stats.yellow > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-yellow-500/50 text-yellow-500 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                {stats.yellow}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-500/50 text-red-500 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {stats.red}
            </Badge>
            {stats.grey > 0 && (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-400/50 text-slate-400 gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {stats.grey}
              </Badge>
            )}
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', connDisplay.dot)} />
            <span className={cn('font-medium hidden sm:block', connDisplay.color)}>
              {connDisplay.label}
            </span>
          </div>

          <ModeToggle />
        </header>

        {/* ── BODY: tile grid + right sidebar ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Main tile area ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Legend */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Market Movers
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {sortedCompanies.length} tiles
                  </Badge>
                </h2>
              </div>
              <LegendRow />
            </div>

            {/* Tile grid */}
            <div className="flex-1 overflow-auto p-4">
              {wsLoading && sortedCompanies.length === 0 ? (
                <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground text-sm">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span>Connecting to live feed…</span>
                </div>
              ) : !isConnected && sortedCompanies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
                  <WifiOff className="h-6 w-6" />
                  <span>Waiting for connection…</span>
                  {wsError && (
                    <span className="text-xs text-red-400">{wsError}</span>
                  )}
                </div>
              ) : sortedCompanies.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No companies selected. Check companies in the sidebar to show tiles.
                </div>
              ) : (
                <motion.div
                  layout
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
                >
                  <AnimatePresence mode="popLayout">
                    {sortedCompanies.map(company => {
                      const data = resolveMarketData(marketData, company);
                      const color = getTileColor(company.company_code, data, frozenAfter1030AM, lockedColors, openingPrices[company.company_code]);

                      return (
                        <motion.div
                          key={company.company_code}
                          layout
                          layoutId={company.company_code}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{
                            layout: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                            scale: { duration: 0.2 },
                          }}
                        >
                          <CompanyTile
                            company={company}
                            data={data}
                            color={color}
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Drag handle ── */}
          {isSidebarVisible && (
            <div
              onMouseDown={handleSidebarMouseDown}
              className="w-1 cursor-col-resize bg-border hover:bg-primary/40 transition-colors shrink-0"
            />
          )}

          {/* ── Sidebar toggle button ── */}
          <button
            onClick={() => setIsSidebarVisible(v => !v)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-5 flex items-center justify-center bg-muted/80 border border-r-0 rounded-l-md hover:bg-muted transition-colors"
            style={{ right: isSidebarVisible ? sidebarWidth : 0 }}
          >
            {isSidebarVisible ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>

          {/* ── Right sidebar ── */}
          {isSidebarVisible && (
            <div
              className="border-l bg-background overflow-hidden flex flex-col shrink-0"
              style={{ width: sidebarWidth }}
            >
              <div className="px-3 py-2 border-b shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Filter &amp; Select
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <MarketMoversSidebar
                  selectedCodes={selectedCodes}
                  onSelectionChange={setSelectedCodes}
                  onCompaniesChange={handleCompaniesChange}
                />
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default MarketMoversPage;
