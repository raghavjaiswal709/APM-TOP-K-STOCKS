'use client';
import React from 'react';
import { Button } from "@/components/ui/button";
import { BarChart3, ExternalLink } from "lucide-react";

interface ViewInDashboardButtonProps {
  companyCode: string;
  exchange: string;
  watchlist?: string;
  interval?: string;
  variant?: "default" | "outline" | "ghost" | "card";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

export const ViewInDashboardButton: React.FC<ViewInDashboardButtonProps> = ({
  companyCode,
  exchange,
  watchlist = 'A',
  interval = '1h',
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false
}) => {
  const handleViewInDashboard = () => {
    if (!companyCode || !exchange) {
      console.warn('Company code or exchange not provided');
      return;
    }

    // Build URL with query parameters
    const params = new URLSearchParams({
      company: companyCode,
      exchange: exchange,
      watchlist: watchlist,
      interval: interval,
      autoLoad: 'true'
    });

    const dashboardUrl = `/dashboard?${params.toString()}`;
    
    // Open in new tab
    window.open(dashboardUrl, '_blank');
  };

  const getButtonContent = () => {
    switch (variant) {
      case "card":
        return (
          <>
            <BarChart3 className="h-4 w-4" />
            <span>View in Dashboard</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </>
        );
      default:
        return (
          <>
            <BarChart3 className="h-4 w-4" />
            {size !== "sm" && <span>Dashboard</span>}
            <ExternalLink className="h-3 w-3 opacity-70" />
          </>
        );
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case "sm":
        return "h-8 px-2 text-xs";
      case "lg":
        return "h-12 px-6 text-base";
      default:
        return "h-9 px-4 text-sm";
    }
  };

  return (
    <Button
      onClick={handleViewInDashboard}
      variant={variant}
      disabled={disabled || !companyCode || !exchange}
      className={`${getButtonSize()} flex items-center gap-2 ${className}`}
      title={`Open ${companyCode} in Dashboard (New Tab)`}
    >
      {getButtonContent()}
    </Button>
  );
};

export default ViewInDashboardButton;
