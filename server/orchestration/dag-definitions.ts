import { storage } from "../storage";
import type { InsertDag, InsertDagTask } from "@shared/schema";

/**
 * Data Ingestion DAG - Phase 0
 * Pulls data from all configured integrations into normalized analytics tables
 */
export const DATA_INGESTION_DAG: InsertDag = {
  dagId: "data_ingestion",
  displayName: "Data Ingestion Pipeline",
  description: "Pulls data from all configured integrations (GA4, Google Ads, Meta Ads, HubSpot, Salesforce) into normalized analytics tables",
  schedule: null, // Manual trigger only for now
  isActive: true,
  defaultConfig: {
    integrations: ["google_analytics", "google_ads", "facebook_ads", "hubspot", "salesforce"],
    dateRangeInDays: 30,
  },
};

export const DATA_INGESTION_TASKS: Omit<InsertDagTask, "dagId">[] = [
  {
    taskId: "ingest_data",
    displayName: "Ingest Integration Data",
    operatorType: "data_ingestion",
    operatorConfig: {
      integrations: ["google_analytics", "google_ads", "facebook_ads", "hubspot", "salesforce"],
    },
    upstreamTaskIds: [],
    retryCount: 3,
    retryDelaySeconds: 60,
    timeoutSeconds: 1800,
  },
];

/**
 * Relationship Engine DAG - Phase 1
 * Runs all 6 analytical modules in parallel, then aggregates results
 */
export const RELATIONSHIP_ENGINE_DAG: InsertDag = {
  dagId: "relationship_engine",
  displayName: "Relationship Engine Analysis",
  description: "Executes comprehensive statistical analysis including descriptive stats, correlations, trends, time series, regression, and decomposition",
  schedule: null, // Manual trigger only
  isActive: true,
  defaultConfig: {
    dateRangeInDays: 30,
    includeModules: [
      "descriptive_stats",
      "correlation_matrix",
      "trend_detection",
      "time_series",
      "regression_summary",
      "decomposition",
    ],
  },
};

export const RELATIONSHIP_ENGINE_TASKS: Omit<InsertDagTask, "dagId">[] = [
  // Prepare data task - runs first
  {
    taskId: "prepare_data",
    displayName: "Prepare Analysis Data",
    operatorType: "python_http",
    operatorConfig: {
      endpoint: "/operators/prepare_data",
    },
    upstreamTaskIds: [],
    retryCount: 3,
    retryDelaySeconds: 60,
    timeoutSeconds: 600,
  },
  // All 6 analytical modules run in parallel after data prep
  {
    taskId: "descriptive_stats",
    displayName: "Descriptive Statistics",
    operatorType: "descriptive_stats",
    operatorConfig: {
      metrics: ["mean", "median", "std_dev", "frequency", "quantiles"],
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "correlation_matrix",
    displayName: "Correlation Matrix & Significance",
    operatorType: "correlation_matrix",
    operatorConfig: {
      methods: ["pearson", "spearman", "kendall"],
      significanceLevel: 0.05,
      includeVif: true,
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "trend_detection",
    displayName: "Trend Detection",
    operatorType: "trend_detection",
    operatorConfig: {
      algorithms: ["linear_regression", "logistic_regression", "change_point", "moving_average"],
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "time_series",
    displayName: "Time Series Modeling",
    operatorType: "time_series",
    operatorConfig: {
      models: ["arima", "exponential_smoothing", "decomposition"],
      seasonalityPeriod: 7, // Weekly seasonality
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 1200,
  },
  {
    taskId: "regression_summary",
    displayName: "Regression Summary",
    operatorType: "regression_summary",
    operatorConfig: {
      models: ["ols", "ridge", "lasso", "polynomial"],
      extractCoefficients: true,
      computeR2: true,
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "decomposition",
    displayName: "Decomposition Components",
    operatorType: "decomposition",
    operatorConfig: {
      algorithms: ["pca", "stl", "factor_analysis"],
      nComponents: 5,
    },
    upstreamTaskIds: ["prepare_data"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  // Aggregation task - waits for all 6 modules
  {
    taskId: "aggregation",
    displayName: "Aggregate Results",
    operatorType: "aggregation",
    operatorConfig: {
      combineInsights: true,
    },
    upstreamTaskIds: [
      "descriptive_stats",
      "correlation_matrix",
      "trend_detection",
      "time_series",
      "regression_summary",
      "decomposition",
    ],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  // Completion marker - final step
  {
    taskId: "complete",
    displayName: "Mark Complete",
    operatorType: "completion_marker",
    operatorConfig: {
      outputType: "relationship_engine",
    },
    upstreamTaskIds: ["aggregation"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
];

/**
 * Seed all DAG definitions into the database
 */
export async function seedDags(): Promise<void> {
  console.log("Seeding DAG definitions...");
  
  // Seed Data Ingestion DAG
  let dataIngestionDag = await storage.getDagByDagId(DATA_INGESTION_DAG.dagId);
  if (!dataIngestionDag) {
    dataIngestionDag = await storage.createDag(DATA_INGESTION_DAG);
    console.log(`Created DAG: ${dataIngestionDag.dagId}`);
    
    // Create tasks
    const tasks = DATA_INGESTION_TASKS.map(task => ({
      ...task,
      dagId: dataIngestionDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${dataIngestionDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${dataIngestionDag.dagId}`);
  }
  
  // Seed Relationship Engine DAG
  let relationshipEngineDag = await storage.getDagByDagId(RELATIONSHIP_ENGINE_DAG.dagId);
  if (!relationshipEngineDag) {
    relationshipEngineDag = await storage.createDag(RELATIONSHIP_ENGINE_DAG);
    console.log(`Created DAG: ${relationshipEngineDag.dagId}`);
    
    // Create tasks
    const tasks = RELATIONSHIP_ENGINE_TASKS.map(task => ({
      ...task,
      dagId: relationshipEngineDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${relationshipEngineDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${relationshipEngineDag.dagId}`);
  }
  
  console.log("DAG seeding complete!");
}
