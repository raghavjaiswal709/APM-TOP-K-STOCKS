'use client'
import * as React from "react";

interface Company {
  company_code: string;
  name: string;
  exchange: string;
  total_valid_days?: number;
  avg_daily_high_low?: number;
  median_daily_volume?: number;
  avg_trading_ratio?: number;
  N1_Pattern_count?: number;
  // Legacy fields
  avg_daily_high_low_range?: number;
  avg_daily_volume?: number;
  avg_trading_capital?: number;
  instrument_token?: string;
  tradingsymbol?: string;
}

interface SelectScrollableProps {
  companies: Company[];
  loading: boolean;
  exists: boolean;
  onCompanySelect?: (companyCode: string | null, exchange?: string) => void;
}

export function SelectScrollable({
  companies,
  loading,
  exists,
  onCompanySelect,
}: SelectScrollableProps) {
  const [selectedValue, setSelectedValue] = React.useState<string>("");

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    
    if (onCompanySelect) {
      const selectedCompany = companies.find(c => c.company_code === value);
      onCompanySelect(value || null, selectedCompany?.exchange);
    }
  };

  const options = React.useMemo(() => {
    return companies.map((company) => ({
      value: company.company_code,
      label: `${company.company_code} - ${company.name} (${company.exchange})`,
      searchText: `${company.company_code} ${company.name} ${company.exchange} ${company.tradingsymbol || ''}`.toLowerCase(),
    }));
  }, [companies]);

  if (loading) {
    return (
      <select disabled className="w-[280px] p-2 border rounded">
        <option>Loading companies...</option>
      </select>
    );
  }

  if (!exists) {
    return (
      <select disabled className="w-[280px] p-2 border rounded">
        <option>Watchlist not found</option>
      </select>
    );
  }

  if (companies.length === 0) {
    return (
      <select disabled className="w-[280px] p-2 border rounded">
        <option>No companies available</option>
      </select>
    );
  }

  return (
    <select
      value={selectedValue}
      onChange={(e) => handleValueChange(e.target.value)}
      className="w-[280px] p-2 border rounded"
    >
      <option value="">Select a company...</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
