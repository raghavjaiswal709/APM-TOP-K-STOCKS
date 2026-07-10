import TooltipPopover from '../ui/TooltipPopover'
import type { TileConfig } from '../../lib/types/tiles'

interface Props {
  tile: TileConfig
  isFo?: boolean
  loading?: boolean
  children: React.ReactNode
}

export default function Tile({ tile, isFo = true, loading = false, children }: Props) {
  const notFo = tile.foOnly && !isFo

  return (
    <TooltipPopover interpretation={tile.tooltip} freshness={tile.freshness}>
      <div className="flex flex-col gap-0.5 rounded-lg bg-card border border-border px-3 py-2 min-h-[56px] h-full hover:border-primary/30 transition-colors">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
          {tile.label}
        </span>
        <div className="text-sm text-foreground font-mono">
          {loading ? (
            <span className="text-muted-foreground/40 animate-pulse">—</span>
          ) : notFo ? (
            <span className="text-muted-foreground/60 text-xs">Not in F&amp;O</span>
          ) : (
            children
          )}
        </div>
      </div>
    </TooltipPopover>
  )
}
