import { NextResponse } from 'next/server'
// OLD: entries came from the watchlist_quant table.
// import { getWatchlist } from '@/app/senta/lib/db/source'
import type { WatchlistEntry } from '@/app/senta/lib/db/source'
import { getSurgeSnapshot } from '@/lib/surge/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/senta/watchlist[?date=YYYY-MM-DD]
 *
 * NEW: the Surge screener's ranked companies for the date — the same
 * watchlist every page in the app now shows (see hooks/useWatchlist.ts).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || undefined
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const snapshot = await getSurgeSnapshot(date)
  const entries: WatchlistEntry[] = snapshot.screened.map((row) => ({
    rank: row.watchlistRank,
    symbol: row.companyCode,
    name: row.name ?? row.companyCode,
  }))
  return NextResponse.json({
    entries,
    date: snapshot.screener?.date ?? snapshot.date,
    ...(snapshot.screenerError ? { error: snapshot.screenerError } : {}),
  })

  // OLD:
  // const entries = await getWatchlist(date)
  // return NextResponse.json({ entries })
}
