'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface WatchlistManagerProps {
  subscribedSymbols: string[];
  onSymbolSelect: (symbol: string) => void;
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
}

// Predefined watchlists
const predefinedWatchlists = {
  'Indices': [
    'NSE:NIFTY50-INDEX',
    'NSE:BANKNIFTY-INDEX',
    'NSE:FINNIFTY-INDEX',
    'NSE:NIFTYIT-INDEX',
    'NSE:NIFTYPHARMA-INDEX',
  ],
  'Large Cap': [
    'NSE:RELIANCE-EQ',
    'NSE:TCS-EQ',
    'NSE:HDFCBANK-EQ',
    'NSE:INFY-EQ',
    'NSE:ICICIBANK-EQ',
  ],
  'IT Stocks': [
    'NSE:TCS-EQ',
    'NSE:INFY-EQ',
    'NSE:WIPRO-EQ',
    'NSE:HCLTECH-EQ',
    'NSE:TECHM-EQ',
  ],
};

const WatchlistManager: React.FC<WatchlistManagerProps> = ({
  subscribedSymbols,
  onSymbolSelect,
  onAddSymbol,
  onRemoveSymbol,
}) => {
  const [newSymbol, setNewSymbol] = useState('');
  const [savedWatchlists, setSavedWatchlists] = useState<Record<string, string[]>>({});
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load saved watchlists from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('marketDataWatchlists');
    if (saved) {
      setSavedWatchlists(JSON.parse(saved));
    }
  }, []);

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol && !subscribedSymbols.includes(newSymbol)) {
      onAddSymbol(newSymbol);
      setNewSymbol('');
    }
  };

  const handleSaveWatchlist = () => {
    if (newWatchlistName) {
      const updatedWatchlists = {
        ...savedWatchlists,
        [newWatchlistName]: [...subscribedSymbols],
      };
      
      setSavedWatchlists(updatedWatchlists);
      localStorage.setItem('marketDataWatchlists', JSON.stringify(updatedWatchlists));
      setNewWatchlistName('');
      setShowSaveDialog(false);
    }
  };

  const handleLoadWatchlist = (watchlist: string[]) => {
    // Remove all current symbols
    subscribedSymbols.forEach(symbol => onRemoveSymbol(symbol));
    
    // Add all symbols from the selected watchlist
    watchlist.forEach(symbol => onAddSymbol(symbol));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Symbol</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddSymbol} className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="NSE:SYMBOL-EQ"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">Add</Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Format: Exchange:Symbol-Type (e.g., NSE:RELIANCE-EQ)
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Predefined Watchlists</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(predefinedWatchlists).map(([name, symbols]) => (
            <div key={name} className="flex justify-between items-center">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-muted-foreground">
                  {symbols.length} symbols
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleLoadWatchlist(symbols)}
              >
                Load
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {Object.keys(savedWatchlists).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Watchlists</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(savedWatchlists).map(([name, symbols]) => (
              <div key={name} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-sm text-muted-foreground">
                    {symbols.length} symbols
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleLoadWatchlist(symbols)}
                  >
                    Load
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-red-500"
                    onClick={() => {
                      const { [name]: _, ...rest } = savedWatchlists;
                      setSavedWatchlists(rest);
                      localStorage.setItem('marketDataWatchlists', JSON.stringify(rest));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manage Watchlist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setShowSaveDialog(!showSaveDialog)}
          >
            Save Current Watchlist
          </Button>
          
          {showSaveDialog && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Watchlist name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
              />
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  className="flex-1"
                  onClick={handleSaveWatchlist}
                >
                  Save
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowSaveDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WatchlistManager;
