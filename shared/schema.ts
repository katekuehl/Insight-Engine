import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, decimal, jsonb } from "drizzle-orm/pg-core";
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
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionPlan: text("subscription_plan").default("free"),
  isActive: boolean("is_active").default(true),
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
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
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

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invites.$inferSelect;

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
