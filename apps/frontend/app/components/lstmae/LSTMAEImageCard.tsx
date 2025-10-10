// components/lstmae/LSTMAEImageCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, AlertCircle, ZoomIn } from 'lucide-react';
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

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{visualization.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{visualization.description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="relative bg-gray-100"
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
              <Image
                src={imagePath}
                alt={visualization.title}
                fill
                className="object-contain"
                priority={priority}
                onError={() => setError(true)}
              />
              {onImageClick && (
                <button
                  onClick={onImageClick}
                  className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                  aria-label="Zoom image"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
