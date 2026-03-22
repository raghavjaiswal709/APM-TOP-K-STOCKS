'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  LogIn,
  LogOut,
  DollarSign,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { Position, TradeEntry } from '@/types/portfolio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PortfolioModeProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectedCompany: string | null;
  selectedCompanyName: string;
  exchange: string;
  currentPrice: number;
}

export function PortfolioMode({
  enabled,
  onToggle,
  selectedCompany,
  selectedCompanyName,
  exchange,
  currentPrice,
}: PortfolioModeProps) {
  const { getPosition, enterMarket, exitMarket, positions, refresh } = usePortfolio();
  
  const [showTradeDialog, setShowTradeDialog] = useState(false);
  const [tradeAction, setTradeAction] = useState<'IN' | 'OUT'>('IN');
  const [shares, setShares] = useState<number>(100);
  const [price, setPrice] = useState<number>(currentPrice);
  const [notes, setNotes] = useState<string>('');
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  
  // Get current position for selected company
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);

  useEffect(() => {
    if (selectedCompany && enabled) {
      const position = getPosition(selectedCompany);
      setCurrentPosition(position);
    } else {
      setCurrentPosition(null);
    }
  }, [selectedCompany, enabled, getPosition, positions]);

  // Only sync price from live feed when user hasn't manually edited it
  useEffect(() => {
    if (!priceManuallyEdited) {
      setPrice(currentPrice);
    }
  }, [currentPrice, priceManuallyEdited]);

  const handleOpenTrade = (action: 'IN' | 'OUT') => {
    if (!selectedCompany) {
      toast.error('Please select a company first');
      return;
    }
    
    setTradeAction(action);
    setPrice(currentPrice);
    setPriceManuallyEdited(false);
    
    if (action === 'OUT' && currentPosition) {
      setShares(currentPosition.shares);
    } else {
      setShares(100);
    }
    
    setShowTradeDialog(true);
  };

  const handleExecuteTrade = () => {
    if (!selectedCompany) return;
    
    if (shares <= 0 || price <= 0) {
      toast.error('Shares and price must be positive numbers');
      return;
    }

    if (tradeAction === 'OUT' && currentPosition && shares > currentPosition.shares) {
      toast.error(`Cannot sell more than ${currentPosition.shares} shares`);
      return;
    }

    const entry: TradeEntry = {
      companyCode: selectedCompany,
      companyName: selectedCompanyName || selectedCompany,
      exchange: exchange || 'NSE',
      tradeType: tradeAction === 'IN' ? 'BUY' : 'SELL',
      shares,
      pricePerShare: price,
      timestamp: new Date().toISOString(),
      notes,
    };

    const trade = tradeAction === 'IN' ? enterMarket(entry) : exitMarket(entry);

    if (trade) {
      toast.success(
        tradeAction === 'IN'
          ? `✅ Entered market: ${shares} shares of ${selectedCompany} @ ₹${price.toFixed(2)}`
          : `✅ Exited market: ${shares} shares of ${selectedCompany} @ ₹${price.toFixed(2)}`
      );
      setShowTradeDialog(false);
      setNotes('');
      setPriceManuallyEdited(false);
      refresh();
    }
  };

  const totalValue = shares * price;

  // Calculate P&L if selling
  const calculatePnL = () => {
    if (!currentPosition || tradeAction === 'IN') return null;
    const avgEntry = currentPosition.avgEntryPrice;
    const pnL = (price - avgEntry) * shares;
    const pnLPercent = ((price - avgEntry) / avgEntry) * 100;
    return { pnL, pnLPercent };
  };

  const pnLData = calculatePnL();

  return (
    <>
      {/* Portfolio Mode Toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggle(!enabled)}
              className={cn(
                "h-7 text-xs gap-1.5 transition-colors border",
                enabled
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/15"
                  : "text-muted-foreground border-border hover:bg-muted/60"
              )}
            >
              <Briefcase className="h-3 w-3" />
              Portfolio
              {enabled && (
                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded">
                  ON
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{enabled ? 'Click to disable Portfolio Mode' : 'Enable Portfolio Mode to track trades'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* IN/OUT Buttons - Only shown when Portfolio Mode is enabled */}
      {enabled && selectedCompany && (
        <div className="flex items-center gap-1.5">
          {/* Current Position Badge */}
          {currentPosition && currentPosition.status === 'HOLDING' && (
            <span className="h-7 px-2 inline-flex items-center gap-1 text-xs font-medium rounded-md border bg-blue-500/8 text-blue-600 dark:text-blue-400 border-blue-500/20">
              <Hash className="h-2.5 w-2.5" />
              {currentPosition.shares} @ ₹{currentPosition.avgEntryPrice.toFixed(2)}
            </span>
          )}

          {/* IN Button (Buy) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenTrade('IN')}
            className="h-7 text-xs gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15"
          >
            <LogIn className="h-3 w-3" />
            IN
          </Button>

          {/* OUT Button (Sell) - Only if holding position */}
          {currentPosition && currentPosition.status === 'HOLDING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenTrade('OUT')}
              className="h-7 text-xs gap-1 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25 hover:bg-red-500/15"
            >
              <LogOut className="h-3 w-3" />
              OUT
            </Button>
          )}
        </div>
      )}

      {/* Trade Dialog */}
      <Dialog open={showTradeDialog} onOpenChange={setShowTradeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tradeAction === 'IN' ? (
                <>
                  <LogIn className="h-5 w-5 text-green-600" />
                  <span>Enter Market</span>
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5 text-red-600" />
                  <span>Exit Market</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {tradeAction === 'IN'
                ? `Buy shares of ${selectedCompanyName || selectedCompany}`
                : `Sell shares of ${selectedCompanyName || selectedCompany}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Company Info */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-semibold">{selectedCompany}</p>
                <p className="text-sm text-muted-foreground">{selectedCompanyName}</p>
              </div>
              <Badge>{exchange}</Badge>
            </div>

            {/* Current Position (if selling) */}
            {currentPosition && currentPosition.status === 'HOLDING' && tradeAction === 'OUT' && (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <p className="text-sm font-medium text-blue-600">Current Position</p>
                <p className="text-lg font-bold">{currentPosition.shares} shares</p>
                <p className="text-sm text-muted-foreground">
                  Avg Entry: ₹{currentPosition.avgEntryPrice.toFixed(2)}
                </p>
              </div>
            )}

            {/* Shares Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Shares</label>
              <Input
                type="number"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
                className="col-span-3"
                min={1}
                max={tradeAction === 'OUT' && currentPosition ? currentPosition.shares : undefined}
              />
            </div>

            {/* Price Input */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Price (₹)</label>
              <div className="col-span-3 flex gap-2">
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => {
                    setPrice(Number(e.target.value));
                    setPriceManuallyEdited(true);
                  }}
                  className="flex-1"
                  min={0.01}
                  step={0.01}
                />
                <Button
                  type="button"
                  variant={priceManuallyEdited ? "default" : "outline"}
                  size="sm"
                  className="whitespace-nowrap text-xs"
                  onClick={() => {
                    setPrice(currentPrice);
                    setPriceManuallyEdited(false);
                  }}
                  title="Sync price with live LTP"
                >
                  {priceManuallyEdited ? '↻ Sync LTP' : '✓ Synced'}
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">Notes</label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="col-span-3"
                placeholder="Optional notes..."
              />
            </div>

            {/* Trade Summary */}
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Value</span>
                <span className="font-bold text-lg flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              
              {/* P&L Preview (for selling) */}
              {pnLData && (
                <div className={cn(
                  "flex justify-between items-center pt-2 border-t",
                  pnLData.pnL >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  <span className="text-sm font-medium">Expected P&L</span>
                  <span className="font-bold flex items-center gap-1">
                    {pnLData.pnL >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    ₹{pnLData.pnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    <span className="text-xs">
                      ({pnLData.pnLPercent >= 0 ? '+' : ''}{pnLData.pnLPercent.toFixed(2)}%)
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Warning for partial exit */}
            {tradeAction === 'OUT' && currentPosition && shares < currentPosition.shares && (
              <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg text-amber-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Partial exit: {currentPosition.shares - shares} shares will remain</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTradeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteTrade}
              className={cn(
                tradeAction === 'IN'
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {tradeAction === 'IN' ? 'Buy' : 'Sell'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PortfolioMode;
