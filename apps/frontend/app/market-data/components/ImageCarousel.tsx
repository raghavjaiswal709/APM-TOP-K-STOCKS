'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink, Clock, TrendingUp } from 'lucide-react';
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
}
const NewsComponent: React.FC<NewsComponentProps> = ({ companyCode, isMaximized }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
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

    //  const headlines = [
    //   `${companyCode} Reports Strong Q3 Earnings Beat Analyst Expectations`,
    //   `Market Volatility Impacts ${companyCode} Stock Performance This Week`,
    //   `${companyCode} Announces Strategic Partnership with Global Tech Giant`,
    //   `Regulatory Changes May Affect ${companyCode} Operations in Coming Quarter`,
    //   `${companyCode} Management Discusses Future Growth Plans in Latest Interview`,
    //   `Institutional Investors Increase Stakes in ${companyCode} Amid Market Rally`,
    //   `${companyCode} Launches New Product Line to Capture Emerging Market Opportunities`,
    //   `Credit Rating Agencies Upgrade ${companyCode} Following Strong Financial Performance`,
    //   `${companyCode} Board Approves Dividend Increase and Share Buyback Program`,
    //   `Industry Analysis: ${companyCode} Well-Positioned for Sector Recovery`,
    //   `${companyCode} Insider Trading Activity Shows Increased Management Confidence`,
    //   `Technical Analysis Suggests ${companyCode} May Break Key Resistance Levels`
    // ];
    // const summaries = [
    //   "Strong quarterly results demonstrate company's resilient business model and effective cost management strategies during challenging market conditions.",
    //   "Recent market fluctuations have created both opportunities and challenges for equity positioning and portfolio optimization strategies.",
    //   "Strategic alliance expected to drive innovation and expand market reach while creating significant value for shareholders and stakeholders.",
    //   "New regulatory framework may require operational adjustments but could create competitive advantages in the long term.",
    //   "Leadership team outlines comprehensive growth strategy focusing on digital transformation and market expansion initiatives.",
    //   "Institutional buying suggests professional investors recognize undervalued opportunities in current market environment and future potential.",
    //   "Product diversification strategy aims to capture growing demand in emerging markets while strengthening competitive positioning.",
    //   "Improved credit metrics reflect strong balance sheet management and consistent cash flow generation capabilities.",
    //   "Capital return program demonstrates management confidence in business fundamentals and commitment to shareholder value creation.",
    //   "Sector dynamics indicate favorable conditions for companies with strong market positions and operational efficiency.",
    //   "Executive transactions provide insights into management's view of company prospects and strategic direction.",
    //   "Chart patterns suggest potential breakout scenarios that could drive significant price movement in coming sessions."
    // ];
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
      <Card className={`bg-zinc-800 shadow-lg ${isMaximized ? 'h-full' : 'h-auto'}`}>
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
    <Card className={`bg-zinc-800 shadow-lg ${isMaximized ? 'h-full' : 'h-auto'}`}>
      <CardHeader className="p-4 border-b border-zinc-700">
        <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {companyCode} News Feed
        </CardTitle>
        <p className="text-sm text-zinc-400">Click on any headline to search Google</p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[400px]'} w-full`}>
          <div className="p-4 space-y-4">
            {newsItems.map((newsItem) => (
              <div
                key={newsItem.id}
                onClick={() => handleNewsClick(newsItem)}
                className="group cursor-pointer p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-700/30 transition-all duration-200"
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
  exists: boolean;
}
export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  companyCode,
  exchange,
  selectedDate
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const getCurrentDateString = useCallback(() => {
    const date = selectedDate || new Date('2025-07-01');
    return date.toISOString().split('T')[0];
  }, [selectedDate]);
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
      exists: false
    });
    ACTUAL_INDICES.forEach(index => {
      const pattern2Path = `/GraphsN/${dateString}/watchlist_comp_ind_90d_analysis_plot/${companyExchange}_${dateString}/${companyCode}_${index}_intraday.png`;
      imageList.push({
        src: pattern2Path,
        name: `${companyCode} ${index} Analysis`,
        type: 'Confusion Heatmap',
        exists: false
      });
    });
    return imageList;
  }, [companyCode, exchange, getCurrentDateString]);
  const checkImageExists = useCallback(async (imageSrc: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = imageSrc;
    });
  }, []);
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      try {
        const imageList = generateImagePaths();
        const validatedImages = await Promise.all(
          imageList.map(async (image) => ({
            ...image,
            exists: await checkImageExists(image.src)
          }))
        );
        const existingImages = validatedImages.filter(img => img.exists);
        setImages(existingImages);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Error loading images:', error);
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    };
    if (companyCode && exchange) {
      loadImages();
    }
  }, [companyCode, exchange, generateImagePaths, checkImageExists]);
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!companyCode || !exchange) return;
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
  }, [handleNext, handlePrevious, companyCode, exchange]);
  const currentImage = images[currentIndex];
  if (!companyCode || !exchange) {
    return null;
  }
  return (
    <div className={`flex gap-4 ${isMaximized ? 'fixed inset-4 z-50' : 'w-full'}`}>
      {}
      <Card className={`bg-zinc-800 shadow-lg ${isMaximized ? 'flex-1' : 'flex-1'}`}>
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-zinc-700">
          {}
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold text-white">
              {companyCode} - Graph Analysis
            </CardTitle>
            {}
            {images.length > 0 && !isLoading && (
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="h-8 w-8 p-0"
                  disabled={images.length <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-zinc-400 px-2 min-w-[60px] text-center">
                  {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : '0 / 0'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  className="h-8 w-8 p-0"
                  disabled={images.length <= 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {}
            {isLoading && (
              <div className="flex items-center gap-2 ml-4">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-zinc-400">Searching for graphs...</span>
              </div>
            )}
          </div>
          {}
          <div className="flex items-center gap-2">
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
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-zinc-400 mb-2">Searching for graphs...</p>
                <p className="text-sm text-zinc-500">
                  Looking for {companyCode} analysis images
                </p>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <p className="text-zinc-400 mb-2">No graphs found for {companyCode}</p>
                <p className="text-sm text-zinc-500">
                  Date: {getCurrentDateString()}
                </p>
              </div>
            </div>
          ) : (
            <>
              {}
              <div className="p-4 border-b border-zinc-700 bg-zinc-700/30">
                <h3 className="font-medium text-sm text-white">{currentImage?.name}</h3>
                <p className="text-xs text-zinc-400">{currentImage?.type}</p>
              </div>
              {}
              <div className={`relative overflow-hidden bg-zinc-900 ${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-96'}`}>
                {currentImage && (
                  <img
                    src={currentImage.src}
                    alt={currentImage.name}
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                  />
                )}
              </div>
              {}
              {images.length > 1 && (
                <div className="p-2 border-t border-zinc-700 bg-zinc-700/30">
                  <div className="flex justify-center gap-1">
                    {images.map((_, index) => (
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
        </CardContent>
      </Card>
      {}
      <div className={`${isMaximized ? 'w-96' : 'w-80'} flex-shrink-0`}>
        <NewsComponent companyCode={companyCode} isMaximized={isMaximized} />
      </div>
    </div>
  );
};

