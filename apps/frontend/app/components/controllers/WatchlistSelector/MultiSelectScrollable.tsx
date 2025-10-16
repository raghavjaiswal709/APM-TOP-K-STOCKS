'use client'
import * as React from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

interface Company {
  company_id?: number;
  company_code: string;
  name: string;
  exchange: string;
  marker?: string;
}

interface MultiSelectScrollableProps {
  companies: Company[];
  loading: boolean;
  exists: boolean;
  onCompaniesSelect?: (companies: Company[]) => void;
  selectedCompanies: Company[];
  maxSelection?: number;
  disabled?: boolean;
}

export function MultiSelectScrollable({ 
  companies, 
  loading, 
  exists, 
  onCompaniesSelect,
  selectedCompanies,
  maxSelection = 6,
  disabled = false
}: MultiSelectScrollableProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const isCompanySelected = React.useCallback((companyCode: string) => {
    return selectedCompanies.some(c => c.company_code === companyCode);
  }, [selectedCompanies]);

  const handleCompanyToggle = React.useCallback((company: Company) => {
    if (disabled) return;

    const isSelected = isCompanySelected(company.company_code);
    let newSelection: Company[];

    if (isSelected) {
      newSelection = selectedCompanies.filter(c => c.company_code !== company.company_code);
    } else {
      if (selectedCompanies.length >= maxSelection) {
        console.warn(`Maximum selection of ${maxSelection} companies reached`);
        return;
      }
      newSelection = [...selectedCompanies, company];
    }

    console.log('[MultiSelectScrollable] New selection:', newSelection);
    if (onCompaniesSelect) {
      onCompaniesSelect(newSelection);
    }
  }, [selectedCompanies, maxSelection, onCompaniesSelect, isCompanySelected, disabled]);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Loading companies..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (!exists || companies.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="No companies available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select open={isOpen} onOpenChange={setIsOpen}>
      <SelectTrigger className="w-[280px]" disabled={disabled}>
        <SelectValue>
          {selectedCompanies.length === 0 ? (
            "Select companies"
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {selectedCompanies.length}/{maxSelection}
              </Badge>
              <span className="text-sm">
                {selectedCompanies.length === 1 
                  ? selectedCompanies[0].company_code
                  : `${selectedCompanies.length} selected`
                }
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="flex items-center justify-between px-2">
            <span>Companies ({companies.length})</span>
            {selectedCompanies.length >= maxSelection && (
              <Badge variant="secondary" className="text-xs">
                Max {maxSelection}
              </Badge>
            )}
          </SelectLabel>
          <div className="max-h-[300px] overflow-y-auto">
            {companies.map((company) => {
              const isSelected = isCompanySelected(company.company_code);
              const isDisabled = !isSelected && selectedCompanies.length >= maxSelection;

              return (
                <div
                  key={`${company.company_code}-${company.exchange}`}
                  className={`flex items-center space-x-2 px-3 py-2 cursor-pointer hover:bg-muted ${
                    isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={() => !isDisabled && handleCompanyToggle(company)}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={() => !isDisabled && handleCompanyToggle(company)}
                  />
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-sm">{company.company_code}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {company.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {company.exchange}
                      </Badge>
                      {company.marker && (
                        <Badge variant="secondary" className="text-xs">
                          {company.marker}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
