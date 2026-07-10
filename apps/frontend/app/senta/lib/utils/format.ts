const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const NUM = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export function fmtINR(v: number): string {
  return INR.format(v)
}

export function fmtNum(v: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v)
}

export function fmtPct(v: number, decimals = 2): string {
  const sign = v > 0 ? '+' : ''
  return `${sign}${fmtNum(v, decimals)}%`
}

export function fmtLargeNum(v: number): string {
  if (Math.abs(v) >= 1e7) return `${fmtNum(v / 1e7, 2)} Cr`
  if (Math.abs(v) >= 1e5) return `${fmtNum(v / 1e5, 2)} L`
  return NUM.format(v)
}

export function fmtVol(v: number): string {
  if (v >= 1e7) return `${fmtNum(v / 1e7, 2)}Cr`
  if (v >= 1e5) return `${fmtNum(v / 1e5, 2)}L`
  if (v >= 1e3) return `${fmtNum(v / 1e3, 1)}K`
  return String(v)
}

export function colorForPct(pct: number): string {
  if (pct > 0) return 'text-emerald-400'
  if (pct < 0) return 'text-red-400'
  return 'text-zinc-400'
}

export function bgColorForPct(pct: number): string {
  if (pct >= 1) return 'bg-emerald-700'
  if (pct > 0)  return 'bg-emerald-900'
  if (pct <= -1) return 'bg-red-700'
  if (pct < 0)  return 'bg-red-900'
  return 'bg-zinc-800'
}
