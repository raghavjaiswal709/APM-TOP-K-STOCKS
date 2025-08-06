'use client';
import React, { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
interface SymbolSearchProps {
  onSymbolSelect: (symbol: string) => void;
}
const commonSymbols = [
  { symbol: 'NSE:NIFTY50-INDEX', name: 'Nifty 50' },
  { symbol: 'NSE:BANKNIFTY-INDEX', name: 'Bank Nifty' },
  { symbol: 'NSE:RELIANCE-EQ', name: 'Reliance Industries' },
  { symbol: 'NSE:TCS-EQ', name: 'Tata Consultancy Services' },
  { symbol: 'NSE:INFY-EQ', name: 'Infosys' },
  { symbol: 'NSE:HDFCBANK-EQ', name: 'HDFC Bank' },
  { symbol: 'NSE:ICICIBANK-EQ', name: 'ICICI Bank' },
  { symbol: 'NSE:HINDUNILVR-EQ', name: 'Hindustan Unilever' },
  { symbol: 'NSE:ITC-EQ', name: 'ITC' },
  { symbol: 'NSE:SBIN-EQ', name: 'State Bank of India' },
];
const SymbolSearch: React.FC<SymbolSearchProps> = ({ onSymbolSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [customSymbol, setCustomSymbol] = useState('');
  const filteredSymbols = searchTerm
    ? commonSymbols.filter(
        (item) =>
          item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : commonSymbols;
  const handleSymbolSelect = (symbol: string) => {
    onSymbolSelect(symbol);
    setSearchTerm('');
    setShowDropdown(false);
  };
  const handleCustomSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSymbol) {
      onSymbolSelect(customSymbol);
      setCustomSymbol('');
    }
  };
  return (
    <div className="relative">
      <div className="flex">
        <Input
          type="text"
          placeholder="Search symbol..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          className="w-64"
        />
      </div>
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-popover rounded-md shadow-lg">
          <ul className="py-1 max-h-60 overflow-auto">
            {filteredSymbols.map((item) => (
              <li
                key={item.symbol}
                className="px-4 py-2 hover:bg-muted cursor-pointer"
                onClick={() => handleSymbolSelect(item.symbol)}
              >
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.symbol}</div>
              </li>
            ))}
            {filteredSymbols.length === 0 && (
              <li className="px-4 py-2 text-muted-foreground">
                No results found. Try adding a custom symbol.
              </li>
            )}
          </ul>
          <div className="border-t p-2">
            <form onSubmit={handleCustomSymbolSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="Add custom symbol (e.g., NSE:SYMBOL-EQ)"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm">Add</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default SymbolSearch;

