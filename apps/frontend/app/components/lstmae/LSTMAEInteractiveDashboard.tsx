// components/lstmae/LSTMAEInteractiveDashboard.tsx
'use client';

import React, { useCallback } from 'react';
import { ExternalLink, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LSTMAE_CONSTANTS } from '../../constants/lstmae.constants';

interface LSTMAEInteractiveDashboardProps {
  dashboardPath: string;
  symbol: string;
  className?: string;
}

/**
 * Interactive HTML Dashboard Handler
 * Opens self-contained HTML dashboard in new window (Section 3.1)
 */
export const LSTMAEInteractiveDashboard: React.FC<LSTMAEInteractiveDashboardProps> = ({
  dashboardPath,
  symbol,
  className = '',
}) => {
  const handleOpenDashboard = useCallback(() => {
    if (!dashboardPath) {
      console.error('Dashboard path not available');
      return;
    }

    // Open in new window with specific dimensions (from document)
    const windowFeatures = LSTMAE_CONSTANTS.DASHBOARD.WINDOW_FEATURES;
    const newWindow = window.open(dashboardPath, `lstmae_dashboard_${symbol}`, windowFeatures);

    if (!newWindow) {
      alert('Please allow popups for this site to view the interactive dashboard');
    } else {
      newWindow.focus();
    }
  }, [dashboardPath, symbol]);

  return (
    <div className={`flex flex-col gap-4 rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-100 p-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {LSTMAE_CONSTANTS.DASHBOARD.TITLE}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Interactive Plotly dashboard with zoom, pan, and hover tooltips for detailed pattern analysis.
          </p>
        </div>
      </div>
      <Button
        onClick={handleOpenDashboard}
        className="gap-2 bg-blue-600 hover:bg-blue-700"
        size="lg"
      >
        <ExternalLink className="h-4 w-4" />
        {LSTMAE_CONSTANTS.UI.INTERACTIVE_DASHBOARD_BUTTON_TEXT}
      </Button>
      <p className="text-xs text-gray-500">
        Opens in new window • Self-contained HTML • No external dependencies
      </p>
    </div>
  );
};
