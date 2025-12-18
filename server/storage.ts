import { db } from "./db";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import {
  users, organizations, invites, subscriptions, analyticsSnapshots,
  integrations, syncJobs, metricsAds, metricsAnalytics, metricsCrm, metricsEmail,
  impersonationLogs,
  dags, dagTasks, dagRuns, taskInstances, xcomData, analysisOutputs,
  analysisRuns, analysisReports, recommendedActions,
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
  type MetricsEmail, type InsertMetricsEmail,
  type ImpersonationLog, type InsertImpersonationLog,
  type Dag, type InsertDag,
  type DagTask, type InsertDagTask,
  type DagRun, type InsertDagRun,
  type TaskInstance, type InsertTaskInstance,
  type XcomData, type InsertXcomData,
  type AnalysisOutput, type InsertAnalysisOutput,
  type AnalysisRun, type InsertAnalysisRun,
  type AnalysisReport, type InsertAnalysisReport,
  type RecommendedAction, type InsertRecommendedAction,
} from "@shared/schema";
import { sql, count } from "drizzle-orm";

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
  deleteMetricsAdsByIntegration(integrationId: string): Promise<void>;
  
  getMetricsAnalytics(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsAnalytics[]>;
  createMetricsAnalytics(metrics: InsertMetricsAnalytics): Promise<MetricsAnalytics>;
  deleteMetricsAnalyticsByIntegration(integrationId: string): Promise<void>;
  
  getMetricsCrm(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsCrm[]>;
  createMetricsCrm(metrics: InsertMetricsCrm): Promise<MetricsCrm>;
  deleteMetricsCrmByIntegration(integrationId: string): Promise<void>;
  
  getMetricsEmail(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsEmail[]>;
  createMetricsEmail(metrics: InsertMetricsEmail): Promise<MetricsEmail>;
  
  // Impersonation log methods
  createImpersonationLog(log: InsertImpersonationLog): Promise<ImpersonationLog>;
  endImpersonationLog(id: string): Promise<ImpersonationLog | undefined>;
  getActiveImpersonation(superAdminId: string): Promise<ImpersonationLog | undefined>;
  getImpersonationLogs(superAdminId?: string): Promise<ImpersonationLog[]>;
  
  // DAG methods
  getDag(id: string): Promise<Dag | undefined>;
  getDagByDagId(dagId: string): Promise<Dag | undefined>;
  getAllDags(): Promise<Dag[]>;
  createDag(dag: InsertDag): Promise<Dag>;
  updateDag(id: string, data: Partial<InsertDag>): Promise<Dag | undefined>;
  
  // DAG Task methods
  getDagTask(id: string): Promise<DagTask | undefined>;
  getDagTasksByDagId(dagId: string): Promise<DagTask[]>;
  createDagTask(task: InsertDagTask): Promise<DagTask>;
  createDagTasks(tasks: InsertDagTask[]): Promise<DagTask[]>;
  
  // DAG Run methods
  getDagRun(id: string): Promise<DagRun | undefined>;
  getDagRunsByOrganization(organizationId: string, limit?: number): Promise<DagRun[]>;
  getDagRunsByDag(dagId: string, organizationId: string, limit?: number): Promise<DagRun[]>;
  createDagRun(run: InsertDagRun): Promise<DagRun>;
  updateDagRun(id: string, data: Partial<InsertDagRun>): Promise<DagRun | undefined>;
  
  // Task Instance methods
  getTaskInstance(id: string): Promise<TaskInstance | undefined>;
  getTaskInstancesByDagRun(dagRunId: string): Promise<TaskInstance[]>;
  getTaskInstancesByStatus(dagRunId: string, status: string): Promise<TaskInstance[]>;
  createTaskInstance(instance: InsertTaskInstance): Promise<TaskInstance>;
  createTaskInstances(instances: InsertTaskInstance[]): Promise<TaskInstance[]>;
  updateTaskInstance(id: string, data: Partial<InsertTaskInstance>): Promise<TaskInstance | undefined>;
  
  // XCom methods
  getXcomData(dagRunId: string, key?: string): Promise<XcomData[]>;
  getXcomDataByTaskInstance(taskInstanceId: string): Promise<XcomData[]>;
  createXcomData(data: InsertXcomData): Promise<XcomData>;
  
  // Analysis Output methods
  getAnalysisOutput(id: string): Promise<AnalysisOutput | undefined>;
  getAnalysisOutputsByOrganization(organizationId: string, limit?: number): Promise<AnalysisOutput[]>;
  getAnalysisOutputByDagRun(dagRunId: string): Promise<AnalysisOutput | undefined>;
  createAnalysisOutput(output: InsertAnalysisOutput): Promise<AnalysisOutput>;
  
  // Analysis Run methods
  getAnalysisRun(id: string): Promise<AnalysisRun | undefined>;
  getAnalysisRunsByOrganization(organizationId: string, limit?: number): Promise<AnalysisRun[]>;
  createAnalysisRun(run: InsertAnalysisRun): Promise<AnalysisRun>;
  updateAnalysisRun(id: string, data: Partial<InsertAnalysisRun>): Promise<AnalysisRun | undefined>;
  
  // Analysis Report methods
  getAnalysisReport(id: string): Promise<AnalysisReport | undefined>;
  getAnalysisReportsByOrganization(organizationId: string, limit?: number): Promise<AnalysisReport[]>;
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  
  // Recommended Action methods
  getRecommendedAction(id: string): Promise<RecommendedAction | undefined>;
  getRecommendedActionsByOrganization(organizationId: string, implemented?: boolean): Promise<RecommendedAction[]>;
  createRecommendedAction(action: InsertRecommendedAction): Promise<RecommendedAction>;
  updateRecommendedAction(id: string, data: Partial<InsertRecommendedAction>): Promise<RecommendedAction | undefined>;
  
  // Sync jobs by org
  getSyncJobsByOrganization(organizationId: string, limit?: number): Promise<SyncJob[]>;
  
  // Data verification methods
  getMetricsAnalyticsCount(organizationId: string): Promise<number>;
  getMetricsAdsCount(organizationId: string): Promise<number>;
  getMetricsCrmCount(organizationId: string): Promise<number>;
  getMetricsEmailCount(organizationId: string): Promise<number>;
  getMetricsAnalyticsSample(organizationId: string, limit: number): Promise<MetricsAnalytics[]>;
  getMetricsAdsSample(organizationId: string, limit: number): Promise<MetricsAds[]>;
  getMetricsCrmSample(organizationId: string, limit: number): Promise<MetricsCrm[]>;
  getMetricsEmailSample(organizationId: string, limit: number): Promise<MetricsEmail[]>;
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

  async deleteMetricsAdsByIntegration(integrationId: string): Promise<void> {
    await db.delete(metricsAds).where(eq(metricsAds.integrationId, integrationId));
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

  async deleteMetricsAnalyticsByIntegration(integrationId: string): Promise<void> {
    await db.delete(metricsAnalytics).where(eq(metricsAnalytics.integrationId, integrationId));
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

  async deleteMetricsCrmByIntegration(integrationId: string): Promise<void> {
    await db.delete(metricsCrm).where(eq(metricsCrm.integrationId, integrationId));
  }

  async getMetricsEmail(organizationId: string, startDate?: Date, endDate?: Date): Promise<MetricsEmail[]> {
    return db.select().from(metricsEmail)
      .where(eq(metricsEmail.organizationId, organizationId))
      .orderBy(desc(metricsEmail.metricDate));
  }

  async createMetricsEmail(insertMetrics: InsertMetricsEmail): Promise<MetricsEmail> {
    const [metrics] = await db.insert(metricsEmail).values(insertMetrics).returning();
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

  // DAG methods
  async getDag(id: string): Promise<Dag | undefined> {
    const [dag] = await db.select().from(dags).where(eq(dags.id, id));
    return dag;
  }

  async getDagByDagId(dagId: string): Promise<Dag | undefined> {
    const [dag] = await db.select().from(dags).where(eq(dags.dagId, dagId));
    return dag;
  }

  async getAllDags(): Promise<Dag[]> {
    return db.select().from(dags).orderBy(dags.dagId);
  }

  async createDag(insertDag: InsertDag): Promise<Dag> {
    const [dag] = await db.insert(dags).values(insertDag).returning();
    return dag;
  }

  async updateDag(id: string, data: Partial<InsertDag>): Promise<Dag | undefined> {
    const [dag] = await db.update(dags).set({ ...data, updatedAt: new Date() }).where(eq(dags.id, id)).returning();
    return dag;
  }

  // DAG Task methods
  async getDagTask(id: string): Promise<DagTask | undefined> {
    const [task] = await db.select().from(dagTasks).where(eq(dagTasks.id, id));
    return task;
  }

  async getDagTasksByDagId(dagId: string): Promise<DagTask[]> {
    return db.select().from(dagTasks).where(eq(dagTasks.dagId, dagId));
  }

  async createDagTask(insertTask: InsertDagTask): Promise<DagTask> {
    const [task] = await db.insert(dagTasks).values(insertTask).returning();
    return task;
  }

  async createDagTasks(insertTasks: InsertDagTask[]): Promise<DagTask[]> {
    if (insertTasks.length === 0) return [];
    return db.insert(dagTasks).values(insertTasks).returning();
  }

  // DAG Run methods
  async getDagRun(id: string): Promise<DagRun | undefined> {
    const [run] = await db.select().from(dagRuns).where(eq(dagRuns.id, id));
    return run;
  }

  async getDagRunsByOrganization(organizationId: string, limit = 50): Promise<DagRun[]> {
    return db.select().from(dagRuns)
      .where(eq(dagRuns.organizationId, organizationId))
      .orderBy(desc(dagRuns.createdAt))
      .limit(limit);
  }

  async getDagRunsByDag(dagId: string, organizationId: string, limit = 50): Promise<DagRun[]> {
    return db.select().from(dagRuns)
      .where(and(eq(dagRuns.dagId, dagId), eq(dagRuns.organizationId, organizationId)))
      .orderBy(desc(dagRuns.createdAt))
      .limit(limit);
  }

  async createDagRun(insertRun: InsertDagRun): Promise<DagRun> {
    const [run] = await db.insert(dagRuns).values(insertRun).returning();
    return run;
  }

  async updateDagRun(id: string, data: Partial<InsertDagRun>): Promise<DagRun | undefined> {
    const [run] = await db.update(dagRuns).set(data).where(eq(dagRuns.id, id)).returning();
    return run;
  }

  // Task Instance methods
  async getTaskInstance(id: string): Promise<TaskInstance | undefined> {
    const [instance] = await db.select().from(taskInstances).where(eq(taskInstances.id, id));
    return instance;
  }

  async getTaskInstancesByDagRun(dagRunId: string): Promise<TaskInstance[]> {
    return db.select().from(taskInstances).where(eq(taskInstances.dagRunId, dagRunId));
  }

  async getTaskInstancesByStatus(dagRunId: string, status: string): Promise<TaskInstance[]> {
    return db.select().from(taskInstances)
      .where(and(eq(taskInstances.dagRunId, dagRunId), eq(taskInstances.status, status)));
  }

  async createTaskInstance(insertInstance: InsertTaskInstance): Promise<TaskInstance> {
    const [instance] = await db.insert(taskInstances).values(insertInstance).returning();
    return instance;
  }

  async createTaskInstances(insertInstances: InsertTaskInstance[]): Promise<TaskInstance[]> {
    if (insertInstances.length === 0) return [];
    return db.insert(taskInstances).values(insertInstances).returning();
  }

  async updateTaskInstance(id: string, data: Partial<InsertTaskInstance>): Promise<TaskInstance | undefined> {
    const [instance] = await db.update(taskInstances).set(data).where(eq(taskInstances.id, id)).returning();
    return instance;
  }

  // XCom methods
  async getXcomData(dagRunId: string, key?: string): Promise<XcomData[]> {
    if (key) {
      return db.select().from(xcomData)
        .where(and(eq(xcomData.dagRunId, dagRunId), eq(xcomData.key, key)));
    }
    return db.select().from(xcomData).where(eq(xcomData.dagRunId, dagRunId));
  }

  async getXcomDataByTaskInstance(taskInstanceId: string): Promise<XcomData[]> {
    return db.select().from(xcomData).where(eq(xcomData.taskInstanceId, taskInstanceId));
  }

  async createXcomData(insertData: InsertXcomData): Promise<XcomData> {
    const [data] = await db.insert(xcomData).values(insertData).returning();
    return data;
  }

  // Analysis Output methods
  async getAnalysisOutput(id: string): Promise<AnalysisOutput | undefined> {
    const [output] = await db.select().from(analysisOutputs).where(eq(analysisOutputs.id, id));
    return output;
  }

  async getAnalysisOutputsByOrganization(organizationId: string, limit = 50): Promise<AnalysisOutput[]> {
    return db.select().from(analysisOutputs)
      .where(eq(analysisOutputs.organizationId, organizationId))
      .orderBy(desc(analysisOutputs.createdAt))
      .limit(limit);
  }

  async getAnalysisOutputByDagRun(dagRunId: string): Promise<AnalysisOutput | undefined> {
    const [output] = await db.select().from(analysisOutputs).where(eq(analysisOutputs.dagRunId, dagRunId));
    return output;
  }

  async createAnalysisOutput(insertOutput: InsertAnalysisOutput): Promise<AnalysisOutput> {
    const [output] = await db.insert(analysisOutputs).values(insertOutput).returning();
    return output;
  }

  // Analysis Run methods
  async getAnalysisRun(id: string): Promise<AnalysisRun | undefined> {
    const [run] = await db.select().from(analysisRuns).where(eq(analysisRuns.id, id));
    return run;
  }

  async getAnalysisRunsByOrganization(organizationId: string, limit = 50): Promise<AnalysisRun[]> {
    return db.select().from(analysisRuns)
      .where(eq(analysisRuns.organizationId, organizationId))
      .orderBy(desc(analysisRuns.createdAt))
      .limit(limit);
  }

  async createAnalysisRun(insertRun: InsertAnalysisRun): Promise<AnalysisRun> {
    const [run] = await db.insert(analysisRuns).values(insertRun).returning();
    return run;
  }

  async updateAnalysisRun(id: string, data: Partial<InsertAnalysisRun>): Promise<AnalysisRun | undefined> {
    const [run] = await db.update(analysisRuns).set(data).where(eq(analysisRuns.id, id)).returning();
    return run;
  }

  // Analysis Report methods
  async getAnalysisReport(id: string): Promise<AnalysisReport | undefined> {
    const [report] = await db.select().from(analysisReports).where(eq(analysisReports.id, id));
    return report;
  }

  async getAnalysisReportsByOrganization(organizationId: string, limit = 50): Promise<AnalysisReport[]> {
    return db.select().from(analysisReports)
      .where(eq(analysisReports.organizationId, organizationId))
      .orderBy(desc(analysisReports.createdAt))
      .limit(limit);
  }

  async createAnalysisReport(insertReport: InsertAnalysisReport): Promise<AnalysisReport> {
    const [report] = await db.insert(analysisReports).values(insertReport).returning();
    return report;
  }

  // Recommended Action methods
  async getRecommendedAction(id: string): Promise<RecommendedAction | undefined> {
    const [action] = await db.select().from(recommendedActions).where(eq(recommendedActions.id, id));
    return action;
  }

  async getRecommendedActionsByOrganization(organizationId: string, implemented?: boolean): Promise<RecommendedAction[]> {
    if (implemented !== undefined) {
      return db.select().from(recommendedActions)
        .where(and(
          eq(recommendedActions.organizationId, organizationId),
          eq(recommendedActions.implemented, implemented)
        ))
        .orderBy(desc(recommendedActions.createdAt));
    }
    return db.select().from(recommendedActions)
      .where(eq(recommendedActions.organizationId, organizationId))
      .orderBy(desc(recommendedActions.createdAt));
  }

  async createRecommendedAction(insertAction: InsertRecommendedAction): Promise<RecommendedAction> {
    const [action] = await db.insert(recommendedActions).values(insertAction).returning();
    return action;
  }

  async updateRecommendedAction(id: string, data: Partial<InsertRecommendedAction>): Promise<RecommendedAction | undefined> {
    const [action] = await db.update(recommendedActions).set(data).where(eq(recommendedActions.id, id)).returning();
    return action;
  }

  // Sync jobs by organization
  async getSyncJobsByOrganization(organizationId: string, limit = 50): Promise<SyncJob[]> {
    return db.select().from(syncJobs)
      .where(eq(syncJobs.organizationId, organizationId))
      .orderBy(desc(syncJobs.createdAt))
      .limit(limit);
  }

  // Data verification methods
  async getMetricsAnalyticsCount(organizationId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(metricsAnalytics)
      .where(eq(metricsAnalytics.organizationId, organizationId));
    return result?.count ?? 0;
  }

  async getMetricsAdsCount(organizationId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(metricsAds)
      .where(eq(metricsAds.organizationId, organizationId));
    return result?.count ?? 0;
  }

  async getMetricsCrmCount(organizationId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(metricsCrm)
      .where(eq(metricsCrm.organizationId, organizationId));
    return result?.count ?? 0;
  }

  async getMetricsEmailCount(organizationId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(metricsEmail)
      .where(eq(metricsEmail.organizationId, organizationId));
    return result?.count ?? 0;
  }

  async getMetricsAnalyticsSample(organizationId: string, limit: number): Promise<MetricsAnalytics[]> {
    return db.select().from(metricsAnalytics)
      .where(eq(metricsAnalytics.organizationId, organizationId))
      .orderBy(desc(metricsAnalytics.metricDate))
      .limit(limit);
  }

  async getMetricsAdsSample(organizationId: string, limit: number): Promise<MetricsAds[]> {
    return db.select().from(metricsAds)
      .where(eq(metricsAds.organizationId, organizationId))
      .orderBy(desc(metricsAds.metricDate))
      .limit(limit);
  }

  async getMetricsCrmSample(organizationId: string, limit: number): Promise<MetricsCrm[]> {
    return db.select().from(metricsCrm)
      .where(eq(metricsCrm.organizationId, organizationId))
      .orderBy(desc(metricsCrm.metricDate))
      .limit(limit);
  }

  async getMetricsEmailSample(organizationId: string, limit: number): Promise<MetricsEmail[]> {
    return db.select().from(metricsEmail)
      .where(eq(metricsEmail.organizationId, organizationId))
      .orderBy(desc(metricsEmail.metricDate))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
