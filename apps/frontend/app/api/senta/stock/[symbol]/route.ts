import { NextResponse } from 'next/server'
import { queryOne } from '@/app/senta/lib/db/sentiment'
import { getOrderBook, getCircuitBand } from '@/app/senta/lib/db/live'
import {
  isPreOpen, isMarketOpen,
  getLiveMinuteBars, getMinuteBars,
  setCachedPreOpen, getCachedPreOpen, currentISTDate,
  getStockDayBars, getStock52W, getLastWatchlistOccurrence,
} from '@/app/senta/lib/db/source'
import { isInNifty500, getNifty50Status } from '@/app/senta/lib/data/indices'
import type { LiveQuote } from '@/app/senta/lib/db/live'

// SEBI categorisation: rank 1–100 large, 101–250 mid, rest small
function mcapCategory(rank: number | null | undefined): string | null {
  if (rank == null) return null
  return rank <= 100 ? 'Large Cap' : rank <= 250 ? 'Mid Cap' : 'Small Cap'
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

  // Historical view: only rows that were available for the selected prediction day
  const asOf = dateAnchor ? 'AND pred_date <= $2' : ''
  const args = dateAnchor ? [symbol, dateAnchor] : [symbol]

  const [stubOrderBook, circuitBand, delivery, peMcap, derivatives, company, sectorRow, histDayBars, w52, lastWL] =
    await Promise.all([
      liveOrderBook ? Promise.resolve(null) : getOrderBook(symbol),
      getCircuitBand(symbol),

      queryOne<{ date: string; delivery_pct: number | null }>(
        `SELECT date, delivery_pct FROM delivery
         WHERE company_code = $1 ${asOf}
         ORDER BY date DESC LIMIT 1`,
        args
      ),

      queryOne<{ date: string; pe_ratio: number | null; market_cap: number | null; mcap_rank: number | null }>(
        `SELECT p.date, p.pe_ratio, p.market_cap,
                CASE WHEN p.market_cap IS NULL THEN NULL ELSE
                  (SELECT COUNT(*) + 1 FROM pe_mcap q
                   WHERE q.date = p.date AND q.market_cap > p.market_cap)
                END AS mcap_rank
         FROM pe_mcap p
         WHERE p.company_code = $1 ${asOf}
         ORDER BY p.date DESC LIMIT 1`,
        args
      ),

      queryOne<{ pcr: number | null; max_pain_strike: number | null; is_fno: number | null }>(
        `SELECT pcr, max_pain_strike, is_fno FROM derivatives
         WHERE company_code = $1 ${asOf}
         ORDER BY date DESC LIMIT 1`,
        args
      ),

      queryOne<{ company_name: string }>(
        `SELECT name AS company_name FROM company_list WHERE company_code = $1`,
        [symbol]
      ),

      // Stock and sector % from the same row so "vs Sector" compares the same session.
      // No live sector feed in this schema, so it is skipped during market hours.
      liveSession
        ? Promise.resolve(null)
        : queryOne<{ date: string; t1_pct_chng: number | null; sector_pct_chng: number | null }>(
            `SELECT date, t1_pct_chng, sector_pct_chng FROM stock_price_vol
             WHERE company_code = $1 ${asOf}
             ORDER BY date DESC LIMIT 1`,
            args
          ),

      getStockDayBars(symbol, 30, dateAnchor),
      getStock52W(symbol, dateAnchor),
      getLastWatchlistOccurrence(symbol, dateAnchor),
    ])

  const daily = delivery || peMcap
    ? {
        date:         peMcap?.date ?? delivery?.date ?? null,
        delivery_pct: delivery?.delivery_pct ?? null,
        pe_ratio:     peMcap?.pe_ratio ?? null,
        market_cap:   peMcap?.market_cap ?? null,
      }
    : null

  const universe = {
    company_name:        company?.company_name ?? null,
    market_cap_category: mcapCategory(peMcap?.mcap_rank),
    f_o_eligible:        derivatives?.is_fno != null ? derivatives.is_fno === 1 : null,
  }

  const sectorIndex = sectorRow?.sector_pct_chng != null
    ? { date: sectorRow.date, pctChange: sectorRow.sector_pct_chng, stockPctChange: sectorRow.t1_pct_chng }
    : null

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
