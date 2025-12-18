import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Timer,
  Database,
  Calculator,
  Code,
  Copy,
  Download,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TaskInstance {
  id: string;
  dagRunId: string;
  dagTaskId: string;
  organizationId: string;
  status: string;
  attemptNumber: number;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  errorMessage: string | null;
  logs: string | null;
  taskId?: string;
  taskName?: string;
  operatorType?: string;
}

interface DagRun {
  id: string;
  dagId: string;
  organizationId: string;
  status: string;
  triggeredBy: string | null;
  config: Record<string, any> | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  dagName?: string;
  taskInstances: TaskInstance[];
}

interface XcomData {
  id: string;
  dagRunId: string;
  taskInstanceId: string;
  organizationId: string;
  key: string;
  value: Record<string, any>;
  createdAt: string;
}

interface AnalysisRun {
  id: string;
  name: string;
  status: string;
  dagRunId: string | null;
  enginesSelected: string[] | null;
  dataSources: string[] | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  createdAt: string;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  completed: CheckCircle,
  failed: XCircle,
  running: Play,
  pending: Clock,
  queued: Timer,
};

const STATUS_COLORS: Record<string, string> = {
  success: "text-green-500",
  completed: "text-green-500",
  failed: "text-red-500",
  running: "text-blue-500",
  pending: "text-muted-foreground",
  queued: "text-yellow-500",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

function JsonViewer({ data, title, collapsed = false }: { data: any; title?: string; collapsed?: boolean }) {
  const [isOpen, setIsOpen] = useState(!collapsed);
  const { toast } = useToast();
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({ description: "Copied to clipboard" });
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "data"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  
  const isObject = typeof data === "object";
  
  if (!isObject) {
    return <span className="font-mono text-sm">{JSON.stringify(data)}</span>;
  }
  
  const keys = Object.keys(data);
  
  return (
    <div className="space-y-1">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-sm font-medium hover-elevate rounded px-1"
            data-testid={`toggle-${title}`}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {title}
            <Badge variant="outline" className="ml-2">{keys.length} keys</Badge>
          </button>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={copyToClipboard} data-testid={`copy-${title}`}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" onClick={downloadJson} data-testid={`download-${title}`}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
      {isOpen && (
        <ScrollArea className="max-h-96">
          <pre className="text-xs font-mono bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}

function MathDisplay({ stats }: { stats: Record<string, any> }) {
  // Extract and display mathematical calculations in a readable format
  const formatValue = (value: any): string => {
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value.toLocaleString();
      return value.toFixed(6);
    }
    return String(value);
  };

  const renderStat = (name: string, value: any, indent = 0) => {
    const indentClass = `pl-${indent * 4}`;
    
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return (
        <div key={name} className={indentClass}>
          <span className="font-semibold text-muted-foreground">{name}:</span>
          <div className="ml-4">
            {Object.entries(value).map(([k, v]) => renderStat(k, v, indent + 1))}
          </div>
        </div>
      );
    }
    
    if (Array.isArray(value)) {
      return (
        <div key={name} className={`${indentClass} font-mono text-sm`}>
          <span className="text-muted-foreground">{name}:</span>{" "}
          <span className="text-foreground">[{value.length} items]</span>
        </div>
      );
    }
    
    return (
      <div key={name} className={`${indentClass} font-mono text-sm`}>
        <span className="text-muted-foreground">{name}:</span>{" "}
        <span className="text-foreground font-semibold">{formatValue(value)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {Object.entries(stats).map(([key, value]) => renderStat(key, value))}
    </div>
  );
}

function TaskDebugPanel({ task, xcomData }: { task: TaskInstance; xcomData: XcomData[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const taskXcom = xcomData.find(x => x.key === task.taskId);
  const StatusIcon = STATUS_ICONS[task.status] || AlertCircle;
  const statusColor = STATUS_COLORS[task.status] || "text-muted-foreground";

  return (
    <Card className="mb-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-md bg-muted flex items-center justify-center`}>
                  <Calculator className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {task.taskName || task.taskId || "Unknown Task"}
                    <Badge variant="outline" className="text-xs">
                      {task.operatorType}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Task ID: {task.taskId}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs">
                  <div className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatDuration(task.duration)}
                  </div>
                  {task.completedAt && (
                    <span className="text-muted-foreground">
                      {format(new Date(task.completedAt), "HH:mm:ss")}
                    </span>
                  )}
                </div>
                <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Execution Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 font-medium ${statusColor}`}>{task.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Attempt:</span>
                <span className="ml-2 font-medium">#{task.attemptNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Started:</span>
                <span className="ml-2 font-mono text-xs">
                  {task.startedAt ? format(new Date(task.startedAt), "HH:mm:ss.SSS") : "-"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-2 font-mono text-xs">
                  {task.completedAt ? format(new Date(task.completedAt), "HH:mm:ss.SSS") : "-"}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {task.errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                  {task.errorMessage}
                </pre>
              </div>
            )}

            {/* Operator Output (XCom Data) */}
            {taskXcom && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Operator Output</span>
                </div>
                
                {/* Try to display structured math for known operators */}
                {task.operatorType === "descriptive_stats" && taskXcom.value?.summary_statistics && (
                  <div className="space-y-2">
                    <Badge variant="secondary">Descriptive Statistics</Badge>
                    {Object.entries(taskXcom.value.summary_statistics).map(([metric, stats]) => (
                      <div key={metric} className="bg-muted/30 rounded-md p-3">
                        <h4 className="font-semibold text-sm mb-2 border-b pb-1">{metric}</h4>
                        <MathDisplay stats={stats as Record<string, any>} />
                      </div>
                    ))}
                  </div>
                )}

                {task.operatorType === "correlation_matrix" && taskXcom.value?.correlation_matrix && (
                  <div className="space-y-2">
                    <Badge variant="secondary">Correlation Matrix</Badge>
                    <div className="bg-muted/30 rounded-md p-3 overflow-x-auto">
                      <table className="text-xs font-mono">
                        <thead>
                          <tr>
                            <th className="p-1 text-left"></th>
                            {taskXcom.value.correlation_matrix.columns?.map((col: string) => (
                              <th key={col} className="p-1 text-right">{col.slice(0, 10)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {taskXcom.value.correlation_matrix.values?.map((row: number[], i: number) => (
                            <tr key={i}>
                              <td className="p-1 font-semibold">{taskXcom.value.correlation_matrix.columns?.[i]?.slice(0, 10)}</td>
                              {row.map((val: number, j: number) => (
                                <td key={j} className={`p-1 text-right ${val > 0.7 ? 'text-green-500' : val < -0.7 ? 'text-red-500' : ''}`}>
                                  {val.toFixed(3)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {task.operatorType === "trend_detection" && taskXcom.value?.trends && (
                  <div className="space-y-2">
                    <Badge variant="secondary">Trend Analysis</Badge>
                    {Object.entries(taskXcom.value.trends).map(([metric, trend]: [string, any]) => (
                      <div key={metric} className="bg-muted/30 rounded-md p-3">
                        <h4 className="font-semibold text-sm mb-2">{metric}</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div>Direction: <span className={trend.direction === 'increasing' ? 'text-green-500' : trend.direction === 'decreasing' ? 'text-red-500' : ''}>{trend.direction}</span></div>
                          <div>Slope: {trend.slope?.toFixed(6)}</div>
                          <div>R-squared: {trend.r_squared?.toFixed(4)}</div>
                          <div>P-value: {trend.p_value?.toFixed(6)}</div>
                          <div>Significance: <span className={trend.is_significant ? 'text-green-500' : 'text-muted-foreground'}>{trend.is_significant ? 'Yes' : 'No'}</span></div>
                          <div>Change: {trend.percent_change?.toFixed(2)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {task.operatorType === "regression_summary" && taskXcom.value?.regression_results && (
                  <div className="space-y-2">
                    <Badge variant="secondary">Regression Analysis</Badge>
                    {Object.entries(taskXcom.value.regression_results).map(([target, result]: [string, any]) => (
                      <div key={target} className="bg-muted/30 rounded-md p-3">
                        <h4 className="font-semibold text-sm mb-2">Target: {target}</h4>
                        <div className="space-y-2 text-xs font-mono">
                          <div className="grid grid-cols-3 gap-2">
                            <div>R-squared: {result.r_squared?.toFixed(4)}</div>
                            <div>Adj R-squared: {result.adj_r_squared?.toFixed(4)}</div>
                            <div>F-statistic: {result.f_statistic?.toFixed(4)}</div>
                          </div>
                          <div className="font-semibold mt-2">Coefficients:</div>
                          {result.coefficients && Object.entries(result.coefficients).map(([feature, coef]: [string, any]) => (
                            <div key={feature} className="pl-2">
                              {feature}: <span className="font-semibold">{typeof coef === 'number' ? coef.toFixed(6) : JSON.stringify(coef)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Raw JSON viewer for all data */}
                <JsonViewer data={taskXcom.value} title="Raw Output" collapsed />
              </div>
            )}

            {/* Execution Logs */}
            {task.logs && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Execution Logs</span>
                </div>
                <pre className="text-xs font-mono bg-muted/50 p-3 rounded-md whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {task.logs}
                </pre>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function DebugConsolePage() {
  const { organization } = useAuth();
  const [, params] = useRoute("/debug/:analysisRunId");
  const analysisRunId = params?.analysisRunId;
  const { toast } = useToast();

  // Fetch analysis run details
  const { data: analysisRun, isLoading: loadingRun } = useQuery<AnalysisRun>({
    queryKey: [`/api/organization/${organization?.id}/analysis-runs/${analysisRunId}`],
    enabled: !!organization?.id && !!analysisRunId,
  });

  // Fetch DAG run details with task instances
  const { data: dagRun, isLoading: loadingDag } = useQuery<DagRun>({
    queryKey: [`/api/organization/${organization?.id}/dag-runs/${analysisRun?.dagRunId}`],
    enabled: !!organization?.id && !!analysisRun?.dagRunId,
  });

  // Fetch XCom data (operator outputs)
  const { data: xcomData, isLoading: loadingXcom } = useQuery<XcomData[]>({
    queryKey: [`/api/organization/${organization?.id}/dag-runs/${analysisRun?.dagRunId}/xcom`],
    enabled: !!organization?.id && !!analysisRun?.dagRunId,
  });

  const isLoading = loadingRun || loadingDag || loadingXcom;

  const downloadAllData = () => {
    const allData = {
      analysisRun,
      dagRun,
      xcomData,
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analysis-debug-${analysisRunId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ description: "Debug data downloaded" });
  };

  if (!organization) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please sign in to access the debug console.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/analysis-reports">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Debug Console</h1>
            <p className="text-muted-foreground">Algorithm calculation details and results</p>
          </div>
        </div>
        <Button variant="outline" onClick={downloadAllData} data-testid="button-download-all">
          <Download className="h-4 w-4 mr-2" />
          Download All Data
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !analysisRun ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Analysis Run Not Found</h3>
            <p className="text-muted-foreground text-center">
              The requested analysis run could not be found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Analysis Run Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {analysisRun.name}
              </CardTitle>
              <CardDescription>
                Analysis Run ID: {analysisRun.id}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className="ml-2" variant={analysisRun.status === "completed" ? "default" : "secondary"}>
                    {analysisRun.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Engines:</span>
                  <span className="ml-2">{analysisRun.enginesSelected?.join(", ") || "None"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sources:</span>
                  <span className="ml-2">{analysisRun.dataSources?.length || 0} connected</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2">{formatDistanceToNow(new Date(analysisRun.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
              {analysisRun.dateRangeStart && analysisRun.dateRangeEnd && (
                <div className="mt-3 text-sm">
                  <span className="text-muted-foreground">Date Range:</span>
                  <span className="ml-2 font-mono">
                    {format(new Date(analysisRun.dateRangeStart), "MMM d, yyyy")} - {format(new Date(analysisRun.dateRangeEnd), "MMM d, yyyy")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DAG Run Details */}
          {dagRun && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pipeline Execution</CardTitle>
                <CardDescription>
                  DAG: {dagRun.dagName || dagRun.dagId} | Run ID: {dagRun.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="ml-2" variant={dagRun.status === "success" ? "default" : "secondary"}>
                      {dagRun.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tasks:</span>
                    <span className="ml-2">{dagRun.taskInstances?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Started:</span>
                    <span className="ml-2 font-mono text-xs">
                      {dagRun.startedAt ? format(new Date(dagRun.startedAt), "HH:mm:ss") : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <span className="ml-2 font-mono text-xs">
                      {dagRun.completedAt ? format(new Date(dagRun.completedAt), "HH:mm:ss") : "-"}
                    </span>
                  </div>
                </div>

                {dagRun.config && (
                  <JsonViewer data={dagRun.config} title="Run Configuration" collapsed />
                )}

                {dagRun.errorMessage && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-md p-3">
                    <div className="flex items-center gap-2 text-red-500 mb-1">
                      <XCircle className="h-4 w-4" />
                      <span className="font-medium">Pipeline Error</span>
                    </div>
                    <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
                      {dagRun.errorMessage}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Task Instances with Operator Outputs */}
          {dagRun?.taskInstances && dagRun.taskInstances.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Operator Calculations ({dagRun.taskInstances.length} tasks)
              </h2>
              
              {/* Sort tasks by start time */}
              {[...dagRun.taskInstances]
                .sort((a, b) => {
                  if (!a.startedAt) return 1;
                  if (!b.startedAt) return -1;
                  return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
                })
                .map((task) => (
                  <TaskDebugPanel 
                    key={task.id} 
                    task={task} 
                    xcomData={xcomData || []} 
                  />
                ))}
            </div>
          )}

          {/* No tasks found */}
          {(!dagRun?.taskInstances || dagRun.taskInstances.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Task Data Available</h3>
                <p className="text-muted-foreground text-center">
                  {analysisRun.status === "pending" 
                    ? "The analysis is still pending. Task data will appear once execution begins."
                    : analysisRun.status === "running"
                    ? "The analysis is currently running. Refresh to see updates."
                    : "No task execution data was recorded for this analysis."}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
