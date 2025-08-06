'use client';
import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X, Check, Building2 } from 'lucide-react';
interface Company {
  company_code: string;
  name: string;
  exchange: string;
  marker: string;
  symbol: string;
}
interface CompanySelectorProps {
  availableCompanies: Company[];
  selectedCompanies: string[];
  onSelectionChange: (companyCodes: string[]) => void;
  maxSelection: number;
  loading?: boolean;
}
const CompanySelector: React.FC<CompanySelectorProps> = ({
  availableCompanies,
  selectedCompanies,
  onSelectionChange,
  maxSelection,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return availableCompanies;
    const term = searchTerm.toLowerCase();
    return availableCompanies.filter(company =>
      company.company_code.toLowerCase().includes(term) ||
      company.name.toLowerCase().includes(term)
    );
  }, [availableCompanies, searchTerm]);
  const handleCompanyToggle = (companyCode: string) => {
    const isSelected = selectedCompanies.includes(companyCode);
    if (isSelected) {
      // Remove from selection
      const newSelection = selectedCompanies.filter(code => code !== companyCode);
      onSelectionChange(newSelection);
    } else {
      if (selectedCompanies.length < maxSelection) {
        const newSelection = [...selectedCompanies, companyCode];
        onSelectionChange(newSelection);
      }
    }
  };
  const handleClearAll = () => {
    onSelectionChange([]);
  };
  const isSelectionFull = selectedCompanies.length >= maxSelection;
  return (
    <div className="space-y-4">
      {}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>
      {}
      {selectedCompanies.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Selected ({selectedCompanies.length}/{maxSelection})
            </span>
            {selectedCompanies.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-6 px-2 text-xs"
              >
                Clear All
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCompanies.map((companyCode) => {
              const company = availableCompanies.find(c => c.company_code === companyCode);
              return (
                <Badge
                  key={companyCode}
                  variant="default"
                  className="flex items-center gap-1 pr-1"
                >
                  <Building2 className="w-3 h-3" />
                  <span>{company?.company_code || companyCode}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCompanyToggle(companyCode)}
                    className="h-4 w-4 p-0 hover:bg-transparent"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      {}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Available Companies</span>
            <span className="text-xs text-muted-foreground">
              {filteredCompanies.length} companies
            </span>
          </div>
          <ScrollArea className="h-64 w-full">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredCompanies.map((company) => {
                  const isSelected = selectedCompanies.includes(company.company_code);
                  const canSelect = !isSelected && !isSelectionFull;
                  return (
                    <Button
                      key={company.company_code}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleCompanyToggle(company.company_code)}
                      disabled={!canSelect && !isSelected}
                      className={`justify-start h-auto p-3 ${
                        isSelected ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Building2 className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <div className="font-medium text-xs">
                            {company.company_code}
                          </div>
                          <div className="text-xs opacity-70 truncate">
                            {company.name}
                          </div>
                          <div className="text-xs opacity-50">
                            {company.exchange}
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          {isSelectionFull && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              Maximum {maxSelection} companies selected. Remove a company to select another.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default CompanySelector;

