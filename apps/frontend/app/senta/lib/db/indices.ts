import { Pool } from 'pg'

const pool = new Pool({
  host:     process.env.INDICES_DB_HOST     ?? '100.93.172.21',
  port:     Number(process.env.INDICES_DB_PORT ?? 5432),
  database: process.env.INDICES_DB_NAME     ?? 'indices_hist_db',
  user:     process.env.INDICES_DB_USER     ?? 'readonly_user',
  password: process.env.INDICES_DB_PASSWORD ?? 'db_read_5432',
  max: 5,
  idleTimeoutMillis: 30_000,
})

const idCache = new Map<string, number>()
let cacheLoaded = false

async function ensureCache() {
  if (cacheLoaded) return
  const { rows } = await pool.query<{ index_id: number; index_code: string }>(
    'SELECT index_id, index_code FROM indices'
  )
  for (const r of rows) idCache.set(r.index_code, r.index_id)
  cacheLoaded = true
}

async function getId(indexCode: string): Promise<number | null> {
  await ensureCache()
  return idCache.get(indexCode) ?? null
}

function quarterlyPartition(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  return `index_data_${year}_q${Math.ceil(month / 3)}`
}

function currentISTDate(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)
}

export async function getIndexMinuteBars(
  indexCode: string,
  date?: string | null
): Promise<{ timestamp: string; close: number }[]> {
  const id = await getId(indexCode)
  if (id == null) return []

  let targetDate = date ?? null
  let partition: string

  if (targetDate) {
    partition = quarterlyPartition(targetDate)
  } else {
    partition = quarterlyPartition(currentISTDate())
    const res = await pool
      .query<{ latest: string | null }>(
        `SELECT MAX(timestamp::date)::text AS latest FROM ${partition} WHERE index_id = $1`,
        [id]
      )
      .catch(() => ({ rows: [] as { latest: string | null }[] }))
    if (!res.rows[0]?.latest) return []
    targetDate = res.rows[0].latest
  }

  try {
    const { rows } = await pool.query<{ timestamp: string; close: number }>(
      `SELECT
         to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS timestamp,
         close
       FROM ${partition}
       WHERE index_id = $1
         AND timestamp::date = $2::date
         AND timestamp::time BETWEEN '09:15' AND '15:30'
       ORDER BY timestamp`,
      [id, targetDate]
    )
    return rows
  } catch {
    return []
  }
}

export async function getIndexDailyBars(
  indexCode: string,
  date?: string | null,
  periodDays?: number
): Promise<{ date: string; close: number }[]> {
  const id = await getId(indexCode)
  if (id == null) return []

  const anchor = date
    ? `'${date}'::date`
    : `(SELECT MAX(timestamp::date) FROM index_day_data WHERE index_id = $1)`

  const limitClause = periodDays
    ? `AND timestamp::date >= ${anchor} - INTERVAL '${periodDays} days'`
    : ''

  try {
    const { rows } = await pool.query<{ date: string; close: number }>(
      `SELECT timestamp::date::text AS date, close
       FROM index_day_data
       WHERE index_id = $1
         AND timestamp::date <= ${anchor}
         ${limitClause}
       ORDER BY timestamp::date`,
      [id]
    )
    return rows
  } catch {
    return []
  }
}

export async function getIndexCloseOnDate(
  indexCode: string,
  date: string
): Promise<number | null> {
  const id = await getId(indexCode)
  if (id == null) return null
  const partition = quarterlyPartition(date)
  try {
    const { rows } = await pool.query<{ close: number }>(
      `SELECT close FROM ${partition}
       WHERE index_id = $1 AND timestamp::date = $2::date
       ORDER BY timestamp DESC LIMIT 1`,
      [id, date]
    )
    return rows[0]?.close ?? null
  } catch {
    return null
  }
}

export async function getIndexPrevClose(
  indexCode: string,
  date: string
): Promise<number | null> {
  const id = await getId(indexCode)
  if (id == null) return null
  try {
    const { rows } = await pool.query<{ close: number }>(
      `SELECT close FROM index_day_data
       WHERE index_id = $1 AND timestamp::date < $2::date
       ORDER BY timestamp DESC LIMIT 1`,
      [id, date]
    )
    return rows[0]?.close ?? null
  } catch {
    return null
  }
}

export async function getSectorClosesOnDate(
  indexCodes: string[],
  date: string
): Promise<Map<string, { close: number; prevClose: number }>> {
  await ensureCache()

  const idToCode = new Map<number, string>()
  const ids: number[] = []
  for (const code of indexCodes) {
    const id = idCache.get(code)
    if (id != null) { ids.push(id); idToCode.set(id, code) }
  }
  if (!ids.length) return new Map()

  const partition = quarterlyPartition(date)

  try {
    const [todayRes, prevRes] = await Promise.all([
      pool.query<{ index_id: number; close: number }>(
        `SELECT DISTINCT ON (index_id) index_id, close
         FROM ${partition}
         WHERE index_id = ANY($1) AND timestamp::date = $2::date
         ORDER BY index_id, timestamp DESC`,
        [ids, date]
      ),
      pool.query<{ index_id: number; close: number }>(
        `SELECT DISTINCT ON (index_id) index_id, close
         FROM index_day_data
         WHERE index_id = ANY($1) AND timestamp::date < $2::date
         ORDER BY index_id, timestamp DESC`,
        [ids, date]
      ),
    ])

    const prevMap = new Map(prevRes.rows.map(r => [r.index_id, r.close]))
    const result = new Map<string, { close: number; prevClose: number }>()
    for (const r of todayRes.rows) {
      const code = idToCode.get(r.index_id)
      if (code) result.set(code, { close: r.close, prevClose: prevMap.get(r.index_id) ?? r.close })
    }
    return result
  } catch {
    return new Map()
  }
}
