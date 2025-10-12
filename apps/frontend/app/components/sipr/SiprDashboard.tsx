// apps/frontend/app/components/sipr/SiprDashboard.tsx
'use client';

import React, { useState } from 'react';
import { Activity, TrendingUp, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSiprData } from '../../../hooks/useSiprData';
import type { SiprDashboardProps } from '../../types/sipr.types';

export const SiprDashboard: React.FC<SiprDashboardProps> = ({
  companyCode,
  months = 3,
  className = '',
}) => {
  const { top3Patterns, patternReport, loading, error, refresh } = useSiprData(
    companyCode,
    months
  );
  const [viewType, setViewType] = useState<'top3' | 'segmentation' | 'cluster' | 'centroids'>('top3');

  const openVisualization = async (type: typeof viewType) => {
    try {
      let url = '';
      switch (type) {
        case 'top3':
          url = `/api/sipr/${companyCode}/top3-html?months=${months}`;
          break;
        case 'segmentation':
          url = `/api/sipr/${companyCode}/segmentation-html?months=${months}`;
          break;
        case 'cluster':
          url = `/api/sipr/${companyCode}/cluster-html?months=${months}`;
          break;
        case 'centroids':
          url = `/api/sipr/${companyCode}/centroids-html?months=${months}`;
          break;
      }

      const newWindow = window.open(url, `sipr_${type}_${companyCode}`, 'width=1200,height=800');
      if (!newWindow) {
        alert('Popup blocked. Please allow popups for this site.');
      }
    } catch (err) {
      console.error('Failed to open visualization:', err);
    }
  };

  return (
    <Card className={`border-purple-200 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            SIPR Pattern Analysis
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading === 'loading'}
            >
              {loading === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Stats */}
          {patternReport && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Segments</p>
                <p className="text-2xl font-bold text-purple-600">
                  {patternReport.summary.total_segments}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Unique Patterns</p>
                <p className="text-2xl font-bold text-blue-600">
                  {patternReport.summary.unique_patterns}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Avg Segment Length</p>
                <p className="text-2xl font-bold text-green-600">
                  {patternReport.summary.avg_segment_length.toFixed(1)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Analysis Period</p>
                <p className="text-2xl font-bold text-orange-600">
                  {months}M
                </p>
              </div>
            </div>
          )}

          {/* Top 3 Patterns */}
          {top3Patterns && top3Patterns.top_3_patterns.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top 3 Recurring Patterns
              </h3>
              <div className="space-y-2">
                {top3Patterns.top_3_patterns.map((pattern, index) => (
                  <div
                    key={pattern.pattern_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-lg font-bold">
                        #{index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">
                          Pattern {pattern.cluster_label} 
                          <span className="text-sm text-gray-500 ml-2">
                            ({pattern.occurrence_count} occurrences)
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">
                          {pattern.percentage_of_total.toFixed(1)}% of total segments
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={
                        pattern.shape_characteristics.trend === 'increasing' 
                          ? 'default' 
                          : pattern.shape_characteristics.trend === 'decreasing'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {pattern.shape_characteristics.trend}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">{error.message}</p>
                {error.suggestion && (
                  <p className="text-xs mt-1">{error.suggestion}</p>
                )}
              </div>
            </div>
          )}

          {/* Visualization Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => openVisualization('top3')}
              variant="outline"
              className="gap-2"
              disabled={loading === 'loading'}
            >
              <ExternalLink className="h-4 w-4" />
              Top 3 Patterns
            </Button>
            <Button
              onClick={() => openVisualization('segmentation')}
              variant="outline"
              className="gap-2"
              disabled={loading === 'loading'}
            >
              <ExternalLink className="h-4 w-4" />
              Segmentation
            </Button>
            <Button
              onClick={() => openVisualization('cluster')}
              variant="outline"
              className="gap-2"
              disabled={loading === 'loading'}
            >
              <ExternalLink className="h-4 w-4" />
              Cluster Analysis
            </Button>
            <Button
              onClick={() => openVisualization('centroids')}
              variant="outline"
              className="gap-2"
              disabled={loading === 'loading'}
            >
              <ExternalLink className="h-4 w-4" />
              Centroid Shapes
            </Button>
          </div>

          {/* Loading State */}
          {loading === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="ml-2 text-sm text-gray-600">Analyzing patterns...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
