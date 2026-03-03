"use client"
import * as React from "react"
import { useEffect, useState, useCallback } from "react"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  LineChart,
  Wallet,
  AlertCircle,
  Star,
  Newspaper,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { NavMain } from "../components/nav-main"
import { NavProjects } from "..//components/nav-projects"
import { NavSecondary } from "..//components/nav-secondary"
import { NavUser } from "../components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AuthModal } from "./AuthModal"

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  is_expired?: boolean;
  hours_until_expiry?: number;
  jwt_expires_at?: string;
}

export interface AuthDisplay {
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  showWarning: boolean;
  hoursRemaining?: number;
}
const data = {
  user: {
    name: process.env.NEXT_PUBLIC_INSTANCE_USER_NAME || process.env.NEXT_PUBLIC_USER_NAME || "Raghav",
    email: process.env.NEXT_PUBLIC_INSTANCE_USER_EMAIL || process.env.NEXT_PUBLIC_USER_EMAIL || "raghavjaiswal0000@gmail.com",
    avatar: process.env.NEXT_PUBLIC_USER_AVATAR || "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: PieChart,
      isActive: true,
      items: [
        {
          title: "Historical Data",
          url: "/",
          icon: SquareTerminal,
        },
        {
          title: "Overview",
          url: "#",
        },
        {
          title: "Market Movers",
          url: "#",
        },
        {
          title: "Sector Performance",
          url: "#",
        },
      ],
    },
    {
      title: "LIve Market",
      url: "/market-data",
      icon: SquareTerminal,
    },
    {
      title: "Multiple Live Chart",
      url: "/live-market",
      icon: SquareTerminal,
    },
    {
      title: "Recommendation List",
      url: "/recommendations",
      icon: Star,
    },
    {
      title: "UMAP Clustering",
      url: "/umap-clustering",
      icon: Frame,
    },
    {
      title: "Watchlist",
      url: "/watchlist",
      icon: BookOpen,
      items: [
        {
          title: "My Watchlist",
          url: "/watchlist",
        },
        {
          title: "My Stocks",
          url: "#",
        },
        {
          title: "Price Alerts",
          url: "#",
        },
        {
          title: "Earnings Calendar",
          url: "#",
        },
      ],
    },
    {
      title: "Portfolio",
      url: "/portfolio",
      icon: Wallet,
      items: [
        {
          title: "Dashboard",
          url: "/portfolio",
        },
        {
          title: "Performance",
          url: "/portfolio?tab=overview",
        },
        {
          title: "Trade History",
          url: "/portfolio?tab=trades",
        },
        {
          title: "Weekly Reports",
          url: "/portfolio?tab=weekly",
        },
        {
          title: "Monthly Reports",
          url: "/portfolio?tab=monthly",
        },
      ],
    },
    {
      title: "Market News",
      url: "#",
      icon: Newspaper,
      items: [
        {
          title: "Breaking News",
          url: "#",
        },
        {
          title: "Sector Updates",
          url: "#",
        },
        {
          title: "Economic Events",
          url: "#",
        },
      ],
    },
    {
      title: "Admin",
      url: "/admin",
      icon: ShieldCheck,
      items: [
        {
          title: "Validate",
          url: "/admin/validate",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "Account",
          url: "#",
        },
        {
          title: "Notifications",
          url: "#",
        },
        {
          title: "API Connections",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Help & Support",
      url: "#",
      icon: LifeBuoy,
    },
    {
      title: "Notifications",
      url: "#",
      icon: AlertCircle,
    },
  ],
  projects: [
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/fyers/status');
      if (response.ok) {
        const data = await response.json();
        setAuthStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch auth status:', error);
      setAuthStatus(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
    // Check every 60 seconds
    const interval = setInterval(fetchAuthStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchAuthStatus]);

  // Determine auth display status
  const getAuthDisplay = (): AuthDisplay => {
    if (authLoading) {
      return { 
        color: 'text-blue-500', 
        bgColor: 'bg-blue-500/10',
        icon: AlertCircle,
        text: 'Checking...', 
        showWarning: false 
      };
    }
    
    if (!authStatus) {
      return { 
        color: 'text-red-500', 
        bgColor: 'bg-red-500/10',
        icon: XCircle,
        text: 'Unknown', 
        showWarning: true 
      };
    }
    
    // Check if token is valid and not expired
    if (authStatus.authenticated && authStatus.token_valid && !authStatus.is_expired) {
      return { 
        color: 'text-green-500', 
        bgColor: 'bg-green-500/10',
        icon: CheckCircle,
        text: 'Active', 
        showWarning: false,
        hoursRemaining: authStatus.hours_until_expiry
      };
    }
    
    // Token exists but expired
    if (authStatus.is_expired) {
      return { 
        color: 'text-red-500', 
        bgColor: 'bg-red-500/10',
        icon: XCircle,
        text: 'Expired', 
        showWarning: true 
      };
    }
    
    // Not authenticated
    return { 
      color: 'text-red-500', 
      bgColor: 'bg-red-500/10',
      icon: XCircle,
      text: 'Required', 
      showWarning: true 
    };
  };

  const authDisplay = getAuthDisplay();

  return (
    <>
      <Sidebar variant="inset" {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href="#">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <h1 className="truncate text-xl font-bold">DAKSphere</h1>
                      <span className="truncate text-xs text-muted-foreground">Trading Dashboard</span>
                    </div>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          <NavProjects projects={data.projects} />
          <NavSecondary 
            items={data.navSecondary} 
            className="mt-auto" 
            authDisplay={authDisplay}
            authStatus={authStatus}
            onAuthClick={() => setIsAuthModalOpen(true)}
          />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </>
  )
}

