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

type TileColor = 'blue' | 'green' | 'yellow' | 'red';

const COLOR_ORDER: Record<TileColor, number> = {
  blue: 0,
  green: 1,
  yellow: 2,
  red: 3,
};

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

/** Extract company_code from a Fyers symbol string (e.g. "NSE:ADANIGREEN-EQ" → "ADANIGREEN") */
function codeFromSymbol(symbol: string): string | null {
  const parts = symbol.split(':');
  if (parts.length !== 2) return null;
  return parts[1].split('-')[0] || null;
}

/** Returns true if the current UTC time is at or before 10:00 AM IST */
function isBeforeOrAt10AMIST(): boolean {
  const now = new Date();
  // IST = UTC + 5 hours 30 minutes = 330 minutes
  const utcTotalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istTotalMinutes = (utcTotalMinutes + 330) % (24 * 60);
  return istTotalMinutes <= 10 * 60; // <= 10:00 AM
}

/** Determine tile color for a company */
function getTileColor(
  companyCode: string,
  data: MarketData | undefined,
  blueFlags: Set<string>
): TileColor {
  if (blueFlags.has(companyCode)) return 'blue';
  if (!data) return 'yellow';
  const change = data.change ?? 0;
  if (change > 0) return 'green';
  if (change < 0) return 'red';
  return 'yellow';
}

/* ─────────────────────────────────────────────────────────────────────────────
   Tile color styles
───────────────────────────────────────────────────────────────────────────── */
const CIRCLE_CLASS: Record<TileColor, string> = {
  blue: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
  green: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  yellow: 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]',
  red: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]',
};

const CHANGE_TEXT_CLASS: Record<TileColor, string> = {
  blue: 'text-blue-500 dark:text-blue-400',
  green: 'text-emerald-500 dark:text-emerald-400',
  yellow: 'text-yellow-500 dark:text-yellow-400',
  red: 'text-red-500 dark:text-red-400',
};

const TILE_BORDER_CLASS: Record<TileColor, string> = {
  blue: 'border-blue-500/30 hover:border-blue-500/60',
  green: 'border-emerald-500/20 hover:border-emerald-500/50',
  yellow: 'border-yellow-400/20 hover:border-yellow-400/50',
  red: 'border-red-500/20 hover:border-red-500/50',
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
        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-card transition-colors cursor-default select-none',
        TILE_BORDER_CLASS[color]
      )}
      style={{ minWidth: '220px', width: '220px' }}
    >
      {/* ① Color indicator circle */}
      <div
        className={cn(
          'w-3 h-3 rounded-full shrink-0 transition-colors',
          CIRCLE_CLASS[color]
        )}
      />

      {/* ③ Company name */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs leading-tight truncate">
          {company.company_code}
        </div>
        {hasData && ltp !== undefined && (
          <div className="text-[10px] text-muted-foreground tabular-nums leading-none mt-0.5">
            ₹{ltp.toFixed(2)}
          </div>
        )}
      </div>

      {/* ② Price change + percentage */}
      {hasData ? (
        <div
          className={cn(
            'text-[11px] font-semibold tabular-nums shrink-0 text-right leading-tight',
            CHANGE_TEXT_CLASS[color]
          )}
        >
          <div className="flex items-center gap-0.5 justify-end">
            {change === 0 ? (
              <Minus className="h-2.5 w-2.5" />
            ) : change > 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : (
              <TrendingDown className="h-2.5 w-2.5" />
            )}
            <span>{change >= 0 ? '+' : ''}{change.toFixed(2)}</span>
          </div>
          <div className="text-[9px] font-medium opacity-80">
            ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </div>
        </div>
      ) : (
        <WifiOff className="h-3 w-3 text-muted-foreground shrink-0" />
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
        { color: 'blue', label: 'Early spike ≥2% by 10 AM IST' },
        { color: 'green', label: 'Positive change' },
        { color: 'yellow', label: 'Flat / no data' },
        { color: 'red', label: 'Negative change' },
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

  /* ── Blue flag tracking ── */
  const blueFlagsRef = useRef<Set<string>>(new Set());
  const [blueFlags, setBlueFlags] = useState<Set<string>>(new Set());

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

  /* ── Blue flag detection ── */
  useEffect(() => {
    // Blue flags can only be set at/before 10 AM IST; after that, existing flags are kept
    if (!isBeforeOrAt10AMIST() && blueFlagsRef.current.size > 0) return;
    if (!isBeforeOrAt10AMIST()) return;

    let changed = false;
    Object.values(marketData).forEach((data: MarketData) => {
      if (!data.open || data.open === 0) return;
      const code = codeFromSymbol(data.symbol);
      if (!code || blueFlagsRef.current.has(code)) return;

      const spikeFromOpen = (data.ltp - data.open) / data.open;
      if (spikeFromOpen >= 0.02) {
        blueFlagsRef.current.add(code);
        changed = true;
      }
    });

    if (changed) {
      setBlueFlags(new Set(blueFlagsRef.current));
    }
  }, [marketData]);

  /* ── Compute sorted tile list ── */
  const sortedCompanies = useMemo(() => {
    const visible = allSidebarCompanies.filter(c =>
      selectedCodes.has(c.company_code)
    );

    return [...visible].sort((a, b) => {
      const dataA = resolveMarketData(marketData, a);
      const dataB = resolveMarketData(marketData, b);
      const colorA = getTileColor(a.company_code, dataA, blueFlags);
      const colorB = getTileColor(b.company_code, dataB, blueFlags);

      // Primary: color priority
      if (COLOR_ORDER[colorA] !== COLOR_ORDER[colorB]) {
        return COLOR_ORDER[colorA] - COLOR_ORDER[colorB];
      }

      const changeA = dataA?.change ?? 0;
      const changeB = dataB?.change ?? 0;

      // Secondary: within green/blue → largest positive first
      if (colorA === 'green' || colorA === 'blue') {
        return changeB - changeA;
      }
      // Within red → most negative last (ascending by change value)
      if (colorA === 'red') {
        return changeA - changeB;
      }
      // Within yellow → alphabetical
      return a.company_code.localeCompare(b.company_code);
    });
  }, [allSidebarCompanies, selectedCodes, marketData, blueFlags]);

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
    const blue = sortedCompanies.filter(c => blueFlags.has(c.company_code)).length;
    const green = sortedCompanies.filter(c => {
      if (blueFlags.has(c.company_code)) return false;
      const d = resolveMarketData(marketData, c);
      return (d?.change ?? 0) > 0;
    }).length;
    const red = sortedCompanies.filter(c => {
      if (blueFlags.has(c.company_code)) return false;
      const d = resolveMarketData(marketData, c);
      return (d?.change ?? 0) < 0;
    }).length;
    const yellow = sortedCompanies.length - blue - green - red;
    return { blue, green, red, yellow };
  }, [sortedCompanies, marketData, blueFlags]);

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
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-emerald-500/50 text-emerald-500 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {stats.green}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-yellow-500/50 text-yellow-500 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {stats.yellow}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-red-500/50 text-red-500 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {stats.red}
            </Badge>
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
                  className="flex flex-wrap gap-2.5 content-start"
                >
                  <AnimatePresence mode="popLayout">
                    {sortedCompanies.map(company => {
                      const data = resolveMarketData(marketData, company);
                      const color = getTileColor(company.company_code, data, blueFlags);

                      return (
                        <motion.div
                          key={company.company_code}
                          layout
                          layoutId={company.company_code}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
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
