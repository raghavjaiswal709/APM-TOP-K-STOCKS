import { NextResponse } from 'next/server'
import {
  getMinuteBars, getLiveMinuteBars, isMarketOpen,
  getStockDayBars, getStockPrevClose,
} from '@/app/senta/lib/db/source'

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'MAX'

const PERIOD_DAYS: Record<Exclude<Period, '1D' | 'MAX'>, number> = {
  '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365,
}

function vwapFromBars(bars: { high: number; low: number; close: number; volume: number }[]) {
  let sumPV = 0, sumV = 0
  for (const b of bars) {
    const tp = (Number(b.high) + Number(b.low) + Number(b.close)) / 3
    const v  = Number(b.volume)
    sumPV += tp * v
    sumV  += v
  }
  return sumV ? sumPV / sumV : null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sp         = new URL(req.url).searchParams
  const period     = (sp.get('period') ?? '1D') as Period
  const date       = sp.get('date')

  if (period === '1D') {
    const bars = (!date && isMarketOpen())
      ? await getLiveMinuteBars(symbol)
      : await getMinuteBars(symbol, date)

    const vwapVal   = vwapFromBars(bars)
    const prevClose = await getStockPrevClose(symbol, date)

    return NextResponse.json({ period, bars, vwap: vwapVal, prevClose: prevClose ?? null })
  }

  const limitDays = period === 'MAX'
    ? undefined
    : PERIOD_DAYS[period as keyof typeof PERIOD_DAYS]

  const bars = await getStockDayBars(symbol, limitDays, date)

  return NextResponse.json({ period, bars, vwap: null, prevClose: null })
}
