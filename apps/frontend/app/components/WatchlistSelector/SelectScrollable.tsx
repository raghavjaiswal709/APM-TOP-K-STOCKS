// src/components/WatchlistSelector/SelectScrollable.tsx
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Company {
  company_code: string;
  avg_daily_high_low_range: number;
  avg_daily_volume: number;
  avg_trading_capital: number;
  instrument_token: string;
  tradingsymbol: string;
  name: string;
  exchange: string;
}

interface SelectScrollableProps {
  companies: Company[];
  loading: boolean;
  exists: boolean;
}

export function SelectScrollable({ companies, loading, exists }: SelectScrollableProps) {
  if (loading) {
    return <div className="w-[280px] p-2 border rounded">Loading watchlist data...</div>;
  }

  if (!exists) {
    return <div className="w-[280px] p-2 border rounded text-red-500">No watchlist data found for today</div>;
  }

  return (
    <Select>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Select a company" />
      </SelectTrigger>
      <SelectContent>
        {companies.length === 0 ? (
          <div className="p-2 text-center text-gray-500">No companies found</div>
        ) : (
          <SelectGroup>
            <SelectLabel>Companies</SelectLabel>
            {companies.map((company) => (
              <SelectItem key={company.company_code} value={company.company_code}>
                {company.name} ({company.exchange}) - {company.tradingsymbol}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
