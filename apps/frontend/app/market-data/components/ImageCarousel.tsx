'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  timestamp: string;
  category: 'market' | 'company' | 'sector' | 'economy';
  relevance: 'high' | 'medium' | 'low';
}

interface NewsComponentProps {
  companyCode: string;
  isMaximized: boolean;
  gradientMode: 'profit' | 'loss' | 'neutral';
}

// Three-way toggle switch componentfdfdf
interface GradientToggleProps {
  value: 'profit' | 'loss' | 'neutral';
  onChange: (value: 'profit' | 'loss' | 'neutral') => void;
}

const GradientToggle: React.FC<GradientToggleProps> = ({ value, onChange }) => {
  const modes = [
    { 
      key: 'loss' as const, 
      label: 'Loss', 
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
      label: 'Profit', 
      icon: TrendingUp, 
      color: 'text-green-400',
      bgColor: 'bg-green-500/20 border-green-500/30'
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 mr-2">Market Mood:</span>
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
              <Icon className="h-3 w-3" />
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const NewsComponent: React.FC<NewsComponentProps> = ({ companyCode, isMaximized, gradientMode }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // Get gradient classes based on mode
  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-gradient-to-br from-green-900 via-zinc-800 to-green-900';
      case 'loss':
        return 'bg-gradient-to-br from-red-900 via-zinc-800 to-red-900';
      case 'neutral':
      default:
        return 'bg-zinc-800';
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
    
    const news: NewsItem[] = headlines.map((headline, index) => ({
      id: `news-${index}`,
      headline,
      summary: summaries[index % summaries.length],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      relevance: relevance[Math.floor(Math.random() * relevance.length)]
    }));
    
    return news.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  useEffect(() => {
    if (companyCode) {
      setNewsItems(generateRandomNews());
    }
  }, [companyCode, generateRandomNews]);

  const handleNewsClick = (newsItem: NewsItem) => {
    const searchQuery = encodeURIComponent(`${newsItem.headline} ${companyCode}`);
    const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;
    window.open(googleSearchUrl, '_blank', 'noopener,noreferrer');
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const newsTime = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getCategoryColor = (category: NewsItem['category']) => {
    switch (category) {
      case 'market': return 'bg-blue-500/20 text-blue-400';
      case 'company': return 'bg-green-500/20 text-green-400';
      case 'sector': return 'bg-purple-500/20 text-purple-400';
      case 'economy': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  const getRelevanceIcon = (relevance: NewsItem['relevance']) => {
    switch (relevance) {
      case 'high': return <TrendingUp className="h-3 w-3 text-red-400" />;
      case 'medium': return <TrendingUp className="h-3 w-3 text-yellow-400" />;
      case 'low': return <TrendingUp className="h-3 w-3 text-zinc-400" />;
    }
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
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {companyCode} News Feed
        </CardTitle>
        <p className="text-sm text-zinc-400">Click on any headline to search Google</p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[900px]'} w-full`}>
          <div className="p-4 space-y-4">
            {newsItems.map((newsItem) => (
              <div
                key={newsItem.id}
                onClick={() => handleNewsClick(newsItem)}
                className="group cursor-pointer p-4 rounded-lg border border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-700/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(newsItem.category)}`}>
                      {newsItem.category}
                    </span>
                    {getRelevanceIcon(newsItem.relevance)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {formatTime(newsItem.timestamp)}
                  </div>
                </div>
                <h3 className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors duration-200 flex items-start gap-2">
                  {newsItem.headline}
                  <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-0.5" />
                </h3>
                <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                  {newsItem.summary}
                </p>
                <div className="mt-3 pt-3 border-t border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      Relevance: {newsItem.relevance}
                    </span>
                    <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      Click to search →
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
}

interface CarouselImage {
  src: string;
  name: string;
  type: string;
  chartType: 'intraday' | 'interday'; // Added chart type
  exists: boolean;
  dimensions?: { width: number; height: number };
}

// Tab component for chart type selection
interface ChartTabsProps {
  activeTab: 'intraday' | 'interday';
  onTabChange: (tab: 'intraday' | 'interday') => void;
  intradayCount: number;
  interdayCount: number;
}

const ChartTabs: React.FC<ChartTabsProps> = ({ activeTab, onTabChange, intradayCount, interdayCount }) => {
  const tabs = [
    { key: 'intraday' as const, label: 'Intraday', count: intradayCount },
    { key: 'interday' as const, label: 'Interday', count: interdayCount }
  ];

  return (
    <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm' 
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

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  companyCode,
  exchange,
  selectedDate
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gradientMode, setGradientMode] = useState<'profit' | 'loss' | 'neutral'>('neutral');
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'intraday' | 'interday'>('intraday');

  // Filter images based on active tab
  const filteredImages = useMemo(() => {
    return allImages.filter(image => image.chartType === activeTab);
  }, [allImages, activeTab]);

  // Get counts for each chart type
  const intradayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'intraday').length;
  }, [allImages]);

  const interdayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'interday').length;
  }, [allImages]);

  // Reset current index when tab changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab]);

  // Get gradient classes based on mode
  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-gradient-to-br from-green-900 via-zinc-800 to-green-900/50';
      case 'loss':
        return 'bg-gradient-to-br from-red-900 via-zinc-800 to-red-900/50';
      case 'neutral':
      default:
        return 'bg-zinc-800';
    }
  };

  const getCurrentDateString = useCallback(() => {
    const date = selectedDate || new Date('2025-07-01');
    return date.toISOString().split('T')[0];
  }, [selectedDate]);

  const generateImagePaths = useCallback(() => {
    if (!companyCode || !exchange) return [];
    
    const dateString = getCurrentDateString();
    const companyExchange = `${companyCode}_${exchange}`;
    const imageList: CarouselImage[] = [];

    // Interday pattern
    const pattern1Path = `/GraphsN/${dateString}/N1_Pattern_Plot/${companyExchange}/${companyExchange}_interday.png`;
    imageList.push({
      src: pattern1Path,
      name: `${companyCode} Combined Overlay`,
      type: 'N1 Pattern Analysis',
      chartType: 'interday',
      exists: false
    });

    // Intraday patterns
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

  if (!companyCode || !exchange) {
    return null;
  }

  return (
    <div className={`flex gap-4 ${isMaximized ? 'fixed inset-4 z-50' : 'w-full'}`}>
      {/* Main Image Carousel */}
      <Card className={`${getGradientClass(gradientMode)} shadow-lg border border-zinc-700/50 ${isMaximized ? 'flex-1' : 'flex-1'}`}>
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-zinc-700/50">
          {/* Title and Navigation */}
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold text-white">
              {companyCode} - Graph Analysis
            </CardTitle>
            
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

            {/* Show filtered count in maximized mode */}
            {isMaximized && filteredImages.length > 0 && !isLoading && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-zinc-400">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Images: {filteredImages.length}
                </span>
              </div>
            )}
          </div>
          
          {/* Right side controls */}
          <div className="flex items-center gap-4">
            {/* Chart Type Tabs */}
            {!isLoading && allImages.length > 0 && (
              <ChartTabs 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                intradayCount={intradayCount}
                interdayCount={interdayCount}
              />
            )}
            
            {/* Gradient Mode Toggle */}
            <GradientToggle value={gradientMode} onChange={setGradientMode} />
            
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
          ) : filteredImages.length === 0 ? (
            <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
              <div className="text-center">
                <p className="text-zinc-400 mb-2">
                  No {activeTab} graphs found for {companyCode}
                </p>
                <p className="text-sm text-zinc-500">
                  Date: {getCurrentDateString()}
                </p>
                {allImages.length > 0 && (
                  <p className="text-sm text-zinc-500 mt-2">
                    Try switching to {activeTab === 'intraday' ? 'interday' : 'intraday'} tab
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {isMaximized ? (
                // List view for maximized mode - ADAPTIVE HEIGHT
                <ScrollArea className="h-[calc(100vh-200px)] w-full">
                  <div className="p-6 space-y-6">
                    {filteredImages.map((image, index) => (
                      <div key={index} className="space-y-4">
                        {/* Image metadata */}
                        <div className="p-4 border border-zinc-700/50 rounded-lg bg-zinc-700/20">
                          <h3 className="font-medium text-white mb-1">{image.name}</h3>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm text-zinc-400">{image.type}</p>
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                              {image.chartType}
                            </span>
                          </div>
                          {image.dimensions && (
                            <p className="text-xs text-zinc-500 mt-1">
                              {image.dimensions.width} × {image.dimensions.height}px
                            </p>
                          )}
                        </div>
                        
                        {/* Image display - ADAPTIVE CONTAINER */}
                        <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${
                          gradientMode === 'profit' ? 'from-green-950/20 to-zinc-900' :
                          gradientMode === 'loss' ? 'from-red-950/20 to-zinc-900' : 
                          'from-zinc-900 to-zinc-900'
                        } border border-zinc-700/30`}>
                          {imageLoading[index] && (
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
                            onLoadStart={() => handleImageLoadStart(index)}
                            onLoad={() => handleImageLoad(index)}
                            onError={() => handleImageLoad(index)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                // Carousel view for normal mode - ADAPTIVE HEIGHT
                <>
                  {/* Image metadata */}
                  <div className="p-4 border-b border-zinc-700/50 bg-zinc-700/20">
                    <h3 className="font-medium text-sm text-white">{currentImage?.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-zinc-400">{currentImage?.type}</p>
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                        {currentImage?.chartType}
                      </span>
                    </div>
                    {currentImage?.dimensions && (
                      <p className="text-xs text-zinc-500 mt-1">
                        {currentImage.dimensions.width} × {currentImage.dimensions.height}px
                      </p>
                    )}
                  </div>
                  
                  {/* Image display - ADAPTIVE HEIGHT CONTAINER */}
                  <div className={`relative overflow-hidden bg-gradient-to-br ${
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
                  
                  {/* Pagination dots - Based on filtered images */}
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
        </CardContent>
      </Card>
      
      
      {/* News Component */}
      <div className={`${isMaximized ? 'w-96' : 'w-[360px]'} flex-shrink-0`}>
        <NewsComponent 
          companyCode={companyCode} 
          isMaximized={isMaximized} 
          gradientMode={gradientMode}
        />
      </div>
    </div>
  );
};
