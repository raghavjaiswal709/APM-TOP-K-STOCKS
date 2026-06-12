'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Calendar, ArrowRight, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getMarketStatusMessage } from '@/lib/marketHours';

interface MarketClosedBannerProps {
  className?: string;
  variant?: 'bar' | 'overlay';
}

export const MarketClosedBanner: React.FC<MarketClosedBannerProps> = ({
  className = '',
  variant = 'bar',
}) => {
  const [marketStatus, setMarketStatus] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  React.useEffect(() => {
    const updateStatus = () => setMarketStatus(getMarketStatusMessage());
    updateStatus();
    const interval = setInterval(updateStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!marketStatus || marketStatus.isOpen) return null;

  if (variant === 'overlay') {
    return (
      <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm ${className}`}>
        <div className="flex flex-col items-center gap-6 p-10 w-full max-w-2xl text-center">
          <div className="w-24 h-24 rounded-full bg-amber-950/50 border-2 border-amber-900/60 flex items-center justify-center shadow-lg shadow-amber-950/20">
            <Clock className="h-12 w-12 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-amber-500 whitespace-nowrap">{marketStatus.title}</h2>
            <p className="text-base text-muted-foreground leading-relaxed whitespace-nowrap">{marketStatus.message}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Next Open: 9:15 AM IST</span>
          </div>
          <Link href="/recommendations">
            <Button
              variant="outline"
              className="gap-2 border-amber-900/50 hover:bg-amber-950/30 hover:text-amber-400 text-muted-foreground"
            >
              <TrendingUp className="h-4 w-4" />
              View Recommendations
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-amber-950/30 border-b border-amber-900/50 px-4 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm ${className}`}>
      <div className="flex items-center gap-2 text-center sm:text-left">
        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="font-semibold text-amber-500">{marketStatus.title}</span>
          <span className="hidden sm:inline text-amber-500/50">•</span>
          <span className="text-muted-foreground">{marketStatus.message}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden md:inline-flex text-xs text-muted-foreground items-center gap-1.5 bg-muted/20 px-2 py-0.5 rounded">
          <Calendar className="h-3 w-3" />
          <span>Next Open: 9:15 AM</span>
        </span>

        <Link href="/recommendations">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 hover:bg-amber-950/50 hover:text-amber-400 text-muted-foreground"
          >
            <TrendingUp className="h-3 w-3" />
            View Recs
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default MarketClosedBanner;
