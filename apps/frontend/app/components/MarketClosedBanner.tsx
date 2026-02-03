'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Calendar, ArrowRight, TrendingUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getMarketStatusMessage } from '@/lib/marketHours';

interface MarketClosedBannerProps {
  className?: string;
}

/**
 * Banner component that displays when the market is closed
 * Shows appropriate message based on the reason (weekend, holiday, before/after market hours)
 * Includes a link to the recommendations page for more information
 */
export const MarketClosedBanner: React.FC<MarketClosedBannerProps> = ({
  className = '',
}) => {
  const [marketStatus, setMarketStatus] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  // Update market status every minute
  React.useEffect(() => {
    const updateStatus = () => {
      setMarketStatus(getMarketStatusMessage());
    };

    // Initial update
    updateStatus();

    // Update every minute
    const interval = setInterval(updateStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  // Don't render if market is open or status not loaded yet
  if (!marketStatus || marketStatus.isOpen) {
    return null;
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
