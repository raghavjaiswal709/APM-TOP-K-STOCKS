'use client';

/**
 * PatternOverlayPanel
 *
 * ShadCN-themed floating panel showing PatternPool Overlay API data:
 * lock status, top-3 patterns, drift detection, live top-3, step evolution.
 */
import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Lock, Unlock, Activity, TrendingUp, TrendingDown,
  Minus, RefreshCw, AlertTriangle, Clock, BarChart2,
  ChevronRight, WifiOff, Zap,
} from 'lucide-react';
import type {
  PatternOverlayState,
  PatternEntry,
  OverlayData,
} from '@/hooks/usePatternOverlay';
import { cn } from '@/lib/utils';

// ─── Design tokens ────────────────────────────────────────────────────────────

const ARCHETYPE_COLOR_MAP: Record<string, string> = {
  Trending_Up:    '#10b981',
  Trending_Down:  '#ef4444',
  Mean_Reverting: '#f59e0b',
  Volatile:       '#a78bfa',
  Flat:           '#6b7280',
};

// Rank colors: #1 green, #2 amber, #3 red
const RANK_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

function archetypeColor(archetype?: string): string {
  if (!archetype) return '#6b7280';
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
        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0 h-5 gap-1 font-medium">
          <Lock className="h-2.5 w-2.5" />
          LOCKED
        </Badge>
        {word && (
          <span className="text-[10px] text-muted-foreground font-mono">
            at {word} (10:00)
          </span>
        )}
      </div>
    );
  }
  if (status === 'tentative') {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0 h-5 gap-1 font-medium">
        <Activity className="h-2.5 w-2.5" />
        TENTATIVE
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 gap-1 text-muted-foreground font-medium">
      <Unlock className="h-2.5 w-2.5" />
      UNLOCKED
    </Badge>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground/70 mb-1.5">
      {children}
    </p>
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
        'rounded-lg border bg-card px-3 py-2.5 text-[11px] transition-colors hover:bg-muted/40',
        dimmed ? 'opacity-40' : ''
      )}
      style={{ borderColor: colorHex + '35' }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Rank pill */}
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0"
          style={{ background: colorHex + '20', color: colorHex }}
        >
          {rank}
        </span>
        <span className="font-semibold text-foreground text-[12px] tracking-tight">
          {cluster}
        </span>
        {profile?.archetype && (
          <span
            className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium border"
            style={{
              background: ac + '15',
              color: ac,
              borderColor: ac + '30',
            }}
          >
            {profile.archetype.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-muted-foreground">
        {profile?.win_rate != null && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider">WR</span>
            <span className="font-semibold text-foreground text-[11px]">
              {fmtPct(profile.win_rate, 0)}
            </span>
          </div>
        )}
        {profile?.avg_return != null && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-wider">Ret</span>
            <span
              className={cn(
                'font-semibold text-[11px]',
                profile.avg_return >= 0 ? 'text-emerald-500' : 'text-red-500'
              )}
            >
              {fmtReturn(profile.avg_return)}
            </span>
          </div>
        )}
        {/* Score bar */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, score * 100)}%`, background: colorHex }}
            />
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">
            {score.toFixed(3)}
          </span>
        </div>
      </div>

      {profile?.day_count != null && (
        <p className="text-[9px] text-muted-foreground mt-1">
          {profile.day_count} historical days
        </p>
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
  const lockedIds  = locked.map(e  => e.cluster);
  const currentIds = current.map(e => e.cluster);
  const hasDrift   = JSON.stringify(lockedIds) !== JSON.stringify(currentIds);

  if (!hasDrift) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-500 bg-emerald-500/8 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
        <Activity className="h-3 w-3 shrink-0" />
        <span>Live shape matches locked pattern</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 text-[11px] text-amber-500 bg-amber-500/8 border border-amber-500/20 rounded-md px-2.5 py-1.5">
      <AlertTriangle className="h-3 w-3 shrink-0 mt-px" />
      <span>
        Drift — live [{currentIds.join(', ')}] ≠ locked [{lockedIds.join(', ')}]
      </span>
    </div>
  );
}

// ─── Step Evolution ───────────────────────────────────────────────────────────

function StepEvolution({ overlay }: { overlay: OverlayData }) {
  const { step_evolution, lock_word } = overlay;
  if (!step_evolution || step_evolution.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <SectionLabel>Step Evolution</SectionLabel>
      <div className="flex items-start gap-1 flex-wrap">
        {step_evolution.map((step) => {
          const top1   = step.top3?.[0];
          const isLock = step.word_step === lock_word;
          return (
            <div
              key={step.word_step}
              className={cn(
                'flex flex-col items-center rounded-md px-1.5 py-1 text-[9px] border min-w-[38px]',
                isLock
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : step.volatile
                  ? 'border-amber-500/30 bg-amber-500/8'
                  : 'border-border bg-muted/30'
              )}
            >
              <span className="font-mono text-[8px] text-muted-foreground mb-0.5">
                {step.slot_end}
              </span>
              <span
                className="font-semibold text-[10px]"
                style={{ color: top1 ? RANK_COLORS[0] : '#6b7280' }}
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
  paaWidthMin?: number;
  isHistorical?: boolean;
}

export function PatternOverlayPanel({
  state,
  symbol,
  className,
  paaWidthMin = 15,
  isHistorical = false,
}: PatternOverlayPanelProps) {
  const {
    overlay, curves, loading, error,
    tooEarly, afterMarket, serviceDown, lastUpdated, refetch,
  } = state;

  const actualPaaMin = overlay?.paa_segment_minutes ?? paaWidthMin;

  const lastUpdatedStr = useMemo(() => {
    if (!lastUpdated) return null;
    return new Date(lastUpdated).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }, [lastUpdated]);

  // ── State renders ──────────────────────────────────────────────────────────

  if (!symbol) {
    return (
      <div className={cn('flex items-center justify-center h-full text-muted-foreground text-xs p-6', className)}>
        Select a symbol to load pattern overlay
      </div>
    );
  }

  if (serviceDown) {
    return (
      <div className={cn('flex flex-col gap-2 p-5', className)}>
        <div className="flex items-center gap-2 text-orange-500">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">Pattern service offline</span>
        </div>
        <p className="text-muted-foreground text-[11px] ml-6">
          Cannot reach the pattern engine (port 8765). Retrying every 30s.
        </p>
        <button
          onClick={refetch}
          disabled={loading}
          className="ml-6 mt-1 w-fit text-[11px] text-primary underline hover:no-underline disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Check now'}
        </button>
      </div>
    );
  }

  if (tooEarly) {
    return (
      <div className={cn('flex items-center gap-2.5 text-amber-500 text-xs p-5', className)}>
        <Clock className="h-4 w-4 shrink-0" />
        <span>Waiting — pattern engine starts at 09:45 IST</span>
      </div>
    );
  }

  if (loading && !overlay) {
    return (
      <div className={cn('flex items-center gap-2.5 text-muted-foreground text-xs p-5', className)}>
        <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <span>Loading patterns for {symbol}…</span>
      </div>
    );
  }

  if (error && !overlay) {
    return (
      <div className={cn('flex items-center gap-2.5 text-destructive text-xs p-5', className)}>
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{error}</span>
        <button onClick={refetch} className="underline hover:no-underline shrink-0">
          Retry
        </button>
      </div>
    );
  }

  if (!overlay) {
    return (
      <div className={cn('flex items-center gap-2.5 text-muted-foreground text-xs p-5', className)}>
        <BarChart2 className="h-4 w-4 shrink-0" />
        <span>No pattern data for {symbol}</span>
      </div>
    );
  }

  const locked3  = overlay.top3_locked   || [];
  const live3    = overlay.current_top3  || [];
  const isLocked = overlay.lock_status === 'locked';

  return (
    <div className={cn('overflow-y-auto', className)}>
      <div className="p-4 space-y-4">

        {/* ── Meta row ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-1.5">
            <LockBadge status={overlay.lock_status} word={overlay.lock_word} />
            <Badge variant="secondary" className="text-[10px] h-5 px-2 font-mono font-normal">
              {actualPaaMin}m PAA
            </Badge>
            {isHistorical && (
              <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1 text-purple-500 border-purple-500/30">
                <Clock className="h-2.5 w-2.5" />
                Historical
              </Badge>
            )}
            {overlay.low_match_confidence && (
              <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1 text-amber-500 border-amber-500/30">
                <AlertTriangle className="h-2.5 w-2.5" />
                Low conf.
              </Badge>
            )}
            {afterMarket && (
              <Badge variant="outline" className="text-[10px] h-5 px-2 gap-1 text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                Closed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {lastUpdatedStr && (
              <span className="text-[10px] text-muted-foreground">{lastUpdatedStr}</span>
            )}
            <button
              onClick={refetch}
              disabled={loading}
              className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Current slot info ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border/50">
          <Zap className="h-3 w-3 text-yellow-500 shrink-0" />
          <span className="text-[9px] uppercase tracking-wider">Step</span>
          <span className="font-mono font-semibold text-foreground">{overlay.current_step}</span>
          <ChevronRight className="h-3 w-3 opacity-40" />
          <span className="text-[9px] uppercase tracking-wider">Slot</span>
          <span className="font-mono font-semibold text-foreground">{overlay.current_slot}</span>
          {overlay.current_volatile && (
            <span className="ml-auto flex items-center gap-1 text-amber-500 text-[9px]">
              <AlertTriangle className="h-2.5 w-2.5" />
              Volatile
            </span>
          )}
          {overlay.current_n_segments != null && (
            <span className="text-[9px] text-muted-foreground font-mono ml-auto">
              n={overlay.current_n_segments}
            </span>
          )}
        </div>

        {/* ── Locked / Current Top-3 ───────────────────────────────── */}
        {locked3.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>
              {isLocked
                ? `Locked Top-3 · frozen at ${overlay.lock_word}`
                : 'Current Top-3'}
            </SectionLabel>
            <div className="space-y-1.5">
              {locked3.slice(0, 3).map((entry, i) => (
                <PatternCard
                  key={entry.cluster + i}
                  entry={entry}
                  colorHex={RANK_COLORS[i] || '#8b5cf6'}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Drift Indicator ──────────────────────────────────────── */}
        {isLocked && locked3.length > 0 && live3.length > 0 && (
          <DriftIndicator locked={locked3} current={live3} />
        )}

        {/* ── Live Top-3 when drifted ──────────────────────────────── */}
        {isLocked && live3.length > 0 && (() => {
          const sameOrder = locked3.every((e, i) => live3[i]?.cluster === e.cluster);
          if (sameOrder) return null;
          return (
            <div className="space-y-2">
              <SectionLabel>Live Top-3 (drifted)</SectionLabel>
              <div className="space-y-1.5">
                {live3.slice(0, 3).map((entry, i) => (
                  <PatternCard
                    key={'live-' + entry.cluster + i}
                    entry={entry}
                    colorHex={RANK_COLORS[i] || '#8b5cf6'}
                    dimmed
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── Cluster size metadata ─────────────────────────────────── */}
        {curves?.patterns && curves.patterns.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <SectionLabel>Cluster Size</SectionLabel>
              <div className="flex flex-wrap gap-3">
                {curves.patterns.slice(0, 3).map((p, i) => (
                  <div key={p.cluster} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="w-2 h-2 rounded-full inline-block shrink-0"
                      style={{ background: RANK_COLORS[i] }}
                    />
                    <span className="font-mono font-medium" style={{ color: RANK_COLORS[i] }}>
                      {p.cluster}
                    </span>
                    <span className="text-muted-foreground">· {p.n_historical}d</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Step Evolution ────────────────────────────────────────── */}
        <Separator />
        <StepEvolution overlay={overlay} />

      </div>
    </div>
  );
}
