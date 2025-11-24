// apps/frontend/app/components/sipr/SiprDashboard.tsx
'use client';

import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  Loader2,
  AlertCircle,
  ExternalLink,
  Clock,
  BarChart3,
  Target,
  Zap,
  Calendar,
  Timer,
  ChevronDown,
  ChevronUp,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSiprData } from '../../../hooks/useSiprData';
import type { SiprDashboardProps, SiprPatternInfo } from '../../types/sipr.types';

// ✅ Helper to extract company code without exchange
const extractCompanyCode = (fullCode: string): string => {
  return fullCode.replace(/_(NSE|BSE|MCX|NCDEX)$/, '');
};

// ✅ FIXED: Pattern Card Component with most_frequent_days
const PatternCard: React.FC<{
  pattern: SiprPatternInfo;
  rank: number;
  totalSegments: number;
}> = ({ pattern, rank, totalSegments }) => {
  const [expanded, setExpanded] = useState(false);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200';
      case 2: return 'bg-gray-400/20 border-gray-400/50 text-gray-200';
      case 3: return 'bg-orange-600/20 border-orange-600/50 text-orange-200';
      default: return 'bg-blue-500/20 border-blue-500/50 text-blue-200';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '🏆';
    }
  };

  // ✅ Debug logging
  console.log(`Pattern ${pattern.pattern_id} most_frequent_days:`, pattern.most_frequent_days);

  return (
    <Card className={`border-2 ${getRankColor(rank)} transition-all duration-200 hover:shadow-lg`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getRankIcon(rank)}</span>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Pattern #{pattern.pattern_id}
                <Badge variant="outline" className="ml-2">
                  Rank {rank}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                {pattern.frequency} occurrences • {pattern.percentage.toFixed(2)}% of period
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="hover:bg-white/10"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* ✅ NEW: Most Frequent Days - ALWAYS VISIBLE (not in expanded) */}
        {pattern.most_frequent_days && (
          <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4" />
              Most Frequent Days
            </h4>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const formatDaysDisplay = (days: string | undefined) => {
                  if (!days) return "N/A";
                  // Detect if it covers the full work week
                  if ((days.includes("Monday") && days.includes("Friday") && days.includes("Wednesday")) ||
                    days === "Monday, Tuesday, Wednesday, Thursday, Friday") {
                    return "All Trading Days";
                  }
                  return days;
                };

                return (
                  <Badge
                    variant="outline"
                    className="bg-blue-600/30 border-blue-500/50 text-blue-100 font-medium"
                  >
                    {formatDaysDisplay(pattern.most_frequent_days)}
                  </Badge>
                );
              })()}
            </div>
          </div>
        )}

        {/* Basic Stats - Always Visible */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-purple-500/10 p-3 rounded-lg border border-purple-500/30">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Timer className="h-3 w-3" />
              Avg Length
            </div>
            <p className="text-lg font-bold text-purple-300">
              {pattern.avg_length.toFixed(1)} steps
            </p>
            <p className="text-xs text-gray-500">
              ~{pattern.avg_time_minutes.toFixed(0)} min
            </p>
          </div>

          <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/30">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <BarChart3 className="h-3 w-3" />
              Std Dev
            </div>
            <p className="text-lg font-bold text-blue-300">
              ±{pattern.std_length.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500">
              {pattern.min_length}-{pattern.max_length} range
            </p>
          </div>

          <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/30">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Target className="h-3 w-3" />
              DTW Distance
            </div>
            <p className="text-lg font-bold text-green-300">
              {pattern.avg_distance.toFixed(4)}
            </p>
            <p className="text-xs text-gray-500">
              Similarity score
            </p>
          </div>

          <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/30">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
              <Zap className="h-3 w-3" />
              Overall
            </div>
            <p className="text-lg font-bold text-orange-300">
              {pattern.overall_frequency}
            </p>
            <p className="text-xs text-gray-500">
              {pattern.overall_percentage.toFixed(1)}% total
            </p>
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <>
            <Separator className="my-3 bg-white/10" />

            {/* Time Ranges */}
            <div className="space-y-2 mb-3">
              <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Temporal Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-zinc-800/50 p-3 rounded border border-zinc-700">
                  <p className="text-xs text-gray-400 mb-1">Time Found Range</p>
                  <p className="text-sm font-mono text-gray-200">
                    {pattern.time_found_range || 'N/A'}
                  </p>
                </div>

                <div className="bg-zinc-800/50 p-3 rounded border border-zinc-700">
                  <p className="text-xs text-gray-400 mb-1">Most Prominent Hour</p>
                  <p className="text-sm font-mono text-gray-200">
                    {pattern.most_prominent_range || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-3 bg-white/10" />

            {/* Statistical Summary */}
            <div className="bg-zinc-800/30 p-3 rounded border border-zinc-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">
                Statistical Summary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Min Length:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.min_length} steps</span>
                </div>
                <div>
                  <span className="text-gray-400">Max Length:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.max_length} steps</span>
                </div>
                <div>
                  <span className="text-gray-400">Period Frequency:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.frequency}</span>
                </div>
                <div>
                  <span className="text-gray-400">Overall Frequency:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.overall_frequency}</span>
                </div>
                <div>
                  <span className="text-gray-400">Period %:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.percentage.toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Overall %:</span>
                  <span className="ml-2 font-mono text-gray-200">{pattern.overall_percentage.toFixed(2)}%</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">Avg Duration:</span>
                  <span className="ml-2 font-mono text-gray-200">
                    {pattern.avg_time_minutes.toFixed(1)} minutes
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const SiprDashboard: React.FC<SiprDashboardProps> = ({
  companyCode: fullCompanyCode,
  months = 3,
  className = '',
}) => {
  const companyCode = extractCompanyCode(fullCompanyCode);
  const { top3Patterns, patternReport, loading, error, refresh } = useSiprData(
    companyCode,
    months
  );

  const openVisualization = async (type: 'top3' | 'segmentation' | 'cluster' | 'centroids') => {
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

      const newWindow = window.open(url, `sipr_${type}_${companyCode}`, 'width=1400,height=900');
      if (!newWindow) {
        alert('Popup blocked. Please allow popups for this site.');
      }
    } catch (err) {
      console.error('Failed to open visualization:', err);
    }
  };

  // ✅ Debug logging for top3Patterns
  console.log('SiprDashboard - top3Patterns:', top3Patterns);
  console.log('SiprDashboard - loading state:', loading);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-950/30 to-blue-950/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Activity className="h-7 w-7 text-purple-400" />
                SIPR Pattern Analysis
              </CardTitle>
              <p className="text-lg text-gray-300 mt-2">
                {companyCode}
              </p>
              {top3Patterns && (
                <p className="text-sm text-gray-400 mt-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {top3Patterns.analysis_period.start_date} to {top3Patterns.analysis_period.end_date}
                  <span className="ml-2">({months} months)</span>
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading === 'loading'}
                className="gap-2"
              >
                {loading === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '🔄 Refresh'
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Loading State */}
      {loading === 'loading' && (
        <Card className="border-zinc-700">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-lg text-gray-300">Analyzing patterns...</p>
              <p className="text-sm text-gray-500 mt-2">
                Processing {months} months of data for {companyCode}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-500/50 bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">{error.message}</p>
                {error.suggestion && (
                  <p className="text-sm text-red-400 mt-1">{error.suggestion}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {top3Patterns && patternReport && loading === 'success' && (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-purple-500/30 bg-purple-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">Total Segments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-300">
                  {top3Patterns.total_segments}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  In {months} month period
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/30 bg-blue-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">Unique Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-300">
                  {top3Patterns.top_patterns.length}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Top patterns identified
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-500/30 bg-green-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">Avg Segment Length</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-300">
                  {patternReport.summary.avg_segment_length.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Steps per pattern
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/30 bg-orange-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-gray-400">Analysis Period</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-300">
                  {months}M
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Historical data analyzed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top 3 Patterns - Detailed Cards */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-400" />
              Top 3 Recurring Patterns
            </h2>
            <ScrollArea className="h-auto">
              <div className="space-y-4">
                {top3Patterns.top_patterns.map((pattern, index) => (
                  <PatternCard
                    key={pattern.pattern_id}
                    pattern={pattern}
                    rank={index + 1}
                    totalSegments={top3Patterns.total_segments}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Pattern Distribution Overview */}
          <Card className="border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Pattern Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {top3Patterns.top_patterns.map((pattern, index) => {
                  const percentage = pattern.percentage;
                  return (
                    <div key={pattern.pattern_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-300">
                          Pattern #{pattern.pattern_id}
                        </span>
                        <span className="text-sm font-mono text-gray-400">
                          {percentage.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${index === 0 ? 'bg-yellow-500' :
                              index === 1 ? 'bg-gray-400' :
                                'bg-orange-600'
                            }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {patternReport.recommendations.length > 0 && (
            <Card className="border-green-500/30 bg-green-950/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-300">
                  💡 Insights & Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {patternReport.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-gray-300">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Visualization Buttons */}
          <Card className="border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Interactive Visualizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => openVisualization('top3')}
                  variant="outline"
                  className="gap-2 h-auto py-4"
                  disabled={loading === 'loading'}
                >
                  <div className="text-left">
                    <div className="font-semibold">Top 3 Patterns</div>
                    <div className="text-xs text-gray-500">View detailed pattern clusters</div>
                  </div>
                </Button>
                <Button
                  onClick={() => openVisualization('segmentation')}
                  variant="outline"
                  className="gap-2 h-auto py-4"
                  disabled={loading === 'loading'}
                >
                  <div className="text-left">
                    <div className="font-semibold">Time Series Segmentation</div>
                    <div className="text-xs text-gray-500">Segmented timeline view</div>
                  </div>
                </Button>
                <Button
                  onClick={() => openVisualization('cluster')}
                  variant="outline"
                  className="gap-2 h-auto py-4"
                  disabled={loading === 'loading'}
                >
                  <div className="text-left">
                    <div className="font-semibold">Pattern Clusters</div>
                    <div className="text-xs text-gray-500">All instances with centroid</div>
                  </div>
                </Button>
                <Button
                  onClick={() => openVisualization('centroids')}
                  variant="outline"
                  className="gap-2 h-auto py-4"
                  disabled={loading === 'loading'}
                >
                  <div className="text-left">
                    <div className="font-semibold">Centroid Shapes</div>
                    <div className="text-xs text-gray-500">Representative patterns</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
