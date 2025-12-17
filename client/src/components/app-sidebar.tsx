import { LayoutDashboard, BarChart3, Users, CreditCard, Shield, Database, Lightbulb, FileText, PlusCircle, ChevronDown } from "lucide-react";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";

export function AppSidebar() {
  const [location] = useLocation();
  const { organization, user } = useAuth();

  const hasOrganization = !!organization;
  const isAnalysisActive = location.startsWith("/analysis");

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" data-testid="text-org-name">
              {organization?.name || "Strata Analytics"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user?.isSuperAdmin ? "Super Admin" : "Platform"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {user?.isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin"}
                    data-testid="nav-admin"
                  >
                    <Link href="/admin">
                      <Shield />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {hasOrganization && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Overview</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/dashboard"}
                      data-testid="nav-dashboard"
                    >
                      <Link href="/dashboard">
                        <LayoutDashboard />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/data-sources"}
                      data-testid="nav-data-sources"
                    >
                      <Link href="/data-sources">
                        <Database />
                        <span>Data Sources</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Analytics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <Collapsible defaultOpen={isAnalysisActive} className="group/collapsible">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={isAnalysisActive} data-testid="nav-analysis">
                          <BarChart3 />
                          <span>Analysis</span>
                          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location === "/analysis/builder"}
                            >
                              <Link href="/analysis/builder" data-testid="nav-analysis-builder">
                                <PlusCircle className="h-4 w-4" />
                                <span>Build New Analysis</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.startsWith("/analysis/reports") || location === "/analysis"}
                            >
                              <Link href="/analysis/reports" data-testid="nav-analysis-reports">
                                <FileText className="h-4 w-4" />
                                <span>Analysis Library</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/insights"}
                      data-testid="nav-insights"
                    >
                      <Link href="/insights">
                        <Lightbulb />
                        <span>Insights & Actions</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/team"}
                      data-testid="nav-team"
                    >
                      <Link href="/team">
                        <Users />
                        <span>Team Members</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/billing"}
                      data-testid="nav-billing"
                    >
                      <Link href="/billing">
                        <CreditCard />
                        <span>Billing</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        
        {!hasOrganization && !user?.isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="p-4 text-sm text-muted-foreground">
                You are not part of any organization yet.
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Strata Analytics v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
