import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AnalysisProgressTracker } from "@/components/analysis-progress-tracker";
import { 
  Play, 
  Calendar as CalendarIcon, 
  Database,
  BarChart3,
  TrendingUp,
  Activity,
  Target,
  Lightbulb,
  Save,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import { SiGoogle, SiFacebook, SiHubspot, SiSalesforce } from "react-icons/si";
import type { Integration, AnalysisRun } from "@shared/schema";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

type SafeIntegration = Omit<Integration, "accessToken" | "refreshToken">;

const ENGINES = [
  {
    id: "relationship_engine",
    name: "Descriptive Analytics",
    description: "Understand patterns and correlations in your data",
    icon: BarChart3,
    color: "text-blue-500",
    step: 1,
  },
  {
    id: "impact_engine",
    name: "Diagnostic Analytics",
    description: "Identify what factors drive your key outcomes",
    icon: TrendingUp,
    color: "text-purple-500",
    step: 2,
  },
  {
    id: "forecast_engine",
    name: "Predictive Analytics",
    description: "Project future performance with confidence",
    icon: Activity,
    color: "text-green-500",
    step: 3,
  },
  {
    id: "propensity_engine",
    name: "Prescriptive Analytics",
    description: "Identify high-value customer segments to target",
    icon: Target,
    color: "text-orange-500",
    step: 4,
  },
  {
    id: "production_serving",
    name: "Operationalization",
    description: "Generate actionable recommendations and reports",
    icon: Lightbulb,
    color: "text-yellow-500",
    step: 5,
  },
];

const PLATFORM_ICONS: Record<string, typeof SiGoogle> = {
  google_analytics: SiGoogle,
  google_ads: SiGoogle,
  facebook_ads: SiFacebook,
  hubspot: SiHubspot,
  salesforce: SiSalesforce,
};

const BUSINESS_OUTCOMES = [
  { value: "purchase", label: "Purchases / Conversions" },
  { value: "churn", label: "Customer Churn" },
  { value: "engagement", label: "User Engagement" },
  { value: "revenue", label: "Revenue Growth" },
  { value: "leads", label: "Lead Generation" },
];

export default function AnalysisBuilder() {
  const { organization, user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [analysisName, setAnalysisName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>(ENGINES.map(e => e.id));
  const [businessOutcome, setBusinessOutcome] = useState("purchase");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 90),
    to: new Date(),
  });
  const [isRunning, setIsRunning] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisRun | null>(null);

  const { data: integrations, isLoading: loadingIntegrations } = useQuery<SafeIntegration[]>({
    queryKey: [`/api/organization/${organization?.id}/integrations`],
    enabled: !!organization?.id,
  });

  const activeIntegrations = integrations?.filter(i => i.status === "active") || [];

  const createAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/organization/${organization?.id}/analysis-runs`, {
        name: analysisName || `Analysis ${format(new Date(), "MMM d, yyyy h:mm a")}`,
        enginesSelected: selectedEngines,
        dataSources: selectedSources,
        dateRangeStart: dateRange.from.toISOString(),
        dateRangeEnd: dateRange.to.toISOString(),
        config: {
          businessOutcome,
        },
        createdBy: user?.id,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentAnalysis(data);
      setIsRunning(true);
      queryClient.invalidateQueries({ queryKey: [`/api/organization/${organization?.id}/analysis-runs`] });
      toast({
        title: "Analysis Started",
        description: "Your analysis is now running. Results will appear shortly.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start analysis.",
        variant: "destructive",
      });
    },
  });

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleEngineToggle = (engineId: string) => {
    setSelectedEngines(prev =>
      prev.includes(engineId)
        ? prev.filter(id => id !== engineId)
        : [...prev, engineId]
    );
  };

  const handleSelectAllEngines = () => {
    setSelectedEngines(ENGINES.map(e => e.id));
  };

  const handleRunAnalysis = () => {
    if (selectedSources.length === 0) {
      toast({
        title: "No Data Sources Selected",
        description: "Please select at least one connected data source.",
        variant: "destructive",
      });
      return;
    }
    if (selectedEngines.length === 0) {
      toast({
        title: "No Engines Selected",
        description: "Please select at least one analytics engine.",
        variant: "destructive",
      });
      return;
    }
    createAnalysisMutation.mutate();
  };

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please join an organization to build analyses.
        </div>
      </div>
    );
  }

  if (isRunning && currentAnalysis) {
    const engineProgress = ENGINES.filter(e => selectedEngines.includes(e.id)).map((engine, index) => ({
      engineId: engine.id,
      displayName: engine.name,
      status: index === 0 ? "running" as const : "pending" as const,
      progressPercent: index === 0 ? 35 : 0,
      message: index === 0 ? "Processing your data..." : undefined,
    }));

    return (
      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setIsRunning(false)} data-testid="button-back-builder">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Builder
          </Button>
        </div>
        <AnalysisProgressTracker
          analysisId={currentAnalysis.id}
          analysisName={currentAnalysis.name}
          startedAt={new Date(currentAnalysis.createdAt || Date.now())}
          engines={engineProgress}
          overallStatus="running"
          estimatedTimeRemaining={45}
          onViewResults={() => setLocation(`/analysis/reports/${currentAnalysis.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setLocation("/analysis")} data-testid="button-back-analysis">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Build New Analysis</h1>
          <p className="text-muted-foreground">
            Configure your data sources and analytics engines
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Select Data Sources
              </CardTitle>
              <CardDescription>
                Choose which connected platforms to include in this analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingIntegrations ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : activeIntegrations.length > 0 ? (
                <div className="space-y-3">
                  {activeIntegrations.map((integration) => {
                    const Icon = PLATFORM_ICONS[integration.platform] || Database;
                    const isSelected = selectedSources.includes(integration.id);
                    
                    return (
                      <div
                        key={integration.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                          isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                        )}
                        onClick={() => handleSourceToggle(integration.id)}
                        data-testid={`source-${integration.id}`}
                      >
                        <Checkbox checked={isSelected} />
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{integration.displayName}</p>
                          <p className="text-xs text-muted-foreground">{integration.accountName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                          Connected
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No connected data sources</p>
                  <Button onClick={() => setLocation("/data-sources")}>
                    Connect Data Sources
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Select Analytics Engines</CardTitle>
                  <CardDescription>
                    Choose which types of analysis to run
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleSelectAllEngines} data-testid="button-select-all-engines">
                  Select All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ENGINES.map((engine) => {
                  const Icon = engine.icon;
                  const isSelected = selectedEngines.includes(engine.id);
                  
                  return (
                    <div
                      key={engine.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                      )}
                      onClick={() => handleEngineToggle(engine.id)}
                      data-testid={`engine-${engine.id}`}
                    >
                      <Checkbox checked={isSelected} />
                      <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", 
                        isSelected ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Icon className={cn("h-4 w-4", engine.color)} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{engine.name}</p>
                          <Badge variant="secondary" className="text-xs">Step {engine.step}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{engine.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Analysis Name (Optional)</Label>
                <Input
                  id="name"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  placeholder={`Analysis ${format(new Date(), "MMM d, yyyy")}`}
                  data-testid="input-analysis-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left font-normal" data-testid="button-date-from">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateRange.from, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-start text-left font-normal" data-testid="button-date-to">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(dateRange.to, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Business Outcome</Label>
                <Select value={businessOutcome} onValueChange={setBusinessOutcome}>
                  <SelectTrigger data-testid="select-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_OUTCOMES.map((outcome) => (
                      <SelectItem key={outcome.value} value={outcome.value}>
                        {outcome.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The primary metric your analysis will focus on
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data Sources</span>
                <span className="font-medium">{selectedSources.length} selected</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Analytics Engines</span>
                <span className="font-medium">{selectedEngines.length} of {ENGINES.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date Range</span>
                <span className="font-medium">
                  {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
              <div className="pt-3 space-y-2">
                <Button
                  className="w-full"
                  onClick={handleRunAnalysis}
                  disabled={createAnalysisMutation.isPending || selectedSources.length === 0}
                  data-testid="button-run-analysis"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {createAnalysisMutation.isPending ? "Starting..." : "Run Analysis"}
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
