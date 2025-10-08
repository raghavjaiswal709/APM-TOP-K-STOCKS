// components/lstmae/LSTMAEVisualization.tsx
'use client';

import React, { useMemo } from 'react';
import { LSTMAEImageCard } from './LSTMAEImageCard';
import { LSTMAE_CONSTANTS } from '../../constants/lstmae.constants';
import type { LSTMAEDashboardResponse } from '../../types/lstmae.types';

interface LSTMAEVisualizationProps {
  dashboard: LSTMAEDashboardResponse;
  onImageClick?: (visualizationType: string) => void;
}

/**
 * Main visualization grid component
 * Displays all 4 static PNG visualizations (Section 3.1)
 */
export const LSTMAEVisualization: React.FC<LSTMAEVisualizationProps> = ({
  dashboard,
  onImageClick,
}) => {
  const visualizations = useMemo(() => {
    return LSTMAE_CONSTANTS.VISUALIZATIONS.map((viz) => {
      let imagePath = '';

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
      }

      return {
        visualization: viz,
        imagePath,
      };
    });
  }, [dashboard]);

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${LSTMAE_CONSTANTS.UI.GRID_LAYOUT.COLS}, 1fr)`,
        gridTemplateRows: `repeat(${LSTMAE_CONSTANTS.UI.GRID_LAYOUT.ROWS}, 1fr)`,
        gap: `${LSTMAE_CONSTANTS.UI.GRID_LAYOUT.GAP}px`,
      }}
    >
      {visualizations.map(({ visualization, imagePath }, index) => (
        <LSTMAEImageCard
          key={visualization.type}
          visualization={visualization}
          imagePath={imagePath}
          onImageClick={onImageClick ? () => onImageClick(visualization.type) : undefined}
          priority={index === 0} // Priority load for first image
        />
      ))}
    </div>
  );
};
