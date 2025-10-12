// components/lstmae/LSTMAEInteractiveDashboard.tsx
'use client';

import React, { useCallback, useState } from 'react';
import { ExternalLink, BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LSTMAE_CONSTANTS } from '../../constants/lstmae.constants';

interface LSTMAEInteractiveDashboardProps {
  dashboardPath: string;
  symbol: string;
  className?: string;
}

export const LSTMAEInteractiveDashboard: React.FC<LSTMAEInteractiveDashboardProps> = ({
  dashboardPath,
  symbol,
  className = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenDashboard = useCallback(async () => {
    if (!dashboardPath) {
      setError('Dashboard path not available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🌐 Fetching dashboard HTML from: ${dashboardPath}`);
      
      // Fetch HTML from backend API
      const response = await fetch(dashboardPath);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const htmlContent = await response.text();
      console.log(`✅ HTML fetched (${htmlContent.length} bytes)`);

      // Open new window and write HTML
      const newWindow = window.open(
        '', 
        `lstmae_dashboard_${symbol}`, 
        LSTMAE_CONSTANTS.DASHBOARD.WINDOW_FEATURES
      );
      
      if (!newWindow) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      newWindow.document.open();
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      newWindow.focus();

      console.log('✅ Dashboard opened successfully');

    } catch (err: any) {
      console.error('❌ Error opening dashboard:', err);
      setError(err.message || 'Failed to open dashboard');
    } finally {
      setLoading(false);
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
          {/* <p className="mt-1 text-sm text-gray-600">
            Interactive Plotly dashboard with zoom, pan, and hover tooltips for detailed pattern analysis.
          </p> */}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        onClick={handleOpenDashboard}
        disabled={loading || !dashboardPath}
        className="gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Dashboard...
          </>
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            {LSTMAE_CONSTANTS.UI.INTERACTIVE_DASHBOARD_BUTTON_TEXT}
          </>
        )}
      </Button>

      {/* <p className="text-xs text-gray-500">
        Opens in new window • Self-contained HTML • No external dependencies
      </p> */}
    </div>
  );
};
