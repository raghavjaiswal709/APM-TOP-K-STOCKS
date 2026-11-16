'use client';

import * as React from 'react';
import { Minus, Pin, PinOff, Plus, Search, SlidersHorizontal, TrendingDown, TrendingUp, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  TARGET_MOVE_PRESETS,
  activeFilterCount,
  companyCodeOf,
  formatPrice,
  formatSignedPct,
  formatTargetMovePct,
  formatTimeIST,
  type SurgeFilters,
} from '@/lib/surge/filters';
import type { SurgeDirection, SurgeTercile, SurgeType } from '@/lib/surge/types';
import type { SurgeQuote } from '@/lib/surge/quoteSocket';
import {
  useMasterCompanies,
  useSurgePrefs,
  type SurgeEntry,
  type SurgeFilterState,
  type SurgeWatchlistView,
} from '@/hooks/useSurge';

/*
 * Surge watchlist UI pieces shared by every watchlist — ported from the
 * trading dashboard's `watchlist-panel.tsx` and `surge-filter-bar.tsx`,
 * restyled to this app's shadcn tokens.
 */

const POSITIVE = 'text-green-500';
const NEGATIVE = 'text-red-500';

const DIRECTION_OPTIONS: { value: SurgeDirection; label: string; icon: typeof TrendingUp; tint: string }[] = [
  { value: 'UP', label: 'Up', icon: TrendingUp, tint: POSITIVE },
  { value: 'DOWN', label: 'Down', icon: TrendingDown, tint: NEGATIVE },
  { value: 'NEUTRAL', label: 'Neutral', icon: Minus, tint: 'text-muted-foreground' },
];

const DIRECTION_STYLE: Record<SurgeDirection, { icon: typeof TrendingUp; text: string; edge: string }> = {
  UP: { icon: TrendingUp, text: POSITIVE, edge: 'shadow-[inset_2px_0_0_rgb(34,197,94)]' },
  DOWN: { icon: TrendingDown, text: NEGATIVE, edge: 'shadow-[inset_2px_0_0_rgb(239,68,68)]' },
  NEUTRAL: { icon: Minus, text: 'text-muted-foreground', edge: 'shadow-[inset_2px_0_0_rgb(245,158,11)]' },
};

/** Strongest first — both detectors agreeing is the signal most people want. */
const TYPE_OPTIONS: SurgeType[] = ['Ramp+P99', 'Ramp', 'P99'];

/** Steady is the cleanest move, so it leads. */
const TERCILE_OPTIONS: SurgeTercile[] = ['steady', 'mild', 'lumpy'];

const TERCILE_HINT: Record<SurgeTercile, string> = {
  steady: 'Move spread evenly across the bar',
  mild: 'Moderately uneven move',
  lumpy: 'Move concentrated in a burst',
};

/** One-tap floors beside the slider, for the values people actually pick. */
const SCORE_STEPS = [0, 0.5, 0.7, 0.9];

/** Fraction as a percent number, kept to 2 decimals to hide float noise. */
const toPercent = (fraction: number) => Number((fraction * 100).toFixed(2));

const formatPercentFloor = (fraction: number) => `${toPercent(fraction)}%`;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

// ── toggle ────────────────────────────────────────────────────────────────

/**
 * Compact "Surging on top" button for a watchlist toolbar — the same switch
 * as the one in the filter popover, with today's surge count.
 */
export function SurgeToggleButton({
  enabled,
  onChange,
  count,
  className,
  size = 'sm',
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  /** Surging names today, shown while on. */
  count?: number;
  className?: string;
  /** `icon`: an 8×8 icon button with the count as a corner badge, for tight toolbars. */
  size?: 'icon' | 'sm' | 'lg';
}) {
  const title = enabled ? "Surging on top — today's surges lead the watchlist" : 'Plain screener order';
  // OLD (overlay): enabled ? "Surge on — today's surges lead the list" : 'Surge off — plain watchlist order'

  if (size === 'icon') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Surging on top"
        title={title}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          enabled
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          className,
        )}
      >
        <Zap className={cn('h-4 w-4', enabled && 'fill-current')} />
        {enabled && count !== undefined && count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold tabular-nums text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Surging on top"
      title={title}
      onClick={() => onChange(!enabled)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        size === 'sm' ? 'h-8 px-2 text-[11px]' : 'h-20 px-4 text-sm',
        enabled
          ? 'border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <Zap className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', enabled && 'fill-current')} />
      Surge
      {enabled && count !== undefined && count > 0 && (
        <span className="rounded-full bg-amber-500/25 px-1.5 text-[10px] tabular-nums">{count}</span>
      )}
    </button>
  );
}

/** "Surging on top" switch — lives in the filter popover, above the filters. */
export function SurgeViewSwitch({ enabled, onChange }: { enabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex w-full items-center justify-between gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-medium">Surging on top</span>
        <span className="text-[10px] leading-tight text-muted-foreground">
          {enabled ? "Today's surges lead the list" : 'Plain screener order'}
        </span>
      </span>
      <span
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          enabled ? 'bg-amber-500' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-[left]',
            enabled ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

// ── filters ───────────────────────────────────────────────────────────────

function ToggleChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-amber-500/50 bg-amber-500/15 text-foreground'
          : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/70">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

/**
 * Typed threshold, in percent, decimals allowed. Keeps its own draft so
 * half-typed values like "2." aren't overwritten mid-keystroke.
 */
function PercentInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const shown = draft ?? String(toPercent(value));

  return (
    <div className="relative w-[4.5rem] shrink-0">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step={0.01}
        value={shown}
        aria-label={`${ariaLabel} in percent`}
        onFocus={() => setDraft(String(toPercent(value)))}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (text.trim() === '') return;
          const next = Number(text);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(Math.max(next, 0), 100) / 100);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className={cn(
          'h-6 w-full rounded-sm border bg-muted/40 pl-1.5 pr-4 text-right font-mono text-[11px] tabular-nums',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-ring',
        )}
      />
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
        %
      </span>
    </div>
  );
}

/** A "≥ x%" floor: a slider for quick moves, a box for exact values, and one-tap presets. */
export interface ThresholdConfig {
  label: string;
  ariaLabel: string;
  /** Fraction, e.g. 0.0295 for 2.95%. 0 means no floor. */
  value: number;
  onChange: (value: number) => void;
  /** Slider range and step, in percent. The typed box accepts up to 100. */
  maxPercent: number;
  stepPercent: number;
  /** One-tap floors, as fractions; 0 is shown as "Any". */
  presets: number[];
}

function ThresholdControl({ label, ariaLabel, value, onChange, maxPercent, stepPercent, presets }: ThresholdConfig) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums">{value > 0 ? `≥ ${formatPercentFloor(value)}` : 'Any'}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={maxPercent}
          step={stepPercent}
          value={Math.min(toPercent(value), maxPercent)}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 accent-amber-500"
          onChange={(event) => onChange(Number(event.target.value) / 100)}
        />
        <PercentInput value={value} onChange={onChange} ariaLabel={ariaLabel} />
      </div>
      <div className="flex gap-1">
        {presets.map((step) => (
          <ToggleChip key={step} active={Math.abs(value - step) < 0.00001} onClick={() => onChange(step)}>
            {step === 0 ? 'Any' : `${formatPercentFloor(step)}+`}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

/**
 * The surge filter button and its popover. `children` renders above the
 * filter groups, for view options (the "Surging on top" switch).
 */
export function SurgeFilterPopover({
  state,
  title = 'Filter surges',
  threshold,
  extraActiveCount = 0,
  children,
  triggerClassName,
}: {
  state: SurgeFilterState;
  title?: string;
  /** Replaces the surge-score floor with a panel-specific one (the watchlist's target move). */
  threshold?: ThresholdConfig;
  /** Filters the panel keeps outside `SurgeFilters`, for the badge and Reset. */
  extraActiveCount?: number;
  children?: React.ReactNode;
  triggerClassName?: string;
}) {
  const { filters, setFilters, resetFilters } = state;
  const count = activeFilterCount(filters) + extraActiveCount;
  const update = (patch: Partial<SurgeFilters>) => setFilters({ ...filters, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count ? `Surge filters, ${count} active` : 'Surge filters'}
          title={title}
          className={cn(
            'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            count
              ? 'border-amber-500/50 bg-amber-500/15 text-foreground'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            triggerClassName,
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-semibold text-white">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="flex w-64 flex-col gap-3.5 p-3">
        {children && <div className="flex flex-col gap-2 border-b pb-3">{children}</div>}

        <FilterGroup label="Direction" hint={filters.directions.length ? `${filters.directions.length} selected` : 'Any'}>
          {DIRECTION_OPTIONS.map(({ value, label, icon: Icon, tint }) => (
            <ToggleChip
              key={value}
              active={filters.directions.includes(value)}
              onClick={() => update({ directions: toggle(filters.directions, value) })}
            >
              <Icon className={cn('h-3 w-3', tint)} />
              {label}
            </ToggleChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Surge type" hint={filters.types.length ? `${filters.types.length} selected` : 'Any'}>
          {TYPE_OPTIONS.map((type) => (
            <ToggleChip
              key={type}
              active={filters.types.includes(type)}
              onClick={() => update({ types: toggle(filters.types, type) })}
              title={type === 'Ramp+P99' ? 'Both detectors fired on the same bar' : undefined}
            >
              {type}
            </ToggleChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Tercile" hint={filters.terciles.length ? `${filters.terciles.length} selected` : 'Any'}>
          {TERCILE_OPTIONS.map((tercile) => (
            <ToggleChip
              key={tercile}
              active={filters.terciles.includes(tercile)}
              onClick={() => update({ terciles: toggle(filters.terciles, tercile) })}
              title={TERCILE_HINT[tercile]}
            >
              <span className="capitalize">{tercile}</span>
            </ToggleChip>
          ))}
        </FilterGroup>

        <ThresholdControl
          {...(threshold ?? {
            label: 'Minimum score',
            ariaLabel: 'Minimum surge score',
            value: filters.minScore,
            onChange: (minScore: number) => update({ minScore }),
            maxPercent: 100,
            stepPercent: 1,
            presets: SCORE_STEPS,
          })}
        />

        <div className="flex items-center justify-between border-t pt-2.5">
          <span className="text-[10px] leading-tight text-muted-foreground">Shared by every watchlist on this browser</span>
          <button
            type="button"
            onClick={resetFilters}
            disabled={count === 0}
            className="rounded-sm px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The watchlist's filter button, wired the way the dashboard's Watchlist
 * panel is: "Surging on top" switch, the surge filters, and a minimum
 * target move in place of the surge-score floor.
 */
/** What the watchlist's filter controls need — a full view, or prefs plus `live`. */
export type WatchlistFilterControls = Pick<
  SurgeWatchlistView,
  | 'filterState'
  | 'targetFloorActive'
  | 'minTargetMove'
  | 'setMinTargetMove'
  | 'surgingOnTop'
  | 'setSurgingOnTop'
  | 'live'
>;

export function WatchlistFilterPopover({
  view,
  title = 'Filter watchlist',
  triggerClassName,
}: {
  view: WatchlistFilterControls;
  title?: string;
  triggerClassName?: string;
}) {
  return (
    <SurgeFilterPopover
      state={view.filterState}
      title={title}
      triggerClassName={triggerClassName}
      extraActiveCount={view.targetFloorActive ? 1 : 0}
      threshold={{
        label: 'Minimum target move',
        ariaLabel: 'Minimum target move',
        value: view.minTargetMove,
        onChange: view.setMinTargetMove,
        maxPercent: 10,
        stepPercent: 0.1,
        presets: TARGET_MOVE_PRESETS,
      }}
    >
      <SurgeViewSwitch enabled={view.surgingOnTop} onChange={view.setSurgingOnTop} />
      {!view.live && (
        <span className="text-[10px] leading-tight text-muted-foreground">
          Surging today shows on today&apos;s screen only.
        </span>
      )}
    </SurgeFilterPopover>
  );
}

function RemovableChip({ label, onRemove }: { label: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-5 items-center gap-0.5 rounded-full border bg-muted/40 pl-2 pr-0.5 text-[10px] font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

/** What is narrowing the list, each removable in one tap — never a hidden filter. */
export function SurgeFilterChips({
  state,
  className,
  extra = [],
}: {
  state: SurgeFilterState;
  className?: string;
  /** Chips for filters kept outside `SurgeFilters` (the watchlist's target floor). */
  extra?: { key: string; label: React.ReactNode; onRemove: () => void }[];
}) {
  const { filters, setFilters, resetFilters } = state;
  if (activeFilterCount(filters) === 0 && extra.length === 0) return null;
  const update = (patch: Partial<SurgeFilters>) => setFilters({ ...filters, ...patch });

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {filters.directions.map((direction) => {
        const option = DIRECTION_OPTIONS.find((candidate) => candidate.value === direction);
        const Icon = option?.icon ?? Minus;
        return (
          <RemovableChip
            key={direction}
            label={
              <>
                <Icon className={cn('h-2.5 w-2.5', option?.tint)} />
                {option?.label ?? direction}
              </>
            }
            onRemove={() => update({ directions: filters.directions.filter((d) => d !== direction) })}
          />
        );
      })}
      {filters.types.map((type) => (
        <RemovableChip key={type} label={type} onRemove={() => update({ types: filters.types.filter((t) => t !== type) })} />
      ))}
      {filters.terciles.map((tercile) => (
        <RemovableChip
          key={tercile}
          label={<span className="capitalize">{tercile}</span>}
          onRemove={() => update({ terciles: filters.terciles.filter((t) => t !== tercile) })}
        />
      ))}
      {filters.minScore > 0 && (
        <RemovableChip label={`Score ≥ ${formatPercentFloor(filters.minScore)}`} onRemove={() => update({ minScore: 0 })} />
      )}
      {extra.map((chip) => (
        <RemovableChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
      ))}
      <button
        type="button"
        onClick={resetFilters}
        className="px-1 text-[10px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

/** The watchlist's chips: surge filters plus "Target ≥ x%". */
export function WatchlistFilterChips({
  view,
  className,
}: {
  view: Pick<WatchlistFilterControls, 'filterState' | 'targetFloorActive' | 'minTargetMove' | 'setMinTargetMove'>;
  className?: string;
}) {
  return (
    <SurgeFilterChips
      state={view.filterState}
      className={className}
      extra={
        view.targetFloorActive
          ? [
              {
                key: 'target',
                label: `Target ≥ ${formatTargetMovePct(view.minTargetMove)}`,
                onRemove: () => view.setMinTargetMove(0),
              },
            ]
          : []
      }
    />
  );
}

// ── add symbol ────────────────────────────────────────────────────────────

/**
 * "+" — search the master company list and add a name to the watchlist
 * ("My additions"). Additions are saved in this browser and shared by every
 * watchlist, like the pins.
 */
export function AddSymbolButton({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [notice, setNotice] = React.useState<string | null>(null);
  const { additions, addAddition, removeAddition } = useSurgePrefs();
  const { companies, loading, error } = useMasterCompanies(open);
  const additionSet = React.useMemo(() => new Set(additions.map((entry) => entry.code)), [additions]);

  const results = React.useMemo(() => {
    const term = query.trim().toUpperCase();
    if (!companies || !term) return [];
    const code = companyCodeOf(term);
    const starts: typeof companies = [];
    const contains: typeof companies = [];
    for (const company of companies) {
      const companyCode = company.company_code.toUpperCase();
      if (companyCode.startsWith(code)) starts.push(company);
      else if (companyCode.includes(code) || company.name.toUpperCase().includes(term)) contains.push(company);
      if (starts.length >= 30) break;
    }
    return [...starts, ...contains].slice(0, 30);
  }, [companies, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setNotice(null);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add symbol to watchlist"
          title="Add symbol to watchlist"
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-2 p-2" onClick={(event) => event.stopPropagation()}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setNotice(null);
            }}
            placeholder="Add a symbol… (e.g. RELIANCE)"
            aria-label="Search symbols to add"
            className="h-8 w-full rounded-md border bg-transparent pl-7 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {notice && <p className="px-1 text-[10px] text-amber-600 dark:text-amber-400">{notice}</p>}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <p className="p-2 text-center text-[11px] text-muted-foreground">Loading companies…</p>
          ) : error ? (
            <p className="p-2 text-center text-[11px] text-destructive">Could not load companies — {error}</p>
          ) : !query.trim() ? (
            <p className="p-2 text-center text-[11px] text-muted-foreground">Type a company code or name.</p>
          ) : results.length === 0 ? (
            <p className="p-2 text-center text-[11px] text-muted-foreground">No companies match.</p>
          ) : (
            results.map((company) => {
              const code = companyCodeOf(company.company_code);
              const added = additionSet.has(code);
              return (
                <button
                  key={`${company.exchange}:${company.company_code}`}
                  type="button"
                  onClick={() => {
                    if (added) {
                      setNotice(`${code} is already in your additions.`);
                      return;
                    }
                    addAddition({ code, name: company.name, exchange: company.exchange || 'NSE', marker: company.marker });
                    setNotice(`Added ${code}.`);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold">{code}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{company.name}</span>
                  </span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{added ? 'Added' : company.exchange}</span>
                </button>
              );
            })
          )}
        </div>
        {additions.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t pt-2">
            {additions.map((entry) => (
              <RemovableChip key={entry.code} label={entry.code} onRemove={() => removeAddition(entry.code)} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── status + sections ─────────────────────────────────────────────────────

/** "Screened 2026-11-04 · 135 names" plus anything that is down. */
export function SurgeStatusLine({ view, className }: { view: SurgeWatchlistView; className?: string }) {
  const { snapshot, fetchError, quoteStatus, loading, live } = view;
  const screener = snapshot?.screener;
  const problems: string[] = [];
  if (fetchError) problems.push('Surge server unreachable');
  else {
    if (snapshot?.surgesError) problems.push('Surges unavailable');
    if (snapshot?.screenerError) problems.push('Screener unreachable');
  }
  if (quoteStatus === 'offline') problems.push('Live prices offline');

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b px-3 py-1 text-[9px] text-muted-foreground',
        className,
      )}
    >
      <span className="truncate">
        {loading
          ? 'Loading Surge screen…'
          : screener
            ? `Screened ${screener.date} · ${screener.n} names${screener.source === 'built' ? ' · built fresh' : ''}${live ? '' : ' · past screen'}`
            : 'Surge screener'}
      </span>
      {problems.length > 0 && <span className="shrink-0 text-amber-600 dark:text-amber-400">{problems.join(' · ')}</span>}
    </div>
  );
}

export function SurgeSectionHeader({ flipKey, children }: { flipKey: string; children: React.ReactNode }) {
  return (
    <div
      data-flip-key={flipKey}
      className="flex items-center justify-between border-b bg-muted/20 px-3 py-1.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </div>
  );
}

/** "Surging today · 12" with "by move since surge" / "order held while pointing". */
export function SurgingHeader({ count, hovering }: { count: number; hovering: boolean }) {
  return (
    <SurgeSectionHeader flipKey="header-surging">
      <span className="text-amber-600 dark:text-amber-400">Surging today · {count}</span>
      <span className="normal-case tracking-normal">{hovering ? 'order held while pointing' : 'by move since surge'}</span>
    </SurgeSectionHeader>
  );
}

export function PinnedHeader({ count }: { count: number }) {
  return (
    <SurgeSectionHeader flipKey="header-pinned">
      <span className="flex items-center gap-1">
        <Pin className="h-2.5 w-2.5" />
        Pinned · {count}
      </span>
    </SurgeSectionHeader>
  );
}

/** "My additions" — the user's own symbols, after the screened list. */
export function AdditionsHeader({ count }: { count: number }) {
  return (
    <SurgeSectionHeader flipKey="header-manual">
      <span>My additions</span>
      <span className="normal-case tracking-normal">{count}</span>
    </SurgeSectionHeader>
  );
}

export function TargetBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return (
    <span
      className="shrink-0 rounded-[3px] bg-green-500/15 px-1 py-px font-mono text-[9px] font-medium tabular-nums text-green-600 dark:text-green-400"
      title="Target move"
    >
      {formatTargetMovePct(value)}
    </span>
  );
}

/** The screener rank — lower is higher-priority. */
export function RankBadge({ rank, className }: { rank: number | null | undefined; className?: string }) {
  if (rank === null || rank === undefined || !Number.isFinite(rank)) return null;
  return (
    <span
      className={cn('shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70', className)}
      title="Surge screener rank"
    >
      #{rank}
    </span>
  );
}

/** LTP over day change %, right-aligned — the dashboard row's price block. */
export function LiveQuote({ quote, className }: { quote: SurgeQuote | undefined; className?: string }) {
  const positive = (quote?.changePercent ?? 0) >= 0;
  return (
    <div className={cn('flex shrink-0 flex-col items-end gap-0.5', className)}>
      <span className="font-mono text-xs tabular-nums">{quote ? formatPrice(quote.ltp) : '—'}</span>
      <span
        className={cn(
          'font-mono text-[10px] tabular-nums',
          !quote ? 'text-muted-foreground/50' : positive ? POSITIVE : NEGATIVE,
        )}
      >
        {quote ? formatSignedPct(quote.changePercent) : '—'}
      </span>
    </div>
  );
}

export function PinButton({ pinned, code, onToggle }: { pinned: boolean; code: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'shrink-0 transition-opacity focus-visible:opacity-100',
        pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${code}`}
      title={pinned ? 'Unpin' : 'Pin to top'}
    >
      {pinned ? (
        <PinOff className="h-3 w-3 text-amber-500 hover:text-muted-foreground" />
      ) : (
        <Pin className="h-3 w-3 text-muted-foreground hover:text-amber-500" />
      )}
    </button>
  );
}

/** Remove one of "My additions" — revealed on hover so the resting row stays clean. */
export function RemoveButton({ code, onRemove }: { code: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      aria-label={`Remove ${code}`}
      title="Remove from my additions"
    >
      <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
    </button>
  );
}

// ── the surge row ─────────────────────────────────────────────────────────

const ROW_GRID = 'grid-cols-[18px_1fr_72px]';

export interface SurgeRowProps {
  code: string;
  /** Second line when the row is not surging (a pinned name with no surge today). */
  subtitle?: string;
  quote: SurgeQuote | undefined;
  active: boolean;
  /** Screener rank, shown when the row is not surging. */
  rank?: number;
  targetMovePct: number | null;
  surge?: { entry: SurgeEntry; move: number | null; position: number };
  pinned?: boolean;
  onSelect: () => void;
  onTogglePin?: () => void;
  /** Shown for one of "My additions". */
  onRemove?: () => void;
  /** Multi-select mode: a checkbox replaces the direction icon. */
  checked?: boolean;
  className?: string;
}

/**
 * One surging (or pinned) name: direction icon, code with target %, the
 * surge's time, move since it and how many fired today, then LTP and day %.
 */
export function SurgeRow({
  code,
  subtitle,
  quote,
  active,
  rank,
  targetMovePct,
  surge,
  pinned,
  onSelect,
  onTogglePin,
  onRemove,
  checked,
  className,
}: SurgeRowProps) {
  const direction = surge ? (DIRECTION_STYLE[surge.entry.latest.direction] ?? DIRECTION_STYLE.NEUTRAL) : null;
  const DirectionIcon = direction?.icon;
  const latest = surge?.entry.latest;

  return (
    <div
      data-flip-key={`row-${code}`}
      data-flip-rank={surge?.position}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      title={latest ? `${latest.surgeType} · ${latest.direction}${latest.tercile ? ` · ${latest.tercile}` : ''} · score ${latest.score.toFixed(2)}${latest.reason ? `\n${latest.reason}` : ''}` : undefined}
      className={cn(
        'group relative grid cursor-pointer items-center gap-2 border-b border-border/50 px-3 py-2 transition-colors',
        'focus-visible:outline-1 focus-visible:[outline-offset:-1px]',
        ROW_GRID,
        surge && direction?.edge,
        active ? 'bg-accent' : surge ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.11]' : 'hover:bg-accent/50',
        className,
      )}
    >
      {checked !== undefined ? (
        <span
          className={cn(
            'flex h-3.5 w-3.5 items-center justify-center rounded border-2',
            checked ? 'border-primary bg-primary' : 'border-muted-foreground/50 bg-background',
          )}
        />
      ) : surge && DirectionIcon ? (
        <DirectionIcon className={cn('h-3 w-3', direction?.text)} />
      ) : (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">{rank ?? ''}</span>
      )}

      <div className="min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <span className={cn('min-w-0 truncate text-xs font-bold', active && 'text-primary')}>{code}</span>
          <TargetBadge value={targetMovePct} />
          {onTogglePin && <PinButton pinned={!!pinned} code={code} onToggle={onTogglePin} />}
          {onRemove && <RemoveButton code={code} onRemove={onRemove} />}
        </div>

        {surge ? (
          <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
            <span className="shrink-0 text-muted-foreground">{formatTimeIST(surge.entry.latest.detectedAt)}</span>
            <span
              className={cn(
                'shrink-0 font-medium',
                surge.move === null ? 'text-muted-foreground/50' : surge.move >= 0 ? POSITIVE : NEGATIVE,
              )}
            >
              {surge.move === null ? '—' : formatSignedPct(surge.move)}
            </span>
            <span className="truncate text-muted-foreground/60">
              since{surge.entry.count > 1 ? ` · ×${surge.entry.count}` : ''}
            </span>
          </div>
        ) : (
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        )}
      </div>

      <LiveQuote quote={quote} />
    </div>
  );
}
