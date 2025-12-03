'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchSthitiHeadlines, type SthitiHeadline } from '@/lib/sthitiService';

interface SthitiMarketNewsProps {
  symbol: string;
  date: string;
}

export const SthitiMarketNews: React.FC<SthitiMarketNewsProps> = ({ symbol, date }) => {
  const [headlines, setHeadlines] = useState<SthitiHeadline[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadHeadlines = async () => {
      if (!symbol || !date) return;

      setIsLoading(true);
      try {
        const data = await fetchSthitiHeadlines(symbol, date);
        setHeadlines(data);
      } catch (error) {
        console.error('[SthitiNews] Error loading headlines:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHeadlines();
  }, [symbol, date]);

  const getSentimentIcon = (sentiment: string) => {
    const sentimentLower = sentiment.toLowerCase();
    if (sentimentLower.includes('positive') || sentimentLower.includes('bullish')) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (sentimentLower.includes('negative') || sentimentLower.includes('bearish')) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-zinc-500" />;
  };

  const getSentimentColor = (sentiment: string) => {
    const sentimentLower = sentiment.toLowerCase();
    if (sentimentLower.includes('positive') || sentimentLower.includes('bullish')) {
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
    if (sentimentLower.includes('negative') || sentimentLower.includes('bearish')) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20';
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Market News & Headlines
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : headlines.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No headlines available</p>
        ) : (
          <div className="space-y-3">
            {headlines.map((headline, idx) => (
              <div
                key={idx}
                className="p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getSentimentIcon(headline.sentiment)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm leading-relaxed">
                      {headline.text}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge 
                        variant="outline" 
                        className={getSentimentColor(headline.sentiment)}
                      >
                        {headline.sentiment}
                      </Badge>
                      {headline.source && (
                        <span className="text-xs text-zinc-500">
                          {headline.source}
                        </span>
                      )}
                      {headline.timestamp && (
                        <span className="text-xs text-zinc-500">
                          {new Date(headline.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
