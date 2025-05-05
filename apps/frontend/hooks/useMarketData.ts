import { useState, useEffect, useCallback } from 'react';
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
}

interface UseMarketDataReturn {
  data: Record<string, MarketData>;
  isLoading: boolean;
  error: Error | null;
  subscribeToSymbol: (symbol: string) => void;
  unsubscribeFromSymbol: (symbol: string) => void;
}

export const useMarketData = (initialSymbols: string[] = []): UseMarketDataReturn => {
  const [data, setData] = useState<Record<string, MarketData>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [subscribedSymbols, setSubscribedSymbols] = useState<Set<string>>(
    new Set(initialSymbols)
  );

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
    
    setData((prev) => {
      const newData = { ...prev };
      delete newData[symbol];
      return newData;
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    
    const handleMarketData = (message: { symbol: string; data: MarketData }) => {
      setData((prev) => ({
        ...prev,
        [message.symbol]: message.data,
      }));
      
      setIsLoading(false);
    };
    
    socket.on('marketData', handleMarketData);
    
    // Subscribe to initial symbols
    initialSymbols.forEach((symbol) => {
      socket.emit('subscribe', { symbol });
    });
    
    return () => {
      socket.off('marketData', handleMarketData);
      
      // Unsubscribe from all symbols when component unmounts
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
  };
};
