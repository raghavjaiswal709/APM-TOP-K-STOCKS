import type { TileConfig } from '../types/tiles'

export const TILES: TileConfig[] = [
  { id: 'A1', label: 'India VIX', section: 'A', source: 'live_db', tooltip: "The market's fear gauge. Rising VIX = more fear and bigger swings, so trade smaller with wider stops; falling = calm.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'A2', label: 'GIFT Nifty Premium', section: 'A', source: 'sentiment_db', tooltip: "Offshore Nifty futures that trade before NSE opens — your best preview of the opening direction. A positive premium hints at a higher open.", freshness: 'pre-open', refresh: 'session', display: 'number' },
  { id: 'A3', label: 'Nifty 50', section: 'A', source: 'live_db', tooltip: "The market's heartbeat; most stocks drift with it. Trending up = tailwind for longs; falling sharply = pause longs.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'A7', label: 'Sensex', section: 'A', source: 'live_db', tooltip: "BSE Sensex — the benchmark for large-cap stocks listed on Bombay Stock Exchange. Useful cross-check against Nifty divergences.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'A8', label: 'Nifty 500', section: 'A', source: 'live_db', tooltip: "Broad market index covering the top 500 stocks. Nifty 500 diverging from Nifty 50 signals mid/small cap participation or rotation.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'A4', label: 'A/D Ratio', section: 'A', source: 'sentiment_db', tooltip: "Yesterday's breadth — how many stocks rose vs fell. Strong breadth = broad participation; weak breadth warns even if the index looks fine.", freshness: 'prev-session', refresh: 'session', display: 'number' },
  { id: 'A5', label: 'Sector Heatmap', section: 'A', source: 'live_db', tooltip: "Shows where money is flowing today by sector. Favour green sectors for longs and red for shorts; fighting a red sector lowers your odds.", freshness: 'live', refresh: 'live', display: 'heatmap' },
  { id: 'A6', label: 'Global Indices', section: 'A', source: 'sentiment_db', tooltip: "Overnight moves in US/Europe/Asia that set the mood before open. Broad green overseas usually means a firmer open here.", freshness: 'prev-session', refresh: 'session', display: 'heatmap' },
  { id: 'A9', label: 'FII / DII', section: 'A', source: 'sentiment_db', tooltip: "Net equity cash-market flows for the most recent session. FII buying = foreign conviction; DII buying often cushions FII selling. Persistently negative FII with positive DII = domestic support.", freshness: 'prev-session', refresh: 'session', display: 'number' },
  { id: 'B1', label: 'Stock Identity', section: 'B', source: 'sentiment_db', tooltip: "Identifies the stock, whether it's F&O-eligible (unlocks PCR / max pain), and its index membership.", freshness: 'static', refresh: 'static', display: 'badge' },
  { id: 'B2', label: 'Sector', section: 'B', source: 'sentiment_db', tooltip: "The stock's sector — always read a stock with its sector context, since sector moves dominate.", freshness: 'static', refresh: 'static', display: 'text' },
  { id: 'B3', label: 'Market Cap', section: 'B', source: 'sentiment_db', tooltip: "Size and liquidity band. Large caps = tighter spreads and cleaner action; small caps = thinner, more volatile, circuit-prone.", freshness: 'prev-close', refresh: 'session', display: 'text' },
  { id: 'B4', label: 'P/E Ratio', section: 'B', source: 'sentiment_db', tooltip: "Valuation context — how expensive the stock is vs earnings. Background only, not an intraday trigger.", freshness: 'TTM', refresh: 'session', display: 'number' },
  { id: 'C1', label: 'LTP', section: 'C', source: 'live_db', tooltip: "Live price and today's move, with an intraday line — your backup if the primary terminal is down.", freshness: 'live', refresh: 'live', display: 'chart' },
  { id: 'C2', label: 'Gap %', section: 'C', source: 'computed', tooltip: "How far the stock jumped overnight. Small gaps in trends tend to continue; large gaps (>2%) without news often fade.", freshness: 'pre-open', refresh: 'session', display: 'number' },
  { id: 'C3', label: 'Prev Day OHLCV', section: 'C', source: 'sentiment_db', tooltip: "Yesterday's range; the high (PDH) and low (PDL) are today's key support/resistance that everyone watches.", freshness: 'prev-close', refresh: 'session', display: 'ohlc' },
  { id: 'C4', label: 'IEP', section: 'C', source: 'live_db', tooltip: "The auction's predicted opening price before 9:15. Heavy IEP volume means big players are committed and the gap is more likely to hold.", freshness: 'pre-open', refresh: 'live', display: 'number' },
  { id: 'C5', label: 'VWAP', section: 'C', source: 'computed', tooltip: "The day's volume-weighted fair price that institutions benchmark to. Holding above VWAP = buyers in control; below = sellers.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'C6', label: 'Last on WL', section: 'C', source: 'computed', tooltip: "The most recent date this stock appeared on the quantitative watchlist, and its rank on that list. Shows how recently the model flagged it.", freshness: 'prev-session', refresh: 'session', display: 'text' },
  { id: 'D1', label: 'Volume vs ADV', section: 'D', source: 'computed', tooltip: "Is the move backed by participation? Volume well above the 20-day average confirms breakouts; low volume = likely trap.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'D2', label: 'Volume Pace', section: 'D', source: 'computed', tooltip: "Time-adjusted volume so 10 AM and 2 PM compare fairly; pace over 100% means unusually active today.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'D3', label: 'Delivery %', section: 'D', source: 'sentiment_db', tooltip: "Share of yesterday's volume actually held overnight (India-specific). High = genuine accumulation with legs; low = speculative churn.", freshness: 'prev-session', refresh: 'session', display: 'number' },
  { id: 'E1', label: 'PCR', section: 'E', source: 'sentiment_db', foOnly: true, tooltip: "Put vs call activity. Above ~1.2 leans bearish, below ~0.8 bullish — but extremes can flip contrarian, so weigh it, don't obey it.", freshness: 'prev-close', refresh: 'session', display: 'number' },
  { id: 'E2', label: 'Max Pain', section: 'E', source: 'sentiment_db', foOnly: true, tooltip: "The strike where most options expire worthless; price tends to gravitate there, most strongly near expiry.", freshness: 'prev-close', refresh: 'session', display: 'number' },
  { id: 'E3', label: '52W High / Low', section: 'E', source: 'computed', tooltip: "Position within the yearly range. Near the high = momentum / breakout watch; near the low = weakness or reversal watch.", freshness: 'live', refresh: 'live', display: 'range' },
  { id: 'E4', label: 'vs Sector', section: 'E', source: 'computed', tooltip: "Is the stock leading or lagging its sector today? Outperforming a green sector = real conviction; lagging = relative weakness.", freshness: 'live', refresh: 'live', display: 'number' },
  { id: 'F1', label: 'Circuit Band', section: 'F', source: 'computed', tooltip: "The daily price limit where trading halts. Near a circuit, liquidity dries up and you may be unable to exit — know the levels in advance.", freshness: 'prev-close', refresh: 'session', display: 'range' },
  { id: 'F2', label: 'ATR (14)', section: 'F', source: 'computed', tooltip: "The stock's typical daily range. Size stops at ≥0.5× ATR and targets at 1–1.5× ATR; skip stocks with ATR% under ~1.5%.", freshness: 'prev-close', refresh: 'session', display: 'number' },
  { id: 'F3', label: 'Bid / Ask Spread', section: 'F', source: 'live_db', tooltip: "The instant cost to enter and exit. Tight = liquid and safe; wide = illiquid and hard to exit cleanly.", freshness: 'live', refresh: 'live', display: 'number' },
]

export const TILE_MAP = Object.fromEntries(TILES.map(t => [t.id, t]))

export const FRESHNESS_LABEL: Record<string, string> = {
  live:          'Live',
  'pre-open':    'Pre-open snapshot',
  'prev-session':'Previous session',
  'prev-close':  'Previous close',
  TTM:           'Trailing twelve months',
  event:         'Event-driven',
  static:        'Static reference',
}
