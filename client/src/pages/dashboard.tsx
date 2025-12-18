import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, Users, TrendingUp, Activity, DollarSign, Mail, Target, Database, Loader2 } from "lucide-react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber, formatCompactCurrency } from "@/lib/utils";

interface DashboardMetrics {
  analytics: {
    totalUsers: number;
    totalSessions: number;
    totalPageViews: number;
    avgBounceRate: string;
    recordCount: number;
  };
  ads: {
    totalSpend: string;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    avgRoas: string;
    recordCount: number;
  };
  crm: {
    totalContacts: number;
    totalDeals: number;
    totalRevenue: string;
    totalPipeline: string;
    recordCount: number;
  };
  email: {
    totalSent: number;
    totalOpens: number;
    avgOpenRate: string;
    recordCount: number;
  };
  summary: {
    totalDataPoints: number;
    activeIntegrations: number;
    dataQuality: string;
  };
}

export default function Dashboard() {
  const { organization, user } = useAuth();

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ['/api/organization', organization?.id, 'dashboard-metrics'],
    enabled: !!organization?.id,
  });

  if (!organization && user?.isSuperAdmin) {
    return <Redirect to="/admin" />;
  }

  if (!organization) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Organization</CardTitle>
            <CardDescription>
              You are not currently part of any organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please wait for an invitation from an organization administrator, or contact support for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use shared compact formatters from utils
  const formatNumber = (num: number | string | undefined): string => {
    if (num === undefined || num === null) return "—";
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return "—";
    return formatCompactNumber(n);
  };

  const formatCurrency = (amount: string | number | undefined): string => {
    if (amount === undefined || amount === null) return "—";
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(n)) return "—";
    return formatCompactCurrency(n);
  };

  const hasData = metrics && metrics.summary.totalDataPoints > 0;

  const quickStats = [
    {
      title: "Total Users",
      value: hasData ? formatNumber(metrics.analytics.totalUsers) : "—",
      description: hasData ? `${metrics.analytics.recordCount} analytics records` : "Connect data sources",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Sessions",
      value: hasData ? formatNumber(metrics.analytics.totalSessions) : "—",
      description: hasData ? `${metrics.analytics.avgBounceRate} bounce rate` : "Last 30 days",
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "Ad Spend",
      value: hasData ? formatCurrency(metrics.ads.totalSpend) : "—",
      description: hasData ? `${metrics.ads.avgRoas}x ROAS` : "Connect ad platforms",
      icon: DollarSign,
      color: "text-orange-600",
    },
    {
      title: "Revenue",
      value: hasData ? formatCurrency(metrics.crm.totalRevenue) : "—",
      description: hasData ? `${metrics.crm.totalDeals} deals closed` : "Connect CRM",
      icon: TrendingUp,
      color: "text-purple-600",
    },
  ];

  const detailedStats = [
    {
      title: "Page Views",
      value: hasData ? formatNumber(metrics.analytics.totalPageViews) : "—",
      icon: BarChart3,
    },
    {
      title: "Ad Clicks",
      value: hasData ? formatNumber(metrics.ads.totalClicks) : "—",
      icon: Target,
    },
    {
      title: "Emails Sent",
      value: hasData ? formatNumber(metrics.email.totalSent) : "—",
      icon: Mail,
    },
    {
      title: "Pipeline Value",
      value: hasData ? formatCurrency(metrics.crm.totalPipeline) : "—",
      icon: DollarSign,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-welcome">
          Welcome back, {organization?.name || "User"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          {hasData 
            ? `Analyzing ${formatNumber(metrics.summary.totalDataPoints)} data points across ${metrics.summary.activeIntegrations} sources`
            : "Connect your data sources to see unified analytics"
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          quickStats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono" data-testid={`stat-${stat.title.toLowerCase().replace(" ", "-")}`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {hasData && (
        <div className="grid gap-4 md:grid-cols-4">
          {detailedStats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl font-semibold font-mono">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {hasData ? "Data Summary" : "Get Started"}
            </CardTitle>
            <CardDescription>
              {hasData 
                ? `${metrics.summary.dataQuality} data quality score` 
                : "Connect your data sources to see unified analytics"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasData ? (
              <>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{metrics.summary.totalDataPoints} Data Points</h3>
                    <p className="text-sm text-muted-foreground">
                      From {metrics.summary.activeIntegrations} connected sources
                    </p>
                  </div>
                  <Link href="/data-sources">
                    <Button variant="outline" data-testid="button-view-sources">Manage</Button>
                  </Link>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Run Analysis</h3>
                    <p className="text-sm text-muted-foreground">
                      Get insights from your connected data
                    </p>
                  </div>
                  <Link href="/analysis">
                    <Button data-testid="button-run-analysis">Analyze</Button>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Connect Data Sources</h3>
                    <p className="text-sm text-muted-foreground">
                      Link your analytics, ads, and CRM platforms
                    </p>
                  </div>
                  <Link href="/data-sources">
                    <Button data-testid="button-connect-sources">Connect</Button>
                  </Link>
                </div>
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Invite Team</h3>
                    <p className="text-sm text-muted-foreground">
                      Add team members to your organization
                    </p>
                  </div>
                  <Link href="/team">
                    <Button variant="outline" data-testid="button-invite-team">Invite</Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
            <CardDescription>
              Your organization details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="text-sm font-medium" data-testid="text-org-info">
                  {organization?.name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium">{user?.email || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="text-sm font-medium capitalize">{user?.role || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm font-medium capitalize">
                  {organization?.subscriptionPlan || "Free"}
                </span>
              </div>
              {hasData && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data Quality</span>
                  <span className="text-sm font-medium">{metrics.summary.dataQuality}</span>
                </div>
              )}
            </div>
            <Link href="/billing">
              <Button variant="outline" className="w-full" data-testid="button-manage-subscription">
                Manage Subscription
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
