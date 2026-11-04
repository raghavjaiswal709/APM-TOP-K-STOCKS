import { Pool, types } from 'pg'

// upstox_db replaces stock_senti_data. Read only through the compat views (same
// column names as the old tables) plus ref / events for what the views leave out.
// Historical view: compat rows have no pred_date, so "available for prediction
// day D" is expressed as date < D.

types.setTypeParser(1082, (v: string) => v)
types.setTypeParser(1700, (v: string) => parseFloat(v))
types.setTypeParser(20,   (v: string) => parseInt(v, 10))

const pool = new Pool({
  host:     process.env.UPSTOX_DB_HOST     ?? '100.93.172.21',
  port:     Number(process.env.UPSTOX_DB_PORT ?? 5432),
  database: process.env.UPSTOX_DB_NAME     ?? 'upstox_db',
  user:     process.env.UPSTOX_DB_USER     ?? 'senti_readonly_user',
  password: process.env.UPSTOX_DB_PASSWORD ?? '',
  max: 10,
  idleTimeoutMillis: 30_000,
})

export async function upstoxQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

export async function upstoxQueryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await upstoxQuery<T>(sql, params)
  return rows[0] ?? null
}
