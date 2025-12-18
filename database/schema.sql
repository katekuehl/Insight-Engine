-- Strata Analytics - Python Pipeline Database Schema
-- This creates tables matching the Python dataclass schemas exactly
-- Run with: psql $DATABASE_URL < database/schema.sql

-- Drop existing tables if they exist (for clean re-runs)
DROP TABLE IF EXISTS pipeline_metrics_website CASCADE;
DROP TABLE IF EXISTS pipeline_metrics_ads CASCADE;
DROP TABLE IF EXISTS pipeline_metrics_email CASCADE;
DROP TABLE IF EXISTS pipeline_metrics_crm CASCADE;

-- ============================================
-- WEBSITE PERFORMANCE METRICS (22 fields)
-- Source: Google Analytics 4
-- ============================================
CREATE TABLE pipeline_metrics_website (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    organization_id VARCHAR(255) NOT NULL,
    
    -- Core Metrics
    sessions INTEGER NOT NULL,
    users INTEGER NOT NULL,
    new_users INTEGER NOT NULL,
    pageviews INTEGER NOT NULL,
    pages_per_session DECIMAL(10,4) NOT NULL,
    avg_session_duration DECIMAL(12,2) NOT NULL,
    bounce_rate DECIMAL(6,2) NOT NULL,
    goal_completions INTEGER NOT NULL,
    goal_conversion_rate DECIMAL(6,2) NOT NULL,
    
    -- Traffic Source Breakdown
    organic_sessions INTEGER NOT NULL,
    direct_sessions INTEGER NOT NULL,
    paid_sessions INTEGER NOT NULL,
    social_sessions INTEGER NOT NULL,
    referral_sessions INTEGER NOT NULL,
    email_sessions INTEGER NOT NULL,
    
    -- Device Breakdown
    desktop_sessions INTEGER NOT NULL,
    mobile_sessions INTEGER NOT NULL,
    tablet_sessions INTEGER NOT NULL,
    
    -- Data Quality Flag
    is_synthetic BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uq_website_org_date UNIQUE (organization_id, metric_date)
);

CREATE INDEX idx_website_org ON pipeline_metrics_website(organization_id);
CREATE INDEX idx_website_date ON pipeline_metrics_website(metric_date);

-- ============================================
-- ADVERTISING METRICS (25 fields)
-- Source: Google Ads, Meta Ads
-- ============================================
CREATE TABLE pipeline_metrics_ads (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    organization_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,  -- 'google_ads' or 'meta_ads'
    
    -- Core Ad Metrics
    impressions INTEGER NOT NULL,
    clicks INTEGER NOT NULL,
    ctr DECIMAL(8,4) NOT NULL,
    spend DECIMAL(12,2) NOT NULL,
    conversions INTEGER NOT NULL,
    conversion_rate DECIMAL(8,4) NOT NULL,
    cpc DECIMAL(10,2) NOT NULL,
    cpa DECIMAL(12,2) NOT NULL,
    roas DECIMAL(10,4) NOT NULL,
    
    -- Google Ads Campaign Types (NULL for Meta)
    search_spend DECIMAL(12,2),
    display_spend DECIMAL(12,2),
    remarketing_spend DECIMAL(12,2),
    
    -- Meta Ads Placements (NULL for Google)
    facebook_spend DECIMAL(12,2),
    instagram_spend DECIMAL(12,2),
    audience_network_spend DECIMAL(12,2),
    
    -- Data Quality Flag
    is_synthetic BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uq_ads_org_date_platform UNIQUE (organization_id, metric_date, platform)
);

CREATE INDEX idx_ads_org ON pipeline_metrics_ads(organization_id);
CREATE INDEX idx_ads_date ON pipeline_metrics_ads(metric_date);
CREATE INDEX idx_ads_platform ON pipeline_metrics_ads(platform);

-- ============================================
-- EMAIL CAMPAIGN METRICS (27 fields)
-- Source: Salesforce Pardot
-- ============================================
CREATE TABLE pipeline_metrics_email (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    organization_id VARCHAR(255) NOT NULL,
    
    -- Subscriber Metrics
    total_subscribers INTEGER NOT NULL,
    new_subscribers INTEGER NOT NULL,
    unsubscribes INTEGER NOT NULL,
    unsubscribe_rate DECIMAL(6,4) NOT NULL,
    
    -- Campaign Volume
    campaigns_sent INTEGER NOT NULL,
    total_emails_sent INTEGER NOT NULL,
    delivered INTEGER NOT NULL,
    bounced INTEGER NOT NULL,
    bounce_rate DECIMAL(6,4) NOT NULL,
    
    -- Engagement Metrics
    total_opens INTEGER NOT NULL,
    open_rate DECIMAL(6,4) NOT NULL,
    unique_opens INTEGER NOT NULL,
    unique_open_rate DECIMAL(6,4) NOT NULL,
    total_clicks INTEGER NOT NULL,
    click_rate DECIMAL(6,4) NOT NULL,
    click_to_open_rate DECIMAL(8,4) NOT NULL,
    unique_clicks INTEGER NOT NULL,
    unique_click_rate DECIMAL(6,4) NOT NULL,
    
    -- Conversion Metrics
    conversions INTEGER NOT NULL,
    conversion_rate DECIMAL(6,4) NOT NULL,
    email_generated_leads INTEGER NOT NULL,
    
    -- Email Type Breakdown
    newsletter_sent INTEGER NOT NULL,
    promotional_sent INTEGER NOT NULL,
    nurture_sent INTEGER NOT NULL,
    transactional_sent INTEGER NOT NULL,
    
    -- Data Quality Flag
    is_synthetic BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uq_email_org_date UNIQUE (organization_id, metric_date)
);

CREATE INDEX idx_email_org ON pipeline_metrics_email(organization_id);
CREATE INDEX idx_email_date ON pipeline_metrics_email(metric_date);

-- ============================================
-- CRM / SALES METRICS (33 fields)
-- Source: Salesforce CRM
-- ============================================
CREATE TABLE pipeline_metrics_crm (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    organization_id VARCHAR(255) NOT NULL,
    
    -- Lead Metrics
    total_leads INTEGER NOT NULL,
    mql_count INTEGER NOT NULL,
    mql_conversion_rate DECIMAL(6,2) NOT NULL,
    sql_count INTEGER NOT NULL,
    sql_conversion_rate DECIMAL(6,2) NOT NULL,
    
    -- Opportunity Metrics
    opportunities_created INTEGER NOT NULL,
    opportunity_conversion_rate DECIMAL(6,2) NOT NULL,
    pipeline_value DECIMAL(14,2) NOT NULL,
    open_opportunities INTEGER NOT NULL,
    
    -- Deal Outcomes
    closed_won INTEGER NOT NULL,
    closed_lost INTEGER NOT NULL,
    win_rate DECIMAL(6,2) NOT NULL,
    loss_rate DECIMAL(6,2) NOT NULL,
    
    -- Revenue Metrics
    monthly_revenue DECIMAL(14,2) NOT NULL,
    cumulative_revenue_ytd DECIMAL(14,2) NOT NULL,
    avg_deal_size DECIMAL(12,2) NOT NULL,
    
    -- Customer Metrics
    new_customers INTEGER NOT NULL,
    churned_customers INTEGER NOT NULL,
    total_active_customers INTEGER NOT NULL,
    churn_rate DECIMAL(6,4) NOT NULL,
    avg_sales_cycle_days INTEGER NOT NULL,
    
    -- Lead Source Breakdown
    website_leads INTEGER NOT NULL,
    paid_ads_leads INTEGER NOT NULL,
    email_marketing_leads INTEGER NOT NULL,
    referral_leads INTEGER NOT NULL,
    trade_shows_leads INTEGER NOT NULL,
    other_leads INTEGER NOT NULL,
    
    -- Product Revenue Breakdown
    smartdiag_revenue DECIMAL(12,2) NOT NULL,
    liftmaster_revenue DECIMAL(12,2) NOT NULL,
    toolhub_revenue DECIMAL(12,2) NOT NULL,
    calibration_kits_revenue DECIMAL(12,2) NOT NULL,
    
    -- Sales Team Metrics
    sales_team_size INTEGER NOT NULL,
    revenue_per_rep DECIMAL(12,2) NOT NULL,
    deals_per_rep DECIMAL(6,2) NOT NULL,
    
    -- Data Quality Flag
    is_synthetic BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT uq_crm_org_date UNIQUE (organization_id, metric_date)
);

CREATE INDEX idx_crm_org ON pipeline_metrics_crm(organization_id);
CREATE INDEX idx_crm_date ON pipeline_metrics_crm(metric_date);

-- Verification: Show all tables created
SELECT 'SCHEMA CREATED SUCCESSFULLY' AS status;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as column_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'pipeline_metrics_%'
ORDER BY table_name;
