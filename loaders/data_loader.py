"""
Data Loader - Inserts validated schema instances into PostgreSQL.
FAIL FAST: If any insert fails, raise exception immediately.
Uses psycopg2 for direct database access.
"""

import os
from typing import List, Dict, Any

import psycopg2
from psycopg2.extras import execute_values

from schemas.schema_definitions import (
    WebsiteMetricsSchema,
    AdsMetricsSchema,
    EmailMetricsSchema,
    CrmMetricsSchema
)


def get_connection():
    """Get database connection from DATABASE_URL environment variable."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(db_url)


def load_website_data(records: List[WebsiteMetricsSchema]) -> Dict[str, Any]:
    """
    Load website metrics into pipeline_metrics_website table.
    Returns: {'status': 'SUCCESS', 'records_inserted': int}
    """
    if not records:
        raise ValueError("No records to load - fail fast")
    
    for r in records:
        if not r.validate():
            raise ValueError(f"Invalid record for {r.metric_date}: validation failed")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM pipeline_metrics_website WHERE organization_id = %s", 
                      (records[0].organization_id,))
        
        insert_sql = """
            INSERT INTO pipeline_metrics_website (
                metric_date, organization_id, sessions, users, new_users,
                pageviews, pages_per_session, avg_session_duration, bounce_rate,
                goal_completions, goal_conversion_rate, organic_sessions, direct_sessions,
                paid_sessions, social_sessions, referral_sessions, email_sessions,
                desktop_sessions, mobile_sessions, tablet_sessions, is_synthetic
            ) VALUES %s
        """
        
        values = [
            (r.metric_date, r.organization_id, r.sessions, r.users, r.new_users,
             r.pageviews, r.pages_per_session, r.avg_session_duration, r.bounce_rate,
             r.goal_completions, r.goal_conversion_rate, r.organic_sessions, r.direct_sessions,
             r.paid_sessions, r.social_sessions, r.referral_sessions, r.email_sessions,
             r.desktop_sessions, r.mobile_sessions, r.tablet_sessions, r.is_synthetic)
            for r in records
        ]
        
        execute_values(cursor, insert_sql, values)
        conn.commit()
        
        return {'status': 'SUCCESS', 'records_inserted': len(records)}
    
    except Exception as e:
        conn.rollback()
        raise ValueError(f"Failed to load website data: {e}")
    finally:
        conn.close()


def load_google_ads_data(records: List[AdsMetricsSchema]) -> Dict[str, Any]:
    """
    Load Google Ads metrics into pipeline_metrics_ads table.
    Returns: {'status': 'SUCCESS', 'records_inserted': int}
    """
    if not records:
        raise ValueError("No records to load - fail fast")
    
    for r in records:
        if r.platform != 'google_ads':
            raise ValueError(f"Expected google_ads platform, got {r.platform}")
        if not r.validate():
            raise ValueError(f"Invalid record for {r.metric_date}: validation failed")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("""DELETE FROM pipeline_metrics_ads 
                         WHERE organization_id = %s AND platform = 'google_ads'""", 
                      (records[0].organization_id,))
        
        insert_sql = """
            INSERT INTO pipeline_metrics_ads (
                metric_date, organization_id, platform, impressions, clicks,
                ctr, spend, conversions, conversion_rate, cpc, cpa, roas,
                search_spend, display_spend, remarketing_spend, is_synthetic
            ) VALUES %s
        """
        
        values = [
            (r.metric_date, r.organization_id, r.platform, r.impressions, r.clicks,
             r.ctr, r.spend, r.conversions, r.conversion_rate, r.cpc, r.cpa, r.roas,
             r.search_spend, r.display_spend, r.remarketing_spend, r.is_synthetic)
            for r in records
        ]
        
        execute_values(cursor, insert_sql, values)
        conn.commit()
        
        return {'status': 'SUCCESS', 'records_inserted': len(records)}
    
    except Exception as e:
        conn.rollback()
        raise ValueError(f"Failed to load Google Ads data: {e}")
    finally:
        conn.close()


def load_meta_ads_data(records: List[AdsMetricsSchema]) -> Dict[str, Any]:
    """
    Load Meta Ads metrics into pipeline_metrics_ads table.
    Returns: {'status': 'SUCCESS', 'records_inserted': int}
    """
    if not records:
        raise ValueError("No records to load - fail fast")
    
    for r in records:
        if r.platform != 'meta_ads':
            raise ValueError(f"Expected meta_ads platform, got {r.platform}")
        if not r.validate():
            raise ValueError(f"Invalid record for {r.metric_date}: validation failed")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("""DELETE FROM pipeline_metrics_ads 
                         WHERE organization_id = %s AND platform = 'meta_ads'""", 
                      (records[0].organization_id,))
        
        insert_sql = """
            INSERT INTO pipeline_metrics_ads (
                metric_date, organization_id, platform, impressions, clicks,
                ctr, spend, conversions, conversion_rate, cpc, cpa, roas,
                facebook_spend, instagram_spend, audience_network_spend, is_synthetic
            ) VALUES %s
        """
        
        values = [
            (r.metric_date, r.organization_id, r.platform, r.impressions, r.clicks,
             r.ctr, r.spend, r.conversions, r.conversion_rate, r.cpc, r.cpa, r.roas,
             r.facebook_spend, r.instagram_spend, r.audience_network_spend, r.is_synthetic)
            for r in records
        ]
        
        execute_values(cursor, insert_sql, values)
        conn.commit()
        
        return {'status': 'SUCCESS', 'records_inserted': len(records)}
    
    except Exception as e:
        conn.rollback()
        raise ValueError(f"Failed to load Meta Ads data: {e}")
    finally:
        conn.close()


def load_email_data(records: List[EmailMetricsSchema]) -> Dict[str, Any]:
    """
    Load email metrics into pipeline_metrics_email table.
    Returns: {'status': 'SUCCESS', 'records_inserted': int}
    """
    if not records:
        raise ValueError("No records to load - fail fast")
    
    for r in records:
        if not r.validate():
            raise ValueError(f"Invalid record for {r.metric_date}: validation failed")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM pipeline_metrics_email WHERE organization_id = %s", 
                      (records[0].organization_id,))
        
        insert_sql = """
            INSERT INTO pipeline_metrics_email (
                metric_date, organization_id, total_subscribers, new_subscribers,
                unsubscribes, unsubscribe_rate, campaigns_sent, total_emails_sent,
                delivered, bounced, bounce_rate, total_opens, open_rate,
                unique_opens, unique_open_rate, total_clicks, click_rate,
                click_to_open_rate, unique_clicks, unique_click_rate,
                conversions, conversion_rate, email_generated_leads,
                newsletter_sent, promotional_sent, nurture_sent, transactional_sent,
                is_synthetic
            ) VALUES %s
        """
        
        values = [
            (r.metric_date, r.organization_id, r.total_subscribers, r.new_subscribers,
             r.unsubscribes, r.unsubscribe_rate, r.campaigns_sent, r.total_emails_sent,
             r.delivered, r.bounced, r.bounce_rate, r.total_opens, r.open_rate,
             r.unique_opens, r.unique_open_rate, r.total_clicks, r.click_rate,
             r.click_to_open_rate, r.unique_clicks, r.unique_click_rate,
             r.conversions, r.conversion_rate, r.email_generated_leads,
             r.newsletter_sent, r.promotional_sent, r.nurture_sent, r.transactional_sent,
             r.is_synthetic)
            for r in records
        ]
        
        execute_values(cursor, insert_sql, values)
        conn.commit()
        
        return {'status': 'SUCCESS', 'records_inserted': len(records)}
    
    except Exception as e:
        conn.rollback()
        raise ValueError(f"Failed to load email data: {e}")
    finally:
        conn.close()


def load_crm_data(records: List[CrmMetricsSchema]) -> Dict[str, Any]:
    """
    Load CRM metrics into pipeline_metrics_crm table.
    Returns: {'status': 'SUCCESS', 'records_inserted': int}
    """
    if not records:
        raise ValueError("No records to load - fail fast")
    
    for r in records:
        if not r.validate():
            raise ValueError(f"Invalid record for {r.metric_date}: validation failed")
    
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM pipeline_metrics_crm WHERE organization_id = %s", 
                      (records[0].organization_id,))
        
        insert_sql = """
            INSERT INTO pipeline_metrics_crm (
                metric_date, organization_id, total_leads, mql_count, mql_conversion_rate,
                sql_count, sql_conversion_rate, opportunities_created, opportunity_conversion_rate,
                pipeline_value, open_opportunities, closed_won, closed_lost,
                win_rate, loss_rate, monthly_revenue, cumulative_revenue_ytd, avg_deal_size,
                new_customers, churned_customers, total_active_customers, churn_rate,
                avg_sales_cycle_days, website_leads, paid_ads_leads, email_marketing_leads,
                referral_leads, trade_shows_leads, other_leads,
                smartdiag_revenue, liftmaster_revenue, toolhub_revenue, calibration_kits_revenue,
                sales_team_size, revenue_per_rep, deals_per_rep, is_synthetic
            ) VALUES %s
        """
        
        values = [
            (r.metric_date, r.organization_id, r.total_leads, r.mql_count, r.mql_conversion_rate,
             r.sql_count, r.sql_conversion_rate, r.opportunities_created, r.opportunity_conversion_rate,
             r.pipeline_value, r.open_opportunities, r.closed_won, r.closed_lost,
             r.win_rate, r.loss_rate, r.monthly_revenue, r.cumulative_revenue_ytd, r.avg_deal_size,
             r.new_customers, r.churned_customers, r.total_active_customers, r.churn_rate,
             r.avg_sales_cycle_days, r.website_leads, r.paid_ads_leads, r.email_marketing_leads,
             r.referral_leads, r.trade_shows_leads, r.other_leads,
             r.smartdiag_revenue, r.liftmaster_revenue, r.toolhub_revenue, r.calibration_kits_revenue,
             r.sales_team_size, r.revenue_per_rep, r.deals_per_rep, r.is_synthetic)
            for r in records
        ]
        
        execute_values(cursor, insert_sql, values)
        conn.commit()
        
        return {'status': 'SUCCESS', 'records_inserted': len(records)}
    
    except Exception as e:
        conn.rollback()
        raise ValueError(f"Failed to load CRM data: {e}")
    finally:
        conn.close()


def load_all_data(
    website_records: List[WebsiteMetricsSchema],
    google_ads_records: List[AdsMetricsSchema],
    meta_ads_records: List[AdsMetricsSchema],
    email_records: List[EmailMetricsSchema],
    crm_records: List[CrmMetricsSchema]
) -> Dict[str, Any]:
    """
    Load all data sources. Stops on first failure.
    Returns: {'status': 'SUCCESS', 'total_records': int, 'details': {...}}
    """
    results = {}
    
    results['website'] = load_website_data(website_records)
    results['google_ads'] = load_google_ads_data(google_ads_records)
    results['meta_ads'] = load_meta_ads_data(meta_ads_records)
    results['email'] = load_email_data(email_records)
    results['crm'] = load_crm_data(crm_records)
    
    total = sum(r['records_inserted'] for r in results.values())
    
    return {
        'status': 'SUCCESS',
        'total_records': total,
        'details': results
    }
