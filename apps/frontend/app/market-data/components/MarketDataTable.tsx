import React from 'react';

interface MarketData {
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

interface MarketDataTableProps {
  data: Record<string, MarketData>;
  onSymbolSelect: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  selectedSymbol: string;
}

const MarketDataTable: React.FC<MarketDataTableProps> = ({
  data,
  onSymbolSelect,
  onRemoveSymbol,
  selectedSymbol,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Symbol</th>
            <th className="text-right py-2">LTP</th>
            <th className="text-right py-2">Change</th>
            <th className="text-right py-2">%Change</th>
            <th className="text-right py-2">Volume</th>
            <th className="text-center py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([symbol, marketData]) => (
            <tr 
              key={symbol}
              className={`border-b hover:bg-muted/50 cursor-pointer ${
                selectedSymbol === symbol ? 'bg-muted' : ''
              }`}
              onClick={() => onSymbolSelect(symbol)}
            >
              <td className="py-3 font-medium">{symbol}</td>
              <td className="text-right py-3">{marketData.ltp.toFixed(2)}</td>
              <td 
                className={`text-right py-3 ${
                  marketData.change >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {marketData.change >= 0 ? '+' : ''}
                {marketData.change.toFixed(2)}
              </td>
              <td 
                className={`text-right py-3 ${
                  marketData.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {marketData.changePercent >= 0 ? '+' : ''}
                {marketData.changePercent.toFixed(2)}%
              </td>
              <td className="text-right py-3">{marketData.volume.toLocaleString()}</td>
              <td className="text-center py-3">
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSymbol(symbol);
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          
          {Object.keys(data).length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-muted-foreground">
                No symbols in watchlist. Add symbols to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MarketDataTable;
