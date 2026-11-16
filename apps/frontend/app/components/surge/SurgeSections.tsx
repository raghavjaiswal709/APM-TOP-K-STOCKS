'use client';

import * as React from 'react';
import { SearchX } from 'lucide-react';
import { moveSinceSurge, type SurgeWatchlistView } from '@/hooks/useSurge';
import { formatTargetMovePct } from '@/lib/surge/filters';
import { PinnedHeader, SurgeRow, SurgeSectionHeader, SurgingHeader } from './SurgeControls';

/**
 * The Pinned and "Surging today" blocks a watchlist shows above its own rows
 * (the screened list, then "My additions"), as in the trading dashboard's
 * Watchlist panel. Pinned names lead in pin order and appear nowhere else;
 * a surging name is shown once, in the surging block.
 */
export function SurgeSections({
  view,
  activeCode,
  onSelect,
  nameByCode,
  isChecked,
  restLabel = 'Screened',
  restCount,
}: {
  view: SurgeWatchlistView;
  activeCode: string | null;
  onSelect: (code: string) => void;
  /** Company names the host list knows, for a pinned row that isn't surging. */
  nameByCode?: Map<string, string>;
  /** Multi-select mode: whether a code is checked. Omit outside multi-select. */
  isChecked?: (code: string) => boolean;
  /** Header over the host list's own rows, shown when a surge block sits above them. */
  restLabel?: string;
  restCount: number;
}) {
  const {
    pinnedCodes,
    surgeOrder,
    surgeByCode,
    quotes,
    targetOf,
    screenedByCode,
    pinnedSet,
    togglePin,
    additionSet,
    removeAddition,
    hovering,
    showSurging,
  } = view;

  return (
    <>
      {pinnedCodes.length > 0 && <PinnedHeader count={pinnedCodes.length} />}
      {pinnedCodes.map((code) => {
        // Off = the plain screener list: a pin keeps its spot but drops the surge line.
        const entry = showSurging ? surgeByCode.get(code) : undefined;
        const screened = screenedByCode.get(code);
        return (
          <SurgeRow
            key={`row-${code}`}
            code={code}
            quote={quotes[code]}
            active={code === activeCode}
            rank={screened?.watchlistRank}
            targetMovePct={targetOf(code)}
            subtitle={nameByCode?.get(code) ?? screened?.name ?? 'NSE'}
            surge={entry ? { entry, move: moveSinceSurge(entry, quotes[code]), position: -1 } : undefined}
            pinned
            onTogglePin={() => togglePin(code)}
            onRemove={additionSet.has(code) ? () => removeAddition(code) : undefined}
            onSelect={() => onSelect(code)}
            checked={isChecked?.(code)}
          />
        );
      })}

      {surgeOrder.length > 0 && <SurgingHeader count={surgeOrder.length} hovering={hovering} />}
      {surgeOrder.map((code, index) => {
        const entry = surgeByCode.get(code)!;
        return (
          <SurgeRow
            key={`row-${code}`}
            code={code}
            quote={quotes[code]}
            active={code === activeCode}
            targetMovePct={targetOf(code)}
            surge={{ entry, move: moveSinceSurge(entry, quotes[code]), position: index }}
            pinned={pinnedSet.has(code)}
            onTogglePin={() => togglePin(code)}
            onRemove={additionSet.has(code) ? () => removeAddition(code) : undefined}
            onSelect={() => onSelect(code)}
            checked={isChecked?.(code)}
          />
        );
      })}

      {restLabel && (pinnedCodes.length > 0 || surgeOrder.length > 0) && restCount > 0 && (
        <SurgeSectionHeader flipKey="header-rest">
          <span>{restLabel}</span>
          <span className="normal-case tracking-normal">{restCount}</span>
        </SurgeSectionHeader>
      )}
    </>
  );
}

/** Nothing visible: say why and offer the way back. */
export function SurgeNoMatches({
  view,
  onClearSearch,
}: {
  view: SurgeWatchlistView;
  onClearSearch: () => void;
}) {
  const reason =
    !view.filtersActive && view.targetFloorActive
      ? `No names have a target move of ${formatTargetMovePct(view.minTargetMove)} or more.`
      : view.filtersActive
        ? view.live
          ? view.surgingOnTop
            ? 'Surge filters only show names that surged today.'
            : 'Surge filters only show names that surged today. Turn on "Surging on top" to see them first.'
          : 'Surge filters only show names that surged on this day.'
        : 'Try a different name.';

  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <SearchX className="h-5 w-5 text-muted-foreground/50" />
      <p className="text-xs text-muted-foreground">No symbols match.</p>
      <p className="text-[10px] leading-snug text-muted-foreground/70">{reason}</p>
      <button
        type="button"
        className="mt-1 rounded-md border px-2 py-1 text-[11px] font-medium hover:bg-accent"
        onClick={() => {
          onClearSearch();
          view.filterState.resetFilters();
        }}
      >
        Clear search & filters
      </button>
    </div>
  );
}
