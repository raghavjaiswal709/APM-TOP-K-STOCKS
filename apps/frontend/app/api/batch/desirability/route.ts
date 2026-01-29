import { NextRequest, NextResponse } from 'next/server';

// Batch fetch desirability data for multiple companies
// Uses the proxy API that's already working

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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbols: string[] = body.symbols || [];

    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No symbols provided', data: {} });
    }

    // Limit to 30 companies at a time to avoid overwhelming the server
    const limitedSymbols = symbols.slice(0, 30);
    
    console.log(`📊 Batch fetching desirability for ${limitedSymbols.length} symbols`);

    // Fetch in parallel with a concurrency limit
    const CONCURRENCY = 5; // Lower concurrency to avoid overwhelming server
    const results: Record<string, DesirabilityResult> = {};
    
    for (let i = 0; i < limitedSymbols.length; i += CONCURRENCY) {
      const batch = limitedSymbols.slice(i, i + CONCURRENCY);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          // Clean symbol - remove -NSE, -BSE suffix
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          
          try {
            // Use the same endpoint as useDesirability hook
            const response = await fetch(
              `http://100.93.172.21:8506/visualize/predicted-analysis`,
              {
                method: 'POST',
                headers: { 
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  symbol: cleanSymbol,
                  method: 'spectral',
                  exchange: 'NSE',
                  top_n: 5
                }),
                signal: AbortSignal.timeout(8000) // 8 second timeout per request
              }
            );

            if (!response.ok) {
              console.log(`⚠️ Desirability failed for ${cleanSymbol}: ${response.status}`);
              return { symbol, success: false };
            }

            const data = await response.json();
            
            if (data.top_clusters && data.top_clusters.length > 0) {
              const topCluster = data.top_clusters[0];
              return {
                symbol,
                score: topCluster.desirability_score || 0,
                classification: topCluster.classification || 'Unknown',
                reoccurrenceProbability: topCluster.probability || 0,
                success: true
              };
            }
            
            return { symbol, success: false };
          } catch (error) {
            console.log(`⚠️ Desirability error for ${cleanSymbol}:`, error);
            return { symbol, success: false };
          }
        })
      );

      // Process batch results
      batchResults.forEach((result, idx) => {
        const symbol = batch[idx];
        if (result.status === 'fulfilled' && result.value.success) {
          const data = result.value as DesirabilityResult;
          results[symbol] = data;
          // Also add with clean symbol key
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          if (cleanSymbol !== symbol) {
            results[cleanSymbol] = data;
          }
        }
      });
      
      // Small delay between batches to avoid overwhelming server
      if (i + CONCURRENCY < limitedSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`✅ Batch desirability: ${successCount} companies loaded successfully`);

    return NextResponse.json({
      success: true,
      data: results,
      count: successCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch desirability fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {}
    }, { status: 500 });
  }
}
