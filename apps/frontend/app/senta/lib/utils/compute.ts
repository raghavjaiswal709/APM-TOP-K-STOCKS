export function gapPct(todayOpen: number, prevClose: number): number {
  return ((todayOpen - prevClose) / prevClose) * 100
}

export function vwap(bars: { high: number; low: number; close: number; volume: number }[]): number {
  let sumPV = 0, sumV = 0
  for (const b of bars) {
    const tp = (b.high + b.low + b.close) / 3
    sumPV += tp * b.volume
    sumV  += b.volume
  }
  return sumV === 0 ? 0 : sumPV / sumV
}

export function vwapDistPct(ltp: number, vwapVal: number): number {
  return ((ltp - vwapVal) / vwapVal) * 100
}

export function atr14(bars: { high: number; low: number; close: number }[]): number {
  if (bars.length < 2) return 0
  const trs = bars.slice(1).map((b, i) => {
    const prev = bars[i].close
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev))
  })
  return trs.slice(-14).reduce((s, v) => s + v, 0) / Math.min(14, trs.length)
}

export function volumePace(todayVol: number, minsElapsed: number): number {
  const sessionFraction = minsElapsed / 375
  if (sessionFraction <= 0) return 0
  return todayVol / sessionFraction
}

export function circuitBands(prevClose: number, bandPct: number): { upper: number; lower: number } {
  return {
    upper: prevClose * (1 + bandPct / 100),
    lower: prevClose * (1 - bandPct / 100),
  }
}

export function dist52w(ltp: number, high52w: number, low52w: number) {
  return {
    distToHigh: ((ltp - high52w) / high52w) * 100,
    distToLow:  ((ltp - low52w)  / low52w)  * 100,
  }
}
