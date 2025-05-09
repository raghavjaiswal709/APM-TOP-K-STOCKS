'use client'
import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
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
  onCompanySelect?: (companyCode: string | null) => void;
}

export function SelectScrollable({
  companies,
  loading,
  exists,
  onCompanySelect,
}: SelectScrollableProps) {
  const handleValueChange = (value: string) => {
    if (onCompanySelect) {
      onCompanySelect(value);
    }
  };

  return (
    <Select onValueChange={handleValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={
          loading ? "Loading..." : 
          !exists ? "Watchlist not found" :
          companies.length === 0 ? "No companies" :
          "Select company"
        } />
      </SelectTrigger>
      <SelectContent>
        {loading ? (
          <SelectItem value="loading" disabled>Loading companies...</SelectItem>
        ) : !exists ? (
          <SelectItem value="not-found" disabled>Watchlist not found</SelectItem>
        ) : companies.length === 0 ? (
          <SelectItem value="empty" disabled>No companies in watchlist</SelectItem>
        ) : (
          companies.map((company) => (
            <SelectItem key={company.company_code} value={company.company_code}>
              {company.tradingsymbol} - {company.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
