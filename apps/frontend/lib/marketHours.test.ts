/**
 * Test file for market hours functionality
 * Run this in browser console to test different scenarios
 */

import { isMarketOpen, getMarketStatusMessage, MARKET_HOLIDAYS_2025 } from '../lib/marketHours';

// Test 1: Check current market status
console.log('=== Current Market Status ===');
const currentStatus = getMarketStatusMessage();
console.log('Is Open:', currentStatus.isOpen);
console.log('Title:', currentStatus.title);
console.log('Message:', currentStatus.message);

// Test 2: Check all holidays
console.log('\n=== Market Holidays 2025 ===');
console.log('Total holidays:', MARKET_HOLIDAYS_2025.length);
MARKET_HOLIDAYS_2025.forEach(holiday => {
  console.log(holiday);
});

// Test 3: Simulate different times (for development testing)
console.log('\n=== Time Simulation Tests ===');

// Helper to simulate time check
const simulateTimeCheck = (hours: number, minutes: number, day: number = 3) => {
  // This is just for documentation - actual implementation checks current time
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const dayStr = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
  
  const marketOpenMin = 8 * 60 + 45; // 8:45 AM
  const marketCloseMin = 16 * 60; // 4:00 PM
  const currentMin = hours * 60 + minutes;
  
  let status = 'OPEN';
  if (day === 0 || day === 6) {
    status = 'CLOSED (Weekend)';
  } else if (currentMin < marketOpenMin) {
    status = 'CLOSED (Before Market)';
  } else if (currentMin > marketCloseMin) {
    status = 'CLOSED (After Market)';
  }
  
  console.log(`${dayStr} ${timeStr}: ${status}`);
};

// Before market hours
simulateTimeCheck(8, 30, 3); // Wednesday 8:30 AM - CLOSED
simulateTimeCheck(8, 45, 3); // Wednesday 8:45 AM - OPEN (buffer start)
simulateTimeCheck(9, 0, 3);  // Wednesday 9:00 AM - OPEN

// During market hours
simulateTimeCheck(9, 15, 3);  // Wednesday 9:15 AM - OPEN
simulateTimeCheck(12, 0, 3);  // Wednesday 12:00 PM - OPEN
simulateTimeCheck(15, 30, 3); // Wednesday 3:30 PM - OPEN

// After market hours
simulateTimeCheck(16, 0, 3);  // Wednesday 4:00 PM - CLOSED (buffer end)
simulateTimeCheck(17, 0, 3);  // Wednesday 5:00 PM - CLOSED

// Weekends
simulateTimeCheck(10, 0, 0); // Sunday 10:00 AM - CLOSED
simulateTimeCheck(10, 0, 6); // Saturday 10:00 AM - CLOSED

console.log('\n=== Market Hours Summary ===');
console.log('Buffer Hours: 8:45 AM - 4:00 PM IST');
console.log('Actual Trading: 9:15 AM - 3:30 PM IST');
console.log('Total Buffer: 30 minutes before + 30 minutes after');
