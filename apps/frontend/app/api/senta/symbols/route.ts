import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'

export async function GET() {
  const rows = await query<{ symbol: string }>(
    `SELECT DISTINCT symbol FROM daily_equity_metrics ORDER BY symbol`
  )
  return NextResponse.json({ symbols: rows.map(r => r.symbol) })
}
