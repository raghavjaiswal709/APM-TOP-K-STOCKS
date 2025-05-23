'use client'
import * as React from "react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

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
  const [selectedValue, setSelectedValue] = React.useState<string>("");

  const handleValueChange = (value: string) => {
    setSelectedValue(value);
    if (onCompanySelect) {
      onCompanySelect(value || null);
    }
  };

  // Convert companies to combobox options with enhanced search
  const options: ComboboxOption[] = React.useMemo(() => {
    return companies.map((company) => ({
      value: company.company_code,
      label: `${company.tradingsymbol} - ${company.name}`,
      searchText: `${company.tradingsymbol} ${company.name} ${company.company_code} ${company.exchange}`.toLowerCase(),
    }));
  }, [companies]);

  if (loading) {
    return (
      <Combobox
        options={[]}
        value=""
        onSelect={() => {}}
        placeholder="Loading companies..."
        className="w-[280px]"
        loading={true}
        disabled={true}
      />
    );
  }

  if (!exists) {
    return (
      <Combobox
        options={[]}
        value=""
        onSelect={() => {}}
        placeholder="Watchlist not found"
        className="w-[280px]"
        disabled={true}
      />
    );
  }

  if (companies.length === 0) {
    return (
      <Combobox
        options={[]}
        value=""
        onSelect={() => {}}
        placeholder="No companies available"
        className="w-[280px]"
        disabled={true}
      />
    );
  }

  return (
    <Combobox
      options={options}
      value={selectedValue}
      onSelect={handleValueChange}
      placeholder="Search & select company..."
      searchPlaceholder="Search companies..."
      emptyText="No companies found."
      className="w-[280px]"
    />
  );
}
