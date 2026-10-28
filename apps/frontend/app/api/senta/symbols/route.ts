import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'

export async function GET() {
  const rows = await query<{ symbol: string }>(
    `SELECT company_code AS symbol FROM company_list ORDER BY company_code`
  )
  return NextResponse.json({ symbols: rows.map(r => r.symbol) })
}
