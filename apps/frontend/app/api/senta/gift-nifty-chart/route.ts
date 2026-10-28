import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date')
  const rows = await query<{ date: string; close: number }>(
    date
      ? `SELECT date::text, spot_price AS close FROM gift_nifty WHERE pred_date <= $1 ORDER BY date ASC`
      : `SELECT date::text, spot_price AS close FROM gift_nifty ORDER BY date ASC`,
    date ? [date] : undefined
  )
  return NextResponse.json({ bars: rows })
}
