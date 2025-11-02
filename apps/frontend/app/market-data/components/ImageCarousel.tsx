'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink, Clock, TrendingUp, TrendingDown, Minus, X, Calendar, Activity, RefreshCwOff, RefreshCw } from 'lucide-react';
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

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  timestamp: string;
  category: 'market' | 'company' | 'sector' | 'economy';
  relevance: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  imageUrl1?: string;
  imageUrl2?: string;
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

  const generateRandomNews = useCallback(() => {
    const headlines = [
      `Lorem ipsum dolor sit amet consectetur adipiscing elit`,
      `Sed do eiusmod tempor incididunt ut labore et dolore magna`,
      `Ut enim ad minim veniam quis nostrud exercitation ullamco`,
      `Duis aute irure dolor in reprehenderit in voluptate velit`,
      `Excepteur sint occaecat cupidatat non proident sunt in culpa`,
      `Lorem ipsum dolor sit amet consectetur adipiscing elit sed`,
      `Tempor incididunt ut labore et dolore magna aliqua enim`,
      `Minim veniam quis nostrud exercitation ullamco laboris nisi`,
      `Aliquip ex ea commodo consequat duis aute irure dolor`,
      `Reprehenderit in voluptate velit esse cillum dolore eu fugiat`,
      `Nulla pariatur excepteur sint occaecat cupidatat non proident`,
      `Sunt in culpa qui officia deserunt mollit anim id laborum`
    ];
    
    const summaries = [
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.",
      "Dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.",
      "Sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error.",
      "Sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi.",
      "Architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
      "Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem.",
      "Ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna.",
      "Aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint.",
      "Occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis.",
      "Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo."
    ];

    const categories: NewsItem['category'][] = ['market', 'company', 'sector', 'economy'];
    const relevance: NewsItem['relevance'][] = ['high', 'medium', 'low'];
    const sentiments: NewsItem['sentiment'][] = ['positive', 'negative', 'neutral'];
    
    const news: NewsItem[] = headlines.map((headline, index) => ({
      id: `news-${index}`,
      headline,
      summary: summaries[index % summaries.length],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      relevance: relevance[Math.floor(Math.random() * relevance.length)],
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)]
    }));
    
    return news.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  useEffect(() => {
    if (companyCode) {
      setNewsItems(generateRandomNews());
    }
  }, [companyCode, generateRandomNews]);

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
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          {companyCode} News Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[900px]'} w-full`}>
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
  selectedDate?: Date;
  gradientMode: 'profit' | 'loss' | 'neutral';
  onGradientModeChange: (mode: 'profit' | 'loss' | 'neutral') => void;
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
  activeTab: 'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX';
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
    { key: 'intraday' as const, label: 'Intraday', count: intradayCount },
    { key: 'interday' as const, label: 'Interday', count: interdayCount },
    { key: 'LSTMAE' as const, label: 'LSTMAE', count: lstmaeCount },
    { key: 'SiPR' as const, label: 'SiPR', count: siprCount },
    { key: 'MSAX' as const, label: 'MSAX', count: msaxCount }
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
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isActive ? 'bg-blue-500/30' : 'bg-zinc-600'
            }`}>
              {tab.count}
            </span>
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
                className={`text-xs px-2 py-1 rounded ${
                  health.status === 'healthy'
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
  onGradientModeChange 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'intraday' | 'interday' | 'LSTMAE' | 'SiPR' | 'MSAX'>('intraday');
  
  // State for maximized view headline carousel using existing news data
  const [currentHeadlineIndex, setCurrentHeadlineIndex] = useState(0);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // State for news modal
  const [selectedNewsItem, setSelectedNewsItem] = useState<NewsItem | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  // ✅ LSTMAE Pipeline 2 Modal
  const [isLSTMAEModalOpen, setIsLSTMAEModalOpen] = useState(false);
  
  // ✅ NEW - SIPR Pattern Analysis Modal State
  const [isSiprModalOpen, setIsSiprModalOpen] = useState(false);
  const [siprMonths, setSiprMonths] = useState(3);

  // Generate the same news items for headline carousel
  const generateRandomNews = useCallback(() => {
    const headlines = [
      `Lorem ipsum dolor sit amet consectetur adipiscing elit`,
      `Sed do eiusmod tempor incididunt ut labore et dolore magna`,
      `Ut enim ad minim veniam quis nostrud exercitation ullamco`,
      `Duis aute irure dolor in reprehenderit in voluptate velit`,
      `Excepteur sint occaecat cupidatat non proident sunt in culpa`,
      `Lorem ipsum dolor sit amet consectetur adipiscing elit sed`,
      `Tempor incididunt ut labore et dolore magna aliqua enim`,
      `Minim veniam quis nostrud exercitation ullamco laboris nisi`,
      `Aliquip ex ea commodo consequat duis aute irure dolor`,
      `Reprehenderit in voluptate velit esse cillum dolore eu fugiat`,
      `Nulla pariatur excepteur sint occaecat cupidatat non proident`,
      `Sunt in culpa qui officia deserunt mollit anim id laborum`
    ];
    
    const summaries = [
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.",
      "Dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.",
      "Sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error.",
      "Sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi.",
      "Architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
      "Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem.",
      "Ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna.",
      "Aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint.",
      "Occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis.",
      "Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo."
    ];

    const categories: NewsItem['category'][] = ['market', 'company', 'sector', 'economy'];
    const relevance: NewsItem['relevance'][] = ['high', 'medium', 'low'];
    const sentiments: NewsItem['sentiment'][] = ['positive', 'negative', 'neutral'];
    
    const news: NewsItem[] = headlines.map((headline, index) => ({
      id: `news-${index}`,
      headline,
      summary: summaries[index % summaries.length],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      relevance: relevance[Math.floor(Math.random() * relevance.length)],
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)]
    }));
    
    return news.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  // Initialize news items for headline carousel
  useEffect(() => {
    if (companyCode) {
      setNewsItems(generateRandomNews());
    }
  }, [companyCode, generateRandomNews]);

  // Handle news click - maximize view and set headline
  const handleNewsClick = (newsItem: NewsItem) => {
    const newsIndex = newsItems.findIndex(item => item.id === newsItem.id);
    if (newsIndex !== -1) {
      setCurrentHeadlineIndex(newsIndex);
      setIsMaximized(true);
    }
  };

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

  const filteredImages = useMemo(() => {
    return allImages.filter(image => image.chartType === activeTab);
  }, [allImages, activeTab]);

  const intradayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'intraday').length;
  }, [allImages]);

  const interdayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'interday').length;
  }, [allImages]);

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

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab]);

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
    const date = selectedDate || new Date('2025-07-01');
    return date.toISOString().split('T')[0];
  }, [selectedDate]);

  // Generate image paths with Pipeline 2 Integration
  const generateImagePaths = useCallback(() => {
    if (!companyCode || !exchange) return [];
    
    const dateString = getCurrentDateString();
    const companyExchange = `${companyCode}_${exchange}`;
    const imageList: CarouselImage[] = [];


    const pattern1Path = `/GraphsN/${dateString}/N1_Pattern_Plot/${companyExchange}/${companyExchange}_interday.png`;
    imageList.push({
      src: pattern1Path,
      name: `${companyCode} Combined Overlay`,
      type: 'N1 Pattern Analysis',
      chartType: 'interday',
      exists: false
    });

    ACTUAL_INDICES.forEach(index => {
      const pattern2Path = `/GraphsN/${dateString}/watchlist_comp_ind_90d_analysis_plot/${companyExchange}_${dateString}/${companyCode}_${index}_intraday.png`;
      imageList.push({
        src: pattern2Path,
        name: `${companyCode} ${index} Analysis`,
        type: 'Confusion Heatmap',
        chartType: 'intraday',
        exists: false
      });
    });

    // LSTMAE images - Pipeline 2 Integration
    const lstmaeBasePath = `/nvme1/production/PatternPoolLSTMAE/pipeline2/data/visualizations/${companyCode}`;
    
    // 4 Static PNG Visualizations
    const lstmaeVisualizations = [
      {
        filename: `${companyCode}_dominant_patterns.png`,
        name: `${companyCode} Dominant Patterns`,
        type: 'Pattern Timeline & Strength Analysis',
        dimensions: { width: 1200, height: 800 }
      },
      {
        filename: `${companyCode}_intraday_patterns.png`,
        name: `${companyCode} Intraday Patterns`,
        type: 'Median Price Movement Clusters',
        dimensions: { width: 1400, height: 1200 }
      },
      {
        filename: `${companyCode}_cluster_transitions.png`,
        name: `${companyCode} Cluster Transitions`,
        type: 'Network Graph - Transition Probabilities',
        dimensions: { width: 1200, height: 800 }
      },
      {
        filename: `${companyCode}_cluster_timeline.png`,
        name: `${companyCode} Cluster Timeline`,
        type: 'Temporal Cluster Assignment Scatter',
        dimensions: { width: 1200, height: 800 }
      }
    ];

    lstmaeVisualizations.forEach(viz => {
      imageList.push({
        src: `${lstmaeBasePath}/${viz.filename}`,
        name: viz.name,
        type: viz.type,
        chartType: 'LSTMAE',
        exists: false,
        dimensions: viz.dimensions
      });
    });

    // ✅ NEW - SiPR images (Pattern Analysis visualizations)
    const siprBasePath = `/GraphsN/${dateString}/SiPR_Analysis/${companyExchange}`;
    
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

    // MSAX images (UNCHANGED)
    const msaxPath = `/GraphsN/${dateString}/MSAX_Analysis/${companyExchange}/${companyExchange}_MSAX_multi.png`;
    imageList.push({
      src: msaxPath,
      name: `${companyCode} Multi-Scale Analysis`,
      type: 'MSAX Multi-Scale',
      chartType: 'MSAX',
      exists: false
    });

    const msaxPath2 = `/GraphsN/${dateString}/MSAX_Analysis/${companyExchange}/${companyExchange}_MSAX_correlation.png`;
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

  useEffect(() => {
    const loadImages = async () => {
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
        setCurrentIndex(0);
      } catch (error) {
        console.error('Error loading images:', error);
        setAllImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyCode && exchange) {
      loadImages();
    }
  }, [companyCode, exchange, generateImagePaths, checkImageExists]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % filteredImages.length);
  }, [filteredImages.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + filteredImages.length) % filteredImages.length);
  }, [filteredImages.length]);

  // Handlers for headline carousel in maximized view
  const handleHeadlineNext = useCallback(() => {
    setCurrentHeadlineIndex((prev) => (prev + 1) % newsItems.length);
  }, [newsItems.length]);

  const handleHeadlinePrevious = useCallback(() => {
    setCurrentHeadlineIndex((prev) => (prev - 1 + newsItems.length) % newsItems.length);
  }, [newsItems.length]);

  const handleImageLoad = (index: number) => {
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoadStart = (index: number) => {
    setImageLoading(prev => ({ ...prev, [index]: true }));
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!companyCode || !exchange || isMaximized) return;
      
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
  }, [handleNext, handlePrevious, companyCode, exchange, isMaximized]);

  const currentImage = filteredImages[currentIndex];
  const currentHeadline = newsItems[currentHeadlineIndex];

  // ✅ MODIFIED - Function to render images with "Open Full Dashboard" button for LSTMAE & SIPR
  // ✅ ALWAYS show buttons even if no images available
  const renderMaximizedImages = () => {
    let leftImages: CarouselImage[] = [];
    let rightImages: CarouselImage[] = [];
    let leftTitle = '';
    let rightTitle = '';
    let showLSTMAEButton = false;
    let showSiprButton = false;

    switch (activeTab) {
      case 'intraday':
        leftImages = intradayImages;
        rightImages = interdayImages;
        leftTitle = 'Intraday Analysis';
        rightTitle = 'Interday Analysis';
        break;
      case 'interday':
        leftImages = interdayImages;
        rightImages = intradayImages;
        leftTitle = 'Interday Analysis';
        rightTitle = 'Intraday Analysis';
        break;
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
        <Card className={`shadow-lg border border-zinc-700/50 ${
          isMaximized 
            ? `${getMaximizedBackgroundClass(currentHeadline?.sentiment || 'neutral')} w-full` 
            : `${getGradientClass(gradientMode)} flex-1`
        }`}>
          <CardHeader className="flex flex-row items-center justify-between p-1 border-b border-zinc-700/50">
            {/* Left side - Title and Counter Navigation */}
            <div className="flex items-center gap-4 mx-2 flex-1">
              <CardTitle className="text-base font-semibold text-white">
                {companyCode} - Headline Analysis
              </CardTitle>
              
              {/* Counter Navigation - Only show in maximized mode */}
              {isMaximized && currentHeadline && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-all duration-200 ${
                  getSentimentStyling(currentHeadline.sentiment).background
                }`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleHeadlinePrevious}
                    className="h-6 w-6 p-0"
                    disabled={newsItems.length <= 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  
                  <div className="text-white font-medium text-sm">
                    {currentHeadlineIndex + 1} / {newsItems.length}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleHeadlineNext}
                    className="h-6 w-6 p-0"
                    disabled={newsItems.length <= 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {/* Navigation Controls - Hidden in maximized mode */}
              {filteredImages.length > 0 && !isLoading && !isMaximized && (
                <div className="flex items-center gap-1 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    className="h-8 w-8 p-0"
                    disabled={filteredImages.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-zinc-400 px-2 min-w-[60px] text-center">
                    {filteredImages.length > 0 ? `${currentIndex + 1} / ${filteredImages.length}` : '0 / 0'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    className="h-8 w-8 p-0"
                    disabled={filteredImages.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 ml-4">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-zinc-400">Searching for graphs...</span>
                </div>
              )}
            </div>
            
            {/* Right side controls */}
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
              
              {/* Sentiment Display or Gradient Mode Toggle */}
              {isMaximized ? (
                <SentimentDisplay sentiment={currentHeadline?.sentiment || 'neutral'} />
              ) : (
                <GradientToggle value={gradientMode} onChange={onGradientModeChange} />
              )}
              
              {/* Maximize/Minimize button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-zinc-400 hover:text-white"
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col relative">
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
                    {/* ✅ MODIFIED: Quick access buttons ALWAYS visible + Show inline content for LSTMAE/SIPR */}
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
                    
                    {/* ✅ MODIFIED: Show dashboard content inline for LSTMAE/SIPR tabs */}
                    {activeTab === 'LSTMAE' ? (
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
                    ) : filteredImages.length === 0 ? (
                      <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
                        <div className="text-center">
                          <p className="text-zinc-400 mb-2">
                            No {activeTab} graphs found for {companyCode}
                          </p>
                          <p className="text-sm text-zinc-500">
                            Date: {getCurrentDateString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${
                          gradientMode === 'profit' ? 'from-green-950/20 to-zinc-900' :
                          gradientMode === 'loss' ? 'from-red-950/20 to-zinc-900' : 
                          'from-zinc-900 to-zinc-900'
                        } min-h-[400px]`}>
                          {imageLoading[currentIndex] && (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            </div>
                          )}
                          {currentImage && (
                            <img
                              src={currentImage.src}
                              alt={currentImage.name}
                              className="w-full h-auto block"
                              style={{ 
                                maxWidth: '100%',
                                height: 'auto',
                                display: 'block'
                              }}
                              onLoadStart={() => handleImageLoadStart(currentIndex)}
                              onLoad={() => handleImageLoad(currentIndex)}
                              onError={() => handleImageLoad(currentIndex)}
                            />
                          )}
                        </div>
                        
                        {filteredImages.length > 1 && (
                          <div className="p-2 border-t border-zinc-700/50 bg-zinc-700/20">
                            <div className="flex justify-center gap-1">
                              {filteredImages.map((_, index) => (
                                <button
                                  key={index}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index === currentIndex ? 'bg-blue-500' : 'bg-zinc-600'
                                  }`}
                                  onClick={() => setCurrentIndex(index)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
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
          <div className="w-[360px] flex-shrink-0">
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
