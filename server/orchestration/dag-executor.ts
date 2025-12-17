import { storage } from "../storage";
import type { Dag, DagTask, DagRun, TaskInstance, InsertTaskInstance } from "@shared/schema";

export type TaskExecutionResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  logs?: string;
};

export type OperatorExecutor = (
  taskInstance: TaskInstance,
  dagRun: DagRun,
  config: Record<string, unknown>,
  upstreamXcom: Record<string, unknown>
) => Promise<TaskExecutionResult>;

export class DagExecutor {
  private operators: Map<string, OperatorExecutor> = new Map();
  private pythonServiceUrl: string;

  constructor(pythonServiceUrl?: string) {
    // Allow configuration via environment variable or constructor
    this.pythonServiceUrl = pythonServiceUrl || 
      process.env.ANALYTICS_SERVICE_URL || 
      "http://localhost:8000";
    this.registerDefaultOperators();
  }

  /**
   * Check if the Python analytics service is available
   */
  async checkPythonServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  registerOperator(operatorType: string, executor: OperatorExecutor) {
    this.operators.set(operatorType, executor);
  }

  private registerDefaultOperators() {
    this.registerOperator("python_http", this.createPythonHttpOperator());
    this.registerOperator("data_ingestion", this.createDataIngestionOperator());
    this.registerOperator("completion_marker", this.createCompletionMarkerOperator());
    this.registerOperator("passthrough", this.createPassthroughOperator());
    
    // Phase 1: Relationship Engine operators - all call Python service
    const phase1Operators = [
      "descriptive_stats",
      "correlation_matrix",
      "trend_detection",
      "time_series",
      "regression_summary",
      "decomposition",
      "aggregation",
    ];
    
    // Phase 2: Impact Engine operators - all call Python service
    const phase2Operators = [
      "group_comparison",
      "model_diagnostics",
      "attribution_modeling",
      "residual_diagnostics",
      "phase2_aggregation",
    ];
    
    const allAnalyticalOperators = [...phase1Operators, ...phase2Operators];
    
    for (const op of allAnalyticalOperators) {
      this.registerOperator(op, this.createAnalyticalOperator(op));
    }
  }

  private createPythonHttpOperator(): OperatorExecutor {
    return async (taskInstance, dagRun, config, upstreamXcom) => {
      const endpoint = config.endpoint as string || "/execute";
      const method = config.method as string || "POST";
      
      try {
        const response = await fetch(`${this.pythonServiceUrl}${endpoint}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_instance_id: taskInstance.id,
            dag_run_id: dagRun.id,
            organization_id: dagRun.organizationId,
            config,
            upstream_data: upstreamXcom,
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error };
        }
        
        const output = await response.json();
        return { success: true, output };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    };
  }

  private createDataIngestionOperator(): OperatorExecutor {
    return async (taskInstance, dagRun, config, upstreamXcom) => {
      // Data ingestion pulls from integrations into normalized tables
      // This will be expanded to handle different integration types
      const integrationTypes = config.integrations as string[] || [];
      const results: Record<string, unknown> = {};
      
      for (const integrationType of integrationTypes) {
        // Get integration for this org
        const integration = await storage.getIntegrationByPlatform(
          dagRun.organizationId,
          integrationType
        );
        
        if (integration) {
          results[integrationType] = {
            connected: true,
            integrationId: integration.id,
            lastSyncAt: integration.lastSyncAt,
          };
        } else {
          results[integrationType] = { connected: false };
        }
      }
      
      return {
        success: true,
        output: {
          integrations: results,
          timestamp: new Date().toISOString(),
        },
      };
    };
  }

  private createAnalyticalOperator(operatorType: string): OperatorExecutor {
    return async (taskInstance, dagRun, config, upstreamXcom) => {
      try {
        const response = await fetch(`${this.pythonServiceUrl}/operators/${operatorType}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_instance_id: taskInstance.id,
            dag_run_id: dagRun.id,
            organization_id: dagRun.organizationId,
            config,
            upstream_data: upstreamXcom,
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          return { success: false, error };
        }
        
        const output = await response.json();
        return { success: true, output };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    };
  }

  private createCompletionMarkerOperator(): OperatorExecutor {
    return async (taskInstance, dagRun, config, upstreamXcom) => {
      // Aggregates all upstream outputs into final analysis output
      await storage.createAnalysisOutput({
        dagRunId: dagRun.id,
        organizationId: dagRun.organizationId,
        outputType: config.outputType as string || "relationship_engine",
        summaryStats: upstreamXcom.descriptive_stats as any,
        correlationMatrix: upstreamXcom.correlation_matrix as any,
        trendAnalysis: upstreamXcom.trend_detection as any,
        timeSeriesModel: upstreamXcom.time_series as any,
        regressionSummary: upstreamXcom.regression_summary as any,
        decompositionComponents: upstreamXcom.decomposition as any,
        aggregatedInsights: upstreamXcom.aggregation as any,
        dataDateRange: config.dateRange as any,
      });
      
      return {
        success: true,
        output: { status: "complete", completedAt: new Date().toISOString() },
      };
    };
  }

  private createPassthroughOperator(): OperatorExecutor {
    return async (taskInstance, dagRun, config, upstreamXcom) => {
      // Passthrough operator: collects upstream data and passes it through
      // Used for intermediate aggregation nodes in the DAG
      // It merges all upstream outputs into the output directly for downstream consumption
      const collectFrom = config.collectFrom as string[] || [];
      const outputKey = config.outputKey as string || "passthrough";
      
      // Collect all data from upstream tasks
      const collected: Record<string, unknown> = {};
      for (const key of collectFrom) {
        if (upstreamXcom[key]) {
          collected[key] = upstreamXcom[key];
        }
      }
      
      // Also include any other upstream data not explicitly listed
      // This ensures all upstream outputs flow through
      for (const [key, value] of Object.entries(upstreamXcom)) {
        if (!collected[key]) {
          collected[key] = value;
        }
      }
      
      return {
        success: true,
        output: {
          ...collected, // Include all collected data at top level for downstream access
          [outputKey]: collected, // Also include under the output key
          collectedFrom: collectFrom,
          timestamp: new Date().toISOString(),
        },
      };
    };
  }

  /**
   * Topologically sort tasks based on dependencies
   */
  topologicalSort(tasks: DagTask[]): DagTask[] {
    const taskMap = new Map<string, DagTask>();
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();
    
    // Build maps
    for (const task of tasks) {
      taskMap.set(task.taskId, task);
      inDegree.set(task.taskId, 0);
      adjacencyList.set(task.taskId, []);
    }
    
    // Build dependency graph
    for (const task of tasks) {
      const upstreams = task.upstreamTaskIds || [];
      for (const upstream of upstreams) {
        if (adjacencyList.has(upstream)) {
          adjacencyList.get(upstream)!.push(task.taskId);
          inDegree.set(task.taskId, (inDegree.get(task.taskId) || 0) + 1);
        }
      }
    }
    
    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    const sorted: DagTask[] = [];
    
    // Find all tasks with no dependencies
    Array.from(inDegree.entries()).forEach(([taskId, degree]) => {
      if (degree === 0) {
        queue.push(taskId);
      }
    });
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const task = taskMap.get(current);
      if (task) {
        sorted.push(task);
      }
      
      // Reduce in-degree for downstream tasks
      for (const downstream of adjacencyList.get(current) || []) {
        const newDegree = (inDegree.get(downstream) || 1) - 1;
        inDegree.set(downstream, newDegree);
        if (newDegree === 0) {
          queue.push(downstream);
        }
      }
    }
    
    // Check for cycles
    if (sorted.length !== tasks.length) {
      throw new Error("Cycle detected in DAG task dependencies");
    }
    
    return sorted;
  }

  /**
   * Get tasks that are ready to run (all upstream tasks completed)
   */
  getReadyTasks(
    tasks: DagTask[],
    taskInstances: TaskInstance[]
  ): DagTask[] {
    const completedTaskIds = new Set(
      taskInstances
        .filter(ti => ti.status === "success")
        .map(ti => {
          // Get the task from dagTask
          const task = tasks.find(t => t.id === ti.dagTaskId);
          return task?.taskId;
        })
        .filter(Boolean)
    );
    
    const pendingTaskIds = new Set(
      taskInstances
        .filter(ti => ti.status === "pending" || ti.status === "queued")
        .map(ti => {
          const task = tasks.find(t => t.id === ti.dagTaskId);
          return task?.taskId;
        })
        .filter(Boolean)
    );
    
    return tasks.filter(task => {
      // Skip if already running or completed
      if (completedTaskIds.has(task.taskId) || !pendingTaskIds.has(task.taskId)) {
        return false;
      }
      
      // Check if all upstreams are completed
      const upstreams = task.upstreamTaskIds || [];
      return upstreams.every(upstream => completedTaskIds.has(upstream));
    });
  }

  /**
   * Trigger a new DAG run
   */
  async triggerDag(
    dagId: string,
    organizationId: string,
    triggeredBy: string,
    config?: Record<string, unknown>
  ): Promise<DagRun> {
    // Get DAG definition
    const dag = await storage.getDagByDagId(dagId);
    if (!dag) {
      throw new Error(`DAG not found: ${dagId}`);
    }
    
    // Get all tasks for this DAG
    const tasks = await storage.getDagTasksByDagId(dag.id);
    
    // Validate DAG structure using topological sort (detects cycles)
    try {
      this.topologicalSort(tasks);
    } catch (error: any) {
      throw new Error(`Invalid DAG structure: ${error.message}`);
    }
    
    // Create DAG run
    const dagRun = await storage.createDagRun({
      dagId: dag.id,
      organizationId,
      triggeredBy,
      config: (config || dag.defaultConfig || {}) as Record<string, unknown>,
      status: "pending",
    });
    
    // Create task instances for all tasks in topological order
    const sortedTasks = this.topologicalSort(tasks);
    const taskInstances: InsertTaskInstance[] = sortedTasks.map(task => ({
      dagRunId: dagRun.id,
      dagTaskId: task.id,
      organizationId,
      status: "pending",
      attemptNumber: 1,
    }));
    
    await storage.createTaskInstances(taskInstances);
    
    // Update DAG run to running
    await storage.updateDagRun(dagRun.id, {
      status: "running",
      startedAt: new Date(),
    });
    
    return dagRun;
  }

  /**
   * Execute a single task instance
   */
  async executeTask(
    taskInstance: TaskInstance,
    dagRun: DagRun,
    task: DagTask
  ): Promise<TaskExecutionResult> {
    // Get operator executor
    const executor = this.operators.get(task.operatorType);
    if (!executor) {
      return { success: false, error: `Unknown operator: ${task.operatorType}` };
    }
    
    // Get upstream XCom data
    const xcomData = await storage.getXcomData(dagRun.id);
    const upstreamXcom: Record<string, unknown> = {};
    for (const xcom of xcomData) {
      upstreamXcom[xcom.key] = xcom.value;
    }
    
    // Update task to running
    await storage.updateTaskInstance(taskInstance.id, {
      status: "running",
      startedAt: new Date(),
    });
    
    // Execute the operator
    const startTime = Date.now();
    const result = await executor(
      taskInstance,
      dagRun,
      (task.operatorConfig as Record<string, unknown>) || {},
      upstreamXcom
    );
    const duration = Date.now() - startTime;
    
    // Update task instance with result
    await storage.updateTaskInstance(taskInstance.id, {
      status: result.success ? "success" : "failed",
      completedAt: new Date(),
      duration,
      errorMessage: result.error,
      logs: result.logs,
    });
    
    // Store XCom data if successful
    if (result.success && result.output) {
      await storage.createXcomData({
        dagRunId: dagRun.id,
        taskInstanceId: taskInstance.id,
        organizationId: dagRun.organizationId,
        key: task.taskId,
        value: result.output,
      });
    }
    
    return result;
  }

  /**
   * Process a DAG run - execute ready tasks
   */
  async processDagRun(dagRunId: string): Promise<{ completed: boolean; tasksRun: number }> {
    const dagRun = await storage.getDagRun(dagRunId);
    if (!dagRun) {
      throw new Error(`DAG run not found: ${dagRunId}`);
    }
    
    if (dagRun.status !== "running") {
      return { completed: dagRun.status === "success", tasksRun: 0 };
    }
    
    const dag = await storage.getDag(dagRun.dagId);
    if (!dag) {
      throw new Error(`DAG not found: ${dagRun.dagId}`);
    }
    
    const tasks = await storage.getDagTasksByDagId(dag.id);
    const taskInstances = await storage.getTaskInstancesByDagRun(dagRunId);
    
    // Check for failed tasks
    const failedTasks = taskInstances.filter(ti => ti.status === "failed");
    if (failedTasks.length > 0) {
      await storage.updateDagRun(dagRunId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: `Task(s) failed: ${failedTasks.map(t => t.id).join(", ")}`,
      });
      return { completed: true, tasksRun: 0 };
    }
    
    // Check if all tasks are complete
    const allComplete = taskInstances.every(ti => ti.status === "success");
    if (allComplete) {
      await storage.updateDagRun(dagRunId, {
        status: "success",
        completedAt: new Date(),
      });
      return { completed: true, tasksRun: 0 };
    }
    
    // Get ready tasks and execute them
    const readyTasks = this.getReadyTasks(tasks, taskInstances);
    let tasksRun = 0;
    
    // Execute ready tasks in parallel
    const executions = readyTasks.map(async task => {
      const instance = taskInstances.find(ti => ti.dagTaskId === task.id);
      if (instance) {
        await this.executeTask(instance, dagRun, task);
        tasksRun++;
      }
    });
    
    await Promise.all(executions);
    
    // Check again if all complete after execution
    const updatedInstances = await storage.getTaskInstancesByDagRun(dagRunId);
    const nowComplete = updatedInstances.every(ti => ti.status === "success");
    
    if (nowComplete) {
      await storage.updateDagRun(dagRunId, {
        status: "success",
        completedAt: new Date(),
      });
      return { completed: true, tasksRun };
    }
    
    return { completed: false, tasksRun };
  }
}

export const dagExecutor = new DagExecutor();
