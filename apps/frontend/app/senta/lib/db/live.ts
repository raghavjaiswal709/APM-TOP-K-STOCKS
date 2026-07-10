export interface LiveQuote {
  symbol: string
  ltp: number
  pctChange: number
  todayOpen: number
  volume: number
}

export interface LiveIndex {
  symbol: string
  name: string
  level: number
  pctChange: number
}

export interface PreOpenData {
  iep: number
  iepQty: number
}

export interface OrderBook {
  bestBid: number
  bestAsk: number
}

export async function getLiveQuote(symbol: string): Promise<LiveQuote> {
  return { symbol, ltp: 0, pctChange: 0, todayOpen: 0, volume: 0 }
}

export async function getVix(): Promise<{ level: number; pctChange: number }> {
  return { level: 0, pctChange: 0 }
}

export async function getNifty50(): Promise<{ level: number; pctChange: number }> {
  return { level: 0, pctChange: 0 }
}

export async function getSectorIndices(): Promise<LiveIndex[]> {
  return []
}

export async function getPreOpen(symbol: string): Promise<PreOpenData | null> {
  return null
}

export async function getOrderBook(symbol: string): Promise<OrderBook | null> {
  return null
}

export async function getCircuitBand(symbol: string): Promise<number | null> {
  return null
}
