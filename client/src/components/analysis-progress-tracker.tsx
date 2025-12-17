import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Circle, 
  Loader2, 
  XCircle,
  Clock,
  ArrowRight,
  Download,
  AlertTriangle
} from "lucide-react";
import { ENGINE_DISPLAY_NAMES, ENGINE_DESCRIPTIONS } from "@shared/schema";

type EngineStatus = "pending" | "running" | "completed" | "failed" | "skipped";

type EngineProgress = {
  engineId: string;
  displayName: string;
  status: EngineStatus;
  progressPercent: number;
  message?: string;
  summary?: string;
  metrics?: Record<string, number>;
  errorMessage?: string;
  errorSolution?: string;
};

type AnalysisProgressTrackerProps = {
  analysisId: string;
  analysisName: string;
  startedAt: Date;
  engines: EngineProgress[];
  overallStatus: "running" | "completed" | "failed";
  estimatedTimeRemaining?: number;
  onViewResults?: () => void;
  onExport?: () => void;
  onRetry?: () => void;
  onSkipFailed?: () => void;
};

function StatusIcon({ status }: { status: EngineStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-destructive" />;
    case "skipped":
      return <Circle className="h-5 w-5 text-muted-foreground" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function AnalysisProgressTracker({
  analysisId,
  analysisName,
  startedAt,
  engines,
  overallStatus,
  estimatedTimeRemaining,
  onViewResults,
  onExport,
  onRetry,
  onSkipFailed,
}: AnalysisProgressTrackerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (overallStatus === "running") {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startedAt.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startedAt, overallStatus]);

  const completedEngines = engines.filter(e => e.status === "completed").length;
  const failedEngine = engines.find(e => e.status === "failed");

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">
              {overallStatus === "running" ? "Analyzing Your Data" : 
               overallStatus === "completed" ? "Analysis Complete" : 
               "Analysis Encountered an Issue"}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {overallStatus === "running" 
                ? `Started: ${startedAt.toLocaleTimeString()}`
                : `Completed: ${new Date().toLocaleTimeString()} | Duration: ${formatDuration(elapsedTime)}`
              }
            </p>
          </div>
          {overallStatus === "completed" && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          )}
          {overallStatus === "failed" && (
            <Badge variant="destructive">
              <XCircle className="w-3 h-3 mr-1" />
              Failed
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {engines.map((engine) => (
            <div 
              key={engine.engineId}
              className={`p-3 rounded-lg border ${
                engine.status === "running" ? "border-blue-500/50 bg-blue-500/5" :
                engine.status === "failed" ? "border-destructive/50 bg-destructive/5" :
                engine.status === "completed" ? "border-green-500/30" :
                "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon status={engine.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-medium text-sm ${
                      engine.status === "pending" ? "text-muted-foreground" : ""
                    }`}>
                      {engine.displayName}
                    </span>
                    {engine.status === "running" && engine.progressPercent > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {engine.progressPercent}%
                      </span>
                    )}
                  </div>
                  
                  {engine.status === "running" && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        {engine.message || ENGINE_DESCRIPTIONS[engine.engineId] || "Processing..."}
                      </p>
                      <Progress value={engine.progressPercent} className="h-1 mt-2" />
                    </>
                  )}
                  
                  {engine.status === "completed" && engine.summary && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {engine.summary}
                    </p>
                  )}
                  
                  {engine.status === "pending" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {ENGINE_DESCRIPTIONS[engine.engineId] || "Waiting..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {overallStatus === "running" && estimatedTimeRemaining && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Estimated time remaining: {formatDuration(estimatedTimeRemaining)}</span>
          </div>
        )}

        {overallStatus === "failed" && failedEngine && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">What Happened</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {failedEngine.errorMessage || "An unexpected error occurred during analysis."}
                </p>
              </div>
            </div>
            {failedEngine.errorSolution && (
              <div>
                <p className="font-medium text-sm">What You Can Do</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {failedEngine.errorSolution}
                </p>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {onRetry && (
                <Button size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
              {onSkipFailed && (
                <Button size="sm" variant="outline" onClick={onSkipFailed}>
                  Skip {failedEngine.displayName}
                </Button>
              )}
            </div>
          </div>
        )}

        {overallStatus === "completed" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                All {completedEngines} analysis stages completed successfully
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {onViewResults && (
                <Button onClick={onViewResults} data-testid="button-view-results">
                  View Full Results
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
              {onExport && (
                <Button variant="outline" onClick={onExport} data-testid="button-export">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
