import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { formatCompactNumber, formatCompactCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Lightbulb, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  Users,
  DollarSign,
  BarChart3,
  Send,
  Check,
  Clock,
  Zap,
  FileText,
  Database,
  ChevronDown
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { RecommendedAction, AnalysisReport } from "@shared/schema";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const ACTION_TYPE_ICONS: Record<string, typeof Target> = {
  campaign: Target,
  email: Send,
  crm_update: Users,
  budget_adjustment: DollarSign,
  intervention: AlertTriangle,
  other: Lightbulb,
};

const ACTION_TYPE_COLORS: Record<string, string> = {
  campaign: "text-blue-500",
  email: "text-green-500",
  crm_update: "text-purple-500",
  budget_adjustment: "text-orange-500",
  intervention: "text-red-500",
  other: "text-yellow-500",
};

function getPriorityBadge(priority: number) {
  switch (priority) {
    case 1:
      return <Badge variant="destructive">High Priority</Badge>;
    case 2:
      return <Badge variant="default">Medium</Badge>;
    case 3:
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <Badge variant="outline">Normal</Badge>;
  }
}

interface DashboardMetrics {
  analytics: { totalUsers: number; totalSessions: number; totalPageViews: number; avgBounceRate: string; recordCount: number };
  ads: { totalSpend: string; totalImpressions: number; totalClicks: number; totalConversions: number; avgRoas: string; recordCount: number };
  crm: { totalContacts: number; totalDeals: number; totalRevenue: string; totalPipeline: string; recordCount: number };
  email: { totalSent: number; totalOpens: number; avgOpenRate: string; recordCount: number };
  summary: { totalDataPoints: number; activeIntegrations: number; dataQuality: string };
}

export default function Insights() {
  const { organization } = useAuth();
  const { toast } = useToast();

  const { data: actions, isLoading: loadingActions } = useQuery<RecommendedAction[]>({
    queryKey: [`/api/organization/${organization?.id}/recommended-actions`],
    enabled: !!organization?.id,
  });

  const { data: reports, isLoading: loadingReports } = useQuery<AnalysisReport[]>({
    queryKey: [`/api/organization/${organization?.id}/analysis-reports`],
    enabled: !!organization?.id,
  });

  const { data: metrics } = useQuery<DashboardMetrics>({
    queryKey: ['/api/organization', organization?.id, 'dashboard-metrics'],
    enabled: !!organization?.id,
  });

  const implementActionMutation = useMutation({
    mutationFn: async (actionId: string) => {
      await apiRequest("PATCH", `/api/organization/${organization?.id}/recommended-actions/${actionId}`, {
        implemented: true,
        implementedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/recommended-actions`] });
      toast({
        title: "Action Marked as Implemented",
        description: "The action has been marked as implemented. Track ROI in the results tab.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update action status.",
        variant: "destructive",
      });
    },
  });

  const pendingActions = actions?.filter(a => !a.implemented) || [];
  const implementedActions = actions?.filter(a => a.implemented) || [];

  // Generate insights from real metrics data
  const hasData = metrics && metrics.summary.totalDataPoints > 0;
  const hasReports = reports && reports.length > 0;
  
  const generateInsights = () => {
    if (!metrics || !hasData) return [];
    
    const insights = [];
    
    // Safe number parser that handles "—" and invalid values
    const safeParseFloat = (val: string | number | undefined): number => {
      if (val === undefined || val === null || val === "—" || val === "") return 0;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? 0 : num;
    };
    
    
    // Analytics insight
    if (metrics.analytics.recordCount > 0) {
      const bounceRate = safeParseFloat(metrics.analytics.avgBounceRate);
      const totalUsers = metrics.analytics.totalUsers || 0;
      const totalSessions = metrics.analytics.totalSessions || 0;
      const totalPageViews = metrics.analytics.totalPageViews || 0;
      insights.push({
        id: "analytics",
        type: "performance",
        title: `${formatCompactNumber(totalUsers)} Total Users Analyzed`,
        description: `Website analytics shows ${formatCompactNumber(totalSessions)} sessions with ${bounceRate.toFixed(1)}% bounce rate.`,
        metric: formatCompactNumber(totalPageViews),
        metricLabel: "page views",
        icon: BarChart3,
        color: bounceRate > 50 ? "text-orange-500" : "text-blue-500",
      });
    }
    
    // Ads insight
    if (metrics.ads.recordCount > 0) {
      const roas = safeParseFloat(metrics.ads.avgRoas);
      const spend = safeParseFloat(metrics.ads.totalSpend);
      insights.push({
        id: "ads",
        type: "advertising",
        title: `${formatCompactCurrency(spend)} Ad Spend Analyzed`,
        description: `Advertising data shows ${metrics.ads.totalConversions || 0} conversions with ${roas.toFixed(2)}x average ROAS.`,
        metric: `${roas.toFixed(1)}x`,
        metricLabel: "avg ROAS",
        icon: Target,
        color: roas >= 2 ? "text-green-500" : roas >= 1 ? "text-yellow-500" : "text-red-500",
      });
    }
    
    // CRM insight
    if (metrics.crm.recordCount > 0) {
      const revenue = safeParseFloat(metrics.crm.totalRevenue);
      const pipeline = safeParseFloat(metrics.crm.totalPipeline);
      insights.push({
        id: "crm",
        type: "revenue",
        title: `${formatCompactCurrency(revenue)} Revenue Tracked`,
        description: `CRM data shows ${metrics.crm.totalDeals || 0} deals closed with ${formatCompactCurrency(pipeline)} in pipeline.`,
        metric: formatCompactCurrency(pipeline),
        metricLabel: "pipeline value",
        icon: DollarSign,
        color: "text-green-500",
      });
    }
    
    // Email insight
    if (metrics.email.recordCount > 0) {
      const openRate = safeParseFloat(metrics.email.avgOpenRate);
      const totalSent = metrics.email.totalSent || 0;
      insights.push({
        id: "email",
        type: "engagement",
        title: `${formatCompactNumber(totalSent)} Emails Analyzed`,
        description: `Email performance shows ${openRate.toFixed(1)}% average open rate across campaigns.`,
        metric: `${openRate.toFixed(1)}%`,
        metricLabel: "open rate",
        icon: Send,
        color: openRate >= 20 ? "text-green-500" : openRate >= 10 ? "text-yellow-500" : "text-orange-500",
      });
    }
    
    return insights;
  };

  const realInsights = generateInsights();

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to view insights.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Insights & Actions</h1>
        <p className="text-muted-foreground">
          {hasData 
            ? `Insights from ${metrics.summary.totalDataPoints} data points across ${metrics.summary.activeIntegrations} sources`
            : "Connect data sources and run analyses to generate insights"
          }
        </p>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data Available</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your data sources and run an analysis to see insights here.
            </p>
            <div className="flex gap-2">
              <Link href="/data-sources">
                <Button variant="outline">Connect Sources</Button>
              </Link>
              <Link href="/analysis">
                <Button>Run Analysis</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {realInsights.map((insight) => {
              const Icon = insight.icon;
              return (
                <Card key={insight.id} className="hover-elevate">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <Icon className={`h-5 w-5 ${insight.color}`} />
                    <Badge variant="outline">{insight.type}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono">{insight.metric}</div>
                    <p className="text-xs text-muted-foreground">{insight.metricLabel}</p>
                    <p className="text-sm mt-2">{insight.title}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

        </>
      )}

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending Actions ({pendingActions.length || 0})
          </TabsTrigger>
          <TabsTrigger value="implemented" data-testid="tab-implemented">
            <Check className="w-4 h-4 mr-2" />
            Implemented ({implementedActions.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loadingActions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : pendingActions.length > 0 ? (
            <div className="space-y-4">
              {pendingActions.map((action) => {
                const Icon = ACTION_TYPE_ICONS[action.actionType] || Lightbulb;
                const color = ACTION_TYPE_COLORS[action.actionType] || "text-muted-foreground";
                const impact = action.estimatedImpact as { metric?: string; value?: string; confidence?: number } | null;
                
                return (
                  <Card key={action.id} data-testid={`action-${action.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-md bg-muted flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <CardDescription className="mt-1">{action.description}</CardDescription>
                        </div>
                      </div>
                      {getPriorityBadge(action.priority || 2)}
                    </CardHeader>
                    <CardContent>
                      {impact && (
                        <div className="flex items-center gap-4 mb-4 text-sm">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="font-medium">{impact.value}</span>
                            <span className="text-muted-foreground">{impact.metric}</span>
                          </div>
                          {impact.confidence && (
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Confidence:</span>
                              <span className="font-medium">{impact.confidence}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {action.targetAudience && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Target: {action.targetAudience}
                        </p>
                      )}
                      
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() => implementActionMutation.mutate(action.id)}
                          disabled={implementActionMutation.isPending}
                          data-testid={`button-implement-${action.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Mark Implemented
                        </Button>
                        <Button size="sm" variant="outline">
                          <ArrowUpRight className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Pending Actions</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {hasData 
                    ? "Run an analysis to generate actionable recommendations."
                    : "Connect data sources and run analyses to get recommendations."
                  }
                </p>
                <Link href="/analysis">
                  <Button data-testid="button-run-analysis">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Run Analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="implemented" className="space-y-4">
          {implementedActions.length > 0 ? (
            <div className="space-y-4">
              {implementedActions.map((action) => {
                const Icon = ACTION_TYPE_ICONS[action.actionType] || Lightbulb;
                const color = ACTION_TYPE_COLORS[action.actionType] || "text-muted-foreground";
                
                return (
                  <Card key={action.id} className="opacity-75" data-testid={`action-implemented-${action.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-md bg-muted flex items-center justify-center`}>
                          <CheckCircle className={`h-5 w-5 text-green-500`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <CardDescription className="mt-1">{action.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline">Implemented</Badge>
                    </CardHeader>
                    <CardContent>
                      {action.implementedAt && (
                        <p className="text-sm text-muted-foreground">
                          Implemented {formatDistanceToNow(new Date(action.implementedAt), { addSuffix: true })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Check className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Implemented Actions</h3>
                <p className="text-muted-foreground text-center">
                  Actions you mark as implemented will appear here for tracking.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {hasReports && (
        <Collapsible defaultOpen={false}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover-elevate">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recent Analysis Reports
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </div>
                <CardDescription>
                  Results from your completed analyses
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-4">
                  {reports.slice(0, 5).map((report) => {
                    const reportMetrics = report.metrics as { dataPointsAnalyzed?: number; enginesUsed?: string[] } | null;
                    const keyFindings = report.keyFindings as Array<{ finding: string }> | null;
                    
                    return (
                      <div key={report.id} className="p-4 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium">{report.reportName}</h4>
                            <p className="text-sm text-muted-foreground">{report.insightsSummary}</p>
                          </div>
                          <Badge variant="secondary">
                            {reportMetrics?.dataPointsAnalyzed || 0} points
                          </Badge>
                        </div>
                        {keyFindings && keyFindings.length > 0 && (
                          <ul className="text-sm space-y-1">
                            {keyFindings.slice(0, 3).map((f, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                {f.finding}
                              </li>
                            ))}
                          </ul>
                        )}
                        {report.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            Generated {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
