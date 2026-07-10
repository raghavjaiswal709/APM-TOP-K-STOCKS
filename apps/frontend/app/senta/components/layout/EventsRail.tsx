'use client'

import useSWR from 'swr'
import { useState, useEffect } from 'react'
import type { EventItem } from '../../lib/types/tiles'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const TYPE_LABELS: Record<string, string> = {
  news:             'News',
  announcement:     'Filing',
  board_meeting:    'Board',
  corporate_action: 'Corp Act',
  bulk_block:       'Block/Bulk',
}

const TYPE_COLORS: Record<string, string> = {
  news:             'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  announcement:     'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  board_meeting:    'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  corporate_action: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  bulk_block:       'bg-orange-500/20 text-orange-400 border border-orange-500/30',
}

function SentimentDot({ score }: { score: number | string | null }) {
  if (score == null) return null
  const s = Number(score)
  if (isNaN(s)) return null
  const color = s > 0.1 ? 'bg-emerald-400' : s < -0.1 ? 'bg-red-400' : 'bg-muted-foreground'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color} ml-1 flex-shrink-0`} title={`Sentiment: ${s.toFixed(2)}`} />
}

interface Props { symbol: string; date?: string }

export default function EventsRail({ symbol, date }: Props) {
  const key = date ? `/api/senta/events/${symbol}?date=${date}` : `/api/senta/events/${symbol}`
  const { data, isLoading } = useSWR(key, fetcher, { refreshInterval: date ? 0 : 60_000 })
  const [filter,        setFilter]        = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)

  useEffect(() => {
    if (!selectedEvent) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedEvent(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedEvent])

  const events: EventItem[] = data?.events ?? []
  const visible = filter ? events.filter(e => e.type === filter) : events
  const types = Array.from(new Set(events.map(e => e.type)))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
            filter === null
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              filter === t
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      <div
        className="flex-1 overflow-y-auto
                   [&::-webkit-scrollbar]:w-1.5
                   [&::-webkit-scrollbar-track]:bg-transparent
                   [&::-webkit-scrollbar-thumb]:bg-muted
                   [&::-webkit-scrollbar-thumb]:rounded-full
                   [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30"
        style={{ direction: 'rtl' }}
      >
        <div className="divide-y divide-border/50" style={{ direction: 'ltr' }}>
          {isLoading && (
            <div className="px-3 py-4 text-muted-foreground/50 text-xs text-center">Loading…</div>
          )}
          {!isLoading && visible.length === 0 && (
            <div className="px-3 py-4 text-muted-foreground/50 text-xs text-center">No events</div>
          )}
          {visible.map((ev, i) => {
            const expandable = ev.type !== 'news'
            return (
              <div
                key={i}
                onClick={() => expandable && setSelectedEvent(ev)}
                className={`px-3 py-2 hover:bg-accent/40 transition-colors ${expandable ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start gap-1.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 mt-0.5 ${TYPE_COLORS[ev.type] ?? 'bg-muted text-muted-foreground'}`}>
                    {TYPE_LABELS[ev.type] ?? ev.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      {ev.url ? (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="text-xs text-foreground hover:text-primary leading-tight line-clamp-2">
                          {ev.summary}
                        </a>
                      ) : (
                        <span className="text-xs text-foreground leading-tight line-clamp-2">{ev.summary}</span>
                      )}
                      {ev.sentimentDot != null && <SentimentDot score={ev.sentimentDot} />}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                        {ev.source && <span className="ml-1">&middot; {ev.source}</span>}
                      </span>
                      {expandable && <span className="text-[10px] text-muted-foreground/50">›</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedEvent && (() => {
        const [modalTitle, ...bodyParts] = (selectedEvent.detail ?? selectedEvent.summary).split('\n\n')
        const modalBody = bodyParts.join('\n\n')
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            onClick={() => setSelectedEvent(null)}
          >
            <div
              className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${TYPE_COLORS[selectedEvent.type] ?? 'bg-muted text-muted-foreground'}`}>
                    {TYPE_LABELS[selectedEvent.type] ?? selectedEvent.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedEvent.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground text-base leading-none flex-shrink-0 transition-colors"
                  aria-label="Close"
                >✕</button>
              </div>

              <div className="px-4 py-3 overflow-y-auto">
                <p className="text-sm font-semibold text-foreground mb-2">{modalTitle}</p>
                {modalBody && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{modalBody}</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
