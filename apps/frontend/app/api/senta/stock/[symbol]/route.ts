import { NextResponse } from 'next/server'
import { query, queryOne } from '@/app/senta/lib/db/sentiment'
import { getOrderBook, getCircuitBand } from '@/app/senta/lib/db/live'
import {
  isPreOpen, isMarketOpen,
  getLiveMinuteBars, getMinuteBars,
  setCachedPreOpen, getCachedPreOpen, currentISTDate,
  getLiveIndexClose, getIndexPrevClose, getIndexDayBars,
  getStockDayBars, getStock52W, getLastWatchlistOccurrence,
} from '@/app/senta/lib/db/source'
import { isInNifty500, getNifty50Status } from '@/app/senta/lib/data/indices'
import type { LiveQuote } from '@/app/senta/lib/db/live'

const NSE_SECTOR_TO_DB: Record<string, string> = {
  'Nifty Auto':               'NIFTY_AUTO',
  'Nifty Bank':               'NIFTY_BANK',
  'Nifty Consumer Durables':  'NIFTY_CONSUMER_DURABLES',
  'Nifty Energy':             'NIFTY_ENERGY',
  'Nifty Financial Services': 'NIFTY_FIN_SERVICES',
  'Nifty FMCG':               'NIFTY_FMCG',
  'Nifty Healthcare Index':   'NIFTY_HEALTHCARE',
  'Nifty Infrastructure':     'NIFTY_INFRA',
  'Nifty IT':                 'NIFTY_IT',
  'Nifty Media':              'NIFTY_MEDIA',
  'Nifty Metal':              'NIFTY_METAL',
  'Nifty Oil & Gas':              'NIFTY_OIL_GAS',
  'Nifty Pharma':                 'NIFTY_PHARMA',
  'Nifty Realty':                 'NIFTY_REALTY',
  'Nifty Financial Services 25/50': 'NIFTY_FIN_SERVICES_2550',
}

async function getSectorData(
  dbSym: string,
  live: boolean,
  dateAnchor: string | null,
): Promise<{ level: number; pctChange: number } | null> {
  try {
    if (live) {
      const [level, prev] = await Promise.all([
        getLiveIndexClose(dbSym),
        getIndexPrevClose(dbSym),
      ])
      if (level != null && prev != null && prev !== 0) {
        return { level, pctChange: ((level - prev) / prev) * 100 }
      }
    } else {
      const bars = await getIndexDayBars(dbSym, 10, dateAnchor)
      if (bars.length >= 1) {
        const last = bars[bars.length - 1]
        const prevClose = bars.length >= 2
          ? bars[bars.length - 2].close
          : await getIndexPrevClose(dbSym, last.date)
        if (prevClose) {
          return { level: last.close, pctChange: ((last.close - prevClose) / prevClose) * 100 }
        }
      }
    }
  } catch { /* non-critical */ }
  return null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const date = new URL(req.url).searchParams.get('date')
  const dateAnchor = date ?? null
  const preOpenSession = !date && isPreOpen()
  const liveSession    = !date && isMarketOpen()
  const sessionState   = preOpenSession ? 'pre-open' : liveSession ? 'live' : 'closed'

  const minuteBarsRaw = await (
    preOpenSession || liveSession
      ? getLiveMinuteBars(symbol)
      : getMinuteBars(symbol, dateAnchor)
  )

  const todayDate = currentISTDate()
  const preOpen = (() => {
    if (date) return null
    if (preOpenSession && minuteBarsRaw.length > 0) {
      const last = minuteBarsRaw[minuteBarsRaw.length - 1]
      setCachedPreOpen(symbol, todayDate, last.close, last.volume)
      return { iep: last.close, iepQty: last.volume }
    }
    return getCachedPreOpen(symbol, todayDate)
  })()

  const liveOrderBook = (() => {
    if ((preOpenSession || liveSession) && minuteBarsRaw.length > 0) {
      for (let i = minuteBarsRaw.length - 1; i >= 0; i--) {
        const bar = minuteBarsRaw[i]
        if (bar.bid_price != null && bar.ask_price != null) {
          return { bestBid: bar.bid_price, bestAsk: bar.ask_price }
        }
      }
    }
    return null
  })()

  const [stubOrderBook, circuitBand, daily, derivatives, universe, histDayBars] =
    await Promise.all([
      liveOrderBook ? Promise.resolve(null) : getOrderBook(symbol),
      getCircuitBand(symbol),

      queryOne<{ date: string; delivery_pct: number; pe_ratio: number; market_cap: number }>(
        dateAnchor
          ? `SELECT date, delivery_pct, pe_ratio, market_cap
             FROM daily_equity_metrics
             WHERE symbol = $1 AND date <= $2
             ORDER BY date DESC LIMIT 1`
          : `SELECT date, delivery_pct, pe_ratio, market_cap
             FROM daily_equity_metrics
             WHERE symbol = $1
             ORDER BY date DESC LIMIT 1`,
        dateAnchor ? [symbol, dateAnchor] : [symbol]
      ),

      queryOne<{ pcr: number; max_pain_strike: number }>(
        dateAnchor
          ? `SELECT pcr, max_pain_strike FROM derivatives_daily
             WHERE symbol = $1 AND date <= $2 ORDER BY date DESC LIMIT 1`
          : `SELECT pcr, max_pain_strike FROM derivatives_daily
             WHERE symbol = $1 ORDER BY date DESC LIMIT 1`,
        dateAnchor ? [symbol, dateAnchor] : [symbol]
      ),

      queryOne<{
        company_name: string; industry: string; market_cap_category: string
        f_o_eligible: boolean; nse_sectoral_index: string
      }>(
        `SELECT company_name, industry, market_cap_category, f_o_eligible,
                nse_sectoral_index
         FROM universe_definition WHERE symbol = $1`,
        [symbol]
      ),

      getStockDayBars(symbol, 30, dateAnchor),
    ])

  const atrBars = histDayBars.slice(-15)
  const advVal  = histDayBars.length
    ? histDayBars.reduce((s, r) => s + (r.volume ?? 0), 0) / Math.min(histDayBars.length, 20)
    : 0

  const histLast  = histDayBars.length > 0 ? histDayBars[histDayBars.length - 1] : null
  const prevClose = histLast ? Number(histLast.close) : 0
  let liveQuote: LiveQuote | null = null
  if (liveSession && minuteBarsRaw.length > 0) {
    const lastBar  = minuteBarsRaw[minuteBarsRaw.length - 1]
    const firstBar = minuteBarsRaw[0]
    const totalVol = minuteBarsRaw.reduce((s, b) => s + b.volume, 0)
    liveQuote = {
      symbol,
      ltp:       lastBar.close,
      pctChange: prevClose ? ((lastBar.close - prevClose) / prevClose) * 100 : 0,
      todayOpen: firstBar.open,
      volume:    totalVol,
    }
  }

  const sectorDbSym = universe?.nse_sectoral_index
    ? (NSE_SECTOR_TO_DB[universe.nse_sectoral_index.trim()] ?? null)
    : null

  const [w52, sectorIndex, lastWL] = await Promise.all([
    getStock52W(symbol, dateAnchor),
    sectorDbSym
      ? getSectorData(sectorDbSym, liveSession, dateAnchor)
      : Promise.resolve(null),
    getLastWatchlistOccurrence(symbol, dateAnchor),
  ])

  const orderBook = liveOrderBook ?? stubOrderBook

  return NextResponse.json({
    symbol,
    date: dateAnchor ?? histLast?.date ?? daily?.date ?? null,
    sessionState,
    liveQuote,
    preOpen,
    orderBook,
    circuitBand,
    daily,
    atrBars,
    derivatives,
    minuteBars: minuteBarsRaw,
    w52: w52 ?? { high_52w: null, low_52w: null },
    adv: { adv: advVal },
    universe,
    sectorIndex,
    histBars: histDayBars,
    nifty500: isInNifty500(symbol),
    nifty50:  getNifty50Status(symbol, dateAnchor),
    lastWL,
  })
}
