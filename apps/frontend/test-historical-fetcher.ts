/**
 * Test Historical Data Fetcher
 * Run this to verify the historical data fetching functionality
 */

import { fetchHistoricalData, mergeHistoricalData, detectDataGaps } from '../lib/historicalDataFetcher';

async function testHistoricalDataFetcher() {
  console.log('🧪 Testing Historical Data Fetcher\n');

  // Test 1: Fetch historical data for a known symbol
  console.log('Test 1: Fetching historical data for 20MICRONS-NSE');
  console.log('='.repeat(60));
  
  const symbol = 'NSE:20MICRONS-EQ';
  const date = '2025-01-08';
  
  console.log(`Symbol: ${symbol}`);
  console.log(`Date: ${date}`);
  console.log(`Expected URL: http://100.93.172.21:6969/Live/LD_01-08-2025/20MICRONS-NSE.json\n`);

  try {
    const result = await fetchHistoricalData(symbol, date);
    
    if (result.success) {
      console.log('✅ Fetch successful!');
      console.log(`   - Data points: ${result.data.length}`);
      console.log(`   - Source: ${result.source}`);
      
      if (result.data.length > 0) {
        const firstPoint = result.data[0];
        const lastPoint = result.data[result.data.length - 1];
        
        console.log(`   - First timestamp: ${new Date(firstPoint.timestamp * 1000).toLocaleString()}`);
        console.log(`   - Last timestamp: ${new Date(lastPoint.timestamp * 1000).toLocaleString()}`);
        console.log(`   - First LTP: ₹${firstPoint.ltp}`);
        console.log(`   - Last LTP: ₹${lastPoint.ltp}`);
        console.log(`   - Sample data:`, JSON.stringify(firstPoint, null, 2));
      }
    } else {
      console.log('❌ Fetch failed!');
      console.log(`   - Error: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Exception during fetch:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Merge data
  console.log('Test 2: Testing data merge');
  console.log('='.repeat(60));
  
  const mockLocalData = [
    { timestamp: 1000, ltp: 100 },
    { timestamp: 2000, ltp: 101 },
    { timestamp: 3000, ltp: 102 },
  ];
  
  const mockExternalData = [
    { timestamp: 1500, ltp: 100.5 },
    { timestamp: 2000, ltp: 101 }, // Duplicate - should not overwrite
    { timestamp: 2500, ltp: 101.5 },
    { timestamp: 4000, ltp: 103 },
  ];
  
  console.log(`Local data points: ${mockLocalData.length}`);
  console.log(`External data points: ${mockExternalData.length}`);
  
  const merged = mergeHistoricalData(mockLocalData, mockExternalData);
  
  console.log(`Merged data points: ${merged.length}`);
  console.log(`Expected: 6 (3 local + 3 new from external)`);
  console.log('Merged timestamps:', merged.map(d => d.timestamp));
  
  const isCorrectlyMerged = merged.length === 6 && 
                            merged[0].timestamp === 1000 &&
                            merged[5].timestamp === 4000;
  
  if (isCorrectlyMerged) {
    console.log('✅ Merge test passed!');
  } else {
    console.log('❌ Merge test failed!');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Gap detection
  console.log('Test 3: Testing gap detection');
  console.log('='.repeat(60));
  
  const now = new Date();
  const tradingStart = new Date(now);
  tradingStart.setHours(9, 15, 0, 0);
  const tradingStartTimestamp = Math.floor(tradingStart.getTime() / 1000);
  
  // Create data with a gap
  const dataWithGap = [
    { timestamp: tradingStartTimestamp + 600 }, // 9:25 AM (10 min late - should detect gap)
    { timestamp: tradingStartTimestamp + 1200 }, // 9:35 AM
    { timestamp: tradingStartTimestamp + 2000 }, // 9:48 AM (13 min gap - should detect)
  ];
  
  console.log('Data timestamps:');
  dataWithGap.forEach(d => {
    console.log(`   - ${new Date(d.timestamp * 1000).toLocaleTimeString()}`);
  });
  
  const gapCheck = detectDataGaps(dataWithGap);
  
  console.log(`\nGaps detected: ${gapCheck.hasGaps ? 'YES' : 'NO'}`);
  console.log(`Number of missing ranges: ${gapCheck.missingRanges.length}`);
  
  if (gapCheck.missingRanges.length > 0) {
    console.log('\nMissing ranges:');
    gapCheck.missingRanges.forEach((range, i) => {
      const startTime = new Date(range.start * 1000).toLocaleTimeString();
      const endTime = new Date(range.end * 1000).toLocaleTimeString();
      console.log(`   ${i + 1}. ${startTime} to ${endTime}`);
    });
  }
  
  if (gapCheck.hasGaps) {
    console.log('✅ Gap detection test passed!');
  } else {
    console.log('❌ Gap detection test failed (should have detected gaps)!');
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('🎉 All tests completed!\n');
}

// Run tests
testHistoricalDataFetcher().catch(console.error);

export { testHistoricalDataFetcher };
