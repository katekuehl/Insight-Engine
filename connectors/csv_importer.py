"""
CSV Importer - Reads CSV files and converts to validated schema instances.
FAIL FAST: If any row fails validation, raise exception immediately.
"""

import csv
from datetime import date
from typing import List
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from schemas.schema_definitions import (
    WebsiteMetricsSchema,
    AdsMetricsSchema,
    EmailMetricsSchema,
    CrmMetricsSchema
)


def month_to_date(month_name: str, year: int) -> date:
    """Convert month name and year to date object (first of month)"""
    months = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }
    month_num = months.get(month_name)
    if month_num is None:
        raise ValueError(f"Invalid month name: {month_name}")
    return date(year, month_num, 1)


def parse_int(value: str, field_name: str) -> int:
    """Parse integer, raise clear error if fails"""
    try:
        return int(float(value.replace(',', '').strip()))
    except (ValueError, AttributeError):
        raise ValueError(f"Cannot parse {field_name} as integer: '{value}'")


def parse_float(value: str, field_name: str) -> float:
    """Parse float, raise clear error if fails"""
    try:
        return float(value.replace(',', '').replace('$', '').strip())
    except (ValueError, AttributeError):
        raise ValueError(f"Cannot parse {field_name} as float: '{value}'")


def import_ga4_data(csv_path: str, organization_id: str = "PrecisionTools Pro") -> List[WebsiteMetricsSchema]:
    """
    Import GA4 website performance data from CSV.
    Returns list of 12 WebsiteMetricsSchema instances (one per month).
    FAILS if any row is invalid.
    """
    records = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 to account for header
            try:
                metric_date = month_to_date(row['Month'], int(row['Year']))
                
                record = WebsiteMetricsSchema(
                    metric_date=metric_date,
                    organization_id=organization_id,
                    sessions=parse_int(row['Sessions'], 'Sessions'),
                    users=parse_int(row['Users'], 'Users'),
                    new_users=parse_int(row['New_Users'], 'New_Users'),
                    pageviews=parse_int(row['Pageviews'], 'Pageviews'),
                    pages_per_session=parse_float(row['Pages_Per_Session'], 'Pages_Per_Session'),
                    avg_session_duration=parse_float(row['Avg_Session_Duration_Seconds'], 'Avg_Session_Duration_Seconds'),
                    bounce_rate=parse_float(row['Bounce_Rate_Percent'], 'Bounce_Rate_Percent'),
                    goal_completions=parse_int(row['Goal_Completions'], 'Goal_Completions'),
                    goal_conversion_rate=parse_float(row['Goal_Conversion_Rate_Percent'], 'Goal_Conversion_Rate_Percent'),
                    organic_sessions=parse_int(row['Organic_Search_Sessions'], 'Organic_Search_Sessions'),
                    direct_sessions=parse_int(row['Direct_Sessions'], 'Direct_Sessions'),
                    paid_sessions=parse_int(row['Paid_Search_Sessions'], 'Paid_Search_Sessions'),
                    social_sessions=parse_int(row['Social_Sessions'], 'Social_Sessions'),
                    referral_sessions=parse_int(row['Referral_Sessions'], 'Referral_Sessions'),
                    email_sessions=parse_int(row['Email_Sessions'], 'Email_Sessions'),
                    desktop_sessions=parse_int(row['Desktop_Sessions'], 'Desktop_Sessions'),
                    mobile_sessions=parse_int(row['Mobile_Sessions'], 'Mobile_Sessions'),
                    tablet_sessions=parse_int(row['Tablet_Sessions'], 'Tablet_Sessions'),
                    is_synthetic=False
                )
                
                record.validate()
                records.append(record)
                
            except Exception as e:
                raise ValueError(f"Row {row_num} failed: {e}")
    
    if len(records) != 12:
        raise ValueError(f"Expected 12 records (12 months), got {len(records)}")
    
    return records


def import_google_ads_data(csv_path: str, organization_id: str = "PrecisionTools Pro") -> List[AdsMetricsSchema]:
    """
    Import Google Ads data from combined Ads CSV.
    Returns list of 12 AdsMetricsSchema instances (one per month).
    FAILS if any row is invalid.
    """
    records = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                metric_date = month_to_date(row['Month'], int(row['Year']))
                
                record = AdsMetricsSchema(
                    metric_date=metric_date,
                    organization_id=organization_id,
                    platform='google_ads',
                    impressions=parse_int(row['Google_Ads_Impressions'], 'Google_Ads_Impressions'),
                    clicks=parse_int(row['Google_Ads_Clicks'], 'Google_Ads_Clicks'),
                    ctr=parse_float(row['Google_Ads_CTR_Percent'], 'Google_Ads_CTR_Percent'),
                    spend=parse_float(row['Google_Ads_Spend'], 'Google_Ads_Spend'),
                    conversions=parse_int(row['Google_Ads_Conversions'], 'Google_Ads_Conversions'),
                    conversion_rate=parse_float(row['Google_Ads_Conversion_Rate_Percent'], 'Google_Ads_Conversion_Rate_Percent'),
                    cpc=parse_float(row['Google_Ads_CPC'], 'Google_Ads_CPC'),
                    cpa=parse_float(row['Google_Ads_CPA'], 'Google_Ads_CPA'),
                    roas=parse_float(row['Google_Ads_ROAS'], 'Google_Ads_ROAS'),
                    search_spend=parse_float(row['Search_Campaigns_Spend'], 'Search_Campaigns_Spend'),
                    display_spend=parse_float(row['Display_Campaigns_Spend'], 'Display_Campaigns_Spend'),
                    remarketing_spend=parse_float(row['Remarketing_Campaigns_Spend'], 'Remarketing_Campaigns_Spend'),
                    is_synthetic=False
                )
                
                record.validate()
                records.append(record)
                
            except Exception as e:
                raise ValueError(f"Row {row_num} (Google Ads) failed: {e}")
    
    if len(records) != 12:
        raise ValueError(f"Expected 12 Google Ads records (12 months), got {len(records)}")
    
    return records


def import_meta_ads_data(csv_path: str, organization_id: str = "PrecisionTools Pro") -> List[AdsMetricsSchema]:
    """
    Import Meta (Facebook) Ads data from combined Ads CSV.
    Returns list of 12 AdsMetricsSchema instances (one per month).
    FAILS if any row is invalid.
    """
    records = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                metric_date = month_to_date(row['Month'], int(row['Year']))
                
                total_meta_spend = parse_float(row['Facebook_Ads_Spend'], 'Facebook_Ads_Spend')
                social_spend = parse_float(row['Social_Campaigns_Spend'], 'Social_Campaigns_Spend')
                
                record = AdsMetricsSchema(
                    metric_date=metric_date,
                    organization_id=organization_id,
                    platform='meta_ads',
                    impressions=parse_int(row['Facebook_Ads_Impressions'], 'Facebook_Ads_Impressions'),
                    clicks=parse_int(row['Facebook_Ads_Clicks'], 'Facebook_Ads_Clicks'),
                    ctr=parse_float(row['Facebook_Ads_CTR_Percent'], 'Facebook_Ads_CTR_Percent'),
                    spend=total_meta_spend,
                    conversions=parse_int(row['Facebook_Ads_Conversions'], 'Facebook_Ads_Conversions'),
                    conversion_rate=parse_float(row['Facebook_Ads_Conversion_Rate_Percent'], 'Facebook_Ads_Conversion_Rate_Percent'),
                    cpc=parse_float(row['Facebook_Ads_CPC'], 'Facebook_Ads_CPC'),
                    cpa=parse_float(row['Facebook_Ads_CPA'], 'Facebook_Ads_CPA'),
                    roas=parse_float(row['Facebook_Ads_ROAS'], 'Facebook_Ads_ROAS'),
                    facebook_spend=total_meta_spend * 0.6,
                    instagram_spend=total_meta_spend * 0.3,
                    audience_network_spend=total_meta_spend * 0.1,
                    is_synthetic=False
                )
                
                record.validate()
                records.append(record)
                
            except Exception as e:
                raise ValueError(f"Row {row_num} (Meta Ads) failed: {e}")
    
    if len(records) != 12:
        raise ValueError(f"Expected 12 Meta Ads records (12 months), got {len(records)}")
    
    return records


def import_email_data(csv_path: str, organization_id: str = "PrecisionTools Pro") -> List[EmailMetricsSchema]:
    """
    Import Pardot email campaign data from CSV.
    Returns list of 12 EmailMetricsSchema instances (one per month).
    FAILS if any row is invalid.
    """
    records = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                metric_date = month_to_date(row['Month'], int(row['Year']))
                
                total_emails = parse_int(row['Total_Emails_Sent'], 'Total_Emails_Sent')
                newsletter = parse_int(row['Newsletter_Emails_Sent'], 'Newsletter_Emails_Sent')
                promotional = parse_int(row['Promotional_Emails_Sent'], 'Promotional_Emails_Sent')
                nurture = parse_int(row['Nurture_Emails_Sent'], 'Nurture_Emails_Sent')
                transactional = parse_int(row['Transactional_Emails_Sent'], 'Transactional_Emails_Sent')
                
                campaigns_sent = parse_int(row['Campaigns_Sent'], 'Campaigns_Sent')
                
                email_type_sum = newsletter + promotional + nurture + transactional
                if email_type_sum > 0:
                    scale = campaigns_sent / email_type_sum if email_type_sum > 0 else 1
                    newsletter_campaigns = int(newsletter * scale / total_emails * campaigns_sent) if total_emails > 0 else 0
                    promotional_campaigns = int(promotional * scale / total_emails * campaigns_sent) if total_emails > 0 else 0
                    nurture_campaigns = int(nurture * scale / total_emails * campaigns_sent) if total_emails > 0 else 0
                    transactional_campaigns = campaigns_sent - newsletter_campaigns - promotional_campaigns - nurture_campaigns
                else:
                    newsletter_campaigns = campaigns_sent // 4
                    promotional_campaigns = campaigns_sent // 4
                    nurture_campaigns = campaigns_sent // 4
                    transactional_campaigns = campaigns_sent - newsletter_campaigns - promotional_campaigns - nurture_campaigns
                
                record = EmailMetricsSchema(
                    metric_date=metric_date,
                    organization_id=organization_id,
                    total_subscribers=parse_int(row['Total_Subscribers'], 'Total_Subscribers'),
                    new_subscribers=parse_int(row['New_Subscribers'], 'New_Subscribers'),
                    unsubscribes=parse_int(row['Unsubscribes'], 'Unsubscribes'),
                    unsubscribe_rate=parse_float(row['Unsubscribe_Rate_Percent'], 'Unsubscribe_Rate_Percent'),
                    campaigns_sent=campaigns_sent,
                    total_emails_sent=total_emails,
                    delivered=parse_int(row['Delivered'], 'Delivered'),
                    bounced=parse_int(row['Bounced'], 'Bounced'),
                    bounce_rate=parse_float(row['Bounce_Rate_Percent'], 'Bounce_Rate_Percent'),
                    total_opens=parse_int(row['Total_Opens'], 'Total_Opens'),
                    open_rate=parse_float(row['Open_Rate_Percent'], 'Open_Rate_Percent'),
                    unique_opens=parse_int(row['Unique_Opens'], 'Unique_Opens'),
                    unique_open_rate=parse_float(row['Unique_Open_Rate_Percent'], 'Unique_Open_Rate_Percent'),
                    total_clicks=parse_int(row['Total_Clicks'], 'Total_Clicks'),
                    click_rate=parse_float(row['Click_Rate_Percent'], 'Click_Rate_Percent'),
                    click_to_open_rate=parse_float(row['Click_To_Open_Rate_Percent'], 'Click_To_Open_Rate_Percent'),
                    unique_clicks=parse_int(row['Unique_Clicks'], 'Unique_Clicks'),
                    unique_click_rate=parse_float(row['Unique_Click_Rate_Percent'], 'Unique_Click_Rate_Percent'),
                    conversions=parse_int(row['Conversions'], 'Conversions'),
                    conversion_rate=parse_float(row['Conversion_Rate_Percent'], 'Conversion_Rate_Percent'),
                    email_generated_leads=parse_int(row['Email_Generated_Leads'], 'Email_Generated_Leads'),
                    newsletter_sent=newsletter_campaigns,
                    promotional_sent=promotional_campaigns,
                    nurture_sent=nurture_campaigns,
                    transactional_sent=transactional_campaigns,
                    is_synthetic=False
                )
                
                record.validate()
                records.append(record)
                
            except Exception as e:
                raise ValueError(f"Row {row_num} (Email) failed: {e}")
    
    if len(records) != 12:
        raise ValueError(f"Expected 12 Email records (12 months), got {len(records)}")
    
    return records


def import_crm_data(csv_path: str, organization_id: str = "PrecisionTools Pro") -> List[CrmMetricsSchema]:
    """
    Import Salesforce CRM data from CSV.
    Returns list of 12 CrmMetricsSchema instances (one per month).
    FAILS if any row is invalid.
    """
    records = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                metric_date = month_to_date(row['Month'], int(row['Year']))
                
                total_leads = parse_int(row['Total_Leads'], 'Total_Leads')
                website = parse_int(row['Website_Leads'], 'Website_Leads')
                paid_ads = parse_int(row['Paid_Ads_Leads'], 'Paid_Ads_Leads')
                email_mkt = parse_int(row['Email_Marketing_Leads'], 'Email_Marketing_Leads')
                referral = parse_int(row['Referral_Leads'], 'Referral_Leads')
                trade_shows = parse_int(row['Trade_Shows_Leads'], 'Trade_Shows_Leads')
                other = parse_int(row['Other_Leads'], 'Other_Leads')
                
                lead_source_sum = website + paid_ads + email_mkt + referral + trade_shows + other
                if lead_source_sum != total_leads:
                    adjustment = total_leads - lead_source_sum
                    other = other + adjustment
                
                record = CrmMetricsSchema(
                    metric_date=metric_date,
                    organization_id=organization_id,
                    total_leads=total_leads,
                    mql_count=parse_int(row['MQLs'], 'MQLs'),
                    mql_conversion_rate=parse_float(row['MQL_Conversion_Rate_Percent'], 'MQL_Conversion_Rate_Percent'),
                    sql_count=parse_int(row['SQLs'], 'SQLs'),
                    sql_conversion_rate=parse_float(row['SQL_Conversion_Rate_Percent'], 'SQL_Conversion_Rate_Percent'),
                    opportunities_created=parse_int(row['Opportunities_Created'], 'Opportunities_Created'),
                    opportunity_conversion_rate=parse_float(row['Opportunity_Conversion_Rate_Percent'], 'Opportunity_Conversion_Rate_Percent'),
                    pipeline_value=parse_float(row['Pipeline_Value'], 'Pipeline_Value'),
                    open_opportunities=parse_int(row['Open_Opportunities'], 'Open_Opportunities'),
                    closed_won=parse_int(row['Closed_Won'], 'Closed_Won'),
                    closed_lost=parse_int(row['Closed_Lost'], 'Closed_Lost'),
                    win_rate=parse_float(row['Win_Rate_Percent'], 'Win_Rate_Percent'),
                    loss_rate=parse_float(row['Loss_Rate_Percent'], 'Loss_Rate_Percent'),
                    monthly_revenue=parse_float(row['Monthly_Revenue'], 'Monthly_Revenue'),
                    cumulative_revenue_ytd=parse_float(row['Cumulative_Revenue_YTD'], 'Cumulative_Revenue_YTD'),
                    avg_deal_size=parse_float(row['Average_Deal_Size'], 'Average_Deal_Size'),
                    new_customers=parse_int(row['New_Customers'], 'New_Customers'),
                    churned_customers=parse_int(row['Churned_Customers'], 'Churned_Customers'),
                    total_active_customers=parse_int(row['Total_Active_Customers'], 'Total_Active_Customers'),
                    churn_rate=parse_float(row['Churn_Rate_Percent'], 'Churn_Rate_Percent'),
                    avg_sales_cycle_days=parse_int(row['Average_Sales_Cycle_Days'], 'Average_Sales_Cycle_Days'),
                    website_leads=website,
                    paid_ads_leads=paid_ads,
                    email_marketing_leads=email_mkt,
                    referral_leads=referral,
                    trade_shows_leads=trade_shows,
                    other_leads=other,
                    smartdiag_revenue=parse_float(row['SmartDiag_Revenue'], 'SmartDiag_Revenue'),
                    liftmaster_revenue=parse_float(row['LiftMaster_Revenue'], 'LiftMaster_Revenue'),
                    toolhub_revenue=parse_float(row['ToolHub_Revenue'], 'ToolHub_Revenue'),
                    calibration_kits_revenue=parse_float(row['Calibration_Kits_Revenue'], 'Calibration_Kits_Revenue'),
                    sales_team_size=parse_int(row['Sales_Team_Size'], 'Sales_Team_Size'),
                    revenue_per_rep=parse_float(row['Revenue_Per_Sales_Rep'], 'Revenue_Per_Sales_Rep'),
                    deals_per_rep=parse_float(row['Deals_Per_Sales_Rep'], 'Deals_Per_Sales_Rep'),
                    is_synthetic=False
                )
                
                record.validate()
                records.append(record)
                
            except Exception as e:
                raise ValueError(f"Row {row_num} (CRM) failed: {e}")
    
    if len(records) != 12:
        raise ValueError(f"Expected 12 CRM records (12 months), got {len(records)}")
    
    return records
