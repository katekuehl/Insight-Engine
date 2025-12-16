import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { BarChart3, Users, TrendingUp, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { organization, user } = useAuth();

  const quickStats = [
    {
      title: "Total Users",
      value: "—",
      description: "Connect Google Analytics",
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "Sessions",
      value: "—",
      description: "Last 30 days",
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "Bounce Rate",
      value: "—",
      description: "Average",
      icon: TrendingUp,
      color: "text-orange-600",
    },
    {
      title: "Page Views",
      value: "—",
      description: "Total views",
      icon: BarChart3,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-welcome">
          Welcome back, {organization?.name || "User"}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your analytics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat, index) => (
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
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>
              Connect your Google Analytics to see your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">View Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  See your user metrics and charts
                </p>
              </div>
              <Link href="/analytics">
                <Button data-testid="button-view-analytics">View</Button>
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
