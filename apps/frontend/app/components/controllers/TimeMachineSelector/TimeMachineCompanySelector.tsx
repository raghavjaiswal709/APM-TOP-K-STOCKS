'use client'
import * as React from "react"
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TimeMachineCompanySelectorProps {
  companies: string[];
  selectedCompany: string | null;
  onCompanySelect: (companyCode: string | null) => void;
  loading: boolean;
  disabled?: boolean;
}

export function TimeMachineCompanySelector({
  companies,
  selectedCompany,
  onCompanySelect,
  loading,
  disabled = false
}: TimeMachineCompanySelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    if (companies.length === 0 && selectedCompany) {
      console.log(`[TimeMachineCompanySelector] Companies list is empty, resetting selection`);
      onCompanySelect(null)
    }
  }, [companies, onCompanySelect, mounted, selectedCompany]);

  React.useEffect(() => {
    if (!mounted) return
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
  }, [open, mounted])

  const handleSelect = (company: string) => {
    console.log(`[TimeMachineCompanySelector] handleSelect called with company:`, company);
    if (selectedCompany === company) {
      console.log(`[TimeMachineCompanySelector] Deselecting company: ${company}`);
      onCompanySelect(null)
    } else {
      console.log(`[TimeMachineCompanySelector] Selecting company: ${company}`);
      onCompanySelect(company)
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

  const filteredCompanies = React.useMemo(() => {
    if (!searchTerm) return companies;
    const searchLower = searchTerm.toLowerCase();
    return companies.filter(company => 
      company.toLowerCase().includes(searchLower)
    );
  }, [companies, searchTerm]);

  if (!mounted) {
    return <div className="w-[350px] h-20 bg-muted animate-pulse rounded-md" />
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px] w-[350px]">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        Loading companies...
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground min-h-[40px] w-[350px]">
        <Building2 className="h-4 w-4" />
        {disabled ? 'Select a date first' : 'No companies found'}
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-center w-full max-w-[350px]">
      <div className="relative w-full">
        <Button
          variant="outline"
          onClick={handleButtonClick}
          className="w-full justify-between h-20"
          disabled={disabled}
        >
          {selectedCompany ? (
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="truncate font-medium">
                {selectedCompany}
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
              {filteredCompanies.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  {searchTerm ? 'No companies match your search' : 'No companies found'}
                </div>
              ) : (
                filteredCompanies.map((company, index) => {
                  const isSelected = selectedCompany === company;
                  return (
                    <div
                      key={`${company}-${index}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(company);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0",
                        isSelected && "bg-accent"
                      )}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isSelected ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{company}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <div className="min-h-[80px] flex items-center">
        {selectedCompany && (
          <div className="p-3 bg-muted/50 rounded-md h-20 border border-border w-[200px] overflow-hidden flex items-center justify-center">
            <div className="text-center">
              <h4 className="font-medium text-sm truncate">{selectedCompany}</h4>
              <p className="text-xs text-muted-foreground mt-1">Historical Data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
