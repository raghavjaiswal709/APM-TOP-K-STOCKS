'use client';
import { useState, useEffect, useCallback } from 'react';

interface RecordedDataPoint {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: number;
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
}

interface AvailableDate {
  date: string;
  displayDate: string;
  companiesCount: number;
}

interface AvailableCompany {
  symbol: string;
  company: string;
  exchange: string;
  fileName: string;
}

interface UseRecordedDataReturn {
  availableDates: AvailableDate[];
  availableCompanies: AvailableCompany[];
  selectedDate: string | null;
  selectedCompany: string | null;
  recordedData: RecordedDataPoint[];
  loading: boolean;
  error: string | null;
  setSelectedDate: (date: string | null) => void;
  setSelectedCompany: (company: string | null) => void;
  loadCompanyData: (symbol: string) => Promise<void>;
}

export const useRecordedData = (): UseRecordedDataReturn => {
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [recordedData, setRecordedData] = useState<RecordedDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // List of company files you expect to find
  const KNOWN_COMPANIES = [
    'GPIL-NSE',
    'IDBI-NSE',
    'KIRIINDUS-NSE',
    'NORTHARC-NSE',
    'RPOWER-NSE',
    'SCI-NSE'
  ];

  // Load available dates on mount
  useEffect(() => {
    loadAvailableDates();
  }, []);

  // Load companies when date changes
  useEffect(() => {
    if (selectedDate) {
      loadAvailableCompanies(selectedDate);
    } else {
      setAvailableCompanies([]);
      setSelectedCompany(null);
      setRecordedData([]);
    }
  }, [selectedDate]);

//   const loadAvailableDates = async () => {
//     try {
//       setLoading(true);
//       setError(null);

//       // Normally, you can't list directories, but you can try for known dates
//       // Here we just check for the date you have (2025-06-10)
//       // If you have more dates, add them here
//       const possibleDates = ['2025-06-10','2025-06-09','2025-06-08','2025-06-07','2025-06-06','2025-06-05','2025-06-04','2025-06-03','2025-06-02','2025-06-01'];
//       const dates: AvailableDate[] = [];

//       for (const date of possibleDates) {
//         // Check if at least one company file exists for this date
//         let companiesCount = 0;
//         for (const company of KNOWN_COMPANIES) {
//           try {
//             const response = await fetch(`/recorded_data/${date}/${company}.json`, { method: 'HEAD' });
//             if (response.ok) companiesCount++;
//           } catch (err) {
//             // File doesn't exist
//           }
//         }
//         if (companiesCount > 0) {
//           dates.push({
//             date,
//             displayDate: new Date(date).toLocaleDateString(),
//             companiesCount
//           });
//         }
//       }

//       setAvailableDates(dates.sort((a, b) => b.date.localeCompare(a.date)));
//     } catch (err) {
//       setError('Failed to load available dates');
//       console.error('Error loading dates:', err);
//     } finally {
//       setLoading(false);
//     }
//   };

const loadAvailableDates = async () => {
  try {
    setLoading(true);
    setError(null);

    // Only check for the date you actually have
    const possibleDates = ['2025-06-10']; // ✅ FIXED: Only real dates
    const dates: AvailableDate[] = [];

    for (const date of possibleDates) {
      let companiesCount = 0;
      for (const company of KNOWN_COMPANIES) {
        try {
          const response = await fetch(`/recorded_data/${date}/${company}.json`, { method: 'HEAD' });
          if (response.ok) companiesCount++;
        } catch (err) {
          // File doesn't exist
        }
      }
      if (companiesCount > 0) {
        dates.push({
          date,
          displayDate: date, // ✅ FIXED: Use string directly, no Date conversion
          companiesCount
        });
      }
    }

    setAvailableDates(dates.sort((a, b) => b.date.localeCompare(a.date)));
    console.log('✅ Available dates loaded:', dates); // Debug log
  } catch (err) {
    setError('Failed to load available dates');
    console.error('Error loading dates:', err);
  } finally {
    setLoading(false);
  }
};

//   const loadAvailableCompanies = async (date: string) => {
//     try {
//       setLoading(true);
//       setError(null);

//       const companies: AvailableCompany[] = [];
//       for (const companyFile of KNOWN_COMPANIES) {
//         try {
//           const response = await fetch(`/recorded_data/${date}/${companyFile}.json`, { method: 'HEAD' });
//           if (response.ok) {
//             const [company, exchange] = companyFile.split('-');
//             companies.push({
//               symbol: `${exchange}:${company}-EQ`,
//               company: company,
//               exchange: exchange,
//               fileName: companyFile
//             });
//           }
//         } catch (err) {
//           // File doesn't exist
//         }
//       }
//       setAvailableCompanies(companies);
//     } catch (err) {
//       setError('Failed to load companies for selected date');
//       console.error('Error loading companies:', err);
//     } finally {
//       setLoading(false);
//     }
//   };


const loadAvailableCompanies = async (date: string) => {
  try {
    setLoading(true);
    setError(null);

    const companies: AvailableCompany[] = [];
    for (const companyFile of KNOWN_COMPANIES) {
      try {
        // ✅ FIXED: Add .json extension for the fetch
        const response = await fetch(`/recorded_data/${date}/${companyFile}.json`, { method: 'HEAD' });
        if (response.ok) {
          const [company, exchange] = companyFile.split('-');
          companies.push({
            symbol: `${exchange}:${company}-EQ`,
            company: company,
            exchange: exchange,
            fileName: `${companyFile}.json` // ✅ FIXED: Add .json extension
          });
        }
      } catch (err) {
        console.error(`File check failed for ${companyFile}:`, err);
      }
    }
    console.log('✅ Available companies loaded:', companies); // Debug log
    setAvailableCompanies(companies);
  } catch (err) {
    setError('Failed to load companies for selected date');
    console.error('Error loading companies:', err);
  } finally {
    setLoading(false);
  }
};


//   const loadCompanyData = useCallback(async (symbol: string) => {
//     if (!selectedDate) return;

//     try {
//       setLoading(true);
//       setError(null);

//       const company = availableCompanies.find(c => c.symbol === symbol);
//       if (!company) {
//         throw new Error('Company not found');
//       }

//       const response = await fetch(`/recorded_data/${selectedDate}/${company.fileName}`);
//       if (!response.ok) {
//         throw new Error('Failed to fetch company data');
//       }

//       const rawData = await response.json();
//       const transformedData = transformRecordedData(rawData, symbol);
//       setRecordedData(transformedData);

//     } catch (err) {
//       setError(`Failed to load data for ${symbol}`);
//       console.error('Error loading company data:', err);
//       setRecordedData([]);
//     } finally {
//       setLoading(false);
//     }
//   }, [selectedDate, availableCompanies]);

//   const transformRecordedData = (rawData: any, symbol: string): RecordedDataPoint[] => {
//     if (Array.isArray(rawData)) {
//       return rawData.map((item, index) => ({
//         symbol,
//         ltp: item.close || item.ltp || 0,
//         change: item.change || 0,
//         changePercent: item.changePercent || 0,
//         open: item.open || 0,
//         high: item.high || 0,
//         low: item.low || 0,
//         close: item.close || 0,
//         volume: item.volume || 0,
//         bid: item.bid || 0,
//         ask: item.ask || 0,
//         timestamp: item.timestamp || Date.now() / 1000 + index,
//         sma_20: item.sma_20,
//         ema_9: item.ema_9,
//         rsi_14: item.rsi_14
//       }));
//     } else if (rawData && typeof rawData === 'object') {
//       return [{
//         symbol,
//         ltp: rawData.close || rawData.ltp || 0,
//         change: rawData.change || 0,
//         changePercent: rawData.changePercent || 0,
//         open: rawData.open || 0,
//         high: rawData.high || 0,
//         low: rawData.low || 0,
//         close: rawData.close || 0,
//         volume: rawData.volume || 0,
//         bid: rawData.bid || 0,
//         ask: rawData.ask || 0,
//         timestamp: rawData.timestamp || Date.now() / 1000,
//         sma_20: rawData.sma_20,
//         ema_9: rawData.ema_9,
//         rsi_14: rawData.rsi_14
//       }];
//     }
//     return [];
//   };
// const loadCompanyData = useCallback(async (symbol: string) => {
//   if (!selectedDate) {
//     console.error('❌ No selectedDate available');
//     return;
//   }

//   try {
//     setLoading(true);
//     setError(null);

//     console.log('🔍 Looking for company:', symbol);
//     console.log('🔍 Available companies:', availableCompanies);
    
//     const company = availableCompanies.find(c => c.symbol === symbol);
//     if (!company) {
//       throw new Error(`Company not found: ${symbol}`);
//     }

//     const fetchUrl = `/recorded_data/${selectedDate}/${company.fileName}`;
//     console.log('🔍 Fetching from URL:', fetchUrl);
    
//     const response = await fetch(fetchUrl);
//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}: ${response.statusText} for ${fetchUrl}`);
//     }

//     const rawData = await response.json();
//     console.log('✅ Raw data loaded:', rawData);
    
//     const transformedData = transformRecordedData(rawData, symbol);
//     console.log('✅ Transformed data:', transformedData);
    
//     setRecordedData(transformedData);

//   } catch (err) {
//     const errorMessage = `Failed to load data for ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`;
//     setError(errorMessage);
//     console.error('❌ Error loading company data:', err);
//     setRecordedData([]);
//   } finally {
//     setLoading(false);
//   }
// }, [selectedDate, availableCompanies]);
const loadCompanyData = useCallback(async (symbol: string) => {
  if (!selectedDate) {
    console.error('❌ No selectedDate available');
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const company = availableCompanies.find(c => c.symbol === symbol);
    if (!company) {
      throw new Error(`Company not found: ${symbol}`);
    }

    const fetchUrl = `/recorded_data/${selectedDate}/${company.fileName}`;
    console.log('🔍 Fetching from URL:', fetchUrl);
    
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText} for ${fetchUrl}`);
    }

    const textData = await response.text();
    console.log('✅ Raw text data:', textData);

    // ✅ FIXED: Handle JSONL format (multiple JSON objects on separate lines)
    let rawData;
    try {
      // Try parsing as regular JSON first
      rawData = JSON.parse(textData);
    } catch (jsonError) {
      console.log('🔄 Regular JSON failed, trying JSONL format...');
      // Parse as JSONL (JSON Lines) format
      const lines = textData.trim().split('\n').filter(line => line.trim());
      rawData = lines.map(line => JSON.parse(line.trim()));
      console.log('✅ JSONL parsed successfully:', rawData);
    }
    
    const transformedData = transformRecordedData(rawData, symbol);
    console.log('✅ Transformed data:', transformedData);
    
    setRecordedData(transformedData);

  } catch (err) {
    const errorMessage = `Failed to load data for ${symbol}: ${err instanceof Error ? err.message : 'Unknown error'}`;
    setError(errorMessage);
    console.error('❌ Error loading company data:', err);
    setRecordedData([]);
  } finally {
    setLoading(false);
  }
}, [selectedDate, availableCompanies]);


const transformRecordedData = (rawData: any, symbol: string): RecordedDataPoint[] => {
  console.log('🔍 Processing raw data:', rawData);
  
  const processDataPoint = (item: any, index: number = 0) => {
    // Extract base values
    const ltp = Number(item.ltp) || 0;
    const openPrice = Number(item.open_price) || Number(item.open) || ltp;
    const closePrice = Number(item.prev_close_price) || Number(item.close) || ltp;
    
    // Handle invalid high/low values (common in your data)
    let highPrice = Number(item.high_price) || Number(item.high) || 0;
    let lowPrice = Number(item.low_price) || Number(item.low) || 0;
    
    // ✅ CRITICAL FIX: Create valid OHLC when high/low are missing or 0
    if (highPrice <= 0 || lowPrice <= 0 || highPrice < lowPrice) {
      const validPrices = [openPrice, closePrice, ltp].filter(p => p > 0);
      if (validPrices.length > 0) {
        const minPrice = Math.min(...validPrices);
        const maxPrice = Math.max(...validPrices);
        
        // Add small spread for realistic candlestick
        const spread = Math.max(maxPrice * 0.001, 0.05); // 0.1% or minimum 0.05
        
        highPrice = highPrice <= 0 ? maxPrice + spread : Math.max(highPrice, maxPrice);
        lowPrice = lowPrice <= 0 ? minPrice - spread : Math.min(lowPrice, minPrice);
        
        // Ensure OHLC logic is maintained
        highPrice = Math.max(highPrice, openPrice, closePrice, ltp);
        lowPrice = Math.min(lowPrice, openPrice, closePrice, ltp);
      }
    }
    
    // Final validation and cleanup
    if (highPrice <= lowPrice) {
      const midPrice = (highPrice + lowPrice) / 2 || ltp || openPrice || closePrice;
      const spread = Math.max(midPrice * 0.001, 0.05);
      highPrice = midPrice + spread;
      lowPrice = midPrice - spread;
    }
    
    return {
      symbol,
      ltp: ltp,
      change: Number(item.change) || 0,
      changePercent: Number(item.changePercent) || 0,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
      volume: Number(item.vol_traded_today) || Number(item.volume) || 0,
      bid: Number(item.bid_price) || Number(item.bid) || 0,
      ask: Number(item.ask_price) || Number(item.ask) || 0,
      timestamp: Number(item.timestamp) || Number(item.last_traded_time) || (Date.now() / 1000 + index),
      sma_20: item.sma_20 ? Number(item.sma_20) : undefined,
      ema_9: item.ema_9 ? Number(item.ema_9) : undefined,
      rsi_14: item.rsi_14 ? Number(item.rsi_14) : undefined
    };
  };

  try {
    if (Array.isArray(rawData)) {
      const processed = rawData.map(processDataPoint);
      console.log('✅ Processed array data:', processed.length, 'points');
      return processed;
    } else if (rawData && typeof rawData === 'object') {
      const processed = [processDataPoint(rawData)];
      console.log('✅ Processed single object:', processed);
      return processed;
    }
  } catch (error) {
    console.error('❌ Error in data transformation:', error);
  }
  
  console.log('❌ Invalid data format:', rawData);
  return [];
};


  return {
    availableDates,
    availableCompanies,
    selectedDate,
    selectedCompany,
    recordedData,
    loading,
    error,
    setSelectedDate,
    setSelectedCompany,
    loadCompanyData
  };
};
