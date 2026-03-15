// @ts-nocheck
'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { AppSidebar } from "../components/app-sidebar";
import { CompanyList } from "@/app/components/CompanyList";
import { usePersistentState } from '@/hooks/useStateRestoration';
import { useWatchlist } from "@/hooks/useWatchlist";
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

const UMAPClusterDashboard = dynamic(
  () => import('../market-data/components/umap/UMAPClusterDashboard'),
  { ssr: false, loading: () => (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto" />
        <p className="text-sm text-zinc-400">Loading UMAP Clustering Dashboard…</p>
      </div>
    </div>
  )}
);

export default function UMAPPage() {
  // ── Company selection state ──────────────────────────────────────────────
  const [selectedCompany, setSelectedCompany] = usePersistentState<string | null>(
    'umap-selectedCompany',
    'RELIANCE'
  );

  // ── Show all companies filter state ──────────────────────────────────────
  const [showAllCompanies, setShowAllCompanies] = usePersistentState<boolean>(
    'umap-showAllCompanies',
    false
  );

  // ── Watchlist data (same hook used by market-data & dashboard pages) ─────
  const {
    companies,
    loading: watchlistLoading,
    availableDates,
    selectedDate: watchlistDate,
    setSelectedDate: setWatchlistDate,
  } = useWatchlist({ showAllCompanies }) as any;

  // ── Company change handler ───────────────────────────────────────────────
  const handleCompanySelect = useCallback((companyCode: string) => {
    setSelectedCompany(companyCode);
  }, [setSelectedCompany]);

  const pageTitle = selectedCompany
    ? `${selectedCompany} — UMAP Clustering`
    : 'UMAP Clustering';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden flex flex-col h-screen">
        {/* HEADER */}
        <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>

        {/* MAIN CONTENT ROW — same layout as market-data */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT: UMAP Dashboard (scrollable) */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <UMAPClusterDashboard initialSymbol={selectedCompany || 'RELIANCE'} />
          </div>

          {/* RIGHT: Company List Sidebar */}
          <div className="w-72 border-l bg-background flex flex-col shrink-0 transition-all duration-300">
            <div className="flex-1 overflow-hidden">
              <CompanyList
                companies={companies || []}
                selectedCompanyCode={selectedCompany}
                onSelect={handleCompanySelect}
                loading={watchlistLoading}
                selectedWatchlistDate={watchlistDate}
                onWatchlistDateChange={setWatchlistDate}
                availableDates={availableDates}
                showAllCompanies={showAllCompanies}
                onShowAllCompaniesChange={setShowAllCompanies}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
