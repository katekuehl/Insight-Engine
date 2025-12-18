"""Base class for all analytics operators"""

from abc import ABC, abstractmethod
from typing import Any, Dict
import os
import psycopg2
from psycopg2.extras import RealDictCursor

class BaseOperator(ABC):
    """Base class for all statistical analysis operators"""
    
    def __init__(self):
        self.db_url = os.environ.get("DATABASE_URL")
    
    def get_db_connection(self):
        """Get a database connection"""
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable not set")
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def fetch_metrics_data(self, organization_id: str, date_range_days: int = 30) -> Dict[str, Any]:
        """Fetch normalized metrics data for an organization"""
        with self.get_db_connection() as conn:
            with conn.cursor() as cur:
                # Fetch analytics metrics (column is metric_date, not date)
                cur.execute("""
                    SELECT id, organization_id, integration_id, metric_date as date,
                           users, new_users, sessions, page_views as pageviews, 
                           bounce_rate, avg_session_duration, conversions, conversion_rate,
                           top_pages, traffic_sources
                    FROM metrics_analytics 
                    WHERE organization_id = %s 
                    AND metric_date >= CURRENT_DATE - INTERVAL '%s days'
                    ORDER BY metric_date DESC
                """, (organization_id, date_range_days))
                analytics_metrics = cur.fetchall()
                
                # Fetch ads metrics
                cur.execute("""
                    SELECT id, organization_id, integration_id, metric_date as date,
                           platform, campaign_id, campaign_name, ad_set_id, ad_set_name,
                           impressions, clicks, spend, conversions, revenue, ctr, cpc, roas
                    FROM metrics_ads 
                    WHERE organization_id = %s 
                    AND metric_date >= CURRENT_DATE - INTERVAL '%s days'
                    ORDER BY metric_date DESC
                """, (organization_id, date_range_days))
                ads_metrics = cur.fetchall()
                
                # Fetch CRM metrics
                cur.execute("""
                    SELECT id, organization_id, integration_id, metric_date as date,
                           platform, new_contacts, total_contacts, new_deals, deals_won,
                           deals_lost, revenue, pipeline_value
                    FROM metrics_crm 
                    WHERE organization_id = %s 
                    AND metric_date >= CURRENT_DATE - INTERVAL '%s days'
                    ORDER BY metric_date DESC
                """, (organization_id, date_range_days))
                crm_metrics = cur.fetchall()
                
                return {
                    "analytics": [dict(row) for row in analytics_metrics],
                    "ads": [dict(row) for row in ads_metrics],
                    "crm": [dict(row) for row in crm_metrics],
                }
    
    @abstractmethod
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute the operator and return results"""
        pass
