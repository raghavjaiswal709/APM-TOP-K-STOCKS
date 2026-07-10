'use client'

import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'

interface Holiday { date: string; name: string }
const fetcher = (url: string) => fetch(url).then(r => r.json())

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function firstDow(y: number, m: number)    { return new Date(y, m, 1).getDay() }
function dow(y: number, m: number, d: number) { return new Date(y, m, d).getDay() }

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']
const DOW    = ['Su','Mo','Tu','We','Th','Fr','Sa']

type Reason = 'future' | 'weekend' | 'holiday' | null

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function DatePicker({ value, onChange }: Props) {
  const today = todayIST()

  const [open,      setOpen]      = useState(false)
  const [viewYear,  setViewYear]  = useState(0)
  const [viewMonth, setViewMonth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useSWR<{ holidays: Holiday[] }>('/api/senta/holidays', fetcher, {
    revalidateOnFocus: false,
  })
  const holidayMap = new Map((data?.holidays ?? []).map(h => [h.date, h.name]))

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function toggle() {
    if (open) { setOpen(false); return }
    const anchor = value || today
    setViewYear(parseInt(anchor.slice(0, 4)))
    setViewMonth(parseInt(anchor.slice(5, 7)) - 1)
    setOpen(true)
  }

  const viewYM  = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const canNext = viewYM < today.slice(0, 7)

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (!canNext) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function whyDisabled(ds: string): Reason {
    if (ds > today) return 'future'
    if (dow(parseInt(ds.slice(0,4)), parseInt(ds.slice(5,7))-1, parseInt(ds.slice(8,10))) % 6 === 0)
      return 'weekend'
    if (holidayMap.has(ds)) return 'holiday'
    return null
  }

  function selectDay(day: number) {
    const ds = iso(viewYear, viewMonth, day)
    if (whyDisabled(ds)) return
    onChange(ds)
    setOpen(false)
  }

  const numDays  = daysInMonth(viewYear, viewMonth)
  const startPad = firstDow(viewYear, viewMonth)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="bg-muted border border-border rounded px-2 py-1 text-xs
                   focus:outline-none focus:border-ring min-w-[96px] text-left
                   hover:border-border/80 transition-colors text-foreground"
      >
        {value || <span className="text-muted-foreground">Latest</span>}
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-popover border border-border
                        rounded-lg shadow-2xl p-3 w-[224px] select-none">

          <div className="flex items-center justify-between mb-2">
            <button
              onClick={prevMonth}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground
                         hover:text-foreground hover:bg-muted rounded transition-colors text-sm"
            >‹</button>
            <span className="text-[11px] font-semibold text-foreground tracking-wide">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              disabled={!canNext}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground
                         hover:text-foreground hover:bg-muted rounded transition-colors text-sm
                         disabled:opacity-20 disabled:cursor-not-allowed"
            >›</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <div
                key={d}
                className={`text-center text-[9px] font-medium tracking-wide
                  ${d === 'Su' || d === 'Sa' ? 'text-muted-foreground/30' : 'text-muted-foreground'}`}
              >{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-[1px]">
            {Array.from({ length: startPad }, (_, i) => <div key={`p${i}`} />)}

            {Array.from({ length: numDays }, (_, i) => {
              const day = i + 1
              const ds  = iso(viewYear, viewMonth, day)
              const why = whyDisabled(ds)
              const sel = ds === value
              const isToday = ds === today

              let cls: string
              if (sel) {
                cls = 'bg-teal-500 text-white font-semibold'
              } else if (why === 'holiday') {
                cls = 'text-muted-foreground/30 cursor-not-allowed'
              } else if (why === 'weekend' || why === 'future') {
                cls = 'text-muted-foreground/30 cursor-not-allowed'
              } else {
                cls = 'text-foreground hover:bg-muted cursor-pointer'
              }

              return (
                <button
                  key={day}
                  disabled={!!why}
                  title={
                    why === 'holiday' ? `NSE Holiday: ${holidayMap.get(ds)}` :
                    why === 'weekend' ? 'Weekend — market closed' :
                    why === 'future'  ? 'Future date' : undefined
                  }
                  onClick={() => selectDay(day)}
                  className={`relative text-center text-[11px] rounded py-[3px] transition-colors
                    ${cls}
                    ${isToday && !sel ? 'ring-1 ring-inset ring-border' : ''}`}
                >
                  {day}
                  {why === 'holiday' && (
                    <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2
                                     w-[3px] h-[3px] rounded-full bg-amber-500" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[9px]">
            <span className="flex items-center gap-1 text-muted-foreground/50">
              <span className="inline-block w-[5px] h-[5px] rounded-full bg-amber-500" />
              NSE trading holiday
            </span>
            {value && (
              <button
                onClick={() => { onChange(''); setOpen(false) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear → Latest
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
