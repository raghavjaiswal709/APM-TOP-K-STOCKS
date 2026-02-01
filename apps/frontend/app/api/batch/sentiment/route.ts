import { NextRequest, NextResponse } from 'next/server';

// Batch fetch sentiment data for multiple companies
// Uses the premarket predictions API at port 5717

const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const symbols: string[] = body.symbols || [];

    if (!symbols.length) {
      return NextResponse.json({ success: false, error: 'No symbols provided', data: {} });
    }

    // Limit to 30 companies at a time
    const limitedSymbols = symbols.slice(0, 30);
    
    console.log(`📊 Batch fetching sentiment for ${limitedSymbols.length} symbols`);

    // Fetch in parallel with a concurrency limit
    const CONCURRENCY = 5;
    const results: Record<string, string> = {};
    
    for (let i = 0; i < limitedSymbols.length; i += CONCURRENCY) {
      const batch = limitedSymbols.slice(i, i + CONCURRENCY);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (symbol) => {
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          
          try {
            // Use the same endpoint as the rewrite proxy
            const response = await fetch(
              `http://${SERVER_IP}:5717/api/premarket/predictions/${encodeURIComponent(cleanSymbol)}`,
              {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000) // 5 second timeout
              }
            );

            if (!response.ok) {
              console.log(`⚠️ Sentiment failed for ${cleanSymbol}: ${response.status}`);
              return { symbol, sentiment: 'NEUTRAL' };
            }

            const data = await response.json();
            const sentiment = data.sentiment?.toUpperCase() || 'NEUTRAL';
            
            return { symbol, sentiment };
          } catch (error) {
            console.log(`⚠️ Sentiment error for ${cleanSymbol}:`, error);
            return { symbol, sentiment: 'NEUTRAL' };
          }
        })
      );

      // Process batch results
      batchResults.forEach((result, idx) => {
        const symbol = batch[idx];
        if (result.status === 'fulfilled') {
          const sentiment = result.value.sentiment;
          results[symbol] = sentiment;
          // Also add with clean symbol key
          const cleanSymbol = symbol.includes('-') ? symbol.split('-')[0] : symbol;
          if (cleanSymbol !== symbol) {
            results[cleanSymbol] = sentiment;
          }
        } else {
          results[symbol] = 'NEUTRAL';
        }
      });
      
      // Small delay between batches
      if (i + CONCURRENCY < limitedSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const nonNeutralCount = Object.values(results).filter(s => s !== 'NEUTRAL').length;
    console.log(`✅ Batch sentiment: ${Object.keys(results).length} companies loaded (${nonNeutralCount} non-neutral)`);

    return NextResponse.json({
      success: true,
      data: results,
      count: Object.keys(results).length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch sentiment fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: {}
    }, { status: 500 });
  }
}
