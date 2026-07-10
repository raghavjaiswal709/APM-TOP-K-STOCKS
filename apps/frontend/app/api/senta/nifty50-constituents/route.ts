import { NextResponse } from 'next/server'
import { getNifty50ConstituentsAtDate } from '@/app/senta/lib/data/indices'

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date')
  const symbols = getNifty50ConstituentsAtDate(date)
  return NextResponse.json({ symbols })
}
