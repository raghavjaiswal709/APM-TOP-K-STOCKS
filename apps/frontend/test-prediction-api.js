/**
 * Test script to verify prediction API connectivity
 * Run: node test-prediction-api.js
 */

const baseUrl = 'http://localhost:5000/api';

async function testPredictionAPI() {
  console.log('🧪 Testing Prediction API Connectivity\n');
  console.log('=' . repeat(60));

  // Test 1: Health Check
  console.log('\n1️⃣ Testing Health Endpoint');
  console.log(`   URL: ${baseUrl}/predictions/health`);
  try {
    const healthResponse = await fetch(`${baseUrl}/predictions/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('   ✅ Health Check Passed');
      console.log('   Response:', JSON.stringify(healthData, null, 2));
    } else {
      console.log(`   ❌ Health Check Failed: ${healthResponse.status} ${healthResponse.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Health Check Error: ${error.message}`);
  }

  // Test 2: Get Companies
  console.log('\n2️⃣ Testing Companies Endpoint');
  console.log(`   URL: ${baseUrl}/predictions/companies`);
  try {
    const companiesResponse = await fetch(`${baseUrl}/predictions/companies`);
    if (companiesResponse.ok) {
      const companiesData = await companiesResponse.json();
      console.log('   ✅ Companies List Retrieved');
      console.log('   Response:', JSON.stringify(companiesData, null, 2));
    } else {
      console.log(`   ❌ Companies Failed: ${companiesResponse.status} ${companiesResponse.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ Companies Error: ${error.message}`);
  }

  // Test 3: Get AXISBANK Predictions
  console.log('\n3️⃣ Testing AXISBANK Predictions');
  console.log(`   URL: ${baseUrl}/predictions/AXISBANK`);
  try {
    const predictionResponse = await fetch(`${baseUrl}/predictions/AXISBANK`);
    if (predictionResponse.ok) {
      const predictionData = await predictionResponse.json();
      console.log('   ✅ AXISBANK Predictions Retrieved');
      console.log(`   Company: ${predictionData.company}`);
      console.log(`   Predictions Count: ${predictionData.count}`);
      console.log(`   Start Time: ${predictionData.starttime || 'N/A'}`);
      console.log(`   End Time: ${predictionData.endtime || 'N/A'}`);
      
      if (predictionData.count > 0) {
        const firstPrediction = Object.values(predictionData.predictions)[0];
        console.log('   Sample Prediction:', JSON.stringify(firstPrediction, null, 2));
      }
    } else {
      console.log(`   ❌ AXISBANK Failed: ${predictionResponse.status} ${predictionResponse.statusText}`);
      const errorText = await predictionResponse.text();
      console.log(`   Error Details: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ AXISBANK Error: ${error.message}`);
  }

  // Test 4: Get ICICIBANK Predictions
  console.log('\n4️⃣ Testing ICICIBANK Predictions');
  console.log(`   URL: ${baseUrl}/predictions/ICICIBANK`);
  try {
    const predictionResponse = await fetch(`${baseUrl}/predictions/ICICIBANK`);
    if (predictionResponse.ok) {
      const predictionData = await predictionResponse.json();
      console.log('   ✅ ICICIBANK Predictions Retrieved');
      console.log(`   Company: ${predictionData.company}`);
      console.log(`   Predictions Count: ${predictionData.count}`);
    } else {
      console.log(`   ❌ ICICIBANK Failed: ${predictionResponse.status} ${predictionResponse.statusText}`);
    }
  } catch (error) {
    console.log(`   ❌ ICICIBANK Error: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Complete\n');
}

testPredictionAPI();
