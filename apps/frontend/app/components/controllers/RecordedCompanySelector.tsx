'use client';
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp } from "lucide-react";
interface AvailableCompany {
  symbol: string;
  company: string;
  exchange: string;
  fileName: string;
}
interface RecordedCompanySelectorProps {
  availableCompanies: AvailableCompany[];
  selectedCompany: string | null;
  onCompanySelect: (company: string | null) => void;
  loading?: boolean;
}
export const RecordedCompanySelector: React.FC<RecordedCompanySelectorProps> = ({
  availableCompanies,
  selectedCompany,
  onCompanySelect,
  loading = false
}) => {
  const handleCompanyChange = (value: string) => {
    if (value === 'none') {
      onCompanySelect(null);
    } else {
      onCompanySelect(value);
    }
  };
  const getSelectedCompanyInfo = () => {
    if (!selectedCompany) return null;
    return availableCompanies.find(c => c.symbol === selectedCompany);
  };
  const selectedCompanyInfo = getSelectedCompanyInfo();
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select Company
            </h3>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                Loading...
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Select value={selectedCompany || 'none'} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a company to view recorded data">
                  {selectedCompanyInfo ? (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>{selectedCompanyInfo.company}</span>
                      <span className="text-xs text-muted-foreground">
                        ({selectedCompanyInfo.exchange})
                      </span>
                    </div>
                  ) : (
                    "Choose a company to view recorded data"
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Select a company...</span>
                </SelectItem>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.symbol} value={company.symbol}>
                    <div className="flex items-center gap-2 w-full">
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-medium">{company.company}</span>
                      <span className="text-xs text-muted-foreground">
                        ({company.exchange})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableCompanies.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {availableCompanies.length} companies available for selected date
              </div>
            )}
          </div>
          {selectedCompanyInfo && (
            <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t">
              <div>
                <span className="text-muted-foreground">Symbol:</span>
                <div className="font-medium">{selectedCompanyInfo.symbol}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Exchange:</span>
                <div className="font-medium">{selectedCompanyInfo.exchange}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

