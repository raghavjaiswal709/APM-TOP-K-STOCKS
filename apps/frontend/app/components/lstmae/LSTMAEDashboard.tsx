// components/lstmae/LSTMAEDashboard.tsx
'use client';

import React, { useState } from 'react';
import { Maximize2, Minimize2, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LSTMAEModal } from './LSTMAEModal';
import { LSTMAEErrorBoundary } from './LSTMAEErrorBoundary';
import type { LSTMAEDashboardProps } from '@/types/lstmae.types';

/**
 * Main LSTMAE Dashboard Component
 * Entry point for Pipeline 2 Integration
 * Completely isolated from other features
 */
export const LSTMAEDashboard: React.FC<LSTMAEDashboardProps> = ({
  companyCode,
  isMaximized = false,
  onMaximize,
  onMinimize,
  className = '',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <LSTMAEErrorBoundary>
      <Card className={`border-blue-200 ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              LSTMAE Pattern Discovery
            </CardTitle>
            <div className="flex gap-2">
              {isMaximized ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMinimize}
                  className="gap-2"
                >
                  <Minimize2 className="h-4 w-4" />
                  Minimize
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMaximize}
                  className="gap-2"
                >
                  <Maximize2 className="h-4 w-4" />
                  Maximize
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              View comprehensive pattern analysis, cluster transitions, and intraday movement patterns
              powered by Pipeline 2 microservices architecture.
            </p>
            <Button
              onClick={handleOpenModal}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Open Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <LSTMAEModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        companyCode={companyCode}
      />
    </LSTMAEErrorBoundary>
  );
};
