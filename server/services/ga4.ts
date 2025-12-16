import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { Integration } from "@shared/schema";

type GA4Metrics = {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  newUsers: number;
};

type GA4DailyData = {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
};

export type GA4Report = {
  summary: GA4Metrics;
  daily: GA4DailyData[];
  topPages: { page: string; views: number; users: number }[];
  topSources: { source: string; sessions: number; users: number }[];
};

export async function fetchGA4Data(
  integration: Integration,
  startDate: string,
  endDate: string
): Promise<GA4Report> {
  const metadata = integration.metadata as Record<string, string> | null;
  
  if (!metadata?.propertyId) {
    throw new Error("Missing GA4 Property ID. Please update your integration settings.");
  }
  
  if (!metadata?.serviceAccountJson) {
    throw new Error("Missing service account JSON. Please upload your Google Cloud service account credentials.");
  }

  let credentials;
  try {
    credentials = JSON.parse(metadata.serviceAccountJson);
  } catch (e) {
    throw new Error("Invalid service account JSON format. Please check that you've pasted the complete JSON file contents.");
  }

  // Validate required credential fields
  if (!credentials.client_email) {
    throw new Error("Service account JSON is missing 'client_email' field. Please use a valid service account key file.");
  }
  if (!credentials.private_key) {
    throw new Error("Service account JSON is missing 'private_key' field. Please use a valid service account key file.");
  }
  if (!credentials.project_id) {
    throw new Error("Service account JSON is missing 'project_id' field. Please use a valid service account key file.");
  }

  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });

  const propertyId = metadata.propertyId;

  // Fetch summary metrics
  const [summaryResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
      { name: "bounceRate" },
      { name: "averageSessionDuration" },
      { name: "newUsers" },
    ],
  });

  const summaryRow = summaryResponse.rows?.[0];
  const summary: GA4Metrics = {
    sessions: parseInt(summaryRow?.metricValues?.[0]?.value || "0"),
    users: parseInt(summaryRow?.metricValues?.[1]?.value || "0"),
    pageviews: parseInt(summaryRow?.metricValues?.[2]?.value || "0"),
    bounceRate: parseFloat(summaryRow?.metricValues?.[3]?.value || "0") * 100,
    avgSessionDuration: parseFloat(summaryRow?.metricValues?.[4]?.value || "0"),
    newUsers: parseInt(summaryRow?.metricValues?.[5]?.value || "0"),
  };

  // Fetch daily data
  const [dailyResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "screenPageViews" },
    ],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  const daily: GA4DailyData[] = (dailyResponse.rows || []).map((row) => ({
    date: row.dimensionValues?.[0]?.value || "",
    sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
    pageviews: parseInt(row.metricValues?.[2]?.value || "0"),
  }));

  // Fetch top pages
  const [pagesResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [
      { name: "screenPageViews" },
      { name: "totalUsers" },
    ],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 10,
  });

  const topPages = (pagesResponse.rows || []).map((row) => ({
    page: row.dimensionValues?.[0]?.value || "",
    views: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
  }));

  // Fetch top traffic sources
  const [sourcesResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "sessionSource" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  const topSources = (sourcesResponse.rows || []).map((row) => ({
    source: row.dimensionValues?.[0]?.value || "(direct)",
    sessions: parseInt(row.metricValues?.[0]?.value || "0"),
    users: parseInt(row.metricValues?.[1]?.value || "0"),
  }));

  return {
    summary,
    daily,
    topPages,
    topSources,
  };
}

export function generateSimulatedGA4Data(days: number): GA4Report {
  const daily: GA4DailyData[] = [];
  const now = new Date();
  
  let totalSessions = 0;
  let totalUsers = 0;
  let totalPageviews = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const sessions = Math.floor(Math.random() * 500) + 200;
    const users = Math.floor(sessions * (0.7 + Math.random() * 0.2));
    const pageviews = Math.floor(sessions * (2 + Math.random() * 2));
    
    totalSessions += sessions;
    totalUsers += users;
    totalPageviews += pageviews;
    
    daily.push({
      date: date.toISOString().split("T")[0].replace(/-/g, ""),
      sessions,
      users,
      pageviews,
    });
  }

  return {
    summary: {
      sessions: totalSessions,
      users: totalUsers,
      pageviews: totalPageviews,
      bounceRate: 35 + Math.random() * 25,
      avgSessionDuration: 120 + Math.random() * 180,
      newUsers: Math.floor(totalUsers * 0.4),
    },
    daily,
    topPages: [
      { page: "/", views: Math.floor(totalPageviews * 0.3), users: Math.floor(totalUsers * 0.8) },
      { page: "/products", views: Math.floor(totalPageviews * 0.2), users: Math.floor(totalUsers * 0.5) },
      { page: "/about", views: Math.floor(totalPageviews * 0.15), users: Math.floor(totalUsers * 0.3) },
      { page: "/contact", views: Math.floor(totalPageviews * 0.1), users: Math.floor(totalUsers * 0.2) },
      { page: "/blog", views: Math.floor(totalPageviews * 0.08), users: Math.floor(totalUsers * 0.15) },
    ],
    topSources: [
      { source: "google", sessions: Math.floor(totalSessions * 0.4), users: Math.floor(totalUsers * 0.35) },
      { source: "(direct)", sessions: Math.floor(totalSessions * 0.25), users: Math.floor(totalUsers * 0.25) },
      { source: "facebook", sessions: Math.floor(totalSessions * 0.15), users: Math.floor(totalUsers * 0.15) },
      { source: "linkedin", sessions: Math.floor(totalSessions * 0.1), users: Math.floor(totalUsers * 0.12) },
      { source: "twitter", sessions: Math.floor(totalSessions * 0.05), users: Math.floor(totalUsers * 0.08) },
    ],
  };
}
