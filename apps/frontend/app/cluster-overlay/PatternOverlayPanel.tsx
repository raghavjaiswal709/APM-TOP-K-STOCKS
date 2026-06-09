'use client';

/**
 * PatternOverlayPanel
 *
 * Displays the PatternPool Overlay API summary: lock status, top-3 locked
 * patterns, drift detection, live top-3, and step evolution.
 *
 * Designed to appear below the chart on the Cluster Overlay page.
 */
import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Lock, Unlock, Activity, TrendingUp, TrendingDown,
  Minus, RefreshCw, AlertTriangle, Clock, BarChart2,
  ChevronRight, WifiOff
} from 'lucide-react';
import type {
  PatternOverlayState,
  PatternEntry,
  OverlayData,
} from '@/hooks/usePatternOverlay';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ARCHETYPE_COLOR_MAP: Record<string, string> = {
  Trending_Up:    '#26a69a',
  Trending_Down:  '#ef5350',
  Mean_Reverting: '#f59e0b',
  Volatile:       '#c084fc',
  Flat:           '#94a3b8',
};

// Confidence-based: green=highest (#1), yellow=medium (#2), red=lowest (#3)
const RANK_COLORS = ['#22c55e', '#f59e0b', '#ef5350'];

function archetypeColor(archetype?: string): string {
  if (!archetype) return '#94a3b8';
  return ARCHETYPE_COLOR_MAP[archetype] || '#8b5cf6';
}

function fmtPct(v?: number, decimals = 1): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmtReturn(v?: number): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}%`;
}

// ─── Lock Status Badge ────────────────────────────────────────────────────────

function LockBadge({ status, word }: { status?: string; word?: string }) {
  if (!status) return null;
  if (status === 'locked') {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="bg-emerald-600/90 text-white border-0 text-[10px] px-2 py-0.5 flex items-center gap-1">
          <Lock className="h-2.5 w-2.5" />
          LOCKED
        </Badge>
        {word && <span className="text-[10px] text-muted-foreground font-mono">at {word} (10:00)</span>}
      </div>
    );
  }
  if (status === 'tentative') {
    return (
      <Badge className="bg-amber-500/80 text-white border-0 text-[10px] px-2 py-0.5 flex items-center gap-1">
        <Activity className="h-2.5 w-2.5" />
        TENTATIVE
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-2 py-0.5 flex items-center gap-1 text-muted-foreground">
      <Unlock className="h-2.5 w-2.5" />
      UNLOCKED
    </Badge>
  );
}

// ─── Single Pattern Card ──────────────────────────────────────────────────────

function PatternCard({
  entry,
  colorHex,
  dimmed = false,
}: {
  entry: PatternEntry;
  colorHex: string;
  dimmed?: boolean;
}) {
  const { rank, cluster, score, profile } = entry;
  const ac = archetypeColor(profile?.archetype);

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border px-2.5 py-2 text-[11px] transition-opacity',
        dimmed ? 'opacity-50' : ''
      )}
      style={{ borderColor: colorHex + '50', background: colorHex + '08' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5">
        <span
          className="font-bold text-[13px] tabular-nums font-mono"
          style={{ color: colorHex }}
        >
          #{rank}
        </span>
        <span className="font-semibold tracking-wide" style={{ color: colorHex }}>
          {cluster}
        </span>
        {profile?.archetype && (
          <span
            className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: ac + '20', color: ac }}
          >
            {profile.archetype.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-muted-foreground">
        {profile?.win_rate != null && (
          <span>
            <span className="text-[9px] uppercase tracking-wider mr-0.5">WR</span>
            <span className="font-semibold text-foreground">{fmtPct(profile.win_rate, 0)}</span>
          </span>
        )}
        {profile?.avg_return != null && (
          <span>
            <span className="text-[9px] uppercase tracking-wider mr-0.5">Ret</span>
            <span
              className={cn(
                'font-semibold',
                profile.avg_return >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {fmtReturn(profile.avg_return)}
            </span>
          </span>
        )}
        {/* Score bar */}
        <div className="ml-auto flex items-center gap-1">
          <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, score * 100)}%`, background: colorHex }}
            />
          </div>
          <span className="font-mono text-[9px]">{score.toFixed(3)}</span>
        </div>
      </div>

      {/* n_days */}
      {profile?.day_count != null && (
        <span className="text-[9px] text-muted-foreground">
          {profile.day_count} historical days
        </span>
      )}
    </div>
  );
}

// ─── Drift Indicator ─────────────────────────────────────────────────────────

function DriftIndicator({
  locked,
  current,
}: {
  locked: PatternEntry[];
  current: PatternEntry[];
}) {
  const lockedIds = locked.map(e => e.cluster);
  const currentIds = current.map(e => e.cluster);
  const hasDrift = JSON.stringify(lockedIds) !== JSON.stringify(currentIds);

  if (!hasDrift) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-500">
        <Activity className="h-3 w-3" />
        <span>Live shape matches locked pattern</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-amber-500">
      <AlertTriangle className="h-3 w-3" />
      <span>
        Drift detected — live top-3 [{currentIds.join(', ')}] differs from locked [{lockedIds.join(', ')}]
      </span>
    </div>
  );
}

// ─── Step Evolution Sparkline ─────────────────────────────────────────────────

function StepEvolution({ overlay }: { overlay: OverlayData }) {
  const { step_evolution, lock_word } = overlay;
  if (!step_evolution || step_evolution.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
        Step Evolution
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {step_evolution.map((step, i) => {
          const top1 = step.top3?.[0];
          const isLock = step.word_step === lock_word;
          return (
            <div
              key={step.word_step}
              className={cn(
                'flex flex-col items-center rounded px-1.5 py-0.5 text-[9px] border',
                isLock
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : step.volatile
                  ? 'border-amber-500/30 bg-amber-500/06'
                  : 'border-border bg-muted/30'
              )}
            >
              <span className="font-mono text-[8px] text-muted-foreground">{step.slot_end}</span>
              <span
                className="font-semibold"
                style={{ color: top1 ? RANK_COLORS[0] : '#64748b' }}
              >
                {top1?.cluster ?? '—'}
              </span>
              {isLock && <Lock className="h-2 w-2 text-emerald-500 mt-0.5" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PatternOverlayPanelProps {
  state: PatternOverlayState;
  symbol: string;
  className?: string;
  /** Currently selected PAA resolution in minutes (3 | 5 | 9 | 15) */
  paaWidthMin?: number;
  /** True when the panel is rendering replay/historical mode (date≠today). */
  isHistorical?: boolean;
}

export function PatternOverlayPanel({
  state,
  symbol,
  className,
  paaWidthMin = 15,
  isHistorical = false,
}: PatternOverlayPanelProps) {
  const { overlay, curves, loading, error, tooEarly, afterMarket, serviceDown, lastUpdated, refetch } = state;

  // paa_segment_minutes from the live response is the source of truth for what the API
  // actually used; fall back to the prop value while loading or when not present.
  const actualPaaMin = overlay?.paa_segment_minutes ?? paaWidthMin;

  const lastUpdatedStr = useMemo(() => {
    if (!lastUpdated) return null;
    return new Date(lastUpdated).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdated]);

  if (!symbol) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground text-xs', className)}>
        Select a symbol to load pattern overlay
      </div>
    );
  }

  if (serviceDown) {
    return (
      <div className={cn('flex flex-col gap-1.5 text-xs p-4', className)}>
        <div className="flex items-center gap-2 text-orange-500">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="font-medium">Pattern overlay service offline</span>
        </div>
        <p className="text-muted-foreground text-[10px] ml-6">
          Cannot reach the pattern engine (port 8765). Retrying automatically every 30 s.
        </p>
        <button
          onClick={refetch}
          disabled={loading}
          className="ml-6 mt-1 w-fit text-[10px] underline hover:no-underline text-muted-foreground disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check now'}
        </button>
      </div>
    );
  }

  if (tooEarly) {
    return (
      <div className={cn('flex items-center gap-2 text-amber-500 text-xs p-4', className)}>
        <Clock className="h-4 w-4 shrink-0" />
        <span>Waiting for first slot — pattern engine starts at 09:45 IST</span>
      </div>
    );
  }

  if (loading && !overlay) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground text-xs p-4', className)}>
        <div className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin" />
        <span>Loading pattern data for {symbol}…</span>
      </div>
    );
  }

  if (error && !overlay) {
    return (
      <div className={cn('flex items-center gap-2 text-red-500 text-xs p-4', className)}>
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
        <button onClick={refetch} className="ml-2 underline hover:no-underline">Retry</button>
      </div>
    );
  }

  if (!overlay) {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground text-xs p-4', className)}>
        <BarChart2 className="h-4 w-4 shrink-0" />
        <span>No pattern data available for {symbol}</span>
      </div>
    );
  }

  const locked3 = overlay.top3_locked || [];
  const live3   = overlay.current_top3 || [];
  const isLocked = overlay.lock_status === 'locked';

  return (
    <div className={cn('overflow-y-auto', className)}>
      <div className="p-3 space-y-3">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{symbol}</span>
            <span className="text-xs text-muted-foreground">{overlay.date}</span>
            <LockBadge status={overlay.lock_status} word={overlay.lock_word} />
            {/* Resolution badge — shows API-confirmed paa_segment_minutes */}
            <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {actualPaaMin} min PAA
            </span>
            {/* Historical replay-mode badge */}
            {isHistorical && (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
                <Clock className="h-2.5 w-2.5" />
                Historical
              </span>
            )}
            {/* Low match confidence caution */}
            {overlay.low_match_confidence && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <AlertTriangle className="h-2.5 w-2.5" />
                Low confidence
              </span>
            )}
            {afterMarket && (
              <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                <Clock className="h-2.5 w-2.5" /> Closed
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {lastUpdatedStr && (
              <span className="text-[9px] text-muted-foreground">Updated {lastUpdatedStr} IST</span>
            )}
            <button
              onClick={refetch}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Refresh pattern data"
              disabled={loading}
            >
              <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Current Slot ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <span className="uppercase tracking-wider text-[9px] mr-1">Step</span>
            <span className="font-mono font-semibold text-foreground">{overlay.current_step}</span>
          </span>
          <ChevronRight className="h-3 w-3" />
          <span>
            <span className="uppercase tracking-wider text-[9px] mr-1">Slot</span>
            <span className="font-mono font-semibold text-foreground">{overlay.current_slot}</span>
          </span>
          {overlay.current_volatile && (
            <span className="text-amber-500 text-[9px] flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" /> Volatile
            </span>
          )}
          {overlay.current_n_segments != null && (
            <span className="text-[9px] text-muted-foreground font-mono ml-auto">
              n={overlay.current_n_segments} segs
            </span>
          )}
        </div>

        {/* ── Locked Top-3 ───────────────────────────────────────────── */}
        {locked3.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              {isLocked ? 'Locked Top-3 (frozen at ' + overlay.lock_word + ')' : 'Current Top-3'}
            </p>
            {locked3.slice(0, 3).map((entry, i) => (
              <PatternCard
                key={entry.cluster + i}
                entry={entry}
                colorHex={RANK_COLORS[i] || '#8b5cf6'}
              />
            ))}
          </div>
        )}

        {/* ── Drift Indicator (only after lock) ─────────────────────── */}
        {isLocked && locked3.length > 0 && live3.length > 0 && (
          <div className="pt-1 border-t">
            <DriftIndicator locked={locked3} current={live3} />
          </div>
        )}

        {/* ── Live Top-3 (when locked and different from locked3) ───── */}
        {isLocked && live3.length > 0 && (
          (() => {
            const sameOrder = locked3.every((e, i) => live3[i]?.cluster === e.cluster);
            if (sameOrder) return null;
            return (
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold">
                  Live Top-3 (drifted)
                </p>
                {live3.slice(0, 3).map((entry, i) => (
                  <PatternCard
                    key={'live-' + entry.cluster + i}
                    entry={entry}
                    colorHex={RANK_COLORS[i] || '#8b5cf6'}
                    dimmed
                  />
                ))}
              </div>
            );
          })()
        )}

        {/* ── Curves metadata (n_historical confidence) ─────────────── */}
        {curves?.patterns && curves.patterns.length > 0 && (
          <div className="pt-1 border-t">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Cluster Size
            </p>
            <div className="flex flex-wrap gap-2">
              {curves.patterns.slice(0, 3).map((p, i) => (
                <div key={p.cluster} className="flex items-center gap-1 text-[10px]">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ background: RANK_COLORS[i] }}
                  />
                  <span className="font-mono" style={{ color: RANK_COLORS[i] }}>
                    {p.cluster}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>{p.n_historical} days</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step Evolution ─────────────────────────────────────────── */}
        <div className="pt-1 border-t">
          <StepEvolution overlay={overlay} />
        </div>

      </div>
    </div>
  );
}
