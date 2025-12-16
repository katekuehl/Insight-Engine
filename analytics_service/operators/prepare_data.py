"""Prepare data operator - fetches and normalizes data for analysis"""

from typing import Any, Dict, List
import numpy as np
from datetime import datetime, timedelta
from .base import BaseOperator

class PrepareDataOperator(BaseOperator):
    """Prepares and normalizes data from various sources for analysis"""
    
    async def execute(
        self,
        organization_id: str,
        config: Dict[str, Any],
        upstream_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        date_range_days = config.get("dateRangeInDays", 30)
        
        # Try to fetch real data
        try:
            data = self.fetch_metrics_data(organization_id, date_range_days)
            
            # If no real data, generate sample data for demonstration
            if not data["analytics"] and not data["ads"] and not data["crm"]:
                data = self._generate_sample_data(date_range_days)
                is_simulated = True
            else:
                is_simulated = False
        except Exception as e:
            # Fall back to sample data if database unavailable
            data = self._generate_sample_data(date_range_days)
            is_simulated = True
        
        # Normalize data into a unified format for analysis
        normalized = self._normalize_data(data)
        
        return {
            "prepared_data": normalized,
            "date_range_days": date_range_days,
            "is_simulated": is_simulated,
            "record_count": {
                "analytics": len(data.get("analytics", [])),
                "ads": len(data.get("ads", [])),
                "crm": len(data.get("crm", [])),
            },
            "prepared_at": datetime.utcnow().isoformat(),
        }
    
    def _generate_sample_data(self, days: int) -> Dict[str, List[Dict]]:
        """Generate sample data for demonstration"""
        np.random.seed(42)  # For reproducibility
        
        base_date = datetime.utcnow().date()
        dates = [(base_date - timedelta(days=i)).isoformat() for i in range(days)]
        
        # Generate analytics data
        analytics = []
        base_sessions = 1000
        base_users = 800
        for i, date in enumerate(dates):
            trend = 1 + (i / days) * 0.1  # Slight upward trend
            noise = np.random.normal(1, 0.1)
            analytics.append({
                "date": date,
                "sessions": int(base_sessions * trend * noise),
                "users": int(base_users * trend * noise),
                "pageviews": int(base_sessions * 2.5 * trend * noise),
                "bounce_rate": round(45 + np.random.normal(0, 5), 2),
                "avg_session_duration": round(180 + np.random.normal(0, 30), 1),
                "conversions": int(50 * trend * noise),
            })
        
        # Generate ads data
        ads = []
        base_spend = 500
        base_impressions = 10000
        for i, date in enumerate(dates):
            trend = 1 + (i / days) * 0.05
            noise = np.random.normal(1, 0.15)
            spend = base_spend * trend * noise
            impressions = int(base_impressions * trend * noise)
            clicks = int(impressions * (0.02 + np.random.normal(0, 0.005)))
            conversions = int(clicks * (0.1 + np.random.normal(0, 0.02)))
            ads.append({
                "date": date,
                "platform": np.random.choice(["google_ads", "facebook_ads"]),
                "spend": round(spend, 2),
                "impressions": impressions,
                "clicks": clicks,
                "conversions": conversions,
                "roas": round((conversions * 50) / max(spend, 1), 2),
            })
        
        # Generate CRM data
        crm = []
        base_contacts = 20
        base_deals = 5
        for i, date in enumerate(dates):
            trend = 1 + (i / days) * 0.08
            noise = np.random.normal(1, 0.2)
            new_contacts = int(base_contacts * trend * noise)
            new_deals = int(base_deals * trend * noise)
            crm.append({
                "date": date,
                "new_contacts": new_contacts,
                "new_deals": new_deals,
                "deals_won": int(new_deals * 0.3 * noise),
                "deals_lost": int(new_deals * 0.2 * noise),
                "pipeline_value": round(new_deals * 5000 * noise, 2),
            })
        
        return {
            "analytics": analytics,
            "ads": ads,
            "crm": crm,
        }
    
    def _normalize_data(self, data: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Normalize data into a unified format for analysis"""
        # Create time series arrays for each metric
        time_series = {}
        
        # Process analytics data
        if data.get("analytics"):
            time_series["sessions"] = [d.get("sessions", 0) for d in data["analytics"]]
            time_series["users"] = [d.get("users", 0) for d in data["analytics"]]
            time_series["pageviews"] = [d.get("pageviews", 0) for d in data["analytics"]]
            time_series["bounce_rate"] = [d.get("bounce_rate", 0) for d in data["analytics"]]
            time_series["conversions"] = [d.get("conversions", 0) for d in data["analytics"]]
            time_series["dates"] = [d.get("date") for d in data["analytics"]]
        
        # Process ads data
        if data.get("ads"):
            time_series["ad_spend"] = [d.get("spend", 0) for d in data["ads"]]
            time_series["impressions"] = [d.get("impressions", 0) for d in data["ads"]]
            time_series["clicks"] = [d.get("clicks", 0) for d in data["ads"]]
            time_series["roas"] = [d.get("roas", 0) for d in data["ads"]]
        
        # Process CRM data  
        if data.get("crm"):
            time_series["new_contacts"] = [d.get("new_contacts", 0) for d in data["crm"]]
            time_series["new_deals"] = [d.get("new_deals", 0) for d in data["crm"]]
            time_series["pipeline_value"] = [d.get("pipeline_value", 0) for d in data["crm"]]
        
        return {
            "time_series": time_series,
            "raw": data,
        }
