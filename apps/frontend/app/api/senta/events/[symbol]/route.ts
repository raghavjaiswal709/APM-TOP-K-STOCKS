import { NextResponse } from 'next/server'
import { tryQuery } from '@/app/senta/lib/db/sentiment'
import { upstoxQuery } from '@/app/senta/lib/db/upstox'
import type { EventItem } from '@/app/senta/lib/types/tiles'

// upstox corporate-action details are the raw Upstox JSON; show its "Details"
// line (e.g. "Rs.6.0000 per share(60%)Final Dividend") when there is one.
function actionText(details: string | null): string {
  if (!details) return ''
  try {
    const d = JSON.parse(details) as { event_details?: { name: string; value: string | null }[] }
    const items = d.event_details ?? []
    const line = items.find(e => e.name === 'Details')?.value
    if (line) return line
    return items.filter(e => e.value).map(e => `${e.name}: ${e.value}`).join(' · ')
  } catch {
    return details
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const date = new URL(req.url).searchParams.get('date')
  // Historical view: only rows that were available for the selected prediction day
  const dc   = date ? 'AND pred_date <= $2' : ''
  const args = date ? [symbol, date] : [symbol]

  const [announcements, boardMeetings, corpActions, bulkBlock, news] = await Promise.all([
    tryQuery<{ broadcast_date: string; category: string; details: string }>(
      `SELECT broadcast_date, category, details
       FROM announcements WHERE company_code = $1 ${dc}
       ORDER BY broadcast_date DESC LIMIT 20`,
      args
    ),
    tryQuery<{ meeting_date: string; purpose: string; details: string | null }>(
      `SELECT meeting_date, purpose, details
       FROM board_meetings WHERE company_code = $1 ${dc}
       ORDER BY meeting_date DESC LIMIT 10`,
      args
    ),
    upstoxQuery<{ event_date: string | null; broadcast_date: string | null; action_type: string; details: string | null }>(
      `SELECT event_date, broadcast_date, action_type, details
       FROM compat.corporate_actions WHERE company_code = $1 ${date ? 'AND broadcast_date < $2::date' : ''}
       ORDER BY coalesce(event_date, broadcast_date) DESC NULLS LAST LIMIT 10`,
      args
    ),
    tryQuery<{ date: string; block_buy_qty: number; block_sell_qty: number; bulk_buy_qty: number; bulk_sell_qty: number }>(
      `SELECT date, block_buy_qty, block_sell_qty, bulk_buy_qty, bulk_sell_qty
       FROM block_bulk_deals WHERE company_code = $1 ${dc}
       ORDER BY date DESC LIMIT 10`,
      args
    ),
    // compat.news_sentiment has no article_url, so read the tables behind it
    upstoxQuery<{ date: string; published_at: string | null; headline: string; source: string; article_url: string; sentiment: number | null; sentiment_conf: number | null }>(
      `SELECT a.published_at::date::text AS date,
              to_char(a.published_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"') AS published_at,
              a.headline, a.source_host AS source, a.article_url,
              s.score AS sentiment, s.confidence AS sentiment_conf
       FROM events.news_article a
       LEFT JOIN LATERAL (
         SELECT score, confidence FROM nlp.news_sentiment ns
         WHERE ns.article_id = a.article_id AND ns.model_name = 'ProsusAI/finbert'
         ORDER BY ns.model_revision DESC LIMIT 1
       ) s ON true
       WHERE EXISTS (
         SELECT 1 FROM events.news_instrument ni
         JOIN ref.company_map m ON m.isin = ni.isin
          AND a.published_at::date >= m.valid_from
          AND (m.valid_to IS NULL OR a.published_at::date < m.valid_to)
         WHERE ni.article_id = a.article_id AND m.company_code = $1
       ) ${date ? 'AND a.first_captured_at < $2::date' : ''}
       ORDER BY a.published_at DESC NULLS LAST LIMIT 30`,
      args
    ),
  ])

  const events: EventItem[] = [
    ...news.map(n => ({
      type: 'news' as const,
      date: n.published_at ?? n.date,
      summary: n.headline,
      url: n.article_url,
      sentimentDot: n.sentiment != null ? n.sentiment * (n.sentiment_conf ?? 1) : null,
      source: n.source ?? null,
    })),
    ...announcements.map(a => ({
      type: 'announcement' as const,
      date: a.broadcast_date,
      summary: `${a.category}: ${a.details?.slice(0, 80) ?? ''}${(a.details?.length ?? 0) > 80 ? '…' : ''}`,
      detail: `${a.category}\n\n${a.details ?? ''}`,
    })),
    ...boardMeetings.map(b => ({
      type: 'board_meeting' as const,
      date: b.meeting_date,
      summary: b.purpose?.slice(0, 80) ?? '',
      detail: b.details ? `${b.purpose ?? ''}\n\n${b.details}` : (b.purpose ?? ''),
    })),
    ...corpActions.map(c => {
      const text = actionText(c.details)
      return {
        type: 'corporate_action' as const,
        date: c.event_date ?? c.broadcast_date ?? '',
        summary: `${c.action_type}: ${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`,
        detail: `${c.action_type}\n\n${text}`,
      }
    }),
    ...bulkBlock.map(d => ({
      type: 'bulk_block' as const,
      date: d.date,
      summary: [
        d.block_buy_qty  ? `Block buy ${d.block_buy_qty.toLocaleString()}`  : '',
        d.block_sell_qty ? `Block sell ${d.block_sell_qty.toLocaleString()}` : '',
        d.bulk_buy_qty   ? `Bulk buy ${d.bulk_buy_qty.toLocaleString()}`    : '',
        d.bulk_sell_qty  ? `Bulk sell ${d.bulk_sell_qty.toLocaleString()}`  : '',
      ].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return NextResponse.json({ events })
}
