import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}

interface MarketData {
  symbol: string;
  ltp: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  timestamp: number;
}

interface MarketStatus {
  current_time: string;
  market_open: string;
  market_close: string;
  is_trading_hours: boolean;
  is_weekend: boolean;
  timezone: string;
}

export const useLiveMarket = () => {
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_LIVE_MARKET_SOCKET_URL || 'http://localhost:5010';
    
    console.log(`Connecting to Live Market WebSocket: ${SOCKET_URL}`);
    
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Connected to Live Market WebSocket');
      setConnectionStatus('Connected');
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Live Market WebSocket:', reason);
      setConnectionStatus('Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Live Market WebSocket connection error:', error);
      setConnectionStatus('Connection Error');
      setIsConnected(false);
      setError(`Connection failed: ${error.message}`);
    });

    socket.on('availableSymbols', (data) => {
      console.log('📊 Received available symbols:', data);
      setAvailableCompanies(data.symbols || []);
      if (data.tradingHours) {
        setMarketStatus(data.tradingHours);
      }
    });

    socket.on('marketData', (data: MarketData) => {
      console.log('📈 Received market data:', data);
      setMarketData(prev => ({
        ...prev,
        [data.symbol]: data
      }));
    });

    socket.on('historicalData', (data: { symbol: string; data: MarketData[] }) => {
      console.log('📉 Received historical data:', data);
      // You can process historical data here if needed
    });

    socket.on('subscriptionConfirm', (data) => {
      console.log('✅ Subscription confirmed:', data);
      setLoading(false);
      setError(null);
    });

    socket.on('error', (data) => {
      console.error('❌ Server error:', data);
      setError(data.message);
      setLoading(false);
    });

    socket.on('heartbeat', (data) => {
      console.log('💓 Heartbeat:', data);
    });

    socket.on('fyersConnected', (data) => {
      console.log('🔗 Fyers connected:', data);
    });

    socket.on('fyersDisconnected', (data) => {
      console.log('🔗 Fyers disconnected:', data);
      setError('Fyers connection lost. Reconnecting...');
    });

    socketRef.current = socket;

    return () => {
      console.log('🧹 Cleaning up Live Market WebSocket connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribeToCompanies = useCallback((companyCodes: string[]) => {
    if (!socketRef.current || !socketRef.current.connected) {
      setError('Not connected to server');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('📡 Subscribing to companies:', companyCodes);
    
    // Update selected companies
    const selectedComps = companyCodes.map(code => 
      availableCompanies.find(c => c.company_code === code)
    ).filter(Boolean) as Company[];
    
    setSelectedCompanies(selectedComps);

    // Send subscription request
    socketRef.current.emit('subscribe_companies', { companyCodes });
  }, [availableCompanies]);

  const unsubscribeAll = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      return;
    }

    console.log('📡 Unsubscribing from all companies');
    
    setSelectedCompanies([]);
    setMarketData({});
    
    socketRef.current.emit('unsubscribe_all', {});
  }, []);

  const getMarketStatus = useCallback(() => {
    if (!socketRef.current || !socketRef.current.connected) {
      return;
    }

    socketRef.current.emit('get_market_status', {});
  }, []);

  return {
    availableCompanies,
    selectedCompanies,
    marketData,
    marketStatus,
    connectionStatus,
    error,
    loading,
    isConnected,
    subscribeToCompanies,
    unsubscribeAll,
    getMarketStatus
  };
};
