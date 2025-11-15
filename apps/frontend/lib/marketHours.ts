/**
 * Market Hours Utility
 * Checks if the Indian stock market is currently open
 * Trading Hours: 8:45 AM - 4:00 PM IST (includes 30 min buffer on both sides)
 * Actual trading: 9:15 AM - 3:30 PM IST
 */

// NSE/BSE Market Holidays for 2025
export const MARKET_HOLIDAYS_2025 = [
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr
  '2025-04-10', // Mahavir Jayanti
  '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti
  '2025-10-21', // Dussehra
  '2025-10-22', // Diwali - Laxmi Pujan
  '2025-11-05', // Gurunanak Jayanti
  '2025-12-25', // Christmas
];

// Create a Set for O(1) holiday lookups
const MARKET_HOLIDAYS_SET = new Set(MARKET_HOLIDAYS_2025);

/**
 * Check if a given date is a market holiday
 */
export const isMarketHoliday = (date: Date): boolean => {
  const dateStr = date.toISOString().split('T')[0];
  return MARKET_HOLIDAYS_SET.has(dateStr);
};

/**
 * Check if current time is within market hours (with 30-minute buffer)
 * Market Hours: 8:45 AM - 4:00 PM IST
 * Actual Trading: 9:15 AM - 3:30 PM IST
 */
export const isMarketOpen = (): {
  isOpen: boolean;
  reason?: 'weekend' | 'holiday' | 'before-market' | 'after-market';
  nextOpenTime?: Date;
  holidayName?: string;
} => {
  // Get current time in IST
  const now = new Date();
  const istTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const dayOfWeek = istTime.getDay(); // 0 = Sunday, 6 = Saturday

  // Check if it's a weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
    const nextOpen = new Date(istTime);
    nextOpen.setDate(nextOpen.getDate() + daysUntilMonday);
    nextOpen.setHours(9, 15, 0, 0);

    return {
      isOpen: false,
      reason: 'weekend',
      nextOpenTime: nextOpen,
    };
  }

  // Check if it's a market holiday
  if (isMarketHoliday(istTime)) {
    const nextOpen = new Date(istTime);
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(9, 15, 0, 0);

    // Find the actual next trading day (skip weekends and consecutive holidays)
    while (
      nextOpen.getDay() === 0 ||
      nextOpen.getDay() === 6 ||
      isMarketHoliday(nextOpen)
    ) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    return {
      isOpen: false,
      reason: 'holiday',
      nextOpenTime: nextOpen,
      holidayName: getHolidayName(istTime),
    };
  }

  // Convert current time to minutes for easy comparison
  const currentTimeMinutes = hours * 60 + minutes;

  // Market hours with buffer: 8:45 AM (525 minutes) to 4:00 PM (960 minutes)
  const marketOpenTime = 8 * 60 + 45; // 8:45 AM = 525 minutes
  const marketCloseTime = 16 * 60; // 4:00 PM = 960 minutes

  // Before market hours
  if (currentTimeMinutes < marketOpenTime) {
    const nextOpen = new Date(istTime);
    nextOpen.setHours(9, 15, 0, 0);

    return {
      isOpen: false,
      reason: 'before-market',
      nextOpenTime: nextOpen,
    };
  }

  // After market hours
  if (currentTimeMinutes > marketCloseTime) {
    const nextOpen = new Date(istTime);
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(9, 15, 0, 0);

    // Skip to next trading day if tomorrow is weekend
    if (nextOpen.getDay() === 0) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    } else if (nextOpen.getDay() === 6) {
      nextOpen.setDate(nextOpen.getDate() + 2);
    }

    // Skip if next day is a holiday
    while (isMarketHoliday(nextOpen)) {
      nextOpen.setDate(nextOpen.getDate() + 1);
      if (nextOpen.getDay() === 0) {
        nextOpen.setDate(nextOpen.getDate() + 1);
      } else if (nextOpen.getDay() === 6) {
        nextOpen.setDate(nextOpen.getDate() + 2);
      }
    }

    return {
      isOpen: false,
      reason: 'after-market',
      nextOpenTime: nextOpen,
    };
  }

  // Market is open!
  return {
    isOpen: true,
  };
};

/**
 * Get the name of the holiday for a given date
 */
const getHolidayName = (date: Date): string => {
  const dateStr = date.toISOString().split('T')[0];
  const holidayMap: Record<string, string> = {
    '2025-02-26': 'Mahashivratri',
    '2025-03-14': 'Holi',
    '2025-03-31': 'Id-Ul-Fitr',
    '2025-04-10': 'Mahavir Jayanti',
    '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
    '2025-04-18': 'Good Friday',
    '2025-05-01': 'Maharashtra Day',
    '2025-08-15': 'Independence Day',
    '2025-08-27': 'Ganesh Chaturthi',
    '2025-10-02': 'Mahatma Gandhi Jayanti',
    '2025-10-21': 'Dussehra',
    '2025-10-22': 'Diwali - Laxmi Pujan',
    '2025-11-05': 'Gurunanak Jayanti',
    '2025-12-25': 'Christmas',
  };

  return holidayMap[dateStr] || 'Market Holiday';
};

/**
 * Format the next open time in a human-readable format
 */
export const formatNextOpenTime = (nextOpenTime: Date): string => {
  const now = new Date();
  const istNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
  );

  // Set both dates to midnight for accurate day comparison
  const nextOpenMidnight = new Date(nextOpenTime);
  nextOpenMidnight.setHours(0, 0, 0, 0);
  
  const todayMidnight = new Date(istNow);
  todayMidnight.setHours(0, 0, 0, 0);
  
  // Calculate actual day difference
  const diffMs = nextOpenMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return `on ${nextOpenTime.toLocaleDateString('en-IN', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })} at 9:15 AM`;
  }

  if (diffDays === 1) {
    return 'tomorrow at 9:15 AM';
  }

  // Same day - calculate hours
  const diffHoursMs = nextOpenTime.getTime() - istNow.getTime();
  const diffHours = Math.floor(diffHoursMs / (1000 * 60 * 60));
  
  if (diffHours > 0) {
    return `in ${diffHours} hour${diffHours > 1 ? 's' : ''} at 9:15 AM`;
  }

  return 'at 9:15 AM';
};

/**
 * Get a user-friendly message about market status
 */
export const getMarketStatusMessage = (): {
  isOpen: boolean;
  title: string;
  message: string;
} => {
  const status = isMarketOpen();

  if (status.isOpen) {
    return {
      isOpen: true,
      title: 'Market is Open',
      message: 'Live trading data is available',
    };
  }

  let title = 'Market is Closed';
  let message = 'Live data is not available';

  switch (status.reason) {
    case 'weekend':
      title = 'Market Closed - Weekend';
      message = `Markets will reopen ${formatNextOpenTime(status.nextOpenTime!)}`;
      break;

    case 'holiday':
      title = `Market Closed - ${status.holidayName}`;
      message = `Markets will reopen ${formatNextOpenTime(status.nextOpenTime!)}`;
      break;

    case 'before-market':
      title = 'Market Not Yet Open';
      message = 'Markets open at 9:15 AM IST. Pre-market hours: 8:45 AM - 9:15 AM';
      break;

    case 'after-market':
      title = 'Market Closed for Today';
      message = `Markets will reopen ${formatNextOpenTime(status.nextOpenTime!)}`;
      break;
  }

  return {
    isOpen: false,
    title,
    message,
  };
};
