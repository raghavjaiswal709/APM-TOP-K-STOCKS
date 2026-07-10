'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AppSidebar } from '@/app/components/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ModeToggle } from '@/app/components/toggleButton'
import { CompanyList } from '@/app/components/CompanyList'
import { useWatchlist } from '@/hooks/useWatchlist'
import { usePersistentState } from '@/hooks/useStateRestoration'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import SectionA from './components/layout/SectionA'
import StockPanel from './components/layout/StockPanel'
import EventsRail from './components/layout/EventsRail'
import EodReport from './components/layout/EodReport'

const DEFAULT_SYMBOL = 'BHEL'

export default function SentaPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [date,   setDate]   = useState('')
  const [now,    setNow]    = useState(() => new Date())

  // Company-selector sidebar state
  const [showAllCompanies, setShowAllCompanies] = usePersistentState<boolean>(
    'senta-showAllCompanies',
    false
  )
  const [sidebarWidth,     setSidebarWidth]     = useState<number>(280)
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true)
  const [isSidebarDragging, setIsSidebarDragging] = useState<boolean>(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false)
  const mainRowRef = useRef<HTMLDivElement>(null)

  // Company list via watchlist hook (same as other pages)
  const {
    companies,
    loading: watchlistLoading,
    availableDates,
    selectedDate: watchlistDate,
    setSelectedDate: setWatchlistDate,
    availableExchanges,
    availableMarkers,
    totalCompanies,
  } = useWatchlist({ showAllCompanies, cacheKey: 'senta-companies' }) as any

  // When user changes date in the CompanyList sidebar, update both senta date and watchlist date
  const handleDateChange = useCallback((d: string) => {
    setDate(d)
    setWatchlistDate(d)
  }, [setWatchlistDate])

  // Sidebar drag — right edge (since sidebar is on the left)
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsSidebarDragging(true)
  }, [])

  const handleSidebarMouseMove = useCallback((e: MouseEvent) => {
    if (!isSidebarDragging || !mainRowRef.current) return
    const containerRect = mainRowRef.current.getBoundingClientRect()
    const newWidth = containerRect.right - e.clientX
    setSidebarWidth(Math.max(200, Math.min(500, newWidth)))
  }, [isSidebarDragging])

  const handleSidebarMouseUp = useCallback(() => {
    setIsSidebarDragging(false)
  }, [])

  useEffect(() => {
    if (isSidebarDragging) {
      document.addEventListener('mousemove', handleSidebarMouseMove)
      document.addEventListener('mouseup', handleSidebarMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      return () => {
        document.removeEventListener('mousemove', handleSidebarMouseMove)
        document.removeEventListener('mouseup', handleSidebarMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isSidebarDragging, handleSidebarMouseMove, handleSidebarMouseUp])

  useEffect(() => { setNow(new Date()) }, [symbol, date])

  const displayDate = date || now.toLocaleDateString('en-IN')
  const displayTime = date ? '(historical)' : now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  // The date shown in the sidebar picker: prefer explicit senta date, fall back to watchlist auto-date
  const companyListDate = date || watchlistDate || null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden h-screen">

        {/* Standard topbar */}
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
                <BreadcrumbPage>SENTA Cockpit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <span className="text-[11px] text-muted-foreground flex-shrink-0">
            {displayDate} · {displayTime}
          </span>
          <ModeToggle />
        </header>

        {/* Body — three-column layout: [Main] [Events rail] [Company sidebar] */}
        <div className="flex flex-1 overflow-hidden" ref={mainRowRef}>

          {/* MAIN senta content */}
          <main className="flex-1 overflow-y-auto
                           [&::-webkit-scrollbar]:w-1.5
                           [&::-webkit-scrollbar-track]:bg-transparent
                           [&::-webkit-scrollbar-thumb]:bg-muted
                           [&::-webkit-scrollbar-thumb]:rounded-full
                           [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30">

            <SectionA date={date || undefined} onSelectSymbol={setSymbol} />

            <div className="p-4">
              <h2 className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
                {symbol}
                {date && <span className="ml-2 text-blue-400">· {date}</span>}
              </h2>
              <StockPanel symbol={symbol} date={date || undefined} />
              <EodReport symbol={symbol} date={date || undefined} />
            </div>
          </main>

          {/* Events rail — unchanged */}
          <aside className="w-72 flex-shrink-0 border-l overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b flex-shrink-0">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Events</span>
            </div>
            <EventsRail symbol={symbol} date={date || undefined} />
          </aside>

          {/* RIGHT: Company selector sidebar */}
          {isSidebarVisible ? (
            <div
              className="relative bg-background flex flex-col shrink-0 border-l"
              style={{
                width: sidebarWidth,
                transition: isSidebarDragging ? 'none' : 'width 300ms ease-in-out',
              }}
            >
              {/* Sidebar header with Watchlist/All toggle and Date picker */}
              <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/20 gap-2 shrink-0">
                {/* Watchlist / All toggle segmented control */}
                <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/60">
                  <button
                    onClick={() => setShowAllCompanies(false)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all duration-200",
                      !showAllCompanies 
                        ? "bg-background text-foreground shadow-sm font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Watchlist
                  </button>
                  <button
                    onClick={() => setShowAllCompanies(true)}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-md font-medium transition-all duration-200",
                      showAllCompanies 
                        ? "bg-background text-foreground shadow-sm font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    All
                  </button>
                </div>

                {/* Date Picker Button */}
                {!showAllCompanies && (
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] px-2 py-1 rounded-md border border-border/60 font-medium bg-background text-muted-foreground hover:text-foreground hover:border-border/80 flex items-center gap-1 shadow-sm transition-all">
                        <CalendarIcon className="h-3 w-3 text-primary/70" />
                        {companyListDate
                          ? format(new Date(companyListDate), 'dd MMM')
                          : 'Date'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={companyListDate ? new Date(companyListDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            handleDateChange(format(date, 'yyyy-MM-dd'));
                          }
                          setIsDatePickerOpen(false);
                        }}
                        disabled={(date) =>
                          !availableDates.some((d: string) => new Date(d).toDateString() === date.toDateString())
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {/* Collapse button */}
                <button
                  onClick={() => setIsSidebarVisible(false)}
                  className="p-0.5 rounded hover:bg-accent transition-colors shrink-0"
                  title="Collapse sidebar"
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* Company list */}
              <div className="flex-1 overflow-hidden">
                <CompanyList
                  companies={companies || []}
                  selectedCompanyCode={symbol}
                  onSelect={setSymbol}
                  loading={watchlistLoading}
                  selectedWatchlistDate={companyListDate}
                  onWatchlistDateChange={handleDateChange}
                  availableDates={availableDates || []}
                  availableExchanges={availableExchanges || []}
                  availableMarkers={availableMarkers || []}
                  totalCompanies={totalCompanies || 0}
                  showAllCompanies={showAllCompanies}
                  onShowAllCompaniesChange={setShowAllCompanies}
                  hideDateSelector={true}
                />
              </div>

              {/* Drag handle — left edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/40 active:bg-primary/60 z-10 group"
                onMouseDown={handleSidebarMouseDown}
                title="Drag to resize sidebar"
              >
                <div className="absolute inset-y-0 -left-0.5 w-2 group-hover:bg-primary/20" />
              </div>
            </div>
          ) : (
            /* Collapsed state */
            <div className="w-8 bg-background border-l flex flex-col items-center py-2 shrink-0">
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="Expand sidebar"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="mt-2 flex-1 flex items-center">
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                  Companies
                </span>
              </div>
            </div>
          )}

        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
