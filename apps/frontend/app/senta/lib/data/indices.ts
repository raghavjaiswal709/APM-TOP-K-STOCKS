import fs   from 'fs'
import path from 'path'

const ROOT = path.join(process.cwd(), '..')

const MON: Record<string, number> = {
  Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5,
  Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
}

interface N50Row {
  symbol:    string
  inclusion: Date
  exclusion: Date | null
}

let n50Cache:  N50Row[]    | null = null
let n500Cache: Set<string> | null = null

function parseN50Date(s: string): Date | null {
  if (!s || s === 'Active')      return null
  if (s.startsWith('Prior'))     return new Date(Date.UTC(1990, 0, 1))
  const [dd, mon, yy] = s.split('-')
  if (!dd || !mon || !yy)        return null
  const y = parseInt(yy, 10)
  return new Date(Date.UTC(y >= 90 ? 1900 + y : 2000 + y, MON[mon] ?? 0, parseInt(dd, 10)))
}

function fmtExcDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)}`
}

function loadN50(): N50Row[] {
  if (n50Cache) return n50Cache
  try {
    const csvPath = path.join(ROOT, 'nifty50_historical_constituents.csv')
    if (!fs.existsSync(csvPath)) { n50Cache = []; return [] }
    const txt = fs.readFileSync(csvPath, 'utf8')
    n50Cache = txt.trim().split(/\r?\n/).slice(1).flatMap(line => {
      const cols = line.split(',')
      const sym  = cols[1]?.trim()
      if (!sym) return []
      const inclusion = parseN50Date(cols[2]?.trim() ?? '') ?? new Date(Date.UTC(1990, 0, 1))
      const exclusion = parseN50Date(cols[3]?.trim() ?? 'Active')
      return [{ symbol: sym, inclusion, exclusion }]
    })
  } catch {
    n50Cache = []
  }
  return n50Cache
}

function loadN500(): Set<string> {
  if (n500Cache) return n500Cache
  try {
    const csvPath = path.join(ROOT, 'ind_nifty500list_enriched.csv')
    if (!fs.existsSync(csvPath)) { n500Cache = new Set(); return n500Cache }
    const txt = fs.readFileSync(csvPath, 'utf8')
    n500Cache = new Set(
      txt.trim().split(/\r?\n/).slice(1)
         .map(line => line.split(',')[2]?.trim())
         .filter(Boolean) as string[]
    )
  } catch {
    n500Cache = new Set()
  }
  return n500Cache
}

export function getNifty50ConstituentsAtDate(date?: string | null): string[] {
  const check = date ? new Date(date + 'T00:00:00Z') : new Date()
  const seen = new Set<string>()
  const result: string[] = []
  for (const r of loadN50()) {
    if (!seen.has(r.symbol) && r.inclusion <= check && (r.exclusion === null || r.exclusion > check)) {
      result.push(r.symbol)
    }
    seen.add(r.symbol)
  }
  return result.sort()
}

export function isInNifty500(symbol: string): boolean {
  return loadN500().has(symbol)
}

export interface Nifty50Status {
  everMember:   boolean
  activeAtDate: boolean
  displayDate:  string | null
}

export function getNifty50Status(symbol: string, date?: string | null): Nifty50Status {
  const rows = loadN50().filter(r => r.symbol === symbol)
  if (!rows.length) return { everMember: false, activeAtDate: false, displayDate: null }

  const check = date ? new Date(date + 'T00:00:00Z') : new Date()
  let activeAtDate = false
  let lastExc: Date | null = null

  for (const r of rows) {
    if (r.inclusion <= check && (r.exclusion === null || r.exclusion > check)) {
      activeAtDate = true
    }
    if (r.exclusion && r.exclusion <= check) {
      if (!lastExc || r.exclusion > lastExc) lastExc = r.exclusion
    }
  }

  const displayDate = activeAtDate ? 'Active' : lastExc ? fmtExcDate(lastExc) : null
  return { everMember: true, activeAtDate, displayDate }
}
