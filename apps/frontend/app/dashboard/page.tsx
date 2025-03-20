'use client'
import { useState } from 'react';
import { AppSidebar } from "../components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { ModeToggle } from "../components/toggleButton";
import { CardWithForm } from "../components/options";
import { StockChart } from "../components/charts/StockChart";

export default function Page() {
  // State for all selectors
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedInterval, setSelectedInterval] = useState('10m');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 w-full">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb className="flex items-center justify-end gap-2">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Building Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Stock Chart</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
              <ModeToggle />
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* Control panel with selectors */}
          <CardWithForm 
            onCompanyChange={setSelectedCompany}
            onDateChange={setSelectedDate}
            onIntervalChange={setSelectedInterval}
            onIndicatorsChange={setSelectedIndicators}
          />
          
          {/* Stock chart */}
          <div className="min-h-[600px] flex-1 rounded-xl bg-muted/50">
            <StockChart 
              companyId={selectedCompany}
              startDate={selectedDate}
              endDate={undefined}
              interval={selectedInterval}
              indicators={selectedIndicators}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
