'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Base URL for on-prem server hosting the graph images
// Using the proxied path to avoid CORS issues
const ONPREM_BASE_URL = '/watchlist-graphs';

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
  isOpen: boolean;
  onClose: () => void;
  companyCode: string;
  exchange: string;
  selectedDate?: Date | string; // Accept both Date and string
}

interface CarouselImage {
  src: string;
  name: string;
  type: string;
  exists: boolean;
}
export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  isOpen,
  onClose,
  companyCode,
  exchange,
  selectedDate
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 900 });
  
  // Log when component receives new props
  React.useEffect(() => {
    const dateValue = typeof selectedDate === 'string' 
      ? selectedDate 
      : selectedDate?.toISOString().split('T')[0];
    
    console.log('🖼️ [ImageCarousel] Props updated:', {
      isOpen,
      companyCode,
      exchange,
      selectedDate: dateValue,
      dateType: typeof selectedDate
    });
  }, [isOpen, companyCode, exchange, selectedDate]);
  
  const getCurrentDateString = useCallback(() => {
    // Handle both string and Date types
    let dateStr: string;
    
    if (typeof selectedDate === 'string') {
      // Already a string in YYYY-MM-DD format - use it directly without conversion
      dateStr = selectedDate;
      console.log('📅 [ImageCarousel] Using date string directly:', dateStr);
    } else if (selectedDate instanceof Date) {
      // Convert Date to YYYY-MM-DD using local time (not UTC)
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
      console.log('📅 [ImageCarousel] Converted Date to local string:', dateStr);
    } else {
      // Fallback to current date using local time
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
      console.log('📅 [ImageCarousel] Using current date (fallback):', dateStr);
    }
    
    console.log('📅 [ImageCarousel] Final date string for graphs:', dateStr);
    
    return dateStr;
  }, [selectedDate]);
  const generateImagePaths = useCallback(() => {
    if (!companyCode || !exchange) return [];
    const dateString = getCurrentDateString();
    const companyExchange = `${companyCode}_${exchange}`;
    const imageList: CarouselImage[] = [];

    // Pattern 1: N1 Pattern Plot - Combined Overlay
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/N1_Pattern_Plot/360ONE_NSE/360ONE_NSE_combined_overlay.png
    const pattern1Path = `${ONPREM_BASE_URL}/${dateString}/N1_Pattern_Plot/${companyExchange}/${companyExchange}_combined_overlay.png`;
    imageList.push({
      src: pattern1Path,
      name: `${companyCode} Combined Overlay`,
      type: 'N1 Pattern Analysis',
      exists: false
    });

    // Pattern 2: Watchlist Comparison - Confusion Heatmaps for each index
    // URL: http://100.93.172.21:6969/Watchlist_assets/2025-05-08/watchlist_comp_ind_90d_analysis_plot/360ONE_NSE_2025-05-08/360ONE_NIFTY50_No_category_confusion_heatmap.png
    ACTUAL_INDICES.forEach(index => {
      // Try both "Yes" and "No" category variations
      ['Yes', 'No'].forEach(category => {
        const pattern2Path = `${ONPREM_BASE_URL}/${dateString}/watchlist_comp_ind_90d_analysis_plot/${companyExchange}_${dateString}/${companyCode}_${index}_${category}_category_confusion_heatmap.png`;
        imageList.push({
          src: pattern2Path,
          name: `${companyCode} vs ${index} - ${category} Category`,
          type: 'Confusion Heatmap Analysis',
          exists: false
        });
      });
    });

    return imageList;
  }, [companyCode, exchange, getCurrentDateString]);
  const checkImageExists = useCallback(async (imageSrc: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
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
    if (isOpen && companyCode && exchange) {
      loadImages();
    }
  }, [isOpen, companyCode, exchange, generateImagePaths, checkImageExists]);
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, handleNext, handlePrevious, onClose]);
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(400, startWidth + (e.clientX - startX));
      const newHeight = Math.max(300, startHeight + (e.clientY - startY));
      setDimensions({ width: newWidth, height: newHeight });
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isMaximized, dimensions]);
  if (!isOpen) return null;
  const currentImage = images[currentIndex];
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <Card 
        className={`bg-background border border-border shadow-2xl ${
          isMaximized 
            ? 'w-[95vw] h-[95vh]' 
            : `${isResizing ? 'transition-none' : 'transition-all duration-200'}`
        }`}
        style={!isMaximized ? { 
          width: dimensions.width, 
          height: dimensions.height,
          minWidth: 400,
          minHeight: 300
        } : {}}
      >
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
          {}
          <div className="flex items-center gap-4">
            <CardTitle className="text-lg font-semibold">
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
                <span className="text-sm text-muted-foreground px-2 min-w-[60px] text-center">
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
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Searching for graphs...</span>
              </div>
            )}
          </div>
          {}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground mb-2">Searching for graphs...</p>
                <p className="text-sm text-muted-foreground">
                  Looking for {companyCode} analysis images
                </p>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">No graphs found for {companyCode}</p>
                <p className="text-sm text-muted-foreground">
                  Date: {getCurrentDateString()}
                </p>
              </div>
            </div>
          ) : (
            <>
              {}
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-medium text-sm">{currentImage?.name}</h3>
                <p className="text-xs text-muted-foreground">{currentImage?.type}</p>
              </div>
              {/* Image Display */}
              <div className="flex-1 relative overflow-hidden">
                {currentImage && (
                  // eslint-disable-next-line @next/next/no-img-element
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
                <div className="p-2 border-t bg-muted/30">
                  <div className="flex justify-center gap-1">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        onClick={() => setCurrentIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {}
          {!isMaximized && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-muted-foreground/50"></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

