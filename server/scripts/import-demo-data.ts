import { db } from "../db";
import { metricsAnalytics, metricsAds, metricsCrm, metricsEmail } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

const ORG_ID = "b9ef019e-65c7-40d9-8dd5-9d3e0889705f";
const INTEGRATION_IDS = {
  ga4: "02ba78f8-ba67-4c47-977e-9b5131485b06",
  googleAds: "f5f9fe8b-be15-4c25-a268-61b2390d71f7",
  metaAds: "a9722b50-8be3-462e-8ab6-c0765d4e2848",
  salesforce: "8ed78b7b-08bf-4f64-98ca-4ce57ffb5ca7",
};

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header.trim()] = values[idx]?.trim() || "";
    });
    rows.push(row);
  }
  return rows;
}

function monthYearToDate(month: string, year: string): Date {
  const monthNames: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };
  return new Date(parseInt(year), monthNames[month] || 0, 1);
}

async function importGA4Data() {
  console.log("Importing GA4 data...");
  const csvPath = path.join(process.cwd(), "attached_assets", "GA4_1766013665538.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  for (const row of rows) {
    const metricDate = monthYearToDate(row.Month, row.Year);
    
    await db.insert(metricsAnalytics).values({
      organizationId: ORG_ID,
      integrationId: INTEGRATION_IDS.ga4,
      metricDate,
      users: parseInt(row.Users) || 0,
      newUsers: parseInt(row.New_Users) || 0,
      sessions: parseInt(row.Sessions) || 0,
      pageViews: parseInt(row.Pageviews) || 0,
      bounceRate: row.Bounce_Rate_Percent || "0",
      avgSessionDuration: parseInt(row.Avg_Session_Duration_Seconds) || 0,
      conversions: parseInt(row.Goal_Completions) || 0,
      conversionRate: row.Goal_Conversion_Rate_Percent || "0",
      trafficSources: {
        organic: parseInt(row.Organic_Search_Sessions) || 0,
        direct: parseInt(row.Direct_Sessions) || 0,
        paid: parseInt(row.Paid_Search_Sessions) || 0,
        social: parseInt(row.Social_Sessions) || 0,
        referral: parseInt(row.Referral_Sessions) || 0,
        email: parseInt(row.Email_Sessions) || 0,
      },
      topPages: {
        homepage: parseInt(row.Homepage_Sessions) || 0,
        productPages: parseInt(row.Product_Pages_Sessions) || 0,
        solutionPages: parseInt(row.Solutions_Pages_Sessions) || 0,
      },
    });
  }
  console.log(`Imported ${rows.length} GA4 records`);
}

async function importAdsData() {
  console.log("Importing Ads data (Google + Meta)...");
  const csvPath = path.join(process.cwd(), "attached_assets", "Google_Ads_and_Meta_Ads_Performance_1766013665538.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  for (const row of rows) {
    const metricDate = monthYearToDate(row.Month, row.Year);
    
    await db.insert(metricsAds).values({
      organizationId: ORG_ID,
      integrationId: INTEGRATION_IDS.googleAds,
      platform: "google_ads",
      metricDate,
      campaignName: "All Campaigns",
      impressions: parseInt(row.Google_Ads_Impressions) || 0,
      clicks: parseInt(row.Google_Ads_Clicks) || 0,
      spend: row.Google_Ads_Spend || "0",
      conversions: parseInt(row.Google_Ads_Conversions) || 0,
      ctr: row.Google_Ads_CTR_Percent || "0",
      cpc: row.Google_Ads_CPC || "0",
      roas: row.Google_Ads_ROAS || "0",
    });

    await db.insert(metricsAds).values({
      organizationId: ORG_ID,
      integrationId: INTEGRATION_IDS.metaAds,
      platform: "facebook_ads",
      metricDate,
      campaignName: "All Campaigns",
      impressions: parseInt(row.Facebook_Ads_Impressions) || 0,
      clicks: parseInt(row.Facebook_Ads_Clicks) || 0,
      spend: row.Facebook_Ads_Spend || "0",
      conversions: parseInt(row.Facebook_Ads_Conversions) || 0,
      ctr: row.Facebook_Ads_CTR_Percent || "0",
      cpc: row.Facebook_Ads_CPC || "0",
      roas: row.Facebook_Ads_ROAS || "0",
    });
  }
  console.log(`Imported ${rows.length * 2} ads records (${rows.length} Google + ${rows.length} Meta)`);
}

async function importCRMData() {
  console.log("Importing Salesforce CRM data...");
  const csvPath = path.join(process.cwd(), "attached_assets", "Salesforce_CRM_and_sales_data_1766013665537.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  for (const row of rows) {
    const metricDate = monthYearToDate(row.Month, row.Year);
    
    await db.insert(metricsCrm).values({
      organizationId: ORG_ID,
      integrationId: INTEGRATION_IDS.salesforce,
      platform: "salesforce",
      metricDate,
      totalContacts: parseInt(row.Total_Leads) || 0,
      newContacts: parseInt(row.MQLs) || 0,
      totalDeals: parseInt(row.Opportunities_Created) || 0,
      dealsWon: parseInt(row.Closed_Won) || 0,
      dealsLost: parseInt(row.Closed_Lost) || 0,
      pipelineValue: row.Pipeline_Value || "0",
      closedRevenue: row.Monthly_Revenue || "0",
      avgDealSize: row.Average_Deal_Size || "0",
      conversionRate: row.Win_Rate_Percent || "0",
      pipelineStages: {
        leads: parseInt(row.Total_Leads) || 0,
        mqls: parseInt(row.MQLs) || 0,
        sqls: parseInt(row.SQLs) || 0,
        opportunities: parseInt(row.Opportunities_Created) || 0,
        openOpportunities: parseInt(row.Open_Opportunities) || 0,
        activeCustomers: parseInt(row.Total_Active_Customers) || 0,
        newCustomers: parseInt(row.New_Customers) || 0,
        churnedCustomers: parseInt(row.Churned_Customers) || 0,
        churnRate: parseFloat(row.Churn_Rate_Percent) || 0,
        avgSalesCycleDays: parseInt(row.Average_Sales_Cycle_Days) || 0,
        leadSources: {
          website: parseInt(row.Website_Leads) || 0,
          paidAds: parseInt(row.Paid_Ads_Leads) || 0,
          email: parseInt(row.Email_Marketing_Leads) || 0,
          referral: parseInt(row.Referral_Leads) || 0,
          tradeShows: parseInt(row.Trade_Shows_Leads) || 0,
        },
      },
    });
  }
  console.log(`Imported ${rows.length} CRM records`);
}

async function importEmailData() {
  console.log("Importing Pardot email data...");
  const csvPath = path.join(process.cwd(), "attached_assets", "Salesforce:pardot_email_campaign_performance_1766013665538.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  for (const row of rows) {
    const metricDate = monthYearToDate(row.Month, row.Year);
    
    await db.insert(metricsEmail).values({
      organizationId: ORG_ID,
      integrationId: INTEGRATION_IDS.salesforce,
      platform: "salesforce_pardot",
      metricDate,
      totalEmailsSent: parseInt(row.Total_Emails_Sent) || 0,
      delivered: parseInt(row.Delivered) || 0,
      bounced: parseInt(row.Bounced) || 0,
      bounceRate: row.Bounce_Rate_Percent || "0",
      opens: parseInt(row.Total_Opens) || 0,
      uniqueOpens: parseInt(row.Unique_Opens) || 0,
      openRate: row.Open_Rate_Percent || "0",
      clicks: parseInt(row.Total_Clicks) || 0,
      uniqueClicks: parseInt(row.Unique_Clicks) || 0,
      clickRate: row.Click_Rate_Percent || "0",
      conversions: parseInt(row.Conversions) || 0,
      conversionRate: row.Conversion_Rate_Percent || "0",
      unsubscribes: parseInt(row.Unsubscribes) || 0,
      subscribers: parseInt(row.Total_Subscribers) || 0,
      campaignsSent: parseInt(row.Campaigns_Sent) || 0,
    });
  }
  console.log(`Imported ${rows.length} email records`);
}

async function main() {
  console.log("Starting PrecisionTools Pro demo data import...\n");
  
  try {
    await importGA4Data();
    await importAdsData();
    await importCRMData();
    await importEmailData();
    
    console.log("\n✓ All demo data imported successfully!");
    console.log("\nVerify with:");
    console.log("  SELECT COUNT(*) FROM metrics_analytics WHERE organization_id = '" + ORG_ID + "';");
    console.log("  SELECT COUNT(*) FROM metrics_ads WHERE organization_id = '" + ORG_ID + "';");
    console.log("  SELECT COUNT(*) FROM metrics_crm WHERE organization_id = '" + ORG_ID + "';");
    console.log("  SELECT COUNT(*) FROM metrics_email WHERE organization_id = '" + ORG_ID + "';");
    
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
