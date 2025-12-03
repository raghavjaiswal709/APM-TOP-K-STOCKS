'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchSthitiChartImages, type SthitiChartImage } from '@/lib/sthitiService';

interface SthitiImageCarouselProps {
  symbol: string;
  date: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SthitiImageCarousel: React.FC<SthitiImageCarouselProps> = ({
  symbol,
  date,
  isOpen,
  onClose,
}) => {
  const [images, setImages] = useState<SthitiChartImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fetch images when modal opens
  useEffect(() => {
    const loadImages = async () => {
      if (!isOpen || !symbol || !date) return;

      setIsLoading(true);
      setImageError(false);
      
      try {
        const chartImages = await fetchSthitiChartImages(symbol, date);
        setImages(chartImages);
        setCurrentIndex(0);
      } catch (error) {
        console.error('[SthitiCarousel] Error loading images:', error);
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, [isOpen, symbol, date]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setImageError(false);
  }, [images.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setImageError(false);
  }, [images.length]);

  // Keyboard navigation
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

  if (!isOpen) return null;

  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl bg-zinc-900 border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-4">
            <CardTitle className="text-white">
              {symbol} - Sthiti Analysis Charts
            </CardTitle>
            {currentImage && (
              <Badge variant="secondary">
                {currentImage.type.toUpperCase()}
              </Badge>
            )}
          </div>

          {images.length > 0 && !isLoading && (
            <div className="flex items-center gap-2">
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
                {currentIndex + 1} / {images.length}
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

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[600px] gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
              <p className="text-zinc-400">Loading charts for {symbol}...</p>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[600px] gap-4">
              <ImageIcon className="h-16 w-16 text-zinc-600" />
              <p className="text-zinc-400">No charts available for {symbol} on {date}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative bg-zinc-800 rounded-lg overflow-hidden h-[600px]">
                {imageError ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-zinc-400">Failed to load image</p>
                  </div>
                ) : (
                  <Image
                    src={currentImage.url}
                    alt={`${symbol} ${currentImage.type} chart`}
                    width={1200}
                    height={600}
                    className="w-full h-auto max-h-[600px] object-contain"
                    onError={() => setImageError(true)}
                    unoptimized
                  />
                )}
              </div>

              {currentImage && (
                <div className="flex items-center justify-between bg-zinc-800 p-4 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {currentImage.filename}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Chart Type: {currentImage.type}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
