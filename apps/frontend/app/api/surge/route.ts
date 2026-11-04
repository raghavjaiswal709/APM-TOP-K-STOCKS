import { NextResponse } from 'next/server'
import { getSurgeSnapshot } from '@/lib/surge/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/surge[?date=YYYY-MM-DD]
 *
 * Today's Surge screen and surge episodes from the Surge SSE server — the
 * same upstream the DAKSphere Trading Dashboard reads. Backs the Surge view
 * of every watchlist (`hooks/useSurge.ts`).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || undefined
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }

  const snapshot = await getSurgeSnapshot(date)
  // Both upstream calls failing is a gateway error; one failing still
  // returns what the other produced, with its error field set.
  const status = snapshot.screenerError && snapshot.surgesError ? 502 : 200
  return NextResponse.json(snapshot, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
