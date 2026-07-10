import { NextResponse } from 'next/server'
import { getWatchlist } from '@/app/senta/lib/db/source'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || undefined
  const entries = await getWatchlist(date)
  return NextResponse.json({ entries })
}
