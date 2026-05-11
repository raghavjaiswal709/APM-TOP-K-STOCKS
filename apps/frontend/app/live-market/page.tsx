// @ts-nocheck
'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppSidebar } from "../components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ModeToggle } from "../components/toggleButton";
import { Badge } from "@/components/ui/badge";
import LiveMarketGrid from './components/LiveMarketGrid';
import LiveMarketSidebar from './components/LiveMarketSidebar';
import { useLiveMarket } from '../../hooks/useLiveMarket';
import { useWatchlist } from '../../hooks/useWatchlist';
import {
  Activity,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
  is_expired?: boolean;
  hours_until_expiry?: number;
  jwt_expires_at?: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Inner component — uses useSearchParams (requires Suspense wrapper)
───────────────────────────────────────────────────────────────────────── */
const LiveMarketInner: React.FC = () => {
  const searchParams = useSearchParams();

  /* ── Live market WebSocket hook ── */
  const {
    selectedCompanies: subscribedCompanies,
    marketData,
    historicalData,
    marketStatus,
    connectionStatus,
    socketSource,
    error,
    loading,
    subscribeToCompanies,
    subscribeByCompanyCodes,
    unsubscribeAll,
    isConnected,
  } = useLiveMarket();

  /* ── Watchlist (for URL-param auto-subscribe company lookup) ── */
  const { companies: watchlistCompanies } = useWatchlist({ showAllCompanies: true });

  /* ── Auth ── */
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchAuthStatus = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch('/api/auth/fyers/status');
      setAuthStatus(await res.json());
    } catch {
      setAuthStatus(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
    const interval = setInterval(fetchAuthStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchAuthStatus]);

  /* ── Sidebar resize / collapse ── */
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const isSidebarDragging = useRef(false);

  const handleSidebarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isSidebarDragging.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const onMouseMove = (e: MouseEvent) => {
        if (!isSidebarDragging.current) return;
        const newWidth = Math.max(240, Math.min(520, startWidth - (e.clientX - startX)));
        setSidebarWidth(newWidth);
      };
      const onMouseUp = () => {
        isSidebarDragging.current = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sidebarWidth]
  );

  /* ── FIX Bug-3 + Bug-2: URL params + sessionStorage restoration + subscription MERGING ── */
  const STORAGE_KEY = 'live-market-subscribed-codes';
  const autoSubscribeDoneRef = useRef(false);

  /**
   * Collect ALL codes to subscribe: URL params ∪ sessionStorage-saved codes.
   * Runs once per mount (sync — no async needed).
   */
  const pendingCodesRef = useRef<string[]>([]);
  useEffect(() => {
    const urlParam = searchParams.get('companies');
    const urlCodes = urlParam
      ? urlParam.split(',').map(c => c.trim()).filter(Boolean)
      : [];

    let savedCodes: string[] = [];
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) savedCodes = JSON.parse(raw);
    } catch { /* ignore */ }

    // Merge URL codes FIRST (they take priority as "newly requested")
    pendingCodesRef.current = [...new Set([...urlCodes, ...savedCodes])];
  }, [searchParams]);

  // Auto-subscribe when connection + auth are ready
  useEffect(() => {
    if (
      autoSubscribeDoneRef.current ||
      pendingCodesRef.current.length === 0 ||
      !isConnected ||
      !authStatus?.authenticated ||
      !authStatus?.token_valid
    ) return;

    autoSubscribeDoneRef.current = true;
    subscribeByCompanyCodes(pendingCodesRef.current);
  }, [isConnected, authStatus, subscribeByCompanyCodes]);

  // FIX Bug-3: Persist subscribed company codes to sessionStorage whenever they change
  useEffect(() => {
    if (subscribedCompanies.length === 0) return;
    const codes = subscribedCompanies.map(c => c.company_code);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
    } catch { /* ignore */ }
  }, [subscribedCompanies]);

  /* ── Subscribe handler (from sidebar) — FIX Bug-2: MERGE, not replace ── */
  const handleSubscribe = useCallback(
    (newCodes: string[]) => {
      if (!authStatus?.authenticated || !authStatus?.token_valid) return;
      // Merge new codes with currently subscribed codes
      const currentCodes = subscribedCompanies.map(c => c.company_code);
      const merged = [...new Set([...currentCodes, ...newCodes])];
      subscribeByCompanyCodes(merged);
    },
    [subscribeByCompanyCodes, authStatus, subscribedCompanies]
  );

  const handleClear = useCallback(() => {
    unsubscribeAll();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, [unsubscribeAll]);

  /* ── Auth display ── */
  const getAuthDisplay = () => {
    if (authLoading)                                         return { icon: Activity,     color: 'text-blue-500',   text: 'Checking…' };
    if (!authStatus)                                         return { icon: XCircle,      color: 'text-red-500',    text: 'Unknown'   };
    if (authStatus.is_expired)                               return { icon: XCircle,      color: 'text-red-500',    text: 'Expired'   };
    if (authStatus.authenticated && authStatus.token_valid)  return { icon: CheckCircle,  color: 'text-green-500',  text: 'Active'    };
    if (authStatus.authenticated)                            return { icon: AlertCircle,  color: 'text-yellow-500', text: 'Expired'   };
    return { icon: XCircle, color: 'text-red-500', text: 'Required' };
  };

  const authDisplay   = getAuthDisplay();
  const AuthIcon      = authDisplay.icon;
  const isAuthenticated = !!(authStatus?.authenticated && authStatus?.token_valid);

  /* ── Grid companies (ensure symbol/marker present) ── */
  const gridCompanies = React.useMemo(
    () =>
      subscribedCompanies.map(c => ({
        ...c,
        marker: c.marker || 'EQ',
        symbol: c.symbol || `${c.exchange}:${c.company_code}-${c.marker || 'EQ'}`,
      })),
    [subscribedCompanies]
  );

  /* ────────────────────────── RENDER ───────────────────────────── */
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
                <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Live Market Grid</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            {/* Connection dot */}
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isConnected
                    ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]'
                    : connectionStatus === 'Reconnecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <span
                className={`font-medium cursor-default select-none ${
                  isConnected
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : connectionStatus === 'Reconnecting'
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
                title={
                  isConnected
                    ? socketSource === 'server'
                      ? 'Connected to remote server (100.93.172.21:5010)'
                      : 'Connected to localhost:5010 (remote server unreachable)'
                    : connectionStatus
                }
              >
                {isConnected
                  ? <>Live <span className={`text-[10px] font-normal opacity-70 ml-0.5 ${
                      socketSource === 'server'
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-amber-500 dark:text-amber-400'
                    }`}>({socketSource})</span></>
                  : connectionStatus}
              </span>
            </div>

            <Separator orientation="vertical" className="h-4" />

            {/* Auth badge */}
            <a href="/auth" className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <AuthIcon className={`w-3.5 h-3.5 ${authDisplay.color}`} />
              <span className="font-medium hidden sm:inline">Auth: {authDisplay.text}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
            </a>

            <Separator orientation="vertical" className="h-4" />

            {/* Market status */}
            {marketStatus?.trading_active ? (
              <Badge className="h-6 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-0">
                <Activity className="w-3 h-3 mr-1" />
                Market Open
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-6 text-xs">
                Market Closed
              </Badge>
            )}

            <ModeToggle />
          </div>
        </header>

        {/* Auth warning banner */}
        {!isAuthenticated && !authLoading && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border-b border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-2 text-sm flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Fyers authentication required to subscribe to live market data.</span>
            <a
              href="/auth"
              className="ml-auto flex items-center gap-1 font-medium text-xs"
            >
              Authenticate <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* ── MAIN ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left: market grid — uses all available height */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Inline messages (shrink, not grow) */}
            {error &&
              !error.includes('invalid_symbols') &&
              !error.includes('-300') &&
              !error.includes('STOPPED') && (
                <div className="mx-4 mt-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-1.5 rounded-md text-sm shrink-0">
                  ❌ {error}
                </div>
              )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mx-4 mt-2 shrink-0">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary" />
                <span>Subscribing to market data…</span>
              </div>
            )}

            {/* Grid or empty state — flex-1 fills remaining height */}
            {gridCompanies.length > 0 ? (
              <div className="flex-1 min-h-0 p-3 flex flex-col">
                <LiveMarketGrid
                  selectedCompanies={gridCompanies}
                  marketData={marketData}
                  historicalData={historicalData}
                  connectionStatus={connectionStatus}
                  loading={loading}
                  className="flex-1 min-h-0"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4 p-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <TrendingUp size={32} />
                </div>
                <h2 className="text-xl font-semibold text-foreground">No Companies Subscribed</h2>
                <p className="text-sm text-center max-w-md">
                  {isAuthenticated
                    ? 'Select companies from the sidebar on the right, then click Subscribe.'
                    : 'Authenticate with Fyers first, then select and subscribe to companies.'}
                </p>
              </div>
            )}
          </div>

          {/* Right: collapsible + resizable sidebar */}
          {isSidebarVisible ? (
            <div
              className="relative bg-background flex flex-col shrink-0 border-l"
              style={{ width: sidebarWidth }}
            >
              {/* Drag handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/40 active:bg-primary/60 z-10 group"
                onMouseDown={handleSidebarMouseDown}
                title="Drag to resize"
              >
                <div className="absolute inset-y-0 -left-0.5 w-2 group-hover:bg-primary/20" />
              </div>

              {/* Sidebar header */}
              <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/20 shrink-0">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider pl-1">
                  Live Companies
                </span>
                <button
                  onClick={() => setIsSidebarVisible(false)}
                  className="p-0.5 rounded hover:bg-accent transition-colors"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                <LiveMarketSidebar
                  subscribedCompanies={subscribedCompanies}
                  marketData={marketData}
                  onSubscribe={handleSubscribe}
                  onClear={handleClear}
                  loading={loading}
                  disabled={!isAuthenticated}
                />
              </div>
            </div>
          ) : (
            /* Collapsed sidebar strip */
            <div className="w-8 bg-background border-l flex flex-col items-center py-2 shrink-0">
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Expand sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="mt-2 flex-1 flex items-center">
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  Companies
                </span>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   Page wrapper — Suspense required for useSearchParams in Next.js App Router
───────────────────────────────────────────────────────────────────────── */
const LiveMarketPage: React.FC = () => (
  <Suspense
    fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }
  >
    <LiveMarketInner />
  </Suspense>
);

export default LiveMarketPage;
