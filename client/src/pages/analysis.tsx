import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Plus, 
  BarChart3, 
  TrendingUp, 
  Target, 
  Lightbulb, 
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  Activity
} from "lucide-react";
import type { AnalysisRun } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const ENGINE_ICONS: Record<string, typeof BarChart3> = {
  "relationship_engine": BarChart3,
  "impact_engine": TrendingUp,
  "forecast_engine": Activity,
  "propensity_engine": Target,
  "production_serving": Lightbulb,
};

const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  "data_ingestion": "Data Import",
  "relationship_engine": "Descriptive Analytics",
  "impact_engine": "Diagnostic Analytics",
  "forecast_engine": "Predictive Analytics",
  "propensity_engine": "Prescriptive Analytics",
  "production_serving": "Operationalization",
};

function getStatusBadge(status: string | null) {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
    case "running":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
    case "failed":
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case "pending":
      return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

export default function Analysis() {
  const { organization } = useAuth();

  const { data: recentAnalyses, isLoading } = useQuery<AnalysisRun[]>({
    queryKey: [`/api/organization/${organization?.id}/analysis-runs`],
    enabled: !!organization?.id,
  });

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to access analysis features.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analysis</h1>
          <p className="text-muted-foreground">
            Run comprehensive analytics on your connected data sources
          </p>
        </div>
        <Link href="/analysis/builder" data-testid="link-new-analysis">
          <Button data-testid="button-new-analysis">
            <Plus className="h-4 w-4 mr-2" />
            Build New Analysis
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Descriptive</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              What's happening in your data?
            </p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Diagnostic</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Why is it happening?
            </p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictive</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              What will happen next?
            </p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prescriptive</CardTitle>
            <Target className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Who should you target?
            </p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operationalize</CardTitle>
            <Lightbulb className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              How to execute decisions?
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>Your most recent analysis runs</CardDescription>
            </div>
            <Link href="/analysis/reports" data-testid="link-analysis-reports">
              <Button variant="outline" size="sm" data-testid="button-view-all">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentAnalyses && recentAnalyses.length > 0 ? (
              <div className="space-y-3">
                {recentAnalyses.slice(0, 5).map((analysis) => (
                  <Link key={analysis.id} href={`/analysis/reports/${analysis.id}`} data-testid={`link-analysis-${analysis.id}`}>
                    <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{analysis.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {analysis.createdAt && formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(analysis.status)}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No analyses yet</p>
                <Link href="/analysis/builder" data-testid="link-first-analysis">
                  <Button data-testid="button-first-analysis">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Analysis
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common analysis workflows</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/analysis/builder" data-testid="link-full-analysis">
              <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Full Analysis</p>
                    <p className="text-xs text-muted-foreground">Run all 5 analytics engines</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/analysis/builder?engines=relationship_engine" data-testid="link-pattern-discovery">
              <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Quick Pattern Discovery</p>
                    <p className="text-xs text-muted-foreground">Descriptive analytics only</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/analysis/builder?engines=propensity_engine" data-testid="link-customer-targeting">
              <div className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-orange-500/10 flex items-center justify-center">
                    <Target className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Customer Targeting</p>
                    <p className="text-xs text-muted-foreground">Prescriptive analytics for segments</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
