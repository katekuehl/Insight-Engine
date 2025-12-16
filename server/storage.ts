import { db } from "./db";
import { eq, and, desc, isNull } from "drizzle-orm";
import {
  users, organizations, invites, subscriptions, analyticsSnapshots,
  integrations, syncJobs, metricsAds, metricsAnalytics, metricsCrm,
  impersonationLogs,
  type User, type InsertUser,
  type Organization, type InsertOrganization,
  type Invite, type InsertInvite,
  type Subscription, type InsertSubscription,
  type AnalyticsSnapshot, type InsertAnalyticsSnapshot,
  type Integration, type InsertIntegration,
  type SyncJob, type InsertSyncJob,
  type MetricsAds, type InsertMetricsAds,
  type MetricsAnalytics, type InsertMetricsAnalytics,
  type MetricsCrm, type InsertMetricsCrm,
  type ImpersonationLog, type InsertImpersonationLog,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserBySupabaseId(supabaseUserId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  getOrganization(id: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<void>;
  getAllOrganizations(): Promise<Organization[]>;
  
  getOrganizationMembers(organizationId: string): Promise<User[]>;
  
  getInvite(token: string): Promise<Invite | undefined>;
  getInvitesByOrganization(organizationId: string): Promise<Invite[]>;
  createInvite(invite: InsertInvite): Promise<Invite>;
  deleteInvite(id: string): Promise<void>;
  
  getSubscription(organizationId: string): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  
  getAnalyticsSnapshots(organizationId: string, limit?: number): Promise<AnalyticsSnapshot[]>;
  createAnalyticsSnapshot(snapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot>;
  
  // Integration methods
  getIntegration(id: string): Promise<Integration | undefined>;
  getIntegrationsByOrganization(organizationId: string): Promise<Integration[]>;
  getIntegrationByPlatform(organizationId: string, platform: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined>;
  deleteIntegration(id: string): Promise<void>;
  
  // Sync job methods
  getSyncJob(id: string): Promise<SyncJob | undefined>;
  getSyncJobsByIntegration(integrationId: string, limit?: number): Promise<SyncJob[]>;
  createSyncJob(job: InsertSyncJob): Promise<SyncJob>;
  updateSyncJob(id: string, data: Partial<InsertSyncJob>): Promise<SyncJob | undefined>;
  
  // Metrics methods
  getMetricsAds(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsAds[]>;
  createMetricsAds(metrics: InsertMetricsAds): Promise<MetricsAds>;
  
  getMetricsAnalytics(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsAnalytics[]>;
  createMetricsAnalytics(metrics: InsertMetricsAnalytics): Promise<MetricsAnalytics>;
  
  getMetricsCrm(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsCrm[]>;
  createMetricsCrm(metrics: InsertMetricsCrm): Promise<MetricsCrm>;
  
  // Impersonation log methods
  createImpersonationLog(log: InsertImpersonationLog): Promise<ImpersonationLog>;
  endImpersonationLog(id: string): Promise<ImpersonationLog | undefined>;
  getActiveImpersonation(superAdminId: string): Promise<ImpersonationLog | undefined>;
  getImpersonationLogs(superAdminId?: string): Promise<ImpersonationLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserBySupabaseId(supabaseUserId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.supabaseUserId, supabaseUserId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(insertOrg).returning();
    return org;
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [org] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return org;
  }

  async deleteOrganization(id: string): Promise<void> {
    await db.delete(users).where(eq(users.organizationId, id));
    await db.delete(invites).where(eq(invites.organizationId, id));
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, id));
    await db.delete(analyticsSnapshots).where(eq(analyticsSnapshots.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations);
  }

  async getOrganizationMembers(organizationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organizationId, organizationId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getInvite(token: string): Promise<Invite | undefined> {
    const [invite] = await db.select().from(invites).where(eq(invites.token, token));
    return invite;
  }

  async getInvitesByOrganization(organizationId: string): Promise<Invite[]> {
    return db.select().from(invites).where(eq(invites.organizationId, organizationId));
  }

  async createInvite(insertInvite: InsertInvite): Promise<Invite> {
    const [invite] = await db.insert(invites).values(insertInvite).returning();
    return invite;
  }

  async deleteInvite(id: string): Promise<void> {
    await db.delete(invites).where(eq(invites.id, id));
  }

  async getSubscription(organizationId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId));
    return sub;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return sub;
  }

  async createSubscription(insertSub: InsertSubscription): Promise<Subscription> {
    const [sub] = await db.insert(subscriptions).values(insertSub).returning();
    return sub;
  }

  async updateSubscription(id: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [sub] = await db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning();
    return sub;
  }

  async getAnalyticsSnapshots(organizationId: string, limit = 30): Promise<AnalyticsSnapshot[]> {
    return db.select().from(analyticsSnapshots)
      .where(eq(analyticsSnapshots.organizationId, organizationId))
      .limit(limit);
  }

  async createAnalyticsSnapshot(insertSnapshot: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
    const [snapshot] = await db.insert(analyticsSnapshots).values(insertSnapshot).returning();
    return snapshot;
  }

  // Integration methods
  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration;
  }

  async getIntegrationsByOrganization(organizationId: string): Promise<Integration[]> {
    return db.select().from(integrations)
      .where(eq(integrations.organizationId, organizationId))
      .orderBy(desc(integrations.createdAt));
  }

  async getIntegrationByPlatform(organizationId: string, platform: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations)
      .where(and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.platform, platform)
      ));
    return integration;
  }

  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    const [integration] = await db.insert(integrations).values(insertIntegration).returning();
    return integration;
  }

  async updateIntegration(id: string, data: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [integration] = await db.update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return integration;
  }

  async deleteIntegration(id: string): Promise<void> {
    // Delete related sync jobs and metrics first
    await db.delete(syncJobs).where(eq(syncJobs.integrationId, id));
    await db.delete(metricsAds).where(eq(metricsAds.integrationId, id));
    await db.delete(metricsAnalytics).where(eq(metricsAnalytics.integrationId, id));
    await db.delete(metricsCrm).where(eq(metricsCrm.integrationId, id));
    await db.delete(integrations).where(eq(integrations.id, id));
  }

  // Sync job methods
  async getSyncJob(id: string): Promise<SyncJob | undefined> {
    const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, id));
    return job;
  }

  async getSyncJobsByIntegration(integrationId: string, limit = 10): Promise<SyncJob[]> {
    return db.select().from(syncJobs)
      .where(eq(syncJobs.integrationId, integrationId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(limit);
  }

  async createSyncJob(insertJob: InsertSyncJob): Promise<SyncJob> {
    const [job] = await db.insert(syncJobs).values(insertJob).returning();
    return job;
  }

  async updateSyncJob(id: string, data: Partial<InsertSyncJob>): Promise<SyncJob | undefined> {
    const [job] = await db.update(syncJobs).set(data).where(eq(syncJobs.id, id)).returning();
    return job;
  }

  // Metrics methods
  async getMetricsAds(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsAds[]> {
    return db.select().from(metricsAds)
      .where(eq(metricsAds.organizationId, organizationId))
      .orderBy(desc(metricsAds.metricDate));
  }

  async createMetricsAds(insertMetrics: InsertMetricsAds): Promise<MetricsAds> {
    const [metrics] = await db.insert(metricsAds).values(insertMetrics).returning();
    return metrics;
  }

  async getMetricsAnalytics(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsAnalytics[]> {
    return db.select().from(metricsAnalytics)
      .where(eq(metricsAnalytics.organizationId, organizationId))
      .orderBy(desc(metricsAnalytics.metricDate));
  }

  async createMetricsAnalytics(insertMetrics: InsertMetricsAnalytics): Promise<MetricsAnalytics> {
    const [metrics] = await db.insert(metricsAnalytics).values(insertMetrics).returning();
    return metrics;
  }

  async getMetricsCrm(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsCrm[]> {
    return db.select().from(metricsCrm)
      .where(eq(metricsCrm.organizationId, organizationId))
      .orderBy(desc(metricsCrm.metricDate));
  }

  async createMetricsCrm(insertMetrics: InsertMetricsCrm): Promise<MetricsCrm> {
    const [metrics] = await db.insert(metricsCrm).values(insertMetrics).returning();
    return metrics;
  }

  // Impersonation log methods
  async createImpersonationLog(insertLog: InsertImpersonationLog): Promise<ImpersonationLog> {
    const [log] = await db.insert(impersonationLogs).values(insertLog).returning();
    return log;
  }

  async endImpersonationLog(id: string): Promise<ImpersonationLog | undefined> {
    const [log] = await db.update(impersonationLogs)
      .set({ endedAt: new Date() })
      .where(eq(impersonationLogs.id, id))
      .returning();
    return log;
  }

  async getActiveImpersonation(superAdminId: string): Promise<ImpersonationLog | undefined> {
    const [log] = await db.select().from(impersonationLogs)
      .where(and(
        eq(impersonationLogs.superAdminId, superAdminId),
        isNull(impersonationLogs.endedAt)
      ));
    return log;
  }

  async getImpersonationLogs(superAdminId?: string): Promise<ImpersonationLog[]> {
    if (superAdminId) {
      return db.select().from(impersonationLogs)
        .where(eq(impersonationLogs.superAdminId, superAdminId))
        .orderBy(desc(impersonationLogs.startedAt));
    }
    return db.select().from(impersonationLogs)
      .orderBy(desc(impersonationLogs.startedAt));
  }
}

export const storage = new DatabaseStorage();
