'use client';

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect, useRef } from 'react';

// Market Data Page State
export interface MarketDataState {
  selectedSymbol: string;
  selectedCompany: string | null;
  selectedExchange: string | null;
  selectedWatchlist: string;
  isAnalysisVisible: boolean;
  portfolioModeEnabled: boolean;
  showPredictions: boolean;
  predictionMode: 'overlay' | 'comparison';
  gttChartType: 'candlestick' | 'line';
  isGttEnabled: boolean;
  currentDate: string | null;
  showAllCompanies: boolean;
  isChartFullscreen: boolean;
  activeTab: 'live' | 'predictions';
  scrollPosition: number;
}

// Watchlist Page State
export interface WatchlistState {
  selectedCompany: string | null;
  selectedExchange: string | undefined;
  scrollPosition: number;
}

// Recommendations Page State
export interface RecommendationsState {
  isAnalysisVisible: boolean;
  selectedCompany: string | null;
  selectedDate: string | null;
  scrollPosition: number;
}

// Portfolio Page State
export interface PortfolioState {
  activeTab: string;
  scrollPosition: number;
}

interface PageStateContextType {
  // Market Data
  marketDataState: Partial<MarketDataState>;
  updateMarketDataState: (state: Partial<MarketDataState>) => void;
  
  // Watchlist
  watchlistState: Partial<WatchlistState>;
  updateWatchlistState: (state: Partial<WatchlistState>) => void;
  
  // Recommendations
  recommendationsState: Partial<RecommendationsState>;
  updateRecommendationsState: (state: Partial<RecommendationsState>) => void;
  
  // Portfolio
  portfolioState: Partial<PortfolioState>;
  updatePortfolioState: (state: Partial<PortfolioState>) => void;
}

const PageStateContext = createContext<PageStateContextType | undefined>(undefined);

export const PageStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [marketDataState, setMarketDataState] = useState<Partial<MarketDataState>>({});
  const [watchlistState, setWatchlistState] = useState<Partial<WatchlistState>>({});
  const [recommendationsState, setRecommendationsState] = useState<Partial<RecommendationsState>>({});
  const [portfolioState, setPortfolioState] = useState<Partial<PortfolioState>>({});

  // Debounced persist to localStorage — avoids blocking writes on every state change
  const marketDataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchlistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendationsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portfolioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Object.keys(marketDataState).length === 0) return;
    if (marketDataTimerRef.current) clearTimeout(marketDataTimerRef.current);
    marketDataTimerRef.current = setTimeout(() => {
      localStorage.setItem('marketDataState', JSON.stringify(marketDataState));
    }, 2000);
    return () => { if (marketDataTimerRef.current) clearTimeout(marketDataTimerRef.current); };
  }, [marketDataState]);

  useEffect(() => {
    if (Object.keys(watchlistState).length === 0) return;
    if (watchlistTimerRef.current) clearTimeout(watchlistTimerRef.current);
    watchlistTimerRef.current = setTimeout(() => {
      localStorage.setItem('watchlistState', JSON.stringify(watchlistState));
    }, 2000);
    return () => { if (watchlistTimerRef.current) clearTimeout(watchlistTimerRef.current); };
  }, [watchlistState]);

  useEffect(() => {
    if (Object.keys(recommendationsState).length === 0) return;
    if (recommendationsTimerRef.current) clearTimeout(recommendationsTimerRef.current);
    recommendationsTimerRef.current = setTimeout(() => {
      localStorage.setItem('recommendationsState', JSON.stringify(recommendationsState));
    }, 2000);
    return () => { if (recommendationsTimerRef.current) clearTimeout(recommendationsTimerRef.current); };
  }, [recommendationsState]);

  useEffect(() => {
    if (Object.keys(portfolioState).length === 0) return;
    if (portfolioTimerRef.current) clearTimeout(portfolioTimerRef.current);
    portfolioTimerRef.current = setTimeout(() => {
      localStorage.setItem('portfolioState', JSON.stringify(portfolioState));
    }, 2000);
    return () => { if (portfolioTimerRef.current) clearTimeout(portfolioTimerRef.current); };
  }, [portfolioState]);

  const updateMarketDataState = useCallback((newState: Partial<MarketDataState>) => {
    setMarketDataState(prev => ({ ...prev, ...newState }));
  }, []);

  const updateWatchlistState = useCallback((newState: Partial<WatchlistState>) => {
    setWatchlistState(prev => ({ ...prev, ...newState }));
  }, []);

  const updateRecommendationsState = useCallback((newState: Partial<RecommendationsState>) => {
    setRecommendationsState(prev => ({ ...prev, ...newState }));
  }, []);

  const updatePortfolioState = useCallback((newState: Partial<PortfolioState>) => {
    setPortfolioState(prev => ({ ...prev, ...newState }));
  }, []);

  // Memoize the context value so consumers only re-render when state actually changes,
  // not on every PageStateProvider render. The update fns are already stable (useCallback).
  const value = useMemo(
    () => ({
      marketDataState,
      updateMarketDataState,
      watchlistState,
      updateWatchlistState,
      recommendationsState,
      updateRecommendationsState,
      portfolioState,
      updatePortfolioState,
    }),
    [
      marketDataState,
      updateMarketDataState,
      watchlistState,
      updateWatchlistState,
      recommendationsState,
      updateRecommendationsState,
      portfolioState,
      updatePortfolioState,
    ]
  );

  return (
    <PageStateContext.Provider value={value}>
      {children}
    </PageStateContext.Provider>
  );
};

export const usePageState = () => {
  const context = useContext(PageStateContext);
  if (!context) {
    throw new Error('usePageState must be used within PageStateProvider');
  }
  return context;
};

// Hook to load persisted state from localStorage
export const usePersistedMarketDataState = () => {
  const [persistedState, setPersistedState] = useState<Partial<MarketDataState> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('marketDataState');
    if (stored) {
      try {
        setPersistedState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse persisted market data state:', e);
      }
    }
  }, []);

  return persistedState;
};

export const usePersistedWatchlistState = () => {
  const [persistedState, setPersistedState] = useState<Partial<WatchlistState> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('watchlistState');
    if (stored) {
      try {
        setPersistedState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse persisted watchlist state:', e);
      }
    }
  }, []);

  return persistedState;
};

export const usePersistedRecommendationsState = () => {
  const [persistedState, setPersistedState] = useState<Partial<RecommendationsState> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('recommendationsState');
    if (stored) {
      try {
        setPersistedState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse persisted recommendations state:', e);
      }
    }
  }, []);

  return persistedState;
};

export const usePersistedPortfolioState = () => {
  const [persistedState, setPersistedState] = useState<Partial<PortfolioState> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('portfolioState');
    if (stored) {
      try {
        setPersistedState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse persisted portfolio state:', e);
      }
    }
  }, []);

  return persistedState;
};
