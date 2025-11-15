'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Calendar, ArrowRight, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
    <Alert
      className={`border-2 border-zinc-700 bg-zinc-900 ${className}`}
    >
      <div className="flex flex-col items-center justify-center text-center gap-6 py-8">
        <div className="relative">
          <Clock className="h-16 w-16 text-zinc-400" />
        </div>

        <div className="space-y-4 max-w-2xl">
          <AlertTitle className="text-4xl font-bold text-zinc-300 flex items-center justify-center gap-3">
            {marketStatus.title}
          </AlertTitle>

          <AlertDescription className="text-zinc-400 space-y-6">
            <div className="flex items-center justify-center gap-3 text-xl">
              <Calendar className="h-6 w-6 text-zinc-500" />
              <span className="font-medium">{marketStatus.message}</span>
            </div>

            <div className="pt-4 border-t border-zinc-700">
              <p className="text-lg text-zinc-500 mb-6 leading-relaxed">
                Live market data and real-time charts are not available during
                market closure. Historical analysis and AI predictions are still
                accessible.
              </p>

              <div className="flex flex-col items-center gap-4">
                <Link href="/recommendations">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-3 border-zinc-600 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-lg px-8 py-6"
                  >
                    <TrendingUp className="h-6 w-6" />
                    View Recommendations
                    <ArrowRight className="h-6 w-6" />
                  </Button>
                </Link>

                <div className="flex items-center gap-3 text-base text-zinc-500 px-6 py-3 bg-zinc-800/50 rounded-lg">
                  <Clock className="h-5 w-5" />
                  <span>Market Hours: 9:15 AM - 3:30 PM IST</span>
                </div>
              </div>
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};

export default MarketClosedBanner;
