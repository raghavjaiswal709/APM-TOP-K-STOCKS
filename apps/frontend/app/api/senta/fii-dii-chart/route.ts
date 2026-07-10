import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'

const PERIOD_DAYS: Record<string, number | null> = {
  '1M': 30, '3M': 91, '6M': 182, '1Y': 365, 'MAX': null,
}

const COLS = `date::text, fii_net_value, dii_net_value,
              fii_gross_buy, fii_gross_sell, dii_gross_buy, dii_gross_sell`

export async function GET(req: Request) {
  const url    = new URL(req.url)
  const date   = url.searchParams.get('date')
  const period = url.searchParams.get('period') ?? '3M'
  const days   = PERIOD_DAYS[period] ?? 91

  let rows: object[]

  if (days === null) {
    rows = await query(
      date
        ? `SELECT ${COLS} FROM fii_dii_activity WHERE date <= $1 ORDER BY date ASC`
        : `SELECT ${COLS} FROM fii_dii_activity ORDER BY date ASC`,
      date ? [date] : undefined
    )
  } else {
    rows = await query(
      date
        ? `SELECT ${COLS} FROM fii_dii_activity WHERE date <= $1 ORDER BY date DESC LIMIT $2`
        : `SELECT ${COLS} FROM fii_dii_activity ORDER BY date DESC LIMIT $1`,
      date ? [date, days] : [days]
    )
    rows = (rows as object[]).reverse()
  }

  return NextResponse.json({ bars: rows })
}
