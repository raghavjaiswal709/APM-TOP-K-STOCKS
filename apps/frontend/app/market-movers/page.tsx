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
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Info,
  LayoutGrid,
  Layers,
  AlignJustify,
  Grid3X3,
  Star,
  ChevronDown,
  Check,
} from 'lucide-react';
import { getSocket, onSocketSourceChange, getSocketSourceLabel, getActiveSocketUrl, isSocketConnected } from '@/lib/socket';
import MarketMoversSidebar from './components/MarketMoversSidebar';
import { MarketClosedBanner } from '@/app/components/MarketClosedBanner';

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
   Logic B (GTT Aligned) — types
───────────────────────────────────────────────────────────────────────────── */
type GttTileColor = 'blue' | 'green' | 'yellow' | 'red' | 'black' | 'gray';

interface GttSnapshot {
  publishTs: Date;                                         // IST publish timestamp
  basePrice: number;                                       // input_close at publish
  horizons: [number, number, number, number, number];     // H1–H5 (S1 predictions)
}

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

/** True if current IST wall-clock time is at or past 10:30 AM */
function isAfter1030AMIST(): boolean {
  return getISTMinutes() >= 10 * 60 + 30;
}

/** Milliseconds until 10:30 AM IST today (negative if already past) */
function getMsUntil1030IST(): number {
  const now = Date.now();
  const istNow = new Date(now + 330 * 60 * 1000);
  const target = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate(),
    5, 0, 0   // 10:30 AM IST = 05:00 UTC
  );
  return target - now;
}

const LOCKED_COLORS_API = '/api/market-movers/locked-colors';

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
 * Compute live tile color.
 * Uses `data.changePercent` (Fyers chp — same value displayed in the tile) so the
 * signal always matches the number the user sees.
 * Falls back to manual ltp-vs-open calculation only when chp is unavailable.
 *
 * Blue is NEVER returned here — it is only assigned by the 10:30 AM snapshot check.
 *   Green  = ≥ 1% above reference  (live)
 *   Yellow = 0% to <1% above reference  (live)
 *   Red    = below reference  (live)
 *   Grey   = no live data yet
 */
function computeColorFromOpen(data: MarketData, externalOpen?: number): TileColor {
  if (data.ltp == null) return 'grey';

  let pct: number;

  // Prefer Fyers chp (matches the % shown in the tile exactly)
  if (data.changePercent != null) {
    pct = data.changePercent;
  } else {
    // Fallback: compute manually from today's open
    const raw = data as any;
    const open =
      (data.open > 0)      ? data.open :
      (raw.open_price > 0) ? raw.open_price :
      (externalOpen > 0)   ? externalOpen : 0;
    if (!open) return 'grey';
    pct = ((data.ltp - open) / open) * 100;
  }

  if (pct >= 1.5) return 'green';
  if (pct >= 0) return 'yellow';
  return 'red';
}

/**
 * Effective tile color for a company.
 *   Blue  → only after the 10:30 AM snapshot check confirms ≥2% above open.
 *   Green / Yellow / Red → always live from computeColorFromOpen.
 *   No data → grey.
 */
function getTileColor(
  companyCode: string,
  data: MarketData | undefined,
  blueCheckDone: boolean,
  lockedColors: Map<string, TileColor>,
  externalOpen?: number
): TileColor {
  if (blueCheckDone && lockedColors.get(companyCode) === 'blue') return 'blue';
  if (!data) return 'grey';
  return computeColorFromOpen(data, externalOpen);
}

/** % change for sorting — uses same reference as computeColorFromOpen */
function pctFromOpen(data: MarketData | undefined, externalOpen?: number): number {
  if (!data || data.ltp == null) return 0;
  if (data.changePercent != null) return data.changePercent;
  const raw = data as any;
  const open =
    (data.open > 0)      ? data.open :
    (raw.open_price > 0) ? raw.open_price :
    (externalOpen > 0)   ? externalOpen : 0;
  if (!open) return 0;
  return ((data.ltp - open) / open) * 100;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Logic B (GTT Aligned) — pure helpers
───────────────────────────────────────────────────────────────────────────── */
const GTT_HORIZON_MIN    = 15;
const GTT_N_HORIZONS     = 5;
const GTT_PATH_SPAN_MIN  = 75;

/** Parse a prediction_time string (IST) into a UTC Date. */
function parsePredictionTime(s: string): Date | null {
  if (!s) return null;
  let d: Date;
  if (s.includes('T') && (s.includes('+') || s.endsWith('Z'))) {
    d = new Date(s);
  } else {
    // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" — treat as IST
    d = new Date(s.replace(' ', 'T') + '+05:30');
  }
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Given the current moment `now`, find the latest GTT snapshot publish timestamp
 * (15-min floor, clamped to [10:00, 15:30] IST). Returns null before 10:00 AM IST.
 */
function latestGttPublishTs(now: Date): Date | null {
  const istMs   = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  const totalMin = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  const FIRST    = 10 * 60;       // 10:00 AM IST
  const LAST     = 15 * 60 + 30; // 15:30 IST
  if (totalMin < FIRST) return null;
  const aligned    = Math.floor(totalMin / GTT_HORIZON_MIN) * GTT_HORIZON_MIN;
  if (aligned < FIRST) return null;
  const clampedMin = Math.min(aligned, LAST);
  const pubH = Math.floor(clampedMin / 60);
  const pubM = clampedMin % 60;
  // Convert back to UTC
  const pubUtcMs = Date.UTC(
    istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(),
    pubH, pubM, 0, 0,
  ) - 5.5 * 60 * 60 * 1000;
  return new Date(pubUtcMs);
}

/** Linear interpolation of expected price along the GTT forecast path. */
function expectedOnPath(snap: GttSnapshot, now: Date): number | null {
  if (now < snap.publishTs) return null;
  const elapsed = (now.getTime() - snap.publishTs.getTime()) / 60000; // minutes
  if (elapsed > GTT_PATH_SPAN_MIN) return null;
  const seg    = Math.min(Math.floor(elapsed / GTT_HORIZON_MIN), GTT_N_HORIZONS - 1);
  const pLeft  = seg === 0 ? snap.basePrice : snap.horizons[seg - 1];
  const pRight = snap.horizons[seg];
  const frac   = (elapsed - seg * GTT_HORIZON_MIN) / GTT_HORIZON_MIN;
  return pLeft + (pRight - pLeft) * frac;
}

function classifyGttDev(devPct: number): GttTileColor {
  if (devPct > 2.0)    return 'blue';
  if (devPct >= 0.0)   return 'green';
  if (devPct > -5.0)   return 'yellow';
  if (devPct >= -10.0) return 'red';
  return 'black';
}

function colorForTickGtt(
  snap: GttSnapshot | null | undefined,
  live: number | null | undefined,
  now: Date,
): { color: GttTileColor; devPct: number | null } {
  if (!snap || live == null || live <= 0) return { color: 'gray', devPct: null };
  const expected = expectedOnPath(snap, now);
  if (expected == null || expected <= 0) return { color: 'gray', devPct: null };
  const dev = (live - expected) / expected * 100;
  return { color: classifyGttDev(dev), devPct: dev };
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
   Logic B (GTT Aligned) — tile color styles
───────────────────────────────────────────────────────────────────────────── */
const GTT_CIRCLE_CLASS: Record<GttTileColor, string> = {
  blue:  'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
  green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  yellow:'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
  red:   'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
  black: 'bg-zinc-800 shadow-[0_0_8px_rgba(0,0,0,0.6)] border border-zinc-600',
  gray:  'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.3)]',
};

const GTT_CHANGE_TEXT_CLASS: Record<GttTileColor, string> = {
  blue:  'text-blue-500 dark:text-blue-400',
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow:'text-yellow-500 dark:text-yellow-400',
  red:   'text-red-500 dark:text-red-400',
  black: 'text-zinc-400 dark:text-zinc-500',
  gray:  'text-slate-400 dark:text-slate-500',
};

const GTT_TILE_BORDER_CLASS: Record<GttTileColor, string> = {
  blue:  'border-blue-500/30 hover:border-blue-500/60',
  green: 'border-emerald-500/20 hover:border-emerald-500/50',
  yellow:'border-yellow-400/20 hover:border-yellow-400/50',
  red:   'border-red-500/20 hover:border-red-500/50',
  black: 'border-zinc-700/30 hover:border-zinc-600/60',
  gray:  'border-slate-400/15 hover:border-slate-400/35',
};

/* ─────────────────────────────────────────────────────────────────────────────
   Tile Component
───────────────────────────────────────────────────────────────────────────── */
interface TileProps {
  company: Company;
  data: MarketData | undefined;
  color: TileColor;
  /** When provided, Logic B (GTT Aligned) overrides the color display. */
  gttColor?: GttTileColor;
  /** Logic B deviation % to show as secondary label (e.g. +1.4% or -6.2%). */
  devPct?: number | null;
}

const CompanyTile: React.FC<TileProps> = ({ company, data, color, gttColor, devPct }) => {
  const change = data?.change ?? 0;
  const changePercent = data?.changePercent ?? 0;
  const ltp = data?.ltp;
  const circleClass     = gttColor != null ? GTT_CIRCLE_CLASS[gttColor]     : CIRCLE_CLASS[color];
  const changeTextClass = gttColor != null ? GTT_CHANGE_TEXT_CLASS[gttColor] : CHANGE_TEXT_CLASS[color];
  const borderClass     = gttColor != null ? GTT_TILE_BORDER_CLASS[gttColor] : TILE_BORDER_CLASS[color];
  const hasData = !!data;

  const handleClick = () => {
    const marker = company.marker || 'EQ';
    const url = `/cluster-overlay?company=${encodeURIComponent(company.company_code)}&exchange=${encodeURIComponent(company.exchange)}&marker=${encodeURIComponent(marker)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-4 px-5 py-4 rounded-2xl border-2 bg-card transition-colors cursor-pointer select-none w-full hover:brightness-110 active:scale-[0.98]',
        borderClass
      )}
    >
      {/* ① Color indicator circle */}
      <div
        className={cn(
          'w-4 h-4 rounded-full shrink-0 transition-colors',
          circleClass
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
        {/* Logic B deviation label */}
        {devPct != null && (
          <div className={cn('text-[10px] tabular-nums font-semibold leading-none mt-0.5', changeTextClass)}>
            {devPct >= 0 ? '+' : ''}{devPct.toFixed(2)}% vs GTT
          </div>
        )}
      </div>

      {/* ② Price change + percentage */}
      {hasData ? (
        <div
          className={cn(
            'text-sm font-bold tabular-nums shrink-0 text-right leading-tight',
            changeTextClass
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
   Legend — tooltip popover (Logic 1)
───────────────────────────────────────────────────────────────────────────── */
const LEGEND_ITEMS: { color: TileColor; label: string; description: string }[] = [
  { color: 'blue',   label: '≥2% above open at 10:30 AM', description: 'Confirmed at exactly 10:30 AM — frozen for the rest of the trading day' },
  { color: 'green',  label: '≥1.5% above open',           description: 'Live signal — currently trading ≥1.5% above today\'s opening price' },
  { color: 'yellow', label: '0–1.5% above open',          description: 'Live signal — trading between 0% and 1.5% above the opening price' },
  { color: 'red',    label: 'Below open',                 description: 'Live signal — currently trading below today\'s opening price' },
  { color: 'grey',   label: 'No data / pre-market',       description: 'No live tick received yet — pre-market or data subscription gap' },
];

const LegendInfoButton: React.FC = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60 border border-transparent hover:border-border">
        <Info className="h-3 w-3 shrink-0" />
        <span>Signal Legend</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-80 p-4" align="start">
      <p className="text-xs font-semibold mb-3 text-foreground">Signal Color Legend</p>
      <div className="space-y-2.5">
        {LEGEND_ITEMS.map(({ color, label, description }) => (
          <div key={color} className="flex items-start gap-2.5">
            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', CIRCLE_CLASS[color])} />
            <div>
              <p className="text-xs font-medium text-foreground leading-none mb-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Logic B Legend — tooltip popover (GTT Aligned)
───────────────────────────────────────────────────────────────────────────── */
const GTT_LEGEND_ITEMS: { color: GttTileColor; label: string; description: string }[] = [
  { color: 'blue',   label: '>+2% above GTT path',    description: 'Stock is significantly outperforming its GTT forecast path' },
  { color: 'green',  label: '0–+2% above GTT path',   description: 'Stock is tracking above the predicted GTT path (bullish deviation)' },
  { color: 'yellow', label: '-5–0% below GTT path',   description: 'Minor negative deviation below the predicted GTT path' },
  { color: 'red',    label: '-10–-5% below GTT path', description: 'Moderate underperformance vs the predicted GTT path' },
  { color: 'black',  label: '<-10% below GTT path',   description: 'Severe underperformance — stock far below GTT forecast' },
  { color: 'gray',   label: 'No snapshot / expired',  description: 'GTT prediction unavailable or published more than 15 minutes ago' },
];

const GttLegendInfoButton: React.FC = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60 border border-transparent hover:border-border">
        <Info className="h-3 w-3 shrink-0" />
        <span>GTT Signal Legend</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-80 p-4" align="start">
      <p className="text-xs font-semibold mb-3 text-foreground">GTT Path Deviation Legend</p>
      <div className="space-y-2.5">
        {GTT_LEGEND_ITEMS.map(({ color, label, description }) => (
          <div key={color} className="flex items-start gap-2.5">
            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', GTT_CIRCLE_CLASS[color])} />
            <div>
              <p className="text-xs font-medium text-foreground leading-none mb-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────────────────────── */
const MarketMoversPage: React.FC = () => {
  /* ── Live market state (port 5001 via shared getSocket singleton) ── */
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Connected' | 'Disconnected' | 'Reconnecting'>('Connecting');
  const [socketSource, setSocketSource] = useState<'server' | 'localhost'>('server');
  const [isConnected, setIsConnected] = useState(false);
  const [wsLoading, setWsLoading] = useState(true);
  const [wsError, setWsError] = useState<string | null>(null);

  /* ── Selected companies from sidebar checkboxes ── */
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  /* ── All companies in the current sidebar filter ── */
  const [allSidebarCompanies, setAllSidebarCompanies] = useState<Company[]>([]);

  /* ── Track which companies we subscribed to (to avoid re-subscribing) ── */
  const subscribedCodesRef = useRef<string>('');
  /* ── Symbols this page is actually subscribed to right now (full Fyers symbols) ── */
  const subscribedSymbolsRef = useRef<Set<string>>(new Set());

  /* ── Cross-symbol leak guard: trusted last-known price per symbol.
       Defends against the Fyers SDK token-mapping race that occasionally
       delivers a tick labelled with the wrong symbol — those ticks deviate
       massively from the symbol's reference and are dropped here. ── */
  const referencePriceRef = useRef<Map<string, number>>(new Map());
  const PRICE_SANITY_MAX_DEVIATION = 0.20;
  const isPriceSaneForSymbol = (symbol: string, price: number | undefined | null): boolean => {
    if (!symbol || price == null || !Number.isFinite(price) || price <= 0) return false;
    const ref = referencePriceRef.current.get(symbol);
    if (!ref || ref <= 0) return true;
    return Math.abs(price - ref) / ref <= PRICE_SANITY_MAX_DEVIATION;
  };
  /* ── Stable ref mirror of allSidebarCompanies — used inside the 10:30 AM timer callback ── */
  const allSidebarCompaniesRef = useRef<Company[]>([]);

  /* ── Opening prices from port 6969 (keyed by company_code) ── */
  const openingPricesRef = useRef<Record<string, number>>({});
  const fetchedCodesRef = useRef<Set<string>>(new Set());
  const [openingPrices, setOpeningPrices] = useState<Record<string, number>>({});

  /* ── Locked (Blue) colors: set at the 10:30 AM snapshot, frozen for the day ── */
  const lockedColorsRef = useRef<Map<string, TileColor>>(new Map());
  const [lockedColors, setLockedColors] = useState<Map<string, TileColor>>(new Map());
  /* blueCheckDone = true once the 10:30 AM snapshot check has run (or loaded from persisted file) */
  const [blueCheckDone, setBlueCheckDone] = useState(false);
  const [blueCheckRunning, setBlueCheckRunning] = useState(false);
  const blueCheckRunningRef = useRef(false);

  /* ── Load persisted Blue colors from backend on mount ── */
  useEffect(() => {
    fetch(LOCKED_COLORS_API)
      .then(async r => {
        if (r.status === 404) {
          // File doesn't exist yet — check has never run today. Leave blueCheckDone = false.
          return null;
        }
        if (!r.ok) return null;
        return r.json() as Promise<Record<string, string>>;
      })
      .then((data) => {
        if (data === null) return; // no file — timer effect will run the check
        const map = new Map<string, TileColor>();
        for (const [code, color] of Object.entries(data)) {
          if (color === 'blue') map.set(code, 'blue');
        }
        lockedColorsRef.current = map;
        setLockedColors(new Map(map));
        // File exists → check was already run today (result may be zero blue companies).
        setBlueCheckDone(true);
      })
      .catch(() => { /* backend unreachable — silent */ });
  }, []);

  /* ── Port 5001 socket: connect, receive marketDataUpdate, update state ── */
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnectionStatus('Connected');
      setIsConnected(true);
      setWsLoading(false);
      setWsError(null);
      setSocketSource(getSocketSourceLabel());
      // Re-subscribe on reconnect so we don't miss ticks
      if (subscribedCodesRef.current) {
        const companyCodes = subscribedCodesRef.current.split(',');
        socket.emit('subscribe_companies', { companyCodes });
      }
    };

    const onDisconnect = () => {
      setConnectionStatus('Disconnected');
      setIsConnected(false);
    };

    const onReconnectAttempt = () => setConnectionStatus('Reconnecting');

    const onMarketDataUpdate = (data: any) => {
      if (!data?.symbol) return;

      // ✅ Strict symbol guard: reject ticks for symbols this page never
      // subscribed to. Without this, a leaked tick (Fyers SDK token-mapping
      // race) would silently land in marketData under the wrong symbol.
      if (
        subscribedSymbolsRef.current.size > 0 &&
        !subscribedSymbolsRef.current.has(data.symbol)
      ) {
        return;
      }

      // ✅ Cross-symbol leak guard: a tick whose ltp is wildly off this
      // symbol's reference price is a cross-symbol leak — drop it before it
      // poisons the colour/change/percentage calculations.
      if (!isPriceSaneForSymbol(data.symbol, data.ltp)) {
        return;
      }
      // Refine the reference using the validated price so the band tracks
      // legitimate intraday moves.
      if (typeof data.ltp === 'number' && Number.isFinite(data.ltp) && data.ltp > 0) {
        referencePriceRef.current.set(data.symbol, data.ltp);
      }

      setMarketData(prev => {
        const existing = prev[data.symbol];
        // Resolve open: prefer open_price > 0 from this tick, then previous open
        const open =
          (data.open_price > 0) ? data.open_price :
          (data.open > 0)       ? data.open :
          (existing?.open > 0)  ? existing.open : 0;
        return {
          ...prev,
          [data.symbol]: {
            ...existing,   // preserve any previous-tick fields not resent
            ...data,       // raw Fyers fields (open_price, high_price, etc.)
            // Normalised / merged fields that computeColorFromOpen reads:
            symbol:        data.symbol,
            ltp:           data.ltp,
            change:        data.change,
            changePercent: data.change_percent ?? data.chp ?? data.changePercent,
            open,
            high:          data.high_price  > 0 ? data.high_price  : data.high  ?? existing?.high,
            low:           data.low_price   > 0 ? data.low_price   : data.low   ?? existing?.low,
            close:         data.prev_close_price > 0 ? data.prev_close_price : data.close ?? existing?.close,
            volume:        data.vol_traded_today ?? data.volume ?? existing?.volume,
            timestamp:     data.timestamp ?? Date.now(),
          },
        };
      });
    };

    socket.on('connect',           onConnect);
    socket.on('disconnect',        onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('marketDataUpdate',  onMarketDataUpdate);

    // Sync initial socket state
    if (socket.connected) {
      setConnectionStatus('Connected');
      setIsConnected(true);
      setWsLoading(false);
    }

    const unsubscribeSource = onSocketSourceChange(label => setSocketSource(label));
    setSocketSource(getSocketSourceLabel());

    // ✅ Status reconciler — keep the badge synced to real socket state every 3s.
    // Defends against missed connect/disconnect events that would otherwise
    // leave the indicator stuck on a stale value.
    const reconcile = () => {
      const c = isSocketConnected();
      setIsConnected(c);
      setConnectionStatus(prev => {
        if (c) return 'Connected';
        if (prev === 'Connected') return 'Reconnecting';
        return prev;
      });
    };
    const reconcileId = setInterval(reconcile, 3000);

    return () => {
      socket.off('connect',           onConnect);
      socket.off('disconnect',        onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('marketDataUpdate',  onMarketDataUpdate);
      unsubscribeSource();
      clearInterval(reconcileId);
    };
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

  /* ── 10:30 AM snapshot Blue check — runs ONCE at exactly 10:30 AM IST ── */
  useEffect(() => {
    if (blueCheckDone) return; // already done (loaded from file or just ran)

    const runBlueSnapshotCheck = async () => {
      if (blueCheckRunningRef.current) return;
      blueCheckRunningRef.current = true;
      setBlueCheckRunning(true);

      const codes = allSidebarCompaniesRef.current.map(c => c.company_code);
      const BATCH = 8;
      const newBlue = new Map<string, TileColor>();

      for (let i = 0; i < codes.length; i += BATCH) {
        const batch = codes.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async code => {
            try {
              const res = await fetch(`/api/market-movers/snapshot-1030?code=${encodeURIComponent(code)}`);
              if (!res.ok) return;
              const json = await res.json();
              if (typeof json.pct === 'number' && json.pct >= 2) {
                newBlue.set(code, 'blue');
              }
            } catch { /* silent */ }
          })
        );
      }

      lockedColorsRef.current = newBlue;
      setLockedColors(new Map(newBlue));
      setBlueCheckDone(true);
      blueCheckRunningRef.current = false;
      setBlueCheckRunning(false);

      // Persist result to backend data folder (file existing = check was run today)
      fetch(LOCKED_COLORS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(newBlue)),
      }).catch(() => { /* silent */ });
    };

    const msUntil = getMsUntil1030IST();
    if (msUntil <= 0) {
      // Past 10:30 AM — run immediately (first page load today after the cutoff)
      runBlueSnapshotCheck();
      return;
    }
    // Schedule for exactly 10:30 AM IST
    const timer = setTimeout(runBlueSnapshotCheck, msUntil);
    return () => clearTimeout(timer);
  }, [blueCheckDone]);

  /* ── Right sidebar width/collapse ── */
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const isDraggingRef = useRef(false);

  /* ── When sidebar companies load, auto-select all + subscribe ── */
  const handleCompaniesChange = useCallback(
    (companies: Company[]) => {
      allSidebarCompaniesRef.current = companies;
      setAllSidebarCompanies(companies);

      setSelectedCodes(prev => {
        const newCodes = new Set(companies.map(c => c.company_code));

        // Initial load: nothing selected yet — select everything.
        if (prev.size === 0) return newCodes;

        // Stale-cache detected: previous set is more than 2× larger than the
        // fresh API list (e.g. a "show all 2000+ companies" cache was loaded
        // for a sidebar that only expects today's ~200-company watchlist).
        // Reset the selection entirely to today's list.
        if (newCodes.size > 0 && prev.size > newCodes.size * 2) return newCodes;

        // Normal incremental update (e.g. user changed the date, or watchlist
        // gained a few new entries): keep the user's existing deselections but
        // auto-select any brand-new companies so tiles always appear for them.
        let changed = false;
        const next = new Set(prev);
        companies.forEach(c => {
          if (!next.has(c.company_code)) {
            next.add(c.company_code);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
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
    const companyCodes = allSidebarCompanies.map(c => c.company_code);
    const symbols = allSidebarCompanies.map(
      c => `${c.exchange}:${c.company_code}-${c.marker || 'EQ'}`
    );

    // ✅ Maintain the per-page subscribed-symbols set so the leak guard on
    // marketDataUpdate can reject any tick for an unrelated symbol.
    const next = new Set<string>(symbols);
    subscribedSymbolsRef.current = next;

    // ✅ Seed leak-guard reference prices from today's open (fetched from
    // port 6969). This gives the very first live tick a trusted baseline.
    symbols.forEach((sym, i) => {
      const code = companyCodes[i];
      const open = openingPricesRef.current[code];
      if (typeof open === 'number' && Number.isFinite(open) && open > 0) {
        referencePriceRef.current.set(sym, open);
      }
    });

    getSocket().emit('subscribe_companies', { companyCodes, symbols });
  }, [isConnected, allSidebarCompanies]);

  /* ── Whenever new opening prices arrive, seed any still-empty references ── */
  useEffect(() => {
    allSidebarCompanies.forEach(c => {
      const sym = `${c.exchange}:${c.company_code}-${c.marker || 'EQ'}`;
      const open = openingPricesRef.current[c.company_code];
      if (
        typeof open === 'number' && Number.isFinite(open) && open > 0 &&
        !referencePriceRef.current.has(sym)
      ) {
        referencePriceRef.current.set(sym, open);
      }
    });
  }, [openingPrices, allSidebarCompanies]);

  /* ── Compute sorted tile list (live: Red/Yellow/Green only — Blue goes to frozen section) ── */
  const sortedCompanies = useMemo(() => {
    const visible = allSidebarCompanies.filter(c =>
      selectedCodes.has(c.company_code) &&
      !(blueCheckDone && lockedColors.get(c.company_code) === 'blue')
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
  }, [allSidebarCompanies, selectedCodes, marketData, openingPrices, blueCheckDone, lockedColors]);

  /* -- Cluster-view groups: sorted companies split by live signal color -- */
  const clusterGroups = useMemo(() => {
    const groups: Record<'green' | 'yellow' | 'red', Company[]> = { green: [], yellow: [], red: [] };
    sortedCompanies.forEach(c => {
      const d = resolveMarketData(marketData, c);
      const col = getTileColor(c.company_code, d, blueCheckDone, lockedColors, openingPrices[c.company_code]);
      if (col === 'green' || col === 'yellow' || col === 'red') groups[col].push(c);
    });
    return groups;
  }, [sortedCompanies, marketData, blueCheckDone, lockedColors, openingPrices]);

  /* -- Momentum-view groups: top ~25% spotlighted, rest below -- */
  const momentumGroups = useMemo(() => {
    const spotCount = Math.max(3, Math.min(6, Math.ceil(sortedCompanies.length * 0.25)));
    return {
      spotlight: sortedCompanies.slice(0, spotCount),
      rest:      sortedCompanies.slice(spotCount),
    };
  }, [sortedCompanies]);

  /* -- Logic B (GTT Aligned) state (completely independent from Logic 1) --
  ───────────────────────────────────────────────────────────────────────────*/
  const [gttAligned, setGttAligned] = useState(false);
  /* Tile layout view for Logic 1 (no effect when gttAligned is ON) */
  type TileView = 'grid' | 'cluster' | 'ranked' | 'compact' | 'momentum';
  const [tileView, setTileView] = useState<TileView>('cluster');
  const [gttSnapshots, setGttSnapshots] = useState<Map<string, GttSnapshot>>(new Map());
  const [gttLoading, setGttLoading] = useState(false);
  const gttFetchingRef  = useRef(false);
  const gttIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Fetch GTT snapshots for all sidebar companies; refresh every 15 min while ON */
  useEffect(() => {
    if (!gttAligned) {
      if (gttIntervalRef.current) { clearInterval(gttIntervalRef.current); gttIntervalRef.current = null; }
      return;
    }

    const fetchAll = async () => {
      if (allSidebarCompanies.length === 0) { setGttLoading(false); return; }
      if (gttFetchingRef.current) return;
      gttFetchingRef.current = true;
      try {
        const codes  = allSidebarCompanies.map(c => c.company_code);
        const BATCH  = 5;
        const newMap = new Map<string, GttSnapshot>();
        for (let i = 0; i < codes.length; i += BATCH) {
          const batch = codes.slice(i, i + BATCH);
          const results = await Promise.allSettled(
            batch.map(async code => {
              try {
                const res = await fetch(
                  `/api/gtt-predictions?symbol=${encodeURIComponent(code)}`,
                  { cache: 'no-store', signal: AbortSignal.timeout(10000) },
                );
                if (!res.ok) return null;
                const data = await res.json();
                const l = data?.latest;
                if (!l) return null;
                const pt        = l.prediction_time ?? l.timestamp;
                const publishTs = parsePredictionTime(pt);
                if (!publishTs) return null;
                const basePrice = l.input_close as number;
                const horizons: [number, number, number, number, number] = [
                  l.S1_H1_pred, l.S1_H2_pred, l.S1_H3_pred, l.S1_H4_pred, l.S1_H5_pred,
                ];
                if (horizons.some(h => typeof h !== 'number')) return null;
                return { code, snap: { publishTs, basePrice, horizons } as GttSnapshot };
              } catch { return null; }
            }),
          );
          results.forEach(r => {
            if (r.status === 'fulfilled' && r.value) newMap.set(r.value.code, r.value.snap);
          });
        }
        setGttSnapshots(new Map(newMap));
      } finally {
        gttFetchingRef.current = false;
        setGttLoading(false);
      }
    };

    setGttLoading(true);
    fetchAll();
    gttIntervalRef.current = setInterval(fetchAll, GTT_HORIZON_MIN * 60 * 1000);
    return () => {
      if (gttIntervalRef.current) { clearInterval(gttIntervalRef.current); gttIntervalRef.current = null; }
    };
  }, [gttAligned, allSidebarCompanies]);

  /* Logic B sorted companies — all selected, no blue exclusion, sorted by devPct desc */
  const gttSortedCompanies = useMemo(() => {
    if (!gttAligned) return [] as Company[];
    const now     = new Date();
    const visible = allSidebarCompanies.filter(c => selectedCodes.has(c.company_code));
    return [...visible].sort((a, b) => {
      const snapA = gttSnapshots.get(a.company_code) ?? null;
      const snapB = gttSnapshots.get(b.company_code) ?? null;
      const { devPct: dA } = colorForTickGtt(snapA, resolveMarketData(marketData, a)?.ltp, now);
      const { devPct: dB } = colorForTickGtt(snapB, resolveMarketData(marketData, b)?.ltp, now);
      return (dB ?? -Infinity) - (dA ?? -Infinity);
    });
  }, [gttAligned, allSidebarCompanies, selectedCodes, marketData, gttSnapshots]);

  /* Logic B stats (for header badges when gttAligned is ON) */
  const gttStats = useMemo(() => {
    if (!gttAligned) return null;
    const now    = new Date();
    const counts: Record<GttTileColor, number> = { blue: 0, green: 0, yellow: 0, red: 0, black: 0, gray: 0 };
    gttSortedCompanies.forEach(c => {
      const snap = gttSnapshots.get(c.company_code) ?? null;
      const { color } = colorForTickGtt(snap, resolveMarketData(marketData, c)?.ltp, now);
      counts[color]++;
    });
    return counts;
  }, [gttAligned, gttSortedCompanies, gttSnapshots, marketData]);

  /* -- GTT Cluster-view groups: split by GTT signal color -- */
  const gttClusterGroups = useMemo(() => {
    const now = new Date();
    const groups: Record<'blue' | 'green' | 'yellow' | 'red', Company[]> = { blue: [], green: [], yellow: [], red: [] };
    gttSortedCompanies.forEach(c => {
      const data = resolveMarketData(marketData, c);
      const snap = gttSnapshots.get(c.company_code) ?? null;
      const { color } = colorForTickGtt(snap, data?.ltp, now);
      if (color === 'blue' || color === 'green' || color === 'yellow' || color === 'red') groups[color].push(c);
    });
    return groups;
  }, [gttSortedCompanies, marketData, gttSnapshots]);

  /* -- GTT Momentum-view groups: top ~25% spotlighted, rest below -- */
  const gttMomentumGroups = useMemo(() => {
    const spotCount = Math.max(3, Math.min(6, Math.ceil(gttSortedCompanies.length * 0.25)));
    return {
      spotlight: gttSortedCompanies.slice(0, spotCount),
      rest:      gttSortedCompanies.slice(spotCount),
    };
  }, [gttSortedCompanies]);

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
    // Blue companies are in the frozen section — count directly from lockedColors
    if (blueCheckDone) counts.blue = lockedColors.size;
    // Non-blue (live) companies
    sortedCompanies.forEach(c => {
      const d = resolveMarketData(marketData, c);
      counts[getTileColor(c.company_code, d, blueCheckDone, lockedColors, openingPrices[c.company_code])]++;
    });
    return counts;
  }, [sortedCompanies, marketData, blueCheckDone, lockedColors, openingPrices]);

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
          {/* Stats badges — Logic 1 or Logic B depending on toggle */}
          <div className="hidden sm:flex items-center gap-1.5">
            {gttAligned && gttStats ? (
              /* ── Logic B badges ── */
              <>
                {gttStats.blue > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-blue-500/50 text-blue-500 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{gttStats.blue}
                  </Badge>
                )}
                {gttStats.green > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald-500/50 text-emerald-500 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{gttStats.green}
                  </Badge>
                )}
                {gttStats.yellow > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-yellow-500/50 text-yellow-500 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />{gttStats.yellow}
                  </Badge>
                )}
                {gttStats.red > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-500/50 text-red-500 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{gttStats.red}
                  </Badge>
                )}
                {gttStats.black > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-zinc-600/50 text-zinc-400 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />{gttStats.black}
                  </Badge>
                )}
                {gttStats.gray > 0 && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-slate-400/50 text-slate-400 gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />{gttStats.gray}
                  </Badge>
                )}
              </>
            ) : (
              /* ── Logic 1 badges (unchanged) ── */
              <>
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
              </>
            )}
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', connDisplay.dot)} />
            <span
              className={cn('font-medium hidden sm:block cursor-default select-none', connDisplay.color)}
              title={
                connectionStatus === 'Connected'
                  ? `Connected to ${getActiveSocketUrl()}`
                  : connectionStatus
              }
            >
              {connectionStatus === 'Connected'
                ? <>{connDisplay.label} <span className={`text-[10px] font-normal opacity-70 ml-0.5 ${
                    socketSource === 'server'
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-amber-500 dark:text-amber-400'
                  }`}>({socketSource})</span></>
                : connDisplay.label}
            </span>
          </div>

          {/* GTT Aligned toggle */}
          <Button
            variant={gttAligned ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-7 px-2.5 text-[11px] font-semibold gap-1.5 shrink-0',
              gttAligned
                ? 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600'
                : 'border-violet-500/50 text-violet-500 hover:bg-violet-500/10',
            )}
            onClick={() => setGttAligned(v => !v)}
            title={gttAligned ? 'Switch back to Logic 1 (open-price signals)' : 'Switch to GTT Aligned (path-deviation signals)'}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', gttAligned ? 'bg-white' : 'bg-violet-500')} />
            GTT Aligned
          </Button>

          <ModeToggle />
        </header>

        {/* ── Market Closed Banner — visible only when market is closed and FORCE_MARKET_OPEN=false ── */}
        <MarketClosedBanner />

        {/* ── BODY: tile grid + right sidebar ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Main tile area ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Legend + View Switcher */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Market Movers
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {gttAligned ? gttSortedCompanies.length : sortedCompanies.length} tiles
                  </Badge>
                  {gttAligned && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-violet-500/50 text-violet-400">
                      GTT Aligned
                    </Badge>
                  )}
                </h2>
                {/* View switcher */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px] font-medium shrink-0">
                        {tileView === 'grid'     && <LayoutGrid    className="h-3 w-3" />}
                        {tileView === 'cluster'  && <Layers        className="h-3 w-3" />}
                        {tileView === 'ranked'   && <AlignJustify  className="h-3 w-3" />}
                        {tileView === 'compact'  && <Grid3X3       className="h-3 w-3" />}
                        {tileView === 'momentum' && <Star          className="h-3 w-3" />}
                        {{ grid: 'Grid', cluster: 'Cluster', ranked: 'Ranked', compact: 'Compact', momentum: 'Momentum' }[tileView]}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">Layout View</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {([
                        { key: 'grid',     Icon: LayoutGrid,   label: 'Grid',     desc: '3-column mixed layout' },
                        { key: 'cluster',  Icon: Layers,       label: 'Cluster',  desc: 'Grouped by signal color' },
                        { key: 'ranked',   Icon: AlignJustify, label: 'Ranked',   desc: 'List sorted by % change' },
                        { key: 'compact',  Icon: Grid3X3,      label: 'Compact',  desc: '5-column dense grid' },
                        { key: 'momentum', Icon: Star,         label: 'Momentum', desc: 'Top movers spotlighted' },
                      ] as { key: TileView; Icon: React.ComponentType<any>; label: string; desc: string }[]).map(({ key, Icon, label, desc }) => (
                        <DropdownMenuItem key={key} onClick={() => setTileView(key)} className="flex items-start gap-2 py-2 cursor-pointer">
                          <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-none">{label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          {tileView === key && <Check className="h-3 w-3 ml-auto mt-0.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {gttAligned ? <GttLegendInfoButton /> : <LegendInfoButton />}
            </div>

            {/* Tile grid + Blue frozen section — all in one scrollable container */}
            <div className="flex-1 overflow-auto p-4 space-y-4">

              {/* Loading / empty states */}
              {wsLoading && sortedCompanies.length === 0 && !blueCheckDone ? (
                <div className="flex items-center justify-center h-40 gap-3 text-muted-foreground text-sm">
                  <Activity className="h-4 w-4 animate-pulse" />
                  <span>Connecting to live feed…</span>
                </div>
              ) : !isConnected && sortedCompanies.length === 0 && !blueCheckDone ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground text-sm">
                  <WifiOff className="h-6 w-6" />
                  <span>Waiting for connection…</span>
                  {wsError && (
                    <span className="text-xs text-red-400">{wsError}</span>
                  )}
                </div>
              ) : sortedCompanies.length === 0 && lockedColors.size === 0 ? (
                <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                  No companies selected. Check companies in the sidebar to show tiles.
                </div>
              ) : null}

              {/* Blue snapshot check in progress */}
              {blueCheckRunning && (
                <div className="flex items-center gap-2 px-1 text-xs text-blue-500">
                  <Activity className="h-3.5 w-3.5 animate-pulse" />
                  <span>Running 10:30 AM Blue snapshot check…</span>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  Logic B — GTT Aligned (rendered only when toggle is ON)
                  Logic 1 state is completely untouched here.
              ══════════════════════════════════════════════════════════════ */}
              {/* ══════════════════════════════════════════════════════════════
                  Logic B — GTT Aligned (all 5 views, mirrors Logic 1)
              ══════════════════════════════════════════════════════════════ */}
              {gttAligned && (
                gttLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-5">
                    <div className="h-10 w-10 rounded-full border-2 border-violet-500/25 border-t-violet-500 animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-foreground">Loading GTT predictions</p>
                      <p className="text-xs text-muted-foreground">
                        Fetching predictions for {allSidebarCompanies.length} companies&hellip;
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-pulse" />
                      <span>GTT Aligned Mode</span>
                    </div>
                  </div>
                ) : (
                <LayoutGroup id="gtt-tiles">
                  {gttSortedCompanies.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                      No companies selected. Check companies in the sidebar.
                    </div>
                  ) : (
                    <>
                      {/* GTT GRID */}
                      {tileView === 'grid' && (
                        <motion.div layout className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                          <AnimatePresence mode="popLayout">
                            {gttSortedCompanies.map(company => {
                              const data = resolveMarketData(marketData, company);
                              const snap = gttSnapshots.get(company.company_code) ?? null;
                              const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                              return (
                                <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                  transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                  <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </motion.div>
                      )}

                      {/* GTT CLUSTER: green / yellow / red columns */}
                      {tileView === 'cluster' && (
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                          {(['green', 'yellow', 'red'] as const).map(col => {
                            const companies = gttClusterGroups[col];
                            const labelMap  = { green: 'Above Path ≥0%', yellow: 'Near Path −5% to 0', red: 'Below Path −10% to −5%' };
                            const borderMap = { green: 'border-green-500/25 bg-green-500/5', yellow: 'border-yellow-500/25 bg-yellow-500/5', red: 'border-red-500/25 bg-red-500/5' };
                            const textMap   = { green: 'text-green-500 dark:text-green-400', yellow: 'text-yellow-500 dark:text-yellow-400', red: 'text-red-500 dark:text-red-400' };
                            return (
                              <div key={col} className={cn('border rounded-2xl p-3 flex flex-col', borderMap[col])}>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', GTT_CIRCLE_CLASS[col])} />
                                  <span className={cn('text-xs font-semibold', textMap[col])}>{labelMap[col]}</span>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">{companies.length}</Badge>
                                </div>
                                <AnimatePresence mode="popLayout">
                                  <motion.div layout className="flex flex-col gap-2">
                                    {companies.length === 0
                                      ? <p className="text-[10px] text-muted-foreground text-center py-4">No companies</p>
                                      : companies.map(company => {
                                          const data = resolveMarketData(marketData, company);
                                          const snap = gttSnapshots.get(company.company_code) ?? null;
                                          const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                                          return (
                                            <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.18 } }}>
                                              <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                            </motion.div>
                                          );
                                        })
                                    }
                                  </motion.div>
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* GTT RANKED */}
                      {tileView === 'ranked' && (
                        <motion.div layout className="flex flex-col gap-2">
                          <AnimatePresence mode="popLayout">
                            {gttSortedCompanies.map((company, idx) => {
                              const data = resolveMarketData(marketData, company);
                              const snap = gttSnapshots.get(company.company_code) ?? null;
                              const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                              return (
                                <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                  className="flex items-center gap-3"
                                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                                  transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.18 } }}>
                                  <span className="text-[10px] font-mono text-muted-foreground w-6 text-right shrink-0">#{idx + 1}</span>
                                  <div className="flex-1">
                                    <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </motion.div>
                      )}

                      {/* GTT COMPACT */}
                      {tileView === 'compact' && (
                        <motion.div layout className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                          <AnimatePresence mode="popLayout">
                            {gttSortedCompanies.map(company => {
                              const data = resolveMarketData(marketData, company);
                              const snap = gttSnapshots.get(company.company_code) ?? null;
                              const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                              return (
                                <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                  transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                  <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </motion.div>
                      )}

                      {/* GTT MOMENTUM */}
                      {tileView === 'momentum' && (
                        <div className="space-y-6">
                          {gttMomentumGroups.spotlight.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <Star className="h-3.5 w-3.5 text-yellow-500" />
                                <span className="text-xs font-semibold text-foreground">Top Movers</span>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{gttMomentumGroups.spotlight.length}</Badge>
                              </div>
                              <motion.div layout className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                                <AnimatePresence mode="popLayout">
                                  {gttMomentumGroups.spotlight.map(company => {
                                    const data = resolveMarketData(marketData, company);
                                    const snap = gttSnapshots.get(company.company_code) ?? null;
                                    const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                                    return (
                                      <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                        <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                      </motion.div>
                                    );
                                  })}
                                </AnimatePresence>
                              </motion.div>
                            </div>
                          )}
                          {gttMomentumGroups.rest.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-medium text-muted-foreground">Tracking</span>
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{gttMomentumGroups.rest.length}</Badge>
                              </div>
                              <motion.div layout className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                <AnimatePresence mode="popLayout">
                                  {gttMomentumGroups.rest.map(company => {
                                    const data = resolveMarketData(marketData, company);
                                    const snap = gttSnapshots.get(company.company_code) ?? null;
                                    const { color: gttC, devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                                    return (
                                      <motion.div key={company.company_code} layout layoutId={`gtt-${company.company_code}`}
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                        <CompanyTile company={company} data={data} color="grey" gttColor={gttC} devPct={devPct} />
                                      </motion.div>
                                    );
                                  })}
                                </AnimatePresence>
                              </motion.div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* GTT BLUE — always at bottom across all views */}
                      {gttClusterGroups.blue.length > 0 && (
                        <div className="border border-blue-500/25 rounded-2xl p-4 bg-blue-500/5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', GTT_CIRCLE_CLASS.blue)} />
                            <span className="text-sm font-semibold text-blue-500 dark:text-blue-400">Blue — Strongly Above GTT Path</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-500/50 text-blue-500">{gttClusterGroups.blue.length}</Badge>
                            <span className="text-xs text-muted-foreground ml-1">≥2% above the GTT forecast path</span>
                          </div>
                          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            {gttClusterGroups.blue.map(company => {
                              const data = resolveMarketData(marketData, company);
                              const snap = gttSnapshots.get(company.company_code) ?? null;
                              const { devPct } = colorForTickGtt(snap, data?.ltp, new Date());
                              return <CompanyTile key={company.company_code} company={company} data={data} color="grey" gttColor="blue" devPct={devPct} />;
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </LayoutGroup>
                )
              )}

              {/* ══════════════════════════════════════════════════════════════
                  Logic 1 — original open-price signals (rendered only when
                  toggle is OFF). Multi-view support via tileView state.
              ══════════════════════════════════════════════════════════════ */}
              {!gttAligned && (
                <LayoutGroup id="l1-tiles">
                  <>
                  {/* ── GRID view (default): 3-column mixed layout ── */}
                  {tileView === 'grid' && sortedCompanies.length > 0 && (
                    <motion.div layout className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      <AnimatePresence mode="popLayout">
                        {sortedCompanies.map(company => {
                          const data = resolveMarketData(marketData, company);
                          const color = getTileColor(company.company_code, data, blueCheckDone, lockedColors, openingPrices[company.company_code]);
                          return (
                            <motion.div key={company.company_code} layout layoutId={company.company_code}
                              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                              <CompanyTile company={company} data={data} color={color} />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ── CLUSTER view: 3 colour columns side by side ── */}
                  {tileView === 'cluster' && (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      {(['green', 'yellow', 'red'] as const).map(col => {
                        const companies = clusterGroups[col];
                        const labelMap  = { green: 'Above Open ≥1.5%', yellow: 'Above Open 0–1.5%', red: 'Below Open' };
                        const borderMap = { green: 'border-green-500/25 bg-green-500/5', yellow: 'border-yellow-500/25 bg-yellow-500/5', red: 'border-red-500/25 bg-red-500/5' };
                        const textMap   = { green: 'text-green-500 dark:text-green-400', yellow: 'text-yellow-500 dark:text-yellow-400', red: 'text-red-500 dark:text-red-400' };
                        return (
                          <div key={col} className={cn('border rounded-2xl p-3 flex flex-col', borderMap[col])}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', CIRCLE_CLASS[col])} />
                              <span className={cn('text-xs font-semibold', textMap[col])}>{labelMap[col]}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">{companies.length}</Badge>
                            </div>
                            <AnimatePresence mode="popLayout">
                              <motion.div layout className="flex flex-col gap-2">
                                {companies.length === 0
                                  ? <p className="text-[10px] text-muted-foreground text-center py-4">No companies</p>
                                  : companies.map(company => {
                                      const data = resolveMarketData(marketData, company);
                                      return (
                                        <motion.div key={company.company_code} layout layoutId={company.company_code}
                                          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                          transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.18 } }}>
                                          <CompanyTile company={company} data={data} color={col} />
                                        </motion.div>
                                      );
                                    })
                                }
                              </motion.div>
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── RANKED view: 1-column sorted list ── */}
                  {tileView === 'ranked' && sortedCompanies.length > 0 && (
                    <motion.div layout className="flex flex-col gap-2">
                      <AnimatePresence mode="popLayout">
                        {sortedCompanies.map((company, idx) => {
                          const data  = resolveMarketData(marketData, company);
                          const color = getTileColor(company.company_code, data, blueCheckDone, lockedColors, openingPrices[company.company_code]);
                          return (
                            <motion.div key={company.company_code} layout layoutId={company.company_code}
                              className="flex items-center gap-3"
                              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.18 } }}>
                              <span className="text-[10px] font-mono text-muted-foreground w-6 text-right shrink-0">#{idx + 1}</span>
                              <div className="flex-1">
                                <CompanyTile company={company} data={data} color={color} />
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ── COMPACT view: 5-column dense grid ── */}
                  {tileView === 'compact' && sortedCompanies.length > 0 && (
                    <motion.div layout className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                      <AnimatePresence mode="popLayout">
                        {sortedCompanies.map(company => {
                          const data  = resolveMarketData(marketData, company);
                          const color = getTileColor(company.company_code, data, blueCheckDone, lockedColors, openingPrices[company.company_code]);
                          return (
                            <motion.div key={company.company_code} layout layoutId={company.company_code}
                              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                              transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                              <CompanyTile company={company} data={data} color={color} />
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ── MOMENTUM view: spotlight top movers + rest below ── */}
                  {tileView === 'momentum' && (
                    <div className="space-y-6">
                      {momentumGroups.spotlight.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Star className="h-3.5 w-3.5 text-yellow-500" />
                            <span className="text-xs font-semibold text-foreground">Top Movers</span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{momentumGroups.spotlight.length}</Badge>
                          </div>
                          <motion.div layout className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            <AnimatePresence mode="popLayout">
                              {momentumGroups.spotlight.map(company => {
                                const data  = resolveMarketData(marketData, company);
                                const color = getTileColor(company.company_code, data, blueCheckDone, lockedColors, openingPrices[company.company_code]);
                                return (
                                  <motion.div key={company.company_code} layout layoutId={company.company_code}
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                    <CompanyTile company={company} data={data} color={color} />
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </motion.div>
                        </div>
                      )}
                      {momentumGroups.rest.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-muted-foreground">Tracking</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{momentumGroups.rest.length}</Badge>
                          </div>
                          <motion.div layout className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <AnimatePresence mode="popLayout">
                              {momentumGroups.rest.map(company => {
                                const data  = resolveMarketData(marketData, company);
                                const color = getTileColor(company.company_code, data, blueCheckDone, lockedColors, openingPrices[company.company_code]);
                                return (
                                  <motion.div key={company.company_code} layout layoutId={company.company_code}
                                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ layout: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 }, scale: { duration: 0.2 } }}>
                                    <CompanyTile company={company} data={data} color={color} />
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </motion.div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Blue Frozen Section — always at bottom for all views ── */}
                  {blueCheckDone && lockedColors.size > 0 && (
                    <div className="border border-blue-500/25 rounded-2xl p-4 bg-blue-500/5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', CIRCLE_CLASS.blue)} />
                        <span className="text-sm font-semibold text-blue-500 dark:text-blue-400">
                          Blue — Confirmed at 10:30 AM
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-blue-500/50 text-blue-500">
                          {lockedColors.size}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-1">
                          ≥2% above opening price — frozen for the day
                        </span>
                      </div>
                      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        {[...lockedColors.keys()].sort().map(code => {
                          const company = allSidebarCompanies.find(c => c.company_code === code) ?? {
                            company_code: code, name: code, exchange: 'NSE', marker: 'EQ',
                          } as Company;
                          const data = resolveMarketData(marketData, company);
                          return (
                            <CompanyTile
                              key={code}
                              company={company}
                              data={data}
                              color="blue"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </>
                </LayoutGroup>
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
