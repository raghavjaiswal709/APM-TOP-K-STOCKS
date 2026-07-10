import { NextResponse } from 'next/server'
import {
  isMarketOpen,
  getLiveIndexBars,
  getIndexMinuteBars,
  getIndexDayBars,
  getIndexPrevClose,
} from '@/app/senta/lib/db/source'

type Period = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'MAX'

const PERIOD_DAYS: Record<Exclude<Period, '1D' | 'MAX'>, number> = {
  '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365,
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const sp     = new URL(req.url).searchParams
  const date   = sp.get('date')
  const period = (sp.get('period') ?? '1D') as Period

  if (period === '1D') {
    let bars: { timestamp: string; close: number }[]

    if (!date && isMarketOpen()) {
      const liveBars = await getLiveIndexBars(symbol)
      bars = liveBars.map(b => ({ timestamp: b.timestamp, close: b.close }))
    } else {
      const minuteBars = await getIndexMinuteBars(symbol, date)
      bars = minuteBars.map(b => ({ timestamp: b.timestamp, close: b.close }))
    }

    const prevClose = await getIndexPrevClose(symbol, date)
    return NextResponse.json({ period, bars, prevClose: prevClose ?? null })
  }

  const limitDays = period === 'MAX'
    ? undefined
    : PERIOD_DAYS[period as keyof typeof PERIOD_DAYS]

  const bars = await getIndexDayBars(symbol, limitDays, date)

  return NextResponse.json({ period, bars, prevClose: null })
}
