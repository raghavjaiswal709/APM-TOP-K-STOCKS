import { NextResponse } from 'next/server'
import { upstoxQuery } from '@/app/senta/lib/db/upstox'

export async function GET() {
  const rows = await upstoxQuery<{ symbol: string }>(
    `SELECT DISTINCT company_code AS symbol FROM ref.company_map
     WHERE valid_to IS NULL ORDER BY company_code`
  )
  return NextResponse.json({ symbols: rows.map(r => r.symbol) })
}
