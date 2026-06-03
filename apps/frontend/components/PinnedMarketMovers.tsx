// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getSocket, isSocketConnected, onSocketSourceChange } from '@/lib/socket';
import { X, WifiOff, TrendingUp, TrendingDown, Minus, GripHorizontal } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────── */
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

/* ─── Color maps ──────────────────────────────────────────────────────── */
const CIRCLE_CLASS: Record<TileColor, string> = {
  blue:   'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]',
  green:  'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
  yellow: 'bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.8)]',
  red:    'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]',
  grey:   'bg-slate-400 shadow-[0_0_4px_rgba(148,163,184,0.3)]',
};
const CHANGE_TEXT_CLASS: Record<TileColor, string> = {
  blue:   'text-blue-400',
  green:  'text-emerald-400',
  yellow: 'text-yellow-400',
  red:    'text-red-400',
  grey:   'text-slate-400',
};
const TILE_BORDER_CLASS: Record<TileColor, string> = {
  blue:   'border-blue-500/30 hover:border-blue-500/60',
  green:  'border-emerald-500/20 hover:border-emerald-500/50',
  yellow: 'border-yellow-400/20 hover:border-yellow-400/50',
  red:    'border-red-500/20 hover:border-red-500/50',
  grey:   'border-slate-400/15 hover:border-slate-400/35',
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function resolveMarketData(
  store: Record<string, MarketData>,
  company: Company
): MarketData | undefined {
  const fyers = `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
  if (store[fyers]) return store[fyers];
  if (store[company.company_code]) return store[company.company_code];
  return undefined;
}

function computeColor(data: MarketData): TileColor {
  if (data.ltp == null) return 'grey';
  if (data.changePercent != null) {
    if (data.changePercent >= 1.5) return 'green';
    if (data.changePercent >= 0) return 'yellow';
    return 'red';
  }
  const open = data.open > 0 ? data.open : 0;
  if (!open) return 'grey';
  const pct = ((data.ltp - open) / open) * 100;
  if (pct >= 1.5) return 'green';
  if (pct >= 0) return 'yellow';
  return 'red';
}

/* ─── Mini tile ───────────────────────────────────────────────────────── */
const MiniTile: React.FC<{ company: Company; data: MarketData | undefined }> = ({ company, data }) => {
  const color: TileColor = data ? computeColor(data) : 'grey';
  const change = data?.change ?? 0;
  const changePercent = data?.changePercent ?? 0;
  const ltp = data?.ltp;

  const handleClick = () => {
    const marker = company.marker || 'EQ';
    const url = `/cluster-overlay?company=${encodeURIComponent(company.company_code)}&exchange=${encodeURIComponent(company.exchange)}&marker=${encodeURIComponent(marker)}`;
    window.open(url, '_blank');
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-xl border bg-zinc-900 cursor-pointer select-none transition-colors hover:brightness-110 active:scale-[0.97]',
        TILE_BORDER_CLASS[color]
      )}
    >
      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', CIRCLE_CLASS[color])} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-xs leading-tight truncate">{company.company_code}</div>
        {ltp !== undefined && (
          <div className="text-[10px] text-zinc-400 tabular-nums leading-none mt-0.5">₹{ltp.toFixed(2)}</div>
        )}
      </div>
      {data ? (
        <div className={cn('text-[10px] font-bold tabular-nums text-right shrink-0', CHANGE_TEXT_CLASS[color])}>
          <div className="flex items-center gap-0.5 justify-end">
            {change === 0 ? <Minus className="h-2.5 w-2.5" /> : change > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            <span>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
          </div>
        </div>
      ) : (
        <WifiOff className="h-3 w-3 text-zinc-500 shrink-0" />
      )}
    </div>
  );
};

/* ─── PinnedMarketMovers ──────────────────────────────────────────────── */
interface PinnedMarketMoversProps {
  onClose: () => void;
}

const MIN_W = 240;
const MIN_H = 200;
const DEFAULT_W = 320;
const DEFAULT_H = 480;

export const PinnedMarketMovers: React.FC<PinnedMarketMoversProps> = ({ onClose }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [connected, setConnected] = useState(false);

  // Real-time sorting: Green -> Yellow -> Red -> Grey
  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      const dataA = resolveMarketData(marketData, a);
      const dataB = resolveMarketData(marketData, b);

      // If one has no data, put it at the end
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;

      // Group by colors/signals: Green (3) > Yellow (2) > Red (1) > Grey (0)
      const colorA = computeColor(dataA);
      const colorB = computeColor(dataB);

      const score: Record<string, number> = { green: 3, yellow: 2, red: 1, blue: 3, grey: 0 };
      const scoreA = score[colorA] ?? 0;
      const scoreB = score[colorB] ?? 0;

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending order of signal strength
      }

      // Within the same group, sort by changePercent descending
      const pctA = dataA.changePercent ?? 0;
      const pctB = dataB.changePercent ?? 0;
      return pctB - pctA;
    });
  }, [companies, marketData]);

  /* position & size — stored in refs so drag doesn't trigger re-renders */
  const posRef = useRef({ x: window.innerWidth - DEFAULT_W - 24, y: window.innerHeight - DEFAULT_H - 48 });
  const sizeRef = useRef({ w: DEFAULT_W, h: DEFAULT_H });
  const panelRef = useRef<HTMLDivElement>(null);

  /* Sync ref changes to DOM directly for smooth drag/resize without setState */
  const applyPosSize = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.left = `${posRef.current.x}px`;
    el.style.top = `${posRef.current.y}px`;
    el.style.width = `${sizeRef.current.w}px`;
    el.style.height = `${sizeRef.current.h}px`;
  }, []);

  /* ── Drag logic ── */
  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  const onDragPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.preventDefault();
    dragStateRef.current = { active: true, startX: e.clientX, startY: e.clientY, origX: posRef.current.x, origY: posRef.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onDragPointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    posRef.current = {
      x: Math.max(0, Math.min(window.innerWidth - sizeRef.current.w, ds.origX + e.clientX - ds.startX)),
      y: Math.max(0, Math.min(window.innerHeight - 40, ds.origY + e.clientY - ds.startY)),
    };
    applyPosSize();
  }, [applyPosSize]);

  const onDragPointerUp = useCallback(() => {
    dragStateRef.current.active = false;
  }, []);

  /* ── Resize logic ── */
  const resizeStateRef = useRef<{ active: boolean; startX: number; startY: number; origW: number; origH: number }>({ active: false, startX: 0, startY: 0, origW: 0, origH: 0 });

  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStateRef.current = { active: true, startX: e.clientX, startY: e.clientY, origW: sizeRef.current.w, origH: sizeRef.current.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onResizePointerMove = useCallback((e: React.PointerEvent) => {
    const rs = resizeStateRef.current;
    if (!rs.active) return;
    sizeRef.current = {
      w: Math.max(MIN_W, rs.origW + e.clientX - rs.startX),
      h: Math.max(MIN_H, rs.origH + e.clientY - rs.startY),
    };
    applyPosSize();
  }, [applyPosSize]);

  const onResizePointerUp = useCallback(() => {
    resizeStateRef.current.active = false;
  }, []);

  /* ── Fetch subscribed companies on mount ── */
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/admin/subscription-status');
        if (!res.ok) return;
        const data = await res.json();
        const subscriptions = data.data?.subscribed || data.subscriptions;
        if (data.success && Array.isArray(subscriptions)) {
          // Subscription-status returns symbols like "NSE:ADANIGREEN-EQ"
          // We need to convert them to Company objects
          const parsed: Company[] = subscriptions.map((sym: string) => {
            const parts = sym.split(':');
            const exchange = parts[0] || 'NSE';
            const rest = parts[1] || sym;
            const codeParts = rest.split('-');
            const code = codeParts[0];
            const marker = codeParts[1] || 'EQ';
            return { company_code: code, name: code, exchange, marker };
          });
          setCompanies(parsed);
        }
      } catch (err) {
        console.error('[PinnedMarketMovers] Failed to fetch companies:', err);
      }
    };
    fetchCompanies();
  }, []);

  /* ── Emit subscription request so Python backend starts streaming ticks for these companies ── */
  useEffect(() => {
    if (!connected || companies.length === 0) return;

    const socket = getSocket();
    const symbols = companies.map(c => `${c.exchange}:${c.company_code}-${c.marker || 'EQ'}`);
    const companyCodes = companies.map(c => c.company_code);

    console.log(`📤 [PinnedMarketMovers] Subscribing to ${symbols.length} companies...`);
    socket.emit('subscribe_companies', { companyCodes, symbols }, (response: any) => {
      if (response && response.success) {
        console.log(`✅ [PinnedMarketMovers] Subscribed to ${symbols.length} companies successfully`);
      }
    });
  }, [connected, companies]);

  /* ── Socket: connect to shared singleton, listen for market data ── */
  useEffect(() => {
    const socket = getSocket();
    setConnected(isSocketConnected());

    const onData = (payload: unknown) => {
      if (!payload) return;
      setMarketData(prev => {
        const updates: Record<string, MarketData> = Array.isArray(payload) ? {} : {};
        if (Array.isArray(payload)) {
          payload.forEach((tick: MarketData) => { if (tick?.symbol) updates[tick.symbol] = tick; });
          return { ...prev, ...updates };
        }
        const tick = payload as MarketData;
        if (!tick?.symbol) return prev;
        return { ...prev, [tick.symbol]: tick };
      });
    };

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('marketDataUpdate', onData);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('marketDataUpdate', onData);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  /* ── Apply initial position/size after mount ── */
  useEffect(() => {
    applyPosSize();
  }, [applyPosSize]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: posRef.current.x,
        top: posRef.current.y,
        width: sizeRef.current.w,
        height: sizeRef.current.h,
        zIndex: 9999,
        touchAction: 'none',
      }}
      className="flex flex-col rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden"
      onPointerMove={(e) => { onDragPointerMove(e); onResizePointerMove(e); }}
      onPointerUp={() => { onDragPointerUp(); onResizePointerUp(); }}
    >
      {/* Header / drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-800 cursor-grab active:cursor-grabbing shrink-0 select-none"
        onPointerDown={onDragPointerDown}
      >
        <GripHorizontal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <span className="text-xs font-semibold text-zinc-300 flex-1 truncate">Market Movers</span>
        <div className="flex items-center gap-1.5 shrink-0" data-no-drag="true">
          <div className={cn('w-2 h-2 rounded-full shrink-0', connected ? 'bg-emerald-500' : 'bg-red-500')} title={connected ? 'Connected' : 'Disconnected'} />
          <button
            onClick={onClose}
            className="w-5 h-5 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tile list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedCompanies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs gap-2">
            <WifiOff className="w-6 h-6 opacity-40" />
            No subscribed companies
          </div>
        ) : (
          sortedCompanies.map(company => (
            <MiniTile
              key={company.company_code}
              company={company}
              data={resolveMarketData(marketData, company)}
            />
          ))
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
        onPointerDown={onResizePointerDown}
        style={{ touchAction: 'none' }}
      >
        <svg viewBox="0 0 10 10" className="w-full h-full text-zinc-600 opacity-70">
          <path d="M 8 2 L 8 8 L 2 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};

export default PinnedMarketMovers;
