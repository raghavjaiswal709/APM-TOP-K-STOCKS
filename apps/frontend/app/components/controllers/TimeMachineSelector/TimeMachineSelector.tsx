'use client'
import * as React from "react";
import { TimeMachineDatePicker } from "./TimeMachineDatePicker";
import { TimeMachineCompanySelector } from "./TimeMachineCompanySelector";

interface TimeMachineSelectorProps {
  // Date
  availableDates: string[];
  selectedDate: string | null;
  onDateChange: (date: string | null) => void;
  loadingDates?: boolean;
  
  // Company
  availableCompanies: string[];
  selectedCompany: string | null;
  onCompanyChange: (company: string | null) => void;
  loadingCompanies?: boolean;
}

export const TimeMachineSelector: React.FC<TimeMachineSelectorProps> = ({
  availableDates,
  selectedDate,
  onDateChange,
  loadingDates = false,
  availableCompanies,
  selectedCompany,
  onCompanyChange,
  loadingCompanies = false,
}) => {
  return (
    <div className="flex gap-4 flex-wrap items-center">
      {/* Date Picker */}
      <TimeMachineDatePicker
        availableDates={availableDates}
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        loading={loadingDates}
      />
      
      {/* Company Selector */}
      <TimeMachineCompanySelector
        companies={availableCompanies}
        selectedCompany={selectedCompany}
        onCompanySelect={onCompanyChange}
        loading={loadingCompanies}
        disabled={!selectedDate}
      />
    </div>
  );
};
