'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

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

  // Persist state to localStorage on change
  useEffect(() => {
    if (Object.keys(marketDataState).length > 0) {
      localStorage.setItem('marketDataState', JSON.stringify(marketDataState));
    }
  }, [marketDataState]);

  useEffect(() => {
    if (Object.keys(watchlistState).length > 0) {
      localStorage.setItem('watchlistState', JSON.stringify(watchlistState));
    }
  }, [watchlistState]);

  useEffect(() => {
    if (Object.keys(recommendationsState).length > 0) {
      localStorage.setItem('recommendationsState', JSON.stringify(recommendationsState));
    }
  }, [recommendationsState]);

  useEffect(() => {
    if (Object.keys(portfolioState).length > 0) {
      localStorage.setItem('portfolioState', JSON.stringify(portfolioState));
    }
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

  return (
    <PageStateContext.Provider
      value={{
        marketDataState,
        updateMarketDataState,
        watchlistState,
        updateWatchlistState,
        recommendationsState,
        updateRecommendationsState,
        portfolioState,
        updatePortfolioState,
      }}
    >
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
