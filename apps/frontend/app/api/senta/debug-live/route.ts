import { NextResponse } from 'next/server'

const LIVE_API = (process.env.LIVE_DATA_URL ?? 'http://100.93.172.21:5110').replace(/\/$/, '')

function istNow() {
  const ist  = new Date(Date.now() + 5.5 * 3600 * 1000)
  const date = ist.toISOString().slice(0, 10)
  const hhmm = ist.toISOString().slice(11, 16)
  return { date, hhmm }
}

export async function GET(req: Request) {
  const sp     = new URL(req.url).searchParams
  const symbol = sp.get('symbol') ?? 'INDIAVIX'

  const { date, hhmm } = istNow()
  const cappedTime = hhmm > '15:29' ? '15:29' : hhmm
  const timestamp  = `${date} ${cappedTime}`
  const url = `${LIVE_API}/market_data?symbol=${encodeURIComponent(symbol)}&date=${date}&timestamp=${encodeURIComponent(timestamp)}`

  let raw: unknown = null
  let status: number | null = null
  let error: string | null = null

  try {
    const res = await fetch(url, { cache: 'no-store' })
    status = res.status
    if (res.ok) {
      raw = await res.json()
    } else {
      error = await res.text()
    }
  } catch (e) {
    error = String(e)
  }

  const topKeys = raw && typeof raw === 'object' ? Object.keys(raw as object) : []
  const firstKeyData = topKeys[0] ? (raw as Record<string, unknown>)[topKeys[0]] : null
  const sampleTs = firstKeyData && typeof firstKeyData === 'object'
    ? Object.keys(firstKeyData as object).slice(0, 3)
    : []

  return NextResponse.json({
    url,
    status,
    error,
    topKeys,
    sampleTimestamps: sampleTs,
    barCount: firstKeyData && typeof firstKeyData === 'object' ? Object.keys(firstKeyData as object).length : 0,
    sampleBar: sampleTs[0] ? (firstKeyData as Record<string, unknown>)[sampleTs[0]] : null,
  })
}
