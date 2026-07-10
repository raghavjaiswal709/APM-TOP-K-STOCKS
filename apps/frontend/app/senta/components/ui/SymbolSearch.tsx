'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
  symbols:  string[]
  value:    string
  onChange: (s: string) => void
}

export default function SymbolSearch({ symbols, value, onChange }: Props) {
  const [open,        setOpen]        = useState(false)
  const [query,       setQuery]       = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const listRef      = useRef<HTMLUListElement>(null)

  const filtered = query
    ? symbols.filter(s => s.toLowerCase().includes(query.toLowerCase()))
    : symbols

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const idx = symbols.indexOf(value)
    setHighlighted(idx >= 0 ? idx : 0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    const item = listRef.current?.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const commit = useCallback((s: string) => {
    onChange(s)
    setOpen(false)
    setQuery('')
  }, [onChange])

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'Escape':
        setOpen(false); setQuery(''); break
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(h => Math.min(h + 1, filtered.length - 1)); break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(h => Math.max(h - 1, 0)); break
      case 'Enter':
        if (filtered[highlighted]) commit(filtered[highlighted]); break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="bg-muted border border-border rounded px-2 py-1 text-xs w-44 flex items-center justify-between gap-1 focus:outline-none focus:border-ring hover:border-border/80 transition-colors text-foreground"
      >
        <span className="truncate font-medium">{value}</span>
        <span className="text-muted-foreground text-[10px] flex-shrink-0">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-52 bg-popover border border-border rounded-lg shadow-2xl overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search symbol…"
              className="w-full bg-muted rounded px-2 py-1 text-xs placeholder-muted-foreground/50 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground/50">No matches</li>
            ) : (
              filtered.map((s, i) => (
                <li
                  key={s}
                  onMouseDown={() => commit(s)}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-3 py-1 text-xs cursor-pointer select-none ${
                    i === highlighted ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  } ${s === value ? 'font-semibold text-teal-400' : ''}`}
                >
                  {s}
                </li>
              ))
            )}
          </ul>

          <div className="px-3 py-1 border-t border-border text-[9px] text-muted-foreground/50">
            {filtered.length}/{symbols.length} symbols
          </div>
        </div>
      )}
    </div>
  )
}
