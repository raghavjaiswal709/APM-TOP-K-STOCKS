import { NextResponse } from 'next/server';

// Fetch prediction availability from both regular (5112) and GTT (5113) servers
// Also checks if predictions are for today
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const [regularResponse, gttResponse] = await Promise.allSettled([
      fetch('http://100.93.172.21:5112/companies', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 } // Cache for 60 seconds
      }),
      fetch('http://100.93.172.21:5113/api/stocks/list', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      })
    ]);

    // Parse regular predictions (5112)
    let regularCompanies: string[] = [];
    let regularCompaniesToday: string[] = [];
    let regularLastDate: string | null = null;
    
    if (regularResponse.status === 'fulfilled' && regularResponse.value.ok) {
      const data = await regularResponse.value.json();
      // Handle different response formats
      if (Array.isArray(data)) {
        regularCompanies = data.map((c: any) => 
          typeof c === 'string' ? c : (c.symbol || c.company_code || '')
        ).filter(Boolean);
      } else if (data.companies) {
        regularCompanies = data.companies;
      } else if (data.symbols) {
        regularCompanies = data.symbols;
      }
      
      // Get last update date if available
      if (data.last_update) {
        regularLastDate = data.last_update.split(' ')[0]; // Get date part
      }
      
      // Check a sample company to determine if predictions are for today
      if (regularCompanies.length > 0) {
        try {
          const sampleCompany = regularCompanies[0];
          const sampleRes = await fetch(`http://100.93.172.21:5112/predictions/${sampleCompany}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });
          
          if (sampleRes.ok) {
            const sampleData = await sampleRes.json();
            if (sampleData.predictions && typeof sampleData.predictions === 'object') {
              const predictionKeys = Object.keys(sampleData.predictions);
              if (predictionKeys.length > 0) {
                // Check if any prediction is for today
                const hasToday = predictionKeys.some(key => key.startsWith(today));
                regularLastDate = predictionKeys[predictionKeys.length - 1]?.split(' ')[0] || null;
                
                if (hasToday) {
                  // All companies with predictions have today's data
                  regularCompaniesToday = regularCompanies;
                }
              }
            }
          }
        } catch (err) {
          console.warn('Failed to check sample predictions:', err);
        }
      }
    }

    // Parse GTT predictions (5113)
    let gttCompanies: string[] = [];
    let gttCategories: Record<string, { description: string; stocks: string[] }> = {};
    if (gttResponse.status === 'fulfilled' && gttResponse.value.ok) {
      const data = await gttResponse.value.json();
      if (data.stocks && Array.isArray(data.stocks)) {
        gttCompanies = data.stocks;
      }
      if (data.categories) {
        gttCategories = data.categories;
      }
    }

    const isRegularOutdated = regularLastDate && regularLastDate !== today;

    return NextResponse.json({
      success: true,
      today,
      regular: {
        available: regularCompanies,
        availableToday: regularCompaniesToday,
        count: regularCompanies.length,
        countToday: regularCompaniesToday.length,
        lastDate: regularLastDate,
        isOutdated: isRegularOutdated
      },
      gtt: {
        available: gttCompanies,
        count: gttCompanies.length,
        categories: gttCategories
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch prediction availability:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      regular: { available: [], availableToday: [], count: 0, countToday: 0, lastDate: null, isOutdated: true },
      gtt: { available: [], count: 0, categories: {} }
    }, { status: 500 });
  }
}
