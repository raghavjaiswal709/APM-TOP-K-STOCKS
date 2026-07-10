import { Pool, types } from 'pg'

types.setTypeParser(1700, (v: string) => parseFloat(v))
types.setTypeParser(20,   (v: string) => parseInt(v, 10))

const pool = new Pool({
  host:     process.env.SOURCE_DB_HOST     ?? '100.93.172.21',
  port:     Number(process.env.SOURCE_DB_PORT ?? 5432),
  database: process.env.SOURCE_DB_NAME     ?? 'nse_hist_db',
  user:     process.env.SOURCE_DB_USER     ?? 'readonly_user',
  password: process.env.SOURCE_DB_PASSWORD ?? 'db_read_5432',
  max: 5,
  idleTimeoutMillis: 30_000,
})

const indicesPool = new Pool({
  host:     process.env.INDICES_DB_HOST     ?? '100.93.172.21',
  port:     Number(process.env.INDICES_DB_PORT ?? 5432),
  database: process.env.INDICES_DB_NAME     ?? 'indices_hist_db',
  user:     process.env.INDICES_DB_USER     ?? 'readonly_user',
  password: process.env.INDICES_DB_PASSWORD ?? 'db_read_5432',
  max: 5,
  idleTimeoutMillis: 30_000,
})

const idCache = new Map<string, number>()

async function getCompanyId(symbol: string): Promise<number | null> {
  if (idCache.has(symbol)) return idCache.get(symbol)!
  const { rows } = await pool.query(
    'SELECT company_id FROM companies WHERE company_code = $1',
    [symbol]
  )
  if (!rows.length) return null
  const id = rows[0].company_id as number
  idCache.set(symbol, id)
  return id
}

const indexIdCache = new Map<string, number>()

async function getIndexId(indexCode: string): Promise<number | null> {
  if (indexIdCache.has(indexCode)) return indexIdCache.get(indexCode)!
  const { rows } = await indicesPool.query(
    'SELECT index_id FROM indices WHERE index_code = $1',
    [indexCode]
  )
  if (!rows.length) return null
  const id = rows[0].index_id as number
  indexIdCache.set(indexCode, id)
  return id
}

function quarterSuffix(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  return `${year}_q${Math.ceil(month / 3)}`
}

function quarterSuffixRange(fromDate: string, toDate: string): string[] {
  const suffixes: string[] = []
  let [y, m] = fromDate.split('-').map(Number)
  const [ey, em] = toDate.split('-').map(Number)
  let q = Math.ceil(m / 3)
  const eq = Math.ceil(em / 3)
  while (y < ey || (y === ey && q <= eq)) {
    suffixes.push(`${y}_q${q}`)
    q++
    if (q > 4) { q = 1; y++ }
  }
  return suffixes
}

export function currentISTDate(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export type MinuteBar = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  bid_price?: number
  ask_price?: number
  bid_size?: number
  ask_size?: number
}

export type DayBar = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const INDEX_DB_TO_LIVE: Record<string, string> = {
  'NIFTY50':           'IDX_NIFTY50',
  'NIFTY500':          'IDX_NIFTY500',
  'SENSEX':            'IDX_SENSEX',
  'INDIAVIX':          'IDX_INDIAVIX',
  'NIFTY_AUTO':        'IDX_NIFTYAUTO',
  'NIFTY_BANK':        'IDX_NIFTYBANK',
  'NIFTY_COMMODITIES': 'IDX_NIFTYCOMMODITIES',
  'NIFTY_ENERGY':      'IDX_NIFTYENERGY',
  'NIFTY_FIN_SERVICES':'IDX_FINNIFTY',
  'NIFTY_FMCG':        'IDX_NIFTYFMCG',
  'NIFTY_HEALTHCARE':  'IDX_NIFTYHEALTHCARE',
  'NIFTY_INFRA':       'IDX_NIFTYINFRA',
  'NIFTY_IT':          'IDX_NIFTYIT',
  'NIFTY_MEDIA':       'IDX_NIFTYMEDIA',
  'NIFTY_METAL':       'IDX_NIFTYMETAL',
  'NIFTY_PHARMA':      'IDX_NIFTYPHARMA',
  'NIFTY_PRIVATE_BANK':'IDX_NIFTYPVTBANK',
  'NIFTY_PSU_BANK':    'IDX_NIFTYPSUBANK',
  'NIFTY_REALTY':      'IDX_NIFTYREALTY',
}

export const INDEX_DB_TO_HIST_CODE: Record<string, string> = {
  'NIFTY50':                 'NIFTY',
  'INDIAVIX':                'INDIAVIX',
  'NIFTY_AUTO':              'NIFTY AUTO',
  'NIFTY_BANK':              'BANKNIFTY',
  'NIFTY_COMMODITIES':       'NIFTY COMMODITIES',
  'NIFTY_CONSUMER_DURABLES': 'NIFTY CONSR DURBL',
  'NIFTY_ENERGY':            'NIFTY ENERGY',
  'NIFTY_FIN_SERVICES':      'FINNIFTY',
  'NIFTY_FMCG':              'NIFTY FMCG',
  'NIFTY_HEALTHCARE':        'NIFTY HEALTHCARE',
  'NIFTY_INFRA':             'NIFTYINFRA',
  'NIFTY_IT':                'NIFTYIT',
  'NIFTY_MEDIA':             'NIFTY MEDIA',
  'NIFTY_METAL':             'NIFTY METAL',
  'NIFTY_PHARMA':            'NIFTY PHARMA',
  'NIFTY_PRIVATE_BANK':      'NIFTY PVT BANK',
  'NIFTY_PSU_BANK':          'NIFTY PSU BANK',
  'NIFTY_REALTY':            'NIFTY REALTY',
  'NIFTY_OIL_GAS':           'NIFTY OIL AND GAS',
  'NIFTY_FIN_SERVICES_2550': 'NIFTY FINSRV25 50',
  'NIFTY500':                'NIFTY 500',
  'SENSEX':                  'SENSEX',
}

const LIVE_API = (process.env.LIVE_DATA_URL ?? 'http://100.93.172.21:5110').replace(/\/$/, '')

function istNow() {
  const ist  = new Date(Date.now() + 5.5 * 3600 * 1000)
  const date = ist.toISOString().slice(0, 10)
  const hhmm = ist.toISOString().slice(11, 16)
  const day  = ist.getUTCDay()
  return { date, hhmm, day }
}

export function isPreOpen(): boolean {
  const { day, hhmm } = istNow()
  return day >= 1 && day <= 5 && hhmm >= '09:00' && hhmm < '09:15'
}

export function isMarketOpen(): boolean {
  const { day, hhmm } = istNow()
  return day >= 1 && day <= 5 && hhmm >= '09:15' && hhmm <= '15:30'
}

async function fetchLiveBars(apiSymbol: string): Promise<MinuteBar[]> {
  const { date, hhmm } = istNow()
  const cappedTime = hhmm > '15:29' ? '15:29' : hhmm
  const timestamp  = `${date} ${cappedTime}`
  const url = `${LIVE_API}/market_data?symbol=${encodeURIComponent(apiSymbol)}&date=${date}&timestamp=${encodeURIComponent(timestamp)}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json() as Record<string, Record<string, {
      open: number; high: number; low: number; close: number; volume: number
      bid_price?: number; ask_price?: number; bid_size?: number; ask_size?: number
    }>>
    const symbolData = data[apiSymbol]
    if (!symbolData || typeof symbolData !== 'object') return []
    return Object.entries(symbolData)
      .map(([ts, bar]) => ({
        timestamp: `${ts.replace(' ', 'T')}:00+05:30`,
        open: Number(bar.open), high: Number(bar.high),
        low:  Number(bar.low),  close: Number(bar.close), volume: Number(bar.volume),
        ...(bar.bid_price != null && { bid_price: Number(bar.bid_price) }),
        ...(bar.ask_price != null && { ask_price: Number(bar.ask_price) }),
        ...(bar.bid_size  != null && { bid_size:  Number(bar.bid_size)  }),
        ...(bar.ask_size  != null && { ask_size:  Number(bar.ask_size)  }),
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  } catch {
    return []
  }
}

const _preOpenCache = new Map<string, { iep: number; iepQty: number }>()

export function setCachedPreOpen(symbol: string, date: string, iep: number, iepQty: number): void {
  _preOpenCache.set(`${symbol}:${date}`, { iep, iepQty })
}

export function getCachedPreOpen(symbol: string, date: string): { iep: number; iepQty: number } | null {
  return _preOpenCache.get(`${symbol}:${date}`) ?? null
}

export async function getLiveMinuteBars(symbol: string): Promise<MinuteBar[]> {
  return fetchLiveBars(symbol)
}

export async function getLiveIndexBars(dbSymbol: string): Promise<MinuteBar[]> {
  const apiSymbol = INDEX_DB_TO_LIVE[dbSymbol]
  if (!apiSymbol) return []
  return fetchLiveBars(apiSymbol)
}

export async function getLiveIndexClose(dbSymbol: string): Promise<number | null> {
  const bars = await getLiveIndexBars(dbSymbol)
  return bars.length ? bars[bars.length - 1].close : null
}

export async function getMinuteBars(
  symbol: string,
  date?: string | null
): Promise<MinuteBar[]> {
  const companyId = await getCompanyId(symbol)
  if (companyId == null) return []

  let targetDate = date ?? null
  let suffix: string

  if (targetDate) {
    suffix = quarterSuffix(targetDate)
  } else {
    suffix = quarterSuffix(currentISTDate())
    const res = await pool
      .query<{ latest: string | null }>(
        `SELECT MAX(timestamp::date)::text AS latest FROM comp_data_${suffix} WHERE company_id = $1`,
        [companyId]
      )
      .catch(() => ({ rows: [] as { latest: string | null }[] }))
    if (!res.rows[0]?.latest) return []
    targetDate = res.rows[0].latest
  }

  try {
    const { rows } = await pool.query<MinuteBar>(
      `SELECT
         to_char(
           date_trunc('minute', timestamp)
             - (EXTRACT(minute FROM timestamp)::int % 5) * interval '1 minute',
           'YYYY-MM-DD"T"HH24:MI:SS"+05:30"'
         )                                              AS timestamp,
         (array_agg(open  ORDER BY timestamp))[1]      AS open,
         MAX(high)                                      AS high,
         MIN(low)                                       AS low,
         (array_agg(close ORDER BY timestamp DESC))[1]  AS close,
         SUM(volume)                                    AS volume
       FROM comp_data_${suffix}
       WHERE company_id = $1
         AND timestamp::date = $2::date
         AND timestamp::time BETWEEN '09:15' AND '15:30'
       GROUP BY 1
       ORDER BY 1`,
      [companyId, targetDate]
    )
    return rows
  } catch {
    return []
  }
}

export async function getStockDayBars(
  symbol: string,
  limitDays?: number,
  anchorDate?: string | null
): Promise<DayBar[]> {
  const companyId = await getCompanyId(symbol)
  if (companyId == null) return []

  const anchor      = anchorDate ? `'${anchorDate}'::date` : 'CURRENT_DATE'
  const limitClause = limitDays  ? `AND timestamp::date >= ${anchor} - INTERVAL '${limitDays} days'` : ''

  try {
    const { rows } = await pool.query<DayBar>(
      `SELECT
         timestamp::date::text AS date,
         open, high, low, close, volume
       FROM company_day_data
       WHERE company_id = $1
         AND timestamp::date <= ${anchor}
         ${limitClause}
       ORDER BY timestamp`,
      [companyId]
    )
    return rows
  } catch {
    return []
  }
}

export async function getStock52W(
  symbol: string,
  anchorDate?: string | null,
): Promise<{ high_52w: number; low_52w: number; high_52w_date: string; low_52w_date: string } | null> {
  const companyId = await getCompanyId(symbol)
  if (companyId == null) return null
  const anchor = anchorDate ? `'${anchorDate}'::date` : 'CURRENT_DATE'
  try {
    const { rows } = await pool.query<{
      high_52w: number; low_52w: number
      high_52w_date: string; low_52w_date: string
    }>(
      `WITH base AS (
         SELECT timestamp::date::text AS date, high, low
         FROM company_day_data
         WHERE company_id = $1
           AND timestamp::date <= ${anchor}
           AND timestamp::date >= ${anchor} - INTERVAL '365 days'
       )
       SELECT
         MAX(high) AS high_52w, MIN(low) AS low_52w,
         (SELECT date FROM base ORDER BY high DESC, date DESC LIMIT 1) AS high_52w_date,
         (SELECT date FROM base ORDER BY low  ASC,  date DESC LIMIT 1) AS low_52w_date
       FROM base`,
      [companyId]
    )
    return rows[0] ?? null
  } catch {
    return null
  }
}

export async function getStockPrevClose(
  symbol: string,
  beforeDate?: string | null
): Promise<number | null> {
  const companyId = await getCompanyId(symbol)
  if (companyId == null) return null

  const dateFilter = beforeDate
    ? `AND timestamp::date < '${beforeDate}'::date`
    : `AND timestamp::date < CURRENT_DATE`

  try {
    const { rows } = await pool.query<{ close: number }>(
      `SELECT close FROM company_day_data
       WHERE company_id = $1 ${dateFilter}
       ORDER BY timestamp DESC LIMIT 1`,
      [companyId]
    )
    return rows[0]?.close ?? null
  } catch {
    return null
  }
}

export async function getIndexMinuteBars(
  dbSymbol: string,
  date?: string | null
): Promise<MinuteBar[]> {
  const histCode = INDEX_DB_TO_HIST_CODE[dbSymbol]
  if (!histCode) return []
  const indexId = await getIndexId(histCode)
  if (indexId == null) return []

  let targetDate = date ?? null

  if (!targetDate) {
    const suffix = quarterSuffix(currentISTDate())
    const res = await indicesPool
      .query<{ latest: string | null }>(
        `SELECT MAX(timestamp::date)::text AS latest FROM index_data_${suffix} WHERE index_id = $1`,
        [indexId]
      )
      .catch(() => ({ rows: [] as { latest: string | null }[] }))
    if (!res.rows[0]?.latest) return []
    targetDate = res.rows[0].latest
  }

  const suffix = quarterSuffix(targetDate)
  try {
    const { rows } = await indicesPool.query<MinuteBar>(
      `SELECT
         to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS timestamp,
         open, high, low, close, volume
       FROM index_data_${suffix}
       WHERE index_id = $1
         AND timestamp::date = $2::date
         AND timestamp::time BETWEEN '09:15' AND '15:30'
       ORDER BY timestamp`,
      [indexId, targetDate]
    )
    return rows
  } catch {
    return []
  }
}

export async function getIndexDayBars(
  dbSymbol: string,
  limitDays?: number,
  anchorDate?: string | null
): Promise<DayBar[]> {
  const histCode = INDEX_DB_TO_HIST_CODE[dbSymbol]
  if (!histCode) return []
  const indexId = await getIndexId(histCode)
  if (indexId == null) return []

  const anchor      = anchorDate ? `'${anchorDate}'::date` : 'CURRENT_DATE'
  const limitClause = limitDays  ? `AND timestamp::date >= ${anchor} - INTERVAL '${limitDays} days'` : ''

  try {
    const { rows } = await indicesPool.query<DayBar>(
      `SELECT
         timestamp::date::text AS date,
         open, high, low, close, volume
       FROM index_day_data
       WHERE index_id = $1
         AND timestamp::date <= ${anchor}
         ${limitClause}
       ORDER BY timestamp`,
      [indexId]
    )
    if (rows.length > 0) return rows
  } catch { /* fall through */ }

  const anchorStr = anchorDate ?? currentISTDate()
  const fromStr   = limitDays ? subtractDays(anchorStr, limitDays + 5) : '2022-01-01'
  const suffixes  = quarterSuffixRange(fromStr, anchorStr)

  const allBars: DayBar[] = []
  for (const suffix of suffixes) {
    try {
      const { rows } = await indicesPool.query<DayBar>(
        `SELECT
           timestamp::date::text           AS date,
           (array_agg(open  ORDER BY timestamp))[1]      AS open,
           MAX(high)                                      AS high,
           MIN(low)                                       AS low,
           (array_agg(close ORDER BY timestamp DESC))[1]  AS close,
           SUM(volume)                                    AS volume
         FROM index_data_${suffix}
         WHERE index_id = $1
           AND timestamp::date <= ${anchor}
           ${limitClause}
           AND timestamp::time BETWEEN '09:15' AND '15:30'
         GROUP BY timestamp::date
         ORDER BY timestamp::date`,
        [indexId]
      )
      allBars.push(...rows)
    } catch { /* skip */ }
  }
  return allBars.sort((a, b) => a.date.localeCompare(b.date))
}

export interface WatchlistEntry {
  rank: number
  symbol: string
  name: string
}

export async function getWatchlist(date?: string | null): Promise<WatchlistEntry[]> {
  try {
    let targetDate: string
    if (date) {
      targetDate = date
    } else {
      const { rows } = await pool.query<{ latest: string }>(
        'SELECT MAX(watchlist_date)::text AS latest FROM watchlist_quant'
      )
      if (!rows[0]?.latest) return []
      targetDate = rows[0].latest
    }
    const { rows } = await pool.query<WatchlistEntry>(
      `SELECT rank, company_code AS symbol, name
       FROM watchlist_quant
       WHERE watchlist_date::date = $1::date
       ORDER BY rank`,
      [targetDate]
    )
    return rows
  } catch {
    return []
  }
}

export interface LastWatchlistOccurrence {
  date: string
  rank: number
}

export async function getLastWatchlistOccurrence(
  symbol: string,
  beforeDate?: string | null
): Promise<LastWatchlistOccurrence | null> {
  try {
    const { rows } = await pool.query<{ date: string; rank: number }>(
      beforeDate
        ? `SELECT watchlist_date::text AS date, rank
           FROM watchlist_quant
           WHERE company_code = $1 AND watchlist_date <= $2::date
           ORDER BY watchlist_date DESC LIMIT 1`
        : `SELECT watchlist_date::text AS date, rank
           FROM watchlist_quant
           WHERE company_code = $1
           ORDER BY watchlist_date DESC LIMIT 1`,
      beforeDate ? [symbol, beforeDate] : [symbol]
    )
    return rows[0] ?? null
  } catch {
    return null
  }
}

export async function getIndexPrevClose(
  dbSymbol: string,
  beforeDate?: string | null
): Promise<number | null> {
  const histCode = INDEX_DB_TO_HIST_CODE[dbSymbol]
  if (!histCode) return null
  const indexId = await getIndexId(histCode)
  if (indexId == null) return null

  const dateFilter = beforeDate
    ? `AND timestamp::date < '${beforeDate}'::date`
    : `AND timestamp::date < CURRENT_DATE`

  try {
    const { rows } = await indicesPool.query<{ close: number }>(
      `SELECT close FROM index_day_data
       WHERE index_id = $1 ${dateFilter}
       ORDER BY timestamp DESC LIMIT 1`,
      [indexId]
    )
    if (rows[0]?.close != null) return Number(rows[0].close)
  } catch { /* fall through */ }

  const anchorStr = beforeDate ?? currentISTDate()
  const suffixes = [
    quarterSuffix(anchorStr),
    quarterSuffix(subtractDays(anchorStr, 95)),
  ]
  for (const suffix of suffixes) {
    try {
      const { rows } = await indicesPool.query<{ close: number }>(
        `SELECT close FROM index_data_${suffix}
         WHERE index_id = $1 ${dateFilter}
         ORDER BY timestamp DESC LIMIT 1`,
        [indexId]
      )
      if (rows[0]?.close != null) return Number(rows[0].close)
    } catch { /* skip */ }
  }
  return null
}
