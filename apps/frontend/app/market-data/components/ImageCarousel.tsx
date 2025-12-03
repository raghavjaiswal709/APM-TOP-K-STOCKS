'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink, Clock, TrendingUp, TrendingDown, Minus, X, Calendar, Activity, RefreshCwOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// ✅ LSTMAE Pipeline 2 Integration
import { LSTMAEModal } from '../../components/lstmae/LSTMAEModal';
// ✅ NEW - SIPR Pattern Analysis Integration
import { SiprDashboard } from '../../components/sipr/SiprDashboard';
import { LSTMAEInteractiveDashboard } from '@/app/components/lstmae/LSTMAEInteractiveDashboard';
import { LSTMAEVisualization } from '@/app/components/lstmae/LSTMAEVisualization';
import { useLSTMAEData } from '@/hooks/useLSTMAEData';

// ✅ NEW - MSAX Integration
import { MsaxDashboard } from './msax/MsaxDashboard';

// ✅ NEW - Pre-Market API Integration
import { premarketService, PremarketHeadline } from '@/app/services/premarketService';
import {
  constructIntradayImageUrl,
  constructInterdayImageUrl,
  getTodayDateString,
  formatRelativeTime,
  formatFullDate,
  formatTimeOnly
} from '@/lib/premarketUtils';

// Base URL for on-prem server hosting the graph images
// Using the proxied path to avoid CORS issues
const ONPREM_BASE_URL = '/watchlist-graphs';

// ✅ NEW - Enhanced NewsItem with real API data
interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  timestamp: string;
  category: 'market' | 'company' | 'sector' | 'economy';
  relevance: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  imageUrl1?: string;  // Intraday chart URL
  imageUrl2?: string;  // Interday chart URL
  // ✅ NEW - Price movement data from API
  price_movement_1hr?: {
    pre: string;
    post: string;
    price_change_pct: number;
  };
  rel_vol_1hr?: number;
  price_movement_1day?: {
    pre: string;
    post: string;
    price_change_pct: number;
  };
  rel_vol_1day?: number;
}

interface NewsComponentProps {
  companyCode: string;
  isMaximized: boolean;
  gradientMode: 'profit' | 'loss' | 'neutral';
  onNewsClick?: (newsItem: NewsItem) => void;
}

interface GradientToggleProps {
  value: 'profit' | 'loss' | 'neutral';
  onChange: (value: 'profit' | 'loss' | 'neutral') => void;
}

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  newsItem: NewsItem | null;
}

// News Modal Component
const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose, newsItem }) => {
  if (!newsItem) return null;

  const getSentimentConfig = () => {
    switch (newsItem.sentiment) {
      case 'positive':
        return {
          label: 'Positive',
          color: 'text-green-400',
          bgColor: 'bg-green-500/20 border-green-500/30',
          gradientBg: 'bg-gradient-to-br from-green-900/30 via-zinc-950 to-green-900/30'
        };
      case 'negative':
        return {
          label: 'Negative',
          color: 'text-red-400',
          bgColor: 'bg-red-500/20 border-red-500/30',
          gradientBg: 'bg-gradient-to-br from-red-900/30 via-zinc-950 to-red-900/30'
        };
      case 'neutral':
      default:
        return {
          label: 'Neutral',
          color: 'text-zinc-400',
          bgColor: 'bg-zinc-500/20 border-zinc-500/30',
          gradientBg: 'bg-zinc-950'
        };
    }
  };

  const config = getSentimentConfig();

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const newsTime = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-7xl w-[95vw] h-[95vh] p-0 ${config.gradientBg} border border-zinc-700/50`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="p-6 border-b border-zinc-700/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold text-white mb-4 leading-relaxed">
                  {newsItem.headline}
                </DialogTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className={`px-3 py-1.5 rounded-md font-medium border ${config.bgColor} ${config.color}`}>
                    {config.label}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Clock className="h-4 w-4" />
                    {formatTime(newsItem.timestamp)}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Calendar className="h-4 w-4" />
                    {new Date(newsItem.timestamp).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left side - Summary */}
            <div className="w-1/3 border-r border-zinc-700/50">
              <ScrollArea className="h-full">
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
                  <p className="text-zinc-300 leading-relaxed text-base">
                    {newsItem.summary}
                  </p>

                  <div className="mt-6 pt-6 border-t border-zinc-700/50">
                    <h4 className="text-md font-semibold text-white mb-3">Details</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Category:</span>
                        <span className="text-zinc-200 capitalize">{newsItem.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Relevance:</span>
                        <span className="text-zinc-200 capitalize">{newsItem.relevance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Sentiment:</span>
                        <span className={config.color}>{config.label}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Right side - Images */}
            <div className="flex-1">
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-zinc-700/50">
                  <h3 className="text-lg font-semibold text-white">Related Charts & Analysis</h3>
                </div>
                <div className="flex-1 flex">
                  {/* First Image */}
                  <div className="w-1/2 border-r border-zinc-700/50 p-4">
                    <div className="h-full bg-zinc-900 rounded-lg border border-zinc-700/30 overflow-hidden">
                      {newsItem.imageUrl1 ? (
                        <img
                          src={newsItem.imageUrl1}
                          alt="News Chart 1"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 text-zinc-600 mx-auto mb-2" />
                            <p className="text-zinc-500">Chart Analysis 1</p>
                            <p className="text-xs text-zinc-600 mt-1">Sample financial chart</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Second Image */}
                  <div className="w-1/2 p-4">
                    <div className="h-full bg-zinc-900 rounded-lg border border-zinc-700/30 overflow-hidden">
                      {newsItem.imageUrl2 ? (
                        <img
                          src={newsItem.imageUrl2}
                          alt="News Chart 2"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <TrendingDown className="h-12 w-12 text-zinc-600 mx-auto mb-2" />
                            <p className="text-zinc-500">Chart Analysis 2</p>
                            <p className="text-xs text-zinc-600 mt-1">Sample market data</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const GradientToggle: React.FC<GradientToggleProps> = ({ value, onChange }) => {
  const modes = [
    {
      key: 'loss' as const,
      label: 'Negative',
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20 border-red-500/30'
    },
    {
      key: 'neutral' as const,
      label: 'Neutral',
      icon: Minus,
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/20 border-zinc-500/30'
    },
    {
      key: 'profit' as const,
      label: 'Positive',
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20 border-green-500/30'
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 mr-2">Headline Sentiment:</span>
      <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = value === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => onChange(mode.key)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                ${isActive
                  ? `${mode.bgColor} ${mode.color} shadow-sm`
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
                }
              `}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Component for displaying current sentiment (read-only)
interface SentimentDisplayProps {
  sentiment: 'positive' | 'negative' | 'neutral';
}

const SentimentDisplay: React.FC<SentimentDisplayProps> = ({ sentiment }) => {
  const getSentimentConfig = () => {
    switch (sentiment) {
      case 'positive':
        return { label: 'Positive', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' };
      case 'negative':
        return { label: 'Negative', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' };
      case 'neutral':
      default:
        return { label: 'Neutral', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20 border-zinc-500/30' };
    }
  };

  const config = getSentimentConfig();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 mr-2">Headline Sentiment:</span>
      <div className={`px-3 py-1.5 rounded-md text-xs font-medium border ${config.bgColor} ${config.color}`}>
        {config.label}
      </div>
    </div>
  );
};

const NewsComponent: React.FC<NewsComponentProps> = ({ companyCode, isMaximized, gradientMode, onNewsClick }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-zinc-950';
      case 'loss':
        return 'bg-zinc-950';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  const getSentimentStyling = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return {
          border: 'border-green-500/60 hover:border-green-400/80',
          background: 'hover:bg-green-500/10',
        };
      case 'negative':
        return {
          border: 'border-red-500/60 hover:border-red-400/80',
          background: 'hover:bg-red-500/10',
        };
      case 'neutral':
      default:
        return {
          border: 'border-zinc-600/50 hover:border-zinc-500/70',
          background: 'hover:bg-zinc-700/30',
        };
    }
  };

  // ✅ NEW - Convert API sentiment to UI sentiment
  const convertSentiment = (apiSentiment: string): NewsItem['sentiment'] => {
    const normalized = apiSentiment.toLowerCase();
    if (normalized.includes('positive') || normalized.includes('bullish')) return 'positive';
    if (normalized.includes('negative') || normalized.includes('bearish')) return 'negative';
    return 'neutral';
  };

  // ✅ NEW - Fetch real headlines from Pre-Market API
  const fetchHeadlines = useCallback(async () => {
    if (!companyCode) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`📰 Fetching headlines for ${companyCode}...`);
      const response = await premarketService.fetchHeadlinesCached(companyCode);

      if (!response.headlines || response.headlines.length === 0) {
        setError('No market news available for this stock');
        setNewsItems([]);
        return;
      }

      // ✅ Convert API headlines to NewsItem format
      const todayDate = getTodayDateString();
      const baseUrl = ''; // Use relative path to proxy through Next.js to NestJS backend

      const convertedNews: NewsItem[] = response.headlines.map((headline) => {
        const sentiment = convertSentiment(headline.gpt4o_sentiment);

        return {
          id: headline.id,
          headline: headline.text,
          summary: `Price movement: ${headline.price_movement_1hr?.price_change_pct?.toFixed(2) || 'N/A'}% (1hr), ${headline.price_movement_1day?.price_change_pct?.toFixed(2) || 'N/A'}% (1day)`,
          timestamp: headline.timestamp,
          category: 'company' as const,
          relevance: 'high' as const,
          sentiment,
          imageUrl1: constructIntradayImageUrl(baseUrl, companyCode, todayDate, headline.timestamp),
          imageUrl2: constructInterdayImageUrl(baseUrl, companyCode, todayDate, headline.timestamp),
          price_movement_1hr: headline.price_movement_1hr,
          rel_vol_1hr: headline.rel_vol_1hr,
          price_movement_1day: headline.price_movement_1day,
          rel_vol_1day: headline.rel_vol_1day
        };
      });

      setNewsItems(convertedNews);
      console.log(`✅ Loaded ${convertedNews.length} headlines for ${companyCode}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load market news';
      console.error(`❌ Error fetching headlines:`, err);
      setError(errorMessage);
      setNewsItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [companyCode]);

  useEffect(() => {
    if (companyCode) {
      fetchHeadlines();
    } else {
      setNewsItems([]);
      setError(null);
    }
  }, [companyCode, fetchHeadlines]);

  const handleNewsClick = (newsItem: NewsItem) => {
    if (onNewsClick) {
      onNewsClick(newsItem);
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const newsTime = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (!companyCode) {
    return (
      <Card className={`${getGradientClass(gradientMode)} shadow-lg ${isMaximized ? 'h-full' : 'h-[800px]'}`}>
        <CardHeader className="p-4 border-b border-zinc-700">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center text-zinc-400">
            Select a company to view relevant news
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${getGradientClass(gradientMode)} shadow-lg ${isMaximized ? 'h-full' : 'h-auto'} border border-zinc-700/50`}>
      <CardHeader className="p-4 border-b border-zinc-700/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            {companyCode} News Feed
          </CardTitle>
          {!isLoading && !error && newsItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchHeadlines}
              className="text-zinc-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[900px]'} w-full`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Loading market news...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <p className="text-red-400 text-sm font-medium">Failed to load news</p>
                <p className="text-zinc-500 text-xs">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHeadlines}
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          ) : newsItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-zinc-400">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
                <p className="text-sm">No market news available</p>
                <p className="text-xs text-zinc-600 mt-1">Check back later</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {newsItems.map((newsItem) => {
                const sentimentStyling = getSentimentStyling(newsItem.sentiment);
                return (
                  <div
                    key={newsItem.id}
                    onClick={() => handleNewsClick(newsItem)}
                    className={`
                    group cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 shadow-lg
                    ${sentimentStyling.border} ${sentimentStyling.background}
                    hover:shadow-xl
                  `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                      </div>
                    </div>
                    <h3 className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors duration-200 flex items-start gap-2">
                      {newsItem.headline}
                      <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-0.5" />
                    </h3>
                    <div className="mt-3 pt-3 border-t border-zinc-700/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">
                            Sentiment: {newsItem.sentiment}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" />
                          {formatTime(newsItem.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const ACTUAL_INDICES = [
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'AUTONIFTY',
  'PHARMANIFTY', 'METALNIFTY', 'ENERGYNIFTY', 'INFRA', 'GROWTHSECT',
  'NIFTYALPHA', 'NIFTYCOMM', 'NIFTYCONS', 'NIFTYCPSE', 'NIFTYENER',
  'NIFTYFIN', 'NIFTYFMCG', 'NIFTYHEAL', 'NIFTYIND', 'NIFTYINFRA',
  'NIFTYIT', 'NIFTYMED', 'NIFTYMET', 'NIFTYMIC', 'NIFTYNSE',
  'NIFTYOIL', 'NIFTYPVT', 'NIFTYPSU', 'NIFTYREAL', 'NIFTYSML',
  'NIFTYCONS', 'NIFTYAUTO', 'NIFTYPHAR', 'NIFTYPSB', 'NIFTYPVT',
  'NIFTY100', 'NIFTY200', 'NIFTY500', 'NIFTYMID', 'NIFTYNXT',
  'NIFTYSML', 'NIFTYTOT', 'NIFTYDIV', 'NIFTY50', 'NIFTYQUALITY30'
];

interface ImageCarouselProps {
  companyCode: string;
  exchange: string;
  selectedDate?: Date | string; // Accept both Date and string to avoid timezone issues
  gradientMode: 'profit' | 'loss' | 'neutral';
  onGradientModeChange: (mode: 'profit' | 'loss' | 'neutral') => void;
  onSentimentLoadingChange?: (loading: boolean) => void;
  isHistoricalMode?: boolean; // NEW - Enable time machine mode
  disabledTabs?: string[]; // NEW - Tab filter
}

interface CarouselImage {
  src: string;
  name: string;
  type: string;
  chartType: 'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX';
  exists: boolean;
  dimensions?: { width: number; height: number };
}

interface ChartTabsProps {
  activeTab: 'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX' | null;
  onTabChange: (tab: 'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX') => void;
  intradayCount: number;
  interdayCount: number;
  lstmaeCount: number;
  siprCount: number;
  msaxCount: number;
}

// ✅ MODIFIED: ChartTabs now always visible, no conditional rendering
const ChartTabs: React.FC<ChartTabsProps> = ({
  activeTab,
  onTabChange,
  intradayCount,
  interdayCount,
  lstmaeCount,
  siprCount,
  msaxCount
}) => {
  const tabs = [
    { key: 'intraday' as const, label: 'Intraday', count: intradayCount, showCount: true, disabled: false },
    { key: 'interday' as const, label: 'Interday', count: interdayCount, showCount: true, disabled: false },
    { key: 'LSTMAE' as const, label: 'LSTMAE', count: lstmaeCount, showCount: false, disabled: false },
    { key: 'SiPR' as const, label: 'SiPR', count: siprCount, showCount: false, disabled: false },
    { key: 'MSAX' as const, label: 'MSAX', count: msaxCount, showCount: false, disabled: false }
  ];

  return (
    <div className="flex justify-between gap-1 bg-zinc-800 rounded-lg p-1 border border-zinc-700 w-auto">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-all duration-200
              ${isActive
                ? 'bg-blue-500/20 text-blue-400 border shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              }
            `}
          >
            {tab.label}
            {tab.showCount && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-500/30' : 'bg-zinc-600'
                }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ✅ NEW COMPONENT: Inline LSTMAE Content (without modal wrapper)
// ✅ FIXED: Inline LSTMAE Content (renders actual dashboard content without modal wrapper)
interface InlineLSTMAEContentProps {
  companyCode: string;
  exchange: string;
}

const InlineLSTMAEContent: React.FC<InlineLSTMAEContentProps> = ({ companyCode, exchange }) => {
  const { dashboard, plotUrls, health, loading, error, refresh } = useLSTMAEData(
    companyCode,
    'spectral',
    true,  // isOpen = true
    true   // enableCache = true
  );

  return (
    <div className="w-full h-full bg-zinc-900 rounded-lg p-4">
      <ScrollArea className="h-full">
        <div className="space-y-6">
          {/* Health Status */}
          {health && (
            <div className="flex items-center justify-between">
              <span
                className={`text-xs px-2 py-1 rounded ${health.status === 'healthy'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
                  }`}
              >
                {health.status === 'healthy' ? '✓ Service Healthy' : '⚠ Degraded'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading === 'loading'}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading === 'loading' ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          )}

          {/* Error Display */}
          {/* {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{error.code}:</strong> {error.message}
                {error.suggestion && <p className="mt-1 text-sm">{error.suggestion}</p>}
              </AlertDescription>
            </Alert>
          )} */}

          {/* Loading State */}
          {loading === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                <p className="text-lg font-medium text-white">Generating Dashboard...</p>
              </div>
            </div>
          )}

          {/* Dashboard Content */}
          {(dashboard || plotUrls) && !error && loading !== 'loading' && (
            <>
              <LSTMAEVisualization dashboard={dashboard || undefined} plotUrls={plotUrls || undefined} />

              {dashboard?.dashboardPath && (
                <LSTMAEInteractiveDashboard
                  dashboardPath={dashboard.dashboardPath}
                  symbol={companyCode}
                />
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};


// ✅ NEW COMPONENT: Inline SIPR Content (without modal wrapper)
interface InlineSiprContentProps {
  companyCode: string;
  exchange: string;
  months: number;
}

const InlineSiprContent: React.FC<InlineSiprContentProps> = ({ companyCode, exchange, months }) => {
  return (
    <div className="w-full h-full">
      <SiprDashboard
        companyCode={`${companyCode}_${exchange}`}
        months={months}
        className="h-full"
      />
    </div>
  );
};

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  companyCode,
  exchange,
  selectedDate,
  gradientMode = 'neutral',
  onGradientModeChange,
  onSentimentLoadingChange,
  isHistoricalMode = false,
  disabledTabs = []
}) => {
  // ✅ NEW - activeIndex is now the Master controller (linked to news selection)
  const [activeIndex, setActiveIndex] = useState(0);
  const [allImages, setAllImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX' | null>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // ✅ NEW - Filter available tabs based on historical mode
  const availableTabs = useMemo(() => {
    const allTabs = ['intraday' as const, 'interday' as const, 'LSTMAE' as const, 'SiPR' as const, 'MSAX' as const];
    if (isHistoricalMode) {
      // In historical mode, only show intraday and interday
      return allTabs.filter(tab => ['intraday', 'interday'].includes(tab));
    }
    // Filter out any explicitly disabled tabs
    return allTabs.filter(tab => !disabledTabs.includes(tab));
  }, [isHistoricalMode, disabledTabs]);

  // ✅ NEW - Real news data from Pre-Market API (Master data source)
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [isWeekendFallback, setIsWeekendFallback] = useState(false);

  // State for news modal
  const [selectedNewsItem, setSelectedNewsItem] = useState<NewsItem | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  // ✅ LSTMAE Pipeline 2 Modal
  const [isLSTMAEModalOpen, setIsLSTMAEModalOpen] = useState(false);

  // ✅ NEW - SIPR Pattern Analysis Modal State
  const [isSiprModalOpen, setIsSiprModalOpen] = useState(false);
  const [siprMonths, setSiprMonths] = useState(3);

  // ✅ NEW - Convert API sentiment to UI sentiment
  const convertSentiment = useCallback((apiSentiment: string): NewsItem['sentiment'] => {
    const normalized = apiSentiment.toLowerCase();
    if (normalized.includes('positive') || normalized.includes('bullish')) return 'positive';
    if (normalized.includes('negative') || normalized.includes('bearish')) return 'negative';
    return 'neutral';
  }, []);

  // ✅ NEW - Fetch real headlines from Pre-Market API (Master data source)
  const fetchNewsData = useCallback(async () => {
    if (!companyCode) {
      setNewsData([]);
      setNewsError(null);
      return;
    }

    setNewsLoading(true);
    setNewsError(null);
    if (onSentimentLoadingChange) onSentimentLoadingChange(true);

    try {
      console.log(`📰 [CAROUSEL] Fetching headlines for ${companyCode}...`);

      // ✅ 1. Date Logic (The Weekend Trap)
      const getMarketDate = () => {
        const today = new Date();
        const day = today.getDay(); // 0 = Sunday, 6 = Saturday
        let targetDate = today;
        let isFallback = false;

        if (day === 0) { // Sunday
          targetDate = new Date(today);
          targetDate.setDate(today.getDate() - 2); // Friday
          isFallback = true;
        } else if (day === 6) { // Saturday
          targetDate = new Date(today);
          targetDate.setDate(today.getDate() - 1); // Friday
          isFallback = true;
        }

        // Format YYYY-MM-DD
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const date = String(targetDate.getDate()).padStart(2, '0');

        return { dateString: `${year}-${month}-${date}`, isFallback };
      };

      const { dateString, isFallback } = getMarketDate();
      setIsWeekendFallback(isFallback);
      console.log(`📅 Market Date: ${dateString} (Fallback: ${isFallback})`);

      // Fetch headlines and charts in parallel
      const [headlinesResponse, chartsResponse] = await Promise.all([
        premarketService.fetchHeadlinesCached(companyCode),
        premarketService.listCharts(companyCode, dateString).catch(err => {
          console.error('Failed to fetch charts list:', err);
          return null;
        })
      ]);

      if (!headlinesResponse.headlines || headlinesResponse.headlines.length === 0) {
        setNewsError('No market news available for this stock');
        setNewsData([]);
        setActiveIndex(0);
        return;
      }

      // ✅ Convert API headlines to NewsItem format with image URLs
      const apiBaseUrl = 'http://100.93.172.21:5717'; // Direct API URL for charts

      const convertedNews: NewsItem[] = headlinesResponse.headlines.map((headline) => {
        const sentiment = convertSentiment(headline.gpt4o_sentiment);

        // Find matching chart from the list if available
        let intradayUrl = '';
        let interdayUrl = '';

        if (chartsResponse) {
          // Helper to construct correct URL from file path
          const constructUrlFromPath = (filePath: string) => {
            // Extract filename from path (e.g., /nas1/.../20251119_105500_interday.png -> 20251119_105500_interday.png)
            const filename = filePath.split('/').pop();
            if (!filename) return '';
            // Construct URL: http://100.93.172.21:5717/api/premarket/charts/{STOCK}/{DATE}/{FILENAME}
            return `${apiBaseUrl}/api/premarket/charts/${companyCode}/${dateString}/${filename}`;
          };

          if (chartsResponse.intraday_charts && chartsResponse.intraday_charts.length > 0) {
            // Use the last chart in the list (most recent)
            const chartPath = chartsResponse.intraday_charts[chartsResponse.intraday_charts.length - 1];
            intradayUrl = constructUrlFromPath(chartPath);
            console.log(`🔗 Constructed Intraday URL: ${intradayUrl}`);
          }

          if (chartsResponse.interday_charts && chartsResponse.interday_charts.length > 0) {
            const chartPath = chartsResponse.interday_charts[chartsResponse.interday_charts.length - 1];
            interdayUrl = constructUrlFromPath(chartPath);
            console.log(`🔗 Constructed Interday URL: ${interdayUrl}`);
          }
        }

        // Fallback to existing construction if no charts found in list (or list failed)
        if (!intradayUrl) {
          intradayUrl = constructIntradayImageUrl('', companyCode, dateString, headline.timestamp);
        }
        if (!interdayUrl) {
          interdayUrl = constructInterdayImageUrl('', companyCode, dateString, headline.timestamp);
        }

        return {
          id: headline.id,
          headline: headline.text,
          summary: `Price movement: ${headline.price_movement_1hr?.price_change_pct?.toFixed(2) || 'N/A'}% (1hr), ${headline.price_movement_1day?.price_change_pct?.toFixed(2) || 'N/A'}% (1day)`,
          timestamp: headline.timestamp,
          category: 'company' as const,
          relevance: 'high' as const,
          sentiment,
          imageUrl1: intradayUrl,
          imageUrl2: interdayUrl,
          price_movement_1hr: headline.price_movement_1hr,
          rel_vol_1hr: headline.rel_vol_1hr,
          price_movement_1day: headline.price_movement_1day,
          rel_vol_1day: headline.rel_vol_1day
        };
      });

      setNewsData(convertedNews);
      setActiveIndex(0); // Reset to first news item
      console.log(`✅ [CAROUSEL] Loaded ${convertedNews.length} headlines for ${companyCode}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load market news';
      console.error(`❌ [CAROUSEL] Error fetching headlines:`, err);
      setNewsError(errorMessage);
      setNewsData([]);
      setActiveIndex(0);
    } finally {
      setNewsLoading(false);
      if (onSentimentLoadingChange) onSentimentLoadingChange(false);
    }
  }, [companyCode, convertSentiment]);

  // ✅ Fetch news data when company changes
  useEffect(() => {
    fetchNewsData();
  }, [fetchNewsData]);

  // ✅ NEW - Handle news click (Master controls images)
  const handleNewsClick = useCallback((newsItem: NewsItem) => {
    const newsIndex = newsData.findIndex(item => item.id === newsItem.id);
    if (newsIndex !== -1) {
      setActiveIndex(newsIndex);
      setIsMaximized(true);
      console.log(`🎯 [MASTER-SLAVE] News selected: ${newsItem.headline} (Index: ${newsIndex})`);
    }
  }, [newsData]);

  // Close news modal
  const handleCloseNewsModal = () => {
    setIsNewsModalOpen(false);
    setSelectedNewsItem(null);
  };

  // Helper function to get sentiment styling for maximized headlines
  const getSentimentStyling = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return {
          border: 'border-green-500/60',
          background: 'bg-green-500/10',
        };
      case 'negative':
        return {
          border: 'border-red-500/60',
          background: 'bg-red-500/10',
        };
      case 'neutral':
      default:
        return {
          border: 'border-zinc-600/50',
          background: 'bg-zinc-700/30',
        };
    }
  };

  // ✅ MODIFIED - Current news item (Master)
  const currentNews = useMemo(() => {
    return newsData[activeIndex] || null;
  }, [newsData, activeIndex]);

  // ✅ NEW - Sync sentiment with parent component (Description Panel)
  useEffect(() => {
    if (onGradientModeChange) {
      let newMode: 'profit' | 'loss' | 'neutral' = 'neutral';

      if (currentNews) {
        if (currentNews.sentiment === 'positive') newMode = 'profit';
        else if (currentNews.sentiment === 'negative') newMode = 'loss';
      }

      // Only update if different to avoid loops/unnecessary renders
      if (gradientMode !== newMode) {
        console.log(`🎨 [SENTIMENT SYNC] Updating gradient mode to: ${newMode} (News: ${currentNews?.headline || 'None'})`);
        onGradientModeChange(newMode);
      }
    }
  }, [currentNews, onGradientModeChange, gradientMode]);

  const filteredImages = useMemo(() => {
    return allImages.filter(image => image.chartType === activeTab);
  }, [allImages, activeTab]);

  const intradayCount = useMemo(() => {
    return newsData.length;
  }, [newsData]);

  const interdayCount = useMemo(() => {
    return newsData.length;
  }, [newsData]);

  const lstmaeCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'LSTMAE').length;
  }, [allImages]);

  const siprCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'SiPR').length;
  }, [allImages]);

  const msaxCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'MSAX').length;
  }, [allImages]);

  const intradayImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'intraday');
  }, [allImages]);

  const interdayImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'interday');
  }, [allImages]);

  const lstmaeImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'LSTMAE');
  }, [allImages]);

  const siprImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'SiPR');
  }, [allImages]);

  const msaxImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'MSAX');
  }, [allImages]);

  // ✅ Reset activeIndex when tab changes (but keep news selection)
  // activeIndex stays the same, only the displayed image type changes

  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-gradient-to-br from-green-900 via-zinc-950 to-green-900';
      case 'loss':
        return 'bg-gradient-to-br from-red-900 via-zinc-950 to-red-900';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  // Function for maximized view background based on current headline sentiment
  const getMaximizedBackgroundClass = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return 'bg-gradient-to-br from-green-900 via-zinc-950 to-green-900';
      case 'negative':
        return 'bg-gradient-to-br from-red-900 via-zinc-950 to-red-900';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  const getCurrentDateString = useCallback(() => {
    // Handle selectedDate properly to avoid timezone issues
    let dateStr: string;

    if (typeof selectedDate === 'string') {
      // Already a string in YYYY-MM-DD format - use it directly
      dateStr = selectedDate;
    } else if (selectedDate instanceof Date) {
      // Convert Date to YYYY-MM-DD using local time (not UTC)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      // Fallback to current date using local time
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }

    return dateStr;
  }, [selectedDate]);

  // Generate image paths with Pipeline 2 Integration
  const generateImagePaths = useCallback(() => {
    if (!companyCode || !exchange) return [];

    const dateString = getCurrentDateString();
    const companyExchange = `${companyCode}_${exchange}`;
    const imageList: CarouselImage[] = [];

    // Pattern 1: N1 Pattern Plot
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/N1_Pattern_Plot/360ONE_NSE/360ONE_NSE_interday.png
    const pattern1Path = `${ONPREM_BASE_URL}/${dateString}/N1_Pattern_Plot/${companyExchange}/${companyExchange}_interday.png`;
    imageList.push({
      src: pattern1Path,
      name: `${companyCode} Combined Overlay`,
      type: 'N1 Pattern Analysis',
      chartType: 'interday',
      exists: false
    });

    // Pattern 2: Watchlist Comparison - Confusion Heatmaps
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/watchlist_comp_ind_90d_analysis_plot/360ONE_NSE_2025-05-08/360ONE_NIFTY50_No_category_confusion_heatmap.png
    ACTUAL_INDICES.forEach(index => {
      // Try multiple category variations
      ['intraday', 'Yes', 'No'].forEach(category => {
        const pattern2Path = `${ONPREM_BASE_URL}/${dateString}/watchlist_comp_ind_90d_analysis_plot/${companyExchange}_${dateString}/${companyCode}_${index}_${category}${category === 'intraday' ? '' : '_category_confusion_heatmap'}.png`;
        imageList.push({
          src: pattern2Path,
          name: `${companyCode} ${index} ${category} Analysis`,
          type: 'Confusion Heatmap',
          chartType: 'intraday',
          exists: false
        });
      });
    });

    // LSTMAE images - Pipeline 2 Integration
    // Use API endpoints instead of filesystem paths
    const lstmaeBaseUrl = `/api/lstmae/${companyCode}/plot`;

    // 4 Static PNG Visualizations
    const lstmaeVisualizations = [
      {
        endpoint: 'dominant_patterns',
        name: `${companyCode} Dominant Patterns`,
        type: 'Pattern Timeline & Strength Analysis',
        dimensions: { width: 1200, height: 800 }
      },
      {
        endpoint: 'intraday', // Maps to 'intraday_patterns' in backend/python
        name: `${companyCode} Intraday Patterns`,
        type: 'Median Price Movement Clusters',
        dimensions: { width: 1400, height: 1200 }
      },
      {
        endpoint: 'cluster_transitions',
        name: `${companyCode} Cluster Transitions`,
        type: 'Network Graph - Transition Probabilities',
        dimensions: { width: 1200, height: 800 }
      },
      {
        endpoint: 'cluster_timeline',
        name: `${companyCode} Cluster Timeline`,
        type: 'Temporal Cluster Assignment Scatter',
        dimensions: { width: 1200, height: 800 }
      }
    ];

    lstmaeVisualizations.forEach(viz => {
      imageList.push({
        src: `${lstmaeBaseUrl}/${viz.endpoint}`,
        name: viz.name,
        type: viz.type,
        chartType: 'LSTMAE',
        exists: false,
        dimensions: viz.dimensions
      });
    });

    // ✅ NEW - SiPR images (Pattern Analysis visualizations)
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/SiPR_Analysis/360ONE_NSE/360ONE_NSE_top3_patterns.png
    const siprBasePath = `${ONPREM_BASE_URL}/${dateString}/SiPR_Analysis/${companyExchange}`;

    const siprVisualizations = [
      {
        filename: `${companyExchange}_top3_patterns.png`,
        name: `${companyCode} Top 3 Patterns`,
        type: 'Most Recurring Pattern Analysis'
      },
      {
        filename: `${companyExchange}_time_series_segmentation.png`,
        name: `${companyCode} Time Series Segmentation`,
        type: 'Temporal Segmentation with Cluster Labels'
      },
      {
        filename: `${companyExchange}_pattern_cluster.png`,
        name: `${companyCode} Pattern Clusters`,
        type: 'Cluster Distribution & Silhouette Analysis'
      },
      {
        filename: `${companyExchange}_centroid_shapes.png`,
        name: `${companyCode} Centroid Shapes`,
        type: 'Representative Pattern Shapes'
      }
    ];

    siprVisualizations.forEach(viz => {
      imageList.push({
        src: `${siprBasePath}/${viz.filename}`,
        name: viz.name,
        type: viz.type,
        chartType: 'SiPR',
        exists: false
      });
    });

    // MSAX images
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/MSAX_Analysis/360ONE_NSE/360ONE_NSE_MSAX_multi.png
    const msaxPath = `${ONPREM_BASE_URL}/${dateString}/MSAX_Analysis/${companyExchange}/${companyExchange}_MSAX_multi.png`;
    imageList.push({
      src: msaxPath,
      name: `${companyCode} Multi-Scale Analysis`,
      type: 'MSAX Multi-Scale',
      chartType: 'MSAX',
      exists: false
    });

    const msaxPath2 = `${ONPREM_BASE_URL}/${dateString}/MSAX_Analysis/${companyExchange}/${companyExchange}_MSAX_correlation.png`;
    imageList.push({
      src: msaxPath2,
      name: `${companyCode} Correlation Matrix`,
      type: 'MSAX Correlation Analysis',
      chartType: 'MSAX',
      exists: false
    });

    return imageList;
  }, [companyCode, exchange, getCurrentDateString]);

  const checkImageExists = useCallback(async (imageSrc: string): Promise<{ exists: boolean; dimensions?: { width: number; height: number } }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          exists: true,
          dimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        });
      };
      img.onerror = () => resolve({ exists: false });
      img.src = imageSrc;
    });
  }, []);

  // ✅ Reset state when company changes
  useEffect(() => {
    setActiveTab(null);
    setAllImages([]);
    setImagesLoaded(false);
  }, [companyCode]);

  useEffect(() => {
    const loadImages = async () => {
      if (imagesLoaded) return; // Prevent double loading

      setIsLoading(true);
      try {
        const imageList = generateImagePaths();
        const validatedImages = await Promise.all(
          imageList.map(async (image) => {
            const result = await checkImageExists(image.src);
            return {
              ...image,
              exists: result.exists,
              dimensions: result.dimensions
            };
          })
        );
        const existingImages = validatedImages.filter(img => img.exists);
        setAllImages(existingImages);
        setImagesLoaded(true);
      } catch (error) {
        console.error('Error loading images:', error);
        setAllImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    // ✅ Only load images if a tab is selected AND we haven't loaded them yet
    if (companyCode && exchange && activeTab && !imagesLoaded && !isLoading) {
      loadImages();
    }
  }, [companyCode, exchange, activeTab, imagesLoaded, isLoading, generateImagePaths, checkImageExists]);

  // ✅ NEW - Navigation controls activeIndex (which controls both news and images)
  const handleNext = useCallback(() => {
    if (newsData.length === 0) return;
    const nextIndex = (activeIndex + 1) % newsData.length;
    setActiveIndex(nextIndex);
    // Trigger loading state for new images
    setImageLoading(prev => ({
      ...prev,
      [`intraday-${nextIndex}`]: true,
      [`interday-${nextIndex}`]: true,
      [`intraday-max-${nextIndex}`]: true,
      [`interday-max-${nextIndex}`]: true
    }));
    console.log(`➡️ [NAVIGATION] Next news item (${nextIndex}/${newsData.length})`);
  }, [newsData.length, activeIndex]);

  const handlePrevious = useCallback(() => {
    if (newsData.length === 0) return;
    const prevIndex = (activeIndex - 1 + newsData.length) % newsData.length;
    setActiveIndex(prevIndex);
    // Trigger loading state for new images
    setImageLoading(prev => ({
      ...prev,
      [`intraday-${prevIndex}`]: true,
      [`interday-${prevIndex}`]: true,
      [`intraday-max-${prevIndex}`]: true,
      [`interday-max-${prevIndex}`]: true
    }));
    console.log(`⬅️ [NAVIGATION] Previous news item (${prevIndex}/${newsData.length})`);
  }, [newsData.length, activeIndex]);

  // ✅ Image loading handlers
  const handleImageLoad = useCallback((key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: false }));
  }, []);

  const handleImageLoadStart = useCallback((key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: true }));
  }, []);

  const handleImageError = useCallback((key: string) => {
    setImageLoading(prev => ({ ...prev, [key]: false }));
    console.warn(`⚠️ [IMAGE] Failed to load image: ${key}`);
  }, []);

  // ✅ Keyboard navigation for news items
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!companyCode || !exchange || newsData.length === 0) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNext, handlePrevious, companyCode, exchange, newsData.length]);

  // ✅ MODIFIED - Function to render maximized view with Pre-Market charts and dashboards
  const renderMaximizedImages = () => {
    // ✅ For intraday/interday tabs, show Pre-Market API charts (like non-maximized view)
    if (activeTab === 'intraday' || activeTab === 'interday') {
      return (
        <div className="h-[calc(100vh-200px)] w-full flex flex-col">
          {newsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                <p className="text-zinc-400">Loading market news...</p>
              </div>
            </div>
          ) : newsError || !currentNews ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <p className="text-zinc-400 mb-2">
                  {newsError || 'No market news available'}
                </p>
                <p className="text-sm text-zinc-500">
                  Select a company to view analysis charts
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchNewsData}
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Pre-Market API Charts */}
              <div className="flex-1 flex">
                {/* Intraday Chart (Left) */}
                <div className="w-1/2 border-r border-zinc-700/50 p-4">
                  <div className="relative h-full overflow-hidden rounded-lg">
                    <div className="absolute top-2 left-2 bg-zinc-900/80 backdrop-blur-sm rounded px-3 py-1.5 z-10">
                      <p className="text-sm text-zinc-300 font-medium">Intraday Analysis</p>
                    </div>
                    {imageLoading[`intraday-max-${activeIndex}`] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      </div>
                    )}
                    {currentNews.imageUrl1 ? (
                      <img
                        src={currentNews.imageUrl1}
                        alt={`${companyCode} Intraday Chart`}
                        className="w-full h-full object-contain"
                        onLoadStart={() => handleImageLoadStart(`intraday-max-${activeIndex}`)}
                        onLoad={() => handleImageLoad(`intraday-max-${activeIndex}`)}
                        onError={(e) => {
                          handleImageError(`intraday-max-${activeIndex}`);
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzI3MjcyNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DaGFydCBHZW5lcmF0aW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <TrendingUp className="h-16 w-16 text-zinc-600 mx-auto mb-3" />
                          <p className="text-zinc-500">Chart Generating...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interday Chart (Right) */}
                <div className="w-1/2 p-4">
                  <div className="relative h-full overflow-hidden rounded-lg">
                    <div className="absolute top-2 left-2 bg-zinc-900/80 backdrop-blur-sm rounded px-3 py-1.5 z-10">
                      <p className="text-sm text-zinc-300 font-medium">Interday Analysis</p>
                    </div>
                    {imageLoading[`interday-max-${activeIndex}`] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      </div>
                    )}
                    {currentNews.imageUrl2 ? (
                      <img
                        src={currentNews.imageUrl2}
                        alt={`${companyCode} Interday Chart`}
                        className="w-full h-full object-contain"
                        onLoadStart={() => handleImageLoadStart(`interday-max-${activeIndex}`)}
                        onLoad={() => handleImageLoad(`interday-max-${activeIndex}`)}
                        onError={(e) => {
                          handleImageError(`interday-max-${activeIndex}`);
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzI3MjcyNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DaGFydCBHZW5lcmF0aW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <TrendingDown className="h-16 w-16 text-zinc-600 mx-auto mb-3" />
                          <p className="text-zinc-500">Chart Generating...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* News headline and metadata display with sentiment-based background */}
              <div className={`p-6 border-t ${currentNews.sentiment === 'positive' ? 'border-green-700/50 bg-green-950/40' :
                currentNews.sentiment === 'negative' ? 'border-red-700/50 bg-red-950/40' :
                  'border-zinc-700/50 bg-zinc-800/50'
                }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl text-white font-medium mb-3">{currentNews.headline}</h3>
                    <div className="flex items-center gap-4 text-sm text-zinc-400">
                      <span className={`px-3 py-1.5 rounded ${currentNews.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                        currentNews.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                          'bg-zinc-500/20 text-zinc-400'
                        }`}>
                        {currentNews.sentiment.toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {formatRelativeTime(currentNews.timestamp)}
                      </span>
                      {currentNews.price_movement_1hr && (
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4" />
                          1hr: {currentNews.price_movement_1hr.price_change_pct.toFixed(2)}%
                        </span>
                      )}
                      {currentNews.price_movement_1day && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          1day: {currentNews.price_movement_1day.price_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-lg text-zinc-400 font-medium">
                    {activeIndex + 1} / {newsData.length}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    // ✅ For LSTMAE/SIPR/MSAX tabs, show the original carousel images
    let leftImages: CarouselImage[] = [];
    let rightImages: CarouselImage[] = [];
    let leftTitle = '';
    let rightTitle = '';
    let showLSTMAEButton = false;
    let showSiprButton = false;

    switch (activeTab) {
      case 'LSTMAE':
        leftImages = lstmaeImages;
        rightImages = [...siprImages, ...msaxImages];
        leftTitle = 'LSTM AutoEncoder - Pipeline 2';
        rightTitle = 'SiPR & MSAX Analysis';
        showLSTMAEButton = true;
        break;
      case 'SiPR':
        leftImages = siprImages;
        rightImages = [...lstmaeImages, ...msaxImages];
        leftTitle = 'SiPR Pattern Analysis';
        rightTitle = 'LSTMAE & MSAX Analysis';
        showSiprButton = true;
        break;
      case 'MSAX':
        leftImages = msaxImages;
        rightImages = [...lstmaeImages, ...siprImages];
        leftTitle = 'Multi-Scale Analysis';
        rightTitle = 'LSTMAE & SiPR Analysis';
        break;
    }

    return (
      <div className="h-[100vh] w-full mt-8">
        <div className="flex h-[100%]">
          {/* Left side images */}
          <div className="w-1/2 border-r border-zinc-700/50">
            <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{leftTitle}</h3>

              {/* ✅ Show "Open Full Dashboard" button for LSTMAE tab - ALWAYS VISIBLE */}
              {showLSTMAEButton && (
                <Button
                  onClick={() => setIsLSTMAEModalOpen(true)}
                  size="sm"
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open LSTMAE Dashboard
                </Button>
              )}

              {/* ✅ NEW - Show "Open SIPR Dashboard" button for SiPR tab - ALWAYS VISIBLE */}
              {showSiprButton && (
                <div className="flex items-center gap-2">
                  <select
                    value={siprMonths}
                    onChange={(e) => setSiprMonths(Number(e.target.value))}
                    className="px-2 py-1 text-sm rounded bg-zinc-700 text-white border border-zinc-600"
                  >
                    {[1, 2, 3, 6, 9, 12].map(m => (
                      <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => setIsSiprModalOpen(true)}
                    size="sm"
                    className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Activity className="h-4 w-4" />
                    Open SIPR Dashboard
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {leftImages.map((image, index) => (
                  <div key={index}>
                    <div className="relative overflow-hidden rounded-lg bg-zinc-900 border border-zinc-700/30">
                      {imageLoading[`left-${index}`] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                      )}
                      <img
                        src={image.src}
                        alt={image.name}
                        className="w-full h-auto block"
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block'
                        }}
                        onLoadStart={() => handleImageLoadStart(`left-${index}` as any)}
                        onLoad={() => handleImageLoad(`left-${index}` as any)}
                        onError={() => handleImageLoad(`left-${index}` as any)}
                      />
                      <div className="absolute bottom-2 left-2 bg-zinc-900/80 backdrop-blur-sm rounded px-2 py-1">
                        <p className="text-xs text-zinc-300">{image.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {leftImages.length === 0 && (
                  <div className="text-center text-zinc-500 py-8">
                    No {leftTitle.toLowerCase()} images found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right side images */}
          <div className="w-1/2">
            <div className="p-4 border-b border-zinc-700/50">
              <h3 className="text-lg font-semibold text-white">{rightTitle}</h3>
            </div>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {rightImages.map((image, index) => (
                  <div key={index}>
                    <div className="relative overflow-hidden rounded-lg bg-zinc-900 border border-zinc-700/30">
                      {imageLoading[`right-${index}`] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                      )}
                      <img
                        src={image.src}
                        alt={image.name}
                        className="w-full h-auto block"
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block'
                        }}
                        onLoadStart={() => handleImageLoadStart(`right-${index}` as any)}
                        onLoad={() => handleImageLoad(`right-${index}` as any)}
                        onError={() => handleImageLoad(`right-${index}` as any)}
                      />
                      <div className="absolute bottom-2 left-2 bg-zinc-900/80 backdrop-blur-sm rounded px-2 py-1">
                        <p className="text-xs text-zinc-300">{image.name}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {rightImages.length === 0 && (
                  <div className="text-center text-zinc-500 py-8">
                    No {rightTitle.toLowerCase()} images found
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  };

  if (!companyCode || !exchange) {
    return null;
  }

  return (
    <>
      <div className={`flex gap-4 ${isMaximized ? 'fixed inset-4 z-50' : 'w-full'}`}>
        {/* Main Image Carousel */}
        <Card className={`shadow-lg border border-zinc-700/50 ${isMaximized
          ? `${getMaximizedBackgroundClass(currentNews?.sentiment || 'neutral')} w-full`
          : `${getGradientClass(gradientMode)} w-3/4`
          }`}>
          <CardHeader className="flex flex-row items-center justify-between p-1 border-b border-zinc-700/50">
            {/* Left side - Title and Counter Navigation */}
            <div className="flex items-center gap-4 mx-2 flex-1">
              <CardTitle className="text-base font-semibold text-white">
                {companyCode} - Headline Analysis
                {isWeekendFallback && (
                  <div className="-ml-1 text-xs font-normal text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-700/50">
                    Showing image for last market day
                  </div>
                )}
              </CardTitle>

              {/* ✅ NEW - Navigation Controls (always visible when news data available) */}
              {newsData.length > 0 && !newsLoading && (
                <div className="flex items-center gap-1 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-8 w-8 p-0"
                    disabled={newsData.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-zinc-400 px-2 min-w-[60px] text-center">
                    {activeIndex + 1} / {newsData.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 w-8 p-0"
                    disabled={newsData.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Loading indicator */}
              {newsLoading && (
                <div className="flex items-center gap-2 ml-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-zinc-400">Loading news...</span>
                </div>
              )}
            </div>            {/* Right side controls */}
            <div className="flex items-center gap-4">
              {/* ✅ MODIFIED: Chart Type Tabs - ALWAYS VISIBLE, regardless of images */}
              <ChartTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                intradayCount={intradayCount}
                interdayCount={interdayCount}
                lstmaeCount={lstmaeCount}
                siprCount={siprCount}
                msaxCount={msaxCount}
              />

              {/* ✅ NEW - Sentiment Display based on current news */}
              {currentNews && (
                <SentimentDisplay sentiment={currentNews.sentiment} />
              )}

              {/* Maximize/Minimize button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMaximized(!isMaximized)}
                disabled={!activeTab}
                className={`text-zinc-400 hover:text-white ${!activeTab ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col relative overflow-hidden">
            {isLoading ? (
              <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                  <p className="text-zinc-400 mb-2">Searching for graphs...</p>
                  <p className="text-sm text-zinc-500">
                    Looking for {companyCode} analysis images
                  </p>
                </div>
              </div>
            ) : (
              <>
                {isMaximized ? (
                  renderMaximizedImages()
                ) : (
                  // Non-maximized view
                  <>
                    {/* ✅ MODIFIED: Quick access buttons ONLY for LSTMAE/SIPR tabs */}
                    {(activeTab === 'LSTMAE' || activeTab === 'SiPR') && (
                      <div className="border-b border-zinc-700/50 bg-zinc-700/20">
                        <div className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* ✅ Quick access button for LSTMAE - ALWAYS VISIBLE */}
                              {activeTab === 'LSTMAE' && (
                                <Button
                                  onClick={() => setIsLSTMAEModalOpen(true)}
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Open Full LSTMAE Dashboard
                                </Button>
                              )}

                              {/* ✅ NEW - Quick access button for SIPR - ALWAYS VISIBLE */}
                              {activeTab === 'SiPR' && (
                                <>
                                  <select
                                    value={siprMonths}
                                    onChange={(e) => setSiprMonths(Number(e.target.value))}
                                    className="px-2 py-1 text-xs rounded bg-zinc-700 text-white border border-zinc-600"
                                  >
                                    {[1, 2, 3, 6, 9, 12].map(m => (
                                      <option key={m} value={m}>{m}M</option>
                                    ))}
                                  </select>
                                  <Button
                                    onClick={() => setIsSiprModalOpen(true)}
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                  >
                                    <Activity className="h-3 w-3" />
                                    Open Full SIPR Dashboard
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ✅ MODIFIED: Show dashboard content inline for LSTMAE/SIPR tabs */}
                    {activeTab === null ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
                        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
                          <div className="bg-zinc-800/50 p-6 rounded-full inline-flex mb-2 border border-zinc-700/50 shadow-xl">
                            <Activity className="h-12 w-12 text-blue-500" />
                          </div>
                          <h3 className="text-2xl font-semibold text-white tracking-tight">Select Analysis Module</h3>
                          <p className="text-zinc-400 max-w-md mx-auto text-base leading-relaxed">
                            Choose a service from the tabs above to view detailed market insights, patterns, and regime data for <span className="text-blue-400 font-semibold">{companyCode}</span>.
                          </p>
                        </div>
                      </div>
                    ) : activeTab === 'LSTMAE' ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)] overflow-auto' : 'min-h-fit'}`}>
                        <InlineLSTMAEContent companyCode={companyCode} exchange={exchange} />
                      </div>
                    ) : activeTab === 'SiPR' ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)] overflow-auto' : 'min-h-fit'}`}>
                        <InlineSiprContent
                          companyCode={companyCode}
                          exchange={exchange}
                          months={siprMonths}
                        />
                      </div>
                    ) : activeTab === 'MSAX' ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)] overflow-auto' : 'min-h-fit'}`}>
                        <MsaxDashboard companyCode={companyCode} exchange={exchange} />
                      </div>
                    ) : newsLoading ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                          <p className="text-zinc-400">Loading market news...</p>
                        </div>
                      </div>
                    ) : newsError || !currentNews ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
                        <div className="text-center space-y-3">
                          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                          <p className="text-zinc-400 mb-2">
                            {newsError || 'No market news available'}
                          </p>
                          <p className="text-sm text-zinc-500">
                            Select a company to view analysis charts
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchNewsData}
                            className="mt-4"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ✅ MODIFIED - Single image view with headline at top, sentiment-based background, no empty space */}
                        <div className={`flex flex-col bg-gradient-to-br ${currentNews.sentiment === 'positive' ? 'from-green-950/30 via-green-900/10 to-zinc-900' :
                          currentNews.sentiment === 'negative' ? 'from-red-950/30 via-red-900/10 to-zinc-900' :
                            'from-zinc-900/30 via-zinc-800/10 to-zinc-900'
                          }`}>
                          {/* ✅ News headline at top with sentiment-based tinted background - compact padding */}
                          <div className={`p-3 border-b ${currentNews.sentiment === 'positive' ? 'border-green-700/50 bg-green-950/40' :
                            currentNews.sentiment === 'negative' ? 'border-red-700/50 bg-red-950/40' :
                              'border-zinc-700/50 bg-zinc-800/50'
                            }`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="text-white font-medium text-sm mb-1.5">{currentNews.headline}</h3>
                                <div className="flex items-center gap-3 text-xs text-zinc-400">
                                  <span className={`px-2 py-1 rounded ${currentNews.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                                    currentNews.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                                      'bg-zinc-500/20 text-zinc-400'
                                    }`}>
                                    {currentNews.sentiment.toUpperCase()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatRelativeTime(currentNews.timestamp)}
                                  </span>
                                  {currentNews.price_movement_1hr && (
                                    <span>1hr: {currentNews.price_movement_1hr.price_change_pct.toFixed(2)}%</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm text-zinc-400">
                                {activeIndex + 1} / {newsData.length}
                              </div>
                            </div>
                          </div>

                          {/* Image container - takes all available space without padding */}
                          <div className="flex-1 relative overflow-hidden">
                            <div className="relative h-full overflow-hidden">
                              <div className="absolute top-2 left-2 bg-zinc-900/80 backdrop-blur-sm rounded px-2 py-1 z-10">
                                <p className="text-xs text-zinc-300 font-medium">
                                  {activeTab === 'intraday' ? 'Intraday Analysis' : 'Interday Analysis'}
                                </p>
                              </div>
                              {imageLoading[`${activeTab}-${activeIndex}`] && (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                </div>
                              )}
                              {activeTab === 'intraday' ? (
                                // Show Intraday Image
                                currentNews.imageUrl1 ? (
                                  <img
                                    src={currentNews.imageUrl1}
                                    alt={`${companyCode} Intraday Chart`}
                                    className="w-full h-full object-contain"
                                    onLoadStart={() => handleImageLoadStart(`intraday-${activeIndex}`)}
                                    onLoad={() => handleImageLoad(`intraday-${activeIndex}`)}
                                    onError={(e) => {
                                      handleImageError(`intraday-${activeIndex}`);
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzI3MjcyNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DaGFydCBHZW5lcmF0aW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                      <TrendingUp className="h-12 w-12 text-zinc-600 mx-auto mb-2" />
                                      <p className="text-zinc-500">Intraday Chart Generating...</p>
                                    </div>
                                  </div>
                                )
                              ) : (
                                // Show Interday Image
                                currentNews.imageUrl2 ? (
                                  <img
                                    src={currentNews.imageUrl2}
                                    alt={`${companyCode} Interday Chart`}
                                    className="w-full h-full object-contain"
                                    onLoadStart={() => handleImageLoadStart(`interday-${activeIndex}`)}
                                    onLoad={() => handleImageLoad(`interday-${activeIndex}`)}
                                    onError={(e) => {
                                      handleImageError(`interday-${activeIndex}`);
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzI3MjcyNyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5DaGFydCBHZW5lcmF0aW5nLi4uPC90ZXh0Pjwvc3ZnPg==';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                      <TrendingDown className="h-12 w-12 text-zinc-600 mx-auto mb-2" />
                                      <p className="text-zinc-500">Interday Chart Generating...</p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* News Component - Only show in non-maximized view */}
        {!isMaximized && (
          <div className="w-1/4 flex-shrink-0">
            <NewsComponent
              companyCode={companyCode}
              isMaximized={isMaximized}
              gradientMode={gradientMode}
              onNewsClick={handleNewsClick}
            />
          </div>
        )}
      </div>

      {/* News Modal */}
      <NewsModal
        isOpen={isNewsModalOpen}
        onClose={handleCloseNewsModal}
        newsItem={selectedNewsItem}
      />

      {/* ✅ LSTMAE Pipeline 2 Modal - FULL SCREEN */}
      <Dialog open={isLSTMAEModalOpen} onOpenChange={setIsLSTMAEModalOpen}>
        <DialogContent className="max-w-full w-screen h-screen p-0 bg-zinc-950 border-0 m-0">
          <DialogHeader className="p-6 border-b border-zinc-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-blue-400" />
                <DialogTitle className="text-2xl font-bold text-white">
                  LSTM AutoEncoder Analysis - {companyCode}
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLSTMAEModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6">
            <LSTMAEModal
              isOpen={true}
              onClose={() => setIsLSTMAEModalOpen(false)}
              companyCode={companyCode}
              companyName={`${companyCode} - ${exchange}`}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ NEW - SIPR Pattern Analysis Modal - FULL SCREEN */}
      <Dialog open={isSiprModalOpen} onOpenChange={setIsSiprModalOpen}>
        <DialogContent className="max-w-full w-screen h-screen p-0 bg-zinc-950 border-0 m-0">
          <DialogHeader className="p-6 border-b border-zinc-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-purple-400" />
                <DialogTitle className="text-2xl font-bold text-white">
                  SIPR Pattern Analysis - {companyCode}
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSiprModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-6">
            <SiprDashboard
              companyCode={`${companyCode}_${exchange}`}
              months={siprMonths}
              className="h-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
