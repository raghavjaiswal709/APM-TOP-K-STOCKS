'use client';

import React, { useMemo, useState, useEffect } from 'react';
import GridChart, { TickData } from './GridChart';
import { TrendingUp, TrendingDown, Minus, WifiOff, LayoutGrid } from 'lucide-react';

/* ── Layout options ── */
type LayoutOption = 'auto' | '1' | '2' | '3' | '4' | '6';
const LAYOUT_OPTIONS: { value: LayoutOption; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1',    label: '1' },
  { value: '2',    label: '2' },
  { value: '3',    label: '3' },
  { value: '4',    label: '4' },
  { value: '6',    label: '6' },
];
const LAYOUT_STORAGE_KEY = 'live-market-grid-layout';

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}

interface LiveMarketGridProps {
  selectedCompanies: Company[];
  marketData: Record<string, TickData>;
  historicalData?: Record<string, TickData[]>;
  connectionStatus: string;
  loading?: boolean;
  /** Flex-fill class passed from parent, e.g. "flex-1 min-h-0" */
  className?: string;
}

/** Resolve a value from a Record by trying multiple key formats */
function resolveByCompany<T>(store: Record<string, T> | undefined, company: Company): T | undefined {
  if (!store) return undefined;
  if (company.symbol && store[company.symbol]) return store[company.symbol];
  const fyers = `${company.exchange}:${company.company_code}-${company.marker || 'EQ'}`;
  if (store[fyers]) return store[fyers];
  if (store[company.company_code]) return store[company.company_code];
  const code = company.company_code.toUpperCase();
  const key  = Object.keys(store).find(k => k.toUpperCase().includes(code));
  return key ? store[key] : undefined;
}

const LiveMarketGrid: React.FC<LiveMarketGridProps> = ({
  selectedCompanies,
  marketData,
  historicalData,
  loading = false,
  className = '',
}) => {
  const n = selectedCompanies.length;

  /* ── Layout preference (localStorage-persisted) ── */
  const [layout, setLayout] = useState<LayoutOption>('auto');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY) as LayoutOption | null;
      if (saved && LAYOUT_OPTIONS.some(o => o.value === saved)) setLayout(saved);
    } catch { /* ignore */ }
  }, []);
  const handleLayout = (val: LayoutOption) => {
    setLayout(val);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, val); } catch { /* ignore */ }
  };

  /* ── Compute columns so we can set explicit grid-template-rows ── */
  const cols = useMemo(() => {
    if (layout !== 'auto') return Number(layout);
    if (n === 1) return 1;
    if (n === 2) return 2;
    if (n === 4) return 2;
    return 3; // 3, 5, 6, 7, 8, 9 …
  }, [n, layout]);

  const rows = Math.ceil(n / cols);

  return (
    <div className={`flex flex-col ${className}`}>

      {/* ── Layout picker toolbar ── */}
      <div className="flex items-center gap-1.5 px-1 pb-2 shrink-0">
        <LayoutGrid className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground font-medium mr-0.5">Cols:</span>
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
          {LAYOUT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleLayout(opt.value)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                layout === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cards grid — fills all available height with equal rows ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: '10px',
        }}
      >
        {selectedCompanies.map(company => {
          const data    = resolveByCompany(marketData,    company) as TickData | undefined;
          const history = resolveByCompany(historicalData, company) as TickData[] | undefined;
          const hasData    = !!data;
          const change     = data?.change ?? 0;
          const isPositive = change >= 0;
          const priceColor = !hasData ? 'text-muted-foreground'
            : isPositive ? 'text-emerald-500 dark:text-emerald-400'
            : 'text-red-500 dark:text-red-400';

          return (
            <div
              key={company.company_code}
              className="flex flex-col rounded-xl border bg-card overflow-hidden shadow-sm"
              style={{ minHeight: 0 }}   /* allow grid to control height */
            >
              {/* ── Header: company + price on one compact row ── */}
              <div className="flex items-center justify-between px-2 pt-1.5 pb-1 shrink-0 gap-1 min-w-0">
                {/* Left: code + exchange + live dot */}
                <div className="flex items-center gap-1 min-w-0 shrink">
                  <span className="font-bold text-xs leading-none truncate">{company.company_code}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
                    {company.exchange}
                  </span>
                  {hasData && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)] shrink-0" />
                  )}
                </div>

                {/* Right: price + change — stays on right, never wraps */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasData ? (
                    <>
                      <span className="font-bold text-xs tabular-nums">₹{data!.ltp.toFixed(2)}</span>
                      <span className={`text-[10px] font-semibold tabular-nums flex items-center gap-0.5 ${priceColor}`}>
                        {change === 0 ? <Minus className="h-2 w-2" />
                          : isPositive ? <TrendingUp className="h-2 w-2" />
                          : <TrendingDown className="h-2 w-2" />}
                        {change >= 0 ? '+' : ''}{(data!.changePercent ?? 0).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {loading
                        ? <div className="animate-spin h-3 w-3 rounded-full border border-primary border-t-transparent" />
                        : <WifiOff className="h-3 w-3" />
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* ── Chart — fills entire remaining card height ── */}
              <div className="flex-1 min-h-0 border-t border-border/20">
                <GridChart
                  company={company}
                  data={data}
                  tickHistory={history}
                />
              </div>

              {/* ── Timestamp micro-footer ── */}
              {hasData && data!.timestamp ? (
                <div className="px-3 py-0.5 text-[9px] text-muted-foreground/40 text-right shrink-0 tabular-nums">
                  {new Date(
                    (data!.timestamp < 1e10 ? data!.timestamp : data!.timestamp / 1000) * 1000
                  ).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LiveMarketGrid;
