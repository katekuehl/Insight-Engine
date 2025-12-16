import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Activity, TrendingDown, Clock, Loader2, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { AnalyticsSnapshot } from "@shared/schema";

const CHART_COLORS = ["hsl(217, 91%, 48%)", "hsl(198, 93%, 32%)", "hsl(142, 76%, 28%)", "hsl(280, 87%, 35%)", "hsl(24, 94%, 38%)"];

function generateMockData(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      users: Math.floor(Math.random() * 500) + 100,
      sessions: Math.floor(Math.random() * 800) + 200,
    });
  }
  return data;
}

const mockPageData = [
  { name: "Home", views: 4200 },
  { name: "Products", views: 3100 },
  { name: "About", views: 2400 },
  { name: "Contact", views: 1800 },
  { name: "Blog", views: 1200 },
];

export default function Analytics() {
  const { organization } = useAuth();
  const [dateRange, setDateRange] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(false);

  const { data: snapshots = [] } = useQuery<AnalyticsSnapshot[]>({
    queryKey: ["/api/organization", organization?.id, "analytics"],
    enabled: !!organization?.id,
  });

  const chartData = generateMockData(parseInt(dateRange));
  
  const totalUsers = chartData.reduce((sum, d) => sum + d.users, 0);
  const totalSessions = chartData.reduce((sum, d) => sum + d.sessions, 0);
  const avgBounceRate = 42;
  const avgSessionDuration = 185;

  const handleFetchData = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setHasData(true);
    setIsLoading(false);
  };

  const stats = [
    {
      title: "Total Users",
      value: hasData ? totalUsers.toLocaleString() : "—",
      description: `Last ${dateRange} days`,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Total Sessions",
      value: hasData ? totalSessions.toLocaleString() : "—",
      description: `Last ${dateRange} days`,
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "Bounce Rate",
      value: hasData ? `${avgBounceRate}%` : "—",
      description: "Average",
      icon: TrendingDown,
      color: "text-orange-600",
    },
    {
      title: "Avg. Session",
      value: hasData ? `${Math.floor(avgSessionDuration / 60)}m ${avgSessionDuration % 60}s` : "—",
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
            onClick={handleFetchData} 
            disabled={isLoading}
            data-testid="button-fetch-data"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2 h-4 w-4" />
                Fetch Data
              </>
            )}
          </Button>
        </div>
      </div>

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
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasData && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-data">No Data Available</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Click "Fetch Data" to load your Google Analytics data. Make sure your GA4 property is connected.
            </p>
            <Button onClick={handleFetchData} data-testid="button-fetch-data-empty">
              <BarChart3 className="mr-2 h-4 w-4" />
              Fetch Google Analytics Data
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
              <CardDescription>Daily active users over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80" data-testid="chart-user-growth">
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
                    <Line 
                      type="monotone" 
                      dataKey="users" 
                      stroke="hsl(217, 91%, 48%)" 
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sessions" 
                      stroke="hsl(142, 76%, 28%)" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most viewed pages by page views</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80" data-testid="chart-top-pages">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockPageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="views"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {mockPageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {hasData && (
        <p className="text-xs text-muted-foreground text-center" data-testid="text-data-freshness">
          Data refreshed just now. Using simulated data for demonstration.
        </p>
      )}
    </div>
  );
}
