import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket';

interface MarketData {
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  sma_20?: number;
  ema_9?: number;
  rsi_14?: number;
}

interface ChartUpdate {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
  change: number;
  changePercent: number;
}

interface UseMarketDataReturn {
  data: Record<string, MarketData>;
  isLoading: boolean;
  error: Error | null;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
  chartUpdates: Record<string, ChartUpdate[]>;
  lastUpdate: Date | null;
  activeSymbols: string[];
  cachedSymbols: string[];
  backgroundDataPoints: number;
}

// ============ FIXED: Stable constants ============
const STORAGE_KEY = 'market_data_cache_v2';
const CHART_STORAGE_KEY = 'chart_updates_cache_v2';
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MAX_POINTS_PER_SYMBOL = 10000;

// ============ FIXED: Stable storage helpers ============
const saveToStorage = (key: string, data: any) => {
  try {
    const serializedData = JSON.stringify({
      timestamp: Date.now(),
      data: data
    });
    localStorage.setItem(key, serializedData);
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const loadFromStorage = (key: string) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const age = Date.now() - parsed.timestamp;

    if (age < MAX_CACHE_AGE) {
      return parsed.data;
    } else {
      localStorage.removeItem(key);
      return null;
    }
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return null;
  }
};

export const useMarketData = (initialSymbols: string[] = []): UseMarketDataReturn => {
  // ============ FIXED: Stable state initialization ============
  const [data, setData] = useState<Record<string, MarketData>>(() => {
    if (typeof window !== 'undefined') {
      return loadFromStorage(STORAGE_KEY) || {};
    }
    return {};
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [chartUpdates, setChartUpdates] = useState<Record<string, ChartUpdate[]>>(() => {
    if (typeof window !== 'undefined') {
      return loadFromStorage(CHART_STORAGE_KEY) || {};
    }
    return {};
  });

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(() => 
    new Set(initialSymbols)
  );

  // ============ FIXED: Stable background tracking ============
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [cachedSymbols, setCachedSymbols] = useState<string[]>([]);
  const [backgroundDataPoints, setBackgroundDataPoints] = useState<number>(0);

  // ============ FIXED: Stable refs ============
  const socketRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);

  // ============ FIXED: Stable data saving with debouncing ============
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce saves to prevent excessive localStorage writes
    saveTimeoutRef.current = setTimeout(() => {
      if (Object.keys(data).length > 0) {
        saveToStorage(STORAGE_KEY, data);
      }
      if (Object.keys(chartUpdates).length > 0) {
        saveToStorage(CHART_STORAGE_KEY, chartUpdates);
      }
    }, 5000); // Save after 5 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, chartUpdates]);

  // ============ FIXED: Stable subscription functions ============
  const subscribeToSymbol = useCallback((symbol: string) => {
    setSubscribedSymbols((prev) => {
      if (prev.has(symbol)) return prev; // Prevent unnecessary updates
      const newSet = new Set(prev);
      newSet.add(symbol);
      return newSet;
    });

    if (socketRef.current) {
      socketRef.current.emit('subscribe', { symbol }, (response: any) => {
        if (response && response.success) {
          console.log(`✅ Subscribed to ${symbol}. Cached: ${response.cached_points || 0}`);
        }
      });
    }
  }, []);

  const unsubscribeFromSymbol = useCallback((symbol: string) => {
    setSubscribedSymbols((prev) => {
      if (!prev.has(symbol)) return prev; // Prevent unnecessary updates
      const newSet = new Set(prev);
      newSet.delete(symbol);
      return newSet;
    });

    if (socketRef.current) {
      socketRef.current.emit('unsubscribe', { symbol });
    }

    console.log(`Unsubscribed from ${symbol} (data preserved)`);
  }, []);

  // ============ FIXED: Stable socket initialization ============
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const socket = getSocket();
    socketRef.current = socket;

    // ============ FIXED: Stable event handlers ============
    const handleMarketDataUpdate = (marketData: MarketData) => {
      if (!marketData || !marketData.symbol) return;

      setData((prev) => {
        // Prevent unnecessary updates if data is the same
        const existing = prev[marketData.symbol];
        if (existing && existing.timestamp === marketData.timestamp && existing.ltp === marketData.ltp) {
          return prev;
        }

        return {
          ...prev,
          [marketData.symbol]: marketData,
        };
      });

      setLastUpdate(new Date());
      setIsLoading(false);
    };

    const handleChartUpdate = (update: ChartUpdate) => {
      if (!update || !update.symbol) return;

      setChartUpdates((prev) => {
        const symbolUpdates = prev[update.symbol] || [];

        // Check for duplicate timestamps
        if (symbolUpdates.length > 0) {
          const lastUpdate = symbolUpdates[symbolUpdates.length - 1];
          if (lastUpdate.timestamp === update.timestamp && lastUpdate.price === update.price) {
            return prev; // Skip duplicate
          }
        }

        const newUpdates = [...symbolUpdates, update].slice(-MAX_POINTS_PER_SYMBOL);

        return {
          ...prev,
          [update.symbol]: newUpdates
        };
      });

      setLastUpdate(new Date());
    };

    const handleHistoricalData = (message: { symbol: string; data: MarketData[] }) => {
      if (!message || !message.symbol || !Array.isArray(message.data) || message.data.length === 0) return;

      console.log(`📈 Received ${message.data.length} historical points for ${message.symbol}`);

      const latestData = message.data[message.data.length - 1];
      setData((prev) => ({
        ...prev,
        [message.symbol]: latestData,
      }));

      const chartData = message.data.map((item) => ({
        symbol: message.symbol,
        price: item.ltp,
        timestamp: item.timestamp,
        volume: item.volume || 0,
        change: item.change || 0,
        changePercent: item.changePercent || 0
      }));

      setChartUpdates((prev) => ({
        ...prev,
        [message.symbol]: chartData
      }));

      setIsLoading(false);
    };

    const handleChartUpdatesHistory = (message: { symbol: string; data: ChartUpdate[] }) => {
      if (!message || !message.symbol || !Array.isArray(message.data) || message.data.length === 0) return;

      console.log(`🔄 Received ${message.data.length} cached updates for ${message.symbol}`);

      setChartUpdates((prev) => ({
        ...prev,
        [message.symbol]: message.data
      }));
    };

    const handleHeartbeat = (heartbeat: any) => {
      if (!heartbeat) return;

      if (Array.isArray(heartbeat.active_symbols)) {
        setActiveSymbols(heartbeat.active_symbols);
      }
      if (typeof heartbeat.total_cached_points === 'number') {
        setBackgroundDataPoints(heartbeat.total_cached_points);
      }
    };

    const handleConnect = () => {
      console.log('✅ Socket connected for fixed market data');
      setError(null);
    };

    const handleDisconnect = () => {
      console.log('❌ Socket disconnected');
      setError(new Error('Connection lost'));
    };

    const handleError = (err: any) => {
      console.error('❌ Socket error:', err);
      setError(new Error(err.message || 'Socket error'));
    };

    // ============ FIXED: Register event listeners ONCE ============
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('marketDataUpdate', handleMarketDataUpdate);
    socket.on('chartUpdate', handleChartUpdate);
    socket.on('historicalData', handleHistoricalData);
    socket.on('chartUpdatesHistory', handleChartUpdatesHistory);
    socket.on('heartbeat', handleHeartbeat);

    // Subscribe to initial symbols once
    initialSymbols.forEach((symbol) => {
      socket.emit('subscribe', { symbol });
    });

    // ============ FIXED: Cleanup function ============
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socket.off('marketDataUpdate', handleMarketDataUpdate);
      socket.off('chartUpdate', handleChartUpdate);
      socket.off('historicalData', handleHistoricalData);
      socket.off('chartUpdatesHistory', handleChartUpdatesHistory);
      socket.off('heartbeat', handleHeartbeat);

      // Unsubscribe from all symbols
      subscribedSymbols.forEach((symbol) => {
        socket.emit('unsubscribe', { symbol });
      });
    };
  }, []); // ✅ FIXED: Empty dependency array - initialize once

  // ============ FIXED: Stable cleanup with proper dependencies ============
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoffTime = Date.now() - MAX_CACHE_AGE;

      setChartUpdates((prev) => {
        const cleaned: Record<string, ChartUpdate[]> = {};
        let hasChanges = false;

        Object.entries(prev).forEach(([symbol, updates]) => {
          const recentUpdates = updates.filter(
            update => (update.timestamp * 1000) > cutoffTime
          );

          if (recentUpdates.length > 0) {
            cleaned[symbol] = recentUpdates;
          }

          if (recentUpdates.length !== updates.length) {
            hasChanges = true;
          }
        });

        return hasChanges ? cleaned : prev;
      });

      setData((prev) => {
        const cleaned: Record<string, MarketData> = {};
        let hasChanges = false;

        Object.entries(prev).forEach(([symbol, marketData]) => {
          if ((marketData.timestamp * 1000) > cutoffTime) {
            cleaned[symbol] = marketData;
          } else {
            hasChanges = true;
          }
        });

        return hasChanges ? cleaned : prev;
      });

    }, 3600000); // Cleanup every hour

    return () => clearInterval(cleanupInterval);
  }, []); // ✅ FIXED: Empty dependency array

  // ============ FIXED: Update cached symbols list ============
  useEffect(() => {
    setCachedSymbols(Object.keys(data));
  }, [data]);

  return {
    data,
    isLoading,
    error,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    chartUpdates,
    lastUpdate,
    activeSymbols,
    cachedSymbols,
    backgroundDataPoints
  };
};
