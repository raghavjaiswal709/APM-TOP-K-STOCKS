'use client'

import * as Tooltip from '@radix-ui/react-tooltip'
import { FRESHNESS_LABEL } from '../../lib/tiles/registry'
import type { Freshness } from '../../lib/types/tiles'

interface Props {
  interpretation: string
  freshness: Freshness
  children: React.ReactNode
}

export default function TooltipPopover({ interpretation, freshness, children }: Props) {
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="cursor-default outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded">
            {children}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            className="z-50 max-w-xs rounded-lg bg-popover border border-border px-3 py-2 text-xs text-popover-foreground shadow-xl"
            sideOffset={6}
          >
            <p>{interpretation}</p>
            <p className="mt-1 text-muted-foreground">Freshness: {FRESHNESS_LABEL[freshness] ?? freshness}</p>
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
