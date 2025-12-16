import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Activity, TrendingDown, Clock, Loader2, AlertCircle, RefreshCw, Plug } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { Link } from "wouter";

type GA4Report = {
  summary: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    newUsers: number;
  };
  daily: {
    date: string;
    sessions: number;
    users: number;
    pageviews: number;
  }[];
  topPages: { page: string; views: number; users: number }[];
  topSources: { source: string; sessions: number; users: number }[];
  isSimulated: boolean;
  message?: string;
  error?: string;
};

function formatDate(dateStr: string) {
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return new Date(`${year}-${month}-${day}`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return dateStr;
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

export default function Analytics() {
  const { organization } = useAuth();
  const [dateRange, setDateRange] = useState("30");

  const { data, isLoading, refetch, isRefetching } = useQuery<GA4Report>({
    queryKey: [`/api/organization/${organization?.id}/metrics/analytics`, { days: dateRange }],
    enabled: !!organization?.id,
  });

  const chartData = data?.daily.map(d => ({
    ...d,
    date: formatDate(d.date),
  })) || [];

  const topPagesData = data?.topPages.slice(0, 5).map(p => ({
    name: p.page.length > 20 ? p.page.slice(0, 20) + "..." : p.page,
    views: p.views,
    users: p.users,
  })) || [];

  const stats = [
    {
      title: "Total Users",
      value: data ? data.summary.users.toLocaleString() : "---",
      description: `Last ${dateRange} days`,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Sessions",
      value: data ? data.summary.sessions.toLocaleString() : "---",
      description: `Last ${dateRange} days`,
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "Bounce Rate",
      value: data ? `${data.summary.bounceRate.toFixed(1)}%` : "---",
      description: "Average",
      icon: TrendingDown,
      color: "text-orange-600",
    },
    {
      title: "Avg. Session",
      value: data ? formatDuration(data.summary.avgSessionDuration) : "---",
      description: "Duration",
      icon: Clock,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            View your website performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]" data-testid="select-date-range">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => refetch()} 
            disabled={isLoading || isRefetching}
            variant="outline"
            data-testid="button-refresh-data"
          >
            {isLoading || isRefetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {data?.isSimulated && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center justify-between gap-4 p-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Showing Demo Data</p>
                <p className="text-sm text-muted-foreground">
                  {data.message || data.error || "Connect Google Analytics 4 to see your real data."}
                </p>
              </div>
            </div>
            <Link href="/integrations">
              <Button variant="outline" data-testid="button-connect-ga4">
                <Plug className="h-4 w-4 mr-2" />
                Connect GA4
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {data && !data.isSimulated && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-500">
            <Activity className="w-3 h-3 mr-1" />
            Live Data
          </Badge>
          <span className="text-sm text-muted-foreground">
            Showing real data from your Google Analytics 4 property
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono" data-testid={`stat-${stat.title.toLowerCase().replace(/[. ]/g, "-")}`}>
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Overview</CardTitle>
              <CardDescription>Users and sessions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80" data-testid="chart-traffic">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="hsl(217, 91%, 48%)" 
                      strokeWidth={2}
                      dot={false}
                      name="Users"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sessions" 
                      stroke="hsl(142, 76%, 28%)" 
                      strokeWidth={2}
                      dot={false}
                      name="Sessions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most viewed pages by pageviews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80" data-testid="chart-top-pages">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topPagesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11 }} 
                      width={100}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Bar dataKey="views" fill="hsl(217, 91%, 48%)" name="Views" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
              <CardDescription>Where your visitors are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {data.topSources.slice(0, 5).map((source, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/50">
                    <p className="font-medium truncate" title={source.source}>
                      {source.source || "(direct)"}
                    </p>
                    <p className="text-2xl font-bold mt-1">{source.sessions.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">sessions</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data && (
        <p className="text-xs text-muted-foreground text-center" data-testid="text-data-status">
          {data.isSimulated 
            ? "Showing simulated data. Connect Google Analytics 4 in Integrations for real metrics."
            : "Data refreshed just now. Showing live data from your GA4 property."}
        </p>
      )}
    </div>
  );
}
