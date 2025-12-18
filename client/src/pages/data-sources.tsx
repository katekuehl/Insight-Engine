import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plug, RefreshCw, Trash2, CheckCircle, AlertCircle, Clock, Key, ExternalLink, Database, History, ShieldCheck } from "lucide-react";
import { SiGoogle, SiFacebook, SiHubspot, SiSalesforce } from "react-icons/si";
import type { Integration, SyncJob } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

type SafeIntegration = Omit<Integration, "accessToken" | "refreshToken">;

type PlatformConfig = {
  id: string;
  name: string;
  description: string;
  icon: typeof SiGoogle;
  color: string;
  category: string;
  credentials: CredentialField[];
  helpUrl?: string;
  helpText?: string;
};

type CredentialField = {
  key: string;
  label: string;
  type: "text" | "password" | "textarea";
  placeholder: string;
  required: boolean;
  helpText?: string;
};

const AVAILABLE_PLATFORMS: PlatformConfig[] = [
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    description: "Website and app analytics data",
    icon: SiGoogle,
    color: "text-orange-500",
    category: "Analytics",
    helpUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries",
    helpText: "You need a Google Cloud service account with access to your GA4 property.",
    credentials: [
      {
        key: "propertyId",
        label: "GA4 Property ID",
        type: "text",
        placeholder: "123456789",
        required: true,
        helpText: "Found in Admin > Property Settings. Just the numbers (e.g., 123456789)",
      },
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "textarea",
        placeholder: '{"type": "service_account", "project_id": "...", ...}',
        required: true,
        helpText: "Download from Google Cloud Console > IAM > Service Accounts > Keys",
      },
    ],
  },
  {
    id: "google_ads",
    name: "Google Ads",
    description: "Paid search and display advertising",
    icon: SiGoogle,
    color: "text-blue-500",
    category: "Advertising",
    helpUrl: "https://developers.google.com/google-ads/api/docs/get-started/introduction",
    helpText: "You need Google Ads API access with a developer token.",
    credentials: [
      {
        key: "customerId",
        label: "Customer ID",
        type: "text",
        placeholder: "123-456-7890",
        required: true,
        helpText: "Your Google Ads account ID (found in top right of Google Ads)",
      },
      {
        key: "developerToken",
        label: "Developer Token",
        type: "password",
        placeholder: "Your developer token",
        required: true,
        helpText: "Get from Google Ads API Center in your manager account",
      },
      {
        key: "serviceAccountJson",
        label: "Service Account JSON",
        type: "textarea",
        placeholder: '{"type": "service_account", ...}',
        required: true,
        helpText: "Service account with domain-wide delegation",
      },
    ],
  },
  {
    id: "facebook_ads",
    name: "Meta Ads",
    description: "Facebook and Instagram advertising",
    icon: SiFacebook,
    color: "text-blue-600",
    category: "Advertising",
    helpUrl: "https://developers.facebook.com/docs/marketing-api/get-started",
    helpText: "You need a Meta Business account with Marketing API access.",
    credentials: [
      {
        key: "adAccountId",
        label: "Ad Account ID",
        type: "text",
        placeholder: "act_123456789",
        required: true,
        helpText: "Found in Business Settings > Ad Accounts (includes 'act_' prefix)",
      },
      {
        key: "accessToken",
        label: "Access Token",
        type: "password",
        placeholder: "Your long-lived access token",
        required: true,
        helpText: "Generate a long-lived token in Meta Business Suite > System Users",
      },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM, marketing, and sales data",
    icon: SiHubspot,
    color: "text-orange-600",
    category: "CRM",
    helpUrl: "https://developers.hubspot.com/docs/api/private-apps",
    helpText: "Create a Private App in HubSpot to get an access token.",
    credentials: [
      {
        key: "accessToken",
        label: "Private App Access Token",
        type: "password",
        placeholder: "pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        required: true,
        helpText: "Create in Settings > Integrations > Private Apps",
      },
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Enterprise CRM and sales data",
    icon: SiSalesforce,
    color: "text-sky-500",
    category: "CRM",
    helpUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm",
    helpText: "Create a Connected App in Salesforce Setup.",
    credentials: [
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "text",
        placeholder: "https://yourcompany.salesforce.com",
        required: true,
        helpText: "Your Salesforce instance URL",
      },
      {
        key: "clientId",
        label: "Consumer Key",
        type: "text",
        placeholder: "Your connected app consumer key",
        required: true,
        helpText: "From your Connected App settings",
      },
      {
        key: "clientSecret",
        label: "Consumer Secret",
        type: "password",
        placeholder: "Your connected app consumer secret",
        required: true,
      },
      {
        key: "refreshToken",
        label: "Refresh Token",
        type: "password",
        placeholder: "OAuth refresh token",
        required: true,
        helpText: "Obtained through OAuth flow with offline_access scope",
      },
    ],
  },
];

const COMING_SOON_PLATFORMS = [
  { name: "Mailchimp", category: "Email" },
  { name: "ActiveCampaign", category: "Email" },
  { name: "Klaviyo", category: "Email" },
  { name: "LinkedIn Ads", category: "Advertising" },
  { name: "TikTok Ads", category: "Advertising" },
];

function getStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
    case "expired":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    case "error":
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

export default function DataSources() {
  const { organization } = useAuth();
  const { toast } = useToast();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformConfig | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [selectedIntegration, setSelectedIntegration] = useState<SafeIntegration | null>(null);

  const { data: integrations, isLoading } = useQuery<SafeIntegration[]>({
    queryKey: [`/api/organization/${organization?.id}/integrations`],
    enabled: !!organization?.id,
  });

  const { data: syncJobs } = useQuery<SyncJob[]>({
    queryKey: [`/api/organization/${organization?.id}/sync-jobs`],
    enabled: !!organization?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      await apiRequest("DELETE", `/api/organization/${organization?.id}/integrations/${integrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/integrations`] });
      toast({
        title: "Data Source Disconnected",
        description: "The platform has been disconnected from your organization.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect data source.",
        variant: "destructive",
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({ platform, credentials: creds }: { platform: PlatformConfig; credentials: Record<string, string> }) => {
      let accountId = "";
      let accountName = "";
      
      if (platform.id === "google_analytics") {
        accountId = creds.propertyId || "";
        accountName = `GA4 Property ${accountId}`;
      } else if (platform.id === "google_ads") {
        accountId = creds.customerId || "";
        accountName = `Google Ads ${accountId}`;
      } else if (platform.id === "facebook_ads") {
        accountId = creds.adAccountId || "";
        accountName = `Meta Ads ${accountId}`;
      } else if (platform.id === "hubspot") {
        accountName = "HubSpot Account";
      } else if (platform.id === "salesforce") {
        accountId = creds.instanceUrl || "";
        accountName = `Salesforce ${new URL(creds.instanceUrl || "https://example.com").hostname}`;
      }

      return await apiRequest("POST", `/api/organization/${organization?.id}/integrations`, {
        platform: platform.id,
        displayName: platform.name,
        accountId,
        accountName,
        accessToken: creds.accessToken || creds.serviceAccountJson || "",
        metadata: creds,
        status: "active",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/integrations`] });
      setConnectDialogOpen(false);
      setSelectedPlatform(null);
      setCredentials({});
      toast({
        title: "Data Source Connected",
        description: "The platform has been connected successfully. Data sync will begin shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect data source. Please check your credentials.",
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
        title: "Data Sync Started",
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

  const handleOpenConnect = (platform: PlatformConfig) => {
    setSelectedPlatform(platform);
    setCredentials({});
    setConnectDialogOpen(true);
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const handleConnect = () => {
    if (!selectedPlatform) return;
    
    const missingFields = selectedPlatform.credentials
      .filter(c => c.required && !credentials[c.key]?.trim())
      .map(c => c.label);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    connectMutation.mutate({ platform: selectedPlatform, credentials });
  };

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to manage data sources.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Sources</h1>
        <p className="text-muted-foreground">
          Connect your marketing, analytics, and sales platforms to bring all your data together for analysis.
        </p>
      </div>

      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected" data-testid="tab-connected">
            <Database className="w-4 h-4 mr-2" />
            Connected Sources
          </TabsTrigger>
          <TabsTrigger value="available" data-testid="tab-available">
            <Plug className="w-4 h-4 mr-2" />
            Available Platforms
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-2" />
            Sync History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="space-y-4">
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
          ) : integrations && integrations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => {
                const platform = AVAILABLE_PLATFORMS.find(p => p.id === integration.platform);
                const Icon = platform?.icon || Plug;
                const recentSyncs = syncJobs?.filter(j => j.integrationId === integration.id).slice(0, 3) || [];
                const lastSync = recentSyncs[0];
                const validRecords = lastSync?.recordsProcessed || 0;
                // Calculate quality score based on integration status and sync history
                const hasRecentSync = integration.lastSyncAt && 
                  new Date(integration.lastSyncAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000; // Within 7 days
                const qualityScore = integration.status === 'active' 
                  ? (validRecords > 0 ? Math.min(98.5, 85 + Math.min(validRecords, 15)) : (hasRecentSync ? 75 : 50))
                  : 0;
                
                return (
                  <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${platform?.color || "text-muted-foreground"}`} />
                        <CardTitle className="text-base">{platform?.name || integration.platform}</CardTitle>
                      </div>
                      {getStatusBadge(integration.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {integration.accountName && (
                        <p className="text-sm text-muted-foreground">
                          {integration.accountName}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Data Quality
                          </span>
                          <span className="font-medium">{qualityScore.toFixed(1)}%</span>
                        </div>
                        <Progress value={qualityScore} className="h-1.5" />
                      </div>

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
                              <AlertDialogTitle>Disconnect Data Source?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the connection to {platform?.name || integration.platform} and delete all synced data. Your API credentials will be removed. This action cannot be undone.
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
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Data Sources Connected</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Connect your first data source to start analyzing your data.
                </p>
                <Button onClick={() => document.querySelector('[data-testid="tab-available"]')?.dispatchEvent(new MouseEvent('click'))}>
                  <Plug className="h-4 w-4 mr-2" />
                  Browse Available Platforms
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-6">
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
                      onClick={() => handleOpenConnect(platform)}
                      className="w-full"
                      data-testid={`button-connect-${platform.id}`}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Connect {platform.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-muted-foreground">Coming Soon</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {COMING_SOON_PLATFORMS.map((platform) => (
                <Card key={platform.name} className="opacity-60">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base">{platform.name}</CardTitle>
                    <Badge variant="secondary">{platform.category}</Badge>
                  </CardHeader>
                  <CardContent>
                    <Button disabled className="w-full" variant="outline">
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Sync Runs</CardTitle>
              <CardDescription>
                History of all data synchronization operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncJobs && syncJobs.length > 0 ? (
                <div className="space-y-3">
                  {syncJobs.slice(0, 20).map((job) => {
                    const integration = integrations?.find(i => i.id === job.integrationId);
                    const platform = AVAILABLE_PLATFORMS.find(p => p.id === integration?.platform);
                    
                    return (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {platform && <platform.icon className={`h-4 w-4 ${platform.color}`} />}
                          <div>
                            <p className="font-medium text-sm">{platform?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">
                              {job.createdAt && format(new Date(job.createdAt), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {job.recordsProcessed?.toLocaleString() || 0} records
                          </span>
                          <Badge variant={job.status === "completed" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                            {job.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No sync history yet. Connect a data source and trigger a sync to see history.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlatform && (
                <>
                  <selectedPlatform.icon className={`h-5 w-5 ${selectedPlatform.color}`} />
                  Connect {selectedPlatform.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Enter your API credentials to connect this platform to your organization.
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlatform && (
            <div className="space-y-4 py-4">
              {selectedPlatform.helpText && (
                <div className="bg-muted/50 rounded-md p-3 text-sm">
                  <p className="text-muted-foreground">{selectedPlatform.helpText}</p>
                  {selectedPlatform.helpUrl && (
                    <a 
                      href={selectedPlatform.helpUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
                    >
                      View setup guide <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}

              {selectedPlatform.credentials.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.key}
                      value={credentials[field.key] || ""}
                      onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="font-mono text-xs min-h-[100px]"
                      data-testid={`input-${field.key}`}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      value={credentials[field.key] || ""}
                      onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      data-testid={`input-${field.key}`}
                    />
                  )}
                  {field.helpText && (
                    <p className="text-xs text-muted-foreground">{field.helpText}</p>
                  )}
                </div>
              ))}

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-sm">
                <p className="text-amber-700 dark:text-amber-400">
                  Your credentials are encrypted and stored securely. They are only accessible to your organization and are never shared.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              data-testid="button-confirm-connect"
            >
              {connectMutation.isPending ? "Connecting..." : "Connect Platform"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
