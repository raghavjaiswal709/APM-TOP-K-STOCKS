// components/lstmae/LSTMAEImageCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, AlertCircle, ZoomIn, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LSTMAE_CONSTANTS } from '../../constants/lstmae.constants';
import type { LSTMAEVisualization } from '../../types/lstmae.types';

interface LSTMAEImageCardProps {
  visualization: LSTMAEVisualization;
  imagePath: string;
  onImageClick?: () => void;
  priority?: boolean;
}

export const LSTMAEImageCard: React.FC<LSTMAEImageCardProps> = ({
  visualization,
  imagePath,
  onImageClick,
  priority = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageExists, setImageExists] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!imagePath) {
      setLoading(false);
      setError(true);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    const checkImage = async () => {
      try {
        setLoading(true);
        setError(false);

        if (imagePath.startsWith('blob:')) {
          setImageExists(true);
          setLoading(false);
          return;
        }

        const response = await fetch(imagePath, {
          method: 'HEAD',
          signal: controller.signal,
        });

        if (!mounted) return;

        if (response.ok) {
          setImageExists(true);
          setLoading(false);
        } else {
          setImageExists(false);
          setError(true);
          setLoading(false);
        }
      } catch (err) {
        if (!mounted) return;
        setError(true);
        setLoading(false);
      }
    };

    const timeout = setTimeout(checkImage, 100);

    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [imagePath]);

  // Handle ESC key to close fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isFullscreen]);

  const handleImageClick = () => {
    setIsFullscreen(true);
    if (onImageClick) {
      onImageClick();
    }
  };

  const handleCloseFullscreen = () => {
    setIsFullscreen(false);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsFullscreen(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden transition-shadow hover:shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{visualization.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="relative bg-gray-100 group"
            style={{
              aspectRatio: `${visualization.dimensions.width} / ${visualization.dimensions.height}`,
            }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-red-600">Failed to load visualization</p>
                <p className="text-xs text-gray-500">File may not exist yet</p>
              </div>
            )}

            {!loading && !error && imageExists && (
              <>
                <div
                  className="relative w-full h-full cursor-pointer"
                  onClick={handleImageClick}
                >
                  <Image
                    src={imagePath}
                    alt={visualization.title}
                    fill
                    className="object-contain transition-opacity hover:opacity-90"
                    priority={priority}
                    onError={() => setError(true)}
                  />
                  <div className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                    <ZoomIn className="h-4 w-4" />
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out"
          onClick={handleBackdropClick}
        >
          {/* Close Button */}
          <button
            onClick={handleCloseFullscreen}
            className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-3 text-white transition-all hover:bg-white/20 hover:scale-110 cursor-pointer"
            aria-label="Close fullscreen"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Fullscreen Image Container */}
          <div className="relative w-full h-full p-8 cursor-default">
            <div className="relative w-full h-full">
              <Image
                src={imagePath}
                alt={visualization.title}
                fill
                className="object-contain"
                priority
                quality={100}
              />
            </div>

            {/* Image Title */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 px-6 py-3 rounded-lg">
              <p className="text-white text-sm font-medium text-center">
                {visualization.title}
              </p>
            </div>
          </div>

          {/* ESC hint */}
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-2 rounded text-white text-xs">
            Press <kbd className="px-2 py-1 bg-white/20 rounded">ESC</kbd> to close
          </div>
        </div>
      )}
    </>
  );
};
