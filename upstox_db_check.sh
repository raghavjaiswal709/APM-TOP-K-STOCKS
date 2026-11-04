#!/usr/bin/env bash
# upstox_db health check — run ON dakslabsserver01 (upstox_db only accepts local logins).
#
# Covers everything in "upstox_db — Schema and Usage Guide" and the UpstoxDbPipeline sheet:
# pipeline status/verify, logs, flags, archive, EOD reports, DB logins, schemas, tables,
# freshness per table, ingest.file_log failures, partitions, compat views, known issues.
#
# Read-only: every query runs as senti_readonly_user; nothing is written anywhere.
#
# Usage:
#   ./upstox_db_check.sh              # all sections
#   ./upstox_db_check.sh db           # only the database sections
#   ./upstox_db_check.sh pipeline     # only pipeline / files / cron sections
#
# Password: put it in ~/.pgpass (chmod 600), one line:
#   localhost:5432:upstox_db:senti_readonly_user:<password>
# or run with:  PGPASSWORD='<password>' ./upstox_db_check.sh

set -u

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-upstox_db}"
PGUSER="${PGUSER:-senti_readonly_user}"
export PGHOST PGPORT PGDATABASE PGUSER

PIPELINE_DIR="${PIPELINE_DIR:-}"
ARCHIVE_DIR="${ARCHIVE_DIR:-/nas1/upStox_exp/data}"
REPORTS_DIR="${REPORTS_DIR:-/nas1/upStox_exp/prod_p2/reports}"
PIPELINE_LOG="${PIPELINE_LOG:-/nvme1/production/Data/Logs/upstox_db_pipeline.log}"
PARTITION_LOG="${PARTITION_LOG:-/nvme1/production/Data/Logs/upstox_partitions.log}"
TODAY="$(date +%F)"

SECTION="${1:-all}"
FAILS=0

hr()   { printf '\n\033[1;36m==== %s ====\033[0m\n' "$*"; }
ok()   { printf '\033[32m  OK\033[0m   %s\n' "$*"; }
bad()  { printf '\033[31m  FAIL\033[0m %s\n' "$*"; FAILS=$((FAILS + 1)); }
warn() { printf '\033[33m  WARN\033[0m %s\n' "$*"; }

# q "title" "sql"  — prints a table; counts a FAIL if psql errors
q() {
  printf '\n\033[1m-- %s\033[0m\n' "$1"
  if ! psql -X -q -P pager=off -v ON_ERROR_STOP=1 -c "$2" 2>&1; then
    bad "$1"
  fi
}

# v "sql" — single value, empty on error
v() { psql -X -q -At -v ON_ERROR_STOP=1 -c "$1" 2>/dev/null; }

find_pipeline_dir() {
  [ -n "$PIPELINE_DIR" ] && return
  for d in /nvme1/production/Data/Scripts/UpstoxDbPipeline \
           /nvme1/production/Data/Scripts/upstoxDbPipeline \
           /nvme1/production/Data/Scripts/upstox_db_pipeline; do
    [ -d "$d" ] && PIPELINE_DIR="$d" && return
  done
  PIPELINE_DIR="$(find /nvme1/production/Data/Scripts -maxdepth 1 -iname '*upstox*pipeline*' -type d 2>/dev/null | head -1)"
}

# ---------------------------------------------------------------------------
pipeline_sections() {
  find_pipeline_dir

  hr "1. Pipeline (bin/upstox_pipeline.sh)"
  if [ -z "$PIPELINE_DIR" ] || [ ! -x "$PIPELINE_DIR/bin/upstox_pipeline.sh" ]; then
    bad "pipeline not found — set PIPELINE_DIR=/path/to/UpstoxDbPipeline"
  else
    ok "pipeline dir: $PIPELINE_DIR"
    printf '\n\033[1m-- status (last run, flag, file counts, latest date per table)\033[0m\n'
    (cd "$PIPELINE_DIR" && bin/upstox_pipeline.sh status) || bad "upstox_pipeline.sh status"
    printf '\n\033[1m-- verify (logins, tables, partitions, archive access)\033[0m\n'
    (cd "$PIPELINE_DIR" && bin/upstox_pipeline.sh verify) || bad "upstox_pipeline.sh verify"
  fi

  hr "2. Pipeline log: $PIPELINE_LOG"
  if [ -r "$PIPELINE_LOG" ]; then
    ok "last write: $(stat -c '%y' "$PIPELINE_LOG" 2>/dev/null)"
    printf '\n\033[1m-- ERROR / LATE / WARN lines (last 40)\033[0m\n'
    grep -E 'ERROR|LATE|WARN|Traceback|failed' "$PIPELINE_LOG" | tail -40 || true
    printf '\n\033[1m-- last 20 lines\033[0m\n'
    tail -20 "$PIPELINE_LOG"
  else
    bad "cannot read $PIPELINE_LOG"
  fi

  hr "3. Flags (state/flags/$TODAY) — .collected → .loaded, .failed = problem"
  FLAGS="$PIPELINE_DIR/state/flags/$TODAY"
  if [ -z "$PIPELINE_DIR" ]; then
    warn "skipped — pipeline dir unknown (see section 1)"
  elif [ -d "$FLAGS" ]; then
    ls -la "$FLAGS"
    n_failed=$(find "$PIPELINE_DIR/state/flags" -name '*.failed' -mtime -3 2>/dev/null | wc -l)
    [ "$n_failed" -eq 0 ] && ok "no .failed flags in last 3 days" || {
      bad "$n_failed .failed flags in last 3 days:"; find "$PIPELINE_DIR/state/flags" -name '*.failed' -mtime -3; }
  else
    warn "no flags dir for today ($FLAGS) — normal before 07:01 or on a holiday"
  fi

  hr "4. Archive (read-only): $ARCHIVE_DIR"
  if [ -r "$ARCHIVE_DIR" ]; then
    ok "archive readable"
    printf '\n\033[1m-- newest 15 files\033[0m\n'
    find "$ARCHIVE_DIR" -type f -name '*.gz' -mtime -1 -printf '%TY-%Tm-%Td %TH:%TM  %p\n' 2>/dev/null | sort | tail -15
    printf '\n\033[1m-- collector finish records (/nas1/upStox_exp/state/scheduler/*.json)\033[0m\n'
    for f in /nas1/upStox_exp/state/scheduler/*.json; do
      [ -r "$f" ] && printf '%s: %s\n' "$(basename "$f")" "$(tr -d '\n' < "$f" | cut -c1-200)"
    done
  else
    bad "cannot read $ARCHIVE_DIR (needs group storageaccess)"
  fi

  hr "5. EOD reports: $REPORTS_DIR"
  if [ -d "$REPORTS_DIR" ]; then
    ok "reports dir exists"
    ls -1t "$REPORTS_DIR" | head -10
    latest="$(ls -1t "$REPORTS_DIR" | head -1)"
    [ -n "$latest" ] && [ -d "$REPORTS_DIR/$latest" ] && { echo "  files in $latest:"; ls -1 "$REPORTS_DIR/$latest" | head -10; }
  else
    bad "no reports dir $REPORTS_DIR"
  fi

  hr "6. Cron (user daks_labs: watch */2, sweep 23:50; daks_admin: partitions on the 25th)"
  crontab -l 2>/dev/null | grep -Ei 'upstox|partition' || warn "no upstox cron for $(whoami) — run as daks_labs: sudo -u daks_labs crontab -l"
  [ -r "$PARTITION_LOG" ] && { echo "  partition log tail:"; tail -5 "$PARTITION_LOG"; }
}

# ---------------------------------------------------------------------------
db_sections() {
  hr "7. Login as $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
  if who="$(v "SELECT current_user || ' on ' || current_database() || ' (PG ' || current_setting('server_version') || ', tz ' || current_setting('TimeZone') || ')'")" && [ -n "$who" ]; then
    ok "$who"
  else
    bad "cannot log in — check ~/.pgpass / PGPASSWORD; full error:"
    psql -X -c 'SELECT 1' 2>&1 | sed 's/^/       /'
    return
  fi

  q "Is the reader really read-only? (all should be f)" "
    SELECT has_table_privilege('ref.trading_day','INSERT')  AS can_insert,
           has_table_privilege('inst.flow','UPDATE')        AS can_update,
           has_table_privilege('events.news_article','DELETE') AS can_delete,
           current_setting('default_transaction_read_only') AS default_read_only"

  hr "8. Schemas, tables, views (expect 9 schemas, 17 tables, 5 compat views)"
  q "Schemas" "
    SELECT n.nspname AS schema, pg_get_userbyid(n.nspowner) AS owner,
           has_schema_privilege(n.nspname, 'USAGE') AS reader_has_usage
    FROM pg_namespace n
    WHERE n.nspname IN ('ingest','ref','mkt','deriv','inst','fund','events','nlp','compat')
    ORDER BY 1"
  n_schema="$(v "SELECT count(*) FROM pg_namespace WHERE nspname IN ('ingest','ref','mkt','deriv','inst','fund','events','nlp','compat')")"
  [ "$n_schema" = "9" ] && ok "9 schemas" || bad "expected 9 schemas, found ${n_schema:-?}"

  q "Tables (parents only, partitions excluded)" "
    SELECT c.relnamespace::regnamespace AS schema, c.relname AS table,
           CASE c.relkind WHEN 'p' THEN 'partitioned' ELSE 'table' END AS kind,
           has_table_privilege(c.oid, 'SELECT') AS reader_can_select
    FROM pg_class c
    WHERE c.relkind IN ('r','p') AND NOT c.relispartition
      AND c.relnamespace::regnamespace::text IN ('ingest','ref','mkt','deriv','inst','fund','events','nlp')
    ORDER BY 1, 2"
  n_tab="$(v "SELECT count(*) FROM pg_class c WHERE c.relkind IN ('r','p') AND NOT c.relispartition AND c.relnamespace::regnamespace::text IN ('ingest','ref','mkt','deriv','inst','fund','events','nlp')")"
  [ "$n_tab" = "17" ] && ok "17 tables" || bad "expected 17 tables, found ${n_tab:-?}"

  q "compat views" "
    SELECT table_name AS view, has_table_privilege('compat.' || table_name, 'SELECT') AS reader_can_select
    FROM information_schema.views WHERE table_schema = 'compat' ORDER BY 1"
  n_view="$(v "SELECT count(*) FROM information_schema.views WHERE table_schema = 'compat'")"
  [ "$n_view" = "5" ] && ok "5 compat views" || bad "expected 5 compat views, found ${n_view:-?}"

  hr "9. Freshness per table (expected done times, Mon–Fri IST)"
  cat <<'EOF'
  reference 07:01 · ipos 07:30 · calendars 07:45 · eod-snapshots 16:33 · institutional 19:02 (previous session)
  derivatives 19:42 · fundamentals-daily 22:18 · news 00:15/06:15/12:15/18:15 +1 min · sweep 23:50
EOF
  # one query per table, so one bad table does not hide the rest
  printf '\n\033[1m-- Latest data per table\033[0m\n'
  printf '  %-44s %12s  %s\n' TABLE ROWS LATEST
  while IFS='|' read -r tbl col filter; do
    row="$(v "SELECT count(*) || '|' || coalesce(${col:-NULL}::text, '-') FROM ${tbl%% *} ${filter}")"
    if [ -n "$row" ]; then
      printf '  %-44s %12s  %s\n' "$tbl" "${row%%|*}" "${row#*|}"
    else
      bad "$tbl: $(psql -X -q -At -c "SELECT 1 FROM ${tbl%% *} LIMIT 1" 2>&1 | head -1)"
    fi
  done <<'EOF_T'
ref.trading_day|max(trade_date)|
ref.company_map|max(valid_from)|
ref.instrument||
mkt.eod_quote|max(trade_date)|
deriv.option_chain_strike (last 14d)|max(trade_date)|WHERE trade_date >= current_date - 14
deriv.oi_strike|max(trade_date)|
deriv.intraday_insight (last 14d)|max(trade_date)|WHERE trade_date >= current_date - 14
deriv.daily_summary|max(trade_date)|
inst.flow|max(trade_date)|
fund.key_ratio|max(as_of)|
fund.document|max(captured_at)|
events.news_article|max(published_at)|
events.news_instrument||
events.corporate_action|max(announcement_date)|
events.ipo|max(open_date)|
nlp.news_sentiment (not loaded by design)||
EOF_T

  q "Is today a trading day? (ref.trading_day, ±3 days)" "
    SELECT trade_date, is_trading, session_type, open_ist, close_ist, note
    FROM ref.trading_day WHERE trade_date BETWEEN current_date - 3 AND current_date + 3 ORDER BY 1"

  q "Day-one history ranges (compare with the pipeline sheet)" "
    SELECT 'deriv.daily_summary' AS data, min(trade_date)::text AS first, max(trade_date)::text AS last,
           count(DISTINCT trade_date) AS days FROM deriv.daily_summary
    UNION ALL SELECT 'mkt.eod_quote',  min(trade_date)::text, max(trade_date)::text, count(DISTINCT trade_date) FROM mkt.eod_quote
    UNION ALL SELECT 'inst.flow',      min(trade_date)::text, max(trade_date)::text, count(DISTINCT trade_date) FROM inst.flow
    UNION ALL SELECT 'fund.key_ratio', min(as_of)::text,      max(as_of)::text,      count(DISTINCT as_of)      FROM fund.key_ratio
    UNION ALL SELECT 'events.news_article', min(published_at)::date::text, max(published_at)::date::text,
                     count(DISTINCT published_at::date) FROM events.news_article
    UNION ALL SELECT 'events.corporate_action', min(announcement_date)::text, max(announcement_date)::text,
                     count(DISTINCT announcement_date) FROM events.corporate_action
    UNION ALL SELECT 'ref.trading_day', min(trade_date)::text, max(trade_date)::text, count(*) FROM ref.trading_day"

  hr "10. Loads (ingest.file_log)"
  q "Files per dataset and status" "
    SELECT dataset, status, count(*) AS files, sum(row_count) AS rows, max(loaded_at) AS last_load
    FROM ingest.file_log GROUP BY dataset, status ORDER BY dataset, status"
  q "Loaded today" "
    SELECT dataset, count(*) AS files, sum(row_count) AS rows, min(loaded_at)::time AS first, max(loaded_at)::time AS last
    FROM ingest.file_log WHERE loaded_at >= current_date GROUP BY dataset ORDER BY last"
  n_fail="$(v "SELECT count(*) FROM ingest.file_log WHERE status IN ('failed','partial')")"
  if [ "${n_fail:-x}" = "0" ]; then
    ok "no failed / partial files"
  else
    bad "${n_fail:-?} failed / partial files"
    q "Failed / partial files (latest 30) with error" "
      SELECT file_id, rel_path, dataset, as_of_date, status, loaded_at, left(error, 200) AS error
      FROM ingest.file_log WHERE status IN ('failed','partial') ORDER BY loaded_at DESC LIMIT 30"
  fi

  hr "11. Monthly partitions (deriv.option_chain_strike, deriv.intraday_insight)"
  q "Partitions" "
    SELECT inhparent::regclass AS parent, count(*) AS partitions,
           min(inhrelid::regclass::text) AS first, max(inhrelid::regclass::text) AS last
    FROM pg_inherits
    WHERE inhparent IN ('deriv.option_chain_strike'::regclass, 'deriv.intraday_insight'::regclass)
    GROUP BY 1 ORDER BY 1"
  for parent in option_chain_strike intraday_insight; do
    for m in 0 1 2; do
      suffix="$(date -d "$(date +%Y-%m-01) +$m month" +%Y_%m 2>/dev/null)"
      [ -z "$suffix" ] && continue
      exists="$(v "SELECT to_regclass('deriv.${parent}_${suffix}') IS NOT NULL")"
      [ "$exists" = "t" ] && ok "deriv.${parent}_${suffix}" \
        || bad "missing deriv.${parent}_${suffix} — daks_admin: SELECT deriv.ensure_monthly_partitions(current_date, (current_date + interval '12 months')::date);"
    done
  done

  hr "12. compat views (what the EOD report / dashboard reads)"
  n_map="$(v "SELECT count(*) FROM ref.company_map")"
  [ "${n_map:-0}" -gt 0 ] 2>/dev/null && ok "ref.company_map has $n_map rows" \
    || bad "ref.company_map is empty — every compat view will be empty"
  q "Freshness of each compat view" "
    SELECT 'compat.derivatives' AS view, count(*) AS rows, max(date)::text AS latest, count(DISTINCT company_code) AS symbols FROM compat.derivatives
    UNION ALL SELECT 'compat.fii_dii',          count(*), max(date)::text,              NULL FROM compat.fii_dii
    UNION ALL SELECT 'compat.pe_mcap',          count(*), max(date)::text,              count(DISTINCT company_code) FROM compat.pe_mcap
    UNION ALL SELECT 'compat.news_sentiment',   count(*), max(published_at)::text,      count(DISTINCT company_code) FROM compat.news_sentiment
    UNION ALL SELECT 'compat.corporate_actions',count(*), max(broadcast_date)::text,    count(DISTINCT company_code) FROM compat.corporate_actions"
  q "compat.derivatives — latest day, first 10 stocks" "
    SELECT * FROM compat.derivatives
    WHERE date = (SELECT max(date) FROM compat.derivatives) ORDER BY company_code LIMIT 10"
  q "compat.derivatives — RELIANCE last 5 days" "
    SELECT date, pcr, max_pain_strike, atm_iv, futures_close, futures_oi, is_fno
    FROM compat.derivatives WHERE company_code = 'RELIANCE' ORDER BY date DESC LIMIT 5"
  q "compat.fii_dii — last 10 days" "SELECT * FROM compat.fii_dii ORDER BY date DESC LIMIT 10"
  q "compat.pe_mcap — latest P/E, 10 stocks" "
    SELECT DISTINCT ON (company_code) company_code, date, pe_ratio, market_cap
    FROM compat.pe_mcap ORDER BY company_code, date DESC LIMIT 10"
  q "compat.news_sentiment — latest 10" "
    SELECT company_code, published_at, source, left(headline, 80) AS headline, sentiment, sentiment_conf
    FROM compat.news_sentiment ORDER BY published_at DESC LIMIT 10"
  q "compat.corporate_actions — latest 10" "
    SELECT company_code, broadcast_date, event_date, record_date, action_type
    FROM compat.corporate_actions ORDER BY broadcast_date DESC NULLS LAST LIMIT 10"
  q "Real underlying_key values (guide says check after first load)" "
    SELECT underlying_key, count(*) AS days, max(trade_date) AS latest
    FROM deriv.daily_summary GROUP BY 1 ORDER BY 2 DESC LIMIT 15"

  hr "13. Known issues from the guide"
  q "news_sentiment duplicates (scored by >1 model_revision / input_kind)" "
    SELECT count(*) AS duplicate_groups FROM (
      SELECT company_code, published_at, headline FROM compat.news_sentiment
      GROUP BY 1, 2, 3 HAVING count(*) > 1) d"
  q "fii_dii drops days with DII but no FII" "
    SELECT trade_date, string_agg(DISTINCT participant, ',') AS participants
    FROM inst.flow WHERE segment ILIKE '%CASH%'
    GROUP BY trade_date HAVING NOT bool_or(participant = 'FII') ORDER BY 1 DESC LIMIT 10"
  q "pe_mcap.market_cap filled? (expected 0 until a source is chosen)" "
    SELECT count(market_cap) AS rows_with_market_cap, count(*) AS total FROM compat.pe_mcap"
  q "ISINs in fund.key_ratio with no ref.company_map row (missing from compat.pe_mcap)" "
    SELECT 'fund.key_ratio' AS src, count(DISTINCT k.isin) AS isins,
           count(DISTINCT k.isin) FILTER (WHERE m.isin IS NULL) AS unmapped
    FROM fund.key_ratio k LEFT JOIN ref.company_map m ON m.isin = k.isin"

  hr "14. Table sizes"
  q "Approx rows and size per table" "
    SELECT schemaname, relname, n_live_tup AS approx_rows,
           pg_size_pretty(pg_total_relation_size(relid)) AS size, last_analyze, last_autoanalyze
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 25"
}

case "$SECTION" in
  db)       db_sections ;;
  pipeline) pipeline_sections ;;
  all)      pipeline_sections; db_sections ;;
  *)        echo "usage: $0 [all|db|pipeline]"; exit 2 ;;
esac

hr "Summary"
if [ "$FAILS" -eq 0 ]; then ok "all checks passed"; else bad "$FAILS check(s) failed — see FAIL lines above"; fi
exit $(( FAILS > 0 ))
