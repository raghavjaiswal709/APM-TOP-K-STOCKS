"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2, TrendingUp, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface MergedCompany {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  total_valid_days?: number;
  avg_daily_high_low_range?: number;
  median_daily_volume?: number;
  avg_trading_capital?: number;
  pe_ratio?: number;
  N1_Pattern_count?: number;
}

interface SelectScrollableProps {
  companies: MergedCompany[];
  loading: boolean;
  exists: boolean;
  onCompanySelect: (companyCode: string | null) => void;
}

export function SelectScrollable({ 
  companies, 
  loading, 
  exists, 
  onCompanySelect 
}: SelectScrollableProps) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")
  const [selectedCompany, setSelectedCompany] = React.useState<MergedCompany | null>(null)
  const [searchTerm, setSearchTerm] = React.useState("")

  React.useEffect(() => {
    console.log(`[SelectScrollable] Companies changed, resetting selection. New count: ${companies.length}`);
    setValue("")
    setSelectedCompany(null)
    setSearchTerm("")
    setOpen(false)
    onCompanySelect(null)
  }, [companies, onCompanySelect]);

  React.useEffect(() => {
    const handleClickOutside = () => {
      if (open) {
        setOpen(false)
        setSearchTerm("")
      }
    }

    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  const handleSelect = (company: MergedCompany) => {
    console.log(`[SelectScrollable] handleSelect called with company:`, company);
    
    if (value === company.company_code) {
      console.log(`[SelectScrollable] Deselecting company: ${company.company_code}`);
      setValue("")
      setSelectedCompany(null)
      onCompanySelect(null)
    } else {
      console.log(`[SelectScrollable] Selecting company: ${company.company_code}`);
      setValue(company.company_code)
      setSelectedCompany(company)
      onCompanySelect(company.company_code)
    }
    setOpen(false)
    setSearchTerm("")
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(!open)
    if (!open) {
      setSearchTerm("")
    }
  }

  const formatCompanyDisplay = (company: MergedCompany) => {
    return `${company.company_code} - ${company.name}`;
  };

  const formatCompanyDetails = (company: MergedCompany) => {
    const details = [];
    if (company.exchange) details.push(company.exchange);
    if (company.marker) details.push(company.marker);
    if (company.total_valid_days) details.push(`${company.total_valid_days} days`);
    return details.join(' • ');
  };

  const filteredCompanies = React.useMemo(() => {
    if (!searchTerm) return companies;
    const searchLower = searchTerm.toLowerCase();
    return companies.filter(company =>
      company.company_code.toLowerCase().includes(searchLower) ||
      company.name.toLowerCase().includes(searchLower) ||
      company.exchange.toLowerCase().includes(searchLower) ||
      company.marker.toLowerCase().includes(searchLower)
    );
  }, [companies, searchTerm]);

   if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px]">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        Loading companies...
      </div>
    );
  }

  if (!exists || companies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px]">
        <Building2 className="h-4 w-4" />
        {!exists ? 'Watchlist not available' : 'No companies found'}
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-center w-full">

      <div className="relative">
        <Button
          variant="outline"
          onClick={handleButtonClick}
          className="w-[500px] justify-between h-20" 
        >
          {selectedCompany ? (
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {formatCompanyDisplay(selectedCompany)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">
              Select company... ({companies.length} available)
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div 
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg max-h-[500px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Your existing dropdown content */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {filteredCompanies.length !== companies.length && (
                <div className="text-xs text-muted-foreground mt-1">
                  {`Showing ${filteredCompanies.length} of ${companies.length} companies`}
                </div>
              )}
            </div>

            <div className="overflow-y-auto max-h-[250px]">
              {/* Your existing company list */}
              {filteredCompanies.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {searchTerm ? 'No companies match your search' : 'No companies found'}
                </div>
              ) : (
                filteredCompanies.map((company, index) => {
                  const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                  const isSelected = value === company.company_code;
                  
                  return (
                    <div
                      key={uniqueKey}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(company);
                      }}
                      className={cn(
                        "flex flex-col gap-1 p-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0",
                        isSelected && "bg-accent"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 min-w-0">
                          <Check
                            className={cn(
                              "h-4 w-4 flex-shrink-0",
                              isSelected ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">
                            {company.company_code}
                          </span>
                        </div>
                        {company.N1_Pattern_count !== undefined && company.N1_Pattern_count > 0 && (
                          <div className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
                            <TrendingUp className="h-3 w-3" />
                            {company.N1_Pattern_count}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate w-full ml-6">
                        {company.name}
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">
                        {formatCompanyDetails(company)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Company Details Section - Separate and consistent positioning */}
      {/* Company Details Section - Separate and consistent positioning */}
<div className="min-h-[96px] flex items-center"> {/* Reserve space to prevent layout shift */}
  {selectedCompany && (
    <div className="p-3 bg-muted/50 rounded-md h-20 border border-border w-[250px] overflow-hidden"> {/* Increased width and reduced padding */}
      <div className="h-full flex flex-col justify-center ">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-sm truncate flex-1 mr-2">{selectedCompany.company_code}</h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">
              {selectedCompany.exchange}
            </span>
            <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">
              {selectedCompany.marker}
            </span>
          </div>
        </div>
        
        {/* Company Name */}
        <p className="text-xs text-muted-foreground mb-2 truncate">
          {selectedCompany.name}
        </p>
        
        {/* Trading Metrics - Compact Grid */}
        {(selectedCompany.total_valid_days || selectedCompany.median_daily_volume || selectedCompany.pe_ratio) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {selectedCompany.total_valid_days && (
              <div className="flex  items-center gap-2">
                <span className="text-muted-foreground text-xs">Days:</span>
                <span className="font-medium text-xs">{selectedCompany.total_valid_days}</span>
              </div>
            )}
            {selectedCompany.median_daily_volume && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Vol:</span>
                <span className="font-medium text-xs">{(selectedCompany.median_daily_volume / 1000).toFixed(0)}K</span>
              </div>
            )}
            {selectedCompany.pe_ratio && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">P/E:</span>
                <span className="font-medium text-xs">{selectedCompany.pe_ratio.toFixed(1)}</span>
              </div>
            )}
            {selectedCompany.N1_Pattern_count !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">N1:</span>
                <span className="font-medium text-xs flex items-center gap-1">
                  {selectedCompany.N1_Pattern_count}
                  {selectedCompany.N1_Pattern_count > 0 && <TrendingUp className="h-3 w-3 text-green-600" />}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )}
</div>

    </div>
  );
}
