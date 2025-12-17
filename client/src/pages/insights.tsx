import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
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
  Zap
} from "lucide-react";
import type { RecommendedAction, AnalysisReport } from "@shared/schema";

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

export default function Insights() {
  const { organization } = useAuth();
  const { toast } = useToast();

  const { data: actions, isLoading: loadingActions } = useQuery<RecommendedAction[]>({
    queryKey: [`/api/organization/${organization?.id}/recommended-actions`],
    enabled: !!organization?.id,
  });

  const { data: reports } = useQuery<AnalysisReport[]>({
    queryKey: [`/api/organization/${organization?.id}/analysis-reports`],
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

  const mockInsights = [
    {
      id: "1",
      type: "propensity",
      title: "18 High-Value Customer Segments Identified",
      description: "Prescriptive analytics found 18 customer segments with 3x higher conversion probability.",
      metric: "3x",
      metricLabel: "conversion lift",
      icon: Target,
      color: "text-orange-500",
    },
    {
      id: "2",
      type: "churn",
      title: "127 Accounts at Risk of Churn",
      description: "Predictive model identified accounts showing early warning signs of disengagement.",
      metric: "127",
      metricLabel: "at-risk accounts",
      icon: AlertTriangle,
      color: "text-red-500",
    },
    {
      id: "3",
      type: "attribution",
      title: "Email Campaigns Driving 45% of Conversions",
      description: "Attribution analysis shows email is your highest-performing channel.",
      metric: "45%",
      metricLabel: "of conversions",
      icon: BarChart3,
      color: "text-blue-500",
    },
    {
      id: "4",
      type: "forecast",
      title: "Revenue Forecast: $125K Next Quarter",
      description: "Based on current trends and seasonality, expect $125K in revenue next quarter.",
      metric: "$125K",
      metricLabel: "projected",
      icon: TrendingUp,
      color: "text-green-500",
    },
  ];

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
          Actionable recommendations from your latest analyses
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {mockInsights.map((insight) => {
          const Icon = insight.icon;
          return (
            <Card key={insight.id} className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <Icon className={`h-5 w-5 ${insight.color}`} />
                <Badge variant="outline">{insight.type}</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{insight.metric}</div>
                <p className="text-xs text-muted-foreground">{insight.metricLabel}</p>
                <p className="text-sm mt-2">{insight.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          {action.targetAudience && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>{action.targetAudience}</span>
                            </div>
                          )}
                          {impact && (
                            <div className="flex items-center gap-1 text-sm">
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                              <span className="font-medium">{impact.value}</span>
                              <span className="text-muted-foreground">{impact.metric}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" data-testid={`button-push-crm-${action.id}`}>
                            <Send className="h-4 w-4 mr-2" />
                            Push to CRM
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => implementActionMutation.mutate(action.id)}
                            disabled={implementActionMutation.isPending}
                            data-testid={`button-implement-${action.id}`}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Mark Implemented
                          </Button>
                        </div>
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
                <h3 className="text-lg font-semibold mb-2">No Pending Actions</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Run an analysis to generate actionable recommendations.
                </p>
                <Button onClick={() => window.location.href = "/analysis/builder"}>
                  Build New Analysis
                </Button>
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
                const results = action.resultMetrics as { roi?: string } | null;
                
                return (
                  <Card key={action.id} className="opacity-80" data-testid={`action-implemented-${action.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-md bg-green-500/10 flex items-center justify-center`}>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{action.title}</CardTitle>
                          <CardDescription className="mt-1">
                            Implemented {action.implementedAt && new Date(action.implementedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                      {results?.roi && (
                        <Badge variant="default" className="bg-green-500">
                          ROI: {results.roi}
                        </Badge>
                      )}
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Check className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Implemented Actions Yet</h3>
                <p className="text-muted-foreground text-center">
                  Mark actions as implemented to track their ROI here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
