import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'
import type { EventItem } from '@/app/senta/lib/types/tiles'

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
    query<{ broadcast_date: string; category: string; details: string }>(
      `SELECT broadcast_date, category, details
       FROM announcements WHERE company_code = $1 ${dc}
       ORDER BY broadcast_date DESC LIMIT 20`,
      args
    ),
    query<{ meeting_date: string; purpose: string; details: string | null }>(
      `SELECT meeting_date, purpose, details
       FROM board_meetings WHERE company_code = $1 ${dc}
       ORDER BY meeting_date DESC LIMIT 10`,
      args
    ),
    query<{ event_date: string; action_type: string; details: string }>(
      `SELECT event_date, action_type, details
       FROM corporate_actions WHERE company_code = $1 ${dc}
       ORDER BY event_date DESC LIMIT 10`,
      args
    ),
    query<{ date: string; block_buy_qty: number; block_sell_qty: number; bulk_buy_qty: number; bulk_sell_qty: number }>(
      `SELECT date, block_buy_qty, block_sell_qty, bulk_buy_qty, bulk_sell_qty
       FROM block_bulk_deals WHERE company_code = $1 ${dc}
       ORDER BY date DESC LIMIT 10`,
      args
    ),
    query<{ date: string; published_at: string | null; headline: string; source: string; article_url: string; sentiment: number | null; sentiment_conf: number | null }>(
      `SELECT date, published_at, headline, source, article_url, sentiment, sentiment_conf
       FROM news_sentiment
       WHERE company_code = $1 ${dc}
       ORDER BY date DESC, published_at DESC NULLS LAST LIMIT 30`,
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
    ...corpActions.map(c => ({
      type: 'corporate_action' as const,
      date: c.event_date,
      summary: `${c.action_type}: ${c.details?.slice(0, 60) ?? ''}${(c.details?.length ?? 0) > 60 ? '…' : ''}`,
      detail: `${c.action_type}\n\n${c.details ?? ''}`,
    })),
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
