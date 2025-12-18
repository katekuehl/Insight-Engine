import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Search, 
  Download, 
  Share2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Filter,
  Calendar,
  User
} from "lucide-react";
import type { AnalysisRun } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

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

export default function AnalysisReports() {
  const { organization } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const { data: analyses, isLoading } = useQuery<AnalysisRun[]>({
    queryKey: [`/api/organization/${organization?.id}/analysis-runs`],
    enabled: !!organization?.id,
  });

  const filteredAnalyses = analyses?.filter((analysis) => {
    if (searchQuery && !analysis.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter !== "all" && analysis.status !== statusFilter) {
      return false;
    }
    if (dateFilter !== "all" && analysis.createdAt) {
      const createdDate = new Date(analysis.createdAt);
      const now = new Date();
      switch (dateFilter) {
        case "today":
          if (createdDate.toDateString() !== now.toDateString()) return false;
          break;
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (createdDate < weekAgo) return false;
          break;
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (createdDate < monthAgo) return false;
          break;
      }
    }
    return true;
  }) || [];

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to view analysis reports.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analysis Reports</h1>
          <p className="text-muted-foreground">
            View and manage all your analysis reports
          </p>
        </div>
        <Link href="/analysis/builder" data-testid="link-new-analysis">
          <Button data-testid="button-new-analysis">
            <Plus className="h-4 w-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search analyses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" data-testid="filter-status">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[130px]" data-testid="filter-date">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : filteredAnalyses.length > 0 ? (
            <div className="space-y-3">
              {filteredAnalyses.map((analysis) => (
                <div 
                  key={analysis.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`report-${analysis.id}`}
                >
                  <Link href={`/analysis/reports/${analysis.id}`} data-testid={`link-report-${analysis.id}`} className="flex items-center gap-4 flex-1 cursor-pointer">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{analysis.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {analysis.createdAt && formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                        </span>
                        {analysis.enginesSelected && (
                          <span>{analysis.enginesSelected.length} engines</span>
                        )}
                        {analysis.dataSources && (
                          <span>{analysis.dataSources.length} sources</span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(analysis.status)}
                    {analysis.status === "completed" && (
                      <div className="flex gap-1">
                        <Button 
                          variant="default" 
                          size="sm" 
                          onClick={() => navigate(`/insights?runId=${analysis.id}`)}
                          data-testid={`button-view-results-${analysis.id}`}
                        >
                          View Results
                        </Button>
                        <Button variant="ghost" size="icon" data-testid={`button-download-${analysis.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" data-testid={`button-share-${analysis.id}`}>
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || dateFilter !== "all"
                  ? "No analyses match your current filters."
                  : "You haven't run any analyses yet."}
              </p>
              {!searchQuery && statusFilter === "all" && dateFilter === "all" && (
                <Link href="/analysis/builder" data-testid="link-first-analysis">
                  <Button data-testid="button-first-analysis">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Analysis
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {filteredAnalyses.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredAnalyses.length} of {analyses?.length || 0} analyses
        </p>
      )}
    </div>
  );
}
