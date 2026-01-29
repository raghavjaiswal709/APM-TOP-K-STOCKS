import { NextResponse } from 'next/server';

// Fetch prediction availability from both regular (5112) and GTT (5113) servers
export async function GET() {
  try {
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

    return NextResponse.json({
      success: true,
      regular: {
        available: regularCompanies,
        count: regularCompanies.length
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
      regular: { available: [], count: 0 },
      gtt: { available: [], count: 0, categories: {} }
    }, { status: 500 });
  }
}
