import { NextResponse } from 'next/server'
import { query } from '@/app/senta/lib/db/sentiment'
import type { EventItem } from '@/app/senta/lib/types/tiles'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const date = new URL(req.url).searchParams.get('date')
  const dc  = date ? `AND broadcast_date <= '${date}'` : ''
  const dc2 = date ? `AND meeting_date    <= '${date}'` : ''
  const dc3 = date ? `AND ex_date         <= '${date}'` : ''
  const dc4 = date ? `AND date            <= '${date}'` : ''
  const dc5 = date ? `AND published_at::date <= '${date}'` : ''

  const [announcements, boardMeetings, corpActions, bulkBlock, news] = await Promise.all([
    query<{ broadcast_date: string; category: string; details: string }>(
      `SELECT broadcast_date, category, details
       FROM announcements WHERE symbol = $1 ${dc}
       ORDER BY broadcast_date DESC LIMIT 20`,
      [symbol]
    ),
    query<{ meeting_date: string; purpose: string }>(
      `SELECT meeting_date, purpose
       FROM board_meetings WHERE symbol = $1 ${dc2}
       ORDER BY meeting_date DESC LIMIT 10`,
      [symbol]
    ),
    query<{ ex_date: string; action_type: string; details: string }>(
      `SELECT ex_date, action_type, details
       FROM corporate_actions WHERE symbol = $1 ${dc3}
       ORDER BY ex_date DESC LIMIT 10`,
      [symbol]
    ),
    query<{ date: string; block_buy_qty: number; block_sell_qty: number; bulk_buy_qty: number; bulk_sell_qty: number }>(
      `SELECT date, block_buy_qty, block_sell_qty, bulk_buy_qty, bulk_sell_qty
       FROM block_bulk_deals WHERE symbol = $1 ${dc4}
       ORDER BY date DESC LIMIT 10`,
      [symbol]
    ),
    query<{ published_at: string; headline: string; source: string; article_url: string; finbert_score: number }>(
      `SELECT published_at, headline, source, article_url, finbert_score
       FROM news_sentiment
       WHERE symbol = $1 AND is_duplicate = false ${dc5}
       ORDER BY published_at DESC LIMIT 30`,
      [symbol]
    ),
  ])

  const events: EventItem[] = [
    ...news.map(n => ({
      type: 'news' as const,
      date: n.published_at,
      summary: n.headline,
      url: n.article_url,
      sentimentDot: n.finbert_score,
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
      detail: b.purpose ?? '',
    })),
    ...corpActions.map(c => ({
      type: 'corporate_action' as const,
      date: c.ex_date,
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
