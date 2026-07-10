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
  type Time,
} from 'lightweight-charts'
import { fmtNum, colorForPct, fmtPct } from '../../lib/utils/format'
import PriceArrow from '../ui/PriceArrow'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'MAX'
const PERIODS:     Period[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'MAX']
const FII_PERIODS: Period[] = ['1M', '3M', '6M', '1Y', 'MAX']

type FiiDiiBar = {
  date: string
  fii_net_value: number;  dii_net_value: number
  fii_gross_buy: number;  fii_gross_sell: number
  dii_gross_buy: number;  dii_gross_sell: number
}

interface Props {
  symbol:           string
  label:            string
  date?:            string
  onClose:          () => void
  onSelectSymbol?:  (s: string) => void
}

export default function IndexChartModal({ symbol, label, date, onClose, onSelectSymbol }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const isGiftNifty = symbol === 'GIFT_NIFTY'
  const isFiiDii    = symbol === 'FII_DII'
  const isNifty50   = symbol === 'NIFTY50'

  const [period, setPeriod] = useState<Period>(() => isFiiDii ? '3M' : '1D')

  const chartKey = isGiftNifty
    ? `/api/senta/gift-nifty-chart${date ? `?date=${date}` : ''}`
    : isFiiDii
      ? `/api/senta/fii-dii-chart?period=${period}${date ? `&date=${date}` : ''}`
      : `/api/senta/index-chart/${symbol}?period=${period}${date ? `&date=${date}` : ''}`

  const { data: chartData, isLoading } = useSWR(chartKey, fetcher, { revalidateOnFocus: false })

  const constKey = isNifty50
    ? `/api/senta/nifty50-constituents${date ? `?date=${date}` : ''}`
    : null
  const { data: constData } = useSWR(constKey, fetcher, { revalidateOnFocus: false })

  useEffect(() => {
    if (!containerRef.current || !chartData?.bars?.length) return
    const el    = containerRef.current
    const is1D  = period === '1D' && !isGiftNifty && !isFiiDii
    const prevClose = chartData.prevClose ? Number(chartData.prevClose) : null

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 10,
        fontFamily: "'Inter', monospace",
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
      rightPriceScale: { borderColor: '#27272a', textColor: '#71717a' },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: is1D,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          if (typeof time !== 'number') return null
          return new Date(time * 1000).toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
          })
        },
      },
      localization: {
        timeFormatter: (time: Time) => {
          if (typeof time === 'number') {
            return new Date(time * 1000).toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
              hour: '2-digit', minute: '2-digit', hour12: true,
            })
          }
          if (typeof time === 'string') return time
          const bd = time as { year: number; month: number; day: number }
          return `${bd.day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][bd.month - 1]} '${String(bd.year).slice(-2)}`
        },
      },
      handleScroll: true,
      handleScale: true,
    })

    if (isFiiDii) {
      const fiiData = (chartData.bars as FiiDiiBar[]).map(b => ({
        time: b.date as string,
        value: Number(b.fii_net_value),
      }))
      const diiData = (chartData.bars as FiiDiiBar[]).map(b => ({
        time: b.date as string,
        value: Number(b.dii_net_value),
      }))
      chart.addSeries(LineSeries, {
        color: '#2dd4bf', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, title: 'FII',
      }).setData(fiiData as never)
      chart.addSeries(LineSeries, {
        color: '#818cf8', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true, title: 'DII',
      }).setData(diiData as never)
    } else {
      const bars = is1D
        ? (chartData.bars as { timestamp: string; close: number }[]).map(b => ({
            time: Math.floor(new Date(b.timestamp).getTime() / 1000) as unknown as string,
            value: Number(b.close),
          }))
        : (chartData.bars as { date: string; close: number }[]).map(b => ({
            time: b.date as string,
            value: Number(b.close),
          }))

      chart.addSeries(AreaSeries, {
        lineColor: '#2dd4bf',
        topColor: 'rgba(45,212,191,0.25)',
        bottomColor: 'rgba(45,212,191,0)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      }).setData(bars as never)

      if (is1D && prevClose && bars.length) {
        chart.addSeries(LineSeries, {
          color: '#52525b', lineWidth: 1, lineStyle: LineStyle.Dashed,
          priceLineVisible: false, lastValueVisible: false,
        }).setData(bars.map(d => ({ time: d.time, value: prevClose })) as never)
      }
    }

    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
    ro.observe(el)
    return () => { ro.disconnect(); chart.remove() }
  }, [chartData, period])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const bars       = chartData?.bars ?? []
  const firstClose = !isFiiDii && bars.length ? Number((bars[0] as { close?: number }).close ?? 0) : 0
  const lastClose  = !isFiiDii && bars.length ? Number((bars[bars.length - 1] as { close?: number }).close ?? 0) : 0
  const chgPct     = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0
  const fiiDiiLast = isFiiDii && bars.length ? bars[bars.length - 1] as unknown as FiiDiiBar : null

  const constituents: string[] = constData?.symbols ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-zinc-200">{label}</span>
            {!isGiftNifty && !isFiiDii && (
              <span className="text-xs text-zinc-500 font-mono">{symbol}</span>
            )}
            {isFiiDii && fiiDiiLast && (
              <>
                <span className={`text-xs font-mono ${colorForPct(Number(fiiDiiLast.fii_net_value))}`}>
                  FII {Number(fiiDiiLast.fii_net_value) >= 0 ? '+' : '−'}{fmtNum(Math.abs(Number(fiiDiiLast.fii_net_value)), 0)} Cr
                </span>
                <span className={`text-xs font-mono ${colorForPct(Number(fiiDiiLast.dii_net_value))}`}>
                  DII {Number(fiiDiiLast.dii_net_value) >= 0 ? '+' : '−'}{fmtNum(Math.abs(Number(fiiDiiLast.dii_net_value)), 0)} Cr
                </span>
              </>
            )}
            {!isFiiDii && !isLoading && bars.length > 0 && (
              <span className={`text-xs ${colorForPct(chgPct)}`}>
                <PriceArrow value={chgPct} className="mr-0.5" />
                {fmtPct(chgPct, 2)} · {fmtNum(lastClose, 2)}
              </span>
            )}
            {date && <span className="text-xs text-blue-400">{date}</span>}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-sm flex-shrink-0 ml-2"
            aria-label="Close"
          >✕</button>
        </div>

        {!isGiftNifty && (
          <div className="flex items-center gap-0.5 px-4 pt-2 flex-shrink-0">
            {(isFiiDii ? FII_PERIODS : PERIODS).map(p => (
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
        )}

        <div className="flex-shrink-0 px-4 pt-2 pb-3 relative">
          <div ref={containerRef} className="h-48 w-full rounded overflow-hidden" />
          {isLoading && (
            <div className="absolute inset-0 mx-4 flex items-center justify-center bg-zinc-950/80 rounded">
              <span className="text-zinc-600 text-xs animate-pulse">Loading…</span>
            </div>
          )}
          {!isLoading && !bars.length && (
            <div className="absolute inset-0 mx-4 flex items-center justify-center">
              <span className="text-zinc-600 text-xs">No data available</span>
            </div>
          )}
          {isFiiDii && bars.length > 0 && (
            <div className="flex gap-3 mt-1 px-1">
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="inline-block w-3 h-0.5 bg-teal-400 rounded" />FII Net
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="inline-block w-3 h-0.5 bg-indigo-400 rounded" />DII Net
              </span>
            </div>
          )}
        </div>

        {isNifty50 && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-zinc-800 pt-3 min-h-0">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Constituents at {date ?? 'latest'} · {constituents.length} stocks
              {onSelectSymbol && <span className="ml-1 text-zinc-600">(click to view)</span>}
            </p>
            <div className="flex flex-wrap gap-1">
              {constituents.length === 0 && (
                <span className="text-xs text-zinc-600 animate-pulse">Loading…</span>
              )}
              {constituents.map(s => (
                <button
                  key={s}
                  onClick={() => { onSelectSymbol?.(s); onClose() }}
                  className="text-[10px] px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-teal-400 rounded font-mono transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {isFiiDii && bars.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0 border-t border-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] font-mono">
                <thead className="sticky top-0 bg-zinc-950 z-10">
                  <tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left px-3 py-1.5 font-medium">Date</th>
                    <th className="text-right px-2 py-1.5 font-medium text-teal-500/80">FII Net</th>
                    <th className="text-right px-2 py-1.5 font-medium text-indigo-400/80">DII Net</th>
                    <th className="text-right px-2 py-1.5 font-medium">FII Buy</th>
                    <th className="text-right px-2 py-1.5 font-medium">FII Sell</th>
                    <th className="text-right px-2 py-1.5 font-medium">DII Buy</th>
                    <th className="text-right px-2 py-1.5 font-medium">DII Sell</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(bars as FiiDiiBar[])].reverse().map(r => (
                    <tr key={r.date} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                      <td className="px-3 py-1 text-zinc-400">{r.date}</td>
                      <td className={`px-2 py-1 text-right ${colorForPct(Number(r.fii_net_value))}`}>
                        {r.fii_net_value != null
                          ? `${Number(r.fii_net_value) >= 0 ? '+' : '−'}${fmtNum(Math.abs(Number(r.fii_net_value)), 0)}`
                          : '—'}
                      </td>
                      <td className={`px-2 py-1 text-right ${colorForPct(Number(r.dii_net_value))}`}>
                        {r.dii_net_value != null
                          ? `${Number(r.dii_net_value) >= 0 ? '+' : '−'}${fmtNum(Math.abs(Number(r.dii_net_value)), 0)}`
                          : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-zinc-300">
                        {r.fii_gross_buy != null ? fmtNum(Number(r.fii_gross_buy), 0) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-zinc-300">
                        {r.fii_gross_sell != null ? fmtNum(Number(r.fii_gross_sell), 0) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-zinc-300">
                        {r.dii_gross_buy != null ? fmtNum(Number(r.dii_gross_buy), 0) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-zinc-300">
                        {r.dii_gross_sell != null ? fmtNum(Number(r.dii_gross_sell), 0) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
