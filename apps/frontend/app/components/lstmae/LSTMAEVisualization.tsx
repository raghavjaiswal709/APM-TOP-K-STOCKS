// components/lstmae/LSTMAEVisualization.tsx
'use client';

import React, { useMemo } from 'react';
import { LSTMAEImageCard } from './LSTMAEImageCard';
import { LSTMAE_CONSTANTS } from '../../constants/lstmae.constants';
import type { LSTMAEDashboardResponse, PlotUrls } from '../../types/lstmae.types';

interface LSTMAEVisualizationProps {
  dashboard?: LSTMAEDashboardResponse;
  plotUrls?: PlotUrls;
  onImageClick?: (visualizationType: string) => void;
}

export const LSTMAEVisualization: React.FC<LSTMAEVisualizationProps> = ({
  dashboard,
  plotUrls,
  onImageClick,
}) => {
  const visualizations = useMemo(() => {
    return LSTMAE_CONSTANTS.VISUALIZATIONS.map((viz) => {
      let imagePath = '';

      if (plotUrls) {
        switch (viz.type) {
          case 'dominant_patterns':
            imagePath = plotUrls.dominantPatterns;
            break;
          case 'intraday_patterns':
            imagePath = plotUrls.intraday;
            break;
          case 'cluster_transitions':
            imagePath = plotUrls.clusterTransitions;
            break;
          case 'cluster_timeline':
            imagePath = plotUrls.clusterTimeline;
            break;
          case 'anomalies':
            imagePath = plotUrls.anomalies || '';
            break;
          case 'seasonality':
            imagePath = plotUrls.seasonality || '';
            break;
          case 'transitions_alt':
            imagePath = plotUrls.transitionsAlt || '';
            break;
        }
      } else if (dashboard) {
        switch (viz.type) {
          case 'dominant_patterns':
            imagePath = dashboard.plotPaths.dominantPatterns;
            break;
          case 'intraday_patterns':
            imagePath = dashboard.plotPaths.intraday;
            break;
          case 'cluster_transitions':
            imagePath = dashboard.plotPaths.clusterTransitions;
            break;
          case 'cluster_timeline':
            imagePath = dashboard.plotPaths.clusterTimeline;
            break;
          case 'anomalies':
            imagePath = dashboard.plotPaths.anomalies || '';
            break;
          case 'seasonality':
            imagePath = dashboard.plotPaths.seasonality || '';
            break;
          case 'transitions_alt':
            imagePath = dashboard.plotPaths.transitionsAlt || '';
            break;
        }
      }

      return {
        visualization: viz,
        imagePath,
      };
    });
  }, [dashboard, plotUrls]);

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${LSTMAE_CONSTANTS.UI.GRID_LAYOUT.COLS}, 1fr)`,
        gap: `${LSTMAE_CONSTANTS.UI.GRID_LAYOUT.GAP}px`,
      }}
    >
      {visualizations.map(({ visualization, imagePath }, index) => (
        imagePath && (
          <LSTMAEImageCard
            key={visualization.type}
            visualization={visualization}
            imagePath={imagePath}
            onImageClick={onImageClick ? () => onImageClick(visualization.type) : undefined}
            priority={index === 0}
          />
        )
      ))}
    </div>
  );
};
