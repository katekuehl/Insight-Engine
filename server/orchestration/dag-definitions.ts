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
 * Impact Engine DAG - Phase 2
 * Diagnostic analytics: "Why did it happen?" and "What should we do?"
 * Depends on Phase 1 (Relationship Engine) completion
 */
export const IMPACT_ENGINE_DAG: InsertDag = {
  dagId: "impact_engine",
  displayName: "Impact Engine Analysis",
  description: "Diagnostic analytics with group comparison, model diagnostics, attribution modeling, and residual analysis. Answers 'why did it happen?' and 'what should we do?'",
  schedule: null, // Triggered after Phase 1 completes
  isActive: true,
  defaultConfig: {
    dependsOn: "relationship_engine", // Phase 1 must complete first
    significanceLevel: 0.05,
    kFolds: 5,
    attributionModels: ["first_touch", "last_touch", "linear", "time_decay", "position_based", "shapley"],
  },
};

export const IMPACT_ENGINE_TASKS: Omit<InsertDagTask, "dagId">[] = [
  // All 4 diagnostic modules run in parallel (after Phase 1 data is available)
  {
    taskId: "group_comparison",
    displayName: "Group Comparison",
    operatorType: "group_comparison",
    operatorConfig: {
      metrics: ["sessions", "conversions", "revenue", "bounce_rate"],
      significanceLevel: 0.05,
    },
    upstreamTaskIds: [], // No upstream in this DAG - assumes Phase 1 data available
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "model_diagnostics",
    displayName: "Model Diagnostics",
    operatorType: "model_diagnostics",
    operatorConfig: {
      kFolds: 5,
      significanceLevel: 0.05,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  {
    taskId: "attribution_modeling",
    displayName: "Attribution Modeling",
    operatorType: "attribution_modeling",
    operatorConfig: {
      models: ["first_touch", "last_touch", "linear", "time_decay", "position_based", "shapley"],
      decayRate: 0.7,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 1200, // Shapley can be slow
  },
  {
    taskId: "residual_diagnostics",
    displayName: "Residual Diagnostics",
    operatorType: "residual_diagnostics",
    operatorConfig: {
      nClusters: 3,
      dbscanEps: 0.5,
      dbscanMinSamples: 5,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 900,
  },
  // Intermediate aggregation: Group Comparison Statistics
  {
    taskId: "group_comparison_stats",
    displayName: "Group Comparison Statistics",
    operatorType: "passthrough",
    operatorConfig: {
      collectFrom: ["group_comparison"],
      outputKey: "group_comparison_statistics",
    },
    upstreamTaskIds: ["group_comparison"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
  // Intermediate aggregation: Attribution Weights & Value Allocation
  {
    taskId: "attribution_weights",
    displayName: "Attribution Weights & Value Allocation",
    operatorType: "passthrough",
    operatorConfig: {
      collectFrom: ["attribution_modeling"],
      outputKey: "attribution_weights",
    },
    upstreamTaskIds: ["attribution_modeling"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
  // Intermediate aggregation: Residual Diagnostics Summary
  {
    taskId: "residual_summary",
    displayName: "Residual Diagnostics Summary",
    operatorType: "passthrough",
    operatorConfig: {
      collectFrom: ["residual_diagnostics", "model_diagnostics"],
      outputKey: "residual_summary",
    },
    upstreamTaskIds: ["residual_diagnostics", "model_diagnostics"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
  // Phase 2 Aggregation - combines all diagnostic outputs
  {
    taskId: "phase2_aggregation",
    displayName: "Phase 2 Aggregation",
    operatorType: "phase2_aggregation",
    operatorConfig: {
      combineInsights: true,
      generateRecommendations: true,
    },
    upstreamTaskIds: [
      "group_comparison_stats",
      "attribution_weights",
      "residual_summary",
    ],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  // Completion marker
  {
    taskId: "complete",
    displayName: "Mark Complete",
    operatorType: "completion_marker",
    operatorConfig: {
      outputType: "impact_engine",
    },
    upstreamTaskIds: ["phase2_aggregation"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
];

/**
 * Forecast Engine DAG - Phase 3
 * Predictive analytics: "What will happen?" and "How confident are we?"
 * Depends on Phase 2 (Impact Engine) completion
 */
export const FORECAST_ENGINE_DAG: InsertDag = {
  dagId: "forecast_engine",
  displayName: "Forecast Engine Analysis",
  description: "Ensemble forecasting with ARIMA, Prophet, LSTM, and Exponential Smoothing. Generates point forecasts, confidence intervals, and anomaly alerts.",
  schedule: null, // Triggered after Phase 2 completes
  isActive: true,
  defaultConfig: {
    dependsOn: "impact_engine", // Phase 2 must complete first
    forecastHorizon: 30,
    confidenceLevels: [0.95, 0.99],
    ensembleWeighting: "mape", // Weight by inverse MAPE
  },
};

export const FORECAST_ENGINE_TASKS: Omit<InsertDagTask, "dagId">[] = [
  // All 4 forecasting algorithms run in parallel
  {
    taskId: "arima_forecast",
    displayName: "ARIMA Forecast",
    operatorType: "arima_forecast",
    operatorConfig: {
      forecastHorizon: 30,
      autoOrder: true,
      confidenceLevel: 0.95,
    },
    upstreamTaskIds: [], // No upstream in this DAG - assumes Phase 2 data available
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 600, // 10 min for order search
  },
  {
    taskId: "prophet_forecast",
    displayName: "Prophet Forecast",
    operatorType: "prophet_forecast",
    operatorConfig: {
      forecastHorizon: 30,
      yearlySeasonality: true,
      weeklySeasonality: true,
      confidenceLevel: 0.95,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300, // 5 min typical
  },
  {
    taskId: "lstm_forecast",
    displayName: "LSTM Forecast",
    operatorType: "lstm_forecast",
    operatorConfig: {
      forecastHorizon: 30,
      lookback: 60,
      hiddenSize: 64,
      numLayers: 2,
      epochs: 50,
      dropout: 0.2,
      confidenceLevel: 0.95,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 60,
    timeoutSeconds: 900, // 15 min for training
  },
  {
    taskId: "exponential_smoothing",
    displayName: "Exponential Smoothing",
    operatorType: "exponential_smoothing",
    operatorConfig: {
      forecastHorizon: 30,
      seasonalPeriod: 7,
      trend: "add",
      seasonal: "add",
      dampedTrend: true,
      confidenceLevel: 0.95,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  // Ensemble aggregation - combines all 4 models
  {
    taskId: "ensemble_aggregation",
    displayName: "Ensemble Aggregation",
    operatorType: "ensemble_aggregation",
    operatorConfig: {
      weightingMetric: "mape",
      minModels: 2,
    },
    upstreamTaskIds: [
      "arima_forecast",
      "prophet_forecast",
      "lstm_forecast",
      "exponential_smoothing",
    ],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
  },
  // Forecast outputs - final packaging
  {
    taskId: "forecast_outputs",
    displayName: "Forecast Outputs",
    operatorType: "forecast_outputs",
    operatorConfig: {
      confidenceLevels: [0.95, 0.99],
      anomalyThreshold: 2.0,
      generateAlerts: true,
    },
    upstreamTaskIds: ["ensemble_aggregation"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
  },
  // Completion marker
  {
    taskId: "complete",
    displayName: "Mark Complete",
    operatorType: "completion_marker",
    operatorConfig: {
      outputType: "forecast_engine",
    },
    upstreamTaskIds: ["forecast_outputs"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
];

/**
 * Propensity Engine DAG - Phase 4
 * Predictive targeting: "Who should we target?" and "What features drive outcomes?"
 * Depends on Phase 3 (Forecast Engine) completion
 */
export const PROPENSITY_ENGINE_DAG: InsertDag = {
  dagId: "propensity_engine",
  displayName: "Propensity Engine Analysis",
  description: "Feature importance, binary classification with 4 algorithms, propensity scoring, and business targeting recommendations.",
  schedule: null, // Triggered after Phase 3 completes
  isActive: true,
  defaultConfig: {
    dependsOn: "forecast_engine", // Phase 3 must complete first
    highPropensityThreshold: 0.7,
    lowPropensityThreshold: 0.3,
    ensembleWeighting: "roc_auc",
  },
};

export const PROPENSITY_ENGINE_TASKS: Omit<InsertDagTask, "dagId">[] = [
  // Feature Importance Module - 3 parallel tasks
  {
    taskId: "shap_feature_importance",
    displayName: "SHAP Feature Importance",
    operatorType: "shap_feature_importance",
    operatorConfig: {
      n_samples: 100,
      max_features: 20,
      explainer_type: "tree",
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 600,
  },
  {
    taskId: "permutation_importance",
    displayName: "Permutation Importance",
    operatorType: "permutation_importance",
    operatorConfig: {
      n_repeats: 10,
      scoring: "accuracy",
      max_features: 20,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  {
    taskId: "causal_effect_estimation",
    displayName: "Causal Effect Estimation",
    operatorType: "causal_effect_estimation",
    operatorConfig: {
      n_strata: 5,
      confidence_level: 0.95,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  // Binary Classification Module - 4 parallel classifiers
  {
    taskId: "logistic_classifier",
    displayName: "Logistic Regression",
    operatorType: "logistic_classifier",
    operatorConfig: {
      regularization: "l2",
      C: 1.0,
      cv_folds: 5,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  {
    taskId: "random_forest_classifier",
    displayName: "Random Forest",
    operatorType: "random_forest_classifier",
    operatorConfig: {
      n_estimators: 100,
      max_depth: 10,
      cv_folds: 5,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  {
    taskId: "xgboost_classifier",
    displayName: "XGBoost",
    operatorType: "xgboost_classifier",
    operatorConfig: {
      n_estimators: 100,
      max_depth: 6,
      learning_rate: 0.1,
      cv_folds: 5,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  {
    taskId: "svm_classifier",
    displayName: "SVM Classifier",
    operatorType: "svm_classifier",
    operatorConfig: {
      kernel: "rbf",
      C: 1.0,
      cv_folds: 5,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 60,
    timeoutSeconds: 600, // SVM can be slow
  },
  // Classification ensemble - combines all 4 classifiers
  {
    taskId: "classification_ensemble",
    displayName: "Classification Ensemble",
    operatorType: "classification_ensemble",
    operatorConfig: {
      weighting: "roc_auc",
      calibration: "isotonic",
      min_models: 2,
    },
    upstreamTaskIds: [
      "logistic_classifier",
      "random_forest_classifier",
      "xgboost_classifier",
      "svm_classifier",
    ],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
  },
  // Propensity Scores - combines ensemble with causal effects
  {
    taskId: "propensity_scores",
    displayName: "Propensity Scores & Effect Sizes",
    operatorType: "propensity_scores",
    operatorConfig: {
      score_bins: 10,
      high_propensity_threshold: 0.7,
      low_propensity_threshold: 0.3,
    },
    upstreamTaskIds: ["classification_ensemble", "causal_effect_estimation"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
  },
  // Ranked Feature Importances - combines all importance methods
  {
    taskId: "ranked_feature_importances",
    displayName: "Ranked Feature Importances",
    operatorType: "ranked_feature_importances",
    operatorConfig: {
      shap_weight: 0.4,
      permutation_weight: 0.4,
      causal_weight: 0.2,
      max_features: 20,
    },
    upstreamTaskIds: [
      "shap_feature_importance",
      "permutation_importance",
      "causal_effect_estimation",
    ],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 120,
  },
  // Completion marker
  {
    taskId: "complete",
    displayName: "Mark Complete",
    operatorType: "completion_marker",
    operatorConfig: {
      outputType: "propensity_engine",
    },
    upstreamTaskIds: ["propensity_scores", "ranked_feature_importances"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
];

/**
 * Production Serving DAG - End Phase
 * Operationalizes all analytical results into business-consumable formats
 * Depends on Phase 4 (Propensity Engine) completion
 */
export const PRODUCTION_SERVING_DAG: InsertDag = {
  dagId: "production_serving",
  displayName: "Production Serving",
  description: "Operationalizes analytical results into API endpoints, insight decks, stakeholder reports, and database write-back for live systems.",
  schedule: null, // Triggered after Phase 4 completes
  isActive: true,
  defaultConfig: {
    dependsOn: "propensity_engine", // Phase 4 must complete first
    deploymentMode: "staged",
    writeBackEnabled: true,
    autoDistribute: false,
  },
};

export const PRODUCTION_SERVING_TASKS: Omit<InsertDagTask, "dagId">[] = [
  // Analysis Data Layer - aggregates all upstream outputs
  {
    taskId: "analysis_data_layer",
    displayName: "Analysis Data Layer",
    operatorType: "analysis_data_layer",
    operatorConfig: {
      include_metadata: true,
      retention_days: 90,
    },
    upstreamTaskIds: [],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 300,
  },
  // Insight Deck - generates executive reports
  {
    taskId: "insight_deck",
    displayName: "Analytical Report / Insight Deck",
    operatorType: "insight_deck",
    operatorConfig: {
      format: "executive_summary",
      audience: "leadership",
      include_visualizations: true,
      max_insights: 10,
    },
    upstreamTaskIds: ["analysis_data_layer"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 180,
  },
  // Business Results Layer - delivers to stakeholders (depends on insight deck)
  {
    taskId: "business_results_layer",
    displayName: "Business Results Layer",
    operatorType: "business_results_layer",
    operatorConfig: {
      channels: ["email", "dashboard", "slack"],
      priority_threshold: 2,
      auto_distribute: false,
    },
    upstreamTaskIds: ["insight_deck"],
    retryCount: 2,
    retryDelaySeconds: 30,
    timeoutSeconds: 180,
  },
  // Production Serving Layer - deploys to live systems (parallel with business results)
  {
    taskId: "production_serving_layer",
    displayName: "Production Serving Layer",
    operatorType: "production_serving_layer",
    operatorConfig: {
      deployment_mode: "staged",
      write_back_enabled: true,
      api_endpoints_enabled: true,
      validation_required: true,
    },
    upstreamTaskIds: ["analysis_data_layer"],
    retryCount: 2,
    retryDelaySeconds: 60,
    timeoutSeconds: 300,
  },
  // Completion marker - waits for both delivery paths
  {
    taskId: "complete",
    displayName: "Mark Complete",
    operatorType: "completion_marker",
    operatorConfig: {
      outputType: "production_serving",
    },
    upstreamTaskIds: ["business_results_layer", "production_serving_layer"],
    retryCount: 1,
    retryDelaySeconds: 10,
    timeoutSeconds: 60,
  },
];

/**
 * Seed all DAG definitions into the database
 */
export async function seedDags(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set; skipping DAG seeding");
    return;
  }
  console.log("Seeding DAG definitions...");
  
  // Seed Data Ingestion DAG
  let dataIngestionDag;
  try {
    dataIngestionDag = await storage.getDagByDagId(DATA_INGESTION_DAG.dagId);
  } catch (error) {
    console.warn("Failed to connect to database; skipping DAG seeding");
    return;
  }
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
  
  // Seed Impact Engine DAG (Phase 2)
  let impactEngineDag = await storage.getDagByDagId(IMPACT_ENGINE_DAG.dagId);
  if (!impactEngineDag) {
    impactEngineDag = await storage.createDag(IMPACT_ENGINE_DAG);
    console.log(`Created DAG: ${impactEngineDag.dagId}`);
    
    // Create tasks
    const tasks = IMPACT_ENGINE_TASKS.map(task => ({
      ...task,
      dagId: impactEngineDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${impactEngineDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${impactEngineDag.dagId}`);
  }
  
  // Seed Forecast Engine DAG (Phase 3)
  let forecastEngineDag = await storage.getDagByDagId(FORECAST_ENGINE_DAG.dagId);
  if (!forecastEngineDag) {
    forecastEngineDag = await storage.createDag(FORECAST_ENGINE_DAG);
    console.log(`Created DAG: ${forecastEngineDag.dagId}`);
    
    // Create tasks
    const tasks = FORECAST_ENGINE_TASKS.map(task => ({
      ...task,
      dagId: forecastEngineDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${forecastEngineDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${forecastEngineDag.dagId}`);
  }
  
  // Seed Propensity Engine DAG (Phase 4)
  let propensityEngineDag = await storage.getDagByDagId(PROPENSITY_ENGINE_DAG.dagId);
  if (!propensityEngineDag) {
    propensityEngineDag = await storage.createDag(PROPENSITY_ENGINE_DAG);
    console.log(`Created DAG: ${propensityEngineDag.dagId}`);
    
    // Create tasks
    const tasks = PROPENSITY_ENGINE_TASKS.map(task => ({
      ...task,
      dagId: propensityEngineDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${propensityEngineDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${propensityEngineDag.dagId}`);
  }
  
  // Seed Production Serving DAG (End Phase)
  let productionServingDag = await storage.getDagByDagId(PRODUCTION_SERVING_DAG.dagId);
  if (!productionServingDag) {
    productionServingDag = await storage.createDag(PRODUCTION_SERVING_DAG);
    console.log(`Created DAG: ${productionServingDag.dagId}`);
    
    // Create tasks
    const tasks = PRODUCTION_SERVING_TASKS.map(task => ({
      ...task,
      dagId: productionServingDag!.id,
    }));
    await storage.createDagTasks(tasks);
    console.log(`Created ${tasks.length} tasks for ${productionServingDag.dagId}`);
  } else {
    console.log(`DAG already exists: ${productionServingDag.dagId}`);
  }
  
  console.log("DAG seeding complete!");
}
