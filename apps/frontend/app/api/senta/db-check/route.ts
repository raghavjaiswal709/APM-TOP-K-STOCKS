import { NextResponse } from 'next/server'
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

// Read-only diagnostics: runs a fixed list of checks against each Senta DB and
// returns the exact error per check, so connection / permission / data problems
// can be reproduced from Postman. No caller-supplied SQL is ever executed.

type Target = {
  host: string
  port: number
  database: string
  user: string
  password: string
}

const TARGETS: Record<string, Target> = {
  upstox: {
    host:     process.env.UPSTOX_DB_HOST     ?? '100.93.172.21',
    port:     Number(process.env.UPSTOX_DB_PORT ?? 5432),
    database: process.env.UPSTOX_DB_NAME     ?? 'upstox_db',
    user:     process.env.UPSTOX_DB_USER     ?? 'senti_readonly_user',
    password: process.env.UPSTOX_DB_PASSWORD ?? '',
  },
  sentiment: {
    host:     process.env.DB_HOST     ?? '100.93.172.21',
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME     ?? 'stock_sentiment_db',
    user:     process.env.DB_USER     ?? '',
    password: process.env.DB_PASSWORD ?? '',
  },
  source: {
    host:     process.env.SOURCE_DB_HOST     ?? '100.93.172.21',
    port:     Number(process.env.SOURCE_DB_PORT ?? 5432),
    database: process.env.SOURCE_DB_NAME     ?? 'nse_hist_db',
    user:     process.env.SOURCE_DB_USER     ?? 'readonly_user',
    password: process.env.SOURCE_DB_PASSWORD ?? '',
  },
  indices: {
    host:     process.env.INDICES_DB_HOST     ?? '100.93.172.21',
    port:     Number(process.env.INDICES_DB_PORT ?? 5432),
    database: process.env.INDICES_DB_NAME     ?? 'indices_hist_db',
    user:     process.env.INDICES_DB_USER     ?? 'readonly_user',
    password: process.env.INDICES_DB_PASSWORD ?? '',
  },
}

const CONNECT = `SELECT current_user, current_database(), inet_server_addr()::text AS server_addr,
                        current_setting('server_version') AS server_version, now()::text AS server_now`

const CHECKS: Record<string, Record<string, string>> = {
  upstox: {
    connect:         CONNECT,
    schemas:         `SELECT nspname AS schema FROM pg_namespace
                      WHERE nspname IN ('ingest','ref','mkt','deriv','inst','fund','events','nlp','compat')
                      ORDER BY 1`,
    compat_views:    `SELECT table_name AS view,
                             has_table_privilege(current_user, 'compat.' || table_name, 'SELECT') AS can_select
                      FROM information_schema.views WHERE table_schema = 'compat' ORDER BY 1`,
    company_map:     `SELECT count(*) AS rows, count(*) FILTER (WHERE valid_to IS NULL) AS current_rows
                      FROM ref.company_map`,
    derivatives:     `SELECT count(*) AS rows, min(date)::text AS first_date, max(date)::text AS last_date
                      FROM compat.derivatives`,
    fii_dii:         `SELECT count(*) AS rows, min(date)::text AS first_date, max(date)::text AS last_date
                      FROM compat.fii_dii`,
    pe_mcap:         `SELECT count(*) AS rows, min(date)::text AS first_date, max(date)::text AS last_date,
                             count(market_cap) AS rows_with_market_cap
                      FROM compat.pe_mcap`,
    news_sentiment:  `SELECT count(*) AS rows, min(published_at)::text AS first_published,
                             max(published_at)::text AS last_published
                      FROM compat.news_sentiment`,
    corporate_actions: `SELECT count(*) AS rows, max(broadcast_date)::text AS last_broadcast
                        FROM compat.corporate_actions`,
    file_log:        `SELECT dataset, status, count(*) AS files, sum(row_count) AS rows,
                             max(loaded_at)::text AS last_load
                      FROM ingest.file_log GROUP BY dataset, status ORDER BY dataset, status`,
    file_log_errors: `SELECT rel_path, dataset, as_of_date::text, status, error, loaded_at::text
                      FROM ingest.file_log WHERE status IN ('failed','partial')
                      ORDER BY loaded_at DESC LIMIT 20`,
    partitions:      `SELECT inhparent::regclass::text AS parent, inhrelid::regclass::text AS partition
                      FROM pg_inherits
                      WHERE inhparent IN ('deriv.option_chain_strike'::regclass, 'deriv.intraday_insight'::regclass)
                      ORDER BY 1, 2`,
    trading_day:     `SELECT trade_date::text, is_trading, session_type, note
                      FROM ref.trading_day WHERE trade_date BETWEEN current_date - 3 AND current_date + 3
                      ORDER BY trade_date`,
  },
  sentiment: {
    connect: CONNECT,
    ...Object.fromEntries(
      ['derivatives', 'fii_dii', 'pe_mcap', 'news_sentiment', 'corporate_actions', 'delivery',
       'stock_price_vol', 'adv_decl', 'gift_nifty', 'global_indices', 'announcements',
       'board_meetings', 'block_bulk_deals'].map(t => [
        t,
        `SELECT count(*) AS rows, max(pred_date)::text AS last_pred_date FROM ${t}`,
      ])
    ),
    company_list: `SELECT count(*) AS rows FROM company_list`,
  },
  source: {
    connect:         CONNECT,
    companies:       `SELECT count(*) AS rows FROM companies`,
    day_data:        `SELECT max(timestamp)::text AS last_bar FROM company_day_data`,
    watchlist_quant: `SELECT max(watchlist_date)::text AS last_watchlist FROM watchlist_quant`,
  },
  indices: {
    connect:  CONNECT,
    indices:  `SELECT count(*) AS rows FROM indices`,
    day_data: `SELECT max(timestamp)::text AS last_bar FROM index_day_data`,
  },
}

type PgError = Error & { code?: string; detail?: string; hint?: string; errno?: number; address?: string; port?: number }

function describeError(e: unknown) {
  const err = e as PgError
  return {
    message: err.message,
    code:    err.code ?? null,
    detail:  err.detail ?? null,
    hint:    err.hint ?? null,
  }
}

async function runTarget(name: string, only: string | null) {
  const t = TARGETS[name]
  const checks = Object.entries(CHECKS[name]).filter(([k]) => !only || k === only || k === 'connect')
  const conn = { host: t.host, port: t.port, database: t.database, user: t.user }
  const client = new Client({ ...t, connectionTimeoutMillis: 8_000, statement_timeout: 15_000 })

  const started = Date.now()
  try {
    await client.connect()
  } catch (e) {
    return {
      target: name, conn, ok: false, ms: Date.now() - started,
      results: [{ check: 'connect', ok: false, ms: Date.now() - started, error: describeError(e) }],
    }
  }

  const results: object[] = []
  try {
    for (const [check, sql] of checks) {
      const t0 = Date.now()
      try {
        const { rows } = await client.query(sql)
        results.push({ check, ok: true, ms: Date.now() - t0, rows })
      } catch (e) {
        results.push({ check, ok: false, ms: Date.now() - t0, error: describeError(e) })
      }
    }
  } finally {
    await client.end().catch(() => {})
  }

  return {
    target: name, conn,
    ok: results.every(r => (r as { ok: boolean }).ok),
    ms: Date.now() - started,
    results,
  }
}

function checkReportsDir() {
  const dir = process.env.EOD_REPORTS_DIR
    ?? path.join(process.cwd(), '..', 'phase2', 'eod_report_gen', 'reports')
  try {
    const folders = fs.readdirSync(dir).filter(f => f.startsWith('watchlist_')).sort()
    return {
      target: 'eod_reports', dir, ok: true,
      folders: folders.length,
      latest: folders.slice(-5),
    }
  } catch (e) {
    return { target: 'eod_reports', dir, ok: false, error: describeError(e) }
  }
}

export async function GET(req: Request) {
  const sp    = new URL(req.url).searchParams
  const db    = sp.get('db') ?? 'all'
  const check = sp.get('check')

  if (db === 'eod_reports') return NextResponse.json(checkReportsDir())

  const names = db === 'all' ? Object.keys(TARGETS) : [db]
  const unknown = names.filter(n => !TARGETS[n])
  if (unknown.length) {
    return NextResponse.json(
      { error: `unknown db '${unknown.join(', ')}'`, dbs: [...Object.keys(TARGETS), 'eod_reports', 'all'] },
      { status: 400 }
    )
  }
  if (check && names.length === 1 && !CHECKS[names[0]][check]) {
    return NextResponse.json(
      { error: `unknown check '${check}' for db '${names[0]}'`, checks: Object.keys(CHECKS[names[0]]) },
      { status: 400 }
    )
  }

  const targets = await Promise.all(names.map(n => runTarget(n, check)))
  const body = db === 'all' ? { targets, eod_reports: checkReportsDir() } : targets[0]
  const allOk = db === 'all'
    ? targets.every(t => t.ok)
    : targets[0].ok
  return NextResponse.json(body, { status: allOk ? 200 : 502 })
}
