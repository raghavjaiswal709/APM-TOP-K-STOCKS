"use client"

import * as React from "react"
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

const data = {
  user: {
    name: "Raghav",
    email: "raghavjaiswal0000@gmail.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      icon: PieChart,
      isActive: true,
      items: [
        { title: "Historical Data",
      url: "/",
      icon: SquareTerminal,},
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
      // items: [
      //   {
      //     title: "Undervalued Growth",
      //     url: "#",
      //   },
      //   {
      //     title: "Buy the Dip",
      //     url: "#",
      //   },
      //   {
      //     title: "High Dividend Yield",
      //     url: "#",
      //   },
      //   {
      //     title: "Analyst Picks",
      //     url: "#",
      //   },
      // ],
    },
    {
      title: "Multiple Live Chart",
      url: "/live-market",
      icon: SquareTerminal,
      // items: [
      //   {
      //     title: "Undervalued Growth",
      //     url: "#",
      //   },
      //   {
      //     title: "Buy the Dip",
      //     url: "#",
      //   },
      //   {
      //     title: "High Dividend Yield",
      //     url: "#",
      //   },
      //   {
      //     title: "Analyst Picks",
      //     url: "#",
      //   },
      // ],
    },
    {
      title: "Recommendation List",
      url: "/recommendations",
      icon: Star,
      // icon: SquareTerminal,
      
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
      url: "#",
      icon: Wallet,
      items: [
        {
          title: "Performance",
          url: "#",
        },
        {
          title: "Diversification",
          url: "#",
        },
        {
          title: "Risk Analysis",
          url: "#",
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
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <h1 className="truncate text-xl font-bold">DAKSphere</h1>
                  <span className="truncate text-xs"></span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
