export type Section = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Freshness = 'live' | 'pre-open' | 'prev-session' | 'prev-close' | 'TTM' | 'event' | 'static'
export type RefreshStrategy = 'live' | 'session' | 'static'
export type DisplayType = 'number' | 'badge' | 'chart' | 'heatmap' | 'ohlc' | 'range' | 'text'
export type DbSource = 'sentiment_db' | 'live_db' | 'computed'

export interface TileConfig {
  id: string
  label: string
  section: Section
  source: DbSource
  tooltip: string
  freshness: Freshness
  foOnly?: boolean
  refresh: RefreshStrategy
  display: DisplayType
}

export interface TileData {
  id: string
  value: unknown
  error?: string
  loading?: boolean
}

export interface SectorBar {
  symbol: string
  name: string
  pct: number
}

export interface OHLCData {
  open: number
  high: number
  low: number
  close: number
}

export interface EventItem {
  type: 'announcement' | 'board_meeting' | 'corporate_action' | 'bulk_block' | 'news'
  date: string
  summary: string
  detail?: string
  url?: string
  sentimentDot?: number | string | null
  source?: string | null
}
