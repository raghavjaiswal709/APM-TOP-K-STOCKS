'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Tile from '../tiles/Tile'
import { TILE_MAP } from '../../lib/tiles/registry'
import { fmtNum, fmtPct, colorForPct, bgColorForPct } from '../../lib/utils/format'
import PriceArrow from '../ui/PriceArrow'
import IndexChartModal from './IndexChartModal'
import type { SectorBar } from '../../lib/types/tiles'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const SHORT: Record<string, string> = {
  AUTO:               'AUTO',
  BANK:               'BANK',
  COMMODITIES:        'COMM',
  CONSUMER_DURABLES:  'CDUR',
  ENERGY:             'ENRG',
  FIN_SERVICES:       'FINS',
  FIN_SERVICES_2550:  'F25',
  FMCG:               'FMCG',
  HEALTHCARE:         'HLTH',
  INFRA:              'INFR',
  IT:                 'IT',
  MEDIA:              'MEDI',
  METAL:              'METL',
  OIL_GAS:            'OIL',
  PHARMA:             'PHRM',
  PRIVATE_BANK:       'PVTB',
  PSU_BANK:           'PSUB',
  REALTY:             'RLTY',
}

interface Props {
  date?:           string
  onSelectSymbol?: (s: string) => void
}

const Sep = () => <div className="w-px self-stretch bg-border mx-1 flex-shrink-0" />

export default function SectionA({ date, onSelectSymbol }: Props) {
  const key = date ? `/api/senta/market-pulse?date=${date}` : '/api/senta/market-pulse'
  const { data, isLoading } = useSWR(key, fetcher, { refreshInterval: date ? 0 : 5000 })

  const [target,        setTarget]        = useState<{ symbol: string; label: string } | null>(null)
  const [showAllGlobal, setShowAllGlobal] = useState(false)

  const sectors: SectorBar[] = data?.sectors ?? []

  return (
    <>
      <div className="flex-shrink-0 flex border-b border-border bg-background">

        <div className="flex-1 flex flex-col min-w-0">

          <div className="flex items-stretch gap-2 px-4 pt-2 pb-1.5 border-b border-border/50 overflow-x-auto">

            <Tile tile={TILE_MAP.A2} loading={isLoading}>
              <button
                onClick={() => setTarget({ symbol: 'GIFT_NIFTY', label: 'Gift Nifty' })}
                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={colorForPct(data?.giftNifty?.gift_nifty_premium_pct ?? 0)}>
                  {fmtPct(data?.giftNifty?.gift_nifty_premium_pct ?? 0)}
                  <span className="ml-1 text-muted-foreground text-xs">({fmtNum(data?.giftNifty?.gift_nifty_points ?? 0)})</span>
                </span>
              </button>
            </Tile>

            <Tile tile={TILE_MAP.A1} loading={isLoading}>
              <button
                onClick={() => setTarget({ symbol: 'INDIAVIX', label: 'India VIX' })}
                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={colorForPct(data?.vix?.pctChange ?? 0)}>
                  {fmtNum(data?.vix?.level ?? 0)}{' '}
                  <span className="text-xs">
                    <PriceArrow value={data?.vix?.pctChange ?? 0} className="mr-0.5" />
                    {fmtPct(data?.vix?.pctChange ?? 0)}
                  </span>
                </span>
              </button>
            </Tile>

            <Sep />

            <Tile tile={TILE_MAP.A3} loading={isLoading}>
              <button
                onClick={() => setTarget({ symbol: 'NIFTY50', label: 'Nifty 50' })}
                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={colorForPct(data?.nifty?.pctChange ?? 0)}>
                  {fmtNum(data?.nifty?.level ?? 0, 0)}{' '}
                  <span className="text-xs">
                    <PriceArrow value={data?.nifty?.pctChange ?? 0} className="mr-0.5" />
                    {fmtPct(data?.nifty?.pctChange ?? 0)}
                  </span>
                </span>
              </button>
            </Tile>

            <Tile tile={TILE_MAP.A7} loading={isLoading}>
              <button
                onClick={() => setTarget({ symbol: 'SENSEX', label: 'Sensex' })}
                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={colorForPct(data?.sensex?.pctChange ?? 0)}>
                  {fmtNum(data?.sensex?.level ?? 0, 0)}{' '}
                  <span className="text-xs">
                    <PriceArrow value={data?.sensex?.pctChange ?? 0} className="mr-0.5" />
                    {fmtPct(data?.sensex?.pctChange ?? 0)}
                  </span>
                </span>
              </button>
            </Tile>

            <Tile tile={TILE_MAP.A8} loading={isLoading}>
              <button
                onClick={() => setTarget({ symbol: 'NIFTY500', label: 'Nifty 500' })}
                className="text-left hover:opacity-80 transition-opacity cursor-pointer"
              >
                <span className={colorForPct(data?.nifty500?.pctChange ?? 0)}>
                  {fmtNum(data?.nifty500?.level ?? 0, 0)}{' '}
                  <span className="text-xs">
                    <PriceArrow value={data?.nifty500?.pctChange ?? 0} className="mr-0.5" />
                    {fmtPct(data?.nifty500?.pctChange ?? 0)}
                  </span>
                </span>
              </button>
            </Tile>

          </div>

          <div className="flex items-stretch gap-2 px-4 pt-1.5 pb-2 overflow-x-auto">

            <Tile tile={TILE_MAP.A6} loading={isLoading}>
              <div className="flex gap-x-3 gap-y-0.5 flex-wrap max-w-[240px]">
                {((data?.globalIndices ?? []) as { index_name: string; pct_change: number }[])
                  .slice(0, showAllGlobal ? undefined : 6)
                  .map((g) => (
                    <span key={g.index_name} className={`text-xs font-mono whitespace-nowrap ${colorForPct(g.pct_change)}`}>
                      {g.index_name.replace(/_/g, ' ')} <PriceArrow value={g.pct_change} className="mr-0.5" />{fmtPct(g.pct_change, 1)}
                    </span>
                  ))}
                {(data?.globalIndices?.length ?? 0) > 6 && (
                  <button
                    onClick={() => setShowAllGlobal(v => !v)}
                    className="text-[10px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                  >
                    {showAllGlobal ? '− less' : `+${data.globalIndices.length - 6} more`}
                  </button>
                )}
              </div>
            </Tile>

            <Sep />

            <Tile tile={TILE_MAP.A4} loading={isLoading}>
              <span>
                <span className="text-emerald-400">{data?.ad?.adv_count ?? '—'}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span className="text-red-400">{data?.ad?.decl_count ?? '—'}</span>
                <span className="ml-1 text-xs text-muted-foreground">({fmtNum(data?.ad?.ad_ratio ?? 0, 2)}×)</span>
              </span>
            </Tile>

            <Tile tile={TILE_MAP.A9} loading={isLoading}>
              {data?.fiiDii ? (() => {
                const { fii_net_value: fii, dii_net_value: dii, date: fiiDate } = data.fiiDii
                const fmtCr = (v: number) => `${fmtNum(Math.abs(v), 0)} Cr`
                return (
                  <button
                    onClick={() => setTarget({ symbol: 'FII_DII', label: 'FII / DII Activity' })}
                    className="text-left hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <div className="flex flex-col gap-0.5 font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground w-6">FII</span>
                        <span className={colorForPct(fii)}><PriceArrow value={fii} /></span>
                        <span className={`ml-0.5 ${colorForPct(fii)}`}>{fmtCr(fii)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground w-6">DII</span>
                        <span className={colorForPct(dii)}><PriceArrow value={dii} /></span>
                        <span className={`ml-0.5 ${colorForPct(dii)}`}>{fmtCr(dii)}</span>
                      </div>
                      <span className="text-muted-foreground/50 text-[10px] font-sans">{fiiDate}</span>
                    </div>
                  </button>
                )
              })() : <span className="text-muted-foreground/50 text-xs">—</span>}
            </Tile>

          </div>
        </div>

        <div className="flex-shrink-0 border-l border-border px-2 py-2 flex flex-col gap-1 w-72">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium text-center">
            Sector Heatmap
          </span>
          <div className="flex-1 grid grid-cols-6 grid-rows-3 gap-0.5">
            {sectors.map((s) => {
              const abbr = SHORT[s.symbol.replace('NIFTY_', '')] ?? s.symbol.replace('NIFTY_', '').slice(0, 4)
              return (
                <button
                  key={s.symbol}
                  title={`${s.name}: ${fmtPct(s.pct)}`}
                  onClick={() => setTarget({ symbol: s.symbol, label: `Nifty ${s.name}` })}
                  className={`flex flex-col items-center justify-center rounded ${bgColorForPct(s.pct)} text-white hover:ring-1 hover:ring-white/30 transition-all`}
                >
                  <span className="text-[7px] font-mono font-semibold leading-none">{abbr}</span>
                  <span className="text-[6px] font-mono opacity-80 mt-px">{fmtPct(s.pct, 1)}</span>
                </button>
              )
            })}
            {!sectors.length && (
              <span className="col-span-6 text-muted-foreground/30 text-[10px] text-center pt-2">Live pending</span>
            )}
          </div>
        </div>

      </div>

      {target && (
        <IndexChartModal
          symbol={target.symbol}
          label={target.label}
          date={date}
          onClose={() => setTarget(null)}
          onSelectSymbol={onSelectSymbol}
        />
      )}
    </>
  )
}
