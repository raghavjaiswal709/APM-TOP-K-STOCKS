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
}

export const useMarketData = (initialSymbols: string[] = []): UseMarketDataReturn => {
  const [data, setData] = useState<Record<string, MarketData>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [chartUpdates, setChartUpdates] = useState<Record<string, ChartUpdate[]>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(
    new Set(initialSymbols)
  );

  // Use refs for performance optimization
  const dataRef = useRef(data);
  const chartUpdatesRef = useRef(chartUpdates);

  // Update refs when state changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    chartUpdatesRef.current = chartUpdates;
  }, [chartUpdates]);

  const subscribeToSymbol = useCallback((symbol: string) => {
    setSubscribedSymbols((prev) => {
      const newSet = new Set(prev);
      newSet.add(symbol);
      return newSet;
    });
    getSocket().emit('subscribe', { symbol });
  }, []);

  const unsubscribeFromSymbol = useCallback((symbol: string) => {
    setSubscribedSymbols((prev) => {
      const newSet = new Set(prev);
      newSet.delete(symbol);
      return newSet;
    });
    getSocket().emit('unsubscribe', { symbol });

    // Clean up data
    setData((prev) => {
      const newData = { ...prev };
      delete newData[symbol];
      return newData;
    });

    setChartUpdates((prev) => {
      const newUpdates = { ...prev };
      delete newUpdates[symbol];
      return newUpdates;
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();

    // Handle regular market data updates (every 200ms from server)
    const handleMarketDataUpdate = (marketData: MarketData) => {
      setData((prev) => ({
        ...prev,
        [marketData.symbol]: marketData,
      }));
      setLastUpdate(new Date());
      setIsLoading(false);
    };

    // Handle ultra-fast chart updates (every 100ms from server)
    const handleChartUpdate = (update: ChartUpdate) => {
      setChartUpdates((prev) => {
        const symbolUpdates = prev[update.symbol] || [];
        // Keep only last 1000 updates for performance
        const newUpdates = [...symbolUpdates, update].slice(-1000);

        return {
          ...prev,
          [update.symbol]: newUpdates
        };
      });
      setLastUpdate(new Date());
    };

    // Handle historical data
    const handleHistoricalData = (message: { symbol: string; data: MarketData[] }) => {
      if (message.data && message.data.length > 0) {
        // Set the latest data point as current market data
        const latestData = message.data[message.data.length - 1];
        setData((prev) => ({
          ...prev,
          [message.symbol]: latestData,
        }));

        // Initialize chart updates with historical data
        const chartData = message.data.map((item, index) => ({
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
      }
    };

    // Handle connection events
    const handleConnect = () => {
      console.log('Socket connected for market data');
      setError(null);
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected');
      setError(new Error('Connection lost'));
    };

    const handleError = (err: any) => {
      console.error('Socket error:', err);
      setError(new Error(err.message || 'Socket error'));
    };

    // Register all event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('marketDataUpdate', handleMarketDataUpdate);
    socket.on('chartUpdate', handleChartUpdate);
    socket.on('historicalData', handleHistoricalData);

    // Subscribe to initial symbols
    initialSymbols.forEach((symbol) => {
      socket.emit('subscribe', { symbol });
    });

    // Cleanup function
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socket.off('marketDataUpdate', handleMarketDataUpdate);
      socket.off('chartUpdate', handleChartUpdate);
      socket.off('historicalData', handleHistoricalData);

      // Unsubscribe from all symbols
      subscribedSymbols.forEach((symbol) => {
        socket.emit('unsubscribe', { symbol });
      });
    };
  }, [initialSymbols]);

  return {
    data,
    isLoading,
    error,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    chartUpdates,
    lastUpdate
  };
};
