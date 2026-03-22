"use client"
import * as React from "react"
import { useEffect, useState, useCallback, useRef } from "react"
import {
  LayoutDashboard,
  LineChart,
  LayoutGrid,
  Sparkles,
  BrainCircuit,
  Eye,
  Briefcase,
  Newspaper,
  Shield,
  SlidersHorizontal,
  HelpCircle,
  Bell,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Pin,
  PinOff,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { AuthModal } from "./AuthModal"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// ─── Constants ────────────────────────────────────────────────────────────────
const COLLAPSED_W = "4rem"   // 64px — icon strip
const EXPANDED_W  = "16rem"  // 256px — full panel

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuthStatus {
  authenticated: boolean
  token_valid: boolean
  expires_at: string | null
  is_expired?: boolean
  hours_until_expiry?: number
}

export interface AuthDisplay {
  color: string
  bgColor: string
  icon: React.ComponentType<{ className?: string }>
  text: string
  showWarning: boolean
  hoursRemaining?: number
}

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  items?: { title: string; url: string }[]
}

// ─── Navigation Data ──────────────────────────────────────────────────────────
const NAV_MAIN: NavItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    items: [
      { title: "Historical Data", url: "/" },
      { title: "Overview", url: "#" },
      { title: "Market Movers", url: "#" },
      { title: "Sector Performance", url: "#" },
    ],
  },
  { title: "Live Market",         url: "/market-data",     icon: LineChart },
  { title: "Multiple Live Chart", url: "/live-market",     icon: LayoutGrid },
  { title: "Recommendations",     url: "/recommendations", icon: Sparkles },
  { title: "UMAP Clustering",     url: "/umap-clustering", icon: BrainCircuit },
  {
    title: "Watchlist",
    url: "/watchlist",
    icon: Eye,
    items: [
      { title: "My Watchlist",       url: "/watchlist" },
      { title: "My Stocks",          url: "#" },
      { title: "Price Alerts",       url: "#" },
      { title: "Earnings Calendar",  url: "#" },
    ],
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Briefcase,
    items: [
      { title: "Dashboard",       url: "/portfolio" },
      { title: "Performance",     url: "/portfolio?tab=overview" },
      { title: "Trade History",   url: "/portfolio?tab=trades" },
      { title: "Weekly Reports",  url: "/portfolio?tab=weekly" },
      { title: "Monthly Reports", url: "/portfolio?tab=monthly" },
    ],
  },
  {
    title: "Market News",
    url: "#",
    icon: Newspaper,
    items: [
      { title: "Breaking News",    url: "#" },
      { title: "Sector Updates",   url: "#" },
      { title: "Economic Events",  url: "#" },
    ],
  },
  {
    title: "Admin",
    url: "/admin",
    icon: Shield,
    items: [{ title: "Validate", url: "/admin/validate" }],
  },
  {
    title: "Settings",
    url: "#",
    icon: SlidersHorizontal,
    items: [
      { title: "Account",         url: "#" },
      { title: "Notifications",   url: "#" },
      { title: "API Connections", url: "#" },
    ],
  },
]

const NAV_SECONDARY = [
  { title: "Help & Support", url: "#", icon: HelpCircle },
  { title: "Notifications",  url: "#", icon: Bell },
]

const USER_DATA = {
  name:   process.env.NEXT_PUBLIC_INSTANCE_USER_NAME  || process.env.NEXT_PUBLIC_USER_NAME  || "Raghav",
  email:  process.env.NEXT_PUBLIC_INSTANCE_USER_EMAIL || process.env.NEXT_PUBLIC_USER_EMAIL || "raghavjaiswal0000@gmail.com",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function NavIcon({ icon: Icon, size = 22 }: { icon: NavItem["icon"]; size?: number }) {
  return <Icon size={size} />
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AppSidebar() {
  const pathname = usePathname()

  // Sidebar state
  const [isPinned,  setIsPinned]  = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Auth
  const [authStatus,        setAuthStatus]        = useState<AuthStatus | null>(null)
  const [authLoading,       setAuthLoading]        = useState(true)
  const [isAuthModalOpen,   setIsAuthModalOpen]    = useState(false)

  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = isPinned || isHovered

  // ── Persist pin state ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("daksphere-sidebar-pinned")
      if (stored === "true") setIsPinned(true)
    } catch { /* ignore SSR */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem("daksphere-sidebar-pinned", String(isPinned)) } catch { /* ignore */ }
  }, [isPinned])

  // ── Listen for external toggle (SidebarTrigger in page headers) ────────────
  useEffect(() => {
    const handler = () => setIsPinned(p => !p)
    window.addEventListener("toggle-sidebar-pin", handler)
    return () => window.removeEventListener("toggle-sidebar-pin", handler)
  }, [])

  // ── Hover handlers — tiny delay prevents flicker on fast mouse moves ───────
  const handleMouseEnter = useCallback(() => {
    if (isPinned) return
    if (hoverLeaveTimer.current) { clearTimeout(hoverLeaveTimer.current); hoverLeaveTimer.current = null }
    setIsHovered(true)
  }, [isPinned])

  const handleMouseLeave = useCallback(() => {
    if (isPinned) return
    hoverLeaveTimer.current = setTimeout(() => setIsHovered(false), 120)
  }, [isPinned])

  // ── Auth status ────────────────────────────────────────────────────────────
  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/fyers/status")
      if (res.ok) setAuthStatus(await res.json())
    } catch { setAuthStatus(null) }
    finally   { setAuthLoading(false) }
  }, [])

  useEffect(() => {
    fetchAuthStatus()
    const id = setInterval(fetchAuthStatus, 60_000)
    return () => clearInterval(id)
  }, [fetchAuthStatus])

  const getAuthDisplay = useCallback((): AuthDisplay => {
    if (authLoading) return { color: "text-blue-400",   bgColor: "bg-blue-500/10",    icon: AlertCircle,    text: "Checking…", showWarning: false }
    if (!authStatus)  return { color: "text-red-400",    bgColor: "bg-red-500/10",     icon: XCircle,        text: "Unknown",   showWarning: true }
    if (authStatus.authenticated && authStatus.token_valid && !authStatus.is_expired) {
      return { color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: CheckCircle, text: "Active",   showWarning: false, hoursRemaining: authStatus.hours_until_expiry }
    }
    if (authStatus.is_expired) return { color: "text-red-400", bgColor: "bg-red-500/10", icon: XCircle,     text: "Expired",  showWarning: true }
    return                             { color: "text-red-400", bgColor: "bg-red-500/10", icon: AlertTriangle, text: "Required", showWarning: true }
  }, [authLoading, authStatus])

  const authDisplay = getAuthDisplay()
  const AuthIcon    = authDisplay.icon

  // ── Active item detection ──────────────────────────────────────────────────
  const isItemActive = useCallback((item: NavItem) => {
    if (item.url !== "#" && item.url && pathname === item.url) return true
    return item.items?.some(s => s.url !== "#" && pathname === s.url) ?? false
  }, [pathname])

  const toggleExpanded = (title: string) =>
    setExpandedItems(prev => { const n = new Set(prev); n.has(title) ? n.delete(title) : n.add(title); return n })

  // ── Auto-open submenu for current route ────────────────────────────────────
  useEffect(() => {
    const active = NAV_MAIN.find(item => isItemActive(item) && item.items)
    if (active) setExpandedItems(prev => new Set([...prev, active.title]))
  }, [pathname, isItemActive])

  // ─────────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <TooltipProvider delayDuration={400}>
        {/* ── Sidebar Panel ─────────────────────────────────────────────────── */}
        <div
          data-sidebar
          className={cn(
            "fixed left-0 top-0 z-50 h-full flex flex-col",
            "bg-sidebar text-sidebar-foreground",
            "border-r border-sidebar-border",
            "transition-[width,box-shadow] duration-200 ease-in-out",
            "overflow-hidden select-none",
            isExpanded
              ? "shadow-[4px_0_32px_rgba(0,0,0,0.25)]"
              : "shadow-none"
          )}
          style={{ width: isExpanded ? EXPANDED_W : COLLAPSED_W }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* ── Logo Header ─────────────────────────────────────────────────── */}
          <div className={cn(
            "flex items-center shrink-0 h-14",
            "border-b border-sidebar-border",
            isExpanded ? "px-4 gap-3" : "justify-center"
          )}>
            {/* Logo mark */}
            <div className={cn(
              "shrink-0 flex items-center justify-center rounded-lg font-bold text-sm",
              "bg-foreground/10 text-foreground",
              "transition-[width,height] duration-200",
              isExpanded ? "w-8 h-8" : "w-9 h-9"
            )}>
              D
            </div>
            {/* Brand text — only visible when expanded */}
            <div className={cn(
              "flex flex-col min-w-0 transition-[opacity,width] duration-150",
              isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
            )}>
              <span className="font-bold text-sm leading-tight truncate">DAKSphere</span>
              <span className="text-[10px] text-sidebar-foreground/55 leading-tight truncate">Trading Dashboard</span>
            </div>
          </div>

          {/* ── Scrollable Nav Area ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">

            {/* Primary nav items */}
            <nav className="px-2 space-y-0.5">
              {NAV_MAIN.map(item => {
                const active     = isItemActive(item)
                const hasKids    = Boolean(item.items?.length)
                const isOpen     = expandedItems.has(item.title)

                return (
                  <div key={item.title}>
                    {/* ── Collapsed → icon + tooltip ─────────────────────── */}
                    {!isExpanded ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.url === "#" ? "#" : item.url}
                            className={cn(
                              "flex items-center justify-center w-full rounded-lg",
                              "transition-colors duration-150 h-11",
                              active
                                ? "bg-foreground/10 text-foreground font-semibold"
                                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                            )}
                          >
                            <NavIcon icon={item.icon} size={22} />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10} className="font-medium text-xs">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>

                    ) : (
                      /* ── Expanded → icon + label + chevron ───────────── */
                      <>
                        <button
                          onClick={() => {
                            if (hasKids) {
                              toggleExpanded(item.title)
                            } else if (item.url !== "#") {
                              window.location.href = item.url
                            }
                          }}
                          className={cn(
                            "flex items-center w-full gap-3 rounded-lg text-sm text-left",
                            "transition-colors duration-150 h-10 px-2.5",
                            active
                              ? "bg-foreground/10 text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                          )}
                        >
                          <NavIcon icon={item.icon} size={18} />
                          <span className="flex-1 truncate">{item.title}</span>
                          {hasKids && (
                            <ChevronRight
                              size={14}
                              className={cn(
                                "shrink-0 transition-transform duration-150",
                                isOpen && "rotate-90"
                              )}
                            />
                          )}
                        </button>

                        {/* Submenu */}
                        {hasKids && isOpen && (
                          <div className="ml-8 mt-0.5 mb-1 pl-2 space-y-0.5 border-l border-sidebar-border">
                            {item.items!.map(sub => (
                              <Link
                                key={sub.title}
                                href={sub.url}
                                className={cn(
                                  "flex items-center h-8 px-2 rounded-md text-xs",
                                  "transition-colors duration-150",
                                  pathname === sub.url
                                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                )}
                              >
                                {sub.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </nav>

            {/* Divider */}
            <div className="mx-2 my-2 h-px bg-sidebar-border/60" />

            {/* Secondary nav items */}
            <nav className="px-2 space-y-0.5">
              {NAV_SECONDARY.map(item => {
                const Icon = item.icon
                return !isExpanded ? (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.url}
                        className="flex items-center justify-center w-full h-11 rounded-lg transition-colors text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <Icon size={22} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10} className="text-xs">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    key={item.title}
                    href={item.url}
                    className="flex items-center gap-3 h-10 px-2.5 rounded-lg text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="flex-1 truncate">{item.title}</span>
                  </Link>
                )
              })}

              {/* ── Auth Status Item ────────────────────────────────────── */}
              {!isExpanded ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className={cn(
                        "flex items-center justify-center w-full h-11 rounded-lg transition-colors",
                        "hover:bg-sidebar-accent",
                        authDisplay.color
                      )}
                    >
                      <span className="relative">
                        <AuthIcon className="w-[22px] h-[22px]" />
                        {authDisplay.showWarning && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className="text-xs">
                    <p className="font-semibold">Broker Auth: <span className={authDisplay.color}>{authDisplay.text}</span></p>
                    {authDisplay.hoursRemaining !== undefined && (
                      <p className="text-muted-foreground">{authDisplay.hoursRemaining.toFixed(1)}h remaining</p>
                    )}
                    <p className="text-muted-foreground text-[10px]">Click to manage</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className={cn(
                    "flex items-center gap-3 w-full h-10 px-2.5 rounded-lg text-sm",
                    "transition-colors hover:bg-sidebar-accent",
                    authDisplay.color
                  )}
                >
                  <span className="relative shrink-0">
                    <AuthIcon className="w-[18px] h-[18px]" />
                    {authDisplay.showWarning && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </span>
                  <span className="flex-1 text-left truncate">Broker Auth</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                    authDisplay.bgColor
                  )}>
                    {authDisplay.text}
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-sidebar-border py-2 px-2 space-y-0.5">

            {/* Pin / Unpin toggle */}
            {!isExpanded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsPinned(p => !p)}
                    className={cn(
                      "flex items-center justify-center w-full h-11 rounded-lg",
                      "transition-colors hover:bg-sidebar-accent",
                      isPinned
                        ? "text-foreground"
                        : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                    )}
                  >
                    {isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="text-xs">
                  {isPinned ? "Unpin sidebar" : "Pin sidebar open"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={() => setIsPinned(p => !p)}
                className={cn(
                  "flex items-center gap-3 w-full h-10 px-2.5 rounded-lg text-sm",
                  "transition-colors hover:bg-sidebar-accent",
                  isPinned
                    ? "text-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground"
                )}
              >
                {isPinned
                  ? <PinOff size={18} className="shrink-0" />
                  : <Pin    size={18} className="shrink-0" />
                }
                <span className="flex-1 text-left truncate">
                  {isPinned ? "Unpin Sidebar" : "Pin Sidebar Open"}
                </span>
                {isPinned && (
                  <span className="text-[10px] bg-foreground/8 text-foreground/70 px-1.5 py-0.5 rounded shrink-0">
                    Pinned
                  </span>
                )}
              </button>
            )}

            {/* User avatar */}
            {!isExpanded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center justify-center w-full h-11 rounded-lg transition-colors hover:bg-sidebar-accent">
                    <div className="w-8 h-8 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-sm font-semibold">
                      {USER_DATA.name.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="text-xs">
                  <p className="font-medium">{USER_DATA.name}</p>
                  <p className="text-muted-foreground">{USER_DATA.email}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-3 h-10 px-2.5 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors">
                <div className="w-8 h-8 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  {USER_DATA.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{USER_DATA.name}</p>
                  <p className="text-[10px] text-sidebar-foreground/55 leading-tight truncate">{USER_DATA.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  )
}
