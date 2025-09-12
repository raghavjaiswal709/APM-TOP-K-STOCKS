"use client"
import * as React from "react"
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
}
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
interface MultiSelectScrollableProps {
  companies: MergedCompany[];
  loading: boolean;
  exists: boolean;
  onCompaniesSelect: (companies: Company[]) => void;
  selectedCompanies: Company[];
  maxSelection: number;
}
export function MultiSelectScrollable({ 
  companies, 
  loading, 
  exists, 
  onCompaniesSelect,
  selectedCompanies,
  maxSelection
}: MultiSelectScrollableProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  React.useEffect(() => {
    console.log(`[MultiSelectScrollable] Companies changed. New count: ${companies.length}`);
    setSearchTerm("")
  }, [companies]);
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
    console.log(`[MultiSelectScrollable] handleSelect called with company:`, company);
    const companyObj: Company = {
      company_code: company.company_code,
      name: company.name,
      exchange: company.exchange,
      marker: company.marker
    };
    const isSelected = selectedCompanies.some(c => 
      c.company_code === company.company_code && c.exchange === company.exchange
    );
    if (isSelected) {
      // Remove from selection
      const newSelection = selectedCompanies.filter(c => 
        !(c.company_code === company.company_code && c.exchange === company.exchange)
      );
      onCompaniesSelect(newSelection);
    } else {
      if (selectedCompanies.length < maxSelection) {
        const newSelection = [...selectedCompanies, companyObj];
        onCompaniesSelect(newSelection);
      }
    }
  }
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(!open)
    if (!open) {
      setSearchTerm("")
    }
  }
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
  const isSelectionFull = selectedCompanies.length >= maxSelection;
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
    <div className="relative">
      <Button
        variant="outline"
        onClick={handleButtonClick}
        className="w-[400px] justify-between h-20"
      >
        <span className="text-muted-foreground">
          {selectedCompanies.length > 0 
            ? `${selectedCompanies.length} companies selected` 
            : `Select companies... (${companies.length} available)`}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div 
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg max-h-[500px] "
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-border ">
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
            <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
              <div>
                {filteredCompanies.length !== companies.length && 
                  `Showing ${filteredCompanies.length} of ${companies.length} companies`}
              </div>
              <div>
                {selectedCompanies.length}/{maxSelection} selected
              </div>
            </div>
          </div>
          <ScrollArea className="max-h-[300px] overflow-auto">
            {filteredCompanies.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {searchTerm ? 'No companies match your search' : 'No companies found'}
              </div>
            ) : (
              filteredCompanies.map((company, index) => {
                const uniqueKey = `${company.company_code}-${company.exchange}-${index}`;
                const isSelected = selectedCompanies.some(c => 
                  c.company_code === company.company_code && c.exchange === company.exchange
                );
                const canSelect = !isSelected && !isSelectionFull;
                return (
                  <div
                    key={uniqueKey}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canSelect || isSelected) {
                        handleSelect(company);
                      }
                    }}
                    className={cn(
                      "flex flex-col gap-1 p-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0",
                      isSelected && "bg-accent",
                      !canSelect && !isSelected && "opacity-50 cursor-not-allowed"
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
                      <div className="flex items-center gap-1">
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-medium">
                          {company.exchange}
                        </span>
                        <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-medium">
                          {company.marker}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate w-full ml-6">
                      {company.name}
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
          {isSelectionFull && (
            <div className="p-2 bg-yellow-50 border-t border-yellow-200 text-xs text-yellow-800">
              Maximum {maxSelection} companies selected. Remove a company to select another.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

