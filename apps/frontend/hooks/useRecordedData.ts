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

interface AvailableCompany {
  symbol: string;
  company: string;
  exchange: string;
  fileName: string;
  fileNameWithoutExt: string;
}

interface AvailableDate {
  date: string;
  displayDate: string;
  companiesCount: number;
  companies: AvailableCompany[];
}

interface DataManifest {
  dates: AvailableDate[];
  lastUpdated: string;
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
  const [manifest, setManifest] = useState<DataManifest | null>(null);
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [availableCompanies, setAvailableCompanies] = useState<AvailableCompany[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [recordedData, setRecordedData] = useState<RecordedDataPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load manifest on mount
  useEffect(() => {
    loadManifest();
  }, []);

  // Update available companies when date changes
  useEffect(() => {
    if (selectedDate && manifest) {
      const dateData = manifest.dates.find(d => d.date === selectedDate);
      if (dateData) {
        setAvailableCompanies(dateData.companies);
      } else {
        setAvailableCompanies([]);
      }
      setSelectedCompany(null);
      setRecordedData([]);
    } else {
      setAvailableCompanies([]);
      setSelectedCompany(null);
      setRecordedData([]);
    }
  }, [selectedDate, manifest]);

  const loadManifest = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/data-manifest.json');
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status} ${response.statusText}`);
      }

      const manifestData: DataManifest = await response.json();
      setManifest(manifestData);
      setAvailableDates(manifestData.dates);
      
      console.log('✅ Manifest loaded:', {
        dates: manifestData.dates.length,
        totalCompanies: manifestData.dates.reduce((sum, d) => sum + d.companiesCount, 0),
        lastUpdated: manifestData.lastUpdated
      });

    } catch (err) {
      const errorMessage = `Failed to load data manifest: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      console.error('❌ Manifest loading error:', err);
    } finally {
      setLoading(false);
    }
  };

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
      console.log('✅ Raw text data loaded');

      // Handle JSONL format (multiple JSON objects on separate lines)
      let rawData;
      try {
        rawData = JSON.parse(textData);
      } catch (jsonError) {
        console.log('🔄 Regular JSON failed, trying JSONL format...');
        const lines = textData.trim().split('\n').filter(line => line.trim());
        rawData = lines.map(line => JSON.parse(line.trim()));
        console.log('✅ JSONL parsed successfully');
      }
      
      const transformedData = transformRecordedData(rawData, symbol);
      console.log('✅ Transformed data:', transformedData.length, 'points');
      
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
    // ... (keep your existing transformRecordedData function as is)
    const processDataPoint = (item: any, index: number = 0) => {
      const ltp = Number(item.ltp) || 0;
      const openPrice = Number(item.open_price) || Number(item.open) || ltp;
      const closePrice = Number(item.prev_close_price) || Number(item.close) || ltp;
      
      let highPrice = Number(item.high_price) || Number(item.high) || 0;
      let lowPrice = Number(item.low_price) || Number(item.low) || 0;
      
      if (highPrice <= 0 || lowPrice <= 0 || highPrice < lowPrice) {
        const validPrices = [openPrice, closePrice, ltp].filter(p => p > 0);
        if (validPrices.length > 0) {
          const minPrice = Math.min(...validPrices);
          const maxPrice = Math.max(...validPrices);
          const spread = Math.max(maxPrice * 0.001, 0.05);
          
          highPrice = highPrice <= 0 ? maxPrice + spread : Math.max(highPrice, maxPrice);
          lowPrice = lowPrice <= 0 ? minPrice - spread : Math.min(lowPrice, minPrice);
          
          highPrice = Math.max(highPrice, openPrice, closePrice, ltp);
          lowPrice = Math.min(lowPrice, openPrice, closePrice, ltp);
        }
      }
      
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
        return rawData.map(processDataPoint);
      } else if (rawData && typeof rawData === 'object') {
        return [processDataPoint(rawData)];
      }
    } catch (error) {
      console.error('❌ Error in data transformation:', error);
    }
    
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
