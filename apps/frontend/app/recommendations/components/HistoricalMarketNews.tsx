'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Newspaper, Clock, ExternalLink } from 'lucide-react';
import { fetchSthitiHeadlines, type SthitiHeadline } from '@/lib/historicalSthitiService';

interface HistoricalMarketNewsProps {
  companyCode?: string;
  selectedDate?: string; // YYYY-MM-DD format
  // Alternative prop names for flexibility
  symbol?: string;
  date?: string;
}

export const HistoricalMarketNews: React.FC<HistoricalMarketNewsProps> = ({
  companyCode,
  selectedDate,
  symbol,
  date,
}) => {
  // Support both prop naming conventions
  const effectiveCompanyCode = companyCode || symbol || '';
  const effectiveDate = selectedDate || date || '';
  
  const [headlines, setHeadlines] = useState<SthitiHeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveCompanyCode || !effectiveDate) {
      setHeadlines([]);
      return;
    }

    const loadHeadlines = async () => {
      setLoading(true);
      setError(null);

      try {
        const headlineData = await fetchSthitiHeadlines(effectiveCompanyCode, effectiveDate);
        setHeadlines(headlineData);

        if (headlineData.length === 0) {
          setError('No headlines available for this date');
        }
      } catch (err) {
        console.error('[HistoricalMarketNews] Error:', err);
        setError('Failed to load headlines');
      } finally {
        setLoading(false);
      }
    };

    loadHeadlines();
  }, [effectiveCompanyCode, effectiveDate]);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment.toUpperCase()) {
      case 'POSITIVE':
        return {
          bg: 'bg-green-500/10',
          text: 'text-green-400',
          border: 'border-green-500/30',
        };
      case 'NEGATIVE':
        return {
          bg: 'bg-red-500/10',
          text: 'text-red-400',
          border: 'border-red-500/30',
        };
      default:
        return {
          bg: 'bg-zinc-500/10',
          text: 'text-zinc-400',
          border: 'border-zinc-500/30',
        };
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card className="w-full bg-zinc-800 border-zinc-700">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold">Market News</h3>
            </div>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
              <Clock className="h-3 w-3 mr-1" />
              {selectedDate}
            </Badge>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <p className="text-sm text-muted-foreground">Loading headlines...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-2">
                <Newspaper className="h-12 w-12 mx-auto text-zinc-600" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : headlines.length === 0 ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center space-y-2">
                <Newspaper className="h-12 w-12 mx-auto text-zinc-600" />
                <p className="text-sm text-muted-foreground">No headlines available</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {headlines.map((headline, index) => {
                  const sentimentStyle = getSentimentStyle(headline.gpt4o_sentiment);
                  
                  return (
                    <Card key={index} className="bg-zinc-900/50 border-zinc-700 hover:border-zinc-600 transition-colors">
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          {/* Headline Text */}
                          <p className="text-sm text-zinc-200 leading-relaxed">
                            {headline.text}
                          </p>

                          {/* Meta Info */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                {headline.source}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(headline.timestamp)}
                              </span>
                            </div>

                            {/* Sentiment Badge */}
                            <Badge 
                              variant="outline" 
                              className={`${sentimentStyle.bg} ${sentimentStyle.text} ${sentimentStyle.border} text-xs`}
                            >
                              {headline.gpt4o_sentiment}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Footer */}
          {headlines.length > 0 && (
            <div className="pt-2 border-t border-zinc-700">
              <p className="text-xs text-zinc-500 text-center">
                {headlines.length} headline{headlines.length !== 1 ? 's' : ''} from {effectiveDate}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
