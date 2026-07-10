import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const REPORTS_DIR = path.join(process.cwd(), '..', 'phase2', 'eod_report_gen', 'reports')

function findLatestReport(symbol: string): { content: string; date: string } | null {
  if (!fs.existsSync(REPORTS_DIR)) return null

  const folders = fs.readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith('watchlist_'))
    .sort()
    .reverse()

  for (const folder of folders) {
    const date = folder.replace('watchlist_', '')
    const filePath = path.join(REPORTS_DIR, folder, `${symbol}_${date}.md`)
    if (fs.existsSync(filePath)) {
      return { content: fs.readFileSync(filePath, 'utf-8'), date }
    }
  }
  return null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const date = new URL(req.url).searchParams.get('date')

  if (date) {
    const filePath = path.join(REPORTS_DIR, `watchlist_${date}`, `${symbol}_${date}.md`)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ content: null, date, found: false })
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return NextResponse.json({ content, date, found: true })
  }

  const result = findLatestReport(symbol)
  if (!result) {
    return NextResponse.json({ content: null, date: null, found: false })
  }
  return NextResponse.json({ content: result.content, date: result.date, found: true })
}
