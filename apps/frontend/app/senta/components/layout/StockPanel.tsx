'use client'

import useSWR from 'swr'
import Tile from '../tiles/Tile'
import SparkLine from '../tiles/SparkLine'
import HeroChart from './HeroChart'
import { TILE_MAP } from '../../lib/tiles/registry'
import { fmtNum, fmtPct, fmtINR, fmtVol, fmtLargeNum, colorForPct } from '../../lib/utils/format'
import PriceArrow from '../ui/PriceArrow'
import { gapPct, vwap, vwapDistPct, atr14, dist52w, circuitBands } from '../../lib/utils/compute'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Props { symbol: string; date?: string }

export default function StockPanel({ symbol, date }: Props) {
  const key = date ? `/api/senta/stock/${symbol}?date=${date}` : `/api/senta/stock/${symbol}`
  const { data, isLoading } = useSWR(key, fetcher, { refreshInterval: date ? 0 : 3000 })
  const isFo = data?.universe?.f_o_eligible ?? (data?.derivatives != null)

  const sessionState = (data?.sessionState ?? 'closed') as 'pre-open' | 'live' | 'closed'

  const histBars    = (data?.histBars ?? []) as { date: string; open: number; high: number; low: number; close: number; volume: number }[]
  const histLast    = histBars.length > 0 ? histBars[histBars.length - 1] : null
  const histPrev    = histBars.length > 1 ? histBars[histBars.length - 2] : null

  const prevClose   = histLast ? Number(histLast.close) : 0
  const ltp         = data?.liveQuote?.ltp || prevClose
  const liveActive  = Boolean(data?.liveQuote?.ltp)

  const todayOpen    = liveActive
    ? (data?.liveQuote?.todayOpen ?? 0)
    : (histLast ? Number(histLast.open) : 0)
  const prevDayClose = liveActive
    ? (histLast ? Number(histLast.close) : 0)
    : (histPrev ? Number(histPrev.close) : 0)
  const gap          = prevDayClose && todayOpen ? gapPct(todayOpen, prevDayClose) : null

  const todayVol    = data?.liveQuote?.volume || (histLast ? Number(histLast.volume) : 0)
  const adv         = Number(data?.adv?.adv ?? 0)
  const bars        = data?.minuteBars ?? []
  const high52w     = data?.w52?.high_52w != null ? Number(data.w52.high_52w) : null
  const low52w      = data?.w52?.low_52w  != null ? Number(data.w52.low_52w)  : null
  const high52wDate = data?.w52?.high_52w_date as string | undefined
  const low52wDate  = data?.w52?.low_52w_date  as string | undefined
  const fmtShortDate = (d: string) =>
    new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const bandPct     = data?.circuitBand ?? 20
  const atrVal      = atr14(data?.atrBars ?? [])

  const vwapVal     = vwap(bars)
  const w52valid    = high52w && low52w && ltp
  const { distToHigh, distToLow } = w52valid
    ? dist52w(ltp, high52w!, low52w!)
    : { distToHigh: null, distToLow: null }
  const circuit     = circuitBands(prevClose, bandPct)
  const volPct      = adv ? (todayVol / adv) * 100 : 0

  return (
    <div className="flex flex-col gap-3">

      <HeroChart symbol={symbol} date={date} />

      <div className="grid grid-cols-2 gap-2">
        <Tile tile={TILE_MAP.B1} loading={isLoading}>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-bold">{symbol}</span>
            {isFo && <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded border border-blue-500/30">F&amp;O</span>}
            <span className="text-[9px] bg-muted text-muted-foreground px-1 rounded">
              {data?.universe?.market_cap_category ?? '—'}
            </span>
            {data?.nifty500 && (
              <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1 rounded border border-indigo-500/30">N500</span>
            )}
            {data?.nifty50?.everMember && (
              <span className={`text-[9px] px-1 rounded ${
                data.nifty50.activeAtDate
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted text-amber-500'
              }`}>
                N50 · {data.nifty50.displayDate}
              </span>
            )}
          </div>
        </Tile>
        <Tile tile={TILE_MAP.B2} loading={isLoading}>
          <span className="text-muted-foreground">{data?.universe?.industry ?? '—'}</span>
        </Tile>
        <Tile tile={TILE_MAP.B3} loading={isLoading}>
          <span>{data?.daily?.market_cap ? fmtLargeNum(Number(data.daily.market_cap)) : '—'}</span>
        </Tile>
        <Tile tile={TILE_MAP.B4} loading={isLoading}>
          <span>{data?.daily?.pe_ratio ? fmtNum(Number(data.daily.pe_ratio)) : '—'}</span>
        </Tile>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile tile={TILE_MAP.C1} loading={isLoading}>
          <div className="flex flex-col gap-1">
            <div>
              <span className="text-base font-bold">{ltp ? fmtINR(ltp) : '—'}</span>
              {liveActive && (
                <span className={`ml-2 text-xs ${colorForPct(data?.liveQuote?.pctChange ?? 0)}`}>
                  <PriceArrow value={data.liveQuote.pctChange} className="mr-0.5" />
                  {fmtPct(data.liveQuote.pctChange)}
                </span>
              )}
            </div>
            <SparkLine bars={data?.minuteBars ?? []} />
          </div>
        </Tile>
        <Tile tile={TILE_MAP.C2} loading={isLoading}>
          {gap != null
            ? <span className={colorForPct(gap)}>{fmtPct(gap)}</span>
            : <span className="text-muted-foreground text-xs">—</span>}
        </Tile>
        <Tile tile={TILE_MAP.C3} loading={isLoading}>
          {histLast ? (
            <div className="text-xs grid grid-cols-4 gap-1 font-mono">
              <span className="text-muted-foreground">O</span><span>{fmtNum(Number(histLast.open))}</span>
              <span className="text-emerald-400">H</span><span className="text-emerald-400 font-bold">{fmtNum(Number(histLast.high))}</span>
              <span className="text-red-400">L</span><span className="text-red-400 font-bold">{fmtNum(Number(histLast.low))}</span>
              <span className="text-muted-foreground">C</span><span>{fmtNum(Number(histLast.close))}</span>
              <span className="text-muted-foreground">V</span><span className="col-span-3">{fmtVol(Number(histLast.volume))}</span>
            </div>
          ) : '—'}
        </Tile>
        <Tile
          tile={{
            ...TILE_MAP.C4,
            label: data?.preOpen || sessionState !== 'closed' ? 'Premarket OHLCV' : 'IEP',
          }}
          loading={isLoading}
        >
          {sessionState === 'pre-open' && bars.length > 0 ? (
            <div className="text-xs grid grid-cols-4 gap-1 font-mono">
              <span className="text-muted-foreground">O</span>
              <span>{fmtNum(bars[0].open)}</span>
              <span className="text-emerald-400">H</span>
              <span className="text-emerald-400 font-bold">
                {fmtNum(bars.reduce((m: number, b: { high: number }) => Math.max(m, b.high), -Infinity))}
              </span>
              <span className="text-red-400">L</span>
              <span className="text-red-400 font-bold">
                {fmtNum(bars.reduce((m: number, b: { low: number }) => Math.min(m, b.low), Infinity))}
              </span>
              <span className="text-muted-foreground">C</span>
              <span>{fmtNum(bars[bars.length - 1].close)}</span>
              <span className="text-muted-foreground">V</span>
              <span className="col-span-3">
                {fmtVol(bars.reduce((s: number, b: { volume: number }) => s + b.volume, 0))}
              </span>
            </div>
          ) : data?.preOpen ? (
            <div className="text-xs grid grid-cols-4 gap-1 font-mono">
              <span className="text-muted-foreground col-span-2">IEP</span>
              <span className="col-span-2 font-bold">{fmtINR(data.preOpen.iep)}</span>
              <span className="text-muted-foreground">V</span>
              <span className="col-span-3">{fmtVol(data.preOpen.iepQty)}</span>
            </div>
          ) : (
            <span className="text-muted-foreground/50 text-xs">—</span>
          )}
        </Tile>
        <Tile tile={TILE_MAP.C5} loading={isLoading}>
          {vwapVal ? (
            <span>
              {fmtINR(vwapVal)}
              <span className={`ml-2 text-xs ${colorForPct(vwapDistPct(ltp, vwapVal))}`}>
                {fmtPct(vwapDistPct(ltp, vwapVal))}
              </span>
            </span>
          ) : <span className="text-muted-foreground text-xs">Intraday only</span>}
        </Tile>
        <Tile tile={TILE_MAP.C6} loading={isLoading}>
          {data?.lastWL ? (
            <span className="text-xs">
              {fmtShortDate(data.lastWL.date)}
              <span className="ml-2 text-muted-foreground">#{data.lastWL.rank}</span>
            </span>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </Tile>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile tile={TILE_MAP.D1} loading={isLoading}>
          <div>
            <span>{fmtVol(todayVol)}</span>
            <span className={`ml-1 text-xs ${colorForPct(volPct - 100)}`}>{fmtNum(volPct, 0)}%</span>
          </div>
        </Tile>
        <Tile tile={TILE_MAP.D2} loading={isLoading}>
          <span className={colorForPct(volPct - 100)}>{fmtNum(volPct, 0)}% pace</span>
        </Tile>
        <Tile tile={TILE_MAP.D3} loading={isLoading}>
          <span>{data?.daily?.delivery_pct != null ? fmtPct(data.daily.delivery_pct) : '—'}</span>
        </Tile>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile tile={TILE_MAP.E1} isFo={isFo} loading={isLoading}>
          {data?.derivatives?.pcr != null ? (() => {
            const pcr = Number(data.derivatives.pcr)
            const col = pcr < 0.8 ? 'text-emerald-400' : pcr > 1.2 ? 'text-red-400' : 'text-foreground'
            return <span className={col}>{fmtNum(pcr)}</span>
          })() : <span>—</span>}
        </Tile>
        <Tile tile={TILE_MAP.E2} isFo={isFo} loading={isLoading}>
          <span>{data?.derivatives?.max_pain_strike != null ? fmtINR(data.derivatives.max_pain_strike) : '—'}</span>
        </Tile>
        <Tile tile={TILE_MAP.E3} loading={isLoading}>
          {w52valid ? (
            <div className="text-xs space-y-0.5">
              <div>
                <span className="text-emerald-400">{fmtINR(high52w!)}</span>
                <span className={`ml-1 ${colorForPct(distToHigh!)}`}>{fmtPct(distToHigh!, 1)}</span>
                {high52wDate && <span className="ml-1 text-muted-foreground/50">{fmtShortDate(high52wDate)}</span>}
              </div>
              <div>
                <span className="text-red-400">{fmtINR(low52w!)}</span>
                <span className={`ml-1 ${colorForPct(distToLow!)}`}>{fmtPct(distToLow!, 1)}</span>
                {low52wDate && <span className="ml-1 text-muted-foreground/50">{fmtShortDate(low52wDate)}</span>}
              </div>
            </div>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </Tile>
        <Tile tile={TILE_MAP.E4} loading={isLoading}>
          {(() => {
            const si      = data?.sectorIndex as { level: number; pctChange: number } | null | undefined
            const idxName = data?.universe?.nse_sectoral_index ?? 'sector'

            const stockDayPct: number | null = liveActive
              ? (data?.liveQuote?.pctChange ?? null)
              : (histLast && histPrev
                  ? ((Number(histLast.close) - Number(histPrev.close)) / Number(histPrev.close)) * 100
                  : null)

            const relPct: number | null = (stockDayPct != null && si)
              ? stockDayPct - si.pctChange
              : null

            if (relPct == null) return <span className="text-muted-foreground">—</span>
            return (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className={colorForPct(relPct)}><PriceArrow value={relPct} className="mr-0.5" /></span>
                  <span className={`font-bold ${colorForPct(relPct)}`}>{fmtPct(relPct, 2)}</span>
                  <span className="text-muted-foreground text-[10px] font-sans">today</span>
                </div>
                {si && (
                  <div className="flex items-center gap-1 text-[10px] font-sans text-muted-foreground">
                    <span className="truncate max-w-[64px]">{idxName}</span>
                    <span className={colorForPct(si.pctChange)}>{fmtPct(si.pctChange, 2)}</span>
                  </div>
                )}
              </div>
            )
          })()}
        </Tile>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Tile tile={TILE_MAP.F1} loading={isLoading}>
          {prevClose ? (
            <div className="text-xs">
              <span className="text-emerald-400">{fmtINR(circuit.upper)}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-red-400">{fmtINR(circuit.lower)}</span>
              <span className="ml-1 text-muted-foreground">({bandPct}%)</span>
            </div>
          ) : <span className="text-muted-foreground text-xs">—</span>}
        </Tile>
        <Tile tile={TILE_MAP.F2} loading={isLoading}>
          <span>
            {atrVal ? fmtINR(atrVal) : '—'}
            <span className="ml-1 text-xs text-muted-foreground">
              ({atrVal && prevClose ? fmtPct((atrVal / prevClose) * 100, 1) : '—'})
            </span>
          </span>
        </Tile>
        <Tile tile={TILE_MAP.F3} loading={isLoading}>
          {data?.orderBook ? (
            <span>
              {fmtINR(data.orderBook.bestAsk - data.orderBook.bestBid)}
              <span className="ml-1 text-xs text-muted-foreground">spread</span>
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-xs">
              {sessionState === 'closed' ? '—' : 'Connecting…'}
            </span>
          )}
        </Tile>
      </div>

    </div>
  )
}
