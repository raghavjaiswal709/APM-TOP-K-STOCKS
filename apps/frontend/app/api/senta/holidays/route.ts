import { NextResponse } from 'next/server'

export const revalidate = 43200

const MONTH: Record<string, string> = {
  Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06',
  Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12',
}

function parseNSEDate(d: string): string {
  const [day, mon, year] = d.split('-')
  const mm = MONTH[mon]
  return mm ? `${year}-${mm}-${day.padStart(2, '0')}` : ''
}

export async function GET() {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

  try {
    const homeRes = await fetch('https://www.nseindia.com', {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    })

    const setCookieFn = (homeRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie
    const cookies = setCookieFn
      ? setCookieFn.call(homeRes.headers).map(c => c.split(';')[0]).join('; ')
      : (homeRes.headers.get('set-cookie') ?? '').split(';')[0]

    const apiRes = await fetch(
      'https://www.nseindia.com/api/holiday-master?type=trading',
      {
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json, */*',
          'Referer': 'https://www.nseindia.com/',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookies,
        },
      }
    )

    const data = await apiRes.json()
    const cm: { tradingDate: string; description: string }[] = data?.CM ?? []

    const holidays = cm
      .map(h => ({ date: parseNSEDate(h.tradingDate), name: h.description }))
      .filter(h => h.date)

    return NextResponse.json({ holidays })
  } catch {
    return NextResponse.json({ holidays: [] })
  }
}
