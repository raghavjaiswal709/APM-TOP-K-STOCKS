'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ImageIcon, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { fetchSthitiCharts, type SthitiChartFile } from '@/lib/historicalSthitiService';

interface HistoricalChartCarouselProps {
  companyCode: string;
  selectedDate: string; // YYYY-MM-DD format
  overallSentiment?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

type TabType = '1D' | 'lstmae' | 'sippr' | 'msax';

export const HistoricalChartCarousel: React.FC<HistoricalChartCarouselProps> = ({
  companyCode,
  selectedDate,
  overallSentiment = 'NEUTRAL',
}) => {
  const [charts, setCharts] = useState<SthitiChartFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('1D');

  useEffect(() => {
    if (!companyCode || !selectedDate) {
      setCharts([]);
      return;
    }

    const loadCharts = async () => {
      setLoading(true);
      setError(null);

      try {
        const chartData = await fetchSthitiCharts(companyCode, selectedDate);
        setCharts(chartData);

        if (chartData.length === 0) {
          setError('No historical charts available for this date');
        }
      } catch (err) {
        console.error('[HistoricalChartCarousel] Error:', err);
        setError('Failed to load historical charts');
      } finally {
        setLoading(false);
      }
    };

    loadCharts();
  }, [companyCode, selectedDate]);

  const getSentimentGradient = () => {
    switch (overallSentiment) {
      case 'POSITIVE':
        return 'from-green-500/10 to-green-900/10 border-green-500/40';
      case 'NEGATIVE':
        return 'from-red-500/10 to-red-900/10 border-red-500/40';
      default:
        return 'from-zinc-500/30 to-zinc-600/20 border-zinc-500/40';
    }
  };

  const getSentimentIcon = () => {
    switch (overallSentiment) {
      case 'POSITIVE':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'NEGATIVE':
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <Minus className="h-4 w-4 text-zinc-400" />;
    }
  };

  // Filter charts by type
  const getChartsForTab = (tabName: string) => {
    if (tabName === '1D') {
      return charts.filter(c => 
        c.filename.toLowerCase().includes('interday') || 
        c.filename.toLowerCase().includes('intraday') ||
        c.filename.toLowerCase().includes('1d')
      );
    }
    return charts.filter(c => c.filename.toLowerCase().includes(tabName.toLowerCase()));
  };

  const activeCharts = getChartsForTab(activeTab);

  return (
    <Card className={`w-full bg-gradient-to-r ${getSentimentGradient()} backdrop-blur-sm border-2`}>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-400" />
              <h3 className="text-lg font-semibold">Historical Sthiti Charts</h3>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                <Clock className="h-3 w-3 mr-1" />
                {selectedDate}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {getSentimentIcon()}
              <span className="text-sm font-medium">{overallSentiment}</span>
            </div>
          </div>

          {/* Tabs - DISABLED: lstmae, sippr, msax */}
          <div className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <button
                onClick={() => setActiveTab('1D')}
                className={`flex-1 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
                  activeTab === '1D'
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-zinc-400 hover:text-white'
                }`}
              >
                1D View
              </button>
              <button
                disabled
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-transparent text-zinc-600 cursor-not-allowed flex items-center justify-center gap-2"
              >
                LSTM-AE
                <Badge variant="secondary" className="text-xs">Disabled</Badge>
              </button>
              <button
                disabled
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-transparent text-zinc-600 cursor-not-allowed flex items-center justify-center gap-2"
              >
                SiPR
                <Badge variant="secondary" className="text-xs">Disabled</Badge>
              </button>
              <button
                disabled
                className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-transparent text-zinc-600 cursor-not-allowed flex items-center justify-center gap-2"
              >
                MSAX
                <Badge variant="secondary" className="text-xs">Disabled</Badge>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === '1D' && (
              <div>
                {loading ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                      <p className="text-sm text-muted-foreground">Loading historical charts...</p>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center space-y-2">
                      <ImageIcon className="h-12 w-12 mx-auto text-zinc-600" />
                      <p className="text-sm text-muted-foreground">{error}</p>
                    </div>
                  </div>
                ) : activeCharts.length === 0 ? (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center space-y-2">
                      <ImageIcon className="h-12 w-12 mx-auto text-zinc-600" />
                      <p className="text-sm text-muted-foreground">No charts available for this view</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCharts.map((chart, index) => (
                      <div key={index} className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={chart.url}
                          alt={chart.filename}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            // Show error indicator
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector('.error-placeholder')) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'error-placeholder flex items-center justify-center h-full text-zinc-500';
                              errorDiv.innerHTML = '<span class="text-sm">Image failed to load</span>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                          onLoad={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.opacity = '1';
                          }}
                          style={{ opacity: 0, transition: 'opacity 0.3s ease-in-out' }}
                        />
                        {/* Chart type badge */}
                        <div className="absolute top-2 right-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              chart.type === 'intraday' 
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                                : chart.type === 'interday'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                            }`}
                          >
                            {chart.type?.toUpperCase() || 'CHART'}
                          </Badge>
                        </div>
                        {/* Filename badge at bottom */}
                        <div className="absolute bottom-2 left-2 right-2">
                          <Badge variant="secondary" className="text-xs truncate max-w-full bg-black/60 backdrop-blur-sm">
                            {chart.filename}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
