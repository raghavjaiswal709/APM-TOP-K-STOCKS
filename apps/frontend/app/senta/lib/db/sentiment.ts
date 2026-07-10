import { Pool, types } from 'pg'

types.setTypeParser(1082, (v: string) => v)
types.setTypeParser(1700, (v: string) => parseFloat(v))
types.setTypeParser(20,   (v: string) => parseInt(v, 10))

const pool = new Pool({
  host:     process.env.DB_HOST     ?? '100.93.172.21',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'stock_sentiment_db',
  user:     process.env.DB_USER     ?? '',
  password: process.env.DB_PASSWORD ?? '',
  max: 10,
  idleTimeoutMillis: 30_000,
})

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params)
  return rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}
