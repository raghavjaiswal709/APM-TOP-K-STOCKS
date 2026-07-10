import { NextResponse } from 'next/server'
import { query, queryOne } from '@/app/senta/lib/db/sentiment'
import {
  isMarketOpen,
  getLiveIndexClose,
  getIndexDayBars,
  getIndexPrevClose,
} from '@/app/senta/lib/db/source'

const SECTOR_SYMBOLS_DB = [
  'NIFTY_AUTO', 'NIFTY_BANK', 'NIFTY_COMMODITIES',
  'NIFTY_CONSUMER_DURABLES', 'NIFTY_ENERGY',
  'NIFTY_FIN_SERVICES', 'NIFTY_FIN_SERVICES_2550',
  'NIFTY_FMCG', 'NIFTY_HEALTHCARE', 'NIFTY_INFRA', 'NIFTY_IT',
  'NIFTY_MEDIA', 'NIFTY_METAL', 'NIFTY_OIL_GAS', 'NIFTY_PHARMA',
  'NIFTY_PRIVATE_BANK', 'NIFTY_PSU_BANK', 'NIFTY_REALTY',
]

async function getIndexDataFromDB(date: string | null, dbSymbol: string) {
  const bars = await getIndexDayBars(dbSymbol, 10, date)
  if (!bars.length) return null
  const last  = bars[bars.length - 1]
  const prev  = bars.length > 1
    ? bars[bars.length - 2].close
    : await getIndexPrevClose(dbSymbol, last.date)
  const pctChange = prev ? ((last.close - prev) / prev) * 100 : 0
  return { level: last.close, pctChange }
}

async function getSectorDataFromDB(date: string | null) {
  const results = await Promise.all(
    SECTOR_SYMBOLS_DB.map(async dbSym => {
      const bars = await getIndexDayBars(dbSym, 10, date)
      if (!bars.length) return null
      const last = bars[bars.length - 1]
      const prev = bars.length > 1
        ? bars[bars.length - 2].close
        : await getIndexPrevClose(dbSym, last.date)
      const pct = prev ? ((last.close - prev) / prev) * 100 : 0
      return { symbol: dbSym, name: dbSym.replace(/^NIFTY_/, ''), pct }
    })
  )
  return results.filter((r): r is NonNullable<typeof r> => r != null)
}

async function getLiveIndexData(dbSymbol: string) {
  const [liveClose, prevClose] = await Promise.all([
    getLiveIndexClose(dbSymbol),
    getIndexPrevClose(dbSymbol),
  ])
  if (liveClose == null) return null
  const pctChange = prevClose ? ((liveClose - prevClose) / prevClose) * 100 : 0
  return { level: liveClose, pctChange }
}

async function getLiveSectors() {
  const results = await Promise.all(
    SECTOR_SYMBOLS_DB.map(async dbSym => {
      const [liveClose, prevClose] = await Promise.all([
        getLiveIndexClose(dbSym),
        getIndexPrevClose(dbSym),
      ])
      if (liveClose == null) return null
      const pct = prevClose ? ((liveClose - prevClose) / prevClose) * 100 : 0
      return { symbol: dbSym, name: dbSym.replace(/^NIFTY_/, ''), pct }
    })
  )
  return results.filter((r): r is NonNullable<typeof r> => r != null)
}

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get('date')
  const live = !date && isMarketOpen()

  const [vix, nifty, sensex, nifty500, sectors, ad, giftNifty, globalIndices, fiiDii] = await Promise.all([
    live ? getLiveIndexData('INDIAVIX') : getIndexDataFromDB(date, 'INDIAVIX'),
    live ? getLiveIndexData('NIFTY50')  : getIndexDataFromDB(date, 'NIFTY50'),
    live ? getLiveIndexData('SENSEX')   : getIndexDataFromDB(date, 'SENSEX'),
    live ? getLiveIndexData('NIFTY500') : getIndexDataFromDB(date, 'NIFTY500'),
    live ? getLiveSectors()             : getSectorDataFromDB(date),

    queryOne<{ adv_count: number; decl_count: number; ad_ratio: number }>(
      date
        ? `SELECT adv_count, decl_count, ad_ratio FROM advance_decline WHERE date <= $1 ORDER BY date DESC LIMIT 1`
        : `SELECT adv_count, decl_count, ad_ratio FROM advance_decline ORDER BY date DESC LIMIT 1`,
      date ? [date] : undefined
    ),

    queryOne<{ gift_nifty_points: number; gift_nifty_premium_pct: number }>(
      date
        ? `SELECT price AS gift_nifty_points, change_pct AS gift_nifty_premium_pct
           FROM gift_nifty WHERE date <= $1 ORDER BY date DESC LIMIT 1`
        : `SELECT price AS gift_nifty_points, change_pct AS gift_nifty_premium_pct
           FROM gift_nifty ORDER BY date DESC LIMIT 1`,
      date ? [date] : undefined
    ),

    query<{ index_name: string; region: string; close_price: number; pct_change: number }>(
      date
        ? `SELECT index_name, region, close_price, pct_change FROM global_indices WHERE date = (SELECT MAX(date) FROM global_indices WHERE date <= $1) ORDER BY region, index_name`
        : `SELECT index_name, region, close_price, pct_change FROM global_indices WHERE date = (SELECT MAX(date) FROM global_indices) ORDER BY region, index_name`,
      date ? [date] : undefined
    ),

    queryOne<{ date: string; fii_net_value: number; dii_net_value: number; fii_gross_buy: number; fii_gross_sell: number; dii_gross_buy: number; dii_gross_sell: number }>(
      date
        ? `SELECT date::text, fii_net_value, dii_net_value, fii_gross_buy, fii_gross_sell, dii_gross_buy, dii_gross_sell
           FROM fii_dii_activity WHERE date <= $1 ORDER BY date DESC LIMIT 1`
        : `SELECT date::text, fii_net_value, dii_net_value, fii_gross_buy, fii_gross_sell, dii_gross_buy, dii_gross_sell
           FROM fii_dii_activity ORDER BY date DESC LIMIT 1`,
      date ? [date] : undefined
    ),
  ])

  return NextResponse.json({ vix, nifty, sensex, nifty500, sectors, ad, giftNifty, globalIndices, fiiDii })
}
