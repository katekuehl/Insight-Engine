import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, Trash2, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { SiGoogle, SiFacebook, SiHubspot, SiSalesforce } from "react-icons/si";
import type { Integration } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

type SafeIntegration = Omit<Integration, "accessToken" | "refreshToken">;

const AVAILABLE_PLATFORMS = [
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    description: "Website and app analytics data",
    icon: SiGoogle,
    color: "text-orange-500",
    category: "Analytics",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Paid search and display advertising",
    icon: SiGoogle,
    color: "text-blue-500",
    category: "Advertising",
  },
  {
    id: "facebook_ads",
    name: "Meta Ads",
    description: "Facebook and Instagram advertising",
    icon: SiFacebook,
    color: "text-blue-600",
    category: "Advertising",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM, marketing, and sales data",
    icon: SiHubspot,
    color: "text-orange-600",
    category: "CRM",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Enterprise CRM and sales data",
    icon: SiSalesforce,
    color: "text-sky-500",
    category: "CRM",
  },
];

function getStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
    case "expired":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    case "error":
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

export default function Integrations() {
  const { organization } = useAuth();
  const { toast } = useToast();

  const { data: integrations, isLoading } = useQuery<SafeIntegration[]>({
    queryKey: [`/api/organization/${organization?.id}/integrations`],
    enabled: !!organization?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/organization/${organization?.id}/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/integrations`] });
      toast({
        title: "Integration Disconnected",
        description: "The platform has been disconnected from your account.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect integration.",
        variant: "destructive",
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const platformInfo = AVAILABLE_PLATFORMS.find(p => p.id === platform);
      return await apiRequest("POST", `/api/organization/${organization?.id}/integrations`, {
        platform,
        displayName: platformInfo?.name || platform,
        status: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/integrations`] });
      toast({
        title: "Integration Connected",
        description: "The platform has been connected. OAuth setup will be available soon.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect integration.",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("POST", `/api/organization/${organization?.id}/integrations/${integrationId}/sync`);
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Data sync has been initiated. This may take a few minutes.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start sync.",
        variant: "destructive",
      });
    },
  });

  const connectedPlatforms = new Set(integrations?.map(i => i.platform) || []);

  const handleConnect = (platformId: string) => {
    connectMutation.mutate(platformId);
  };

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to manage integrations.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your marketing, analytics, and sales platforms to see all your data in one place.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {integrations && integrations.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Connected Platforms</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {integrations.map((integration) => {
                  const platform = AVAILABLE_PLATFORMS.find(p => p.id === integration.platform);
                  const Icon = platform?.icon || Plug;
                  
                  return (
                    <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${platform?.color || "text-muted-foreground"}`} />
                          <CardTitle className="text-base">{platform?.name || integration.platform}</CardTitle>
                        </div>
                        {getStatusBadge(integration.status)}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {integration.accountName && (
                          <p className="text-sm text-muted-foreground">
                            Account: {integration.accountName}
                          </p>
                        )}
                        {integration.lastSyncAt && (
                          <p className="text-xs text-muted-foreground">
                            Last synced: {formatDistanceToNow(new Date(integration.lastSyncAt), { addSuffix: true })}
                          </p>
                        )}
                        {integration.lastSyncError && (
                          <p className="text-xs text-destructive">
                            Error: {integration.lastSyncError}
                          </p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncMutation.mutate(integration.id)}
                            disabled={syncMutation.isPending}
                            data-testid={`button-sync-${integration.id}`}
                          >
                            <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                            Sync Now
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-disconnect-${integration.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Disconnect
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect Integration?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the connection to {platform?.name || integration.platform} and delete all synced data. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(integration.id)}
                                  data-testid={`button-confirm-disconnect-${integration.id}`}
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Available Platforms</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {AVAILABLE_PLATFORMS.filter(p => !connectedPlatforms.has(p.id)).map((platform) => {
                const Icon = platform.icon;
                
                return (
                  <Card key={platform.id} data-testid={`card-platform-${platform.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${platform.color}`} />
                        <CardTitle className="text-base">{platform.name}</CardTitle>
                      </div>
                      <Badge variant="outline">{platform.category}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <CardDescription>{platform.description}</CardDescription>
                      <Button
                        onClick={() => handleConnect(platform.id)}
                        className="w-full"
                        disabled={connectMutation.isPending}
                        data-testid={`button-connect-${platform.id}`}
                      >
                        <Plug className="h-4 w-4 mr-2" />
                        {connectMutation.isPending ? "Connecting..." : `Connect ${platform.name}`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
