'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
} from 'lightweight-charts'
import { fmtINR, fmtPct, colorForPct } from '../../lib/utils/format'

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'MAX'
const PERIODS: Period[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'MAX']

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface TooltipState {
  visible: boolean
  x: number
  y: number
  price: string
  time: string
}

interface Props {
  symbol: string
  date?: string
}

export default function HeroChart({ symbol, date }: Props) {
  const [period, setPeriod] = useState<Period>('1D')
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, price: '', time: '' })

  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const areaRef       = useRef<ISeriesApi<SeriesType> | null>(null)
  const vwapRef       = useRef<ISeriesApi<SeriesType> | null>(null)
  const prevRef       = useRef<ISeriesApi<SeriesType> | null>(null)

  const swrKey = date
    ? `/api/senta/chart/${symbol}?period=${period}&date=${date}`
    : `/api/senta/chart/${symbol}?period=${period}`
  const { data, isLoading } = useSWR(swrKey, fetcher, {
    refreshInterval: period === '1D' && !date ? 10_000 : 0,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 11,
        fontFamily: "'Inter', 'ui-monospace', monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#27272a', style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#52525b', style: LineStyle.Dashed, labelBackgroundColor: '#3f3f46' },
        horzLine: { color: '#52525b', style: LineStyle.Dashed, labelBackgroundColor: '#3f3f46' },
      },
      rightPriceScale: {
        borderColor: '#27272a',
        textColor: '#71717a',
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time: Time) => {
          if (typeof time !== 'number') return null
          return new Date(time * 1000).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          if (typeof time === 'number') {
            return new Date(time * 1000).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          }
          if (typeof time === 'string') return time
          return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
        },
      },
      handleScroll: true,
      handleScale: true,
    })

    areaRef.current = chart.addSeries(AreaSeries, {
      lineColor: '#2dd4bf',
      topColor: 'rgba(45,212,191,0.25)',
      bottomColor: 'rgba(45,212,191,0.0)',
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: '#2dd4bf',
      priceLineStyle: LineStyle.Solid,
      lastValueVisible: true,
    })

    vwapRef.current = chart.addSeries(LineSeries, {
      color: '#60a5fa',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    prevRef.current = chart.addSeries(LineSeries, {
      color: '#52525b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chart.subscribeCrosshairMove(param => {
      if (!param.point || !param.time || !el) {
        setTooltip(t => ({ ...t, visible: false }))
        return
      }
      const price = param.seriesData.get(areaRef.current!)
      if (!price) { setTooltip(t => ({ ...t, visible: false })); return }

      const val = 'value' in price ? (price as { value: number }).value
                : 'close' in price ? (price as { close: number }).close
                : 0
      const ts  = typeof param.time === 'number'
        ? new Date(param.time * 1000).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
          })
        : String(param.time)

      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        price: fmtINR(Number(val)),
        time: ts,
      })
    })

    chartRef.current = chart

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth })
    })
    ro.observe(el)
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      areaRef.current  = null
      vwapRef.current  = null
      prevRef.current  = null
    }
  }, [])

  useEffect(() => {
    if (!data?.bars || !areaRef.current || !vwapRef.current || !prevRef.current) return

    const is1D = period === '1D'

    const areaData = (data.bars as { timestamp?: string; date?: string; close: number; open: number }[])
      .filter(b => b.close != null)
      .map(b => ({
        time: is1D
          ? Math.floor(new Date(b.timestamp!).getTime() / 1000) as unknown as string
          : b.date as string,
        value: Number(b.close),
      }))

    if (areaData.length) {
      areaRef.current.setData(areaData as never)
    }

    if (is1D && data.vwap && areaData.length) {
      vwapRef.current.setData(areaData.map(d => ({ time: d.time, value: Number(data.vwap) })) as never)
    } else {
      vwapRef.current.setData([])
    }

    if (is1D && data.prevClose && areaData.length) {
      const pc = Number(data.prevClose)
      prevRef.current.setData(areaData.map(d => ({ time: d.time, value: pc })) as never)
    } else {
      prevRef.current.setData([])
    }

    if (is1D && areaData.length) {
      const vals = areaData.map(d => d.value)
      const lo  = Math.min(...vals)
      const hi  = Math.max(...vals)
      const pad = Math.max((hi - lo) * 0.15, hi * 0.003)
      const provider = () => ({
        priceRange: { minValue: lo - pad, maxValue: hi + pad },
      })
      areaRef.current.applyOptions({ autoscaleInfoProvider: provider })
      vwapRef.current.applyOptions({ autoscaleInfoProvider: provider })
      prevRef.current.applyOptions({ autoscaleInfoProvider: provider })
    } else {
      const passThrough = (base: () => unknown) => base()
      areaRef.current.applyOptions({ autoscaleInfoProvider: passThrough as never })
      vwapRef.current.applyOptions({ autoscaleInfoProvider: passThrough as never })
      prevRef.current.applyOptions({ autoscaleInfoProvider: passThrough as never })
    }

    chartRef.current?.timeScale().fitContent()
  }, [data, period])

  const bars = data?.bars ?? []
  const firstClose = bars.length ? Number(bars[0].close) : 0
  const lastClose  = bars.length ? Number(bars[bars.length - 1].close) : 0
  const chg        = firstClose ? lastClose - firstClose : 0
  const chgPct     = firstClose ? (chg / firstClose) * 100 : 0

  return (
    <div className="relative rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <span className="text-sm font-semibold text-zinc-200">{symbol} Price Chart</span>
          {!isLoading && bars.length > 0 && (
            <div className={`text-xs mt-0.5 ${colorForPct(chgPct)}`}>
              {chg >= 0 ? '+' : ''}{fmtINR(chg)} ({fmtPct(chgPct)})
            </div>
          )}
        </div>
        <div className="flex gap-0.5">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                period === p
                  ? 'text-teal-400 border-b-2 border-teal-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="w-full h-52" />

      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-10 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{
            left:      Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 400) - 160),
            top:       Math.max(tooltip.y - 16, 48),
            minWidth:  140,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="text-zinc-400">{tooltip.time}</div>
          <div className="text-zinc-100 font-semibold text-sm mt-0.5">{tooltip.price}</div>
        </div>
      )}

      {period === '1D' && data?.vwap && (
        <div className="flex gap-3 px-4 pb-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-px bg-teal-400 inline-block" />
            <span className="text-zinc-500">Price</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-px bg-blue-400 inline-block" style={{ borderTop: '1px dashed' }} />
            <span className="text-zinc-500">VWAP {fmtINR(Number(data.vwap))}</span>
          </span>
          {data.prevClose && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-px bg-zinc-500 inline-block" />
              <span className="text-zinc-500">Prev Close {fmtINR(Number(data.prevClose))}</span>
            </span>
          )}
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/60">
          <span className="text-zinc-600 text-xs animate-pulse">Loading chart…</span>
        </div>
      )}
    </div>
  )
}
