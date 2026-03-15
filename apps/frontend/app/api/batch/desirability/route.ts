import { NextRequest, NextResponse } from 'next/server';

// Batch fetch desirability data for multiple companies
// Primary: port 8506 (/visualize/predicted-analysis)
// Fallback: port 6968 UMAP Clustering V2 (/api/v2/clustering/{symbol}/analysis)

const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';
const PRIMARY_URL = `http://${SERVER_IP}:8506/visualize/predicted-analysis`;
const UMAP_BASE = `http://${SERVER_IP}:6968/api/v2/clustering`;

interface TopClusterData {
  cluster_id: number;
  probability: number;
  desirability_score: number;
  classification: string;
}

interface DesirabilityResult {
  symbol: string;
  score: number;
  classification: string;
  reoccurrenceProbability: number;
  success: boolean;
  source?: 'primary' | 'umap-fallback';
}

// Track whether primary is reachable (avoids hammering a dead endpoint)
let primaryDown = false;
let primaryDownAt = 0;
const PRIMARY_RETRY_MS = 5 * 60_000;

// ── Derive desirability from UMAP cluster data ──────────────────────────────
function classifyFromUMAP(c: { win_rate: number; risk_adjusted_return: number; archetype: string }): string {
  if (c.win_rate >= 0.7 && c.risk_adjusted_return > 0.5) return 'Highly Desirable';
  if (c.win_rate >= 0.5 && c.risk_adjusted_return > 0) return 'Moderately Desirable';
  if (c.win_rate >= 0.3 && c.risk_adjusted_return > -0.3) return 'Neutral';
  if (c.archetype === 'Trending_Down' || c.risk_adjusted_return < -0.5) return 'Undesirable';
  return 'Low Desirability';
}

function scoreFromUMAP(c: { win_rate: number; risk_adjusted_return: number; recurrence_rate: number; persistence: number }): number {
  const normRAR = Math.max(0, Math.min(1, (c.risk_adjusted_return + 1) / 2));
  return Math.max(0, Math.min(1,
    0.4 * c.win_rate + 0.3 * normRAR + 0.2 * Math.min(c.recurrence_rate * 5, 1) + 0.1 * c.persistence
  ));
}

async function fetchFromPrimary(cleanSymbol: string, signal: AbortSignal): Promise<DesirabilityResult | null> {
  const response = await fetch(PRIMARY_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: cleanSymbol, method: 'spectral', exchange: 'NSE', top_n: 5 }),
    signal,
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (data.top_clusters?.length > 0) {
    const top = data.top_clusters[0];
    return {
      symbol: cleanSymbol,
      score: top.desirability_score ?? 0,
      classification: top.classification ?? 'Unknown',
      reoccurrenceProbability: top.probability ?? 0,
      success: true,
      source: 'primary',
    };
  }
  return null;
}

async function fetchFromUMAP(cleanSymbol: string, signal: AbortSignal): Promise<DesirabilityResult | null> {
  const res = await fetch(`${UMAP_BASE}/${encodeURIComponent(cleanSymbol)}/analysis?window=7`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const clusters = data.active_clusters?.clusters;
  if (!clusters?.length) return null;
  // Pick the best cluster by derived score
  let best = clusters[0];
  let bestScore = scoreFromUMAP(best);
  for (const c of clusters) {
    const s = scoreFromUMAP(c);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return {
    symbol: cleanSymbol,
    score: bestScore,
    classification: classifyFromUMAP(best),
    reoccurrenceProbability: best.recurrence_rate ?? 0,
    success: true,
    source: 'umap-fallback',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbols: string[] = body.symbols || [];

    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No symbols provided', data: {} });
    }

    const limitedSymbols = symbols.slice(0, 30);
    const shouldTryPrimary = !primaryDown || (Date.now() - primaryDownAt > PRIMARY_RETRY_MS);

    const CONCURRENCY = 5;
    const results: Record<string, DesirabilityResult> = {};

    for (let i = 0; i < limitedSymbols.length; i += CONCURRENCY) {
      const batch = limitedSymbols.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          const ac = AbortSignal.timeout(8000);

          // Try primary first (if it's not known-down)
          if (shouldTryPrimary) {
            try {
              const primary = await fetchFromPrimary(cleanSymbol, ac);
              if (primary) {
                primaryDown = false;
                return { ...primary, symbol };
              }
            } catch {
              primaryDown = true;
              primaryDownAt = Date.now();
            }
          }

          // Fallback to UMAP V2
          try {
            const fallback = await fetchFromUMAP(cleanSymbol, ac);
            if (fallback) return { ...fallback, symbol };
          } catch { /* both failed */ }

          return { symbol, success: false } as DesirabilityResult;
        })
      );

      batchResults.forEach((result, idx) => {
        const symbol = batch[idx];
        if (result.status === 'fulfilled' && result.value.success) {
          const data = result.value as DesirabilityResult;
          results[symbol] = data;
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          if (cleanSymbol !== symbol) results[cleanSymbol] = data;
        }
      });

      if (i + CONCURRENCY < limitedSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      data: results,
      count: successCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch desirability fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {},
    }, { status: 500 });
  }
}
