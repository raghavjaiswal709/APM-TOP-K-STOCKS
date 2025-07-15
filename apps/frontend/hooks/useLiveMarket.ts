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
  bid?: number;
  ask?: number;
}

interface MarketStatus {
  trading_active: boolean;
  trading_start: string;
  trading_end: string;
  current_time: string;
  is_market_day: boolean;
  active_subscriptions: number;
  connected_clients: number;
}

interface TradingHours {
  isActive: boolean;
  start: string;
  end: string;
}

interface AvailableSymbolsData {
  symbols: Company[];
  maxCompanies: number;
  tradingHours: TradingHours;
}

interface SubscriptionConfirm {
  success: boolean;
  symbols: string[];
  count: number;
}

interface HistoricalData {
  symbol: string;
  data: MarketData[];
}

type ConnectionStatus = 'Connecting' | 'Connected' | 'Disconnected' | 'Reconnecting' | 'Error';

// Helper function to validate company object
const isValidCompany = (company: any): company is Company => {
  return (
    company &&
    typeof company === 'object' &&
    typeof company.company_code === 'string' &&
    company.company_code.trim() !== '' &&
    company.company_code !== 'null' &&
    company.company_code !== 'undefined'
  );
};

// Helper function to validate company code
const isValidCompanyCode = (code: any): code is string => {
  return (
    typeof code === 'string' &&
    code.trim() !== '' &&
    code !== 'null' &&
    code !== 'undefined' &&
    code !== null &&
    code !== undefined
  );
};

export const useLiveMarket = () => {
  // State management
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<Company[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [historicalData, setHistoricalData] = useState<Record<string, MarketData[]>>({});
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [maxCompanies, setMaxCompanies] = useState<number>(6);
  const [tradingHours, setTradingHours] = useState<TradingHours | null>(null);

  // Refs for tracking state
  const socketRef = useRef<Socket | null>(null);
  const subscribedCompanyCodes = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;

  const initializeSocket = useCallback(() => {
    const SOCKET_URL = process.env.NEXT_PUBLIC_LIVE_MARKET_SOCKET_URL || 'http://localhost:5010';
    
    console.log(`🔌 Connecting to Live Market WebSocket: ${SOCKET_URL}`);
    setConnectionStatus('Connecting');
    
    const socket = io(SOCKET_URL, {
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      forceNew: true
    });

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Connected to Live Market WebSocket');
      setConnectionStatus('Connected');
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Live Market WebSocket:', reason);
      setConnectionStatus('Disconnected');
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        setConnectionStatus('Reconnecting');
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Live Market WebSocket connection error:', error);
      setConnectionStatus('Error');
      setIsConnected(false);
      setError(`Connection failed: ${error.message}`);
      
      reconnectAttempts.current++;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        setError('Max reconnection attempts reached. Please refresh the page.');
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setConnectionStatus('Reconnecting');
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      setConnectionStatus('Connected');
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    });

    // Handle availableSymbols event from backend
    socket.on('availableSymbols', (data: AvailableSymbolsData) => {
      console.log('📊 Received available symbols:', data);
      
      // Filter out invalid symbols from backend
      const validSymbols = (data.symbols || []).filter(symbol => 
        symbol && 
        symbol.company_code && 
        symbol.company_code !== 'null' && 
        symbol.company_code !== null
      );
      
      setAvailableCompanies(validSymbols);
      setMaxCompanies(data.maxCompanies || 6);
      setTradingHours(data.tradingHours || null);
    });

    // Handle marketData event from backend
    socket.on('marketData', (data: MarketData) => {
      console.log('📈 Received market data:', data);
      setMarketData(prev => ({
        ...prev,
        [data.symbol]: {
          ...prev[data.symbol],
          ...data,
          timestamp: data.timestamp || Date.now()
        }
      }));
    });

    // Handle historicalData event from backend
    socket.on('historicalData', (data: HistoricalData) => {
      console.log('📉 Received historical data:', data);
      setHistoricalData(prev => ({
        ...prev,
        [data.symbol]: data.data
      }));
    });

    // Handle subscriptionConfirm event from backend
    socket.on('subscriptionConfirm', (data: SubscriptionConfirm) => {
      console.log('✅ Subscription confirmed:', data);
      setLoading(false);
      setError(null);
      
      // Create confirmed companies from valid symbols only
      const confirmedCompanies: Company[] = [];
      
      data.symbols.forEach(symbol => {
        // Skip invalid symbols
        if (!symbol || symbol.includes('None') || symbol.includes('null')) {
          console.warn(`⚠️ Skipping invalid symbol: ${symbol}`);
          return;
        }
        
        // First try to find in available companies
        const existingCompany = availableCompanies.find(company => company.symbol === symbol);
        if (existingCompany) {
          confirmedCompanies.push(existingCompany);
        } else {
          // Create a company object from the symbol if not found
          const parts = symbol.split(':');
          if (parts.length === 2) {
            const codePart = parts[1].split('-')[0];
            const exchange = parts[0];
            const marker = parts[1].split('-')[1] || 'EQ';
            
            // Validate extracted company code
            if (codePart && codePart !== 'None' && codePart !== 'null') {
              const dynamicCompany: Company = {
                company_code: codePart,
                name: codePart,
                exchange: exchange,
                marker: marker,
                symbol: symbol
              };
              confirmedCompanies.push(dynamicCompany);
            }
          }
        }
      });
      
      setSelectedCompanies(confirmedCompanies);
    });

    // Handle marketStatus event from backend
    socket.on('marketStatus', (status: MarketStatus) => {
      console.log('⏰ Received market status:', status);
      setMarketStatus(status);
    });

    // Handle heartbeat event from backend
    socket.on('heartbeat', (data: { 
      timestamp: number; 
      trading_active: boolean; 
      active_subscriptions: number;
      connected_clients: number;
      server_status: string;
    }) => {
      console.log('💓 Heartbeat:', data);
      setIsConnected(true);
      setMarketStatus(prev => prev ? { ...prev, trading_active: data.trading_active } : prev);
    });

    // Fyers connection events
    socket.on('fyersConnected', (data) => {
      console.log('🔗 Fyers connected:', data);
      setError(null);
    });

    socket.on('fyersDisconnected', (data) => {
      console.log('🔗 Fyers disconnected:', data);
      setError('Fyers connection lost. Data may be delayed.');
    });

    socket.on('fyersError', (data) => {
      console.log('🔗 Fyers error:', data);
      setError(`Fyers error: ${data.message}`);
    });

    // Error events
    socket.on('error', (data: { message: string }) => {
      console.error('❌ Server error:', data);
      setError(data.message);
      setLoading(false);
    });

    return socket;
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socket = initializeSocket();
    socketRef.current = socket;

    return () => {
      console.log('🧹 Cleaning up Live Market WebSocket connection');
      
      if (subscribedCompanyCodes.current.size > 0) {
        socket.emit('unsubscribe_all', {});
      }
      
      socket.disconnect();
      socketRef.current = null;
    };
  }, [initializeSocket]);

  // FIXED: Subscribe to companies with proper data structure
  const subscribeToCompanies = useCallback((companies: Company[]) => {
    if (!socketRef.current || !isConnected) {
      setError('Not connected to server');
      return Promise.resolve(false);
    }

    console.log('🔍 Raw companies input:', companies);

    // Filter and validate companies
    const validCompanies = companies.filter((company, index) => {
      const isValid = isValidCompany(company);
      if (!isValid) {
        console.warn(`⚠️ Invalid company at index ${index}:`, company);
      }
      return isValid;
    });

    console.log('✅ Valid companies after filtering:', validCompanies);

    if (validCompanies.length === 0) {
      setError('No valid companies provided. Please check company data.');
      return Promise.resolve(false);
    }

    if (validCompanies.length > maxCompanies) {
      setError(`Maximum ${maxCompanies} companies allowed`);
      return Promise.resolve(false);
    }

    setLoading(true);
    setError(null);

    // Extract and validate company codes - THIS IS THE KEY FIX
    const companyCodes = validCompanies
      .map(company => company.company_code)
      .filter(code => isValidCompanyCode(code));

    console.log('📡 Extracted company codes for backend:', companyCodes);

    if (companyCodes.length === 0) {
      setError('No valid company codes found');
      setLoading(false);
      return Promise.resolve(false);
    }

    // Update subscribed company codes
    subscribedCompanyCodes.current = new Set(companyCodes);

    // FIXED: Send correct event name and data structure
    console.log('📡 Sending subscribe_companies event to backend:', { companyCodes });
    socketRef.current.emit('subscribe_companies', { 
      companyCodes: companyCodes 
    });

    return Promise.resolve(true);
  }, [isConnected, maxCompanies]);

  // FIXED: Subscribe by company codes with proper validation
  const subscribeByCompanyCodes = useCallback((companyCodes: string[]) => {
    if (!socketRef.current || !isConnected) {
      setError('Not connected to server');
      return Promise.resolve(false);
    }

    console.log('🔍 Raw company codes input:', companyCodes);

    // Filter and validate company codes
    const validCompanyCodes = companyCodes.filter((code, index) => {
      const isValid = isValidCompanyCode(code);
      if (!isValid) {
        console.warn(`⚠️ Invalid company code at index ${index}:`, code);
      }
      return isValid;
    });

    console.log('✅ Valid company codes after filtering:', validCompanyCodes);

    if (validCompanyCodes.length === 0) {
      setError('No valid company codes provided');
      return Promise.resolve(false);
    }

    if (validCompanyCodes.length > maxCompanies) {
      setError(`Maximum ${maxCompanies} companies allowed`);
      return Promise.resolve(false);
    }

    setLoading(true);
    setError(null);

    // Update subscribed company codes
    subscribedCompanyCodes.current = new Set(validCompanyCodes);

    // FIXED: Send correct event name and data structure
    console.log('📡 Sending subscribe_companies event to backend:', { companyCodes: validCompanyCodes });
    socketRef.current.emit('subscribe_companies', { 
      companyCodes: validCompanyCodes 
    });

    return Promise.resolve(true);
  }, [isConnected, maxCompanies]);

  // Fixed: Unsubscribe using backend format
  const unsubscribeAll = useCallback(() => {
    if (!socketRef.current || !isConnected) {
      return Promise.resolve(false);
    }

    console.log('📡 Unsubscribing from all companies');
    
    socketRef.current.emit('unsubscribe_all', {});
    
    subscribedCompanyCodes.current.clear();
    setSelectedCompanies([]);
    setMarketData({});
    setHistoricalData({});

    return Promise.resolve(true);
  }, [isConnected]);

  // Fixed: Get market status using backend event name
  const getMarketStatus = useCallback(() => {
    if (!socketRef.current || !isConnected) {
      return Promise.resolve(null);
    }

    socketRef.current.emit('get_market_status', {});
    return Promise.resolve(marketStatus);
  }, [isConnected, marketStatus]);

  // Manual reconnection
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    const socket = initializeSocket();
    socketRef.current = socket;
  }, [initializeSocket]);

  // Get current subscriptions
  const getSubscribedCompanyCodes = useCallback(() => {
    return Array.from(subscribedCompanyCodes.current);
  }, []);

  return {
    // Data
    availableCompanies,
    selectedCompanies,
    marketData,
    historicalData,
    marketStatus,
    tradingHours,
    maxCompanies,
    
    // Status
    connectionStatus,
    error,
    loading,
    isConnected,
    
    // Actions
    subscribeToCompanies,
    subscribeByCompanyCodes,
    unsubscribeAll,
    getMarketStatus,
    reconnect,
    getSubscribedCompanyCodes
  };
};

export default useLiveMarket;
