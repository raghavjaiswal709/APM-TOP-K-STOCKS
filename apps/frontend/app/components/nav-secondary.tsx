import * as React from "react"
import { type LucideIcon, ShieldCheck, AlertTriangle, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AuthStatus {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  is_expired?: boolean;
  hours_until_expiry?: number;
  jwt_expires_at?: string;
}

interface AuthDisplay {
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  showWarning: boolean;
  hoursRemaining?: number;
}

export function NavSecondary({
  items,
  authDisplay,
  authStatus,
  onAuthClick,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
  authDisplay?: AuthDisplay
  authStatus?: AuthStatus | null
  onAuthClick?: () => void
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const AuthIcon = authDisplay?.icon || AlertCircle;
  
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items?.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild size="sm">
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          
          {/* Authentication Item with Status Indicator */}
          <SidebarMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton 
                    size="sm" 
                    onClick={(e) => {
                      e.preventDefault();
                      onAuthClick?.();
                    }}
                    className="cursor-pointer"
                  >
                    <ShieldCheck />
                    <span className="flex-1">Authentication</span>
                    {authDisplay && (
                      <div className="flex items-center">
                        {authDisplay.showWarning ? (
                          <div className="relative">
                            <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                          </div>
                        ) : (
                          <AuthIcon className={`h-4 w-4 ${authDisplay.color}`} />
                        )}
                      </div>
                    )}
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      {authDisplay && <AuthIcon className={`h-4 w-4 ${authDisplay.color}`} />}
                      Broker Auth: {authDisplay?.text || 'Unknown'}
                    </p>
                    {authStatus?.jwt_expires_at && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {new Date(authStatus.jwt_expires_at).toLocaleString('en-IN', { 
                          timeZone: 'Asia/Kolkata',
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })}
                      </p>
                    )}
                    {authDisplay?.hoursRemaining !== undefined && authDisplay.hoursRemaining > 0 && (
                      <p className="text-xs text-green-500">
                        {authDisplay.hoursRemaining.toFixed(1)} hours remaining
                      </p>
                    )}
                    {authDisplay?.showWarning && (
                      <p className="text-xs text-red-500 font-medium">
                        ⚠️ Click to authenticate
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

