import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, decimal, jsonb, serial, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Platform types for integrations
export const PLATFORM_TYPES = [
  "google_analytics",
  "google_ads",
  "facebook_ads",
  "hubspot",
  "salesforce",
] as const;

export type PlatformType = typeof PLATFORM_TYPES[number];

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  primaryContactEmail: text("primary_contact_email"), // Main contact who receives setup invite
  primaryUserId: varchar("primary_user_id"), // First user who accepted invite
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionPlan: text("subscription_plan").default("free"),
  isActive: boolean("is_active").default(true),
  companyNarrative: jsonb("company_narrative"), // Company context for analytics engines
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  supabaseUserId: text("supabase_user_id").unique(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  role: text("role").default("member"),
  isSuperAdmin: boolean("is_super_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const invites = pgTable("invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  invitedEmail: text("invited_email").notNull(),
  role: text("role").default("member"),
  isOrgSetupInvite: boolean("is_org_setup_invite").default(false), // True for primary contact invites
  createdBySuperAdmin: boolean("created_by_super_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Impersonation audit log - tracks when super admins view orgs
export const impersonationLogs = pgTable("impersonation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  superAdminId: varchar("super_admin_id").references(() => users.id).notNull(),
  targetOrgId: varchar("target_org_id").references(() => organizations.id).notNull(),
  reason: text("reason"),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planType: text("plan_type").notNull(),
  isActive: boolean("is_active").default(true),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analyticsSnapshots = pgTable("analytics_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  metricDate: timestamp("metric_date").notNull(),
  users: integer("users").default(0),
  sessions: integer("sessions").default(0),
  bounceRate: integer("bounce_rate").default(0),
  pageViews: integer("page_views").default(0),
  avgSessionDuration: integer("avg_session_duration").default(0),
});

// Platform integrations - stores OAuth connections per organization
export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  platform: text("platform").notNull(), // google_analytics, google_ads, facebook_ads, hubspot, salesforce
  displayName: text("display_name"), // User-friendly name for this connection
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: text("scopes"), // Comma-separated list of granted scopes
  accountId: text("account_id"), // Platform-specific account identifier
  accountName: text("account_name"), // Platform-specific account name
  status: text("status").default("active"), // active, expired, revoked, error
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  metadata: jsonb("metadata"), // Platform-specific additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sync job history - tracks data sync operations
export const syncJobs = pgTable("sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  status: text("status").default("pending"), // pending, running, completed, failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recordsProcessed: integer("records_processed").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Normalized ad metrics - aggregated data from all ad platforms
export const metricsAds = pgTable("metrics_ads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  platform: text("platform").notNull(),
  metricDate: timestamp("metric_date").notNull(),
  campaignId: text("campaign_id"),
  campaignName: text("campaign_name"),
  adSetId: text("ad_set_id"),
  adSetName: text("ad_set_name"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  ctr: decimal("ctr", { precision: 8, scale: 4 }).default("0"), // Click-through rate
  cpc: decimal("cpc", { precision: 10, scale: 2 }).default("0"), // Cost per click
  roas: decimal("roas", { precision: 10, scale: 2 }).default("0"), // Return on ad spend
  createdAt: timestamp("created_at").defaultNow(),
});

// Enhanced analytics metrics - website/app analytics from GA4
export const metricsAnalytics = pgTable("metrics_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  metricDate: timestamp("metric_date").notNull(),
  users: integer("users").default(0),
  newUsers: integer("new_users").default(0),
  sessions: integer("sessions").default(0),
  pageViews: integer("page_views").default(0),
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }).default("0"),
  avgSessionDuration: integer("avg_session_duration").default(0), // in seconds
  conversions: integer("conversions").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  topPages: jsonb("top_pages"), // Array of top pages with views
  trafficSources: jsonb("traffic_sources"), // Traffic source breakdown
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// ORCHESTRATION TABLES (Airflow-compatible)
// ============================================

// DAG statuses
export const DAG_STATUSES = ["active", "paused", "archived"] as const;
export type DagStatus = typeof DAG_STATUSES[number];

// Task/Run statuses
export const TASK_STATUSES = ["pending", "queued", "running", "success", "failed", "skipped", "upstream_failed"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

// Operator types for tasks
export const OPERATOR_TYPES = [
  "python_http",           // Calls Python FastAPI endpoint
  "data_ingestion",        // Pulls data from integrations
  "descriptive_stats",     // Descriptive statistics module
  "correlation_matrix",    // Correlation analysis module
  "trend_detection",       // Trend detection module
  "time_series",           // Time series modeling module
  "regression_summary",    // Regression analysis module
  "decomposition",         // PCA/STL decomposition module
  "aggregation",           // Combines outputs from multiple tasks
  "completion_marker",     // Marks pipeline as complete
] as const;
export type OperatorType = typeof OPERATOR_TYPES[number];

// DAG definitions - pipeline templates
export const dags = pgTable("dags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagId: text("dag_id").notNull().unique(), // e.g., "data_ingestion", "relationship_engine"
  displayName: text("display_name").notNull(),
  description: text("description"),
  schedule: text("schedule"), // Cron expression or null for manual trigger
  isActive: boolean("is_active").default(true),
  defaultConfig: jsonb("default_config"), // Default parameters for the DAG
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// DAG tasks - individual tasks within a DAG with dependencies
export const dagTasks = pgTable("dag_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagId: varchar("dag_id").references(() => dags.id).notNull(),
  taskId: text("task_id").notNull(), // e.g., "descriptive_stats", "correlation_matrix"
  displayName: text("display_name").notNull(),
  operatorType: text("operator_type").notNull(), // Which operator to use
  operatorConfig: jsonb("operator_config"), // Operator-specific configuration
  upstreamTaskIds: text("upstream_task_ids").array(), // Tasks that must complete before this one
  retryCount: integer("retry_count").default(3),
  retryDelaySeconds: integer("retry_delay_seconds").default(60),
  timeoutSeconds: integer("timeout_seconds").default(3600), // 1 hour default
  createdAt: timestamp("created_at").defaultNow(),
});

// DAG runs - execution instances of a DAG for an organization
export const dagRuns = pgTable("dag_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagId: varchar("dag_id").references(() => dags.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  status: text("status").default("pending"), // pending, running, success, failed
  triggeredBy: text("triggered_by"), // "scheduled", "manual", or user ID
  config: jsonb("config"), // Runtime configuration/parameters
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task instances - individual task executions within a DAG run
export const taskInstances = pgTable("task_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagRunId: varchar("dag_run_id").references(() => dagRuns.id).notNull(),
  dagTaskId: varchar("dag_task_id").references(() => dagTasks.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  status: text("status").default("pending"),
  attemptNumber: integer("attempt_number").default(1),
  queuedAt: timestamp("queued_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // In milliseconds
  errorMessage: text("error_message"),
  logs: text("logs"), // Execution logs
  createdAt: timestamp("created_at").defaultNow(),
});

// XCom data - cross-communication between tasks (Airflow pattern)
export const xcomData = pgTable("xcom_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagRunId: varchar("dag_run_id").references(() => dagRuns.id).notNull(),
  taskInstanceId: varchar("task_instance_id").references(() => taskInstances.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  key: text("key").notNull(), // e.g., "summary_stats", "correlation_matrix"
  value: jsonb("value").notNull(), // The actual data passed between tasks
  createdAt: timestamp("created_at").defaultNow(),
});

// Aggregated analysis outputs - final results from Relationship Engine
export const analysisOutputs = pgTable("analysis_outputs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dagRunId: varchar("dag_run_id").references(() => dagRuns.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  outputType: text("output_type").notNull(), // e.g., "relationship_engine", "impact_engine"
  summaryStats: jsonb("summary_stats"),
  correlationMatrix: jsonb("correlation_matrix"),
  trendAnalysis: jsonb("trend_analysis"),
  timeSeriesModel: jsonb("time_series_model"),
  regressionSummary: jsonb("regression_summary"),
  decompositionComponents: jsonb("decomposition_components"),
  aggregatedInsights: jsonb("aggregated_insights"), // Combined insights
  dataDateRange: jsonb("data_date_range"), // { start, end }
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// ANALYSIS EXECUTION & REPORTING TABLES
// ============================================

// Analysis run statuses
export const ANALYSIS_STATUSES = ["pending", "running", "completed", "failed", "cancelled"] as const;
export type AnalysisStatus = typeof ANALYSIS_STATUSES[number];

// Action types for recommended actions
export const ACTION_TYPES = ["campaign", "email", "crm_update", "budget_adjustment", "intervention", "other"] as const;
export type ActionType = typeof ACTION_TYPES[number];

// Analysis runs - user-initiated analysis executions
export const analysisRuns = pgTable("analysis_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  templateId: varchar("template_id"), // Optional reference to analysis template
  dagRunId: varchar("dag_run_id").references(() => dagRuns.id),
  status: text("status").default("pending"),
  enginesSelected: text("engines_selected").array(), // Which engines to run
  dataSources: text("data_sources").array(), // Which integrations to use
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  config: jsonb("config"), // User-configured parameters (outcome, audience, etc.)
  progressPercent: integer("progress_percent").default(0),
  currentEngine: text("current_engine"), // Currently running engine display name
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Analysis templates - saved analysis configurations
export const analysisTemplates = pgTable("analysis_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  enginesSelected: text("engines_selected").array(),
  dataSources: text("data_sources").array(),
  config: jsonb("config"), // Default parameters
  isDefault: boolean("is_default").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Analysis reports - generated reports from analysis runs
export const analysisReports = pgTable("analysis_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  analysisRunId: varchar("analysis_run_id").references(() => analysisRuns.id).notNull(),
  reportName: text("report_name").notNull(),
  insightsSummary: text("insights_summary"), // Executive summary
  keyFindings: jsonb("key_findings"), // Array of key findings
  recommendations: jsonb("recommendations"), // Array of recommendations
  metrics: jsonb("metrics"), // Summary metrics (records validated, correlations found, etc.)
  visualizations: jsonb("visualizations"), // Chart specifications
  exportFormats: text("export_formats").array(), // Available export formats
  createdAt: timestamp("created_at").defaultNow(),
});

// Recommended actions - actionable items from analysis
export const recommendedActions = pgTable("recommended_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  analysisRunId: varchar("analysis_run_id").references(() => analysisRuns.id).notNull(),
  actionType: text("action_type").notNull(), // campaign, email, crm_update, budget_adjustment, intervention
  title: text("title").notNull(),
  description: text("description"),
  targetAudience: text("target_audience"), // Who this action targets
  estimatedImpact: jsonb("estimated_impact"), // { metric, value, confidence }
  priority: integer("priority").default(1), // 1 = highest priority
  implemented: boolean("implemented").default(false),
  implementedAt: timestamp("implemented_at"),
  implementedBy: varchar("implemented_by").references(() => users.id),
  resultMetrics: jsonb("result_metrics"), // Actual results after implementation
  createdAt: timestamp("created_at").defaultNow(),
});

// Data validation log - tracks data quality per sync
export const dataValidationLog = pgTable("data_validation_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  syncJobId: varchar("sync_job_id").references(() => syncJobs.id),
  recordsTotal: integer("records_total").default(0),
  recordsValid: integer("records_valid").default(0),
  recordsInvalid: integer("records_invalid").default(0),
  validationErrors: jsonb("validation_errors"), // Array of error types and counts
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // 0-100%
  createdAt: timestamp("created_at").defaultNow(),
});

// Analysis audit log - tracks who accessed what
export const analysisAuditLog = pgTable("analysis_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  analysisRunId: varchar("analysis_run_id").references(() => analysisRuns.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // created, viewed, exported, shared, deleted
  details: jsonb("details"), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// PIPELINE METRICS TABLES (Python Pipeline)
// These match the Python dataclass schemas exactly
// ============================================

// Pipeline Website Metrics (GA4) - 22 metrics
export const pipelineMetricsWebsite = pgTable("pipeline_metrics_website", {
  id: serial("id").primaryKey(),
  metricDate: date("metric_date").notNull(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  
  // Core metrics
  sessions: integer("sessions").notNull(),
  users: integer("users").notNull(),
  newUsers: integer("new_users").notNull(),
  pageviews: integer("pageviews").notNull(),
  pagesPerSession: decimal("pages_per_session", { precision: 10, scale: 4 }).notNull(),
  avgSessionDuration: decimal("avg_session_duration", { precision: 12, scale: 2 }).notNull(),
  bounceRate: decimal("bounce_rate", { precision: 6, scale: 2 }).notNull(),
  goalCompletions: integer("goal_completions").notNull(),
  goalConversionRate: decimal("goal_conversion_rate", { precision: 6, scale: 2 }).notNull(),
  
  // Traffic source breakdown
  organicSessions: integer("organic_sessions").notNull(),
  directSessions: integer("direct_sessions").notNull(),
  paidSessions: integer("paid_sessions").notNull(),
  socialSessions: integer("social_sessions").notNull(),
  referralSessions: integer("referral_sessions").notNull(),
  emailSessions: integer("email_sessions").notNull(),
  
  // Device breakdown
  desktopSessions: integer("desktop_sessions").notNull(),
  mobileSessions: integer("mobile_sessions").notNull(),
  tabletSessions: integer("tablet_sessions").notNull(),
  
  // Data quality
  isSynthetic: boolean("is_synthetic").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pipeline Ads Metrics (Google Ads, Meta Ads) - platform-specific
export const pipelineMetricsAds = pgTable("pipeline_metrics_ads", {
  id: serial("id").primaryKey(),
  metricDate: date("metric_date").notNull(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull(), // 'google_ads' or 'meta_ads'
  
  // Core ad metrics
  impressions: integer("impressions").notNull(),
  clicks: integer("clicks").notNull(),
  ctr: decimal("ctr", { precision: 8, scale: 4 }).notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).notNull(),
  conversions: integer("conversions").notNull(),
  conversionRate: decimal("conversion_rate", { precision: 8, scale: 4 }).notNull(),
  cpc: decimal("cpc", { precision: 10, scale: 2 }).notNull(),
  cpa: decimal("cpa", { precision: 12, scale: 2 }).notNull(),
  roas: decimal("roas", { precision: 10, scale: 4 }).notNull(),
  
  // Google Ads specific (NULL for Meta)
  searchSpend: decimal("search_spend", { precision: 12, scale: 2 }),
  displaySpend: decimal("display_spend", { precision: 12, scale: 2 }),
  remarketingSpend: decimal("remarketing_spend", { precision: 12, scale: 2 }),
  
  // Meta Ads specific (NULL for Google)
  facebookSpend: decimal("facebook_spend", { precision: 12, scale: 2 }),
  instagramSpend: decimal("instagram_spend", { precision: 12, scale: 2 }),
  audienceNetworkSpend: decimal("audience_network_spend", { precision: 12, scale: 2 }),
  
  // Data quality
  isSynthetic: boolean("is_synthetic").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pipeline Email Metrics (Pardot) - 27 metrics
export const pipelineMetricsEmail = pgTable("pipeline_metrics_email", {
  id: serial("id").primaryKey(),
  metricDate: date("metric_date").notNull(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  
  // Subscriber metrics
  totalSubscribers: integer("total_subscribers").notNull(),
  newSubscribers: integer("new_subscribers").notNull(),
  unsubscribes: integer("unsubscribes").notNull(),
  unsubscribeRate: decimal("unsubscribe_rate", { precision: 6, scale: 4 }).notNull(),
  
  // Campaign volume
  campaignsSent: integer("campaigns_sent").notNull(),
  totalEmailsSent: integer("total_emails_sent").notNull(),
  delivered: integer("delivered").notNull(),
  bounced: integer("bounced").notNull(),
  bounceRate: decimal("bounce_rate", { precision: 6, scale: 4 }).notNull(),
  
  // Engagement metrics
  totalOpens: integer("total_opens").notNull(),
  openRate: decimal("open_rate", { precision: 6, scale: 4 }).notNull(),
  uniqueOpens: integer("unique_opens").notNull(),
  uniqueOpenRate: decimal("unique_open_rate", { precision: 6, scale: 4 }).notNull(),
  totalClicks: integer("total_clicks").notNull(),
  clickRate: decimal("click_rate", { precision: 6, scale: 4 }).notNull(),
  clickToOpenRate: decimal("click_to_open_rate", { precision: 8, scale: 4 }).notNull(),
  uniqueClicks: integer("unique_clicks").notNull(),
  uniqueClickRate: decimal("unique_click_rate", { precision: 6, scale: 4 }).notNull(),
  
  // Conversion metrics
  conversions: integer("conversions").notNull(),
  conversionRate: decimal("conversion_rate", { precision: 6, scale: 4 }).notNull(),
  emailGeneratedLeads: integer("email_generated_leads").notNull(),
  
  // Email type breakdown
  newsletterSent: integer("newsletter_sent").notNull(),
  promotionalSent: integer("promotional_sent").notNull(),
  nurtureSent: integer("nurture_sent").notNull(),
  transactionalSent: integer("transactional_sent").notNull(),
  
  // Data quality
  isSynthetic: boolean("is_synthetic").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pipeline CRM Metrics (Salesforce) - 33 metrics
export const pipelineMetricsCrm = pgTable("pipeline_metrics_crm", {
  id: serial("id").primaryKey(),
  metricDate: date("metric_date").notNull(),
  organizationId: varchar("organization_id", { length: 255 }).notNull(),
  
  // Lead metrics
  totalLeads: integer("total_leads").notNull(),
  mqlCount: integer("mql_count").notNull(),
  mqlConversionRate: decimal("mql_conversion_rate", { precision: 6, scale: 2 }).notNull(),
  sqlCount: integer("sql_count").notNull(),
  sqlConversionRate: decimal("sql_conversion_rate", { precision: 6, scale: 2 }).notNull(),
  
  // Opportunity metrics
  opportunitiesCreated: integer("opportunities_created").notNull(),
  opportunityConversionRate: decimal("opportunity_conversion_rate", { precision: 6, scale: 2 }).notNull(),
  pipelineValue: decimal("pipeline_value", { precision: 14, scale: 2 }).notNull(),
  openOpportunities: integer("open_opportunities").notNull(),
  
  // Deal outcomes
  closedWon: integer("closed_won").notNull(),
  closedLost: integer("closed_lost").notNull(),
  winRate: decimal("win_rate", { precision: 6, scale: 2 }).notNull(),
  lossRate: decimal("loss_rate", { precision: 6, scale: 2 }).notNull(),
  
  // Revenue metrics
  monthlyRevenue: decimal("monthly_revenue", { precision: 14, scale: 2 }).notNull(),
  cumulativeRevenueYtd: decimal("cumulative_revenue_ytd", { precision: 14, scale: 2 }).notNull(),
  avgDealSize: decimal("avg_deal_size", { precision: 12, scale: 2 }).notNull(),
  
  // Customer metrics
  newCustomers: integer("new_customers").notNull(),
  churnedCustomers: integer("churned_customers").notNull(),
  totalActiveCustomers: integer("total_active_customers").notNull(),
  churnRate: decimal("churn_rate", { precision: 6, scale: 4 }).notNull(),
  avgSalesCycleDays: integer("avg_sales_cycle_days").notNull(),
  
  // Lead source breakdown
  websiteLeads: integer("website_leads").notNull(),
  paidAdsLeads: integer("paid_ads_leads").notNull(),
  emailMarketingLeads: integer("email_marketing_leads").notNull(),
  referralLeads: integer("referral_leads").notNull(),
  tradeShowsLeads: integer("trade_shows_leads").notNull(),
  otherLeads: integer("other_leads").notNull(),
  
  // Product revenue breakdown
  smartdiagRevenue: decimal("smartdiag_revenue", { precision: 12, scale: 2 }).notNull(),
  liftmasterRevenue: decimal("liftmaster_revenue", { precision: 12, scale: 2 }).notNull(),
  toolhubRevenue: decimal("toolhub_revenue", { precision: 12, scale: 2 }).notNull(),
  calibrationKitsRevenue: decimal("calibration_kits_revenue", { precision: 12, scale: 2 }).notNull(),
  
  // Sales team metrics
  salesTeamSize: integer("sales_team_size").notNull(),
  revenuePerRep: decimal("revenue_per_rep", { precision: 12, scale: 2 }).notNull(),
  dealsPerRep: decimal("deals_per_rep", { precision: 6, scale: 2 }).notNull(),
  
  // Data quality
  isSynthetic: boolean("is_synthetic").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM metrics - contacts, deals, pipeline data
export const metricsCrm = pgTable("metrics_crm", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  platform: text("platform").notNull(), // hubspot, salesforce
  metricDate: timestamp("metric_date").notNull(),
  totalContacts: integer("total_contacts").default(0),
  newContacts: integer("new_contacts").default(0),
  totalDeals: integer("total_deals").default(0),
  dealsWon: integer("deals_won").default(0),
  dealsLost: integer("deals_lost").default(0),
  pipelineValue: decimal("pipeline_value", { precision: 14, scale: 2 }).default("0"),
  closedRevenue: decimal("closed_revenue", { precision: 14, scale: 2 }).default("0"),
  avgDealSize: decimal("avg_deal_size", { precision: 12, scale: 2 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  pipelineStages: jsonb("pipeline_stages"), // Deals per stage
  createdAt: timestamp("created_at").defaultNow(),
});

// Email metrics - campaign performance from Pardot, HubSpot, etc.
export const metricsEmail = pgTable("metrics_email", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  integrationId: varchar("integration_id").references(() => integrations.id).notNull(),
  platform: text("platform").notNull(), // salesforce_pardot, hubspot
  metricDate: timestamp("metric_date").notNull(),
  totalEmailsSent: integer("total_emails_sent").default(0),
  delivered: integer("delivered").default(0),
  bounced: integer("bounced").default(0),
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }).default("0"),
  opens: integer("opens").default(0),
  uniqueOpens: integer("unique_opens").default(0),
  openRate: decimal("open_rate", { precision: 5, scale: 2 }).default("0"),
  clicks: integer("clicks").default(0),
  uniqueClicks: integer("unique_clicks").default(0),
  clickRate: decimal("click_rate", { precision: 5, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0"),
  unsubscribes: integer("unsubscribes").default(0),
  subscribers: integer("subscribers").default(0),
  campaignsSent: integer("campaigns_sent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertInviteSchema = createInsertSchema(invites).omit({
  id: true,
  createdAt: true,
});

export const insertImpersonationLogSchema = createInsertSchema(impersonationLogs).omit({
  id: true,
  startedAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsSnapshotSchema = createInsertSchema(analyticsSnapshots).omit({
  id: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyncJobSchema = createInsertSchema(syncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertMetricsAdsSchema = createInsertSchema(metricsAds).omit({
  id: true,
  createdAt: true,
});

export const insertMetricsAnalyticsSchema = createInsertSchema(metricsAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertMetricsCrmSchema = createInsertSchema(metricsCrm).omit({
  id: true,
  createdAt: true,
});

export const insertMetricsEmailSchema = createInsertSchema(metricsEmail).omit({
  id: true,
  createdAt: true,
});

// Orchestration insert schemas
export const insertDagSchema = createInsertSchema(dags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDagTaskSchema = createInsertSchema(dagTasks).omit({
  id: true,
  createdAt: true,
});

export const insertDagRunSchema = createInsertSchema(dagRuns).omit({
  id: true,
  createdAt: true,
});

export const insertTaskInstanceSchema = createInsertSchema(taskInstances).omit({
  id: true,
  createdAt: true,
});

export const insertXcomDataSchema = createInsertSchema(xcomData).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisOutputSchema = createInsertSchema(analysisOutputs).omit({
  id: true,
  createdAt: true,
});

// Analysis execution & reporting insert schemas
export const insertAnalysisRunSchema = createInsertSchema(analysisRuns).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisTemplateSchema = createInsertSchema(analysisTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({
  id: true,
  createdAt: true,
});

export const insertRecommendedActionSchema = createInsertSchema(recommendedActions).omit({
  id: true,
  createdAt: true,
});

export const insertDataValidationLogSchema = createInsertSchema(dataValidationLog).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisAuditLogSchema = createInsertSchema(analysisAuditLog).omit({
  id: true,
  createdAt: true,
});

// Pipeline metrics insert schemas (Python pipeline tables)
export const insertPipelineMetricsWebsiteSchema = createInsertSchema(pipelineMetricsWebsite).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineMetricsAdsSchema = createInsertSchema(pipelineMetricsAds).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineMetricsEmailSchema = createInsertSchema(pipelineMetricsEmail).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineMetricsCrmSchema = createInsertSchema(pipelineMetricsCrm).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invites.$inferSelect;

export type InsertImpersonationLog = z.infer<typeof insertImpersonationLogSchema>;
export type ImpersonationLog = typeof impersonationLogs.$inferSelect;

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export type InsertAnalyticsSnapshot = z.infer<typeof insertAnalyticsSnapshotSchema>;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type Integration = typeof integrations.$inferSelect;

export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type SyncJob = typeof syncJobs.$inferSelect;

export type InsertMetricsAds = z.infer<typeof insertMetricsAdsSchema>;
export type MetricsAds = typeof metricsAds.$inferSelect;

export type InsertMetricsAnalytics = z.infer<typeof insertMetricsAnalyticsSchema>;
export type MetricsAnalytics = typeof metricsAnalytics.$inferSelect;

export type InsertMetricsCrm = z.infer<typeof insertMetricsCrmSchema>;
export type MetricsCrm = typeof metricsCrm.$inferSelect;

export type InsertMetricsEmail = z.infer<typeof insertMetricsEmailSchema>;
export type MetricsEmail = typeof metricsEmail.$inferSelect;

// Orchestration types
export type InsertDag = z.infer<typeof insertDagSchema>;
export type Dag = typeof dags.$inferSelect;

export type InsertDagTask = z.infer<typeof insertDagTaskSchema>;
export type DagTask = typeof dagTasks.$inferSelect;

export type InsertDagRun = z.infer<typeof insertDagRunSchema>;
export type DagRun = typeof dagRuns.$inferSelect;

export type InsertTaskInstance = z.infer<typeof insertTaskInstanceSchema>;
export type TaskInstance = typeof taskInstances.$inferSelect;

export type InsertXcomData = z.infer<typeof insertXcomDataSchema>;
export type XcomData = typeof xcomData.$inferSelect;

export type InsertAnalysisOutput = z.infer<typeof insertAnalysisOutputSchema>;
export type AnalysisOutput = typeof analysisOutputs.$inferSelect;

// Analysis execution & reporting types
export type InsertAnalysisRun = z.infer<typeof insertAnalysisRunSchema>;
export type AnalysisRun = typeof analysisRuns.$inferSelect;

export type InsertAnalysisTemplate = z.infer<typeof insertAnalysisTemplateSchema>;
export type AnalysisTemplate = typeof analysisTemplates.$inferSelect;

export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;

export type InsertRecommendedAction = z.infer<typeof insertRecommendedActionSchema>;
export type RecommendedAction = typeof recommendedActions.$inferSelect;

export type InsertDataValidationLog = z.infer<typeof insertDataValidationLogSchema>;
export type DataValidationLog = typeof dataValidationLog.$inferSelect;

export type InsertAnalysisAuditLog = z.infer<typeof insertAnalysisAuditLogSchema>;
export type AnalysisAuditLog = typeof analysisAuditLog.$inferSelect;

// Pipeline metrics types (Python pipeline tables)
export type InsertPipelineMetricsWebsite = z.infer<typeof insertPipelineMetricsWebsiteSchema>;
export type PipelineMetricsWebsite = typeof pipelineMetricsWebsite.$inferSelect;

export type InsertPipelineMetricsAds = z.infer<typeof insertPipelineMetricsAdsSchema>;
export type PipelineMetricsAds = typeof pipelineMetricsAds.$inferSelect;

export type InsertPipelineMetricsEmail = z.infer<typeof insertPipelineMetricsEmailSchema>;
export type PipelineMetricsEmail = typeof pipelineMetricsEmail.$inferSelect;

export type InsertPipelineMetricsCrm = z.infer<typeof insertPipelineMetricsCrmSchema>;
export type PipelineMetricsCrm = typeof pipelineMetricsCrm.$inferSelect;

// User-friendly engine display names
export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  "data_ingestion": "Data Import & Validation",
  "relationship_engine": "Understanding Your Data",
  "impact_engine": "Analyzing What Drives Outcomes",
  "forecast_engine": "Predicting Future Performance",
  "propensity_engine": "Identifying Target Customers",
  "production_serving": "Finalizing Recommendations",
};

// Engine descriptions for UI
export const ENGINE_DESCRIPTIONS: Record<string, string> = {
  "data_ingestion": "Validating and importing data from your connected sources",
  "relationship_engine": "Discovering patterns and correlations in your data",
  "impact_engine": "Understanding what factors drive your key outcomes",
  "forecast_engine": "Projecting future performance with confidence intervals",
  "propensity_engine": "Identifying high-value customer segments to target",
  "production_serving": "Generating actionable recommendations and reports",
};
